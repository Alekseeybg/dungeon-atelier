import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'

/** Half-resolution emissive-only bloom. Black architecture retains depth occlusion. */
export function createSelectiveBloom(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  fire: THREE.ShaderMaterial,
) {
  const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType }),
    composer = new EffectComposer(renderer, target),
    beauty = new RenderPass(scene, camera),
    bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.3, 0.25, 0.08),
    black = new THREE.MeshBasicMaterial({ color: 0, side: THREE.DoubleSide }),
    flame = fire.clone(),
    emissive = new Map<THREE.MeshStandardMaterial, THREE.MeshBasicMaterial>()
  flame.uniforms.flameClock = fire.uniforms.flameClock!
  flame.fragmentShader = flame.fragmentShader.replace(
    'gl_FragColor=vec4(color,',
    'gl_FragColor=vec4(color*3.0,',
  )
  composer.renderToScreen = false
  // We consume the separate glow texture, never the bloom pass's additive
  // write-back into its input buffer. Keep all extraction/blur/composite steps.
  bloom.blendMaterial.visible = false
  beauty.clearColor = new THREE.Color(0)
  beauty.clearAlpha = 0
  composer.addPass(beauty)
  composer.addPass(bloom)
  function source(material: THREE.Material) {
    if (material === fire) return flame
    if (
      material instanceof THREE.MeshStandardMaterial &&
      material.emissiveIntensity > 0 &&
      material.emissive.getHex() !== 0
    ) {
      let found = emissive.get(material)
      if (!found) {
        // Bloom represents emitted radiance only. A lit StandardMaterial can also
        // reflect point lights, producing view-dependent hotspots in the glow.
        found = new THREE.MeshBasicMaterial({
          side: material.side,
          toneMapped: false,
        })
        emissive.set(material, found)
      }
      // Read current emission each frame; never cache experimental roughness,
      // normals or lighting in the bloom source when sliders are changed.
      found.color.copy(material.emissive).multiplyScalar(material.emissiveIntensity * 3)
      if (found.map !== material.emissiveMap) {
        found.map = material.emissiveMap
        found.needsUpdate = true
      }
      return found
    }
    return black
  }
  type BloomMesh = THREE.Mesh<THREE.BufferGeometry, THREE.Material | THREE.Material[]>
  interface MaterialSwap {
    mesh: BloomMesh
    original: THREE.Material | THREE.Material[]
    replacement: THREE.Material | THREE.Material[]
  }
  const cachedSwaps = new WeakMap<BloomMesh, MaterialSwap>(),
    swaps: MaterialSwap[] = []
  function swapMaterial(node: THREE.Object3D) {
    if (!(node instanceof THREE.Mesh)) return
    const mesh = node as BloomMesh,
      original = mesh.material
    let swap = cachedSwaps.get(mesh)
    if (!swap) {
      swap = { mesh, original, replacement: black }
      cachedSwaps.set(mesh, swap)
    }
    swap.original = original
    if (Array.isArray(original)) {
      if (!Array.isArray(swap.replacement)) swap.replacement = []
      swap.replacement.length = original.length
      for (let i = 0; i < original.length; i++) swap.replacement[i] = source(original[i]!)
    } else {
      swap.replacement = source(original)
    }
    mesh.material = swap.replacement
    swaps.push(swap)
  }
  return {
    get texture() {
      return bloom.renderTargetsHorizontal[0]!.texture
    },
    configure(strength: number, radius: number, threshold: number) {
      bloom.strength = strength
      bloom.radius = radius
      bloom.threshold = threshold
    },
    resize(width: number, height: number) {
      composer.setSize(Math.max(1, Math.ceil(width / 2)), Math.max(1, Math.ceil(height / 2)))
    },
    render() {
      const auto = renderer.shadowMap.autoUpdate,
        needsUpdate = renderer.shadowMap.needsUpdate
      try {
        // Reuse bookkeeping while discovering current meshes/materials, including
        // theme switches and rebuilt architecture. Read live emission in source().
        scene.traverse(swapMaterial)
        renderer.shadowMap.autoUpdate = false
        renderer.shadowMap.needsUpdate = false
        composer.render(0)
      } finally {
        renderer.shadowMap.autoUpdate = auto
        renderer.shadowMap.needsUpdate = needsUpdate
        for (const swap of swaps) swap.mesh.material = swap.original
        swaps.length = 0
      }
    },
    dispose() {
      beauty.dispose()
      bloom.dispose()
      composer.dispose()
      black.dispose()
      flame.dispose()
      emissive.forEach((m) => m.dispose())
    },
  }
}
