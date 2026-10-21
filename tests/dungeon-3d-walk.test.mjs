import { test } from 'node:test'
import assert from 'node:assert/strict'
import { effectScope, ref, nextTick } from 'vue'
import * as THREE from 'three'
import { useDungeonWalk } from '../apps/dungeon-atelier/src/features/dungeon/exploration/useDungeonWalk.ts'
import { createWalkVisibility } from '../apps/dungeon-atelier/src/experiments/dungeon-3d/walk-visibility.ts'
import { createWalkMarker } from '../apps/dungeon-atelier/src/experiments/dungeon-3d/walk-marker.ts'

function fixture() {
  const tiles = Array.from({ length: 7 }, (_, y) =>
    Array.from({ length: 7 }, (_, x) => (x > 0 && x < 6 && y > 0 && y < 6 ? 'floor' : 'wall')),
  )
  tiles[3][4] = 'door'
  return {
    width: 7,
    height: 7,
    tiles,
    stairs: [
      { direction: 'up', position: { x: 3, y: 3 } },
      { direction: 'down', position: { x: 5, y: 3 } },
    ],
  }
}

test('walk turns in place, reverses facing, then moves along grid headings and respects walls', () => {
  const scope = effectScope(),
    floor = fixture(),
    before = JSON.stringify(floor)
  const walk = scope.run(() => useDungeonWalk(() => floor))
  try {
    walk.command('toggle')
    assert.equal(walk.state.explored.size, 9)
    for (const [action, heading] of [
      ['left', 3],
      ['right', 0],
      ['around', 2],
      ['around', 0],
    ]) {
      walk.command(action)
      assert.deepEqual({ ...walk.state.position }, { x: 3, y: 3 })
      assert.equal(walk.state.heading, heading)
      assert.equal(walk.state.steps, 0)
    }
    walk.command('right')
    walk.command('forward')
    assert.deepEqual({ ...walk.state.position }, { x: 4, y: 3 }) // Existing traversal permits doors.
    const remembered = new Set(walk.state.explored)
    walk.command('forward')
    assert.match(walk.state.message, /down staircase/)
    walk.command('forward') // Boundary wall.
    assert.deepEqual({ ...walk.state.position }, { x: 5, y: 3 })
    assert.equal(walk.state.steps, 2)
    walk.command('around')
    walk.command('forward')
    for (const cell of remembered) assert(walk.state.explored.has(cell))
    assert.equal(JSON.stringify(floor), before)
  } finally {
    scope.stop()
  }
})

test('walk reset and floor changes clear exploration, while exit/re-entry remembers it', async () => {
  const scope = effectScope(),
    floor = ref(fixture()),
    walk = scope.run(() => useDungeonWalk(() => floor.value))
  try {
    walk.command('toggle')
    walk.command('forward')
    assert.equal(walk.state.explored.size, 12)
    walk.command('toggle')
    walk.command('toggle')
    assert.equal(walk.state.explored.size, 12)
    walk.command('reset')
    assert.equal(walk.state.explored.size, 9)
    walk.command('forward')
    floor.value = fixture()
    await nextTick()
    assert.equal(walk.state.steps, 0)
    assert.equal(walk.state.explored.size, 9)
  } finally {
    scope.stop()
  }
})

test('fog shares strict grid clipping with normal, shadow and bloom materials and restores shadows', () => {
  const fog = createWalkVisibility(7, 7),
    root = new THREE.Group(),
    material = new THREE.MeshStandardMaterial(),
    mesh = new THREE.Mesh(new THREE.BoxGeometry(), material),
    originalDepth = new THREE.MeshDepthMaterial()
  mesh.customDepthMaterial = originalDepth
  root.add(mesh)
  try {
    fog.update({ active: true, explored: new Set([24]) })
    fog.apply(root)
    assert.equal(fog.known(3.5, 3.5), true)
    assert.equal(fog.known(4, 3), false)
    assert.equal(fog.known(-0.01, 3), false)
    assert.notEqual(mesh.customDepthMaterial, originalDepth)
    const shader = {
      uniforms: {},
      vertexShader: THREE.ShaderLib.standard.vertexShader,
      fragmentShader: THREE.ShaderLib.standard.fragmentShader,
    }
    material.onBeforeCompile(shader, {})
    assert.equal(shader.uniforms.walkEnabled.value, true)
    assert.equal(shader.uniforms.walkMap.value.image.data[24], 255)
    assert.match(shader.fragmentShader, /if\(!walkKnown\(walkXZ\)\)discard/)
    assert.match(shader.fragmentShader, /walkCell>=0/)
    for (const depth of [mesh.customDepthMaterial, mesh.customDistanceMaterial]) {
      const pass = {
        uniforms: {},
        vertexShader: THREE.ShaderLib.depth.vertexShader,
        fragmentShader: THREE.ShaderLib.depth.fragmentShader,
      }
      depth.onBeforeCompile(pass, {})
      assert.equal(pass.uniforms.walkMap, shader.uniforms.walkMap)
    }
    fog.update({ active: false, explored: new Set() })
    fog.apply(root)
    assert.equal(fog.known(4, 3), true)
    assert.equal(mesh.customDepthMaterial, originalDepth)
  } finally {
    fog.dispose()
    mesh.geometry.dispose()
    material.dispose()
    originalDepth.dispose()
  }
})

test('player marker is compact physical geometry without emitted light', () => {
  const marker = createWalkMarker()
  try {
    const bounds = new THREE.Box3().setFromObject(marker.root),
      size = bounds.getSize(new THREE.Vector3())
    assert(size.x < 0.8 && size.z < 0.8 && size.y < 0.17)
    assert.equal(marker.root.children.length, 2)
    let triangles = 0,
      meshes = 0
    marker.root.traverse((node) => {
      assert.equal(node.isLight, undefined)
      if (node.geometry) {
        triangles += node.geometry.getAttribute('position').count / 3
        meshes++
        assert.equal(node.castShadow, true)
        assert.equal(node.receiveShadow, true)
      }
      if (node.material)
        for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
          if (material.emissive) assert.equal(material.emissive.getHex(), 0)
        }
    })
    assert(triangles < 12000 && meshes <= 10)
    marker.root.updateMatrixWorld(true)
    for (const [x, z] of [
      [0.02, 0],
      [0.321, 0.01],
    ]) {
      const hit = new THREE.Raycaster(
        new THREE.Vector3(x, 1, z),
        new THREE.Vector3(0, -1, 0),
      ).intersectObject(marker.root, true)[0]
      assert(
        hit?.object.material.isMeshPhysicalMaterial,
        'Garnet must remain visible inside its recessed housing',
      )
    }
    const compass = marker.root.children.find((node) => node !== marker.pointer)
    marker.pointer.rotation.y = -Math.PI / 2
    assert.equal(compass.rotation.y, 0)
    const enamel = marker.pointer.children.find((node) => node.material.isMeshPhysicalMaterial)
    assert(enamel)
    assert.equal(
      enamel.material.clearcoat,
      0,
      'Avoid the white clearcoat flash on broad gem facets',
    )
    assert(enamel.material.specularIntensity <= 0.2 && enamel.material.roughness >= 0.4)
    const normals = enamel.geometry.getAttribute('normal')
    for (let i = 0; i < normals.count; i++) assert(normals.getY(i) > 0)
  } finally {
    marker.dispose()
  }
})
