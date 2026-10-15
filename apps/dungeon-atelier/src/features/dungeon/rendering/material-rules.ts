import { isWalkable, roomCells } from '@dungeon-atelier/core'
import type { DungeonFloor, Room } from '@dungeon-atelier/core'
import { tileHash } from './stone-tiles'
import type { TileKind, StoneCondition } from './stone-tiles'

export interface TileMaterial {
  kind: TileKind
  condition: StoneCondition
  variant: number
  label: string
  rule: string
  roomIdentity?: string | undefined
}
export type RoomRole =
  'chamber' | 'hub' | 'stair' | 'secret-entry' | 'template' | 'ceremonial' | 'damp'
export interface RoomFinish {
  room: Room
  cells: Set<number>
  role: RoomRole
  label: string
  kind: 'room' | 'slab' | 'mosaic'
}
const ROOM_LABELS: Record<RoomRole, string> = {
  chamber: 'Ordinary chamber',
  hub: 'Junction chamber',
  stair: 'Stair chamber',
  'secret-entry': 'Secret-door chamber',
  template: 'Chamber-block suite',
  ceremonial: 'Patterned chamber',
  damp: 'Damp chamber',
}
export const MATERIAL_RULES = [
  'Room finishes reflect stairs, chamber blocks, junctions, and secret entrances; rare broad rooms use patterned paving.',
  'Corridors alternate cobbles and broad repaired stones in continuous patches, with subtle central wear.',
  'Doors, stairs, and their approaches use clean fitted thresholds; room borders follow the actual footprint.',
  'Wall corners and door jambs use dressed masonry; other walls use staggered, rough-cut blocks.',
  'Dampness forms continuous seeded patches. Moss appears on damp walls and nearby floor edges.',
  'Cracks and grime cluster in weathered areas; scattered chips stay away from protected thresholds.',
  'Center inlays appear only where a complete footprint fits. These visual identities add no gameplay features.',
] as const

function hashSeed(value: string) {
  let seed = 2166136261
  for (let i = 0; i < value.length; i++) seed = Math.imul(seed ^ value.charCodeAt(i), 16777619)
  return seed >>> 0
}
function noise(x: number, y: number, seed: number, scale: number) {
  const gx = Math.floor(x / scale),
    gy = Math.floor(y / scale)
  const u = x / scale - gx,
    v = y / scale - gy
  const sx = u * u * (3 - 2 * u),
    sy = v * v * (3 - 2 * v)
  const at = (dx: number, dy: number) => tileHash(gx + dx, gy + dy, seed) / 4294967295
  return (
    (at(0, 0) * (1 - sx) + at(1, 0) * sx) * (1 - sy) + (at(0, 1) * (1 - sx) + at(1, 1) * sx) * sy
  )
}

/** Materials are derived from geometry and a separate seed; they never change walkability. */
export function createMaterialPlan(floor: DungeonFloor) {
  const seed = hashSeed(`${floor.seed}:${floor.floorNumber}:materials-v3`)
  const owners = new Map<number, number>()
  const groups = new Set(floor.roomGroups?.flatMap((group) => group.roomIds) ?? [])
  const stairRooms = new Set(floor.stairs.map((stair) => stair.roomId))
  const rooms: RoomFinish[] = floor.rooms.map((room, index) => {
    const cells = roomCells(room)
    for (const p of cells) owners.set(p.y * floor.width + p.x, index)
    const style = tileHash(room.x, room.y, seed ^ index)
    const doors = floor.doors.filter((door) => door.roomId === room.id)
    const role: RoomRole = stairRooms.has(room.id)
      ? 'stair'
      : groups.has(room.id)
        ? 'template'
        : doors.some((door) => door.type === 'secret')
          ? 'secret-entry'
          : doors.length >= 3
            ? 'hub'
            : cells.length >= 35 && style % 5 === 0
              ? 'ceremonial'
              : noise(room.x, room.y, seed ^ 0x87a13, 5) > 0.64
                ? 'damp'
                : 'chamber'
    const kind =
      role === 'ceremonial' || (role === 'template' && cells.length >= 25)
        ? 'mosaic'
        : role === 'stair' || role === 'hub' || (cells.length >= 25 && style % 3 === 0)
          ? 'slab'
          : 'room'
    return {
      room,
      cells: new Set(cells.map((p) => p.y * floor.width + p.x)),
      role,
      label: ROOM_LABELS[role],
      kind,
    }
  })
  const stairs = new Set(floor.stairs.map((s) => s.position.y * floor.width + s.position.x))
  const directions = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ] as const
  const roomAt = (x: number, y: number) => {
    const index = owners.get(y * floor.width + x)
    return index === undefined ? undefined : rooms[index]
  }
  return {
    rooms,
    roomAt,
    at(x: number, y: number): TileMaterial {
      const key = y * floor.width + x
      const tile = floor.tiles[y]?.[x]
      const open = isWalkable(tile)
      const nearDoor = directions.some(([dx, dy]) => floor.tiles[y + dy]?.[x + dx] === 'door')
      const nearStairs = directions.some(([dx, dy]) => stairs.has((y + dy) * floor.width + x + dx))
      const sides = directions.map(([dx, dy]) => isWalkable(floor.tiles[y + dy]?.[x + dx]))
      const wet = noise(x, y, seed ^ 0x87a13, 5)
      const age = noise(x, y, seed ^ 0xc17b3, 3)
      const variant = tileHash(x, y, seed) % 16
      if (open && (tile === 'door' || stairs.has(key) || nearDoor || nearStairs)) {
        return {
          kind: 'threshold',
          condition: 'clean',
          variant,
          label: 'Fitted threshold',
          rule: 'Doors, staircases, and adjacent approaches use clean fitted paving.',
          roomIdentity: roomAt(x, y)?.label,
        }
      }
      if (!open) {
        const diagonal = (
          [
            [-1, -1],
            [1, -1],
            [1, 1],
            [-1, 1],
          ] as const
        ).some(([dx, dy]) => isWalkable(floor.tiles[y + dy]?.[x + dx]))
        if (!sides.some(Boolean) && !diagonal)
          return {
            kind: 'rock',
            condition: 'clean',
            variant,
            label: 'Solid rock',
            rule: 'Unexcavated stone stays hidden outside the dungeon boundary.',
          }
        const corner =
          sides.some((side, i) => side && sides[(i + 1) % 4]) || (!sides.some(Boolean) && diagonal)
        if (corner || nearDoor)
          return {
            kind: 'wall-dressed',
            condition: 'clean',
            variant,
            label: 'Dressed masonry',
            rule: 'Exposed corners and doorway frames use reinforced, dressed blocks.',
          }
        const condition = wet > 0.62 ? 'mossy' : age > 0.68 ? 'cracked' : 'clean'
        return {
          kind: 'wall',
          condition,
          variant,
          label: 'Rough-cut masonry',
          rule:
            condition === 'mossy'
              ? 'A continuous damp patch adds mineral stains and moss to this wall.'
              : condition === 'cracked'
                ? 'A seeded weathering patch adds cracks and chipped mortar.'
                : 'Ordinary wall runs use staggered rough-cut stone courses.',
        }
      }
      const owner = owners.get(key)
      const finish = owner === undefined ? undefined : rooms[owner]
      const kind: TileKind =
        finish?.kind ?? (noise(x, y, seed ^ 0x331fd, 4) > 0.53 ? 'corridor-slab' : 'corridor')
      const edge = sides.some((side) => !side)
      const condition: StoneCondition =
        edge && (wet > 0.62 || finish?.role === 'damp')
          ? 'mossy'
          : age > 0.68 && variant % 3 === 0
            ? 'cracked'
            : edge && age > 0.55 && variant % 3 === 1
              ? 'grimy'
              : owner === undefined || finish?.role === 'hub'
                ? 'worn'
                : 'clean'
      const label =
        kind === 'mosaic'
          ? 'Patterned paving'
          : kind === 'slab'
            ? 'Large stone slabs'
            : kind === 'corridor-slab'
              ? 'Repaired passage slabs'
              : kind === 'corridor'
                ? 'Worn cobbles'
                : 'Flagstone'
      return {
        kind,
        condition,
        variant,
        label,
        roomIdentity: finish?.label,
        rule:
          condition === 'grimy'
            ? 'Dirt settles in sheltered edges; tiny stone chips collect beside the paving.'
            : condition === 'cracked'
              ? 'A weathering patch cracks the paving away from protected thresholds.'
              : condition === 'mossy'
                ? 'Damp patches allow moss along floor edges, close to walls.'
                : kind === 'corridor' || kind === 'corridor-slab'
                  ? 'Coherent patches of cobbles and replacement slabs share a worn central path.'
                  : kind === 'mosaic'
                    ? finish?.role === 'template'
                      ? 'Chamber-block rooms share fitted patterned paving.'
                      : 'A rare broad-room finish; the paving pattern stays consistent across the room.'
                    : kind === 'slab'
                      ? 'This room uses broad slabs as one consistent paving family.'
                      : 'This room uses irregular flagstones as one consistent paving family.',
      }
    },
  }
}
