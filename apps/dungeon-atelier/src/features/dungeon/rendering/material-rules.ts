import { isWalkable, roomCells } from '@dungeon-atelier/core'
import type { DungeonFloor } from '@dungeon-atelier/core'
import { tileHash } from './stone-tiles'
import type { TileKind, StoneCondition } from './stone-tiles'

export interface TileMaterial {
  kind: TileKind
  condition: StoneCondition
  variant: number
  label: string
  rule: string
}
export const MATERIAL_RULES = [
  'Each room keeps one paving family; large rooms can use slabs or rare patterned paving.',
  'Corridors use small worn cobbles. Doors, stairs, and their approaches use fitted threshold stone.',
  'Wall corners and door jambs use dressed masonry; other walls use staggered, rough-cut blocks.',
  'Dampness forms continuous seeded patches. Moss appears on damp walls and nearby floor edges.',
  'Cracks cluster in weathered areas. Protected thresholds remain clean and readable.',
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
  const seed = hashSeed(`${floor.seed}:${floor.floorNumber}:materials-v2`)
  const owners = new Map<number, number>()
  const roomStyles = floor.rooms.map((room, index) => {
    const cells = roomCells(room)
    for (const p of cells) owners.set(p.y * floor.width + p.x, index)
    const style = tileHash(room.x, room.y, seed ^ index)
    return cells.length >= 49 && style % 7 === 0
      ? 'mosaic'
      : cells.length >= 25 && style % 3 === 0
        ? 'slab'
        : 'room'
  })
  const stairs = new Set(floor.stairs.map((s) => s.position.y * floor.width + s.position.x))
  const directions = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ] as const
  return {
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
      const kind: TileKind = owner === undefined ? 'corridor' : roomStyles[owner]!
      const edge = sides.some((side) => !side)
      const condition: StoneCondition =
        edge && wet > 0.62
          ? 'mossy'
          : age > 0.68 && variant % 3 === 0
            ? 'cracked'
            : owner === undefined
              ? 'worn'
              : 'clean'
      const label =
        kind === 'mosaic'
          ? 'Patterned paving'
          : kind === 'slab'
            ? 'Large stone slabs'
            : kind === 'corridor'
              ? 'Worn cobbles'
              : 'Flagstone'
      return {
        kind,
        condition,
        variant,
        label,
        rule:
          condition === 'cracked'
            ? 'A weathering patch cracks the paving away from protected thresholds.'
            : condition === 'mossy'
              ? 'Damp patches allow moss along floor edges, close to walls.'
              : kind === 'corridor'
                ? 'Corridors use small cobbles polished by foot traffic.'
                : kind === 'mosaic'
                  ? 'A rare large-room finish; the paving pattern stays consistent across the room.'
                  : kind === 'slab'
                    ? 'This room uses broad slabs as one consistent paving family.'
                    : 'This room uses irregular flagstones as one consistent paving family.',
      }
    },
  }
}
