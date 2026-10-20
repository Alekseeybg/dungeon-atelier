import type { DungeonFloor, Position, Door } from '@dungeon-atelier/core'

/** Pure presentation geometry. No DOM, generator calls, mutation, or random stream. */
export const WALL = { north: 1, east: 2, south: 4, west: 8 } as const
export const NEIGHBORS = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
] as const
export const ARCHITECTURE_LAYERS = [
  'void',
  'floor',
  'markings',
  'shadows',
  'architecture',
  'light',
  'emissive',
  'grid',
] as const
export type ArchitectureLayer = (typeof ARCHITECTURE_LAYERS)[number]
export interface ArchitectureOptions {
  revealSecrets?: boolean
  /** Optional presentation overrides for previews; not door simulation or saved state. */
  openDoorIds?: readonly string[]
}
export type WallShape =
  'pillar' | 'end' | 'horizontal' | 'vertical' | 'inner-corner' | 'outer-corner' | 'tee' | 'cross'
export interface SpriteDefinition {
  id: string
  atlas: string
  source: { x: number; y: number; width: number; height: number }
  footprint: { width: number; height: number }
  width: number
  height: number
  anchor: Position
  offset: Position
  layer: ArchitectureLayer
  variants?: readonly string[]
  connectivityMask?: number
}
export function visualOpen(tile: string | undefined) {
  return tile === 'floor' || tile === 'door'
}
export type DoorFacing = 'north' | 'south' | 'east' | 'west'
/** Door metadata determines the travel axis; the owner's actual footprint determines facing.
 * Unrelated corridor branches never determine the orientation of an irregular-room doorway. */
export function doorFacing(floor: DungeonFloor, door: Door): DoorFacing {
  const owner = floor.rooms.find((room) => room.id === door.roomId)
  if (owner) {
    const inside = (x: number, y: number) => {
      const rx = x - owner.x,
        ry = y - owner.y
      return (
        rx >= 0 &&
        ry >= 0 &&
        rx < owner.width &&
        ry < owner.height &&
        (!owner.floorCells || owner.floorCells.some((cell) => cell.x === rx && cell.y === ry))
      )
    }
    const { x, y } = door.position
    if (door.orientation === 'north-south') {
      if (inside(x, y + 1)) return 'north'
      if (inside(x, y - 1)) return 'south'
      return y < owner.y + owner.height / 2 ? 'north' : 'south'
    }
    if (inside(x - 1, y)) return 'east'
    if (inside(x + 1, y)) return 'west'
    return x < owner.x + owner.width / 2 ? 'west' : 'east'
  }
  // Legacy malformed presentation input: keep the explicit axis and a stable facing.
  return door.orientation === 'north-south' ? 'north' : 'west'
}
export function wallShape(mask: number, diagonalOpenMask = 0): WallShape {
  const count = [1, 2, 4, 8].filter((bit) => mask & bit).length
  if (!count) return 'pillar'
  if (count === 1) return 'end'
  if (count === 3) return 'tee'
  if (count === 4) return 'cross'
  if (mask === 5) return 'vertical'
  if (mask === 10) return 'horizontal'
  const cornerBit = mask === 3 ? 1 : mask === 6 ? 2 : mask === 12 ? 4 : 8
  return diagonalOpenMask & cornerBit ? 'inner-corner' : 'outer-corner'
}

/** A render-only view: concealed routes are indistinguishable from untouched rock. */
export function concealSecretArchitecture(floor: DungeonFloor): DungeonFloor {
  const hidden = floor.doors.filter((door) => door.type === 'secret')
  if (!hidden.length && !floor.shortcuts?.length) return floor
  const tiles = floor.tiles.map((row) => [...row])
  for (const route of floor.shortcuts ?? [])
    for (const p of route.path) {
      if (tiles[p.y]?.[p.x] !== undefined) tiles[p.y]![p.x] = 'wall'
    }
  for (const door of hidden) tiles[door.position.y]![door.position.x] = 'wall'
  return {
    ...floor,
    tiles,
    doors: floor.doors.filter((door) => door.type !== 'secret'),
    shortcuts: [],
  }
}

export interface WallCell extends Position {
  mask: number
  exposed: number
  diagonalOpen: number
  shape: WallShape
  variant: number
  cornerFill: number
}

/** A connected, narrow masonry footprint, rather than an extruded full square tile. */
export function wallCapRects(mask: number, cornerFill: number, size: number) {
  const inset = (size * 3) / 16,
    middle = size - inset * 2
  const rects = [{ x: inset, y: inset, width: middle, height: middle }]
  if (mask & 1) rects.push({ x: inset, y: 0, width: middle, height: inset })
  if (mask & 2) rects.push({ x: size - inset, y: inset, width: inset, height: middle })
  if (mask & 4) rects.push({ x: inset, y: size - inset, width: middle, height: inset })
  if (mask & 8) rects.push({ x: 0, y: inset, width: inset, height: middle })
  for (const [bit, x, y] of [
    [1, size - inset, 0],
    [2, size - inset, size - inset],
    [4, 0, size - inset],
    [8, 0, 0],
  ])
    if (cornerFill & bit!) rects.push({ x: x!, y: y!, width: inset, height: inset })
  return rects
}
export function capCornerOptions(mask: number) {
  let bits = 0
  for (const [sides, bit] of [
    [3, 1],
    [6, 2],
    [12, 4],
    [9, 8],
  ])
    if ((mask & sides!) === sides) bits |= bit!
  return bits
}
/** Merge exposed south contour spans; a joined lower cap never gets an internal face. */
export function wallFrontSegments(mask: number, corner: number, size: number) {
  const rects = wallCapRects(mask, corner, size),
    steps = [0, (size * 3) / 16, (size * 13) / 16, size]
  const occupied = (x: number, y: number) =>
    rects.some((r) => x >= r.x && x < r.x + r.width && y >= r.y && y < r.y + r.height)
  const segments: { x: number; y: number; width: number }[] = []
  for (let row = 0; row < 3; row++)
    for (let col = 0; col < 3; col++) {
      const x = steps[col]!,
        width = steps[col + 1]! - x,
        y = steps[row + 1]!
      if (
        !occupied(x + width / 2, (steps[row]! + y) / 2) ||
        y === size ||
        occupied(x + width / 2, y + size * 0.01)
      )
        continue
      const last = segments.at(-1)
      if (last && last.y === y && last.x + last.width === x) last.width += width
      else segments.push({ x, y, width })
    }
  return segments
}
/** East contour, extruded toward the floor by the same projection as the south face. */
export function wallEastSegments(mask: number, corner: number, size: number) {
  const rects = wallCapRects(mask, corner, size),
    steps = [0, (size * 3) / 16, (size * 13) / 16, size]
  const occupied = (x: number, y: number) =>
    rects.some((r) => x >= r.x && x < r.x + r.width && y >= r.y && y < r.y + r.height)
  const segments: { x: number; y: number; height: number }[] = []
  for (let col = 0; col < 3; col++)
    for (let row = 0; row < 3; row++) {
      const x = steps[col + 1]!,
        y = steps[row]!,
        height = steps[row + 1]! - y
      if (
        !occupied((steps[col]! + x) / 2, y + height / 2) ||
        x === size ||
        occupied(x + size * 0.01, y + height / 2)
      )
        continue
      const last = segments.at(-1)
      if (last && last.x === x && last.y + last.height === y) last.height += height
      else segments.push({ x, y, height })
    }
  return segments
}
export interface ArchitecturePlan {
  floor: DungeonFloor
  walls: WallCell[]
  doors: Door[]
  torches: Position[]
  wallKeys: Set<number>
  seed: number
}
export function visualHash(x: number, y: number, seed: number) {
  let value = Math.imul(x + 1, 374761393) ^ Math.imul(y + 1, 668265263) ^ seed
  value = Math.imul(value ^ (value >>> 13), 1274126177)
  return (value ^ (value >>> 16)) >>> 0
}
export function createArchitecturePlan(
  source: DungeonFloor,
  options: ArchitectureOptions = {},
): ArchitecturePlan {
  const floor = options.revealSecrets ? source : concealSecretArchitecture(source)
  let seed = 2166136261
  // Keep the established seed salt so Ancient masonry and lighting remain unchanged.
  for (const char of `${floor.seed}:${floor.floorNumber}:dimensional-v1`)
    seed = Math.imul(seed ^ char.charCodeAt(0), 16777619)
  const open = (x: number, y: number) => visualOpen(floor.tiles[y]?.[x])
  const wallKeys = new Set<number>()
  for (let y = 0; y < floor.height; y++)
    for (let x = 0; x < floor.width; x++) {
      if (open(x, y)) continue
      let exposed = false
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) if (open(x + dx, y + dy)) exposed = true
      if (exposed) wallKeys.add(y * floor.width + x)
    }
  // Open portals interrupt the cap, while their frames still join the surrounding masonry.
  const solid = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < floor.width && y < floor.height && wallKeys.has(y * floor.width + x)
  const walls: WallCell[] = []
  for (const key of wallKeys) {
    const x = key % floor.width,
      y = Math.floor(key / floor.width)
    let mask = 0,
      exposed = 0,
      diagonalOpen = 0,
      cornerFill = 0
    NEIGHBORS.forEach(([dx, dy], index) => {
      if (solid(x + dx, y + dy)) mask |= 1 << index
      const portal = floor.doors.find(
        (door) => door.position.x === x + dx && door.position.y === y + dy,
      )
      if (
        portal &&
        (dx ? portal.orientation === 'north-south' : portal.orientation === 'east-west')
      )
        mask |= 1 << index
      if (open(x + dx, y + dy)) exposed |= 1 << index
    })
    ;(
      [
        [1, -1],
        [1, 1],
        [-1, 1],
        [-1, -1],
      ] as const
    ).forEach(([dx, dy], index) => {
      if (open(x + dx, y + dy)) diagonalOpen |= 1 << index
      if (solid(x + dx, y + dy)) cornerFill |= 1 << index
    })
    cornerFill &= capCornerOptions(mask)
    walls.push({
      x,
      y,
      mask,
      exposed,
      diagonalOpen,
      shape: wallShape(mask, diagonalOpen),
      variant: visualHash(x, y, seed) % 4,
      cornerFill,
    })
  }
  const torches: Position[] = [],
    torchKeys = new Set<number>()
  for (const room of floor.rooms) {
    const cells =
      room.floorCells ??
      Array.from({ length: room.width * room.height }, (_, i) => ({
        x: i % room.width,
        y: Math.floor(i / room.width),
      }))
    for (const relative of cells) {
      const x = room.x + relative.x,
        y = room.y + relative.y - 1,
        key = y * floor.width + x
      if (relative.x % 4 !== 1 || open(x, y) || !solid(x, y) || torchKeys.has(key)) continue
      torches.push({ x, y })
      torchKeys.add(key)
    }
  }
  return { floor, walls, doors: floor.doors, torches, wallKeys, seed: seed >>> 0 }
}

/** Cardinal flood for static light: walls and closed doors receive light but do not transmit it. */
export function architectureLightCells(
  plan: ArchitecturePlan,
  torch: Position,
  openDoors: ReadonlySet<string> = new Set(),
  radius = 4,
) {
  const { floor } = plan,
    start = { x: torch.x, y: torch.y + 1, distance: 0 }
  const queue = [start],
    seen = new Set<number>([start.y * floor.width + start.x]),
    walls = new Set<number>([torch.y * floor.width + torch.x])
  const closed = new Set(
    plan.doors
      .filter((door) => !openDoors.has(door.id))
      .map((door) => door.position.y * floor.width + door.position.x),
  )
  for (let i = 0; i < queue.length; i++) {
    const p = queue[i]!
    for (const [dx, dy] of NEIGHBORS) {
      const x = p.x + dx,
        y = p.y + dy,
        key = y * floor.width + x
      if (x < 0 || y < 0 || x >= floor.width || y >= floor.height) continue
      if (!visualOpen(floor.tiles[y]?.[x]) || closed.has(key)) {
        walls.add(key)
        continue
      }
      if (p.distance >= radius || seen.has(key)) continue
      seen.add(key)
      queue.push({ x, y, distance: p.distance + 1 })
    }
  }
  return {
    floors: queue,
    walls: [...walls].map((key) => ({ x: key % floor.width, y: Math.floor(key / floor.width) })),
  }
}
