import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  planeValue,
  capBoundarySegments,
} from '../apps/dungeon-atelier/src/features/dungeon/rendering/visual-foundation/plane-separation.ts'
import {
  wallCapRects,
  capCornerOptions,
} from '../apps/dungeon-atelier/src/features/dungeon/rendering/architecture-model.ts'

test('surface response preserves value ordering and separates stone planes for any input value', () => {
  for (let v = 0; v <= 255; v++) {
    const cap = planeValue(v, 'cap'),
      face = planeValue(v, 'face')
    assert(cap > face)
    assert(cap >= 0 && cap <= 255 && face >= 0 && face <= 255)
    if (v > 0) {
      assert(cap > planeValue(v - 1, 'cap'))
      assert(face > planeValue(v - 1, 'face'))
    }
    if (v >= 32) assert(cap - face > 40)
  }
})
test('coping edges trace exposed stone only across every connection and corner-fill variant', () => {
  for (let mask = 0; mask < 16; mask++)
    for (let corner = 0; corner < 16; corner++) {
      if (corner & ~capCornerOptions(mask)) continue
      const rects = wallCapRects(mask, corner, 32)
      const occupied = (x, y) =>
        rects.some((r) => x >= r.x && x < r.x + r.width && y >= r.y && y < r.y + r.height)
      for (const e of capBoundarySegments(rects)) {
        const x = (e.ax + e.bx) / 2,
          y = (e.ay + e.by) / 2,
          vertical = e.ax === e.bx
        assert(x > 0 && x < 32 && y > 0 && y < 32, 'Never outline a connected tile boundary')
        assert.notEqual(
          occupied(x + (vertical ? 0.1 : 0), y + (vertical ? 0 : 0.1)),
          occupied(x - (vertical ? 0.1 : 0), y - (vertical ? 0 : 0.1)),
        )
      }
    }
  const horizontal = capBoundarySegments(wallCapRects(10, 0, 32))
  assert(horizontal.every((e) => e.ay === e.by))
  const vertical = capBoundarySegments(wallCapRects(5, 0, 32))
  assert(vertical.every((e) => e.ax === e.bx))
})
