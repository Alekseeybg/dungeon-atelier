import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  generatePrototypeFloor,
  planDungeon3D,
} from '../apps/dungeon-atelier/src/experiments/dungeon-3d/plan.ts'
import {
  planRuinsCaps,
  planRuinsWallRun,
  ruinsDressedStone,
} from '../apps/dungeon-atelier/src/experiments/dungeon-3d/ruins-placement.ts'
import { masonryRuns } from '../apps/dungeon-atelier/src/experiments/dungeon-3d/wall-runs.ts'
import { ruinsCourses } from '../apps/dungeon-atelier/src/experiments/dungeon-3d/ruins-courses.ts'
import { ruinsWallGeometry } from '../apps/dungeon-atelier/src/experiments/dungeon-3d/ruins-wall-geometry.ts'
import {
  GeometryBatches,
  disposeGeometry,
} from '../apps/dungeon-atelier/src/experiments/dungeon-3d/geometry.ts'
import { BoxGeometry, MeshBasicMaterial } from 'three'

const heavy = (p) => ['strong', 'hero'].includes(p.wear)
test('cap pools follow topology, damage has an exclusion radius and planning is order independent', () => {
  const counts = { quiet: 0, medium: 0, strong: 0, hero: 0 }
  for (let i = 0; i < 16; i++) {
    const plan = planDungeon3D(generatePrototypeFloor('ruins-rules-' + i, i % 2 ? 64 : 32)),
      before = JSON.stringify(plan),
      rules = planRuinsCaps(plan),
      defects = []
    assert.deepEqual(
      rules,
      planRuinsCaps({
        ...plan,
        walls: [...plan.walls].reverse(),
        doors: [...plan.doors].reverse(),
      }),
    )
    assert.equal(JSON.stringify(plan), before)
    for (const [key, p] of rules) {
      counts[p.wear]++
      const [x, z] = key.split(',').map(Number),
        wall = plan.walls.find((w) => w.x === x && w.y === z),
        expected =
          wall && [5, 10].includes(wall.mask)
            ? 'straight'
            : wall && [3, 6, 12, 9].includes(wall.mask)
              ? 'corner'
              : 'transition',
        start = expected === 'corner' ? 8 : expected === 'transition' ? 16 : 0
      assert.equal(p.pool, expected)
      assert(p.atlas >= start && p.atlas < start + 8)
      if (expected === 'transition') assert(!heavy(p), 'Lintels and transitions stay calm')
      if (heavy(p)) defects.push({ x, z, ...p })
      for (const d of [
        { x: x + 1, z },
        { x, z: z + 1 },
      ]) {
        const neighbor = rules.get(`${d.x},${d.z}`)
        if (neighbor)
          assert(
            Math.abs(p.tint - neighbor.tint) < 0.025,
            'Regional value stays continuous across neighbors',
          )
      }
    }
    for (let a = 0; a < defects.length; a++)
      for (let b = a + 1; b < defects.length; b++) {
        const x = defects[a],
          y = defects[b]
        assert(
          Math.hypot(x.x - y.x, x.z - y.z) >= (x.wear === 'hero' || y.wear === 'hero' ? 10 : 4),
        )
      }
  }
  assert(counts.quiet > counts.strong * 8)
  assert(counts.medium > counts.strong * 5)
  assert(counts.strong >= counts.hero)
})

test('wall run rules use mixed bonded courses and exclude neighboring or vertically stacked strong defects', () => {
  const plan = planDungeon3D(generatePrototypeFloor('side-door-readability-0'))
  for (const edge of masonryRuns(plan)) {
    const planned = planRuinsWallRun(plan.floor.seed, edge, 2.5),
      horizontal = edge.az === edge.bz,
      start = horizontal ? edge.ax : edge.az,
      end = horizontal ? edge.bx : edge.bz
    assert.deepEqual(
      planned.map((p) => p.block),
      ruinsCourses(plan.floor.seed, edge, 2.5),
    )
    const defects = planned.filter((p) => heavy(p.placement))
    for (const p of defects) {
      const along = (p.block.a + p.block.b) / 2
      assert(along - start >= 1.2 && end - along >= 1.2)
      for (const q of defects)
        if (p !== q) {
          const row = (b) => Math.round(b.low / (2.5 / Math.round(2.5 / 0.34)))
          assert(
            Math.hypot(along - (q.block.a + q.block.b) / 2, (row(p.block) - row(q.block)) * 0.7) >=
              3.2,
          )
        }
    }
    assert(
      planned.every((p) => p.placement.turn === 0),
      'Masonry grain stays in course direction',
    )
  }
})

test('Ancient rule attributes leave original positions, normals, UVs and colors intact', () => {
  const source = new BoxGeometry(),
    material = new MeshBasicMaterial(),
    plain = new GeometryBatches(),
    tagged = new GeometryBatches(),
    placement = { atlas: 6, turn: 1, tint: 0.98, pool: 'straight', wear: 'strong', run: 'test' }
  plain.add(material, source, undefined, null, 0.97, 3, 0)
  tagged.add(material, source, undefined, null, 0.97, 3, 0, placement)
  const a = plain.finish(),
    b = tagged.finish(),
    ga = a.children[0].geometry,
    gb = b.children[0].geometry
  for (const key of ['position', 'normal', 'uv', 'color'])
    assert.deepEqual(gb.attributes[key].array, ga.attributes[key].array)
  assert([...gb.attributes.ruinsRule.array].every((v) => v === 1))
  for (let i = 0; i < gb.attributes.ruinsUv.count; i++)
    assert.equal(
      Math.floor(gb.attributes.ruinsUv.getY(i) * 4),
      3 - Math.floor(placement.atlas / 6),
      'Rule pool row accounts for CanvasTexture flipY',
    )
  assert([...ga.attributes.ruinsRule.array].every((v) => v === 0))
  disposeGeometry(a)
  disposeGeometry(b)
  source.dispose()
  material.dispose()
})

test('mixed masonry fills complete runs with level courses, varied lengths and restrained depth', () => {
  const edge = { ax: 2, az: 5, bx: 23, bz: 5, nx: 0, nz: 1 }
  for (let i = 0; i < 32; i++) {
    const seed = 'wall-bond-' + i,
      blocks = ruinsCourses(seed, edge, 2.5)
    assert.deepEqual(blocks, ruinsCourses(seed, edge, 2.5))
    assert.notDeepEqual(blocks, ruinsCourses(seed + '-different', edge, 2.5))
    let below = []
    for (const low of new Set(blocks.map((b) => b.low))) {
      const course = blocks.filter((b) => b.low === low),
        joints = []
      assert(course[0].a - edge.ax < 0.013)
      assert(edge.bx - course.at(-1).b < 0.013)
      assert(new Set(course.map((b) => Math.round((b.b - b.a) / 0.15))).size >= 4)
      for (let j = 0; j < course.length; j++) {
        const b = course[j]
        assert(b.b - b.a >= 0.35, 'No clipped sliver stones')
        assert(b.relief >= 0.019 && b.relief <= 0.053, 'Depth remains shallow')
        assert.equal(b.high, course[0].high, 'All stones share the same horizontal bed')
        if (j) {
          const gap = b.a - course[j - 1].b
          assert(gap >= 0.018 - 1e-8 && gap <= 0.024 + 1e-8)
          const joint = (b.a + course[j - 1].b) / 2
          assert(
            below.every((p) => Math.abs(p - joint) > 0.08),
            'Courses overlap instead of stacking vertical joints',
          )
          joints.push(joint)
        }
      }
      below = joints
    }
  }
})

test('wall bevels use real world dimensions and provide front, chamfer and recessed returns', () => {
  for (const width of [0.38, 0.76, 1.68]) {
    const g = ruinsWallGeometry(width, 0.34, 0.04),
      p = g.attributes.position,
      n = g.attributes.normal
    g.computeBoundingBox()
    assert(Math.abs(g.boundingBox.min.x + width / 2) < 1e-6)
    assert(Math.abs(g.boundingBox.max.z - 0.04) < 1e-6)
    assert([...p.array, ...n.array, ...g.attributes.uv.array].every(Number.isFinite))
    assert(
      Array.from({ length: n.count }, (_, i) => n.getZ(i)).some((z) => z > 0.1 && z < 0.9),
      'Real bevel normals catch light',
    )
    assert(
      Array.from({ length: p.count }, (_, i) => p.getZ(i)).some((z) => z === 0),
      'Return reaches the mortar bed',
    )
    g.dispose()
  }
})

test('different block lengths keep the same physical mineral-grain scale without sampling neighboring atlas cells', () => {
  for (const width of [0.38, 0.76, 1.84]) {
    const g = ruinsWallGeometry(width, 0.34, 0.04, 0.99, 0.01),
      p = g.attributes.position,
      uv = g.attributes.uv
    for (let i = 0; i < p.count; i++) {
      assert(uv.getX(i) >= 0 && uv.getX(i) <= 1 && uv.getY(i) >= 0 && uv.getY(i) <= 1)
      assert(Math.abs(uv.getX(i) - uv.getX(0) - (p.getX(i) - p.getX(0)) / 2) < 1e-6)
      assert(Math.abs(uv.getY(i) - uv.getY(0) - (p.getY(i) - p.getY(0)) / 2) < 1e-6)
    }
    g.dispose()
  }
})

test('stairs and door dressing share the wall quarry with quiet regional wear and clearer tread values', () => {
  for (let i = 0; i < 64; i++) {
    const args = ['matching-stone', i * 0.3, 0.7, 5.5],
      frame = ruinsDressedStone(...args, 'frame'),
      riser = ruinsDressedStone(...args, 'riser'),
      tread = ruinsDressedStone(...args, 'tread')
    assert.deepEqual(frame, ruinsDressedStone(...args, 'frame'))
    assert.deepEqual(frame, riser)
    assert.equal(frame.atlas, tread.atlas)
    assert(frame.atlas >= 0 && frame.atlas < 24)
    assert(['quiet', 'medium'].includes(frame.wear))
    assert.equal(frame.grainScale, 2)
    assert(Math.abs(tread.tint / frame.tint - 1.08) < 1e-9)
    const neighbor = ruinsDressedStone('matching-stone', i * 0.3 + 0.1, 0.7, 5.5, 'frame')
    assert(Math.abs(neighbor.tint - frame.tint) < 0.01)
  }
})
