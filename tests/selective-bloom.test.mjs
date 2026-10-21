import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { createSelectiveBloom } from '../apps/dungeon-atelier/src/experiments/dungeon-3d/selective-bloom.ts'

function fixture() {
  const scene = new THREE.Scene(),
    fire = new THREE.ShaderMaterial({
      uniforms: { flameClock: { value: 0 } },
      fragmentShader: 'void main(){gl_FragColor=vec4(color,1.);}',
    }),
    renderer = {
      shadowMap: { autoUpdate: true, needsUpdate: true },
      autoClear: true,
      target: null,
      getPixelRatio: () => 1,
      getSize: (size) => size.set(8, 8),
      getRenderTarget() {
        return this.target
      },
      setRenderTarget(target) {
        this.target = target
      },
      getClearColor: (color) => color.set(0),
      getClearAlpha: () => 1,
      setClearAlpha() {},
      setClearColor() {},
      clear() {},
      inspect() {},
      render(object) {
        if (object === scene) this.inspect()
      },
    },
    bloom = createSelectiveBloom(renderer, scene, new THREE.PerspectiveCamera(), fire)
  bloom.resize(16, 16)
  return { scene, renderer, bloom, fire }
}

test('bloom reuses array bookkeeping while tracking live materials, emission and scene changes', () => {
  const { scene, renderer, bloom, fire } = fixture(),
    stone = new THREE.MeshStandardMaterial(),
    coal = new THREE.MeshStandardMaterial({ emissive: '#ff4400', emissiveIntensity: 2 }),
    mesh = new THREE.Mesh(new THREE.BoxGeometry(), [stone, coal, fire])
  scene.add(mesh)
  let replacement
  renderer.inspect = () => {
    replacement = mesh.material
    assert.notEqual(replacement, original)
    assert.equal(replacement[0].color.getHex(), 0)
    assert.ok(replacement[1].color.equals(coal.emissive.clone().multiplyScalar(6)))
    assert.equal(replacement[2].uniforms.flameClock, fire.uniforms.flameClock)
  }
  const original = mesh.material
  try {
    bloom.render()
    assert.equal(mesh.material, original)
    const firstReplacement = replacement
    coal.emissive.set('#aa1100')
    bloom.render()
    assert.equal(replacement, firstReplacement)
    assert.equal(mesh.material, original)

    // Mutating a material array and changing its length must not leave stale entries.
    original.splice(0, original.length, fire)
    renderer.inspect = () => {
      assert.equal(mesh.material.length, 1)
      assert.equal(mesh.material[0].uniforms.flameClock, fire.uniforms.flameClock)
    }
    bloom.render()
    assert.equal(mesh.material, original)

    scene.remove(mesh)
    const rebuilt = new THREE.Mesh(mesh.geometry, stone)
    scene.add(rebuilt)
    renderer.inspect = () => assert.notEqual(rebuilt.material, stone)
    bloom.render()
    assert.equal(rebuilt.material, stone)
    assert.equal(mesh.material, original)
  } finally {
    bloom.dispose()
    mesh.geometry.dispose()
    stone.dispose()
    coal.dispose()
    fire.dispose()
  }
})

test('bloom restores materials and shadow flags after a render error and can render again', () => {
  const { scene, renderer, bloom, fire } = fixture(),
    material = new THREE.MeshStandardMaterial(),
    mesh = new THREE.Mesh(new THREE.BoxGeometry(), material)
  scene.add(mesh)
  try {
    renderer.inspect = () => {
      assert.equal(renderer.shadowMap.autoUpdate, false)
      assert.equal(renderer.shadowMap.needsUpdate, false)
      throw new Error('render failure')
    }
    assert.throws(() => bloom.render(), /render failure/)
    assert.equal(mesh.material, material)
    assert.equal(renderer.shadowMap.autoUpdate, true)
    assert.equal(renderer.shadowMap.needsUpdate, true)
    renderer.inspect = () => {}
    bloom.render()
    assert.equal(mesh.material, material)
  } finally {
    bloom.dispose()
    mesh.geometry.dispose()
    material.dispose()
    fire.dispose()
  }
})
