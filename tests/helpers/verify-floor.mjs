import assert from 'node:assert/strict'
import {
  generateDungeon,
  exportFloorJson,
  importFloorJson,
  validateFloor,
} from '../../packages/dungeon-core/dist/index.js'
export const steps = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
]
export const open = (value) => value === 'floor' || value === 'door'
export const key = (p) => `${p.x},${p.y}`
export const cells = (r) =>
  r.floorCells
    ? r.floorCells.map((p) => ({ x: r.x + p.x, y: r.y + p.y }))
    : Array.from({ length: r.width * r.height }, (_, i) => ({
        x: r.x + (i % r.width),
        y: r.y + Math.floor(i / r.width),
      }))
// Deliberately independent of the production grid/pathfinding helpers.
export function flood(floor, start, blocked = new Set()) {
  const { width, height, tiles } = floor,
    distances = new Int32Array(width * height).fill(-1),
    queue = new Int32Array(width * height)
  let head = 0,
    tail = 0
  const index = start.y * width + start.x
  if (!open(tiles[start.y]?.[start.x]) || blocked.has(index)) return distances
  queue[tail++] = index
  distances[index] = 0
  while (head < tail) {
    const i = queue[head++],
      x = i % width,
      y = Math.floor(i / width)
    for (const [dx, dy] of steps) {
      const nx = x + dx,
        ny = y + dy,
        n = ny * width + nx
      if (
        nx < 0 ||
        ny < 0 ||
        nx >= width ||
        ny >= height ||
        distances[n] >= 0 ||
        blocked.has(n) ||
        !open(tiles[ny][nx])
      )
        continue
      distances[n] = distances[i] + 1
      queue[tail++] = n
    }
  }
  return distances
}
export function verifyFloor(floor) {
  const { width, height, tiles, rooms, doors, stairs } = floor
  assert.equal(tiles.length, height)
  assert(tiles.every((r) => r.length === width))
  assert.equal(typeof floor.generatorVersion, 'string')
  assert.equal(floor.schemaVersion, 2)
  const ids = [
    ...rooms,
    ...doors,
    ...stairs,
    ...(floor.shortcuts ?? []),
    ...(floor.roomGroups ?? []),
  ].map((f) => f.id)
  assert.equal(new Set(ids).size, ids.length, 'IDs must be unique')
  const owner = new Map()
  for (const room of rooms) {
    const footprint = cells(room)
    assert.equal(new Set(footprint.map(key)).size, footprint.length)
    for (const p of footprint) {
      assert(p.x > 0 && p.y > 0 && p.x < width - 1 && p.y < height - 1)
      assert(!owner.has(key(p)), 'Room overlap')
      owner.set(key(p), room.id)
      assert.equal(tiles[p.y][p.x], 'floor')
    }
    const footprintKeys = new Set(footprint.map(key)),
      seen = new Set([key(footprint[0])]),
      queue = [footprint[0]]
    for (let i = 0; i < queue.length; i++)
      for (const [dx, dy] of steps) {
        const p = { x: queue[i].x + dx, y: queue[i].y + dy }
        if (footprintKeys.has(key(p)) && !seen.has(key(p))) {
          seen.add(key(p))
          queue.push(p)
        }
      }
    assert.equal(seen.size, footprint.length, 'Disconnected room footprint')
  }
  assert.equal(stairs.length, 2)
  const up = stairs.find((s) => s.direction === 'up'),
    down = stairs.find((s) => s.direction === 'down')
  assert(up && down)
  assert.notDeepEqual(up.position, down.position)
  const reached = flood(floor, up.position),
    secretDoors = new Set(
      doors.filter((d) => d.type === 'secret').map((d) => d.position.y * width + d.position.x),
    ),
    ordinary = flood(floor, up.position, secretDoors)
  for (const stair of stairs) {
    assert.equal(tiles[stair.position.y][stair.position.x], 'floor')
    assert.equal(owner.get(key(stair.position)), stair.roomId)
    assert(
      ordinary[stair.position.y * width + stair.position.x] >= 0,
      'Stair requires a hidden door',
    )
  }
  const doorPositions = new Set(doors.map((d) => key(d.position)))
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const tile = tiles[y][x]
      assert(['wall', 'floor', 'door'].includes(tile))
      if (!x || !y || x === width - 1 || y === height - 1) assert.equal(tile, 'wall')
      if (open(tile)) assert(reached[y * width + x] >= 0, 'Disconnected walkable island')
      if (tile === 'door') assert(doorPositions.has(`${x},${y}`))
      if (owner.has(`${x},${y}`)) {
        assert(ordinary[y * width + x] >= 0, 'Required room requires secret passage')
        for (const [dx, dy] of steps) {
          const other = tiles[y + dy]?.[x + dx]
          if (open(other) && owner.get(`${x + dx},${y + dy}`) !== owner.get(`${x},${y}`))
            assert.equal(other, 'door', 'Room wall breached without door')
        }
      }
    }
  for (const door of doors) {
    const { x, y } = door.position
    assert.equal(tiles[y]?.[x], 'door')
    const axis = door.orientation === 'north-south' ? [0, 1] : [1, 0],
      [dx, dy] = axis
    assert.equal(tiles[y - dy]?.[x - dx], 'floor')
    assert.equal(tiles[y + dy]?.[x + dx], 'floor')
    assert.equal(tiles[y - dx]?.[x - dy], 'wall')
    assert.equal(tiles[y + dx]?.[x + dy], 'wall')
    assert(
      [owner.get(`${x - dx},${y - dy}`), owner.get(`${x + dx},${y + dy}`)].includes(door.roomId),
    )
  }
  const secretEndpoints = new Set()
  const secretInteriors = new Set(
    (floor.shortcuts ?? []).flatMap((route) =>
      route.path.slice(1, -1).map((p) => p.y * width + p.x),
    ),
  )
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const index = y * width + x
      if (open(tiles[y][x]) && !secretDoors.has(index) && !secretInteriors.has(index))
        assert(ordinary[index] >= 0, 'Ordinary passage requires hidden doors')
    }
  const representative = (room) => {
    const center = {
      x: room.x + Math.floor(room.width / 2),
      y: room.y + Math.floor(room.height / 2),
    }
    const footprint = cells(room)
    let best = footprint[0],
      distance = Infinity
    for (const p of footprint) {
      const current = Math.abs(p.x - center.x) + Math.abs(p.y - center.y)
      if (current < distance) {
        best = p
        distance = current
      }
    }
    return best
  }
  for (const route of floor.shortcuts ?? []) {
    assert.equal(route.isolated, true, 'New routes must declare isolation')
    const p = route.path
    assert(p.length >= 1 && p.length <= 14)
    assert.equal(new Set(p.map(key)).size, p.length)
    for (const end of [p[0], p.at(-1)]) {
      secretEndpoints.add(key(end))
      assert(doors.some((d) => d.type === 'secret' && key(d.position) === key(end)))
    }
    for (let i = 1; i < p.length; i++)
      assert.equal(Math.abs(p[i].x - p[i - 1].x) + Math.abs(p[i].y - p[i - 1].y), 1)
    for (let i = 1; i < p.length - 1; i++) {
      const a = p[i]
      assert.equal(tiles[a.y][a.x], 'floor')
      assert(!owner.has(key(a)))
      assert.equal(ordinary[a.y * width + a.x], -1, 'Public corridor exposes a secret interior')
      const neighbors = steps
        .map(([dx, dy]) => ({ x: a.x + dx, y: a.y + dy }))
        .filter((q) => open(tiles[q.y]?.[q.x]))
        .map(key)
        .sort()
      assert.deepEqual(neighbors, [key(p[i - 1]), key(p[i + 1])].sort(), 'Branched secret route')
    }
    const from = rooms.find((room) => room.id === route.fromRoomId),
      to = rooms.find((room) => room.id === route.toRoomId)
    assert(from && to && from !== to)
    const start = representative(from),
      target = representative(to),
      targetIndex = target.y * width + target.x
    const sealed = new Set(p.map((tile) => tile.y * width + tile.x))
    assert.equal(
      route.distanceBefore,
      flood(floor, start, sealed)[targetIndex],
      'Incorrect pre-shortcut distance',
    )
    assert.equal(
      route.distanceAfter,
      flood(floor, start)[targetIndex],
      'Incorrect post-shortcut distance',
    )
    assert(
      route.distanceBefore - route.distanceAfter === route.tilesSaved &&
        route.tilesSaved >= 12 &&
        route.tilesSaved / route.distanceBefore >= 0.35,
    )
  }
  for (const d of doors.filter((d) => d.type === 'secret'))
    assert(secretEndpoints.has(key(d.position)), 'Unrecorded secret door')
  for (const group of floor.roomGroups ?? []) {
    assert([4, 6].includes(group.roomIds.length))
    const corridor = new Set(group.corridorCells.map(key))
    for (const p of group.corridorCells) {
      assert.equal(tiles[p.y]?.[p.x], 'floor')
      assert(!owner.has(key(p)))
    }
    for (const id of group.roomIds) {
      const room = rooms.find((r) => r.id === id)
      assert(room && room.groupId === group.id)
      const entries = doors.filter((d) => d.roomId === id)
      assert.equal(entries.length, 1)
      assert.equal(entries[0].type, 'regular')
      assert(
        steps.some(([dx, dy]) =>
          corridor.has(`${entries[0].position.x + dx},${entries[0].position.y + dy}`),
        ),
      )
    }
  }
  assert.equal(reached[down.position.y * width + down.position.x], floor.diagnostics.stairDistance)
  assert(validateFloor(floor).valid, 'Production validation failed')
  return {
    rooms: rooms.length,
    groups: floor.roomGroups?.length ?? 0,
    secrets: floor.shortcuts?.length ?? 0,
    shapes: [...new Set(rooms.map((r) => r.shape))],
  }
}
export function verifyCase(config) {
  const started = performance.now(),
    result = generateDungeon(config),
    generationMs = performance.now() - started
  assert(result.ok, result.errors?.join('; '))
  const floor = result.floor
  const coverage = verifyFloor(floor)
  assert.deepEqual(
    generateDungeon(structuredClone(config)),
    result,
    'Identical seed/config changed output',
  )
  const restored = importFloorJson(exportFloorJson(floor))
  assert(restored.ok, restored.errors?.join('; '))
  assert.deepEqual(restored.floor, floor, 'JSON round trip changed floor')
  verifyFloor(restored.floor)
  return { generationMs, attempts: floor.diagnostics.generationAttempts, ...coverage }
}
