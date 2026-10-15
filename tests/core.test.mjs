import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {
  DEFAULT_CONFIG,
  ROOM_DESIGNS,
  generateDungeon,
  validateConfig,
  validateFloor,
  exportFloorJson,
  importFloorJson,
  MAX_IMPORT_CHARACTERS,
} from '../packages/dungeon-core/dist/index.js'
import { verifyCase, verifyFloor, cells, steps, open } from './helpers/verify-floor.mjs'
const config = {
  ...DEFAULT_CONFIG,
  width: 48,
  height: 48,
  targetRoomCount: 12,
  seed: 'unit-fixture',
  chamberBlockChance: 1,
  shortcutChance: 1,
}
const make = (extra = {}) => {
  const r = generateDungeon({ ...config, ...extra })
  assert(r.ok, r.errors?.join(';'))
  return r.floor
}
const rejects = (floor) => {
  const r = validateFloor(floor)
  assert.equal(r.valid, false)
  assert(r.errors.length)
  assert.equal(importFloorJson(JSON.stringify(floor)).ok, false)
}
test('generation does not mutate caller config or arrays', () => {
  const c = structuredClone(config),
    before = structuredClone(c)
  verifyCase(c)
  assert.deepEqual(c, before)
})
for (const design of ROOM_DESIGNS)
  test(`connected ${design.value} footprints integrate`, () => {
    const f = make({
      width: 64,
      height: 64,
      minRoomSize: 7,
      maxRoomSize: 7,
      targetRoomCount: 8,
      chamberBlockChance: 0,
      roomShapeChance: 1,
      roomDesigns: [design.value],
      seed: 'unit-' + design.value,
    })
    assert(f.rooms.every((r) => r.shape === design.value))
    verifyFloor(f)
  })
test('unsupported shapes fall back without disconnected fragments', () => {
  const f = make({
    width: 24,
    height: 24,
    minRoomSize: 3,
    maxRoomSize: 3,
    chamberBlockChance: 0,
    roomShapeChance: 1,
    roomDesigns: ['alcoved'],
  })
  assert(f.rooms.every((r) => r.shape === 'rectangle'))
  verifyFloor(f)
})
test('chamber members have ordinary doors and separate corridor ownership', () => {
  const f = make()
  assert.equal(f.roomGroups.length, 1)
  verifyFloor(f)
})
test('chamber template cannot fit: reports fallback and preserves valid floor', () => {
  const f = make({
    width: 16,
    height: 16,
    minRoomSize: 3,
    maxRoomSize: 3,
    targetRoomCount: 2,
    chamberBlockChance: 1,
  })
  assert.equal(f.roomGroups.length, 0)
  assert(f.diagnostics.warnings.some((w) => w.includes('block')))
  verifyFloor(f)
})
for (const changes of [
  { width: 15 },
  { width: 97 },
  { height: NaN },
  { targetRoomCount: 81 },
  { minRoomSize: 9, maxRoomSize: 7 },
  { roomDesigns: ['bogus'] },
  { roomDesigns: ['l-shaped', 'l-shaped'] },
  { shortcutChance: NaN },
  { chamberBlockChance: 2 },
])
  test(`invalid config ${JSON.stringify(changes)}`, () => {
    assert.equal(generateDungeon({ ...config, ...changes }).ok, false)
  })
test('null configuration is a reported error', () =>
  assert.equal(validateConfig(null).valid, false))
test('infeasible placement exhausts a documented bounded retry budget', () => {
  const r = generateDungeon({
    ...config,
    width: 24,
    height: 24,
    minRoomSize: 16,
    maxRoomSize: 16,
    chamberBlockChance: 0,
  })
  assert.equal(r.ok, false)
  assert.match(r.errors[0], /8 deterministic/)
  assert.equal(r.errors.length, 9)
})
for (const [name, mutate] of [
  ['unknown schema', (f) => (f.schemaVersion = 99)],
  ['duplicate ID', (f) => (f.doors[0].id = f.rooms[0].id)],
  ['ragged grid', (f) => f.tiles[0].pop()],
  ['outer boundary breach', (f) => (f.tiles[0][1] = 'floor')],
  ['out-of-bounds door', (f) => (f.doors[0].position = { x: 95, y: 95 })],
  ['stairs overlap', (f) => (f.stairs[1].position = { ...f.stairs[0].position })],
  ['group corridor outside bounds', (f) => (f.roomGroups[0].corridorCells[0] = { x: 95, y: 95 })],
  ['missing group', (f) => (f.roomGroups = [])],
  ['invalid footprint', (f) => (f.rooms[0].floorCells = [{ x: 95, y: 95 }])],
  ['forged diagnostics', (f) => f.diagnostics.walkableTileCount++],
  [
    'mismatched retry diagnostics',
    (f) => {
      f.diagnostics.generationAttempts = 2
      f.diagnostics.retryReasons = []
    },
  ],
  [
    'secret replaces ordinary entrance',
    (f) => {
      f.doors.find((d) => d.roomId === f.roomGroups[0].roomIds[0]).type = 'secret'
    },
  ],
])
  test(`import rejects ${name} without throwing`, () => {
    const f = make()
    mutate(f)
    rejects(f)
  })
test('secret route interior cannot be breached by a side branch', () => {
  let f
  for (let i = 0; i < 40; i++) {
    const candidate = make({ seed: 'secret-mutation-' + i, chamberBlockChance: 0 })
    if (candidate.shortcuts[0]?.path.length > 2) {
      f = candidate
      break
    }
  }
  assert(f)
  const p = f.shortcuts[0].path[1],
    q = steps
      .map(([dx, dy]) => ({ x: p.x + dx, y: p.y + dy }))
      .find(
        (q) =>
          f.tiles[q.y]?.[q.x] === 'wall' &&
          q.x > 0 &&
          q.y > 0 &&
          q.x < f.width - 1 &&
          q.y < f.height - 1,
      )
  assert(q)
  f.tiles[q.y][q.x] = 'floor'
  rejects(f)
})
test('malformed and oversized JSON are rejected before use', () => {
  for (const text of ['{', 'null', '[]', ' '.repeat(MAX_IMPORT_CHARACTERS + 1)])
    assert.equal(importFloorJson(text).ok, false)
})
test('export refuses invalid geometry', () => {
  const f = make()
  f.tiles[0][0] = 'floor'
  assert.throws(() => exportFloorJson(f))
})
test('legacy v1 and v2 fixtures import without mutation', () => {
  for (const name of ['legacy-v1.json', 'legacy-v2.json']) {
    const original = JSON.parse(
      fs.readFileSync(new URL('fixtures/' + name, import.meta.url), 'utf8'),
    )
    const r = importFloorJson(JSON.stringify(original))
    assert(r.ok, r.errors?.join(';'))
    assert.deepEqual(r.floor, original)
  }
})
