import * as THREE from 'three'
import { heightNormals } from './normal-map'
import type { DungeonEffects } from './effects-settings'

/** Optional derived maps are cached by source texture and never overwrite approved images. */
export function createEffectsMaterials(wood: ReadonlySet<THREE.Material>) {
  const originals = new Map<
      THREE.MeshStandardMaterial,
      {
        color: THREE.Color
        normalMap: THREE.Texture | null
        normalScale: THREE.Vector2
        roughness: number
        roughnessMap: THREE.Texture | null
      }
    >(),
    derived = new Map<THREE.Texture, THREE.DataTexture>(),
    roughMaps = new Map<THREE.Texture, THREE.CanvasTexture>()
  const edgeUniform = { value: 1 }
  function normal(source: THREE.Texture) {
    let found = derived.get(source)
    if (found) return found
    const image = source.image as HTMLCanvasElement | HTMLImageElement
    if (!image?.width || !image.height) return null
    const canvas = document.createElement('canvas')
    canvas.width = image.width
    canvas.height = image.height
    const c = canvas.getContext('2d')!
    c.drawImage(image, 0, 0)
    found = new THREE.DataTexture(
      heightNormals(
        c.getImageData(0, 0, image.width, image.height).data,
        image.width,
        image.height,
      ),
      image.width,
      image.height,
    )
    found.flipY = source.flipY
    found.wrapS = source.wrapS
    found.wrapT = source.wrapT
    found.repeat.copy(source.repeat)
    found.offset.copy(source.offset)
    found.minFilter = THREE.LinearMipmapLinearFilter
    found.magFilter = THREE.LinearFilter
    found.generateMipmaps = true
    found.anisotropy = source.anisotropy
    found.needsUpdate = true
    found.name = 'Effects normal from ' + source.uuid
    derived.set(source, found)
    return found
  }
  function rough(source: THREE.Texture) {
    let map = roughMaps.get(source)
    if (map) return map
    const image = source.image as HTMLCanvasElement | HTMLImageElement
    if (!image?.width || !image.height) return null
    const c = document.createElement('canvas')
    c.width = image.width
    c.height = image.height
    const ctx = c.getContext('2d')!
    ctx.drawImage(image, 0, 0)
    const data = ctx.getImageData(0, 0, image.width, image.height)
    for (let i = 0; i < data.data.length; i += 4) {
      const height =
        data.data[i]! * 0.2126 + data.data[i + 1]! * 0.7152 + data.data[i + 2]! * 0.0722
      const value = 185 + (255 - height) * 0.2
      data.data[i] = data.data[i + 1] = data.data[i + 2] = value
      data.data[i + 3] = 255
    }
    ctx.putImageData(data, 0, 0)
    map = new THREE.CanvasTexture(c)
    map.wrapS = source.wrapS
    map.wrapT = source.wrapT
    map.anisotropy = source.anisotropy
    roughMaps.set(source, map)
    return map
  }
  return {
    apply(
      root: THREE.Object3D,
      settings: DungeonEffects,
      mortar: THREE.Material,
      matteCap?: THREE.Material,
    ) {
      edgeUniform.value = settings.edgeResponse
      root.traverse((node) => {
        if (!(node instanceof THREE.Mesh)) return
        const material = node.material as THREE.Material | THREE.Material[]
        for (const m of Array.isArray(material) ? material : [material]) {
          if (!(m instanceof THREE.MeshStandardMaterial)) continue
          if (!originals.has(m)) {
            originals.set(m, {
              color: m.color.clone(),
              normalMap: m.normalMap,
              normalScale: m.normalScale.clone(),
              roughness: m.roughness,
              roughnessMap: m.roughnessMap,
            })
            const compile = m.onBeforeCompile.bind(m),
              key = m.customProgramCacheKey.bind(m)
            const originalKey = key(),
              matteCapEdge = m === matteCap
            m.onBeforeCompile = (shader, renderer) => {
              compile(shader, renderer)
              shader.uniforms.effectEdgeResponse = edgeUniform
              shader.vertexShader = shader.vertexShader
                .replace('#include <common>', '#include <common>\nvarying vec3 effectFaceNormal;')
                .replace(
                  '#include <fog_vertex>',
                  '#include <fog_vertex>\neffectFaceNormal=normalize(mat3(modelMatrix)*objectNormal);',
                )
              shader.fragmentShader = shader.fragmentShader
                .replace(
                  '#include <common>',
                  '#include <common>\nvarying vec3 effectFaceNormal;uniform float effectEdgeResponse;',
                )
                .replace(
                  '#include <roughnessmap_fragment>',
                  `#include <roughnessmap_fragment>
              if(abs(effectEdgeResponse-1.)>.001){vec3 en=abs(normalize(effectFaceNormal));float bevel=1.-smoothstep(.86,.99,max(en.x,max(en.y,en.z)));float unpolished=roughnessFactor;roughnessFactor=clamp(roughnessFactor*(1.-(effectEdgeResponse-1.)*.7*bevel),.0525,1.);
              ${matteCapEdge ? 'roughnessFactor=max(roughnessFactor,min(unpolished,.8)*bevel);' : ''}}`,
                )
              // Theme-specific atlas/world UVs must also drive the derived normal map.
              shader.vertexShader = shader.vertexShader.replace(
                '#include <fog_vertex>',
                '#include <fog_vertex>\n#if defined(USE_NORMALMAP) && defined(USE_BUMPMAP)\nvNormalMapUv=vBumpMapUv;\n#endif',
              )
            }
            // Keep cap and wall programs separate: only the cap retains a matte chamfer.
            m.customProgramCacheKey = () =>
              originalKey + ':effects-normal-v1' + (matteCapEdge ? ':matte-cap-edge-v1' : '')
          }
          const original = originals.get(m)!,
            map = settings.normals && m.bumpMap ? normal(m.bumpMap) : original.normalMap
          if (m.normalMap !== map) {
            m.normalMap = map
            m.needsUpdate = true
          }
          if (settings.normals && map) m.normalScale.setScalar(settings.normalStrength)
          else m.normalScale.copy(original.normalScale)
          m.color.copy(original.color)
          if (m === mortar) m.color.multiplyScalar(1 - settings.cavity * 0.55)
          const role = m.metalness > 0.1 ? 'iron' : wood.has(m) ? 'wood' : m.map ? 'stone' : 'matte'
          const tuned = settings.roughness && role !== 'matte'
          m.roughness = tuned
            ? role === 'iron'
              ? settings.ironRoughness
              : role === 'wood'
                ? settings.woodRoughness
                : settings.stoneRoughness
            : original.roughness
          const roughnessMap = tuned
            ? (original.roughnessMap ??
              ((role === 'iron' || role === 'wood') && (m.bumpMap ?? m.map)
                ? rough((m.bumpMap ?? m.map)!)
                : null))
            : original.roughnessMap
          if (m.roughnessMap !== roughnessMap) {
            m.roughnessMap = roughnessMap
            m.needsUpdate = true
          }
        }
      })
    },
    proof() {
      return {
        derivedNormalMaps: derived.size,
        derivedRoughnessMaps: roughMaps.size,
        materials: [...originals.keys()]
          .filter((m) => m.normalMap || m.roughnessMap)
          .map((m) => ({
            name: m.name,
            normal: m.normalMap?.uuid ?? null,
            strength: m.normalScale.x,
            roughness: m.roughness,
          })),
      }
    },
    dispose() {
      derived.forEach((t) => t.dispose())
      roughMaps.forEach((t) => t.dispose())
      roughMaps.clear()
      derived.clear()
      originals.clear()
    },
  }
}
