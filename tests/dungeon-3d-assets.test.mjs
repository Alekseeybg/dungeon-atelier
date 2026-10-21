import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DoubleSide, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three'
import {
  generatePrototypeFloor,
  planDungeon3D,
} from '../apps/dungeon-atelier/src/experiments/dungeon-3d/plan.ts'
import {
  floorFootprint,
  planStoneSlabs,
  rectangleContours,
  wallCourses,
} from '../apps/dungeon-atelier/src/experiments/dungeon-3d/asset-model.ts'
import { slabGeometry } from '../apps/dungeon-atelier/src/experiments/dungeon-3d/asset-geometry.ts'
import {
  wallField,
  wallCracks,
} from '../apps/dungeon-atelier/src/experiments/dungeon-3d/wall-wear.ts'

const area = (loop) =>
  loop.reduce((n, p, i) => {
    const q = loop[(i + 1) % loop.length]
    return n + p.x * q.z - q.x * p.z
  }, 0) / 2

test('floor contour union removes internal tile seams and retains holes and detached pieces', () => {
  const rect = (x, z, width, depth) => ({ x, z, width, depth }),
    joined = rectangleContours([rect(0, 0, 1, 1), rect(0.5, 0, 1, 1)])
  assert.equal(joined.length, 1)
  assert.equal(joined[0].length, 4)
  assert.equal(area(joined[0]), 1.5)
  const ring = rectangleContours([
    rect(0, 0, 3, 1),
    rect(0, 2, 3, 1),
    rect(0, 1, 1, 1),
    rect(2, 1, 1, 1),
  ])
  assert.equal(ring.length, 2)
  assert.deepEqual(
    ring.map(area).sort((a, b) => a - b),
    [-1, 9],
  )
  assert.equal(rectangleContours([rect(0, 0, 1, 1), rect(2, 0, 1, 1)]).length, 2)
})

test('slabs are seeded, cross tile boundaries, and keep descending stair apertures open', () => {
  const plan = planDungeon3D(generatePrototypeFloor('side-door-readability-0')),
    before = JSON.stringify(plan),
    slabs = planStoneSlabs(plan),
    material = new MeshBasicMaterial({ side: DoubleSide })
  assert.deepEqual(slabs, planStoneSlabs(plan))
  assert.equal(JSON.stringify(plan), before)
  assert(slabs.some((s) => s.rects.length > 1))
  const holes = plan.tiles.filter((t) => t.down)
  assert(holes.length > 0)
  const footprint = floorFootprint(plan)
  for (const h of holes)
    assert(
      !footprint.some(
        (r) =>
          h.x + 0.5 > r.x &&
          h.x + 0.5 < r.x + r.width &&
          h.z + 0.5 > r.z &&
          h.z + 0.5 < r.z + r.depth,
      ),
    )
  let bevel = false
  for (const slab of slabs) {
    assert(slab.top >= 0.023 && slab.top <= 0.033)
    const g = slabGeometry(slab)
    if (!g) continue
    const p = g.getAttribute('position'),
      n = g.getAttribute('normal')
    for (const v of p.array) assert(Number.isFinite(v))
    g.computeBoundingBox()
    assert(Math.abs(g.boundingBox.max.y - slab.top) < 1e-6)
    for (let i = 0; i < n.count; i++) if (n.getY(i) > 0.1 && n.getY(i) < 0.9) bevel = true
    const mesh = new Mesh(g, material)
    for (const h of holes)
      assert.equal(
        new Raycaster(
          new Vector3(h.x + 0.5, 1, h.z + 0.5),
          new Vector3(0, -1, 0),
          0,
          2,
        ).intersectObject(mesh).length,
        0,
      )
    g.dispose()
  }
  assert(bevel)
  material.dispose()
})

test('wall courses share regional value and texture families rather than independent block tint', () => {
  const edge = { ax: 0, az: 2, bx: 12, bz: 2 },
    blocks = wallCourses('masonry', edge, 2.1)
  assert.deepEqual(blocks, wallCourses('masonry', edge, 2.1))
  assert(blocks.length > 50)
  for (const b of blocks) assert(b.b > b.a && b.high > b.low && b.relief <= 0.014)
  const group = blocks.filter((b) => b.low === blocks[0].low && Math.floor((b.a + b.b) / 8) === 0)
  assert(group.length > 2)
  assert(Math.max(...group.map((b) => b.tint)) - Math.min(...group.map((b) => b.tint)) < 0.02)
  const thirdCourse = blocks.filter((b) => Math.abs(b.low - ((2 * 2.1) / 6 + 0.006)) < 1e-8)
  assert.deepEqual(
    group.map((b) => [b.a, b.b]),
    thirdCourse.slice(0, group.length).map((b) => [b.a, b.b]),
  )
})

test('wall weathering field is seeded and continuous through region boundaries', () => {
  const seed = 'damp-stone',
    a = wallField(seed, 1.999999, 0.5, 3),
    b = wallField(seed, 2.000001, 0.5, 3)
  assert(Math.abs(a - b) < 1e-5)
  assert.equal(a, wallField(seed, 1.999999, 0.5, 3))
  assert.notEqual(a, wallField('other-stone', 1.999999, 0.5, 3))
  for (let x = -2; x < 10; x += 0.13) {
    const value = wallField(seed, x, 0.7, 2)
    assert(value >= 0 && value <= 1)
  }
})

test('wall cracks form sparse deterministic branched paths instead of a per-block stamp', () => {
  const cracks = wallCracks('ancient')
  assert.deepEqual(cracks, wallCracks('ancient'))
  assert.notDeepEqual(cracks, wallCracks('different'))
  assert.equal(cracks.length, 11)
  assert(
    cracks.every(
      (c) => c.points.length === 7 && c.branch.length === 2 && c.branch[0] === c.points[3],
    ),
  )
  assert(new Set(cracks.map((c) => c.points[0].x)).size > 8)
})
