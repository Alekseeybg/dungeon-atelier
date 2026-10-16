<template>
  <q-layout view="hHh lpR fFf"
    ><q-page-container
      ><q-page class="polish-page q-pa-lg">
        <div class="row items-center q-gutter-md q-mb-lg">
          <q-btn
            flat
            icon="west"
            label="Visual foundation"
            to="/visual-foundation?profile=chamfer"
          />
          <div class="col">
            <h1 class="text-h4 q-my-none">Final stairs &amp; wall torches</h1>
            <div class="text-body1 text-grey-5">
              Ancient Ruined Dungeon · approved architectural foundation
            </div>
          </div>
          <q-badge outline color="amber-4">Approved reference</q-badge>
        </div>
        <q-card flat bordered class="q-pa-md q-mb-md"
          ><div class="row items-center q-gutter-md">
            <q-select
              v-model="stairs"
              :options="STAIR_PRESENTATIONS"
              emit-value
              map-options
              outlined
              dense
              label="Stair presentation"
              aria-label="Final stair presentation"
              style="min-width: 19rem"
            />
            <q-select
              v-model="arrow"
              :options="STAIR_ARROWS"
              emit-value
              map-options
              outlined
              dense
              label="Adjacent stair symbol"
              aria-label="Stair arrow style"
              style="min-width: 20rem"
            />
            <q-select
              v-model="view"
              :options="views"
              emit-value
              map-options
              outlined
              dense
              label="Review view"
              aria-label="Final polish view"
              style="min-width: 15rem"
            />
            <q-toggle
              v-model="lighting"
              label="Torch lighting"
              aria-label="Final polish lighting"
            />
            <q-toggle
              v-model="compare"
              label="Compare north-wall mounting"
              aria-label="Final torch comparison"
              @update:model-value="compareStairs = false"
            />
            <q-toggle
              v-model="compareStairs"
              label="Compare without symbols"
              aria-label="Stair direction comparison"
              @update:model-value="compare = false"
            />
            <q-btn-toggle
              v-model="zoom"
              :options="[
                { label: 'Normal zoom', value: 0.5 },
                { label: '2× detail', value: 1 },
              ]"
              no-caps
              unelevated
              toggle-color="primary"
              aria-label="Final polish zoom"
            />
            <q-btn
              outline
              no-caps
              icon="download"
              label="Save PNG"
              :disable="busy"
              @click="download"
            /></div
        ></q-card>
        <q-banner v-if="error" class="bg-red-10 q-mb-md">{{ error }}</q-banner>
        <div class="polish-panels" :class="{ 'polish-panels--compare': compare || compareStairs }">
          <q-card v-if="compare || compareStairs" flat bordered
            ><q-card-section class="text-subtitle1">{{
              compareStairs
                ? 'Staircases without level symbols'
                : 'Before · flat north-wall mounting'
            }}</q-card-section>
            <div class="polish-image">
              <canvas
                ref="beforeCanvas"
                aria-label="Previous torch presentation"
                :style="{ width: `${width * zoom}px` }"
              /></div
          ></q-card>
          <q-card flat bordered
            ><q-card-section class="row items-center"
              ><div class="col">
                <div class="text-subtitle1">
                  {{ STAIR_PRESENTATIONS.find((s) => s.value === stairs)?.label }}
                </div>
                <div class="text-caption text-grey-5">
                  Projecting north sconce · separate flame layer · unchanged lighting
                </div>
              </div>
              <q-spinner v-if="busy" color="amber-4"
            /></q-card-section>
            <div class="polish-image">
              <canvas
                ref="candidate"
                aria-label="Final details artwork"
                :style="{ width: `${width * zoom}px` }"
              /></div
          ></q-card>
        </div>
        <div class="row q-col-gutter-lg q-mt-md text-body1">
          <div class="col-12 col-md-7">
            <p>
              The northwest flight rises above the floor; the northeast well descends into shadow.
              Each uses six stone treads, fitted entry paving and the same projection as the walls.
              Separate plaques beside the stairs identify up/down level travel. Both flights stay
              unmarked: the up flight keeps its stronger stepped profile, and the down well keeps
              its recessed geometry.
            </p>
            <p>
              The north sconces retain the wall-bound backplate, with a dimensional iron arm
              projecting into the room and a separately drawn flame. The west-wall sconce has its
              own side artwork; its light starts on the room-facing side and stops at masonry and
              closed doors.
            </p>
          </div>
          <div class="col-12 col-md-5">
            <p class="text-amber-3">
              Recommendation: fitted stone well with adjacent brass level symbols, and the mounted
              iron sconce.
            </p>
            <p class="text-grey-5">
              The room layout, doors, floors, walls and cap profile are preserved. These final
              details use the same compositor as the real generator.
            </p>
          </div>
        </div>
      </q-page></q-page-container
    ></q-layout
  >
</template>
<script setup lang="ts">
import { ref, onMounted, watch, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { renderFoundation } from '../features/dungeon/rendering/visual-foundation/renderer'
import { FINAL_FOUNDATION } from '../features/dungeon/rendering/visual-foundation/final-style'
import { createFinishingScene } from '../features/dungeon/rendering/visual-foundation/finishing-scene'
import {
  STAIR_PRESENTATIONS,
  STAIR_ARROWS,
} from '../features/dungeon/rendering/visual-foundation/finishing-model'
import type {
  StairPresentation,
  StairArrow,
} from '../features/dungeon/rendering/visual-foundation/finishing-model'
import { cropFinishing } from '../features/dungeon/rendering/visual-foundation/finishing-comparison'
import type { FinishingView } from '../features/dungeon/rendering/visual-foundation/finishing-comparison'
const route = useRoute(),
  stairs = ref<StairPresentation>('recessed'),
  arrow = ref<StairArrow>('brass'),
  view = ref<FinishingView>(route.query.view === 'stairs' ? 'stairs' : 'room'),
  lighting = ref(true),
  compare = ref(false),
  compareStairs = ref(route.query.compare === 'stairs'),
  zoom = ref(0.5),
  busy = ref(true),
  error = ref(''),
  width = ref(800),
  candidate = ref<HTMLCanvasElement>(),
  beforeCanvas = ref<HTMLCanvasElement>()
const scene = createFinishingScene(),
  views = [
    { value: 'room', label: 'Four-door room' },
    { value: 'stairs', label: 'Stairs · up / down' },
    { value: 'torch', label: 'Torch close-up' },
    { value: 'mount', label: 'Torch + wall integration' },
    { value: 'side', label: 'Side-mounted sconce' },
  ]
let request = 0,
  rendered: HTMLCanvasElement | undefined
function paint(target: HTMLCanvasElement | undefined, image: HTMLCanvasElement) {
  if (!target) return
  target.width = image.width
  target.height = image.height
  target.getContext('2d')!.drawImage(image, 0, 0)
}
async function refresh() {
  const id = ++request
  busy.value = true
  error.value = ''
  try {
    const options = {
        ...FINAL_FOUNDATION,
        stairs: stairs.value,
        stairArrow: arrow.value,
        lighting: lighting.value,
      },
      image = cropFinishing(await renderFoundation(options, scene), view.value),
      before =
        compare.value || compareStairs.value
          ? cropFinishing(
              await renderFoundation(
                compareStairs.value
                  ? { ...options, stairArrow: 'none' }
                  : { ...options, northTorchMount: 'flat' },
                scene,
              ),
              view.value,
            )
          : undefined
    if (id !== request) return
    await nextTick()
    rendered = image
    width.value = image.width
    paint(candidate.value, image)
    if (before) paint(beforeCanvas.value, before)
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    if (id === request) busy.value = false
  }
}
function download() {
  rendered?.toBlob((blob) => {
    if (!blob) return
    const url = URL.createObjectURL(blob),
      a = document.createElement('a')
    a.href = url
    a.download = `final-polish-${stairs.value}-${view.value}.png`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, 'image/png')
}
onMounted(() => {
  void refresh()
})
watch([stairs, arrow, view, lighting, compare, compareStairs], () => {
  void refresh()
})
</script>
<style scoped lang="scss">
.polish-page {
  max-width: 1800px;
  margin: auto;
}
.polish-panels {
  display: grid;
  gap: 1rem;
}
.polish-panels--compare {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.polish-panels > .q-card {
  min-width: 0;
}
.polish-image {
  background: #080d10;
  overflow: auto;
}
.polish-image canvas {
  display: block;
  max-width: none;
  height: auto;
  margin: auto;
}
@media (max-width: 1000px) {
  .polish-panels--compare {
    grid-template-columns: 1fr;
  }
}
</style>
