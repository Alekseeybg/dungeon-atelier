import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Mesh, MeshBasicMaterial, Raycaster, Vector2, Vector3 } from 'three'
import {
  CAP_PROFILE,
  capProfileGeometry,
  copingGeometry,
} from '../apps/dungeon-atelier/src/experiments/dungeon-3d/geometry.ts'
import {
  masonryAppearance,
  planDungeon3D,
  createCapOccupancy,
  capAppearance,
} from '../apps/dungeon-atelier/src/experiments/dungeon-3d/plan.ts'
import { createCapWeathering } from '../apps/dungeon-atelier/src/experiments/dungeon-3d/cap-weathering.ts'
import { fourDoorRoom } from '../scripts/scenes/four-door-room.mjs'

test('cap geometry has a real inward chamfer, flat top and vertical shoulder without an overhang', () => {
  const geometry = capProfileGeometry(
      [new Vector2(0, 0), new Vector2(1, 0), new Vector2(1, 1), new Vector2(0, 1)],
      [true, true, true, true],
    ),
    positions = geometry.getAttribute('position'),
    normals = geometry.getAttribute('normal'),
    material = new MeshBasicMaterial(),
    mesh = new Mesh(geometry, material)
  let slope = false,
    top = false,
    vertical = false
  for (let i = 0; i < positions.count; i++) {
    assert(positions.getX(i) >= -1e-6 && positions.getX(i) <= 1 + 1e-6)
    assert(positions.getZ(i) >= -1e-6 && positions.getZ(i) <= 1 + 1e-6)
    const ny = normals.getY(i)
    if (ny > 0.99) top = true
    else if (ny > 0.1 && ny < 0.99) slope = true
    else if (Math.abs(ny) < 1e-6) vertical = true
  }
  assert(top && slope && vertical)
  const height = (x) =>
    new Raycaster(new Vector3(x, 1, 0.5), new Vector3(0, -1, 0), 0, 2).intersectObject(mesh)[0]
      ?.point.y
  assert(Math.abs(height(0.5) - CAP_PROFILE.top) < 1e-6)
  const facetHeight = height(CAP_PROFILE.chamfer / 2)
  assert(facetHeight > CAP_PROFILE.shoulder && facetHeight < CAP_PROFILE.top)
  geometry.dispose()
  material.dispose()
})

test('connected caps meet at the shoulder with intentional fine top joints, and corners stay within their footprints', () => {
  const rects = [
      { x: 0, z: 0.1875, width: 1, depth: 0.625 },
      { x: 1, z: 0.1875, width: 1, depth: 0.625 },
    ],
    occupied = (x, z) => x >= 0 && x <= 2 && z >= 0.1875 && z <= 0.8125,
    caps = rects.map((r, x) => copingGeometry([r], x, 0, occupied)),
    shared = (g, offset) => {
      const p = g.getAttribute('position'),
        points = new Set()
      for (let i = 0; i < p.count; i++)
        if (Math.abs(p.getX(i) + offset - 1) < 1e-6)
          points.add(`${p.getY(i).toFixed(5)}:${p.getZ(i).toFixed(5)}`)
      return [...points].sort()
    }
  assert.deepEqual(shared(caps[0], 0), shared(caps[1], 1))
  const topXs = caps.map((g, offset) => {
    const p = g.getAttribute('position'),
      xs = []
    for (let i = 0; i < p.count; i++)
      if (Math.abs(p.getY(i) - CAP_PROFILE.top) < 1e-6) xs.push(p.getX(i) + offset)
    return xs
  })
  assert(Math.abs(Math.min(...topXs[1]) - Math.max(...topXs[0]) - 2 * CAP_PROFILE.joint) < 1e-6)
  caps.forEach((g) => g.dispose())
  for (const wall of planDungeon3D(fourDoorRoom()).walls) {
    const geometry = copingGeometry(wall.rects, wall.x, wall.y),
      p = geometry.getAttribute('position')
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i) + wall.x,
        z = p.getZ(i) + wall.y
      assert(Number.isFinite(x) && Number.isFinite(z) && Number.isFinite(p.getY(i)))
      assert(
        wall.rects.some(
          (r) =>
            x >= r.x - 1e-6 &&
            x <= r.x + r.width + 1e-6 &&
            z >= r.z - 1e-6 &&
            z <= r.z + r.depth + 1e-6,
        ),
      )
    }
    geometry.dispose()
  }
})

test('masonry appearance stays seeded and restrained with coherent variation across region boundaries', () => {
  const samples = (seed) =>
    Array.from({ length: 160 }, (_, i) => masonryAppearance(seed, i / 4, 7, Math.floor(i / 8)))
  assert.deepEqual(samples('ruins'), samples('ruins'))
  assert.notDeepEqual(samples('ruins'), samples('another'))
  assert(new Set(samples('ruins').map((s) => s.atlas)).size >= 12)
  assert(samples('ruins').every((s) => s.tint > 0.9 && s.tint < 1.1))
  const a = masonryAppearance('ruins', 6 - 0.0001, 7, 0),
    b = masonryAppearance('ruins', 6 + 0.0001, 7, 0)
  assert(Math.abs(a.region - b.region) < 0.0001)
})

test('door heads close cap coverage in every orientation and cutaway removes only regular heads', () => {
  const plan = planDungeon3D(fourDoorRoom()),
    intact = createCapOccupancy(plan),
    cutaway = createCapOccupancy(plan, true)
  for (const door of plan.doors) {
    assert(intact(door.x, door.z))
    assert.equal(cutaway(door.x, door.z), false)
    for (const sign of [-1, 1]) {
      const x = door.x + Math.cos(door.rotation) * sign * 0.499,
        z = door.z - Math.sin(door.rotation) * sign * 0.499
      assert(intact(x, z), 'The jamb-side cap end must not be classified as exposed')
    }
  }
  assert.equal(
    CAP_PROFILE.bottom,
    0,
    'Cap side bands must not overlap coplanar wall faces below the wall height',
  )
  const secretPlan = planDungeon3D(fourDoorRoom(true), true),
    secret = secretPlan.doors.find((d) => d.type === 'secret')
  assert(secret)
  assert(
    createCapOccupancy(secretPlan, true)(secret.x, secret.z),
    'Cutaway must retain revealed secret masonry',
  )
})

test('cap chips and weathering are reproducible, bounded and varied without losing the flat crown', () => {
  const outline = [new Vector2(0, 0), new Vector2(1, 0), new Vector2(1, 1), new Vector2(0, 1)],
    a = capProfileGeometry(outline, [true, true, true, true], 3),
    b = capProfileGeometry(outline, [true, true, true, true], 3),
    clean = capProfileGeometry(outline, [true, true, true, true])
  assert.deepEqual(a.getAttribute('position').array, b.getAttribute('position').array)
  const variants = Array.from({ length: 8 }, (_, wear) =>
    capProfileGeometry(outline, [true, true, true, true], wear),
  )
  assert(
    variants.some((g) => g.getAttribute('position').count > clean.getAttribute('position').count),
    'Some seeded variants must contain real chips',
  )
  variants.forEach((g) => g.dispose())
  const p = a.getAttribute('position')
  for (let i = 0; i < p.count; i++)
    assert(p.getY(i) >= -1e-6 && p.getY(i) <= CAP_PROFILE.top + 1e-6)
  a.dispose()
  b.dispose()
  clean.dispose()
  const first = createCapWeathering('old-ruins'),
    second = createCapWeathering('old-ruins'),
    other = createCapWeathering('other'),
    sample = (field) =>
      Array.from({ length: 64 }, (_, i) => field.sample((i % 8) / 8, Math.floor(i / 8) / 8))
  assert.deepEqual(sample(first), sample(second))
  assert.notDeepEqual(sample(first), sample(other))
  assert(sample(first).some((p) => p.moss > 0.04))
  assert(sample(first).some((p) => p.dirt > 0.04))
  const start = first.sample(0, 0.32),
    end = first.sample(1, 0.32)
  assert(Math.abs(start.dirt - end.dirt) < 1e-8 && Math.abs(start.moss - end.moss) < 1e-8)
})

test('cap finishes vary per stone without a repeated three-tile phase or a blanket dirt style', () => {
  const samples = Array.from({ length: 256 }, (_, i) =>
    capAppearance('side-door-readability-0', i % 16, Math.floor(i / 16)),
  )
  assert.deepEqual(
    samples,
    Array.from({ length: 256 }, (_, i) =>
      capAppearance('side-door-readability-0', i % 16, Math.floor(i / 16)),
    ),
  )
  assert.equal(new Set(samples.map((s) => s.kind)).size, 4)
  assert(new Set(samples.map((s) => `${s.atlas}:${s.turn}`)).size > 50)
  const clean = samples.filter((s) => s.kind === 0).length
  assert(clean > 100 && clean < 185, 'Most of the palette should remain neutral worn stone')
  const repeated = samples.filter((s, i) => {
    const shifted = capAppearance('side-door-readability-0', (i % 16) + 3, Math.floor(i / 16))
    return s.atlas === shifted.atlas && s.turn === shifted.turn
  }).length
  assert(repeated < 30, 'Moving three tiles must not restart the same cap pattern')
})
