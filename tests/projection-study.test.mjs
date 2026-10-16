import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fourDoorRoom } from '../scripts/scenes/four-door-room.mjs'
import {
  doorFacing,
  dimensionalProjection,
  projectStudyPoint,
  unprojectStudyGround,
  dimensionalSpriteDefinitions,
  spriteDestination,
} from '../apps/dungeon-atelier/src/features/dungeon/rendering/projection-study/dimensional-model.ts'

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
test('study projection preserves grid axes, ground picking, and a single height vector', () => {
  for (const tileSize of [16, 32, 48]) {
    const p = dimensionalProjection(tileSize)
    assert.equal(p.floorDepth, 0.75)
    const point = { x: 5.5, y: 8.5 },
      ground = projectStudyPoint(point, 0, tileSize),
      cap = projectStudyPoint(point, 1, tileSize)
    assert.deepEqual(unprojectStudyGround(ground, tileSize), point)
    assert.equal(cap.x - ground.x, -p.side)
    assert.equal(cap.y - ground.y, -tileSize * 0.75)
    assert.equal(projectStudyPoint({ x: 6.5, y: 8.5 }, 0, tileSize).y, ground.y)
    assert.equal(projectStudyPoint({ x: 5.5, y: 9.5 }, 0, tileSize).x, ground.x)
  }
})
test('all directional states have architectural anchors and the same logical footprint', () => {
  const sprites = dimensionalSpriteDefinitions(32)
  for (const facing of ['north', 'south', 'east', 'west'])
    for (const state of ['closed', 'open', 'secret']) {
      const sprite = sprites.find((s) => s.id === `door.${facing}.${state}`)
      assert(sprite)
      assert.equal(sprite.layer, 'architecture')
      assert.deepEqual(sprite.footprint, { width: 1, height: 1 })
      const destination = spriteDestination(sprite, 320, 320)
      assert.equal(destination.x + sprite.anchor.x, 320)
      assert.equal(destination.y + sprite.anchor.y, 320)
      assert.equal(destination.height, 64)
    }
})
