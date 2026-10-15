import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_CONFIG,
  generateDungeon,
  validateFloor,
} from '../packages/dungeon-core/dist/index.js'
import { verifyCase } from './helpers/verify-floor.mjs'
test('ordinary doorway cannot silently become a mandatory hidden route', () => {
  const r = generateDungeon({
    ...DEFAULT_CONFIG,
    width: 32,
    height: 32,
    targetRoomCount: 2,
    chamberBlockChance: 0,
    shortcutChance: 0,
    extraConnectionChance: 0,
  })
  assert(r.ok)
  const floor = structuredClone(r.floor)
  floor.doors[0].type = 'secret'
  const check = validateFloor(floor)
  assert.equal(check.valid, false)
  assert(check.errors.some((e) => e.includes('every secret door closed')))
  assert(check.errors.some((e) => e.includes('recorded shortcut')))
})
for (const seed of ['地下牢–α–🔥', 's'.repeat(128)])
  test('Unicode/long seed: ' + seed.slice(0, 18), () =>
    verifyCase({ ...DEFAULT_CONFIG, seed, width: 32, height: 32, floorNumber: 999 }),
  )
