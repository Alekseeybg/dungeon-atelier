import type { DungeonFloor, Position, Staircase } from '@dungeon-atelier/core'

export const STAIR_PRESENTATIONS = [
  { value: 'recessed', label: 'A · Fitted stone well · recommended' },
  { value: 'cheeked', label: 'B · Raised stone cheeks' },
  { value: 'plain', label: 'C · Low-profile flight' },
] as const
export type StairPresentation = (typeof STAIR_PRESENTATIONS)[number]['value']
export const STAIR_ARROWS = [
  { value: 'brass', label: 'A · Brass level symbol · recommended' },
  { value: 'stone', label: 'B · Pale stone level symbol' },
  { value: 'iron', label: 'C · Iron level symbol' },
] as const
export type StairArrow = 'none' | (typeof STAIR_ARROWS)[number]['value']
export type StairProfile = 'current' | 'ascending'
export interface StonePoint {
  x: number
  y: number
  z: number
}
/** One logical stair cell: direction changes elevation, never terrain or collision. */
export function stairTreads(stair: Staircase, profile: StairProfile = 'current') {
  const x = stair.position.x * 32,
    y = stair.position.y * 32,
    rise = stair.direction === 'down' ? -1 : profile === 'ascending' ? 3.2 : 2
  return Array.from({ length: 6 }, (_, i) => {
    const z = i === 5 ? 0 : (rise * (5 - i)) / 24,
      top = y + 4 + i * 4
    return {
      points: [
        { x: x + 5, y: top, z },
        { x: x + 27, y: top, z },
        { x: x + 27, y: top + 4, z },
        { x: x + 5, y: top + 4, z },
      ],
      z,
      nextZ: i >= 4 ? 0 : (rise * (4 - i)) / 24,
    }
  })
}

/** Up/down level glyph, drawn on its own plaque beside the staircase. */
export function stairArrowOutline(direction: Staircase['direction']) {
  return [
    [16, 6.5],
    [22, 14],
    [18, 13],
    [18, 23],
    [19, 26],
    [16, 24.7],
    [13, 26],
    [14, 23],
    [14, 13],
    [10, 14],
  ].map(([x, y]) => ({ x: x!, y: direction === 'up' ? y! : 32 - y! }))
}

/** Find adjacent clear floor without reserving terrain or painting over another staircase. */
export interface StairMarkerBox {
  x: number
  y: number
  width: number
  height: number
  /** Compact rooms can mount the same level plaque on nearby room-facing masonry. */
  plane?: 'wall'
}
export function stairMarkerPlacement(
  floor: Pick<DungeonFloor, 'tiles' | 'stairs'>,
  stair: Staircase,
  visible?: (box: StairMarkerBox) => boolean,
): StairMarkerBox | undefined {
  const { x, y } = stair.position,
    reserved = new Set(floor.stairs.map((s) => `${s.position.x},${s.position.y}`)),
    candidates = [
      { x: x + 1, y, cx: 12 },
      { x: x - 1, y, cx: 20 },
      { x, y: y + 1, cx: 16 },
      ...(stair.direction === 'down' ? [{ x, y: y - 1, cx: 16 }] : []),
      // Tight generated rooms may have a foreground cap over every cardinal neighbor.
      // A diagonal floor sign remains beside the flight, never on its treads.
      ...(visible
        ? [
            { x: x - 1, y: y - 1, cx: 20 },
            { x: x + 1, y: y - 1, cx: 12 },
            { x: x - 1, y: y + 1, cx: 20 },
            { x: x + 1, y: y + 1, cx: 12 },
            { x: x - 1, y: y - 1, cx: 12 },
            { x: x + 1, y: y - 1, cx: 20 },
            { x: x - 1, y, cx: 12 },
            { x: x + 1, y, cx: 20 },
          ]
        : []),
    ]
  for (const cell of candidates) {
    if (floor.tiles[cell.y]?.[cell.x] !== 'floor' || reserved.has(`${cell.x},${cell.y}`)) continue
    const box = { x: cell.x * 32 + cell.cx - 7, y: cell.y * 32 + 4, width: 14, height: 24 }
    if (!visible || visible(box)) return box
  }
  return undefined
}

/** Static light starts on the mounted side and cannot traverse masonry or closed doors. */
export function mountedLightCells(
  floor: DungeonFloor,
  torch: Position,
  face: 'south' | 'east',
  openDoors: ReadonlySet<string>,
  radius = 4,
) {
  const start = {
      x: torch.x + (face === 'east' ? 1 : 0),
      y: torch.y + (face === 'south' ? 1 : 0),
      distance: 0,
    },
    closed = new Set(
      floor.doors.filter((d) => !openDoors.has(d.id)).map((d) => `${d.position.x},${d.position.y}`),
    ),
    open = (x: number, y: number) =>
      ['floor', 'door'].includes(floor.tiles[y]?.[x] ?? '') && !closed.has(`${x},${y}`),
    seen = new Set<string>(),
    floors: (typeof start)[] = [],
    walls = new Map<string, Position>()
  if (!open(start.x, start.y)) return { floors, walls: [] }
  const queue = [start]
  seen.add(`${start.x},${start.y}`)
  for (let i = 0; i < queue.length; i++) {
    const p = queue[i]!
    floors.push(p)
    for (const [dx, dy] of [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ] as const) {
      const x = p.x + dx,
        y = p.y + dy,
        key = `${x},${y}`
      if (x < 0 || y < 0 || x >= floor.width || y >= floor.height) continue
      if (!open(x, y)) {
        walls.set(key, { x, y })
        continue
      }
      if (p.distance >= radius || seen.has(key)) continue
      seen.add(key)
      queue.push({ x, y, distance: p.distance + 1 })
    }
  }
  return { floors, walls: [...walls.values()] }
}
