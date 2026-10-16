import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  stairTreads,
  mountedLightCells,
  stairArrowOutline,
  stairMarkerPlacement,
} from '../apps/dungeon-atelier/src/features/dungeon/rendering/visual-foundation/finishing-model.ts'

test('up/down stair geometry uses the same logical cell with a floor-level entry and opposite elevations', () => {
  for (const direction of ['up', 'down']) {
    const stair = { id: direction, position: { x: 4, y: 5 }, direction, roomId: 'test' },
      before = JSON.stringify(stair),
      treads = stairTreads(stair)
    assert.equal(treads.length, 6)
    assert.equal(treads.at(-1).z, 0)
    assert.equal(treads.at(-1).nextZ, 0)
    for (const tread of treads)
      for (const p of tread.points) {
        assert(p.x >= 4 * 32 && p.x < 5 * 32 && p.y >= 5 * 32 && p.y < 6 * 32)
        assert(direction === 'up' ? p.z >= 0 : p.z <= 0)
      }
    assert.equal(JSON.stringify(stair), before)
  }
})
test('ascending presentation increases rise without changing the well, tread footprint or floor entry', () => {
  for (const direction of ['up', 'down']) {
    const stair = { position: { x: 4, y: 5 }, direction },
      before = JSON.stringify(stair),
      old = stairTreads(stair),
      raised = stairTreads(stair, 'ascending')
    if (direction === 'down') assert.deepEqual(raised, old)
    else assert(raised[0].z > old[0].z)
    for (let i = 0; i < raised.length; i++) {
      assert.deepEqual(
        raised[i].points.map(({ x, y }) => [x, y]),
        old[i].points.map(({ x, y }) => [x, y]),
      )
      assert.equal(raised[i].nextZ, raised[i + 1]?.z ?? 0)
    }
    assert.equal(raised.at(-1).z, 0)
    assert.equal(JSON.stringify(stair), before)
  }
})
test('opposing level symbols stay separate from stairs and select clear adjacent floor', () => {
  const up = stairArrowOutline('up'),
    down = stairArrowOutline('down')
  assert(up[0].y < up.at(-1).y)
  assert(down[0].y > down.at(-1).y)
  for (let i = 0; i < up.length; i++) {
    assert.deepEqual(down[i], { x: up[i].x, y: 32 - up[i].y })
    assert(up[i].x > 5 && up[i].x < 27 && up[i].y > 4 && up[i].y < 28)
  }
  const stair = { position: { x: 3, y: 3 }, direction: 'up' },
    floor = { tiles: Array.from({ length: 7 }, () => Array(7).fill('wall')), stairs: [stair] }
  for (const [x, y] of [
    [3, 3],
    [4, 3],
    [2, 3],
    [3, 4],
  ])
    floor.tiles[y][x] = 'floor'
  const before = JSON.stringify(floor),
    right = stairMarkerPlacement(floor, stair)
  assert(right.x > 4 * 32)
  assert.equal(JSON.stringify(floor), before)
  floor.stairs.push({ position: { x: 4, y: 3 }, direction: 'down' })
  const left = stairMarkerPlacement(floor, stair)
  assert(left.x + left.width < 3 * 32)
  floor.tiles[3][2] = 'door'
  const below = stairMarkerPlacement(floor, stair)
  assert(below.y > 4 * 32)
  floor.tiles[4][3] = 'wall'
  floor.tiles[2][3] = 'floor'
  assert.equal(stairMarkerPlacement(floor, stair), undefined) // Raised flight occludes north neighbor.
})
test('mounted light uses the visible mounting side and stops at masonry and closed doors', () => {
  const floor = {
    width: 7,
    height: 7,
    tiles: Array.from({ length: 7 }, () => Array(7).fill('wall')),
    doors: [{ id: 'closed', position: { x: 3, y: 3 } }],
  }
  for (let x = 1; x <= 5; x++) floor.tiles[3][x] = 'floor'
  floor.tiles[3][3] = 'door'
  const torch = { x: 0, y: 3 },
    before = JSON.stringify(floor)
  const closed = mountedLightCells(floor, torch, 'east', new Set()),
    open = mountedLightCells(floor, torch, 'east', new Set(['closed']))
  assert(closed.floors.some((p) => p.x === 1 && p.y === 3))
  assert(!closed.floors.some((p) => p.x >= 3))
  assert(open.floors.some((p) => p.x === 5))
  assert.equal(mountedLightCells(floor, torch, 'south', new Set()).floors.length, 0)
  assert.equal(JSON.stringify(floor), before)
})
