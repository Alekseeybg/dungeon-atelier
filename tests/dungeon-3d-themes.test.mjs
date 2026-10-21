import { test } from 'node:test'
import assert from 'node:assert/strict'
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, Texture } from 'three'
import { createMaterialThemeBinding } from '../apps/dungeon-atelier/src/experiments/dungeon-3d/theme-binding.ts'
import { ruinsAtlasCrop } from '../apps/dungeon-atelier/src/experiments/dungeon-3d/ruins-atlas.ts'

test('Ancient atlas crops stay in source stone interiors with bounded seeded patina', () => {
  for (const coping of [false, true]) {
    const a = Array.from({ length: 16 }, (_, i) => ruinsAtlasCrop('ruins-a', i, coping)),
      b = Array.from({ length: 16 }, (_, i) => ruinsAtlasCrop('ruins-b', i, coping))
    assert.deepEqual(
      a,
      Array.from({ length: 16 }, (_, i) => ruinsAtlasCrop('ruins-a', i, coping)),
    )
    assert.notDeepEqual(a, b)
    assert(new Set(a.map((c) => `${c.x},${c.y}`)).size >= 8)
    for (const crop of a) {
      assert(crop.x >= 0 && crop.y >= 0 && crop.x + crop.width <= 1 && crop.y + crop.height <= 1)
      assert(crop.patina >= 0.02 && crop.patina <= 0.055)
    }
  }
})

test('theme swaps preserve mesh/geometry identity and the original palette across repeated round trips', () => {
  const limestone = new MeshStandardMaterial({
      color: '#d9d4c5',
      map: new Texture(),
      roughness: 0.9,
    }),
    ruins = new MeshStandardMaterial({ color: '#696d63', map: new Texture(), roughness: 1 }),
    iron = new MeshStandardMaterial({ color: '#353834', metalness: 0.7 }),
    geometry = new BoxGeometry(),
    root = new Group(),
    a = new Mesh(geometry, limestone),
    b = new Mesh(geometry, [limestone, iron]),
    binding = createMaterialThemeBinding(
      new Map([['ancient-ruins', new Map([[limestone, ruins]])]]),
    ),
    original = {
      color: limestone.color.toArray(),
      map: limestone.map,
      roughness: limestone.roughness,
    },
    ids = [root.uuid, a.uuid, b.uuid, geometry.uuid],
    positions = Array.from(geometry.attributes.position.array)
  root.add(a, b)
  let disposed = 0
  limestone.addEventListener('dispose', () => disposed++)
  geometry.addEventListener('dispose', () => disposed++)
  for (let i = 0; i < 30; i++) {
    binding.apply(root, 'ancient-ruins')
    assert.equal(a.material, ruins)
    assert.deepEqual(b.material, [ruins, iron])
    binding.apply(root, 'restored-crypt')
    assert.equal(a.material, limestone)
    assert.deepEqual(b.material, [limestone, iron])
  }
  assert.deepEqual([root.uuid, a.uuid, b.uuid, geometry.uuid], ids)
  assert.deepEqual(Array.from(geometry.attributes.position.array), positions)
  assert.deepEqual(
    { color: limestone.color.toArray(), map: limestone.map, roughness: limestone.roughness },
    original,
  )
  assert.equal(disposed, 0)
  limestone.dispose()
  ruins.dispose()
  iron.dispose()
  geometry.dispose()
  original.map.dispose()
  ruins.map.dispose()
})

test('theme binding handles freshly rebuilt architecture alongside existing themed floors', () => {
  const source = new MeshStandardMaterial(),
    variant = new MeshStandardMaterial(),
    geometry = new BoxGeometry(),
    floor = new Mesh(geometry, source),
    root = new Group(),
    binding = createMaterialThemeBinding(new Map([['ancient-ruins', new Map([[source, variant]])]]))
  root.add(floor)
  binding.apply(root, 'ancient-ruins')
  const freshWall = new Mesh(geometry, source)
  root.add(freshWall)
  binding.apply(root, 'ancient-ruins')
  assert.equal(floor.material, variant)
  assert.equal(freshWall.material, variant)
  binding.apply(root, 'restored-crypt')
  assert.equal(floor.material, source)
  assert.equal(freshWall.material, source)
  source.dispose()
  variant.dispose()
  geometry.dispose()
})
