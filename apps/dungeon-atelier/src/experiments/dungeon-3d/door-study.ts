import * as THREE from 'three'
import { createDungeon3DMaterials } from './materials'
import { GeometryBatches, doorCopingGeometry, disposeGeometry } from './geometry'
import { addDoorFrame, addDoorLeaf, addTorchProp } from './asset-props'
import { dressedBoxGeometry } from './asset-geometry'
import { addDoorCandidate, createDoorCandidateMaterials } from './door-candidates'
import { addSelectedDoor } from './selected-door'
import { addTorchCandidate } from './torch-candidates'

export async function createDoorStudy(host: HTMLElement, kind: 'door' | 'torch' = 'door') {
  const original = await createDungeon3DMaterials(['study-broad'], 'door-study'),
    candidates = await createDoorCandidateMaterials(),
    scene = new THREE.Scene(),
    renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }),
    camera = new THREE.OrthographicCamera(-5, 5, 2, -2, 0.1, 100),
    models = new THREE.Group(),
    lights: THREE.PointLight[] = []
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5))
  renderer.setClearColor('#080c0d')
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.15
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.domElement.setAttribute('aria-label', 'Three door model comparison')
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%'
  host.appendChild(renderer.domElement)
  scene.add(models, new THREE.HemisphereLight('#d5dcdf', '#858b8b', 1.9))
  const sun = new THREE.DirectionalLight('#fff1d7', 3),
    fill = new THREE.DirectionalLight('#d5dfe5', 1.2)
  sun.position.set(-10, 20, 12)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 5, bottom: -5, near: 0.1, far: 50 })
  sun.shadow.normalBias = 0.006
  fill.position.set(10, 5, 10)
  scene.add(sun, fill)
  for (const x of [-3.3, 0, 3.3]) {
    const light = new THREE.PointLight('#ffa23e', 1.8, 4, 2)
    light.position.set(kind === 'torch' ? x : x - 0.8, 1.6, 0.65)
    light.visible = false
    scene.add(light)
    lights.push(light)
  }
  let opened = false,
    selected = true,
    focus = -1,
    elevation = 22,
    azimuth = 12,
    disposed = false
  function rebuild() {
    disposeGeometry(models)
    models.clear()
    const batch = new GeometryBatches()
    for (let index = 0; index < 3; index++) {
      const parent = new THREE.Matrix4().setPosition((index - 1) * 3.3, 0, 0)
      for (const side of [-1, 1])
        for (let row = 0; row < 6; row++) {
          const g = dressedBoxGeometry(0.92, 0.318, 0.625, 0.008)
          batch.add(
            original.masonry,
            g,
            parent
              .clone()
              .multiply(new THREE.Matrix4().setPosition(side * 1.045, (row + 0.5) / 3, 0)),
            null,
            1,
            (row * 3 + (side > 0 ? 2 : 0)) % 16,
          )
          g.dispose()
        }
      if (kind === 'torch')
        for (let row = 0; row < 6; row++) {
          const g = dressedBoxGeometry(1.17, 0.318, 0.625, 0.008)
          batch.add(
            original.masonry,
            g,
            parent.clone().multiply(new THREE.Matrix4().setPosition(0, (row + 0.5) / 3, 0)),
            null,
            1,
            (row * 3) % 16,
          )
          g.dispose()
        }
      const cap = doorCopingGeometry(3, 0.625)
      batch.add(
        original.cap,
        cap,
        parent.clone().multiply(new THREE.Matrix4().setPosition(0, 2, 0)),
        null,
        1,
        0,
      )
      cap.dispose()
      for (let z = 0; z < 3; z++)
        for (let x = 0; x < 6; x++) {
          const g = dressedBoxGeometry(0.486, 0.045, 0.486, 0.007)
          batch.add(
            original.floors.get('study-broad')!,
            g,
            parent
              .clone()
              .multiply(new THREE.Matrix4().setPosition(-1.25 + x * 0.5, 0.015, 0.5 + z * 0.5)),
            null,
            1,
            (x + z * 5) % 16,
          )
          g.dispose()
        }
      if (kind === 'torch') {
        if (index === 0)
          addTorchProp(
            batch,
            original,
            parent.clone().multiply(new THREE.Matrix4().setPosition(0, 0, 0.325)),
            1.26,
          )
        else addTorchCandidate(batch, original, parent, index === 1 ? 'basket' : 'brazier')
      } else if (index === 0) {
        addDoorFrame(batch, original, parent, 2, 1.68, true)
        const leaf = parent
          .clone()
          .multiply(new THREE.Matrix4().setPosition(-0.38, 0, 0))
          .multiply(new THREE.Matrix4().makeRotationY(opened ? -Math.PI * 0.43 : 0))
        addDoorLeaf(batch, original, leaf, 0.76, 1.68, 'door-study', 0, 0)
      } else if (index === 1 && selected) addSelectedDoor(batch, original, parent, 2, opened)
      else addDoorCandidate(batch, candidates, parent, index === 1 ? 'lintel' : 'arch', opened)
    }
    models.add(batch.finish())
    render()
  }
  function render() {
    if (!disposed) renderer.render(scene, camera)
  }
  function resize() {
    if (disposed) return
    const w = Math.max(1, host.clientWidth),
      h = Math.max(1, host.clientHeight),
      span = focus < 0 ? Math.max(10.3, (3.5 * w) / h) : Math.max(2.4, (1.1 * w) / h),
      centerX = focus < 0 ? 0 : (focus - 1) * 3.3,
      centerY = focus < 0 ? 1 : 1.28
    camera.left = -span / 2
    camera.right = span / 2
    camera.top = (span * h) / w / 2
    camera.bottom = -camera.top
    camera.position.set(
      centerX + Math.sin((azimuth * Math.PI) / 180) * 20,
      Math.tan((elevation * Math.PI) / 180) * 20 + centerY,
      Math.cos((azimuth * Math.PI) / 180) * 20,
    )
    camera.lookAt(centerX, centerY, 0.25)
    camera.updateProjectionMatrix()
    renderer.setSize(w, h, false)
    render()
  }
  const observer = new ResizeObserver(resize)
  observer.observe(host)
  rebuild()
  resize()
  return {
    setFocus(index: number) {
      focus = index
      resize()
    },
    setSelected(value: boolean) {
      selected = value
      rebuild()
    },
    setView(e: number, a: number) {
      elevation = e
      azimuth = a
      resize()
    },
    setOpen(value: boolean) {
      opened = value
      rebuild()
    },
    setWarm(value: boolean) {
      lights.forEach((l) => (l.visible = value))
      render()
    },
    png() {
      render()
      return renderer.domElement.toDataURL('image/png')
    },
    state() {
      models.updateMatrixWorld(true)
      return {
        opened,
        elevation,
        azimuth,
        calls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        models:
          kind === 'torch'
            ? ['existing', 'basket', 'brazier']
            : ['existing', selected ? 'selected' : 'lintel', 'arch'],
        doorBlocked: [-3.3, 0, 3.3].map(
          (x) =>
            new THREE.Raycaster(
              new THREE.Vector3(x + 0.07, 0.95, 2),
              new THREE.Vector3(0, 0, -1),
              0,
              3,
            ).intersectObject(models, true).length > 0,
        ),
      }
    },
    dispose() {
      disposed = true
      observer.disconnect()
      disposeGeometry(models)
      original.dispose()
      candidates.dispose()
      scene.traverse((n) => {
        if (n instanceof THREE.Light) n.dispose()
      })
      renderer.dispose()
      renderer.forceContextLoss()
      renderer.domElement.remove()
    },
  }
}
