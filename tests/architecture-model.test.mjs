import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  WALL,
  ARCHITECTURE_LAYERS,
  wallShape,
  concealSecretArchitecture,
  createArchitecturePlan,
  architectureLightCells,
  wallCapRects,
  capCornerOptions,
  wallFrontSegments,
  wallEastSegments,
} from '../apps/dungeon-atelier/src/features/dungeon/rendering/architecture-model.ts'
import { architectureBenchmark } from '../scripts/scenes/architecture-benchmark.mjs'
import { verifyFloor } from './helpers/verify-floor.mjs'
const fixture = architectureBenchmark()

test('east faces follow exposed contours and omit joined east boundaries', () => {
  assert.deepEqual(wallEastSegments(5, 0, 32), [{ x: 26, y: 0, height: 32 }])
  assert.deepEqual(wallEastSegments(10, 0, 32), [])
  assert.deepEqual(wallEastSegments(1, 0, 32), [{ x: 26, y: 0, height: 26 }])
})

test('narrow cap branches meet adjacent tiles without overlapping or leaving a gap', () => {
  for (let mask = 0; mask < 16; mask++) {
    const rects = wallCapRects(mask, 0, 32)
    const contains = (x, y) =>
      rects.some((r) => x >= r.x && x < r.x + r.width && y >= r.y && y < r.y + r.height)
    for (const [bit, x, y] of [
      [1, 16, 0.1],
      [2, 31.9, 16],
      [4, 16, 31.9],
      [8, 0.1, 16],
    ])
      assert.equal(contains(x, y), Boolean(mask & bit))
    assert(contains(16, 16))
    assert(rects.every((r) => r.x >= 0 && r.y >= 0 && r.x + r.width <= 32 && r.y + r.height <= 32))
  }
})
test('solid diagonal corners fill only compatible cap junctions', () => {
  assert.equal(capCornerOptions(5), 0)
  assert.equal(capCornerOptions(6), 2)
  assert.equal(capCornerOptions(15), 15)
  const rects = wallCapRects(6, 2, 32)
  assert(rects.some((r) => r.x <= 31 && r.y <= 31 && r.x + r.width > 31 && r.y + r.height > 31))
})
test('portal jambs extend the correct connected cap arms', () => {
  const plan = createArchitecturePlan(fixture, { revealSecrets: true })
  const door = fixture.doors.find((d) => d.orientation === 'north-south' && d.type === 'regular')
  const west = plan.walls.find((w) => w.x === door.position.x - 1 && w.y === door.position.y)
  const east = plan.walls.find((w) => w.x === door.position.x + 1 && w.y === door.position.y)
  assert(west.mask & WALL.east)
  assert(east.mask & WALL.west)
})

test('architecture benchmark is a valid floor with sealed-secret public access', () =>
  verifyFloor(fixture))
for (const [mask, shape] of [
  [0, 'pillar'],
  [1, 'end'],
  [2, 'end'],
  [4, 'end'],
  [8, 'end'],
  [5, 'vertical'],
  [10, 'horizontal'],
  [3, 'outer-corner'],
  [6, 'outer-corner'],
  [12, 'outer-corner'],
  [9, 'outer-corner'],
  [7, 'tee'],
  [11, 'tee'],
  [13, 'tee'],
  [14, 'tee'],
  [15, 'cross'],
])
  test(`wall mask ${mask} selects ${shape}`, () => assert.equal(wallShape(mask), shape))
test('inside corners use the matching open diagonal', () => {
  for (const [mask, diagonal] of [
    [3, 1],
    [6, 2],
    [12, 4],
    [9, 8],
  ])
    assert.equal(wallShape(mask, diagonal), 'inner-corner')
  assert.equal(wallShape(6, 1), 'outer-corner')
})
test('render layers keep shadows before architecture, lighting after architecture, grid last', () => {
  const order = (name) => ARCHITECTURE_LAYERS.indexOf(name)
  assert(order('floor') < order('markings'))
  assert(order('shadows') < order('architecture'))
  assert(order('architecture') < order('light'))
  assert(order('light') < order('emissive'))
  assert.equal(ARCHITECTURE_LAYERS.at(-1), 'grid')
})
test('wall plans never wrap map edges or include out-of-bounds coordinates', () => {
  const edge = structuredClone(fixture)
  edge.tiles = Array.from({ length: edge.height }, () => Array(edge.width).fill('wall'))
  edge.tiles[0][0] = 'floor'
  edge.tiles.at(-1)[edge.width - 1] = 'floor'
  const plan = createArchitecturePlan(edge, { revealSecrets: true })
  for (const p of plan.walls) assert(p.x >= 0 && p.y >= 0 && p.x < edge.width && p.y < edge.height)
  assert(!plan.wallKeys.has(edge.width - 1))
  assert(!plan.wallKeys.has((edge.height - 1) * edge.width))
})
test('secret concealment removes all path presentation and leaves source data unchanged', () => {
  const before = structuredClone(fixture),
    hidden = concealSecretArchitecture(fixture)
  assert.deepEqual(fixture, before)
  assert(hidden.doors.every((d) => d.type !== 'secret'))
  for (const p of fixture.shortcuts[0].path) assert.equal(hidden.tiles[p.y][p.x], 'wall')
  assert.deepEqual(hidden.rooms, fixture.rooms)
  assert.deepEqual(hidden.stairs, fixture.stairs)
  assert.deepEqual(hidden.config, fixture.config)
})
test('concealed door caps connect exactly like ordinary masonry', () => {
  const plan = createArchitecturePlan(fixture),
    point = fixture.doors.find((d) => d.type === 'secret').position
  const cell = plan.walls.find((w) => w.x === point.x && w.y === point.y)
  assert(cell)
  assert.equal(cell.mask & (WALL.east | WALL.west), WALL.east | WALL.west)
  assert.equal(plan.doors.filter((d) => d.type === 'secret').length, 0)
  assert.equal(
    createArchitecturePlan(fixture, { revealSecrets: true }).doors.filter(
      (d) => d.type === 'secret',
    ).length,
    2,
  )
})
test('only exposed south contours extrude; horizontal spans merge and vertical joins stay open', () => {
  assert.deepEqual(wallFrontSegments(10, 0, 32), [{ x: 0, y: 26, width: 32 }])
  assert.deepEqual(wallFrontSegments(5, 0, 32), [])
  assert.deepEqual(wallFrontSegments(1, 0, 32), [{ x: 6, y: 26, width: 20 }])
  assert.deepEqual(wallFrontSegments(6, 0, 32), [{ x: 26, y: 26, width: 6 }])
})
test('presentation planning and torch placement are deterministic', () => {
  const before = JSON.stringify(fixture),
    a = createArchitecturePlan(fixture),
    b = createArchitecturePlan(fixture)
  assert.deepEqual(a, b)
  assert(a.torches.length >= 2)
  assert.equal(new Set(a.torches.map((p) => `${p.x},${p.y}`)).size, a.torches.length)
  assert.equal(JSON.stringify(fixture), before)
})
test('static lighting cannot cross masonry or a closed doorway', () => {
  const plan = createArchitecturePlan(fixture, { revealSecrets: true })
  const closed = architectureLightCells(plan, { x: 9, y: 5 }, new Set(), 30)
  assert(!closed.floors.some((p) => p.x === 11 && p.y === 6))
  const opened = architectureLightCells(plan, { x: 9, y: 5 }, new Set(['door-a']), 30)
  assert(opened.floors.some((p) => p.x === 11 && p.y === 6))
  for (const p of closed.floors) assert.notEqual(plan.floor.tiles[p.y][p.x], 'wall')
})
