import * as THREE from 'three'
import { floorStudy } from '../../features/dungeon/rendering/visual-foundation/art'
import faceUrl from '../../assets/visual-foundation/ruins-face-v2.png'
import capUrl from '../../assets/visual-foundation/ruins-cap-v2.png'
import { createWallWeathering } from './wall-weathering'
import type { Dungeon3DPlan } from './plan'
import { ruinsAtlasCrop } from './ruins-atlas'
import type { Dungeon3DMaterials } from './materials'
import { DEFAULT_3D_THEME, type Dungeon3DTheme } from './themes'
import { createMaterialThemeBinding } from './theme-binding'
import { ruinsRuleAtlas } from './ruins-rule-atlas'

/** Independent surfaces; the preserved limestone factory and its materials are never edited. */
export async function createDungeon3DThemeMaterials(
  restored: Dungeon3DMaterials,
  plan: Dungeon3DPlan,
) {
  const seed = plan.floor.seed,
    textures = new Set<THREE.Texture>(),
    owned = new Set<THREE.MeshStandardMaterial>(),
    ancient = new Map<THREE.Material, THREE.Material>(),
    weather = createWallWeathering(`${seed}:ancient-ruins`)
  textures.add(weather.cracks)
  let active: Dungeon3DTheme = DEFAULT_3D_THEME
  function texture(canvas: HTMLCanvasElement, color = false) {
    const t = new THREE.CanvasTexture(canvas)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace
    t.anisotropy = 4
    textures.add(t)
    return t
  }
  async function image(url: string) {
    const source = new Image()
    source.src = url
    await source.decode()
    return source
  }
  function physicalMaps(source: HTMLCanvasElement) {
    const canvas = document.createElement('canvas')
    canvas.width = source.width
    canvas.height = source.height
    canvas.getContext('2d')!.drawImage(source, 0, 0)
    const c = canvas.getContext('2d')!,
      pixels = c.getImageData(0, 0, canvas.width, canvas.height),
      height = document.createElement('canvas'),
      rough = document.createElement('canvas')
    height.width = rough.width = canvas.width
    height.height = rough.height = canvas.height
    const h = height.getContext('2d')!.createImageData(canvas.width, canvas.height),
      r = rough.getContext('2d')!.createImageData(canvas.width, canvas.height)
    for (let i = 0; i < pixels.data.length; i += 4) {
      const value =
          pixels.data[i]! * 0.2126 + pixels.data[i + 1]! * 0.7152 + pixels.data[i + 2]! * 0.0722,
        relief = Math.max(0, Math.min(255, (value - 25) * 2.2))
      for (let k = 0; k < 3; k++) {
        h.data[i + k] = relief
        r.data[i + k] = 219 + (255 - relief) * 0.12
      }
      h.data[i + 3] = r.data[i + 3] = 255
      // Retain source fractures and mineral values, tempering the warm photographic cast.
      for (let channel = 0; channel < 3; channel++)
        pixels.data[i + channel] =
          value + (pixels.data[i + channel]! - value) * 0.45 + [1, 2, 3][channel]!
    }
    height.getContext('2d')!.putImageData(h, 0, 0)
    rough.getContext('2d')!.putImageData(r, 0, 0)
    c.putImageData(pixels, 0, 0)
    return { map: texture(canvas, true), bumpMap: texture(height), roughnessMap: texture(rough) }
  }
  function material(
    source: THREE.Material,
    canvas: HTMLCanvasElement,
    bump: number,
    tint = '#ffffff',
    worldScale?: number,
    rules = false,
  ) {
    const m = new THREE.MeshStandardMaterial({
      ...physicalMaps(canvas),
      color: tint,
      bumpScale: bump,
      roughness: 1,
      vertexColors: true,
    })
    weather.apply(m, worldScale ? 0.52 : 0.95)
    if (rules) {
      const compile = m.onBeforeCompile.bind(m)
      m.onBeforeCompile = (shader, renderer) => {
        compile(shader, renderer)
        shader.vertexShader = shader.vertexShader
          .replace(
            '#include <common>',
            '#include <common>\nattribute vec2 ruinsUv;attribute float ruinsRule;attribute float ruinsTone;varying float ruleMask;',
          )
          .replace(
            '#include <uv_vertex>',
            `#include <uv_vertex>
            ruleMask=ruinsRule;
            vec2 ruleUV=mix(vec2(vMapUv.x*.4,vMapUv.y),ruinsUv,ruinsRule);
            vMapUv=ruleUV;vBumpMapUv=ruleUV;vRoughnessMapUv=ruleUV;`,
          )
          .replace(
            '#include <color_vertex>',
            '#include <color_vertex>\nvColor.rgb=mix(vColor.rgb,vec3(ruinsTone),ruinsRule);',
          )
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', '#include <common>\nvarying float ruleMask;')
          .replace(
            'diffuseColor.rgb*=1.0-crack*.63*wallWearStrength;',
            'diffuseColor.rgb*=1.0-crack*.63*wallWearStrength*(1.0-ruleMask);',
          )
      }
      m.customProgramCacheKey = () => 'ruins-run-placement-v1'
    }
    if (worldScale) {
      const wear = m.onBeforeCompile.bind(m)
      m.onBeforeCompile = (shader, renderer) => {
        wear.call(m, shader, renderer)
        shader.vertexShader = shader.vertexShader.replace(
          '#include <worldpos_vertex>',
          `#include <worldpos_vertex>
          vec2 ruinsFloorUV=(modelMatrix*vec4(transformed,1.0)).xz/${worldScale.toFixed(4)};
          vMapUv=ruinsFloorUV; vBumpMapUv=ruinsFloorUV; vRoughnessMapUv=ruinsFloorUV;`,
        )
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <normal_fragment_begin>',
          '#include <normal_fragment_begin>\nnormal=normalize(mat3(viewMatrix)*vec3(0.0,1.0,0.0));',
        )
      }
      m.customProgramCacheKey = () => `ruins-floor-world-v1:${worldScale}`
    }
    const slot =
      [...restored.floors].find(([, value]) => value === source)?.[0] ??
      Object.entries({
        masonry: restored.masonry,
        cap: restored.cap,
        trim: restored.trim,
        frame: restored.frame,
        stairEdge: restored.stairEdge,
        step: restored.step,
        bed: restored.grout,
      }).find(([, value]) => value === source)?.[0] ??
      'stone'
    m.name = `Ancient Ruins: ${slot}`
    m.userData.worldScale = worldScale ?? null
    owned.add(m)
    ancient.set(source, m)
    return m
  }
  const floorCanvases = new Map<string, HTMLCanvasElement>()
  try {
    for (const [kind, base] of restored.floors) {
      const source = await image(floorStudy(kind).url),
        canvas = document.createElement('canvas')
      canvas.width = canvas.height = 1024
      canvas.getContext('2d')!.drawImage(source, 0, 0, 1024, 1024)
      floorCanvases.set(kind, canvas)
      material(
        base,
        canvas,
        0.0045,
        '#e4e4dd',
        kind === 'study-broad' ? 8 : kind === 'study-weathered' ? 5.4 : 6.8,
      )
    }
    const [face, cap] = await Promise.all([image(faceUrl), image(capUrl)])
    function atlas(source: HTMLImageElement, coping: boolean) {
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = 512
      const c = canvas.getContext('2d')!
      for (let i = 0; i < 16; i++) {
        const crop = ruinsAtlasCrop(seed, i, coping)
        c.drawImage(
          source,
          crop.x * source.width,
          crop.y * source.height,
          crop.width * source.width,
          crop.height * source.height,
          (i % 4) * 128,
          Math.floor(i / 4) * 128,
          128,
          128,
        )
        c.fillStyle = `rgba(15,22,17,${crop.patina})`
        c.fillRect((i % 4) * 128, Math.floor(i / 4) * 128, 128, 128)
      }
      return canvas
    }
    const body = atlas(face, false),
      coping = atlas(cap, true)
    material(
      restored.masonry,
      ruinsRuleAtlas(face, body, seed, false),
      0.003,
      '#dadcd9',
      undefined,
      true,
    )
    material(
      restored.cap,
      ruinsRuleAtlas(cap, coping, seed, true),
      0.003,
      '#dddeda',
      undefined,
      true,
    )
    material(restored.trim, coping, 0.003, '#d1d3cb')
    material(
      restored.frame,
      ruinsRuleAtlas(face, coping, seed, false),
      0.0035,
      '#dadcd9',
      undefined,
      true,
    )
    material(
      restored.stairEdge,
      ruinsRuleAtlas(face, body, seed, false),
      0.0025,
      '#b6b9b2',
      undefined,
      true,
    )
    material(restored.step, coping, 0.003, '#d5d5cd')
    // A continuous stone bed softens the old rectangular mesh seams. Irregular
    // joints and worn slab outlines come from the reference's full Ancient material.
    const broad = restored.floors.get('study-broad') ?? restored.floors.values().next().value
    if (broad) {
      const bed = material(
          restored.grout,
          floorCanvases.get('study-broad') ?? floorCanvases.values().next().value!,
          0.002,
          '#e4e4dd',
          8,
        ),
        pixels = new Uint8Array(plan.floor.width * plan.floor.height * 4)
      const kinds = ['study-broad', 'study-weathered', 'study-irregular'] as const
      for (const tile of plan.tiles)
        pixels[(tile.z * plan.floor.width + tile.x) * 4] =
          Math.max(0, kinds.indexOf(tile.material as (typeof kinds)[number])) * 100
      const regions = new THREE.DataTexture(pixels, plan.floor.width, plan.floor.height)
      regions.magFilter = regions.minFilter = THREE.NearestFilter
      regions.needsUpdate = true
      textures.add(regions)
      const maps = kinds.map(
          (kind) => ancient.get(restored.floors.get(kind) ?? broad) as THREE.MeshStandardMaterial,
        ),
        compile = bed.onBeforeCompile.bind(bed)
      bed.onBeforeCompile = (shader, renderer) => {
        compile(shader, renderer)
        shader.uniforms.ruinsRegions = { value: regions }
        shader.uniforms.ruinsRegionSize = {
          value: new THREE.Vector2(plan.floor.width, plan.floor.height),
        }
        maps.forEach((m, i) => {
          shader.uniforms[`ruinsFloor${i}`] = { value: m.map }
        })
        shader.fragmentShader = shader.fragmentShader
          .replace(
            '#include <common>',
            `#include <common>
          uniform sampler2D ruinsRegions;uniform vec2 ruinsRegionSize;
          uniform sampler2D ruinsFloor0;uniform sampler2D ruinsFloor1;uniform sampler2D ruinsFloor2;`,
          )
          .replace(
            '#include <map_fragment>',
            `float region=texture2D(ruinsRegions,(floor(wearPosition.xz)+.5)/ruinsRegionSize).r;
          vec4 stone=region<.2?texture2D(ruinsFloor0,wearPosition.xz/8.0):region<.6?texture2D(ruinsFloor1,wearPosition.xz/5.4):texture2D(ruinsFloor2,wearPosition.xz/6.8);
          diffuseColor*=stone;`,
          )
      }
      bed.customProgramCacheKey = () => 'ruins-continuous-bed-v1'
    }
    const mortar = new THREE.MeshStandardMaterial({ color: '#353a34', roughness: 1 })
    owned.add(mortar)
    ancient.set(restored.mortar, mortar)
  } catch (error) {
    owned.forEach((m) => m.dispose())
    textures.forEach((t) => t.dispose())
    throw error
  }
  const binding = createMaterialThemeBinding(new Map([['ancient-ruins', ancient]]))
  const resolve = (material: THREE.Material) => binding.resolve(material, active)
  return {
    resolve,
    apply(root: THREE.Object3D, theme: Dungeon3DTheme = active) {
      active = theme
      binding.apply(root, active)
    },
    get active() {
      return active
    },
    surfaceProof(legacy = false) {
      return [...owned]
        .filter((m) => m.map)
        .map((m) => ({
          slot: m.name,
          worldScale: m.userData.worldScale as number | null,
          maps: [m.map, m.bumpMap, m.roughnessMap].map((t) => {
            const canvas = t!.image as HTMLCanvasElement,
              bytes = canvas
                .getContext('2d')!
                .getImageData(
                  0,
                  0,
                  legacy && canvas.width === 1280 ? 512 : canvas.width,
                  canvas.height,
                ).data
            let hash = 2166136261
            for (const byte of bytes) hash = Math.imul(hash ^ byte, 16777619)
            return hash >>> 0
          }),
        }))
        .sort((a, b) => a.slot.localeCompare(b.slot))
    },
    get estimatedTextureBytes() {
      return [...textures].reduce((sum, t) => {
        const c = t.image as HTMLCanvasElement
        return sum + (c.width * c.height * 4 * 4) / 3
      }, 0)
    },
    setWireframe(value: boolean) {
      owned.forEach((m) => {
        m.wireframe = value
        m.needsUpdate = true
      })
    },
    invalidateShaders() {
      owned.forEach((m) => {
        m.needsUpdate = true
      })
    },
    dispose() {
      owned.forEach((m) => m.dispose())
      textures.forEach((t) => t.dispose())
    },
  }
}
