<template>
  <q-layout view="hHh lpR fFf">
    <q-page-container>
      <q-page class="projection-page q-pa-lg">
        <div class="row items-center q-gutter-md q-mb-lg">
          <q-btn flat icon="west" label="Dungeon studio" to="/" />
          <div class="col-12 col-md">
            <h1 class="text-h4 q-my-none">Projection playground</h1>
            <p class="text-body1 text-grey-5 q-mb-none">
              Turn the whole dungeon viewpoint slightly. Compare room angles and taller walls.
            </p>
          </div>
          <q-badge outline color="amber-4">Isolated preview</q-badge>
        </div>

        <q-card flat bordered class="q-pa-md q-mb-lg">
          <div class="projection-controls">
            <div v-if="mode !== 'angle'">
              <div class="text-caption text-grey-5 q-mb-xs">Viewing angle</div>
              <q-btn-toggle
                v-model="angle"
                :options="VIEW_ANGLES.map((value) => ({ label: `${value}°`, value }))"
                no-caps
                unelevated
                toggle-color="primary"
                aria-label="Projection view angle"
              />
            </div>
            <div v-if="mode !== 'height'">
              <div class="text-caption text-grey-5 q-mb-xs">Upward shift / wall height</div>
              <q-btn-toggle
                v-model="rise"
                :options="UPWARD_SHIFTS.map((value) => ({ label: String(value), value }))"
                no-caps
                unelevated
                toggle-color="primary"
                aria-label="Projection upward shift"
              />
            </div>
            <q-select
              v-model="mode"
              :options="modes"
              emit-value
              map-options
              outlined
              dense
              label="Comparison"
              aria-label="Projection comparison"
              class="projection-select"
            />
            <q-select
              v-model="view"
              :options="PROJECTION_VIEWS"
              emit-value
              map-options
              outlined
              dense
              label="View"
              aria-label="Projection view"
              class="projection-select"
            />
            <q-select
              v-model="zoom"
              :options="zoomOptions"
              emit-value
              map-options
              outlined
              dense
              label="Display size"
              aria-label="Projection display size"
              class="projection-select"
            />
          </div>
          <q-separator class="q-my-md" />
          <div class="row items-center q-gutter-md">
            <q-toggle v-model="doorsOpen" label="Open doors" aria-label="Projection open doors" />
            <q-toggle v-model="lighting" label="Torch lighting" aria-label="Projection lighting" />
            <q-toggle v-model="grid" label="Tile grid" aria-label="Projection grid" />
            <q-select
              v-model="secret"
              :options="secretOptions"
              emit-value
              map-options
              outlined
              dense
              label="North entrance"
              aria-label="Projection secret"
              class="projection-select"
            />
            <q-space />
            <q-btn flat no-caps icon="restart_alt" label="Reset preview" @click="reset" />
            <q-btn
              outline
              no-caps
              icon="download"
              label="Save comparison PNG"
              :disable="busy || !!error"
              @click="download"
            />
          </div>
          <p class="text-body2 text-grey-5 q-mt-md q-mb-none">
            Current editor: 0° viewing angle / 24 upward. The preview starts with slightly taller
            28-unit walls. Turning the view changes the floor grid, room outlines and wall faces
            together. Wall height remains an independent setting.
          </p>
        </q-card>

        <div class="row items-center q-mb-md" aria-live="polite">
          <div class="col text-body2">
            {{ comparisonDescription }}
            <span v-if="view === 'doors-ew'" class="text-grey-5"
              >East door on the left; west door on the right.</span
            >
            <span v-if="view === 'doors-ns'" class="text-grey-5"
              >North door on the left; south door on the right.</span
            >
          </div>
          <q-spinner
            v-if="busy"
            color="primary"
            size="24px"
            aria-label="Rendering projection previews"
          />
        </div>
        <q-banner v-if="error" class="bg-red-10 q-mb-md" role="alert">{{ error }}</q-banner>

        <div
          class="projection-panels"
          :class="{ 'projection-panels--reference': mode === 'reference' }"
          :aria-busy="busy"
        >
          <q-card
            v-for="card in cards"
            :key="card.id"
            flat
            bordered
            class="projection-card"
            :data-projection-card="card.id"
          >
            <q-card-section class="row items-center q-gutter-sm">
              <div class="col">
                <h2 class="text-subtitle1 q-my-none">{{ card.label }}</h2>
                <div class="text-caption text-grey-5">
                  {{ card.angle }}° view / {{ card.rise }} upward
                </div>
              </div>
              <q-badge v-if="card.angle === 0 && card.rise === 24" outline color="primary">
                Current
              </q-badge>
              <q-btn
                v-if="mode !== 'reference'"
                flat
                dense
                no-caps
                label="Compare with current"
                :aria-label="`Compare ${card.angle} degrees ${card.rise} upward with current`"
                @click="inspect(card)"
              />
            </q-card-section>
            <div class="projection-image">
              <canvas
                :ref="(element) => setCanvas(element, card.id)"
                :aria-label="`${card.label}: ${card.angle} degrees, ${card.rise} upward`"
                :style="{ width: zoom === 'fit' ? '100%' : `${width * zoom}px` }"
              />
            </div>
          </q-card>
        </div>
      </q-page>
    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  VIEW_ANGLES,
  UPWARD_SHIFTS,
  PROJECTION_VIEWS,
  renderProjectionStudy,
  cropProjectionStudy,
} from '../features/dungeon/rendering/visual-foundation/projection-study'
import type {
  ProjectionView,
  ProjectionStudyOptions,
} from '../features/dungeon/rendering/visual-foundation/projection-study'

type Mode = 'angle' | 'height' | 'reference'
interface Card {
  id: string
  label: string
  angle: number
  rise: number
}
const angle = ref(10),
  rise = ref(28),
  mode = ref<Mode>('angle'),
  view = ref<ProjectionView>('room'),
  zoom = ref<'fit' | number>('fit'),
  doorsOpen = ref(false),
  lighting = ref(true),
  grid = ref(false),
  secret = ref<ProjectionStudyOptions['secret']>('none'),
  busy = ref(true),
  error = ref(''),
  width = ref(832)
const modes = [
    { value: 'angle', label: 'Compare viewing angles' },
    { value: 'height', label: 'Compare wall heights' },
    { value: 'reference', label: 'Current vs selected' },
  ],
  zoomOptions = [
    { value: 'fit', label: 'Fit panel' },
    { value: 0.5, label: 'Natural size' },
    { value: 1, label: 'Enlarged detail' },
  ],
  secretOptions = [
    { value: 'none', label: 'Regular door' },
    { value: 'hidden', label: 'Concealed secret' },
    { value: 'revealed', label: 'Revealed secret' },
  ]
const cards = computed<Card[]>(() => {
  if (mode.value === 'reference')
    return [
      { id: 'reference', label: 'Current editor', angle: 0, rise: 24 },
      { id: 'selected', label: 'Selected preview', angle: angle.value, rise: rise.value },
    ]
  if (mode.value === 'height')
    return UPWARD_SHIFTS.map((value) => ({
      id: `height-${value}`,
      label: `${value}-unit wall height`,
      angle: angle.value,
      rise: value,
    }))
  return VIEW_ANGLES.map((value) => ({
    id: `angle-${value}`,
    label: `${value}° viewing angle`,
    angle: value,
    rise: rise.value,
  }))
})
const comparisonDescription = computed(() =>
  mode.value === 'angle'
    ? `Viewing angles 0° / 5° / 10° / 15° at ${rise.value} units upward.`
    : mode.value === 'height'
      ? `Upward shifts 20 / 24 / 28 / 32 at a ${angle.value}° viewing angle.`
      : 'Current production view beside your selected preview.',
)

const canvases = new Map<string, HTMLCanvasElement>(),
  cache = new Map<string, HTMLCanvasElement>()
let revision = 0,
  running = false,
  disposed = false,
  rendered: { card: Card; image: HTMLCanvasElement }[] = []
const release = (image: HTMLCanvasElement) => {
  image.width = image.height = 1
}
function setCanvas(element: unknown, id: string) {
  if (element instanceof HTMLCanvasElement) canvases.set(id, element)
  else canvases.delete(id)
}
function inspect(card: Card) {
  angle.value = card.angle
  rise.value = card.rise
  mode.value = 'reference'
}
function reset() {
  angle.value = 10
  rise.value = 28
  mode.value = 'angle'
  view.value = 'room'
  zoom.value = 'fit'
  doorsOpen.value = false
  lighting.value = true
  grid.value = false
  secret.value = 'none'
}
function schedule() {
  revision++
  busy.value = true
  if (!running) void refresh()
}
async function refresh() {
  running = true
  try {
    while (!disposed) {
      const id = revision,
        requested = cards.value.map((card) => ({ ...card })),
        selectedView = view.value,
        options: ProjectionStudyOptions = {
          doorsOpen: doorsOpen.value,
          lighting: lighting.value,
          grid: grid.value,
          secret: secret.value,
        },
        frames: typeof rendered = []
      error.value = ''
      try {
        for (const card of requested) {
          const key = JSON.stringify([card.angle, card.rise, options])
          let image = cache.get(key)
          if (!image) {
            image = await renderProjectionStudy({ side: 6, rise: card.rise }, options, card.angle)
            if (disposed) {
              release(image)
              break
            }
            cache.set(key, image)
            while (cache.size > 6) {
              const oldest = cache.keys().next().value!
              release(cache.get(oldest)!)
              cache.delete(oldest)
            }
          }
          const crop = cropProjectionStudy(image, selectedView, card.angle)
          frames.push({ card, image: crop })
          if (id !== revision) break
        }
        if (disposed || id !== revision) {
          frames.forEach((frame) => release(frame.image))
          continue
        }
        await nextTick()
        if (disposed || id !== revision) {
          frames.forEach((frame) => release(frame.image))
          continue
        }
        rendered.forEach((frame) => release(frame.image))
        rendered = frames
        width.value = frames[0]!.image.width
        for (const frame of frames) {
          const target = canvases.get(frame.card.id)
          if (!target) continue
          target.width = frame.image.width
          target.height = frame.image.height
          target.getContext('2d')!.drawImage(frame.image, 0, 0)
        }
      } catch (cause) {
        frames.forEach((frame) => release(frame.image))
        if (!disposed && id === revision)
          error.value = cause instanceof Error ? cause.message : String(cause)
      }
      if (id === revision) break
    }
  } finally {
    running = false
    if (!disposed) busy.value = false
  }
}
function download() {
  if (!rendered.length || busy.value) return
  const gap = 24,
    heading = 48,
    w = rendered[0]!.image.width,
    h = rendered[0]!.image.height,
    columns = 2,
    rows = Math.ceil(rendered.length / columns),
    output = document.createElement('canvas')
  output.width = columns * w + gap * (columns + 1)
  output.height = rows * (h + heading) + gap * (rows + 1)
  const c = output.getContext('2d')!
  c.fillStyle = '#080d10'
  c.fillRect(0, 0, output.width, output.height)
  c.fillStyle = '#dfd4bd'
  c.font = '20px sans-serif'
  for (const [i, frame] of rendered.entries()) {
    const x = gap + (i % columns) * (w + gap),
      y = gap + Math.floor(i / columns) * (h + heading + gap)
    c.fillText(`${frame.card.angle}° view / ${frame.card.rise} upward`, x, y + 30)
    c.drawImage(frame.image, x, y + heading)
  }
  output.toBlob((blob) => {
    release(output)
    if (!blob) return
    const url = URL.createObjectURL(blob),
      link = document.createElement('a')
    link.href = url
    link.download = `projection-${mode.value}-${angle.value}deg-${rise.value}up-${view.value}.png`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, 'image/png')
}
onMounted(schedule)
watch([angle, rise, mode, view, doorsOpen, lighting, grid, secret], schedule, { flush: 'post' })
onBeforeUnmount(() => {
  disposed = true
  revision++
  cache.forEach(release)
  cache.clear()
  rendered.forEach((frame) => release(frame.image))
  rendered = []
  canvases.clear()
})
</script>

<style scoped lang="scss">
.projection-page {
  max-width: 1900px;
  margin: auto;
}
.projection-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  gap: 1.25rem;
}
.projection-select {
  min-width: 12rem;
}
.projection-panels {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1.25rem;
}
.projection-card {
  min-width: 0;
  overflow: hidden;
}
.projection-image {
  overflow: auto;
  background: #080d10;
}
.projection-image canvas {
  display: block;
  max-width: none;
  height: auto;
  margin: auto;
}
@media (min-width: 1400px) {
  .projection-panels:not(.projection-panels--reference) {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
@media (max-width: 850px) {
  .projection-panels {
    grid-template-columns: 1fr;
  }
  .projection-select {
    flex: 1 1 12rem;
  }
}
</style>
