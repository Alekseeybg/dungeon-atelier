import { Ajv } from 'ajv'
import schema from '../serialization/dungeon-floor.schema.json' with { type: 'json' }
import legacySchema from '../serialization/dungeon-floor.v1.schema.json' with { type: 'json' }
import { SCHEMA_VERSION } from '../models/dungeon.js'
import type { DungeonFloor, Position, ValidationResult } from '../models/dungeon.js'
import {
  calculateConnectivity,
  containsPosition,
  DIRECTIONS,
  isWalkable,
  positionKey,
  roomCells,
  roomCenter,
  pathDistances,
} from '../utilities/grid.js'
import { validateConfig } from './config.js'
import { calculateRouteMetrics } from '../utilities/metrics.js'

const validateCurrentShape = new Ajv({ allErrors: false, strict: true }).compile<DungeonFloor>(
  schema,
)
const validateLegacyShape = new Ajv({ allErrors: false, strict: true }).compile<DungeonFloor>(
  legacySchema,
)

/** Both external files and freshly generated grids pass through this validator. */
export function validateFloor(value: unknown): ValidationResult {
  if (
    value &&
    typeof value === 'object' &&
    'schemaVersion' in value &&
    value.schemaVersion !== SCHEMA_VERSION &&
    value.schemaVersion !== 1
  ) {
    return {
      valid: false,
      errors: [
        `Unsupported schema version. This application supports versions 1 and ${SCHEMA_VERSION}.`,
      ],
    }
  }
  const validateShape =
    value && typeof value === 'object' && 'schemaVersion' in value && value.schemaVersion === 1
      ? validateLegacyShape
      : validateCurrentShape
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
  for (const feature of [
    ...rooms,
    ...doors,
    ...stairs,
    ...(floor.shortcuts ?? []),
    ...(floor.roomGroups ?? []),
  ]) {
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
    if (room.shape && room.shape !== 'rectangle' && !room.floorCells)
      errors.push('Shaped rooms require explicit floor cells.')
    if (room.floorCells) {
      const local = new Set(room.floorCells.map((p) => p.y * room.width + p.x))
      if (
        local.size !== room.floorCells.length ||
        room.floorCells.some((p) => p.x < 0 || p.y < 0 || p.x >= room.width || p.y >= room.height)
      ) {
        errors.push('Room ' + room.id + ' has duplicate or out-of-bounds floor cells.')
        continue
      }
      const seen = new Set<number>()
      const queue = [room.floorCells[0]]
      seen.add(queue[0].y * room.width + queue[0].x)
      for (let i = 0; i < queue.length; i++)
        for (const d of DIRECTIONS) {
          const p = { x: queue[i].x + d.x, y: queue[i].y + d.y },
            key = p.y * room.width + p.x
          if (
            p.x < 0 ||
            p.y < 0 ||
            p.x >= room.width ||
            p.y >= room.height ||
            !local.has(key) ||
            seen.has(key)
          )
            continue
          seen.add(key)
          queue.push(p)
        }
      if (seen.size !== local.size)
        errors.push('Room ' + room.id + ' has a disconnected footprint.')
      if (
        !room.floorCells.some((p) => p.x === 0) ||
        !room.floorCells.some((p) => p.y === 0) ||
        !room.floorCells.some((p) => p.x === room.width - 1) ||
        !room.floorCells.some((p) => p.y === room.height - 1)
      )
        errors.push('Room footprint must reach its stored bounding edges.')
    }
    for (const p of roomCells(room)) {
      const index = p.y * width + p.x
      if (owner[index]) errors.push('Rooms overlap at (' + p.x + ', ' + p.y + ').')
      owner[index] = room.id
      if (tiles[p.y][p.x] !== 'floor')
        errors.push('Room ' + room.id + ' must contain only floor terrain.')
    }
  }
  if (errors.length) return { valid: false, errors: errors.slice(0, 20) }
  for (const room of rooms) {
    if (
      room.groupId &&
      !floor.roomGroups?.some(
        (group) => group.id === room.groupId && group.roomIds.includes(room.id),
      )
    )
      errors.push('Room group membership must reference an existing containing group.')
  }
  for (const group of floor.roomGroups ?? []) {
    const inBounds = (p: Position) =>
      p.x >= group.x &&
      p.y >= group.y &&
      p.x < group.x + group.width &&
      p.y < group.y + group.height
    if (
      !inside(group) ||
      !inside({ x: group.x + group.width - 1, y: group.y + group.height - 1 })
    ) {
      errors.push('Chamber block bounds must remain inside the map.')
      continue
    }
    if (![4, 6].includes(group.roomIds.length) || !floor.config.chamberBlockChance)
      errors.push(
        'Chamber blocks require four or six room members and an enabled generation chance.',
      )
    const members = rooms.filter((room) => group.roomIds.includes(room.id))
    if (
      members.length !== group.roomIds.length ||
      members.some(
        (room) =>
          room.groupId !== group.id ||
          room.shape !== 'rectangle' ||
          !roomCells(room).every(inBounds),
      )
    )
      errors.push('Chamber block members must be distinct rectangular rooms inside their group.')
    const corridor = new Set(group.corridorCells.map(positionKey))
    if (
      group.corridorCells.some(
        (p) => !inBounds(p) || tiles[p.y]?.[p.x] !== 'floor' || owner[p.y * width + p.x],
      )
    )
      errors.push('Group corridors must be floor tiles inside the group, separate from rooms.')
    const seen = new Set<string>(),
      queue = [group.corridorCells[0]]
    seen.add(positionKey(queue[0]))
    for (let i = 0; i < queue.length; i++)
      for (const d of DIRECTIONS) {
        const p = { x: queue[i].x + d.x, y: queue[i].y + d.y },
          key = positionKey(p)
        if (corridor.has(key) && !seen.has(key)) {
          seen.add(key)
          queue.push(p)
        }
      }
    if (seen.size !== corridor.size)
      errors.push('A chamber block needs one connected shared corridor.')
    for (const room of members) {
      const entries = doors.filter((door) => door.roomId === room.id)
      if (
        entries.length !== 1 ||
        entries.some(
          (door) =>
            door.type !== 'regular' ||
            !inBounds(door.position) ||
            !DIRECTIONS.some((d) =>
              corridor.has(positionKey({ x: door.position.x + d.x, y: door.position.y + d.y })),
            ),
        )
      )
        errors.push('Each chamber needs exactly one ordinary door onto its shared corridor.')
    }
    for (let y = group.y; y < group.y + group.height; y++)
      for (let x = group.x; x < group.x + group.width; x++) {
        if (
          tiles[y][x] === 'floor' &&
          !corridor.has(positionKey({ x, y })) &&
          !group.roomIds.includes(owner[y * width + x] ?? '')
        )
          errors.push('Unrecorded floor or unrelated room inside a chamber block.')
      }
  }
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
      !(
        adjacentOwners.filter(Boolean).length === 1 ||
        (floor.schemaVersion === 2 &&
          adjacentOwners.every(Boolean) &&
          adjacentOwners[0] !== adjacentOwners[1])
      ) ||
      !adjacentOwners.includes(door.roomId)
    ) {
      errors.push(
        `Door ${door.id} must join its room to a corridor or another room, with floor on its travel axis and walls on both sides.`,
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
          errors.push(`Room boundary at (${x}, ${y}) opens without a door.`)
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
  const metrics = calculateRouteMetrics(floor)
  for (const key of [
    'corridorTileCount',
    'corridorCoverage',
    'deadEndCount',
    'stairDistance',
    'loopCount',
    'sharedDoorCount',
  ] as const) {
    if (diagnostics[key] !== undefined && diagnostics[key] !== metrics[key])
      errors.push('Stored route metric ' + key + ' does not match the floor.')
  }
  if (
    diagnostics.shortcutCount !== undefined &&
    ((diagnostics.shortcutCount === 0 && (diagnostics.shortcutTilesSaved ?? 0) !== 0) ||
      (diagnostics.shortcutCount === 1 &&
        ((diagnostics.shortcutTilesSaved ?? 0) < 12 || !floor.config.shortcutChance)))
  )
    errors.push('Shortcut diagnostics are inconsistent with generation settings.')
  if (floor.shortcuts !== undefined) {
    if (floor.shortcuts.length !== (diagnostics.shortcutCount ?? 0))
      errors.push('Shortcut records do not match the reported count.')
    for (const shortcut of floor.shortcuts) {
      const from = rooms.find((room) => room.id === shortcut.fromRoomId),
        to = rooms.find((room) => room.id === shortcut.toRoomId)
      if (!from || !to || from.id === to.id) {
        errors.push('Shortcut must reference two distinct existing rooms.')
        continue
      }
      if (
        shortcut.path.some(
          (p, i) =>
            !inside(p) ||
            !isWalkable(tiles[p.y]?.[p.x]) ||
            (i > 0 &&
              Math.abs(p.x - shortcut.path[i - 1].x) + Math.abs(p.y - shortcut.path[i - 1].y) !==
                1),
        )
      )
        errors.push('Shortcut path must be a contiguous interior walkable route.')
      if (new Set(shortcut.path.map(positionKey)).size !== shortcut.path.length)
        errors.push('Shortcut path must not repeat tiles.')
      const first = shortcut.path[0],
        last = shortcut.path[shortcut.path.length - 1]
      const enters = (p: Position, room: typeof from) =>
        DIRECTIONS.some((d) => containsPosition(room, { x: p.x + d.x, y: p.y + d.y }))
      if (
        tiles[first.y]?.[first.x] !== 'door' ||
        tiles[last.y]?.[last.x] !== 'door' ||
        !enters(first, from) ||
        !enters(last, to)
      )
        errors.push('Shortcut route must start and end at doors adjoining its referenced rooms.')
      if (
        [first, last].some(
          (p) =>
            !doors.some(
              (door) => door.type === 'secret' && positionKey(door.position) === positionKey(p),
            ),
        )
      )
        errors.push('Shortcut entrances must be marked as secret doors.')
      if (shortcut.isolated) {
        const interior = shortcut.path.slice(1, -1)
        if (
          interior.some((p, i) => {
            const adjacent = [shortcut.path[i], shortcut.path[i + 2]].map(positionKey)
            return (
              owner[p.y * width + p.x] ||
              tiles[p.y]?.[p.x] !== 'floor' ||
              DIRECTIONS.some((d) => {
                const next = { x: p.x + d.x, y: p.y + d.y }
                return isWalkable(tiles[next.y]?.[next.x]) && !adjacent.includes(positionKey(next))
              })
            )
          })
        )
          errors.push(
            'Secret shortcut interiors must be unbranched and sealed from ordinary rooms and corridors.',
          )
        const closed = tiles.map((row) => [...row])
        for (const p of shortcut.path) if (inside(p)) closed[p.y][p.x] = 'wall'
        const target = roomCenter(to)
        const before = pathDistances(closed, roomCenter(from))[target.y * width + target.x]
        if (before !== shortcut.distanceBefore)
          errors.push(
            'Secret shortcut distanceBefore must match the route with the secret passage sealed.',
          )
        if (!calculateConnectivity({ ...floor, tiles: closed }).ordinaryConnected)
          errors.push(
            'Ordinary dungeon routes must remain connected with the secret shortcut sealed.',
          )
      }
      const target = roomCenter(to)
      const actual = pathDistances(tiles, roomCenter(from))[target.y * width + target.x]
      if (
        shortcut.distanceAfter !== actual ||
        shortcut.distanceBefore - shortcut.distanceAfter !== shortcut.tilesSaved ||
        shortcut.tilesSaved / shortcut.distanceBefore < 0.35 ||
        shortcut.tilesSaved !== diagnostics.shortcutTilesSaved
      )
        errors.push('Shortcut route and savings metadata are inconsistent.')
    }
  }
  return { valid: errors.length === 0, errors: [...new Set(errors)].slice(0, 20) }
}
