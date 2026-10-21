import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { MeshBasicMaterial, Raycaster, Vector3 } from 'three'
import {
  generatePrototypeFloor,
  planDungeon3D,
} from '../apps/dungeon-atelier/src/experiments/dungeon-3d/plan.ts'
import {
  planStaircases,
  stairPoint,
  stairLevels,
} from '../apps/dungeon-atelier/src/experiments/dungeon-3d/stair-layout.ts'
import {
  addStoneStaircase,
  treadSurfaces,
} from '../apps/dungeon-atelier/src/experiments/dungeon-3d/stone-staircase.ts'
import { dressedBoxGeometry } from '../apps/dungeon-atelier/src/experiments/dungeon-3d/asset-geometry.ts'
import {
  GeometryBatches,
  disposeGeometry,
  CAP_PROFILE,
} from '../apps/dungeon-atelier/src/experiments/dungeon-3d/geometry.ts'
import { floorFootprint } from '../apps/dungeon-atelier/src/experiments/dungeon-3d/asset-model.ts'

test('removing floor indicators preserves every approved stone vertex, normal, UV and color', () => {
  const fixtures = JSON.parse(
    fs.readFileSync(
      new URL('./fixtures/staircase-stone-fingerprints.json', import.meta.url),
      'utf8',
    ),
  )
  for (const fixture of fixtures) {
    const { form, direction, height } = fixture,
      materials = Object.fromEntries(
        ['frame', 'stairEdge', 'masonry', 'iron', 'brass'].map((k) => [k, new MeshBasicMaterial()]),
      ),
      s = {
        id: 'preserved',
        form,
        direction,
        upperWall: true,
        x: 4,
        z: 5,
        rotation: Math.PI / 2,
        width: form === 'straight' ? 0.92 : 2.05,
        length: 3.4,
      },
      batch = new GeometryBatches(),
      hashes = {}
    addStoneStaircase(batch, materials, s, height, 'preserved')
    const root = batch.finish()
    root.traverse((node) => {
      if (!node.isMesh) return
      const name = Object.keys(materials).find((k) => materials[k] === node.material)
      assert(!['iron', 'brass'].includes(name), 'No arrow or plaque hardware remains')
      hashes[name] = {}
      for (const key of ['position', 'normal', 'uv', 'color']) {
        const a = node.geometry.attributes[key].array
        let hash = 2166136261
        for (const byte of new Uint8Array(a.buffer, a.byteOffset, a.byteLength))
          hash = Math.imul(hash ^ byte, 16777619)
        hashes[name][key] = hash >>> 0
      }
    })
    assert.deepEqual(hashes, fixture.hashes)
    disposeGeometry(root)
    Object.values(materials).forEach((m) => m.dispose())
  }
})

test('stair bays fit rectangular and irregular rooms without changing generation data', () => {
  const forms = new Set()
  for (let i = 0; i < 80; i++) {
    const plan = planDungeon3D(
        generatePrototypeFloor(i ? `stair-bay-${i}` : 'side-door-readability-0', i % 2 ? 64 : 32),
      ),
      before = JSON.stringify(plan),
      stairs = planStaircases(plan)
    assert.equal(JSON.stringify(plan), before)
    assert.deepEqual(stairs, planStaircases(plan))
    assert.equal(stairs.length, plan.stairs.length)
    for (const s of stairs) {
      forms.add(s.form)
      const r = s.bounds
      for (let z = Math.floor(r.z + 1e-6); z < Math.ceil(r.z + r.depth - 1e-6); z++)
        for (let x = Math.floor(r.x + 1e-6); x < Math.ceil(r.x + r.width - 1e-6); x++)
          assert.equal(plan.floor.tiles[z][x], 'floor', 'Bay must not cross walls or doors')
      for (const d of plan.doors)
        assert(
          Math.hypot(
            Math.max(r.x - d.x, 0, d.x - r.x - r.width),
            Math.max(r.z - d.z, 0, d.z - r.z - r.depth),
          ) >= 0.4,
        )
    }
  }
  assert.deepEqual([...forms].sort(), ['straight', 'switchback'])
})

test('every real tread and both landing endpoints reach their designed height, in either form/direction', () => {
  const materials = Object.fromEntries(
      ['frame', 'stairEdge', 'masonry', 'iron', 'brass'].map((k) => [k, new MeshBasicMaterial()]),
    ),
    caster = new Raycaster()
  for (const form of ['switchback', 'straight'])
    for (const direction of ['up', 'down'])
      for (const height of [2, 2.5, 3.5]) {
        const s = {
            id: 'proof',
            form,
            direction,
            upperWall: false,
            x: 4,
            z: 5,
            rotation: Math.PI / 2,
            width: form === 'straight' ? 0.92 : 2.05,
            length: 3.4,
          },
          levels = stairLevels(s, height),
          batch = new GeometryBatches(),
          proof = addStoneStaircase(batch, materials, s, height, 'stairs'),
          root = batch.finish()
        root.updateMatrixWorld(true)
        const probe = (x, z) => {
          const p = stairPoint(s, x, z)
          caster.set(new Vector3(p.x, 8, p.z), new Vector3(0, -1, 0))
          return caster.intersectObject(root, true)[0]?.point.y
        }
        for (let flight = 0; flight < proof.flights; flight++)
          for (let i = 0; i < levels.count; i++) {
            const x = s.width * (form === 'straight' ? 0.5 : flight ? 0.75 : 0.25),
              z = flight
                ? s.length - levels.landing - (i + 0.5) * levels.going
                : levels.landing + (i + 0.5) * levels.going,
              expected = levels.floor + (flight * levels.count + i + 1) * levels.rise
            assert(
              Math.abs(probe(x, z) - expected) < 1e-5,
              `${form}/${direction}/${height}/${flight}/${i}`,
            )
          }
        const x = s.width * (form === 'straight' ? 0.5 : 0.75) + 0.06,
          z = form === 'straight' ? s.length - levels.landing * 0.3 : levels.landing * 0.3
        assert(Math.abs(probe(x, z) - levels.destination) < 1e-5)
        if (direction === 'up') assert.equal(levels.destination, height + CAP_PROFILE.top)
        assert(Math.abs(levels.rise) <= 0.18)
        root.traverse((n) => {
          if (n.isMesh)
            for (const v of n.geometry.attributes.position.array) assert(Number.isFinite(v))
        })
        disposeGeometry(root)
      }
  Object.values(materials).forEach((m) => m.dispose())
})

test('darker slab edges partition existing faces without overlapping geometry', () => {
  const source = dressedBoxGeometry(0.85, 0.105, 0.3, 0.012),
    faces = treadSurfaces(source)
  assert.equal(
    faces.top.attributes.position.count + faces.edge.attributes.position.count,
    source.attributes.position.count,
  )
  for (const y of faces.top.attributes.normal.array.filter((_, i) => i % 3 === 1)) assert(y > 0.5)
  for (const y of faces.edge.attributes.normal.array.filter((_, i) => i % 3 === 1)) assert(y <= 0.5)
  source.dispose()
  faces.top.dispose()
  faces.edge.dispose()
})

test('descending wells cut the entire new bay out of the floor, not a small prop hole', () => {
  const plan = planDungeon3D(generatePrototypeFloor('side-door-readability-0')),
    s = planStaircases(plan).find((s) => s.direction === 'down'),
    footprint = floorFootprint(plan)
  for (let x = s.bounds.x + 0.05; x < s.bounds.x + s.bounds.width; x += 0.15)
    for (let z = s.bounds.z + 0.05; z < s.bounds.z + s.bounds.depth; z += 0.15)
      assert(!footprint.some((r) => x > r.x && x < r.x + r.width && z > r.z && z < r.z + r.depth))
})
