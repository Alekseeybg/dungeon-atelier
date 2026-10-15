import { Ajv } from 'ajv'
import schema from '../serialization/dungeon-floor.schema.json' with { type: 'json' }
import { SCHEMA_VERSION } from '../models/dungeon.js'
import type { DungeonFloor, Position, ValidationResult } from '../models/dungeon.js'
import {
  calculateConnectivity,
  containsPosition,
  DIRECTIONS,
  isWalkable,
  positionKey,
} from '../utilities/grid.js'
import { validateConfig } from './config.js'

const validateShape = new Ajv({ allErrors: false, strict: true }).compile<DungeonFloor>(schema)

/** Both external files and freshly generated grids pass through this validator. */
export function validateFloor(value: unknown): ValidationResult {
  if (
    value &&
    typeof value === 'object' &&
    'schemaVersion' in value &&
    value.schemaVersion !== SCHEMA_VERSION
  ) {
    return {
      valid: false,
      errors: [`Unsupported schema version. This application supports version ${SCHEMA_VERSION}.`],
    }
  }
  if (!validateShape(value)) {
    return {
      valid: false,
      errors: (validateShape.errors ?? []).map(
        (error) =>
          `${error.instancePath || '/'} ${error.message ?? 'does not match the floor schema'}`,
      ),
    }
  }
  const floor = value
  const errors = [...validateConfig(floor.config).errors]
  const { width, height, tiles, rooms, doors, stairs, diagnostics } = floor
  if (
    width !== floor.config.width ||
    height !== floor.config.height ||
    floor.seed !== floor.config.seed ||
    floor.floorNumber !== floor.config.floorNumber
  ) {
    errors.push(
      'Floor dimensions, number, and seed must match the stored generation configuration.',
    )
  }
  if (tiles.length !== height || tiles.some((row) => row.length !== width)) {
    return {
      valid: false,
      errors: [...errors, 'Tile grid dimensions do not match width and height.'],
    }
  }
  const inside = (p: Position) => p.x > 0 && p.y > 0 && p.x < width - 1 && p.y < height - 1
  const ids = new Set<string>()
  for (const feature of [...rooms, ...doors, ...stairs]) {
    if (ids.has(feature.id)) errors.push(`Duplicate ID: ${feature.id}.`)
    ids.add(feature.id)
  }
  const owner = new Array<string | undefined>(width * height)
  for (const room of rooms) {
    if (!inside(room) || !inside({ x: room.x + room.width - 1, y: room.y + room.height - 1 })) {
      errors.push(`Room ${room.id} is outside the usable map bounds.`)
      continue
    }
    if (
      room.width < floor.config.minRoomSize ||
      room.height < floor.config.minRoomSize ||
      room.width > floor.config.maxRoomSize ||
      room.height > floor.config.maxRoomSize
    ) {
      errors.push(`Room ${room.id} does not respect the configured room sizes.`)
    }
    for (let y = room.y; y < room.y + room.height; y++) {
      for (let x = room.x; x < room.x + room.width; x++) {
        const index = y * width + x
        if (owner[index]) errors.push(`Rooms overlap at (${x}, ${y}).`)
        owner[index] = room.id
        if (tiles[y][x] !== 'floor') errors.push(`Room ${room.id} must contain only floor terrain.`)
      }
    }
  }
  if (errors.length) return { valid: false, errors: errors.slice(0, 20) }
  const doorPositions = new Set<string>()
  for (const door of doors) {
    const p = door.position
    const key = positionKey(p)
    if (doorPositions.has(key)) errors.push(`Multiple doors at (${key}).`)
    doorPositions.add(key)
    if (!inside(p) || tiles[p.y][p.x] !== 'door') {
      errors.push(`Door ${door.id} must occupy an interior door tile.`)
      continue
    }
    const vertical = door.orientation === 'north-south'
    const along = vertical
      ? [
          { x: p.x, y: p.y - 1 },
          { x: p.x, y: p.y + 1 },
        ]
      : [
          { x: p.x - 1, y: p.y },
          { x: p.x + 1, y: p.y },
        ]
    const across = vertical
      ? [
          { x: p.x - 1, y: p.y },
          { x: p.x + 1, y: p.y },
        ]
      : [
          { x: p.x, y: p.y - 1 },
          { x: p.x, y: p.y + 1 },
        ]
    const adjacentOwners = along.map((next) => owner[next.y * width + next.x])
    if (
      along.some((next) => tiles[next.y][next.x] !== 'floor') ||
      across.some((next) => tiles[next.y][next.x] !== 'wall') ||
      adjacentOwners.filter(Boolean).length !== 1 ||
      !adjacentOwners.includes(door.roomId)
    ) {
      errors.push(
        `Door ${door.id} must join its room to a corridor, with floor on its travel axis and walls on both sides.`,
      )
    }
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const tile = tiles[y][x]
      if ((x === 0 || y === 0 || x === width - 1 || y === height - 1) && tile !== 'wall') {
        errors.push('The outer map boundary must be solid wall.')
      }
      if (tile === 'door' && !doorPositions.has(positionKey({ x, y }))) {
        errors.push(`Door tile (${x}, ${y}) has no door definition.`)
      }
      if (!owner[y * width + x]) continue
      for (const offset of DIRECTIONS) {
        const nx = x + offset.x
        const ny = y + offset.y
        if (
          owner[ny * width + nx] !== owner[y * width + x] &&
          isWalkable(tiles[ny]?.[nx]) &&
          tiles[ny][nx] !== 'door'
        ) {
          errors.push(`Room boundary at (${x}, ${y}) opens without a regular door.`)
        }
      }
    }
  }
  if (
    stairs.filter((stair) => stair.direction === 'up').length !== 1 ||
    stairs.filter((stair) => stair.direction === 'down').length !== 1
  ) {
    errors.push('A floor must contain exactly one up staircase and one down staircase.')
  }
  const stairPositions = new Set<string>()
  for (const stair of stairs) {
    const key = positionKey(stair.position)
    const room = rooms.find((candidate) => candidate.id === stair.roomId)
    if (stairPositions.has(key)) errors.push('Up and down staircases must occupy distinct tiles.')
    stairPositions.add(key)
    if (
      !inside(stair.position) ||
      tiles[stair.position.y]?.[stair.position.x] !== 'floor' ||
      !room ||
      !containsPosition(room, stair.position)
    ) {
      errors.push(`Staircase ${stair.id} must occupy a floor tile in its referenced room.`)
    }
  }
  const connectivity = calculateConnectivity(floor)
  if (!connectivity.ordinaryConnected)
    errors.push(
      'All rooms, corridors, doors, and staircases must be connected by an ordinary traversable route.',
    )
  if (
    diagnostics.requestedRoomCount !== floor.config.targetRoomCount ||
    diagnostics.actualRoomCount !== rooms.length ||
    rooms.length > floor.config.targetRoomCount ||
    diagnostics.doorCount !== doors.length ||
    diagnostics.walkableTileCount !== connectivity.walkableTileCount ||
    diagnostics.connectedRoomCount !== connectivity.connectedRoomCount ||
    diagnostics.ordinaryConnected !== connectivity.ordinaryConnected
  ) {
    errors.push('Stored diagnostics do not match the actual floor geometry and configuration.')
  }
  if (rooms.length < floor.config.targetRoomCount && !diagnostics.warnings.length) {
    errors.push('A floor with fewer rooms than requested must include a generation warning.')
  }
  if (
    diagnostics.placementAttempts < rooms.length ||
    diagnostics.placementAttempts > floor.config.targetRoomCount * 100
  ) {
    errors.push('Room placement attempts are outside the configured generation budget.')
  }
  return { valid: errors.length === 0, errors: [...new Set(errors)].slice(0, 20) }
}
