import {
  CONFIG_LIMITS,
  GENERATOR_VERSION,
  SCHEMA_VERSION,
  LAYOUT_PRESETS,
} from '../models/dungeon.js'
import type {
  Door,
  DungeonFloor,
  FloorResult,
  GenerationConfig,
  Position,
  Room,
  RoomGroup,
  RoomDesign,
  Staircase,
  Shortcut,
  Terrain,
} from '../models/dungeon.js'
import {
  calculateConnectivity,
  containsPosition,
  DIRECTIONS,
  isWalkable,
  pathDistances,
  roomCells,
  roomCenter,
} from '../utilities/grid.js'
import { shapeRoom, chamberBlueprint } from './room-designs.js'
import { calculateRouteMetrics } from '../utilities/metrics.js'
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
interface Pair {
  a: number
  b: number
  distance: number
}

function portals(room: Room, tiles: Terrain[][]): Portal[] {
  const center = roomCenter(room)
  const candidates: Portal[] = []
  for (let x = room.x; x < room.x + room.width; x++) {
    for (const [y, dy] of [
      [room.y - 1, -1],
      [room.y + room.height, 1],
    ]) {
      if (containsPosition(room, { x, y: y - dy }))
        candidates.push({
          position: { x, y },
          approach: { x, y: y + dy },
          orientation: 'north-south',
          roomId: room.id,
        })
    }
  }
  for (let y = room.y; y < room.y + room.height; y++) {
    for (const [x, dx] of [
      [room.x - 1, -1],
      [room.x + room.width, 1],
    ]) {
      if (containsPosition(room, { x: x - dx, y }))
        candidates.push({
          position: { x, y },
          approach: { x: x + dx, y },
          orientation: 'east-west',
          roomId: room.id,
        })
    }
  }
  return candidates
    .filter((p) => {
      const { x, y } = p.position
      const across =
        p.orientation === 'north-south'
          ? [
              { x: x - 1, y },
              { x: x + 1, y },
            ]
          : [
              { x, y: y - 1 },
              { x, y: y + 1 },
            ]
      if (room.groupId && tiles[y]?.[x] !== 'door') return false
      return across.every((q) => tiles[q.y]?.[q.x] === 'wall')
    })
    .sort(
      (a, b) =>
        Math.abs(a.position.x - center.x) +
          Math.abs(a.position.y - center.y) -
          Math.abs(b.position.x - center.x) -
          Math.abs(b.position.y - center.y) ||
        a.position.y - b.position.y ||
        a.position.x - b.position.x,
    )
}

function findConnection(
  fromRoom: Room,
  toRoom: Room,
  tiles: Terrain[][],
  protectedTiles: boolean[],
  mode: 'ordinary' | 'extra' | 'secret',
): Connection | undefined {
  const height = tiles.length,
    width = tiles[0].length
  // Secret entrances must be new openings, never relabeled ordinary doors.
  const freshEntrance = (portal: Portal) =>
    mode !== 'secret' || tiles[portal.position.y][portal.position.x] === 'wall'
  const from = portals(fromRoom, tiles).filter(freshEntrance),
    to = portals(toRoom, tiles).filter(freshEntrance)
  // A single doorway can join two rooms through their shared wall.
  for (const portal of from) {
    if (
      tiles[portal.position.y][portal.position.x] !== 'wall' ||
      !containsPosition(toRoom, portal.approach)
    )
      continue
    const opposite = to.find(
      (p) => p.position.x === portal.position.x && p.position.y === portal.position.y,
    )
    if (opposite) return { path: [], from: portal, to: opposite }
  }
  const allowed = (p: Position) =>
    p.x > 0 &&
    p.y > 0 &&
    p.x < width - 1 &&
    p.y < height - 1 &&
    !protectedTiles[p.y * width + p.x] &&
    (mode !== 'secret' ||
      (tiles[p.y][p.x] === 'wall' &&
        DIRECTIONS.every((d) => !isWalkable(tiles[p.y + d.y]?.[p.x + d.x]))))
  const starts = from.filter((p) => allowed(p.approach))
  const ends = to.filter((p) => allowed(p.approach))
  const destinations = new Map(ends.map((p) => [p.approach.y * width + p.approach.x, p]))
  const previous = new Array<number>(width * height).fill(-2)
  const origins = new Map<number, Portal>()
  const queue: number[] = []
  for (const portal of starts) {
    const index = portal.approach.y * width + portal.approach.x
    if (previous[index] !== -2) continue
    previous[index] = -1
    origins.set(index, portal)
    queue.push(index)
  }
  for (let head = 0; head < queue.length; head++) {
    const current = queue[head],
      destination = destinations.get(current)
    if (destination) {
      const path: Position[] = []
      let index = current
      while (previous[index] !== -1) {
        path.push({ x: index % width, y: Math.floor(index / width) })
        index = previous[index]
      }
      path.push({ x: index % width, y: Math.floor(index / width) })
      if (mode === 'ordinary' || path.some((p) => tiles[p.y][p.x] === 'wall'))
        return { path: path.reverse(), from: origins.get(index)!, to: destination }
    }
    const p = { x: current % width, y: Math.floor(current / width) }
    for (const d of DIRECTIONS) {
      const next = { x: p.x + d.x, y: p.y + d.y },
        index = next.y * width + next.x
      if (!allowed(next) || previous[index] !== -2) continue
      if (mode !== 'ordinary' && tiles[next.y][next.x] !== 'wall' && !destinations.has(index))
        continue
      previous[index] = current
      queue.push(index)
    }
  }
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
        const a = roomCenter(best),
          b = roomCenter(room)
        return distances[b.y * width + b.x] > distances[a.y * width + a.x] ? room : best
      })
  }
  const up = farthestRoom(rooms[0]),
    down = farthestRoom(up, up)
  return [up, down].map((room, i) => ({
    id: `floor-${floorNumber}-stairs-${i ? 'down' : 'up'}`,
    position: roomCenter(room),
    direction: i ? ('down' as const) : ('up' as const),
    roomId: room.id,
  }))
}

function rankDetours(pairs: Pair[], rooms: Room[], tiles: Terrain[][]) {
  const width = tiles[0].length
  const distances = rooms.map((room) => pathDistances(tiles, roomCenter(room)))
  return pairs
    .map((pair) => {
      const target = roomCenter(rooms[pair.b])
      const walking = distances[pair.a][target.y * width + target.x]
      return { ...pair, walking, score: walking - pair.distance }
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.walking - a.walking ||
        a.distance - b.distance ||
        a.a - b.a ||
        a.b - b.b,
    )
}

function addSidePassages(
  tiles: Terrain[][],
  protectedTiles: boolean[],
  roomCount: number,
  random: ReturnType<typeof createSeededRandom>,
) {
  const width = tiles[0].length,
    height = tiles.length
  const candidates: Position[] = []
  for (let y = 2; y < height - 2; y++)
    for (let x = 2; x < width - 2; x++)
      if (tiles[y][x] === 'floor' && !protectedTiles[y * width + x]) candidates.push({ x, y })
  let added = 0
  for (
    let attempt = 0;
    attempt < roomCount && candidates.length && added < Math.ceil(roomCount / 3);
    attempt++
  ) {
    if (random.next() >= 0.2) continue
    const start = candidates[random.integer(0, candidates.length - 1)]
    const d = DIRECTIONS[random.integer(0, 3)],
      path: Position[] = []
    const length = random.integer(2, 4)
    for (let step = 1; step <= length; step++) {
      const p = { x: start.x + d.x * step, y: start.y + d.y * step }
      if (
        p.x < 1 ||
        p.y < 1 ||
        p.x >= width - 1 ||
        p.y >= height - 1 ||
        protectedTiles[p.y * width + p.x] ||
        tiles[p.y][p.x] !== 'wall'
      )
        break
      if (DIRECTIONS.filter((n) => isWalkable(tiles[p.y + n.y]?.[p.x + n.x])).length !== 1) break
      tiles[p.y][p.x] = 'floor'
      path.push(p)
    }
    if (path.length < 2) for (const p of path) tiles[p.y][p.x] = 'wall'
    else added++
  }
}

export function generateDungeon(configuration: GenerationConfig): FloorResult {
  const validation = validateConfig(configuration)
  if (!validation.valid) return { ok: false, errors: validation.errors }
  const style = configuration.layoutStyle ?? 'classic'
  const config = {
    ...configuration,
    layoutStyle: style,
    roomSpacing: configuration.roomSpacing ?? LAYOUT_PRESETS[style].roomSpacing,
    roomShapeChance: configuration.roomShapeChance ?? 0,
    shortcutChance: configuration.shortcutChance ?? 0,
    roomDesigns: configuration.roomDesigns ?? (['l-shaped', 't-shaped'] as RoomDesign[]),
    chamberBlockChance: configuration.chamberBlockChance ?? 0,
  }
  const random = createSeededRandom(config.seed),
    rooms: Room[] = []
  const budget = config.targetRoomCount * CONFIG_LIMITS.placementAttemptsPerRoom
  let attempts = 0
  const roomGroups: RoomGroup[] = []
  const prebuiltDoors: Door[] = []
  const occupied: { x: number; y: number; width: number; height: number }[] = []
  const designWarnings: string[] = []
  const blockRandom = createSeededRandom(`${config.seed}:chamber-blocks`)
  if (blockRandom.next() < config.chamberBlockChance) {
    const blueprint = chamberBlueprint(config, blockRandom)
    if (blueprint) {
      const origin = {
        x: blockRandom.integer(3, config.width - blueprint.width - 3),
        y: blockRandom.integer(3, config.height - blueprint.height - 3),
      }
      const absolute = (p: Position) => ({ x: origin.x + p.x, y: origin.y + p.y })
      const groupId = 'group-001'
      for (const chamber of blueprint.rooms)
        rooms.push({
          ...chamber,
          ...absolute(chamber),
          id: `room-${String(rooms.length + 1).padStart(3, '0')}`,
          shape: 'rectangle',
          groupId,
        })
      for (const entry of blueprint.entrances)
        prebuiltDoors.push({
          id: `door-${String(prebuiltDoors.length + 1).padStart(3, '0')}`,
          position: absolute(entry.position),
          orientation: entry.orientation,
          roomId: rooms[entry.roomIndex].id,
          type: 'regular',
        })
      const group: RoomGroup = {
        ...origin,
        width: blueprint.width,
        height: blueprint.height,
        id: groupId,
        kind: 'chamber-block',
        orientation: blueprint.orientation,
        roomIds: rooms.map((room) => room.id),
        corridorCells: blueprint.corridorCells.map(absolute),
      }
      roomGroups.push(group)
      occupied.push(group)
      attempts += rooms.length
    } else
      designWarnings.push(
        'A chamber block needs four room slots and enough space for paired chambers within the configured room-size range. No block fits these settings.',
      )
  }
  while (rooms.length < config.targetRoomCount && attempts < budget) {
    attempts++
    const width = random.integer(config.minRoomSize, config.maxRoomSize),
      height = random.integer(config.minRoomSize, config.maxRoomSize)
    const room: Room = {
      id: `room-${String(rooms.length + 1).padStart(3, '0')}`,
      x: random.integer(3, config.width - width - 3),
      y: random.integer(3, config.height - height - 3),
      width,
      height,
    }
    const spacing = config.roomSpacing
    if (
      occupied.some(
        (other) =>
          room.x < other.x + other.width + spacing &&
          room.x + room.width + spacing > other.x &&
          room.y < other.y + other.height + spacing &&
          room.y + room.height + spacing > other.y,
      )
    )
      continue
    shapeRoom(room, random, config.roomShapeChance, config.roomDesigns)
    rooms.push(room)
    occupied.push(room)
  }
  if (rooms.length < CONFIG_LIMITS.minRoomCount)
    return {
      ok: false,
      errors: [
        `Only ${rooms.length} room could be placed after ${attempts} attempts. At least two rooms are required. Increase the map size or reduce room dimensions.`,
      ],
    }
  const tiles = Array.from({ length: config.height }, () =>
    new Array<Terrain>(config.width).fill('wall'),
  )
  const protectedTiles = new Array<boolean>(config.width * config.height).fill(false)
  for (const room of rooms) {
    for (let y = room.y - 1; y <= room.y + room.height; y++)
      for (let x = room.x - 1; x <= room.x + room.width; x++)
        protectedTiles[y * config.width + x] = true
    for (const p of roomCells(room)) tiles[p.y][p.x] = 'floor'
  }
  // Reserve each compound plan's masonry; only its predefined corridor can be reused.
  for (const group of roomGroups) {
    for (let y = group.y; y < group.y + group.height; y++)
      for (let x = group.x; x < group.x + group.width; x++)
        protectedTiles[y * config.width + x] = true
    for (const p of group.corridorCells) {
      tiles[p.y][p.x] = 'floor'
      protectedTiles[p.y * config.width + p.x] = false
    }
  }
  for (const door of prebuiltDoors) tiles[door.position.y][door.position.x] = 'door'
  const pairs: Pair[] = []
  for (let a = 0; a < rooms.length; a++)
    for (let b = a + 1; b < rooms.length; b++) {
      const from = roomCenter(rooms[a]),
        to = roomCenter(rooms[b])
      pairs.push({ a, b, distance: Math.abs(from.x - to.x) + Math.abs(from.y - to.y) })
    }
  pairs.sort((a, b) => a.distance - b.distance || a.a - b.a || a.b - b.b)
  const connected = new Set<number>(),
    treeEdges = new Set<string>(),
    doors: Door[] = [...prebuiltDoors]
  const refreshConnected = () => {
    const distances = pathDistances(tiles, roomCenter(rooms[0]))
    rooms.forEach((room, i) => {
      const p = roomCenter(room)
      if (distances[p.y * config.width + p.x] >= 0) connected.add(i)
    })
  }
  refreshConnected()
  while (connected.size < rooms.length) {
    let routed = false
    for (const edge of pairs.filter((pair) => connected.has(pair.a) !== connected.has(pair.b))) {
      const connection = findConnection(
        rooms[edge.a],
        rooms[edge.b],
        tiles,
        protectedTiles,
        'ordinary',
      )
      if (!connection) continue
      carveConnection(connection, tiles, doors)
      refreshConnected()
      treeEdges.add(`${edge.a}:${edge.b}`)
      routed = true
      break
    }
    if (!routed)
      return {
        ok: false,
        errors: [
          'Room geometry leaves no valid route connecting all rooms. Increase spacing or map size, or reduce room sizes.',
        ],
      }
  }
  // Favor connections between regions with long existing detours, rather than nearest pairs alone.
  const candidates = rankDetours(
    pairs.filter((p) => !treeEdges.has(`${p.a}:${p.b}`)),
    rooms,
    tiles,
  ).slice(0, rooms.length)
  for (const candidate of candidates) {
    if (random.next() >= config.extraConnectionChance) continue
    const connection = findConnection(
      rooms[candidate.a],
      rooms[candidate.b],
      tiles,
      protectedTiles,
      'extra',
    )
    if (!connection) continue
    const from = roomCenter(rooms[candidate.a]),
      target = roomCenter(rooms[candidate.b])
    const before = pathDistances(tiles, from)[target.y * config.width + target.x]
    const trial = tiles.map((row) => [...row])
    carveConnection(connection, trial, [])
    const after = pathDistances(trial, from)[target.y * config.width + target.x]
    const saved = before - after
    if (saved < 4) continue
    // Short, dramatic links belong exclusively to the separately rolled rare pass.
    if (connection.path.length <= 12 && saved >= 12 && saved / before >= 0.35) continue
    carveConnection(connection, tiles, doors)
  }
  // Finish ordinary excavation first, so later branches cannot breach a secret route.
  addSidePassages(
    tiles,
    protectedTiles,
    rooms.length,
    createSeededRandom(`${config.seed}:side-passages`),
  )
  const shortcuts: Shortcut[] = []
  let shortcutCount = 0,
    shortcutTilesSaved = 0
  const shortcutRandom = createSeededRandom(`${config.seed}:shortcuts`)
  if (shortcutRandom.next() < config.shortcutChance) {
    const ranked = rankDetours(pairs, rooms, tiles).slice(0, rooms.length * 2)
    for (const candidate of ranked) {
      if (candidate.walking < 20 || candidate.score < 12) continue
      const connection = findConnection(
        rooms[candidate.a],
        rooms[candidate.b],
        tiles,
        protectedTiles,
        'secret',
      )
      if (!connection || connection.path.length > 12) continue
      const trial = tiles.map((row) => [...row])
      carveConnection(connection, trial, [])
      const target = roomCenter(rooms[candidate.b])
      const after = pathDistances(trial, roomCenter(rooms[candidate.a]))[
        target.y * config.width + target.x
      ]
      const saved = candidate.walking - after
      if (after < 0 || saved < 12 || saved / candidate.walking < 0.35) continue
      carveConnection(connection, tiles, doors)
      const path = [connection.from.position, ...connection.path, connection.to.position]
        .filter((p, i, all) => i === 0 || p.x !== all[i - 1].x || p.y !== all[i - 1].y)
        .map((p) => ({ ...p }))
      for (const door of doors) {
        if (
          [path[0], path[path.length - 1]].some(
            (p) => p.x === door.position.x && p.y === door.position.y,
          )
        )
          door.type = 'secret'
      }
      shortcuts.push({
        id: 'shortcut-001',
        isolated: true,
        fromRoomId: rooms[candidate.a].id,
        toRoomId: rooms[candidate.b].id,
        path,
        distanceBefore: candidate.walking,
        distanceAfter: after,
        tilesSaved: saved,
      })
      shortcutCount = 1
      shortcutTilesSaved = saved
      break
    }
  }
  const warnings = designWarnings.concat(
    rooms.length < config.targetRoomCount
      ? [
          `Placed ${rooms.length} of ${config.targetRoomCount} requested rooms within ${attempts} attempts. Try a larger map or smaller rooms for a closer match.`,
        ]
      : [],
  )
  const stairs = placeStairs(tiles, rooms, config.floorNumber)
  const geometry = { width: config.width, height: config.height, tiles, rooms, stairs, doors }
  const floor: DungeonFloor = {
    schemaVersion: SCHEMA_VERSION,
    generatorVersion: GENERATOR_VERSION,
    seed: config.seed,
    config,
    floorNumber: config.floorNumber,
    ...geometry,
    shortcuts,
    roomGroups,
    diagnostics: {
      requestedRoomCount: config.targetRoomCount,
      actualRoomCount: rooms.length,
      ...calculateConnectivity(geometry),
      ...calculateRouteMetrics(geometry),
      doorCount: doors.length,
      placementAttempts: attempts,
      warnings,
      shortcutCount,
      shortcutTilesSaved,
    },
  }
  const completed = validateFloor(floor)
  return completed.valid ? { ok: true, floor } : { ok: false, errors: completed.errors }
}
