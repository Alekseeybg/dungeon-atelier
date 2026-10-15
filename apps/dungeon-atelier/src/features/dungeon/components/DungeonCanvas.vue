<template>
  <section class="map-workspace" aria-label="Dungeon map">
    <q-toolbar class="map-toolbar">
      <div class="row items-center no-wrap q-gutter-sm">
        <q-icon name="layers" color="primary" size="20px" />
        <span class="text-body2"
          >Floor {{ floor?.floorNumber.toString().padStart(2, '0') ?? '—' }}</span
        >
        <q-badge v-if="floor" outline color="grey-5"
          >{{ floor.width }} × {{ floor.height }}</q-badge
        >
      </div>
      <q-space />
      <q-btn-toggle
        v-model="mapStyle"
        :options="[
          { label: 'Stone', value: 'stone' },
          { label: 'Classic', value: 'classic' },
        ]"
        unelevated
        dense
        no-caps
        color="grey-9"
        text-color="grey-4"
        toggle-color="primary"
        toggle-text-color="dark"
        aria-label="Map appearance"
      />
    </q-toolbar>
    <q-separator />
    <q-toolbar class="map-navigation">
      <q-btn
        dense
        no-caps
        :outline="!walk.active"
        :unelevated="walk.active"
        :color="walk.active ? 'primary' : 'grey-5'"
        :text-color="walk.active ? 'dark' : undefined"
        icon="explore"
        :label="$q.screen.lt.sm ? undefined : walk.active ? 'Exit walk' : 'Walk mode'"
        :disable="!floor"
        :aria-pressed="walk.active"
        :aria-label="walk.active ? 'Exit walk mode' : 'Enter walk mode'"
        @click="walkAction('toggle')"
        class="walk-mode-button q-mr-sm"
      />
      <q-btn-dropdown
        flat
        dense
        no-caps
        :icon="$q.screen.lt.sm ? undefined : 'layers'"
        label="Overlays"
        :disable="!floor"
        aria-label="Map overlays"
      >
        <q-list class="overlay-menu">
          <q-item tag="label">
            <q-item-section>Tile grid</q-item-section>
            <q-item-section side
              ><q-toggle v-model="showGrid" color="primary" aria-label="Show tile grid"
            /></q-item-section>
          </q-item>
          <q-item v-if="floor?.shortcuts?.length" tag="label">
            <q-item-section
              ><q-item-label>Shortcut route</q-item-label
              ><q-item-label v-if="walk.active" caption
                >Available outside walk mode</q-item-label
              ></q-item-section
            >
            <q-item-section side
              ><q-toggle
                v-model="showShortcut"
                color="cyan-4"
                :disable="walk.active"
                aria-label="Highlight generated shortcut"
            /></q-item-section>
          </q-item>
        </q-list>
      </q-btn-dropdown>
      <q-space />
      <q-btn
        flat
        round
        dense
        icon="remove"
        aria-label="Zoom out"
        :disable="!floor"
        @click="zoomAtCenter(0.8)"
      />
      <span class="zoom-value text-caption text-grey-5">{{ Math.round(camera.scale * 100) }}%</span>
      <q-btn
        flat
        round
        dense
        icon="add"
        aria-label="Zoom in"
        :disable="!floor"
        @click="zoomAtCenter(1.25)"
      />
      <q-separator vertical inset class="q-mx-sm" />
      <q-btn
        flat
        round
        dense
        icon="fit_screen"
        aria-label="Fit map to viewport"
        :disable="!floor"
        @click="fit"
        ><q-tooltip>Fit map (F)</q-tooltip></q-btn
      >
    </q-toolbar>
    <div ref="viewport" class="map-viewport">
      <canvas
        ref="canvas"
        class="dungeon-canvas"
        tabindex="0"
        :aria-label="
          walk.active
            ? 'Dungeon walk mode. Up and down move; left and right turn. Escape exits.'
            : 'Dungeon canvas. Drag to pan, scroll to zoom, click to inspect. F fits the map. Arrow keys pan; plus and minus zoom.'
        "
        @wheel.prevent="onWheel"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerCancel"
        @pointerleave="onPointerLeave"
        @keydown="onKeyDown"
      />
      <div v-if="walk.active" class="walk-controls">
        <div class="row items-center justify-between q-mb-sm">
          <q-badge color="primary" text-color="dark">{{ HEADING_NAMES[walk.heading] }}</q-badge
          ><q-btn
            flat
            dense
            round
            size="sm"
            icon="restart_alt"
            aria-label="Reset exploration"
            @click="walkAction('reset')"
            ><q-tooltip>Reset exploration</q-tooltip></q-btn
          >
        </div>
        <div class="walk-pad">
          <q-btn
            dense
            outline
            icon="north"
            aria-label="Walk forward"
            @click="walkAction('forward')"
            class="walk-forward"
          />
          <q-btn dense outline icon="west" aria-label="Turn left" @click="walkAction('left')" />
          <q-btn
            dense
            outline
            icon="south"
            aria-label="Walk backward"
            @click="walkAction('back')"
          />
          <q-btn dense outline icon="east" aria-label="Turn right" @click="walkAction('right')" />
        </div>
        <div class="text-caption text-grey-5 q-mt-sm">↑ ↓ move · ← → turn</div>
      </div>
      <div v-if="!floor" class="map-empty">
        <q-icon name="explore" size="48px" />
        <h2>Your next dungeon awaits</h2>
        <p>Choose a seed and generate a floor to begin.</p>
      </div>
    </div>
    <div class="map-status" aria-live="polite">
      <span v-if="walk.active">{{ walk.message }}</span>
      <span v-else-if="showShortcut && floor?.shortcuts?.length" class="text-cyan-3"
        >S: hidden door · Cyan: shortcut · saves {{ floor.shortcuts[0]!.tilesSaved }} steps</span
      >
      <span v-else>Drag to pan · Scroll to zoom · Click to inspect</span>
      <span class="coordinate-readout">{{
        walk.active && walk.position
          ? `x ${walk.position.x} / y ${walk.position.y} · ${walk.steps} steps`
          : hover
            ? `x ${hover.x} / y ${hover.y}`
            : 'Origin: top-left'
      }}</span>
    </div>
  </section>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import type { DungeonFloor, Position } from '@dungeon-atelier/core'
import { createMapCanvas, MAP_BACKGROUND, TILE_SIZE } from '../rendering/dungeon-renderer'
import type { MapStyle } from '../rendering/dungeon-renderer'
import { HEADING_NAMES } from '../exploration/useDungeonWalk'
import type { WalkState, WalkAction } from '../exploration/useDungeonWalk'
import { renderWalkFog } from '../rendering/walk-fog'
import { drawShortcutHighlight } from '../rendering/shortcut-highlight'

const props = defineProps<{
  floor: DungeonFloor | null
  selected: Position | null
  walk: WalkState
  shortcutFocus: number
}>()
const emit = defineEmits<{
  inspect: [position: Position | null]
  error: [error: unknown]
  grid: [visible: boolean]
  style: [value: MapStyle]
  walk: [action: WalkAction]
}>()
function walkAction(action: WalkAction) {
  emit('walk', action)
  canvas.value?.focus({ preventScroll: true })
}
function followPlayer() {
  const position = props.walk.position
  if (!position) return
  camera.x = viewWidth / 2 - (position.x + 0.5) * TILE_SIZE * camera.scale
  camera.y = viewHeight / 2 - (position.y + 0.5) * TILE_SIZE * camera.scale
}
const viewport = ref<HTMLDivElement>()
const canvas = ref<HTMLCanvasElement>()
const showGrid = ref(false)
const showShortcut = ref(false)
const mapStyle = ref<MapStyle>('stone')
const hover = ref<Position | null>(null)
const camera = reactive({ x: 0, y: 0, scale: 1 })
let mapCanvas: HTMLCanvasElement | undefined
let observer: ResizeObserver | undefined
let resizeFrame: number | undefined
let autoFit = true
let viewWidth = 0
let viewHeight = 0
let drag:
  | { id: number; startX: number; startY: number; lastX: number; lastY: number; moved: boolean }
  | undefined

function paint() {
  const context = canvas.value?.getContext('2d')
  if (!context) return
  const ratio = window.devicePixelRatio || 1
  context.setTransform(ratio, 0, 0, ratio, 0, 0)
  context.fillStyle = MAP_BACKGROUND
  context.fillRect(0, 0, viewWidth, viewHeight)
  if (!mapCanvas || !props.floor) return
  context.imageSmoothingEnabled = false
  context.drawImage(
    mapCanvas,
    camera.x,
    camera.y,
    mapCanvas.width * camera.scale,
    mapCanvas.height * camera.scale,
  )
  if (props.walk.active) {
    context.save()
    context.translate(camera.x, camera.y)
    context.scale(camera.scale, camera.scale)
    renderWalkFog(context, props.floor, props.walk)
    context.restore()
    return
  }
  if (showShortcut.value && props.floor.shortcuts?.length) {
    context.save()
    context.translate(camera.x, camera.y)
    context.scale(camera.scale, camera.scale)
    drawShortcutHighlight(context, props.floor.shortcuts, camera.scale)
    context.restore()
  }
  const cell = TILE_SIZE * camera.scale
  for (const [position, color] of [
    [hover.value, '#ede1c44d'],
    [props.selected, '#f0c985'],
  ] as const) {
    if (!position) continue
    context.strokeStyle = color
    context.lineWidth = position === props.selected ? 2 : 1
    context.strokeRect(
      camera.x + position.x * cell + 1,
      camera.y + position.y * cell + 1,
      Math.max(0, cell - 2),
      Math.max(0, cell - 2),
    )
  }
}

function fit() {
  autoFit = true
  if (!mapCanvas || !viewWidth || !viewHeight) return
  camera.scale = Math.max(
    0.05,
    Math.min(2, (viewWidth - 48) / mapCanvas.width, (viewHeight - 48) / mapCanvas.height),
  )
  camera.x = (viewWidth - mapCanvas.width * camera.scale) / 2
  camera.y = (viewHeight - mapCanvas.height * camera.scale) / 2
  hover.value = null
  paint()
}

function zoomAt(x: number, y: number, factor: number) {
  if (!mapCanvas) return
  autoFit = false
  const scale = Math.max(0.05, Math.min(4, camera.scale * factor))
  const ratio = scale / camera.scale
  camera.x = x - (x - camera.x) * ratio
  camera.y = y - (y - camera.y) * ratio
  camera.scale = scale
  hover.value = null
  paint()
}
function zoomAtCenter(factor: number) {
  zoomAt(viewWidth / 2, viewHeight / 2, factor)
}
function localPoint(event: MouseEvent | PointerEvent | WheelEvent) {
  const bounds = canvas.value!.getBoundingClientRect()
  return { x: event.clientX - bounds.left, y: event.clientY - bounds.top }
}
function tileAt(point: Position): Position | null {
  if (!props.floor) return null
  const x = Math.floor((point.x - camera.x) / (TILE_SIZE * camera.scale))
  const y = Math.floor((point.y - camera.y) / (TILE_SIZE * camera.scale))
  return x >= 0 && y >= 0 && x < props.floor.width && y < props.floor.height ? { x, y } : null
}
function onWheel(event: WheelEvent) {
  const point = localPoint(event)
  const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewHeight : 1)
  zoomAt(point.x, point.y, Math.exp(-delta * 0.0015))
}
function onPointerDown(event: PointerEvent) {
  if (drag) return
  if (event.button !== 0 && event.button !== 1) return
  event.preventDefault()
  canvas.value?.focus()
  canvas.value?.setPointerCapture(event.pointerId)
  drag = {
    id: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    lastX: event.clientX,
    lastY: event.clientY,
    moved: false,
  }
}
function onPointerMove(event: PointerEvent) {
  if (drag && event.pointerId === drag.id) {
    if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 3) drag.moved = true
    if (drag.moved) autoFit = false
    camera.x += event.clientX - drag.lastX
    camera.y += event.clientY - drag.lastY
    drag.lastX = event.clientX
    drag.lastY = event.clientY
  }
  hover.value = tileAt(localPoint(event))
  paint()
}
function onPointerUp(event: PointerEvent) {
  if (!drag || drag.id !== event.pointerId) return
  if (!props.walk.active && !drag.moved && event.button === 0)
    emit('inspect', tileAt(localPoint(event)))
  if (canvas.value?.hasPointerCapture(event.pointerId))
    canvas.value.releasePointerCapture(event.pointerId)
  drag = undefined
  paint()
}
function onPointerCancel() {
  drag = undefined
  hover.value = null
  paint()
}
function onPointerLeave() {
  if (!drag) {
    hover.value = null
    paint()
  }
}
function onKeyDown(event: KeyboardEvent) {
  if (props.walk.active) {
    const actions: Record<string, WalkAction> = {
      ArrowUp: 'forward',
      w: 'forward',
      W: 'forward',
      ArrowDown: 'back',
      s: 'back',
      S: 'back',
      ArrowLeft: 'left',
      a: 'left',
      A: 'left',
      ArrowRight: 'right',
      d: 'right',
      D: 'right',
      Escape: 'toggle',
    }
    const action = actions[event.key]
    if (action) {
      event.preventDefault()
      walkAction(action)
      return
    }
  }
  const offsets: Record<string, Position> = {
    ArrowLeft: { x: 40, y: 0 },
    ArrowRight: { x: -40, y: 0 },
    ArrowUp: { x: 0, y: 40 },
    ArrowDown: { x: 0, y: -40 },
  }
  if (offsets[event.key]) {
    event.preventDefault()
    autoFit = false
    camera.x += offsets[event.key]!.x
    camera.y += offsets[event.key]!.y
    hover.value = null
    paint()
  } else if (['+', '=', '-', 'f', 'F'].includes(event.key)) {
    event.preventDefault()
    if (event.key.toLowerCase() === 'f') fit()
    else zoomAtCenter(event.key === '-' ? 0.8 : 1.25)
  }
}

function rebuild() {
  try {
    mapCanvas = props.floor
      ? createMapCanvas(props.floor, showGrid.value, mapStyle.value)
      : undefined
  } catch (error) {
    mapCanvas = undefined
    emit('error', error)
  }
  paint()
}
watch(
  () => props.floor,
  async () => {
    drag = undefined
    hover.value = null
    emit('inspect', null)
    showShortcut.value = false
    rebuild()
    await nextTick()
    if (props.walk.active) followPlayer()
    else fit()
  },
)
watch(showGrid, (value) => {
  emit('grid', value)
  rebuild()
})
watch(showShortcut, paint)
watch(
  () => props.shortcutFocus,
  async () => {
    await nextTick()
    const path = props.floor?.shortcuts?.[0]?.path
    if (!path?.length) return
    autoFit = false
    showShortcut.value = true
    const minX = Math.min(...path.map((p) => p.x)),
      maxX = Math.max(...path.map((p) => p.x))
    const minY = Math.min(...path.map((p) => p.y)),
      maxY = Math.max(...path.map((p) => p.y))
    camera.scale = Math.max(
      0.05,
      Math.min(
        2,
        (viewWidth - 80) / ((maxX - minX + 3) * TILE_SIZE),
        (viewHeight - 80) / ((maxY - minY + 3) * TILE_SIZE),
      ),
    )
    camera.x = viewWidth / 2 - ((minX + maxX + 1) / 2) * TILE_SIZE * camera.scale
    camera.y = viewHeight / 2 - ((minY + maxY + 1) / 2) * TILE_SIZE * camera.scale
    hover.value = null
    paint()
  },
  { flush: 'post' },
)
watch(mapStyle, (value) => {
  emit('style', value)
  rebuild()
})
watch(
  () => props.selected,
  (position) => {
    if (position) {
      const cell = TILE_SIZE * camera.scale
      const x = camera.x + (position.x + 0.5) * cell
      const y = camera.y + (position.y + 0.5) * cell
      if (x < cell || y < cell || x > viewWidth - cell || y > viewHeight - cell) {
        autoFit = false
        camera.x = viewWidth / 2 - (position.x + 0.5) * cell
        camera.y = viewHeight / 2 - (position.y + 0.5) * cell
      }
    }
    paint()
  },
)

watch(
  () => props.walk.active,
  (active) => {
    hover.value = null
    emit('inspect', null)
    if (active) {
      camera.scale = Math.max(camera.scale, 1.25)
      followPlayer()
      canvas.value?.focus({ preventScroll: true })
    } else fit()
    paint()
  },
)
watch(
  () => props.walk,
  () => {
    if (props.walk.active) followPlayer()
    paint()
  },
  { deep: true },
)

onMounted(() => {
  rebuild()
  observer = new ResizeObserver((entries) => {
    const bounds = entries[0]?.contentRect
    if (resizeFrame !== undefined) cancelAnimationFrame(resizeFrame)
    if (!bounds || bounds.width <= 0 || bounds.height <= 0) return
    // Resize canvas and reactive zoom labels after the current layout notification cycle.
    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = undefined
      if (!canvas.value) return
      const firstSize = viewWidth === 0 || viewHeight === 0
      camera.x += (bounds.width - viewWidth) / 2
      camera.y += (bounds.height - viewHeight) / 2
      viewWidth = bounds.width
      viewHeight = bounds.height
      const ratio = window.devicePixelRatio || 1
      canvas.value.width = Math.max(1, Math.round(viewWidth * ratio))
      canvas.value.height = Math.max(1, Math.round(viewHeight * ratio))
      if (props.walk.active) followPlayer()
      else if (firstSize || autoFit) fit()
      paint()
    })
  })
  if (viewport.value) observer.observe(viewport.value)
})
onBeforeUnmount(() => {
  observer?.disconnect()
  if (resizeFrame !== undefined) cancelAnimationFrame(resizeFrame)
})
</script>
