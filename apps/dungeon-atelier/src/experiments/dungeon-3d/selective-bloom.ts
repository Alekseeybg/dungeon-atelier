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
      const restoreMaterials: (() => void)[] = [],
        auto = renderer.shadowMap.autoUpdate
      scene.traverse((node) => {
        if (!(node instanceof THREE.Mesh)) return
        const material = node.material as THREE.Material | THREE.Material[]
        restoreMaterials.push(() => {
          node.material = material
        })
        node.material = Array.isArray(material) ? material.map(source) : source(material)
      })
      renderer.shadowMap.autoUpdate = false
      try {
        composer.render(0)
      } finally {
        renderer.shadowMap.autoUpdate = auto
        restoreMaterials.forEach((restore) => restore())
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
