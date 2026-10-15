import type { DungeonFloor } from '../models/dungeon.js'
import { DIRECTIONS, isWalkable, pathDistances, roomCells } from './grid.js'

/** Collapse each room to one node so open room interiors do not inflate loop counts. */
export function calculateRouteMetrics(
  floor: Pick<DungeonFloor, 'width' | 'height' | 'tiles' | 'rooms' | 'stairs' | 'doors'>,
) {
  const { width, height, tiles, rooms, doors, stairs } = floor
  const owners = new Map<number, number>()
  rooms.forEach((room, i) => roomCells(room).forEach((p) => owners.set(p.y * width + p.x, i)))
  const nodes = new Set<number>()
  const edges = new Set<string>()
  let corridorTileCount = 0
  let deadEndCount = 0
  let walkableCount = 0
  const nodeAt = (x: number, y: number) => owners.get(y * width + x) ?? rooms.length + y * width + x
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      if (!isWalkable(tiles[y][x])) continue
      walkableCount++
      const node = nodeAt(x, y)
      nodes.add(node)
      const neighbors = DIRECTIONS.filter((d) => isWalkable(tiles[y + d.y]?.[x + d.x]))
      if (tiles[y][x] === 'floor' && !owners.has(y * width + x)) {
        corridorTileCount++
        if (neighbors.length === 1) deadEndCount++
      }
      for (const d of neighbors) {
        const other = nodeAt(x + d.x, y + d.y)
        if (other !== node) edges.add(`${Math.min(node, other)}:${Math.max(node, other)}`)
      }
    }
  const up = stairs.find((s) => s.direction === 'up')
  const down = stairs.find((s) => s.direction === 'down')
  const stairDistance =
    up && down
      ? Math.max(0, pathDistances(tiles, up.position)[down.position.y * width + down.position.x])
      : 0
  const sharedDoorCount = doors.filter((door) => {
    const { x, y } = door.position
    const d = door.orientation === 'north-south' ? { x: 0, y: 1 } : { x: 1, y: 0 }
    return owners.has((y - d.y) * width + x - d.x) && owners.has((y + d.y) * width + x + d.x)
  }).length
  return {
    corridorTileCount,
    corridorCoverage: walkableCount ? corridorTileCount / walkableCount : 0,
    deadEndCount,
    stairDistance,
    loopCount: Math.max(0, edges.size - nodes.size + 1),
    sharedDoorCount,
  }
}
