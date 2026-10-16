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
      <AppearancePanel v-if="mapStyle === 'ancient'" />
      <q-select
        v-model="mapStyle"
        :loading="loadingTheme"
        :options="MAP_STYLES"
        emit-value
        map-options
        outlined
        dense
        options-dense
        color="primary"
        class="map-style-select"
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
          <q-item
            v-if="
              ['dimensional', 'ancient'].includes(mapStyle) &&
              floor?.doors.some((door) => door.type === 'secret')
            "
            tag="label"
          >
            <q-item-section>
              <q-item-label>Reveal secret architecture</q-item-label>
              <q-item-label caption
                >Show hidden panels and routes in this view and PNG exports.</q-item-label
              >
            </q-item-section>
            <q-item-section side
              ><q-toggle
                v-model="revealSecrets"
                color="cyan-4"
                :disable="walk.active"
                aria-label="Reveal secret architecture"
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
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import type { DungeonFloor, Position } from '@dungeon-atelier/core'
import {
  createMapCanvasAsync,
  disposeMapCanvas,
  mapRenderBounds,
  MAP_STYLES,
  MAP_BACKGROUND,
} from '../rendering/dungeon-renderer'
import { drawDimensionalWalkCutaway } from '../rendering/dimensional-renderer'
import { storeToRefs } from 'pinia'
import { useAppearanceStore } from '../../../stores/appearance'
import AppearancePanel from './AppearancePanel.vue'
import { mapProjection, cellCenter, groundCell } from '../rendering/map-projection'
import { drawAncientWalkCutaway, pickAncient } from '../rendering/ancient-renderer'
import type { MapStyle, MapRenderOptions } from '../rendering/map-style'
import { HEADING_NAMES } from '../exploration/useDungeonWalk'
import type { WalkState, WalkAction } from '../exploration/useDungeonWalk'
import { renderWalkFog } from '../rendering/walk-fog'
import { drawShortcutHighlight } from '../rendering/shortcut-highlight'
import { createRenderSession } from '../rendering/render-session'

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
  secrets: [visible: boolean]
  appearance: [options: MapRenderOptions]
  rendering: [busy: boolean]
  renderReady: [ready: boolean]
  walk: [action: WalkAction]
}>()
function walkAction(action: WalkAction) {
  emit('walk', action)
  canvas.value?.focus({ preventScroll: true })
}
function followPlayer() {
  const position = props.walk.position
  if (!position) return
  const center = cellCenter(position, activeStyle)
  camera.x = viewWidth / 2 - center.x * camera.scale
  camera.y = viewHeight / 2 - center.y * camera.scale
}
const viewport = ref<HTMLDivElement>()
const canvas = ref<HTMLCanvasElement>()
const showGrid = ref(false)
const showShortcut = ref(false)
const revealSecrets = ref(false)
const appearance = useAppearanceStore()
const { style: mapStyle } = storeToRefs(appearance)
const loadingTheme = ref(false)
const renderOptions = computed(() => ({
  revealSecrets:
    ['dimensional', 'ancient'].includes(mapStyle.value) &&
    ((revealSecrets.value && !props.walk.active) ||
      (mapStyle.value === 'ancient' && props.walk.active)),
  ancient: { ...appearance.ancient },
}))
const hover = ref<Position | null>(null)
const camera = reactive({ x: 0, y: 0, scale: 1 })
let mapCanvas: HTMLCanvasElement | undefined
let mapOrigin = { x: 0, y: 0 }
let activeStyle: MapStyle = 'ancient'
let shownFloor: DungeonFloor | null = null
let committedOptions: MapRenderOptions = {},
  committedGrid = false
let observer: ResizeObserver | undefined
let pixelRatioQuery: MediaQueryList | undefined
let resizeFrame: number | undefined
let autoFit = true
let viewWidth = 0
let viewHeight = 0
function refreshPixelRatio() {
  pixelRatioQuery?.removeEventListener('change', refreshPixelRatio)
  pixelRatioQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`)
  pixelRatioQuery.addEventListener('change', refreshPixelRatio)
  if (canvas.value) {
    const ratio = window.devicePixelRatio || 1
    canvas.value.width = Math.max(1, Math.round(viewWidth * ratio))
    canvas.value.height = Math.max(1, Math.round(viewHeight * ratio))
    paint()
  }
}
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
  context.imageSmoothingEnabled = activeStyle === 'ancient'
  context.drawImage(
    mapCanvas,
    camera.x - mapOrigin.x * camera.scale,
    camera.y - mapOrigin.y * camera.scale,
    (mapCanvas.width / mapProjection(activeStyle).density) * camera.scale,
    (mapCanvas.height / mapProjection(activeStyle).density) * camera.scale,
  )
  if (shownFloor !== props.floor) return
  if (props.walk.active) {
    context.save()
    context.translate(camera.x, camera.y)
    context.scale(camera.scale, camera.scale)
    if (activeStyle === 'dimensional') drawDimensionalWalkCutaway(context, mapCanvas, props.walk)
    if (activeStyle === 'ancient') drawAncientWalkCutaway(context, mapCanvas, props.walk)
    renderWalkFog(context, props.floor, props.walk, activeStyle)
    context.restore()
    return
  }
  if (
    showShortcut.value &&
    props.floor.shortcuts?.length &&
    (!['dimensional', 'ancient'].includes(activeStyle) || renderOptions.value.revealSecrets)
  ) {
    context.save()
    context.translate(camera.x, camera.y)
    context.scale(camera.scale, camera.scale)
    drawShortcutHighlight(context, props.floor.shortcuts, camera.scale, activeStyle)
    context.restore()
  }
  const cell = mapProjection(activeStyle).width * camera.scale
  const cellHeight = mapProjection(activeStyle).height * camera.scale
  for (const [position, color] of [
    [hover.value, '#ede1c44d'],
    [props.selected, '#f0c985'],
  ] as const) {
    if (!position) continue
    context.strokeStyle = color
    context.lineWidth = position === props.selected ? 2 : 1
    context.strokeRect(
      camera.x + position.x * cell + 1,
      camera.y + position.y * cellHeight + 1,
      Math.max(0, cell - 2),
      Math.max(0, cellHeight - 2),
    )
  }
}

function fit() {
  autoFit = true
  if (!mapCanvas || !viewWidth || !viewHeight) return
  const density = mapProjection(activeStyle).density,
    width = mapCanvas.width / density,
    height = mapCanvas.height / density
  camera.scale = Math.max(0.05, Math.min(2, (viewWidth - 48) / width, (viewHeight - 48) / height))
  camera.x = (viewWidth - width * camera.scale) / 2 + mapOrigin.x * camera.scale
  camera.y = (viewHeight - height * camera.scale) / 2 + mapOrigin.y * camera.scale
  hover.value = null
  paint()
}
function centerOnCell(position: Position) {
  const center = cellCenter(position, activeStyle)
  autoFit = false
  camera.x = viewWidth / 2 - center.x * camera.scale
  camera.y = viewHeight / 2 - center.y * camera.scale
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
  if (loadingTheme.value || shownFloor !== props.floor) return null
  const world = { x: (point.x - camera.x) / camera.scale, y: (point.y - camera.y) / camera.scale }
  return (
    (activeStyle === 'ancient' && mapCanvas ? pickAncient(mapCanvas, world) : null) ??
    groundCell(world, props.floor, activeStyle)
  )
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

interface RenderRequest {
  floor: DungeonFloor | null
  style: MapStyle
  grid: boolean
  options: MapRenderOptions
}
const renderSession = createRenderSession<RenderRequest, HTMLCanvasElement | undefined>({
  beforeBuild: () =>
    new Promise<void>((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0))),
  build: ({ floor, grid, style, options }) =>
    floor ? createMapCanvasAsync(floor, grid, style, options) : Promise.resolve(undefined),
  discard: disposeMapCanvas,
  error: (error) => emit('error', error),
  busy(value) {
    loadingTheme.value = value
    emit('rendering', value)
    if (value) emit('renderReady', false)
  },
  commit(next, { floor, style, grid, options }) {
    if (!floor || !next) {
      disposeMapCanvas(mapCanvas)
      mapCanvas = undefined
      shownFloor = null
      paint()
      return
    }
    const changedFloor = shownFloor !== floor,
      oldProjection = mapProjection(activeStyle),
      nextProjection = mapProjection(style),
      centerRow = (viewHeight / 2 - camera.y) / (oldProjection.height * camera.scale),
      old = mapCanvas
    mapCanvas = next
    committedOptions = options
    committedGrid = grid
    shownFloor = floor
    activeStyle = style
    mapOrigin = mapRenderBounds(floor, style).origin
    camera.y = viewHeight / 2 - centerRow * nextProjection.height * camera.scale
    disposeMapCanvas(old)
    emit('style', style)
    emit('secrets', !!options.revealSecrets)
    emit('appearance', options)
    emit('grid', committedGrid)
    emit('renderReady', true)
    if (props.walk.active) followPlayer()
    else if (changedFloor || autoFit) fit()
    paint()
  },
})
function rebuild() {
  return renderSession.request({
    floor: props.floor,
    style: mapStyle.value,
    grid: showGrid.value,
    options: { ...renderOptions.value, ancient: { ...appearance.ancient } },
  })
}

watch(
  () => props.floor,
  async () => {
    drag = undefined
    hover.value = null
    emit('inspect', null)
    showShortcut.value = false
    revealSecrets.value = false
    await rebuild()
  },
)
watch(showGrid, () => {
  void rebuild()
})
watch(showShortcut, (visible) => {
  if (visible && ['dimensional', 'ancient'].includes(mapStyle.value)) revealSecrets.value = true
  paint()
})
watch(
  () => props.shortcutFocus,
  async () => {
    await nextTick()
    const path = props.floor?.shortcuts?.[0]?.path
    if (!path?.length) return
    autoFit = false
    showShortcut.value = true
    if (['dimensional', 'ancient'].includes(mapStyle.value)) revealSecrets.value = true
    const minX = Math.min(...path.map((p) => p.x)),
      maxX = Math.max(...path.map((p) => p.x))
    const minY = Math.min(...path.map((p) => p.y)),
      maxY = Math.max(...path.map((p) => p.y))
    const projection = mapProjection(activeStyle)
    camera.scale = Math.max(
      0.05,
      Math.min(
        2,
        (viewWidth - 80) / ((maxX - minX + 3) * projection.width),
        (viewHeight - 80) / ((maxY - minY + 3) * projection.height),
      ),
    )
    camera.x = viewWidth / 2 - ((minX + maxX + 1) / 2) * projection.width * camera.scale
    camera.y = viewHeight / 2 - ((minY + maxY + 1) / 2) * projection.height * camera.scale
    hover.value = null
    paint()
  },
  { flush: 'post' },
)
watch(
  [mapStyle, renderOptions],
  () => {
    void rebuild()
  },
  { deep: true },
)

watch(
  () => props.selected,
  (position) => {
    if (position) {
      const cell = mapProjection(activeStyle).width * camera.scale
      const center = cellCenter(position, activeStyle)
      const x = camera.x + center.x * camera.scale
      const y = camera.y + center.y * camera.scale
      if (x < cell || y < cell || x > viewWidth - cell || y > viewHeight - cell) {
        autoFit = false
        camera.x = viewWidth / 2 - center.x * camera.scale
        camera.y = viewHeight / 2 - center.y * camera.scale
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
  window.addEventListener('resize', refreshPixelRatio)
  refreshPixelRatio()
  void rebuild()
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
  renderSession.dispose()
  disposeMapCanvas(mapCanvas)
  window.removeEventListener('resize', refreshPixelRatio)
  pixelRatioQuery?.removeEventListener('change', refreshPixelRatio)
  observer?.disconnect()
  if (resizeFrame !== undefined) cancelAnimationFrame(resizeFrame)
})
/** Read-only presentation state is also useful to embedding hosts and browser validation. */
defineExpose({
  fit,
  zoomAtCenter,
  centerOnCell,
  getRenderState: () => ({
    seed: shownFloor?.seed,
    style: activeStyle,
    options: committedOptions,
    grid: committedGrid,
    camera: { ...camera },
    origin: { ...mapOrigin },
    density: mapProjection(activeStyle).density,
    raster: { width: mapCanvas?.width ?? 0, height: mapCanvas?.height ?? 0 },
    loading: loadingTheme.value,
    selected: props.selected ? { ...props.selected } : null,
    walk: {
      active: props.walk.active,
      position: props.walk.position ? { ...props.walk.position } : null,
      explored: props.walk.explored.size,
      steps: props.walk.steps,
      heading: props.walk.heading,
    },
  }),
})
</script>
