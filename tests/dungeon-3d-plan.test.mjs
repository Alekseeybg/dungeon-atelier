import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Matrix4, Vector3 } from 'three'
import {
  generatePrototypeFloor,
  planDungeon3D,
  appearanceHash,
} from '../apps/dungeon-atelier/src/experiments/dungeon-3d/plan.ts'
import { concealSecretArchitecture } from '../apps/dungeon-atelier/src/features/dungeon/rendering/architecture-model.ts'
import { fourDoorRoom } from '../scripts/scenes/four-door-room.mjs'

test('3D adapter preserves generator determinism, original data, and coherent material regions', () => {
  const floor = generatePrototypeFloor('side-door-readability-0'),
    before = JSON.stringify(floor),
    first = planDungeon3D(floor),
    second = planDungeon3D(generatePrototypeFloor(floor.seed))
  assert.deepEqual(first, second)
  assert.equal(JSON.stringify(floor), before)
  assert.equal(first.tiles.length, first.floor.tiles.flat().filter((t) => t !== 'wall').length)
  assert(new Set(first.tiles.map((t) => t.material)).has('study-broad'))
  assert(new Set(first.tiles.map((t) => t.material)).has('study-weathered'))
  assert(new Set(first.tiles.map((t) => t.material)).has('study-irregular'))
  for (const room of first.floor.rooms) {
    const cells = first.tiles.filter(
      (t) =>
        t.x >= room.x &&
        t.x < room.x + room.width &&
        t.z >= room.y &&
        t.z < room.y + room.height &&
        (!room.floorCells ||
          room.floorCells.some((c) => c.x === t.x - room.x && c.y === t.z - room.y)),
    )
    assert.equal(new Set(cells.map((t) => t.material)).size, 1)
  }
  for (const wall of first.walls)
    for (const r of wall.rects) {
      assert(r.width > 0 && r.depth > 0)
      assert(r.x >= wall.x && r.x + r.width <= wall.x + 1)
      assert(r.z >= wall.y && r.z + r.depth <= wall.y + 1)
    }
})
test('one door module rotates correctly into all four logical travel directions', () => {
  const plan = planDungeon3D(fourDoorRoom())
  assert.equal(plan.doors.length, 4)
  for (const door of plan.doors) {
    assert.equal(door.facing, door.id)
    assert.equal(door.x, door.position.x + 0.5)
    assert.equal(door.z, door.position.y + 0.5)
    const axis = new Vector3(0, 0, 1).applyMatrix4(new Matrix4().makeRotationY(door.rotation))
    if (door.orientation === 'north-south') {
      assert(Math.abs(axis.x) < 1e-10)
      assert(Math.abs(axis.z) > 0.99)
    } else {
      assert(Math.abs(axis.z) < 1e-10)
      assert(Math.abs(axis.x) > 0.99)
    }
  }
})
test('hidden 3D secret geometry and torch placement equal an independently sealed floor', () => {
  const floor = fourDoorRoom(true),
    before = JSON.stringify(floor),
    hidden = planDungeon3D(floor),
    sealed = planDungeon3D(concealSecretArchitecture(floor)),
    revealed = planDungeon3D(floor, true)
  assert.deepEqual(hidden, sealed)
  assert.equal(hidden.doors.length, 3)
  assert.equal(revealed.doors.length, 4)
  assert.equal(JSON.stringify(floor), before)
  assert.equal(appearanceHash('same', 2, 3), appearanceHash('same', 2, 3))
  assert.notEqual(appearanceHash('same', 2, 3), appearanceHash('same', 2, 4))
})
