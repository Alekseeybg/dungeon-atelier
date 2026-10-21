import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import type { DungeonFloor } from '@dungeon-atelier/core'
import { BASE_WALL_HEIGHT, planDungeon3D } from './plan'
import { createDungeon3DMaterials } from './materials'
import { buildDungeon3D } from './scene'
import { createContactLighting } from './contact-lighting'
import { advanceFlameFrame, createEffectsTiming } from './effects-timing'
import { createEffectsMaterials } from './effects-materials'
import { BASELINE_EFFECTS, type DungeonEffects } from './effects-settings'
import { createStairInspection } from './stair-inspection'
import { stairPoint, stairLevels } from './stair-layout'
import { createDungeon3DThemeMaterials } from './theme-materials'
import { DUNGEON_3D_THEMES, type Dungeon3DTheme } from './themes'

export const DEFAULT_CAMERA = Object.freeze({ elevation: 68, rotation: 0, referenceAzimuth: 12 })
export const prototypeLifecycle = { activeViewports: 0 }
export interface PrototypeMetrics {
  meshes: number
  triangles: number
  calls: number
  textures: number
  geometries: number
  estimatedTextureMiB: number
  renderMs: number
  gpuMs: number | null
  renderedFps: number | null
  frameIntervalMs: number | null
  zoom: number
  wallHeight: number
  elevation: number
  rotation: number
}

export async function createDungeon3DViewport(
  host: HTMLElement,
  source: DungeonFloor,
  revealSecrets: boolean,
  onMetrics: (metrics: PrototypeMetrics) => void,
  onStairSelection?: (id: string | null) => void,
) {
  const plan = planDungeon3D(source, revealSecrets),
    materials = await createDungeon3DMaterials(
      plan.tiles.map((t) => t.material),
      plan.floor.seed,
    )
  let themeMaterials: Awaited<ReturnType<typeof createDungeon3DThemeMaterials>>
  try {
    themeMaterials = await createDungeon3DThemeMaterials(materials, plan)
  } catch (error) {
    materials.dispose()
    throw error
  }
  let renderer: THREE.WebGLRenderer
  try {
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true,
    })
  } catch (error) {
    themeMaterials.dispose()
    materials.dispose()
    throw error
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
  renderer.setClearColor('#080c0d')
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.15
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  // The casters and light rig are static during flame-only animation.
  renderer.shadowMap.autoUpdate = false
  renderer.shadowMap.needsUpdate = true
  renderer.domElement.setAttribute('aria-label', 'Experimental true 3D dungeon')
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none'
  host.appendChild(renderer.domElement)
  const scene = new THREE.Scene(),
    camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 600)
  let dungeon: ReturnType<typeof buildDungeon3D>
  try {
    dungeon = buildDungeon3D(plan, materials)
  } catch (error) {
    themeMaterials.dispose()
    materials.dispose()
    renderer.dispose()
    renderer.forceContextLoss()
    renderer.domElement.remove()
    throw error
  }
  const contactLighting = createContactLighting(renderer, scene, camera, materials.fire),
    materialEffects = createEffectsMaterials(
      new Set([materials.wood, materials.selectedDoor.oak, materials.selectedDoor.darkOak]),
    )
  let effectSettings: DungeonEffects = { ...BASELINE_EFFECTS }
  const timing = createEffectsTiming(renderer),
    frameTimes: number[] = []
  let lastRenderMs = 0,
    lastMetricsAt = -Infinity,
    metricsDirty = true,
    contextLost = false,
    sceneMeshes = 0
  const sourceTextureMiB =
    (materials.estimatedTextureBytes + themeMaterials.estimatedTextureBytes) / 1048576
  function countMeshes() {
    sceneMeshes = 0
    dungeon.root.traverse((node) => {
      if (node instanceof THREE.Mesh) sceneMeshes++
    })
  }
  countMeshes()
  renderer.info.autoReset = false
  let contactOcclusion = true,
    wireframe = false,
    doorsOpen = false,
    doorHeadCutaway = false
  const controls = new OrbitControls(camera, renderer.domElement),
    ambient = new THREE.HemisphereLight('#d5dcdf', '#858b8b', 1.9),
    sun = new THREE.DirectionalLight('#fff1d7', 3),
    fill = new THREE.DirectionalLight('#d5dfe5', 1.2),
    center = dungeon.bounds.getCenter(new THREE.Vector3())
  sun.position.set(center.x - 12, 30, center.z - 10)
  sun.target.position.copy(center)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  const span = Math.max(plan.floor.width, plan.floor.height) * 0.8
  Object.assign(sun.shadow.camera, {
    left: -span,
    right: span,
    top: span,
    bottom: -span,
    near: 0.1,
    far: 100,
  })
  sun.shadow.bias = -0.00035
  sun.shadow.normalBias = 0.025
  fill.position.set(center.x + 10, 7, center.z + 10)
  fill.target.position.copy(center)
  scene.add(dungeon.root, ambient, sun, sun.target, fill, fill.target)
  controls.enableRotate = false
  controls.enableDamping = false
  controls.screenSpacePanning = false
  controls.mouseButtons.LEFT = THREE.MOUSE.PAN
  controls.mouseButtons.MIDDLE = undefined
  controls.mouseButtons.RIGHT = undefined
  controls.minZoom = 0.5
  controls.maxZoom = 9
  // A tiny pole epsilon preserves the view's right vector at the displayed 90° limit.
  controls.minPolarAngle = 0.000001
  controls.maxPolarAngle = THREE.MathUtils.degToRad(65)
  let elevation: number = DEFAULT_CAMERA.elevation,
    rotation = 0,
    dirty = true,
    disposed = false,
    fittedSpan = 20,
    fittedWidth = 0,
    torchLighting = true,
    flameAnimation = !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    lastFlameFrame = -Infinity
  function invalidateShadows() {
    renderer.shadowMap.needsUpdate = true
  }
  function invalidateOcclusion() {
    contactLighting.invalidate()
  }
  function applyTheme(theme: Dungeon3DTheme = themeMaterials.active) {
    if (theme !== themeMaterials.active) {
      invalidateOcclusion()
      invalidateShadows()
    }
    dungeon.setTheme(theme)
    themeMaterials.apply(dungeon.root, theme)
    materialEffects.apply(
      dungeon.root,
      effectSettings,
      themeMaterials.resolve(materials.mortar),
      theme === 'ancient-ruins' ? themeMaterials.resolve(materials.cap) : undefined,
    )
    const lighting = DUNGEON_3D_THEMES[theme].lighting
    ambient.intensity = lighting.ambient * effectSettings.ambientLight
    sun.intensity = lighting.sun * effectSettings.keyLight
    sun.shadow.intensity = effectSettings.shadowIntensity
    sun.shadow.radius = effectSettings.shadowSoftness
    fill.intensity = lighting.fill
    renderer.toneMapping =
      effectSettings.toneMapping === 'neutral'
        ? THREE.NeutralToneMapping
        : effectSettings.toneMapping === 'linear'
          ? THREE.LinearToneMapping
          : THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = lighting.exposure * effectSettings.exposure
    const torchBudget = effectSettings.torchShadows
      ? Math.min(3, effectSettings.torchBudget)
      : effectSettings.torchBudget
    dungeon.setTorchLightBudget(torchBudget)
    dungeon.torchLights.forEach((light, index) => {
      light.castShadow =
        effectSettings.torchShadows &&
        index < torchBudget &&
        torchLighting &&
        renderer.shadowMap.enabled
      light.shadow.camera.near = 0.05
      light.shadow.bias = -0.0003
      light.shadow.normalBias = 0.008
      light.shadow.radius = effectSettings.shadowSoftness
      light.shadow.intensity = effectSettings.shadowIntensity
      light.intensity = lighting.torch * effectSettings.torchIntensity
      light.castShadow = light.castShadow && light.intensity > 0
      light.color.set(
        effectSettings.torchTint === 'baseline'
          ? theme === 'ancient-ruins'
            ? '#ffb064'
            : '#ffa23e'
          : ({ amber: '#ffb064', orange: '#ff8d38', pale: '#ffd6a2' } as const)[
              effectSettings.torchTint
            ],
      )
      light.distance = (theme === 'ancient-ruins' ? 7.5 : 6) * effectSettings.torchRange
      light.decay = effectSettings.torchDecay
    })
    metricsDirty = true
    dirty = true
  }
  function positionCamera() {
    metricsDirty = true
    invalidateOcclusion()
    const polar = THREE.MathUtils.degToRad(90 - elevation),
      azimuth = THREE.MathUtils.degToRad(DEFAULT_CAMERA.referenceAzimuth + rotation),
      distance = Math.max(plan.floor.width, plan.floor.height) * 2 + 20
    camera.position
      .copy(controls.target)
      .add(new THREE.Vector3().setFromSphericalCoords(distance, polar, azimuth))
    camera.lookAt(controls.target)
    controls.update()
    inspection.invalidatePick()
    dirty = true
  }
  function resize() {
    metricsDirty = true
    invalidateOcclusion()
    const width = Math.max(1, host.clientWidth),
      height = Math.max(1, host.clientHeight),
      aspect = width / height
    renderer.setSize(width, height, false)
    contactLighting.resize(width, height)
    const span = Math.max(fittedSpan, fittedWidth / aspect)
    camera.left = (-span * aspect) / 2
    camera.right = -camera.left
    camera.top = span / 2
    camera.bottom = -camera.top
    camera.updateProjectionMatrix()
    inspection.invalidatePick()
    dirty = true
  }
  function fit() {
    controls.target.copy(dungeon.bounds.getCenter(new THREE.Vector3())).setY(0)
    camera.zoom = 1
    positionCamera()
    camera.updateMatrixWorld()
    const bounds = dungeon.bounds,
      points: THREE.Vector3[] = []
    for (const x of [bounds.min.x, bounds.max.x])
      for (const y of [bounds.min.y, bounds.max.y])
        for (const z of [bounds.min.z, bounds.max.z])
          points.push(new THREE.Vector3(x, y, z).applyMatrix4(camera.matrixWorldInverse))
    const projected = new THREE.Box3().setFromPoints(points),
      size = projected.getSize(new THREE.Vector3())
    fittedSpan = size.y * 1.16
    fittedWidth = size.x * 1.16
    resize()
    controls.saveState()
  }
  function getMetrics(renderMs = lastRenderMs): PrototypeMetrics {
    return {
      meshes: sceneMeshes,
      triangles: renderer.info.render.triangles,
      calls: renderer.info.render.calls,
      textures: renderer.info.memory.textures,
      geometries: renderer.info.memory.geometries,
      estimatedTextureMiB: sourceTextureMiB,
      renderMs,
      gpuMs: timing.gpuMs,
      renderedFps:
        frameTimes.length >= 8
          ? ((frameTimes.length - 1) * 1000) / (frameTimes[frameTimes.length - 1]! - frameTimes[0]!)
          : null,
      frameIntervalMs:
        frameTimes.length >= 8
          ? (frameTimes[frameTimes.length - 1]! - frameTimes[0]!) / (frameTimes.length - 1)
          : null,
      zoom: camera.zoom,
      wallHeight: dungeon.height,
      elevation: Math.round(elevation * 100) / 100,
      rotation: Math.round(rotation * 100) / 100,
    }
  }
  function render() {
    if (disposed || contextLost) return
    const start = performance.now(),
      query = timing.begin()
    frameTimes.push(start)
    while (frameTimes.length && frameTimes[0]! < start - 1000) frameTimes.shift()
    renderer.info.reset()
    const ao =
      effectSettings.aoMode === 'baseline'
        ? contactOcclusion && themeMaterials.active === 'ancient-ruins'
        : effectSettings.aoMode === 'on'
    if ((ao || effectSettings.aoOnly || effectSettings.bloom || effectSettings.grade) && !wireframe)
      contactLighting.render(ao || effectSettings.aoOnly)
    else renderer.render(scene, camera)
    timing.end(query)
    inspection.update()
    dirty = false
    lastRenderMs = performance.now() - start
    // Camera controls remain immediate; diagnostic counters need not rerender
    // the surrounding Vue page on every flame frame.
    if (metricsDirty || start - lastMetricsAt >= 250) {
      lastMetricsAt = start
      metricsDirty = false
      onMetrics(getMetrics(lastRenderMs))
    }
  }
  const changed = () => {
    metricsDirty = true
    if (dungeon.updateTorchLights(controls.target)) invalidateShadows()
    invalidateOcclusion()
    inspection.invalidatePick()
    dirty = true
  }
  controls.addEventListener('change', changed)
  // OrbitControls owns ground-plane pan, wheel zoom and touch. Only the two
  // deliberately separated mouse rotation axes need a small pointer adapter.
  const canvas = renderer.domElement
  function onContextLost(event: Event) {
    event.preventDefault()
    contextLost = true
    timing.reset()
  }
  function onContextRestored() {
    if (disposed) return
    contextLost = false
    timing.reset()
    invalidateOcclusion()
    invalidateShadows()
    metricsDirty = true
    dirty = true
  }
  canvas.addEventListener('webglcontextlost', onContextLost)
  canvas.addEventListener('webglcontextrestored', onContextRestored)
  const inspection = createStairInspection(
    host,
    canvas,
    camera,
    dungeon.root,
    () => dungeon.staircaseProof,
    () => dungeon.height,
    () => {
      dirty = true
    },
    onStairSelection,
  )
  let drag: { pointer: number; button: number; x: number; y: number } | undefined
  function pointerDown(event: PointerEvent) {
    if (drag) {
      event.preventDefault()
      event.stopImmediatePropagation()
      return
    }
    const altRotate = event.button === 0 && event.altKey
    if (event.pointerType !== 'mouse' || (!altRotate && event.button !== 1 && event.button !== 2))
      return
    event.preventDefault()
    event.stopImmediatePropagation()
    if (event.buttons !== (altRotate ? 1 : event.button === 1 ? 4 : 2)) return
    drag = {
      pointer: event.pointerId,
      button: altRotate ? 2 : event.button,
      x: event.clientX,
      y: event.clientY,
    }
    canvas.setPointerCapture(event.pointerId)
  }
  function pointerMove(event: PointerEvent) {
    if (!drag || event.pointerId !== drag.pointer) return
    const dx = event.clientX - drag.x,
      dy = event.clientY - drag.y
    drag.x = event.clientX
    drag.y = event.clientY
    event.preventDefault()
    if (drag.button === 1) elevation = THREE.MathUtils.clamp(elevation + dy * 0.25, 25, 90)
    else rotation = THREE.MathUtils.euclideanModulo(rotation - dx * 0.25 + 180, 360) - 180
    positionCamera()
  }
  function endDrag(event?: PointerEvent) {
    if (!drag || (event && event.pointerId !== drag.pointer)) return
    const pointer = drag.pointer
    drag = undefined
    if (canvas.hasPointerCapture(pointer)) canvas.releasePointerCapture(pointer)
  }
  const preventAuxiliary = (event: Event) => event.preventDefault()
  canvas.addEventListener('pointerdown', pointerDown, true)
  canvas.addEventListener('pointermove', pointerMove)
  canvas.addEventListener('pointerup', endDrag)
  canvas.addEventListener('pointercancel', endDrag)
  canvas.addEventListener('lostpointercapture', endDrag)
  canvas.addEventListener('auxclick', preventAuxiliary)
  window.addEventListener('blur', endDragOnBlur)
  function endDragOnBlur() {
    endDrag()
  }
  const observer = new ResizeObserver(resize)
  observer.observe(host)
  // Synchronize geometry visibility, materials and lighting before the first
  // frame can populate caches, including when used without the Vue playground.
  applyTheme()
  fit()
  prototypeLifecycle.activeViewports++
  renderer.setAnimationLoop((time) => {
    if (document.hidden || contextLost) return
    const flameFrame = flameAnimation ? advanceFlameFrame(time, lastFlameFrame) : null
    if (flameFrame !== null) {
      materials.flameClock.value = time / 1000
      lastFlameFrame = flameFrame
      dirty = true
    }
    if (dirty) render()
  })
  return {
    plan,
    camera,
    renderer,
    dungeon,
    setTheme: applyTheme,
    setEffects(value: DungeonEffects) {
      if (
        value.torchShadows !== effectSettings.torchShadows ||
        value.torchBudget !== effectSettings.torchBudget ||
        value.torchRange !== effectSettings.torchRange ||
        value.torchIntensity > 0 !== effectSettings.torchIntensity > 0
      )
        invalidateShadows()
      effectSettings = { ...value }
      contactLighting.configure(value.aoIntensity, value.aoRadius, value.aoOnly)
      contactLighting.configureBloom(value)
      applyTheme()
      dirty = true
    },
    effectsState() {
      return {
        settings: { ...effectSettings },
        ao: contactLighting.state(),
        shadows: { intensity: sun.shadow.intensity, radius: sun.shadow.radius },
        torches: dungeon.torchLights.map((l) => ({
          color: l.color.getHexString(),
          intensity: l.intensity,
          distance: l.distance,
          decay: l.decay,
          shadow: l.castShadow,
          visible: l.visible,
        })),
        ...materialEffects.proof(),
      }
    },
    get theme() {
      return themeMaterials.active
    },
    geometryIdentity() {
      const result: { mesh: string; geometry: string }[] = []
      dungeon.root.traverse((node) => {
        if (node instanceof THREE.Mesh)
          result.push({ mesh: node.uuid, geometry: (node.geometry as THREE.BufferGeometry).uuid })
      })
      return result
    },
    themeState() {
      return {
        id: themeMaterials.active,
        lighting: {
          ambient: ambient.intensity,
          sun: sun.intensity,
          fill: fill.intensity,
          exposure: renderer.toneMappingExposure,
          torches: dungeon.torchLights.map((light) => ({
            intensity: light.intensity,
            visible: light.visible,
          })),
        },
        surfaces: themeMaterials.surfaceProof(),
        legacySurfaces: themeMaterials.surfaceProof(true),
      }
    },
    selectStair: inspection.select,
    stairInspectionState: () => inspection.state(),
    stairScreenPoints(id: string) {
      const s = dungeon.staircaseProof.find((s) => s.id === id)
      if (!s) return []
      const levels = stairLevels(s, dungeon.height),
        rect = canvas.getBoundingClientRect()
      camera.updateMatrixWorld()
      return Array.from({ length: levels.count }, (_, i) => {
        const p = stairPoint(
            s,
            s.width * (s.form === 'straight' ? 0.5 : 0.25),
            levels.landing + (i + 0.5) * levels.going,
          ),
          screen = new THREE.Vector3(p.x, levels.floor + levels.rise * (i + 1), p.z).project(camera)
        return {
          x: rect.x + ((screen.x + 1) * rect.width) / 2,
          y: rect.y + ((1 - screen.y) * rect.height) / 2,
        }
      })
    },
    setCamera(nextElevation: number, nextRotation: number) {
      elevation = THREE.MathUtils.clamp(nextElevation, 25, 90)
      rotation = THREE.MathUtils.clamp(nextRotation, -180, 180)
      positionCamera()
    },
    setZoom(value: number) {
      metricsDirty = true
      camera.zoom = THREE.MathUtils.clamp(value, 0.5, 9)
      camera.updateProjectionMatrix()
      invalidateOcclusion()
      inspection.invalidatePick()
      dirty = true
    },
    setHeight(value: number) {
      if (dungeon.height === BASE_WALL_HEIGHT * value) return
      invalidateOcclusion()
      invalidateShadows()
      dungeon.setHeight(value)
      countMeshes()
      metricsDirty = true
      dungeon.setTorchLighting(torchLighting)
      applyTheme()
      renderer.renderLists.dispose()
      inspection.invalidatePick()
      dirty = true
    },
    setDoorsOpen(value: boolean) {
      if (doorsOpen === value) return
      doorsOpen = value
      invalidateOcclusion()
      invalidateShadows()
      dungeon.setDoorsOpen(value)
      countMeshes()
      dungeon.setTorchLighting(torchLighting)
      applyTheme()
      renderer.renderLists.dispose()
      inspection.invalidatePick()
      dirty = true
    },
    setDoorHeadCutaway(value: boolean) {
      if (doorHeadCutaway === value) return
      doorHeadCutaway = value
      invalidateOcclusion()
      invalidateShadows()
      dungeon.setDoorHeadCutaway(value)
      countMeshes()
      dungeon.setTorchLighting(torchLighting)
      applyTheme()
      renderer.renderLists.dispose()
      inspection.invalidatePick()
      dirty = true
    },
    setTorchLighting(value: boolean) {
      if (torchLighting === value) return
      invalidateShadows()
      torchLighting = value
      dungeon.setTorchLighting(value)
      applyTheme()
      dirty = true
    },
    setFlameAnimation(value: boolean) {
      metricsDirty = true
      flameAnimation = value
      if (!value) materials.flameClock.value = 0
      dirty = true
    },
    flameState() {
      return { enabled: flameAnimation, time: materials.flameClock.value }
    },
    setContactOcclusion(value: boolean) {
      metricsDirty = true
      contactOcclusion = value
      dirty = true
    },
    setWireframe(value: boolean) {
      if (wireframe === value) return
      invalidateShadows()
      wireframe = value
      metricsDirty = true
      materials.setWireframe(value)
      themeMaterials.setWireframe(value)
      dirty = true
    },
    setShadows(value: boolean) {
      if (renderer.shadowMap.enabled === value) return
      invalidateShadows()
      renderer.shadowMap.enabled = value
      applyTheme()
      materials.invalidateShaders()
      themeMaterials.invalidateShaders()
      dirty = true
    },
    fit,
    reset() {
      elevation = DEFAULT_CAMERA.elevation
      rotation = 0
      fit()
    },
    focus(x: number, z: number, width = 5, targetHeight = 0) {
      controls.target.set(x + 0.5, targetHeight, z + 0.5)
      fittedSpan = width
      fittedWidth = 0
      camera.zoom = 1
      positionCamera()
      resize()
    },
    png(time = 0) {
      const previous = materials.flameClock.value
      materials.flameClock.value = time
      render()
      const result = renderer.domElement.toDataURL('image/png')
      materials.flameClock.value = previous
      dirty = true
      return result
    },
    async measurePerformance(frames = 30) {
      const previousAnimation = flameAnimation,
        previousTime = materials.flameClock.value
      flameAnimation = false
      materials.flameClock.value = 0
      const cpu: number[] = [],
        intervals: number[] = [],
        gpu: number[] = []
      let last = 0
      try {
        for (let i = 0; i < Math.max(8, Math.min(120, frames)) + 6 && !disposed; i++) {
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
          if (disposed || contextLost) break
          const now = performance.now()
          render()
          if (i >= 6) {
            cpu.push(lastRenderMs)
            if (last) intervals.push(now - last)
            if (timing.gpuMs !== null) gpu.push(timing.gpuMs)
          }
          last = now
        }
      } finally {
        flameAnimation = previousAnimation
        materials.flameClock.value = previousTime
        dirty = true
      }
      const median = (values: number[]) =>
        values.length ? [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]! : null
      return {
        frames: cpu.length,
        cpuSubmissionMs: median(cpu),
        gpuMs: median(gpu),
        frameIntervalMs: median(intervals),
        renderedFps: intervals.length ? 1000 / median(intervals)! : null,
        gpuTimerSupported: timing.supported,
        // Raw bounded samples support before/after means and percentiles without
        // confusing CPU submission with complete GPU frame time.
        samples: { cpuSubmissionMs: cpu, frameIntervalMs: intervals, gpuMs: gpu },
        ...{
          calls: renderer.info.render.calls,
          textures: renderer.info.memory.textures,
          geometries: renderer.info.memory.geometries,
        },
        note: 'Frame cadence includes vsync/scheduling. CPU submission is not GPU frame time.',
      }
    },
    stats() {
      return getMetrics()
    },
    assetProof() {
      function hash(bytes: Uint8Array) {
        let h = 2166136261
        for (const value of bytes) h = Math.imul(h ^ value, 16777619)
        return h >>> 0
      }
      const capMaterial = themeMaterials.resolve(materials.cap) as THREE.MeshStandardMaterial
      const geometry: Record<string, number>[] = []
      dungeon.root.traverse((node) => {
        if (!(node instanceof THREE.Mesh) || node.material !== capMaterial) return
        const attributes: Record<string, number> = {}
        for (const key of ['position', 'normal', 'uv', 'color']) {
          const attribute = (node.geometry as THREE.BufferGeometry).getAttribute(key)
          attributes[key] = hash(
            new Uint8Array(
              attribute.array.buffer,
              attribute.array.byteOffset,
              attribute.array.byteLength,
            ),
          )
        }
        geometry.push(attributes)
      })
      const maps = [capMaterial.map, capMaterial.bumpMap, capMaterial.roughnessMap].map((map) => {
        const image = map!.image as HTMLCanvasElement,
          data = image.getContext('2d')!.getImageData(0, 0, image.width, image.height).data
        return hash(new Uint8Array(data.buffer))
      })
      return {
        caps: {
          geometry,
          maps,
          color: capMaterial.color.toArray(),
          roughness: capMaterial.roughness,
          bump: capMaterial.bumpScale,
        },
        floor: dungeon.floorGroup.userData,
        stairs: dungeon.staircaseProof,
      }
    },
    target() {
      return controls.target.toArray()
    },
    backend() {
      const gl = renderer.getContext(),
        extension = gl.getExtension('WEBGL_debug_renderer_info')
      return {
        webgl2: gl instanceof WebGL2RenderingContext,
        renderer: extension
          ? String(gl.getParameter(extension.UNMASKED_RENDERER_WEBGL))
          : 'Unavailable',
        maxTextureSize: renderer.capabilities.maxTextureSize,
      }
    },
    probeDoorOpening(id: string) {
      const door = plan.doors.find((d) => d.id === id)
      if (!door) return null
      const transform = new THREE.Matrix4()
          .makeRotationY(door.rotation)
          .setPosition(door.x, 0, door.z),
        start = new THREE.Vector3(0.07, dungeon.height * 0.42, 0.8).applyMatrix4(transform),
        direction = new THREE.Vector3(0, 0, -1).transformDirection(transform)
      dungeon.root.updateMatrixWorld(true)
      return (
        new THREE.Raycaster(start, direction, 0, 1.6).intersectObject(dungeon.root, true).length > 0
      )
    },
    probeFloor(x: number, z: number) {
      dungeon.root.updateMatrixWorld(true)
      const hit = new THREE.Raycaster(
        new THREE.Vector3(x + 0.5, 8, z + 0.5),
        new THREE.Vector3(0, -1, 0),
        0,
        16,
      ).intersectObject(dungeon.root, true)[0]
      return hit?.point.y ?? null
    },
    dispose() {
      if (disposed) return
      disposed = true
      prototypeLifecycle.activeViewports--
      observer.disconnect()
      inspection.dispose()
      endDrag()
      canvas.removeEventListener('pointerdown', pointerDown, true)
      canvas.removeEventListener('pointermove', pointerMove)
      canvas.removeEventListener('pointerup', endDrag)
      canvas.removeEventListener('pointercancel', endDrag)
      canvas.removeEventListener('lostpointercapture', endDrag)
      canvas.removeEventListener('auxclick', preventAuxiliary)
      canvas.removeEventListener('webglcontextlost', onContextLost)
      canvas.removeEventListener('webglcontextrestored', onContextRestored)
      window.removeEventListener('blur', endDragOnBlur)
      controls.removeEventListener('change', changed)
      controls.dispose()
      renderer.setAnimationLoop(null)
      dungeon.dispose()
      themeMaterials.dispose()
      materials.dispose()
      timing.dispose()
      materialEffects.dispose()
      contactLighting.dispose()
      sun.shadow.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      renderer.domElement.remove()
      scene.clear()
    },
  }
}
export type Dungeon3DViewport = Awaited<ReturnType<typeof createDungeon3DViewport>>
