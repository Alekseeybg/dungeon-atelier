import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { verifyCase } from './helpers/verify-floor.mjs'
import { DEFAULT_CONFIG } from '../packages/dungeon-core/dist/index.js'
const cases = JSON.parse(
  fs.readFileSync(new URL('fixtures/regressions.json', import.meta.url), 'utf8'),
)
for (const item of cases) test(`${item.id}: ${item.originalFailure}`, () => verifyCase(item.config))
test('reported secret-passage seed preserves ordinary access', () =>
  verifyCase({
    ...DEFAULT_CONFIG,
    width: 64,
    height: 64,
    seed: 'atelier-1l9r6un-16gc8ja',
    shortcutChance: 1,
    chamberBlockChance: 0,
  }))
test('recorded retries are deterministic and bounded', () => {
  const c = cases.find((c) => c.originalFailure.startsWith('Only')).config
  const r = verifyCase(c)
  assert(r.rooms >= 2)
  assert(r.attempts > 1 && r.attempts <= 8)
})
