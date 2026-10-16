import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  CHAMFER,
  chamferFacets,
  facetTransform,
} from '../apps/dungeon-atelier/src/features/dungeon/rendering/visual-foundation/chamfer-model.ts'
test('room-facing chamfer removes the upper corner inside the cap without raising or extruding it', () => {
  for (const [nx, ny] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]) {
    const edge = nx
        ? { ax: 26, ay: 0, bx: 26, by: 96, nx, ny }
        : { ax: 0, ay: 26, bx: 96, by: 26, nx, ny },
      [facet] = chamferFacets([edge])
    for (const p of facet.points) {
      assert(p.z <= 1 && p.z >= 1 - CHAMFER.drop / 24)
      const distance = (p.x - edge.ax) * nx + (p.y - edge.ay) * ny
      assert(distance <= 0 && distance >= -CHAMFER.width)
    }
    assert.equal(facet.points[0].z, 1)
    assert.equal(facet.points[2].z, 1 - CHAMFER.drop / 24)
    const m = facetTransform(edge, 26 / 32, 6)
    for (const p of facet.points) {
      assert(Math.abs(m.a * p.x + m.c * p.y + m.e - (p.x - 6 * p.z)) < 1e-8)
      assert(Math.abs(m.b * p.x + m.d * p.y + m.f - ((p.y * 26) / 32 - 24 * p.z)) < 1e-8)
    }
  }
})
test('tile edges merge before profile construction and corner mitres share exact endpoints', () => {
  const facets = chamferFacets([
    { ax: 0, ay: 26, bx: 32, by: 26, nx: 0, ny: 1 },
    { ax: 32, ay: 26, bx: 64, by: 26, nx: 0, ny: 1 },
    { ax: 64, ay: 0, bx: 64, by: 26, nx: 1, ny: 0 },
  ])
  assert.equal(facets.length, 2)
  assert.deepEqual(facets[0].points[1], facets[1].points[1])
  assert.deepEqual(facets[0].points[2], facets[1].points[2])
})

test('every room-facing facet remains visibly wide at normal zoom in the fixed projection', () => {
  for (const [nx, ny] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]) {
    const edge = nx
      ? { ax: 26, ay: 0, bx: 26, by: 96, nx, ny }
      : { ax: 0, ay: 26, bx: 96, by: 26, nx, ny }
    const [facet] = chamferFacets([edge]),
      points = facet.points.map((p) => ({ x: p.x - 6 * p.z, y: (p.y * 26) / 32 - 24 * p.z }))
    const area =
      Math.abs(
        points.reduce((sum, p, i) => {
          const next = points[(i + 1) % points.length]
          return sum + p.x * next.y - next.x * p.y
        }, 0),
      ) / 2
    const length = Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y)
    assert(area / length >= 4.5, `Facet ${nx},${ny} is lost to foreshortening`)
    assert(20 - CHAMFER.width * 2 >= 5, 'Retain a flat crown between the two chamfers')
  }
})

test('inner and outer chamfers share a flat crown and meet at convex and concave mitres', () => {
  const facets = chamferFacets([
    // A closed rectangular coping ring, with both exposed contours.
    { ax: 0, ay: 0, bx: 128, by: 0, nx: 0, ny: -1 },
    { ax: 128, ay: 0, bx: 128, by: 128, nx: 1, ny: 0 },
    { ax: 0, ay: 128, bx: 128, by: 128, nx: 0, ny: 1 },
    { ax: 0, ay: 0, bx: 0, by: 128, nx: -1, ny: 0 },
    { ax: 20, ay: 20, bx: 108, by: 20, nx: 0, ny: 1 },
    { ax: 108, ay: 20, bx: 108, by: 108, nx: -1, ny: 0 },
    { ax: 20, ay: 108, bx: 108, by: 108, nx: 0, ny: -1 },
    { ax: 20, ay: 20, bx: 20, by: 108, nx: 1, ny: 0 },
  ])
  const vertexUse = new Map()
  for (const facet of facets) {
    for (const p of facet.footprint) {
      assert(p.x >= 0 && p.y >= 0 && p.x <= 128 && p.y <= 128)
      assert(p.x <= 20 || p.x >= 108 || p.y <= 20 || p.y >= 108, 'Facet enters room floor')
    }
    for (const p of facet.points.slice(0, 2)) {
      const key = `${p.x},${p.y},${p.z}`
      vertexUse.set(key, (vertexUse.get(key) ?? 0) + 1)
    }
  }
  assert.equal(vertexUse.size, 8)
  assert(
    [...vertexUse.values()].every((count) => count === 2),
    'Each mitre joins two facets',
  )
  assert.equal(facets[4].points[0].y - facets[0].points[0].y, 5)
})
