import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  FOUNDATION,
  createFoundationScene,
  project,
  unprojectGround,
  doorSurface,
  viewBounds,
} from '../apps/dungeon-atelier/src/features/dungeon/rendering/visual-foundation/model.ts'
import { wallCapRects } from '../apps/dungeon-atelier/src/features/dungeon/rendering/architecture-model.ts'

test('foundation fixture is deterministic, isolated, and has four correctly connected room entrances', () => {
  const a = createFoundationScene(),
    b = createFoundationScene()
  assert.deepEqual(a, b)
  assert.equal(a.floor.rooms.length, 1)
  assert.equal(a.floor.rooms[0].width, 9)
  assert.equal(a.floor.rooms[0].height, 9)
  assert.equal(a.floor.doors.length, 4)
  assert.equal(a.torches.length, 2)
  for (const door of a.floor.doors) {
    const { x, y } = door.position,
      ns = door.orientation === 'north-south'
    for (const offset of [-1, 1]) {
      assert.equal(a.floor.tiles[y + (ns ? offset : 0)][x + (ns ? 0 : offset)], 'floor')
      assert.equal(a.floor.tiles[y + (ns ? 0 : offset)][x + (ns ? offset : 0)], 'wall')
    }
  }
  a.floor.tiles[7][7] = 'wall'
  assert.equal(b.floor.tiles[7][7], 'floor')
})
test('one affine height convention applies to every architectural point without rotating grid axes', () => {
  for (const [x, y] of [
    [0, 0],
    [352, 192],
    [17.5, 311.5],
  ]) {
    const ground = project(x, y),
      top = project(x, y, 1)
    assert.deepEqual(unprojectGround(ground.x, ground.y), { x, y })
    assert.equal(top.x, ground.x - 6)
    assert.equal(top.y, ground.y - 24)
    assert.equal(project(x + 32, y).y, ground.y)
    assert.equal(project(x, y + 32).x, ground.x)
    assert.equal(project(x, y + 32).y - ground.y, 26)
  }
})
test('door frames occupy the visible wall surfaces instead of the wall centerline', () => {
  const scene = createFoundationScene(),
    before = JSON.stringify(scene)
  for (const door of scene.floor.doors) {
    const surface = doorSurface(door.position, scene.facings[door.id])
    assert.equal(surface.bottomLeft.x - surface.topLeft.x, 6)
    assert.equal(surface.bottomLeft.y - surface.topLeft.y, 24)
    if (surface.horizontal) {
      assert.equal(surface.a.y, door.position.y * 32 + 26)
      assert.equal(surface.b.x - surface.a.x, 44)
    } else {
      assert.equal(surface.a.x, door.position.x * 32 + 26)
      assert.equal(surface.b.y - surface.a.y, 44)
    }
  }
  assert.equal(JSON.stringify(scene), before)
})
test('joined cap arms remain coincident under projection at horizontal and vertical tile boundaries', () => {
  for (const [mask, neighbor, dx, dy] of [
    [10, 10, 32, 0],
    [5, 5, 0, 32],
    [6, 12, 32, 0],
    [3, 9, 32, 0],
  ]) {
    const first = wallCapRects(mask, 0, 32),
      second = wallCapRects(neighbor, 0, 32)
    const point = dx ? { x: 32, y: 16 } : { x: 16, y: 32 }
    assert(
      first.some(
        (r) =>
          point.x >= r.x && point.x <= r.x + r.width && point.y >= r.y && point.y <= r.y + r.height,
      ),
    )
    assert(
      second.some(
        (r) =>
          point.x - dx >= r.x &&
          point.x - dx <= r.x + r.width &&
          point.y - dy >= r.y &&
          point.y - dy <= r.y + r.height,
      ),
    )
    assert.deepEqual(project(point.x, point.y, 1), project(dx + point.x - dx, dy + point.y - dy, 1))
  }
})
test('sprite bounds include the height overhang while preserving one-cell logical placement', () => {
  assert.deepEqual(FOUNDATION, {
    tile: 32,
    depth: 26 / 32,
    rise: 24,
    side: 6,
    density: 2,
    padding: 32,
  })
  const floor = createFoundationScene().floor,
    bounds = viewBounds(floor)
  assert.equal(bounds.width, 800)
  assert.equal(bounds.height, 662)
  for (const p of [project(0, 0, 1), project(32, 32)]) {
    assert(p.x >= -6 && p.x <= 32)
    assert(p.y >= -24 && p.y <= 26)
  }
})
