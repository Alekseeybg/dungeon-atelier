import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fourDoorRoom } from '../scripts/scenes/four-door-room.mjs'
import { doorFacing } from '../apps/dungeon-atelier/src/features/dungeon/rendering/architecture-model.ts'

test('four-door study derives cardinal facing from owner footprint and explicit travel axis', () => {
  const floor = fourDoorRoom(),
    before = JSON.stringify(floor)
  for (const door of floor.doors) assert.equal(doorFacing(floor, door), door.id)
  assert.equal(JSON.stringify(floor), before)
})
test('irregular-room facing uses the actual footprint, not its rectangular bounding box or corridor branches', () => {
  const floor = fourDoorRoom()
  floor.rooms[0].floorCells = Array.from({ length: 49 }, (_, i) => ({
    x: i % 7,
    y: Math.floor(i / 7),
  })).filter((p) => p.x !== 3 || p.y >= 4)
  const door = { ...floor.doors[0], position: { x: 10, y: 10 } }
  assert.equal(doorFacing(floor, door), 'north')
})
