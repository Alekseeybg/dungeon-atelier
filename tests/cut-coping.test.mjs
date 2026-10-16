import { test } from 'node:test'
import assert from 'node:assert/strict'
import { copingBlocks } from '../apps/dungeon-atelier/src/features/dungeon/rendering/visual-foundation/coping-model.ts'
import {
  cutCopingBlocks,
  CUT_JOINT,
} from '../apps/dungeon-atelier/src/features/dungeon/rendering/visual-foundation/cut-coping-model.ts'

test('squared coping keeps the established bonding pattern and creates consistent joints across logical cells', () => {
  for (const horizontal of [true, false]) {
    const nodes = Array.from({ length: 8 }, (_, i) => ({
      x: horizontal ? i + 2 : 3,
      y: horizontal ? 3 : i + 2,
      mask: horizontal ? 10 : 5,
      corner: 0,
    }))
    const source = copingBlocks(nodes, 'hewn'),
      before = JSON.stringify(source),
      cut = cutCopingBlocks(nodes, source)
    assert.equal(cut.length, source.length)
    for (let i = 0; i < cut.length; i++) {
      const a = cut[i],
        b = source[i]
      assert.equal(a.image, b.image)
      assert.equal(horizontal ? a.height : a.width, 20)
      assert.equal(horizontal ? a.y : a.x, 3 * 32 + 6)
      assert(
        Math.abs(
          (horizontal ? a.x + a.width / 2 : a.y + a.height / 2) -
            (horizontal ? b.x + b.width / 2 : b.y + b.height / 2),
        ) < 1e-8,
      )
      if (i) {
        const previous = cut[i - 1]
        const gap = horizontal
          ? a.x - previous.x - previous.width
          : a.y - previous.y - previous.height
        assert(Math.abs(gap - CUT_JOINT) < 1e-8)
      }
    }
    assert.equal(JSON.stringify(source), before)
  }
})

test('corner, intersection and doorway bonding blocks stay within their own cell', () => {
  for (const node of [
    { x: 4, y: 5, mask: 6, corner: 0 },
    { x: 4, y: 5, mask: 15, corner: 0 },
    { x: 4, y: 5, mask: 10, corner: 0, door: true },
  ]) {
    const [stone] = cutCopingBlocks([node], copingBlocks([node], 'hewn'))
    assert(stone.junction)
    assert(stone.x > 4 * 32 && stone.y > 5 * 32)
    assert(stone.x + stone.width < 5 * 32 && stone.y + stone.height < 6 * 32)
  }
})
