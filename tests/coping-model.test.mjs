import { test } from 'node:test'
import assert from 'node:assert/strict'
import { copingBlocks } from '../apps/dungeon-atelier/src/features/dungeon/rendering/visual-foundation/coping-model.ts'
const nodes = Array.from({ length: 10 }, (_, i) => ({ x: i + 2, y: 3, mask: 10, corner: 0 }))
const sort = (blocks) => blocks.toSorted((a, b) => a.y - b.y || a.x - b.x)
test('coping runs are independent of placement iteration order and keep block phase across tile boundaries', () => {
  for (const study of ['hewn', 'broken']) {
    const blocks = copingBlocks(nodes, study)
    assert.deepEqual(sort(blocks), sort(copingBlocks([...nodes].reverse(), study)))
    assert(blocks.some((b) => Math.floor(b.x / 32) !== Math.floor((b.x + b.width) / 32)))
    assert.equal(blocks[0].x, 64 + (study === 'hewn' ? 0.325 : 0.55))
    for (const b of blocks) {
      assert(b.width >= 14)
      assert(b.y > 96 && b.y + b.height < 128)
      assert(b.image >= 0 && b.image < 12)
    }
    const end = blocks.at(-1)
    assert(Math.abs(end.x + end.width - (12 * 32 - (study === 'hewn' ? 0.325 : 0.55))) < 1e-8)
  }
})
test('junction and door bonding stones terminate runs instead of stretching through openings', () => {
  for (const junction of [
    { mask: 15, corner: 0 },
    { mask: 6, corner: 0 },
    { mask: 10, corner: 0, door: true },
  ]) {
    const source = nodes.map((n) => (n.x === 6 ? { ...n, ...junction } : n)),
      snapshot = JSON.stringify(source)
    for (const study of ['hewn', 'broken']) {
      const blocks = copingBlocks(source, study),
        hub = blocks.find((b) => b.x === 6 * 32 && b.junction)
      assert(hub)
      assert.equal(hub.width, 32)
      assert(
        blocks.filter((b) => !b.junction).every((b) => b.x + b.width <= 6 * 32 || b.x >= 7 * 32),
      )
    }
    assert.equal(JSON.stringify(source), snapshot)
  }
})
test('broken treatment uses visibly fewer, larger stones than hewn on an identical long run', () => {
  const hewn = copingBlocks(nodes, 'hewn'),
    broken = copingBlocks(nodes, 'broken')
  assert(broken.length < hewn.length)
  assert(broken.every((b) => b.height > Math.max(...hewn.map((b) => b.height))))
})
