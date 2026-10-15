import type { DungeonFloor, Position, Room, Terrain } from '../models/dungeon.js'

export const DIRECTIONS: readonly Position[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
]
export const positionKey = ({ x, y }: Position) => `${x},${y}`
export const roomCenter = (room: Room): Position => ({
  x: room.x + Math.floor(room.width / 2),
  y: room.y + Math.floor(room.height / 2),
})
export const containsPosition = (room: Room, position: Position) =>
  position.x >= room.x &&
  position.x < room.x + room.width &&
  position.y >= room.y &&
  position.y < room.y + room.height
export const isWalkable = (tile: Terrain | undefined) => tile === 'floor' || tile === 'door'

/** -1 means blocked or unreachable. The queue is bounded by the number of tiles. */
export function pathDistances(tiles: Terrain[][], start: Position): number[] {
  const height = tiles.length
  const width = tiles[0]?.length ?? 0
  const distances = new Array<number>(width * height).fill(-1)
  if (!isWalkable(tiles[start.y]?.[start.x])) return distances
  const queue = [start.y * width + start.x]
  distances[queue[0]] = 0
  for (let head = 0; head < queue.length; head++) {
    const current = queue[head]
    const x = current % width
    const y = Math.floor(current / width)
    for (const direction of DIRECTIONS) {
      const nx = x + direction.x
      const ny = y + direction.y
      const index = ny * width + nx
      if (nx < 0 || nx >= width || ny < 0 || ny >= height || distances[index] !== -1) continue
      if (!isWalkable(tiles[ny][nx])) continue
      distances[index] = distances[current] + 1
      queue.push(index)
    }
  }
  return distances
}

export function calculateConnectivity(
  floor: Pick<DungeonFloor, 'tiles' | 'rooms' | 'stairs' | 'width'>,
) {
  const start =
    floor.stairs.find((stair) => stair.direction === 'up')?.position ??
    (floor.rooms[0] ? roomCenter(floor.rooms[0]) : { x: 0, y: 0 })
  const distances = pathDistances(floor.tiles, start)
  const walkableTileCount = floor.tiles.reduce(
    (total, row) => total + row.filter(isWalkable).length,
    0,
  )
  const reachableTileCount = distances.filter((distance) => distance >= 0).length
  const connectedRoomCount = floor.rooms.filter(
    (room) => distances[room.y * floor.width + room.x] >= 0,
  ).length
  return {
    walkableTileCount,
    connectedRoomCount,
    ordinaryConnected:
      walkableTileCount > 0 &&
      reachableTileCount === walkableTileCount &&
      connectedRoomCount === floor.rooms.length,
  }
}
