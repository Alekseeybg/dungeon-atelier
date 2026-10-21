import * as THREE from 'three'
import { stairPoint, stairLevels, type StairLayout } from './stair-layout.ts'

export function stairLabel(direction: StairLayout['direction']) {
  return direction === 'up' ? 'Stairs Up' : 'Stairs Down'
}

/** DOM labels identify vertical transitions without rotating arrows or modifying scene geometry. */
export function createStairInspection(
  host: HTMLElement,
  canvas: HTMLCanvasElement,
  camera: THREE.Camera,
  root: THREE.Object3D,
  stairs: () => StairLayout[],
  height: () => number,
  invalidate: () => void,
  onSelection?: (id: string | null) => void,
  isVisible: (point: THREE.Vector3) => boolean = () => true,
) {
  const label = document.createElement('div'),
    caster = new THREE.Raycaster()
  label.className = 'stair-label'
  label.dataset.stairLabel = ''
  label.id = `stair-label-${canvas.id || THREE.MathUtils.generateUUID()}`
  label.setAttribute('role', 'tooltip')
  label.hidden = true
  host.appendChild(label)
  canvas.tabIndex = 0
  let hovered: string | null = null,
    selected: string | null = null,
    needsPick = false,
    pointer: { x: number; y: number } | undefined,
    press: { pointer: number; x: number; y: number } | undefined

  function pick(x: number, y: number) {
    const r = canvas.getBoundingClientRect()
    if (x < r.left || x > r.right || y < r.top || y > r.bottom) return null
    camera.updateMatrixWorld()
    root.updateMatrixWorld(true)
    caster.setFromCamera(
      new THREE.Vector2(((x - r.left) / r.width) * 2 - 1, 1 - ((y - r.top) / r.height) * 2),
      camera,
    )
    // The closest actual surface wins: floors and walls occlude stairs normally.
    let node = caster.intersectObject(root, true).find((hit) => isVisible(hit.point))?.object
    while (node) {
      if (typeof node.userData.stairId === 'string') return node.userData.stairId
      node = node.parent ?? undefined
    }
    return null
  }
  function select(id: string | null, notify = false) {
    selected = stairs().some((s) => s.id === id) ? id : null
    if (notify) onSelection?.(selected)
    invalidate()
  }
  function down(event: PointerEvent) {
    hovered = null
    pointer = undefined
    press =
      event.button === 0 && !event.altKey && !event.ctrlKey && !event.metaKey
        ? { pointer: event.pointerId, x: event.clientX, y: event.clientY }
        : undefined
    invalidate()
  }
  function move(event: PointerEvent) {
    if (event.buttons) {
      hovered = null
      pointer = undefined
      if (press && Math.hypot(event.clientX - press.x, event.clientY - press.y) > 5)
        press = undefined
    } else {
      pointer = { x: event.clientX, y: event.clientY }
      needsPick = true
    }
    invalidate()
  }
  function up(event: PointerEvent) {
    if (
      press?.pointer === event.pointerId &&
      Math.hypot(event.clientX - press.x, event.clientY - press.y) <= 5
    ) {
      select(pick(event.clientX, event.clientY), true)
      canvas.focus({ preventScroll: true })
    }
    press = undefined
  }
  function leave() {
    hovered = null
    pointer = undefined
    press = undefined
    invalidate()
  }
  function key(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      leave()
      select(null, true)
    }
  }
  canvas.addEventListener('pointerdown', down, true)
  canvas.addEventListener('pointermove', move)
  canvas.addEventListener('pointerup', up, true)
  canvas.addEventListener('pointerleave', leave)
  canvas.addEventListener('pointercancel', leave)
  canvas.addEventListener('keydown', key)
  window.addEventListener('blur', leave)
  return {
    select,
    invalidatePick() {
      needsPick = true
    },
    update() {
      if (needsPick) {
        hovered = pointer ? pick(pointer.x, pointer.y) : null
        needsPick = false
      }
      const stair = stairs().find((s) => s.id === (hovered ?? selected)),
        r = canvas.getBoundingClientRect()
      label.hidden = !stair
      canvas.style.cursor = hovered ? 'pointer' : ''
      canvas.removeAttribute('aria-describedby')
      if (!stair) return
      let x: number, y: number
      if (hovered && pointer) {
        x = pointer.x - r.left + 14
        y = pointer.y - r.top - 34
      } else {
        const levels = stairLevels(stair, height()),
          p = stairPoint(
            stair,
            stair.width * (stair.form === 'straight' ? 0.5 : 0.25),
            levels.landing + levels.run * 0.35,
          ),
          world = new THREE.Vector3(
            p.x,
            levels.floor + levels.rise * Math.ceil(levels.count * 0.35) + 0.15,
            p.z,
          ).project(camera)
        x = ((world.x + 1) * r.width) / 2
        y = ((1 - world.y) * r.height) / 2 - 30
        if (Math.abs(world.x) > 1 || Math.abs(world.y) > 1 || Math.abs(world.z) > 1) {
          label.hidden = true
          return
        }
      }
      label.textContent = stairLabel(stair.direction)
      label.dataset.stairId = stair.id
      label.dataset.mode = hovered ? 'hover' : 'selection'
      label.style.left = `${Math.max(8, Math.min(r.width - label.offsetWidth - 8, x))}px`
      label.style.top = `${Math.max(8, Math.min(r.height - label.offsetHeight - 8, y))}px`
      canvas.setAttribute('aria-describedby', label.id)
    },
    state() {
      return { hovered, selected, label: label.hidden ? null : label.textContent }
    },
    dispose() {
      canvas.removeEventListener('pointerdown', down, true)
      canvas.removeEventListener('pointermove', move)
      canvas.removeEventListener('pointerup', up, true)
      canvas.removeEventListener('pointerleave', leave)
      canvas.removeEventListener('pointercancel', leave)
      canvas.removeEventListener('keydown', key)
      window.removeEventListener('blur', leave)
      canvas.removeAttribute('aria-describedby')
      label.remove()
    },
  }
}
