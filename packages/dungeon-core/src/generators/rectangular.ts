import { CONFIG_LIMITS, GENERATOR_VERSION, SCHEMA_VERSION } from '../models/dungeon.js'
import type {
  Door,
  DungeonFloor,
  FloorResult,
  GenerationConfig,
  Position,
  Room,
  Staircase,
  Terrain,
} from '../models/dungeon.js'
import { calculateConnectivity, DIRECTIONS, pathDistances, roomCenter } from '../utilities/grid.js'
import { createSeededRandom } from '../utilities/random.js'
import { validateConfig } from '../validators/config.js'
import { validateFloor } from '../validators/floor.js'

interface Portal {
  position: Position
  approach: Position
  orientation: Door['orientation']
  roomId: string
}
interface Connection {
  path: Position[]
  from: Portal
  to: Portal
}

function portals(room: Room): Portal[] {
  const center = roomCenter(room)
  return [
    {
      position: { x: center.x, y: room.y - 1 },
      approach: { x: center.x, y: room.y - 2 },
      orientation: 'north-south',
      roomId: room.id,
    },
    {
      position: { x: room.x + room.width, y: center.y },
      approach: { x: room.x + room.width + 1, y: center.y },
      orientation: 'east-west',
      roomId: room.id,
    },
    {
      position: { x: center.x, y: room.y + room.height },
      approach: { x: center.x, y: room.y + room.height + 1 },
      orientation: 'north-south',
      roomId: room.id,
    },
    {
      position: { x: room.x - 1, y: center.y },
      approach: { x: room.x - 2, y: center.y },
      orientation: 'east-west',
      roomId: room.id,
    },
  ]
}

/** Multi-source breadth-first search outside the protected one-tile room perimeter. */
function findConnection(
  fromRoom: Room,
  toRoom: Room,
  tiles: Terrain[][],
  protectedTiles: boolean[],
  newPassageOnly: boolean,
): Connection | undefined {
  const height = tiles.length
  const width = tiles[0].length
  const allowed = (p: Position) =>
    p.x > 0 && p.y > 0 && p.x < width - 1 && p.y < height - 1 && !protectedTiles[p.y * width + p.x]
  const starts = portals(fromRoom).filter((portal) => allowed(portal.approach))
  const ends = portals(toRoom).filter((portal) => allowed(portal.approach))
  const destinations = new Map(
    ends.map((portal) => [portal.approach.y * width + portal.approach.x, portal]),
  )
  const previous = new Array<number>(width * height).fill(-2)
  const origins = new Map<number, Portal>()
  const queue: number[] = []
  for (const portal of starts) {
    const index = portal.approach.y * width + portal.approach.x
    previous[index] = -1
    origins.set(index, portal)
    queue.push(index)
  }
  for (let head = 0; head < queue.length; head++) {
    const current = queue[head]
    const destination = destinations.get(current)
    if (destination) {
      const path: Position[] = []
      let index = current
      while (previous[index] !== -1) {
        path.push({ x: index % width, y: Math.floor(index / width) })
        index = previous[index]
      }
      path.push({ x: index % width, y: Math.floor(index / width) })
      if (!newPassageOnly || path.some((p) => tiles[p.y][p.x] === 'wall')) {
        return { path: path.reverse(), from: origins.get(index)!, to: destination }
      }
      // A zero-length or reused connection is not a new loop. Keep searching.
    }
    const p = { x: current % width, y: Math.floor(current / width) }
    for (const direction of DIRECTIONS) {
      const next = { x: p.x + direction.x, y: p.y + direction.y }
      const index = next.y * width + next.x
      if (!allowed(next) || previous[index] !== -2) continue
      if (newPassageOnly && tiles[next.y][next.x] !== 'wall' && !destinations.has(index)) continue
      previous[index] = current
      queue.push(index)
    }
  }
  return undefined
}

function carveConnection(connection: Connection, tiles: Terrain[][], doors: Door[]) {
  for (const p of connection.path) tiles[p.y][p.x] = 'floor'
  for (const portal of [connection.from, connection.to]) {
    if (tiles[portal.position.y][portal.position.x] === 'door') continue
    tiles[portal.position.y][portal.position.x] = 'door'
    doors.push({
      id: `door-${String(doors.length + 1).padStart(3, '0')}`,
      position: { ...portal.position },
      type: 'regular',
      orientation: portal.orientation,
      roomId: portal.roomId,
    })
  }
}

function placeStairs(tiles: Terrain[][], rooms: Room[], floorNumber: number): Staircase[] {
  const width = tiles[0].length
  const farthestRoom = (start: Room, exclude?: Room) => {
    const distances = pathDistances(tiles, roomCenter(start))
    return rooms
      .filter((room) => room !== exclude)
      .reduce((best, room) => {
        const a = roomCenter(best)
        const b = roomCenter(room)
        return distances[b.y * width + b.x] > distances[a.y * width + a.x] ? room : best
      })
  }
  const upRoom = farthestRoom(rooms[0])
  const downRoom = farthestRoom(upRoom, upRoom)
  return [
    {
      id: `floor-${floorNumber}-stairs-up`,
      position: roomCenter(upRoom),
      direction: 'up',
      roomId: upRoom.id,
    },
    {
      id: `floor-${floorNumber}-stairs-down`,
      position: roomCenter(downRoom),
      direction: 'down',
      roomId: downRoom.id,
    },
  ]
}

/** Bounded placement, deterministic spanning tree, optional loops, and final grid validation. */
export function generateDungeon(configuration: GenerationConfig): FloorResult {
  const validation = validateConfig(configuration)
  if (!validation.valid) return { ok: false, errors: validation.errors }
  const config = { ...configuration }
  const random = createSeededRandom(config.seed)
  const rooms: Room[] = []
  const budget = config.targetRoomCount * CONFIG_LIMITS.placementAttemptsPerRoom
  let attempts = 0
  while (rooms.length < config.targetRoomCount && attempts < budget) {
    attempts++
    const width = random.integer(config.minRoomSize, config.maxRoomSize)
    const height = random.integer(config.minRoomSize, config.maxRoomSize)
    const room: Room = {
      id: `room-${String(rooms.length + 1).padStart(3, '0')}`,
      x: random.integer(3, config.width - width - 3),
      y: random.integer(3, config.height - height - 3),
      width,
      height,
    }
    // Three empty tiles between floor rectangles leave room for walls and corridors.
    if (
      rooms.some(
        (other) =>
          room.x < other.x + other.width + 3 &&
          room.x + room.width + 3 > other.x &&
          room.y < other.y + other.height + 3 &&
          room.y + room.height + 3 > other.y,
      )
    )
      continue
    rooms.push(room)
  }
  if (rooms.length < CONFIG_LIMITS.minRoomCount) {
    return {
      ok: false,
      errors: [
        `Only ${rooms.length} room could be placed after ${attempts} attempts. At least two rooms are required. Increase the map size or reduce room dimensions; the supplied seed and settings were not changed.`,
      ],
    }
  }
  const tiles = Array.from({ length: config.height }, () =>
    new Array<Terrain>(config.width).fill('wall'),
  )
  const protectedTiles = new Array<boolean>(config.width * config.height).fill(false)
  for (const room of rooms) {
    for (let y = room.y - 1; y <= room.y + room.height; y++) {
      for (let x = room.x - 1; x <= room.x + room.width; x++) {
        protectedTiles[y * config.width + x] = true
        if (x >= room.x && x < room.x + room.width && y >= room.y && y < room.y + room.height)
          tiles[y][x] = 'floor'
      }
    }
  }
  const pairs: { a: number; b: number; distance: number }[] = []
  for (let a = 0; a < rooms.length; a++) {
    for (let b = a + 1; b < rooms.length; b++) {
      const start = roomCenter(rooms[a])
      const end = roomCenter(rooms[b])
      pairs.push({ a, b, distance: Math.abs(start.x - end.x) + Math.abs(start.y - end.y) })
    }
  }
  pairs.sort((a, b) => a.distance - b.distance || a.a - b.a || a.b - b.b)
  const connected = new Set([0])
  const treeEdges = new Set<string>()
  const doors: Door[] = []
  // Prim's spanning tree over room centers. Each edge is routed against actual geometry.
  while (connected.size < rooms.length) {
    const edge = pairs.find((pair) => connected.has(pair.a) !== connected.has(pair.b))
    if (!edge) return { ok: false, errors: ['No spanning-tree connection was available.'] }
    const connection = findConnection(rooms[edge.a], rooms[edge.b], tiles, protectedTiles, false)
    if (!connection)
      return {
        ok: false,
        errors: [
          `Could not connect ${rooms[edge.a].id} to ${rooms[edge.b].id} without breaking room walls.`,
        ],
      }
    carveConnection(connection, tiles, doors)
    connected.add(edge.a)
    connected.add(edge.b)
    treeEdges.add(`${edge.a}:${edge.b}`)
  }
  // At most N nearest non-tree pairs are considered. p is a probability per candidate.
  const candidates = pairs
    .filter((pair) => !treeEdges.has(`${pair.a}:${pair.b}`))
    .slice(0, rooms.length)
  for (const candidate of candidates) {
    if (random.next() >= config.extraConnectionChance) continue
    const connection = findConnection(
      rooms[candidate.a],
      rooms[candidate.b],
      tiles,
      protectedTiles,
      true,
    )
    if (connection) carveConnection(connection, tiles, doors)
  }
  const warnings =
    rooms.length < config.targetRoomCount
      ? [
          `Placed ${rooms.length} of ${config.targetRoomCount} requested rooms within ${attempts} attempts. Try a larger map or smaller rooms for a closer match.`,
        ]
      : []
  const stairs = placeStairs(tiles, rooms, config.floorNumber)
  const connectivity = calculateConnectivity({ tiles, rooms, stairs, width: config.width })
  const floor: DungeonFloor = {
    schemaVersion: SCHEMA_VERSION,
    generatorVersion: GENERATOR_VERSION,
    seed: config.seed,
    config,
    floorNumber: config.floorNumber,
    width: config.width,
    height: config.height,
    tiles,
    rooms,
    doors,
    stairs,
    diagnostics: {
      requestedRoomCount: config.targetRoomCount,
      actualRoomCount: rooms.length,
      ...connectivity,
      doorCount: doors.length,
      placementAttempts: attempts,
      warnings,
    },
  }
  const completed = validateFloor(floor)
  return completed.valid ? { ok: true, floor } : { ok: false, errors: completed.errors }
}
