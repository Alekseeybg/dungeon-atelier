<template>
  <q-layout view="hHh lpR fFf"
    ><q-page-container>
      <q-page class="foundation-page q-pa-lg">
        <div class="row items-center q-gutter-md q-mb-lg">
          <q-btn flat icon="west" label="Dungeon studio" to="/" />
          <div class="col-12 col-md">
            <h1 class="text-h4 q-my-none">Visual foundation</h1>
            <div class="text-body1 text-grey-5">
              One room · four doorways · isolated artwork study
            </div>
          </div>
          <q-badge outline color="amber-4" label="Awaiting visual approval" />
        </div>
        <q-banner rounded class="foundation-profile-notice q-mb-md">
          <div class="text-subtitle1">Latest study · sharply cut coping stones</div>
          <div class="text-body2">
            {{
              compareProfiles
                ? 'Previous chamfered caps on the left; squared stone corners, crisp joints and sharper planes on the right. Same profile, camera and scene.'
                : 'Open the comparison to review sharply shaped coping stones against the previous chamfered caps.'
            }}
          </div>
          <template #action>
            <q-btn
              flat
              no-caps
              label="Final stairs & torches"
              to="/visual-foundation/final-polish"
            />
            <q-btn
              v-if="!compareProfiles"
              color="primary"
              unelevated
              no-caps
              label="Show chamfer comparison"
              aria-label="Show chamfer comparison"
              @click="showChamfer"
            />
          </template>
        </q-banner>
        <q-card flat bordered class="q-pa-md q-mb-md">
          <div class="row items-center q-gutter-md">
            <q-select
              v-model="treatment"
              :options="treatments"
              emit-value
              map-options
              outlined
              dense
              label="Masonry treatment"
              style="min-width: 15rem"
              aria-label="Foundation treatment"
            />
            <q-toggle
              v-model="compareMaterials"
              label="Compare A / B"
              aria-label="Foundation materials comparison"
            />
            <q-select
              v-model="view"
              :options="views"
              emit-value
              map-options
              outlined
              dense
              label="View"
              style="min-width: 12rem"
              aria-label="Foundation view"
            />
            <q-btn-toggle
              v-model="doors"
              :options="[
                { label: 'Closed doors', value: 'closed' },
                { label: 'Open doorways', value: 'open' },
              ]"
              no-caps
              unelevated
              toggle-color="primary"
              aria-label="Foundation doors"
            />
            <q-toggle
              v-model="lighting"
              label="Candidate torchlight"
              aria-label="Foundation lighting"
            />
            <q-toggle v-model="grid" label="Logical grid" aria-label="Foundation grid" />
            <q-select
              v-model="floor"
              :options="FLOOR_STUDIES"
              emit-value
              map-options
              outlined
              dense
              label="Floor study"
              style="min-width: 17rem"
              aria-label="Foundation floor"
            >
              <template #option="scope">
                <q-item v-bind="scope.itemProps">
                  <q-item-section avatar
                    ><q-avatar rounded size="42px"
                      ><img :src="scope.opt.url" alt="" loading="lazy" /></q-avatar
                  ></q-item-section>
                  <q-item-section
                    ><q-item-label>{{ scope.opt.label }}</q-item-label
                    ><q-item-label caption>{{
                      scope.opt.description
                    }}</q-item-label></q-item-section
                  >
                </q-item>
              </template>
            </q-select>
            <q-toggle
              v-model="compareFloors"
              label="Compare floors"
              aria-label="Foundation floor comparison"
            />
            <q-select
              v-if="compareFloors"
              v-model="referenceFloor"
              :options="FLOOR_STUDIES"
              emit-value
              map-options
              outlined
              dense
              label="Comparison floor"
              style="min-width: 17rem"
              aria-label="Foundation comparison floor"
            />
            <q-btn
              v-if="compareFloors"
              flat
              round
              :icon="matSwapHoriz"
              aria-label="Swap floors"
              @click="swapFloors"
            />
            <q-toggle
              v-model="separation"
              label="Structural separation"
              aria-label="Foundation separation"
            />
            <q-toggle
              v-model="capPolish"
              label="Worn cap edges"
              aria-label="Foundation cap polish"
              :disable="coping !== 'current' || compareCoping || compareProfiles"
            />
            <q-select
              v-model="coping"
              :options="COPING_STUDIES"
              emit-value
              map-options
              outlined
              dense
              label="Coping masonry"
              aria-label="Foundation coping"
              style="min-width: 15rem"
              :disable="compareCoping || compareProfiles"
            />
            <q-toggle
              v-model="compareCoping"
              label="Compare cap masonry"
              aria-label="Foundation coping comparison"
              :disable="compareProfiles"
            />
            <q-toggle
              v-model="compareProfiles"
              label="Compare chamfer profile"
              aria-label="Foundation profile comparison"
              :disable="compareCoping"
            />
            <q-btn-toggle
              v-if="compareCoping || compareProfiles"
              v-model="copingZoom"
              :options="[
                { label: '1× review', value: 0.5 },
                { label: '2× review', value: 1 },
              ]"
              no-caps
              unelevated
              toggle-color="primary"
              aria-label="Foundation coping zoom"
            />
            <q-toggle
              v-model="compareCaps"
              label="Compare cap effects"
              aria-label="Foundation cap comparison"
            />
            <q-select
              v-model="secret"
              :options="secrets"
              emit-value
              map-options
              outlined
              dense
              label="North entrance"
              style="min-width: 12rem"
              aria-label="Foundation secret"
            />
            <q-toggle
              v-model="compare"
              label="Compare baseline"
              aria-label="Foundation comparison"
            />
            <q-btn
              outline
              no-caps
              icon="download"
              :label="compareProfiles ? 'Save comparison PNG' : 'Save PNG'"
              :disable="busy"
              @click="download"
            />
          </div>
        </q-card>
        <q-banner v-if="error" class="bg-red-10 q-mb-md">{{ error }}</q-banner>
        <div
          class="foundation-panels"
          :class="{
            'foundation-panels--compare':
              compare ||
              compareMaterials ||
              compareFloors ||
              compareCaps ||
              compareCoping ||
              compareProfiles,
            'foundation-panels--coping': compareCoping,
          }"
        >
          <q-card v-if="compareCaps" flat bordered>
            <q-card-section class="text-subtitle1">Current caps · effects off</q-card-section>
            <div class="foundation-image">
              <canvas ref="capComparisonCanvas" aria-label="Current cap artwork" />
            </div>
          </q-card>
          <q-card v-if="compare" flat bordered
            ><q-card-section class="text-subtitle1">Current Dimensional Stone</q-card-section>
            <div class="foundation-image">
              <canvas ref="baselineCanvas" aria-label="Baseline artwork" /></div
          ></q-card>
          <q-card flat bordered
            ><q-card-section class="row items-center"
              ><div class="col">
                <div class="text-subtitle1">
                  {{ compareProfiles ? 'Previous chamfered caps' : treatmentName(treatment) }}
                </div>
                <div class="text-caption text-grey-5">{{ floorStudy(floor).label }}</div>
                <div class="text-caption text-amber-3">
                  {{
                    COPING_STUDIES.find(
                      (s) =>
                        s.value === (compareProfiles ? 'hewn' : compareCoping ? 'current' : coping),
                    )?.label
                  }}
                </div>
                <div v-if="compareCaps" class="text-caption text-amber-3">
                  {{ capPolish && separation ? 'Cap effects on' : 'Cap effects off' }}
                </div>
              </div>
              <q-spinner v-if="busy" color="amber-4"
            /></q-card-section>
            <div class="foundation-image">
              <canvas
                ref="candidateCanvas"
                aria-label="Candidate artwork"
                :style="
                  compareCoping || compareProfiles
                    ? {
                        width: `${copingPanelWidth * copingZoom}px`,
                        maxWidth: 'none',
                      }
                    : undefined
                "
              /></div
          ></q-card>
          <q-card v-if="compareCoping || compareProfiles" flat bordered>
            <q-card-section
              ><div class="text-subtitle1">
                {{ compareProfiles ? 'Chiseled coping stones' : 'Heavy hewn coping' }}
              </div>
              <div class="text-caption text-grey-5">
                {{ treatmentName(treatment) }} · same floor, faces and lighting
              </div></q-card-section
            >
            <div class="foundation-image">
              <canvas
                ref="hewnCanvas"
                :aria-label="compareProfiles ? 'Chamfered cap artwork' : 'Hewn coping artwork'"
                :style="{ width: `${copingPanelWidth * copingZoom}px`, maxWidth: 'none' }"
              />
            </div>
          </q-card>
          <q-card v-if="compareCoping" flat bordered>
            <q-card-section
              ><div class="text-subtitle1">Broken ancient slabs</div>
              <div class="text-caption text-grey-5">
                {{ treatmentName(treatment) }} · same floor, faces and lighting
              </div></q-card-section
            >
            <div class="foundation-image">
              <canvas
                ref="brokenCanvas"
                aria-label="Broken coping artwork"
                :style="{
                  width: `${copingPanelWidth * copingZoom}px`,
                  maxWidth: 'none',
                }"
              />
            </div>
          </q-card>
          <q-card v-if="compareFloors" flat bordered>
            <q-card-section
              ><div class="text-subtitle1">{{ treatmentName(treatment) }}</div>
              <div class="text-caption text-grey-5">
                {{ floorStudy(referenceFloor).label }}
              </div></q-card-section
            >
            <div class="foundation-image">
              <canvas ref="floorComparisonCanvas" aria-label="Comparison floor artwork" />
            </div>
          </q-card>
          <q-card v-if="compareMaterials" flat bordered>
            <q-card-section class="text-subtitle1">{{
              treatmentName(otherTreatment())
            }}</q-card-section>
            <div class="foundation-image">
              <canvas ref="otherCanvas" aria-label="Alternate masonry artwork" />
            </div>
          </q-card>
        </div>
        <div class="row q-col-gutter-lg q-mt-md text-body1">
          <div class="col-12 col-md-7">
            <p>
              Review the stone construction and doorway joins with torchlight switched off as well
              as on. North/south doors occupy horizontal walls; east/west doors are projected
              profiles on vertical walls.
            </p>
            <p class="text-grey-5">
              The candidate uses 32×26 visual ground cells, a 6px west / 24px north height offset,
              and artwork rendered at two pixels per logical unit. The editor and generator retain
              their existing coordinates.
            </p>
          </div>
          <div class="col-12 col-md-5">
            <p class="text-amber-3">
              This is a visual candidate, not an approved replacement theme.
            </p>
            <p class="text-grey-5">
              Floor study includes all generated alternatives, the current candidate, and the
              previous floor. Compare floors holds masonry, view, doors, and lighting constant.
              These are artwork studies awaiting selection. Narrow door profiles and repeated
              materials still need visual review. Open doorways preview an empty opening. Worn cap
              edges uses the existing cap art; Compare cap effects shows the same scene before and
              after the treatment. Disable Worn cap edges to restore the previous caps. Compare cap
              masonry shows the current cap and two new block assemblies, with the earlier effects
              experiment disabled. These remain approval-stage studies.
            </p>
          </div>
        </div>
      </q-page>
    </q-page-container></q-layout
  >
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { matSwapHoriz } from '@quasar/extras/material-icons'
import { renderFoundation } from '../features/dungeon/rendering/visual-foundation/renderer'
import {
  renderFoundationBaseline,
  cropFoundation,
  cropCoping,
} from '../features/dungeon/rendering/visual-foundation/comparison'
import type { FoundationView } from '../features/dungeon/rendering/visual-foundation/comparison'
import type { FoundationTreatment } from '../features/dungeon/rendering/visual-foundation/art'
import { FLOOR_STUDIES, floorStudy } from '../features/dungeon/rendering/visual-foundation/art'
import type { FoundationFloor } from '../features/dungeon/rendering/visual-foundation/art'
import { COPING_STUDIES } from '../features/dungeon/rendering/visual-foundation/coping-model'
import type { CopingStudy } from '../features/dungeon/rendering/visual-foundation/coping-model'
const route = useRoute(),
  router = useRouter()
const compareProfiles = ref(route.query.profile === 'chamfer')
const coping = ref<CopingStudy>(compareProfiles.value ? 'hewn' : 'current'),
  compareCoping = ref(route.query.coping === 'compare' && !compareProfiles.value),
  copingZoom = ref(0.5)
const copingPanelWidth = ref(800)
const treatment = ref<FoundationTreatment>('ruins'),
  compareMaterials = ref(false)
const treatments = [
  { label: 'A · Ancient Ruined Dungeon', value: 'ruins' },
  { label: 'B · Medieval Fortress', value: 'fortress' },
  { label: 'Previous materials', value: 'original' },
]
const treatmentName = (value: FoundationTreatment) =>
  treatments.find((t) => t.value === value)!.label
const otherTreatment = (): FoundationTreatment =>
  treatment.value === 'fortress' ? 'ruins' : 'fortress'
const view = ref<FoundationView>('room'),
  doors = ref<'closed' | 'open'>('closed'),
  lighting = ref(true),
  grid = ref(false)
const separation = ref(true)
const capPolish = ref(true),
  compareCaps = ref(false)
const floor = ref<FoundationFloor>('refined'),
  referenceFloor = ref<FoundationFloor>('previous'),
  compareFloors = ref(false)
function swapFloors() {
  const previous = floor.value
  floor.value = referenceFloor.value
  referenceFloor.value = previous
}
const secret = ref<'none' | 'hidden' | 'revealed'>('none'),
  compare = ref(false),
  busy = ref(true),
  error = ref('')
const candidateCanvas = ref<HTMLCanvasElement>(),
  baselineCanvas = ref<HTMLCanvasElement>(),
  otherCanvas = ref<HTMLCanvasElement>(),
  floorComparisonCanvas = ref<HTMLCanvasElement>(),
  capComparisonCanvas = ref<HTMLCanvasElement>(),
  hewnCanvas = ref<HTMLCanvasElement>(),
  brokenCanvas = ref<HTMLCanvasElement>()
const views = [
  { label: 'Central room', value: 'room' },
  { label: 'Whole layout', value: 'scene' },
  { label: 'Masonry and corners', value: 'architecture' },
  { label: 'Wall corner detail', value: 'wall-detail' },
  { label: 'East wall detail', value: 'east-wall' },
  { label: 'South-east corner', value: 'south-east' },
  { label: 'South coping edge', value: 'coping-edge' },
  { label: 'Floor center', value: 'floor-center' },
  { label: 'Floor near wall', value: 'floor-edge' },
  { label: 'North / south doors', value: 'doors-ns' },
  { label: 'East / west doors', value: 'doors-ew' },
]
const secrets = [
  { label: 'Regular door', value: 'none' },
  { label: 'Concealed secret', value: 'hidden' },
  { label: 'Revealed secret', value: 'revealed' },
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
      treatment: treatment.value,
      separation: separation.value,
      floor: floor.value,
      doors: doors.value,
      lighting: lighting.value,
      grid: grid.value,
      secret: secret.value,
      capPolish:
        compareProfiles.value || compareCoping.value || coping.value !== 'current'
          ? false
          : capPolish.value,
      coping: compareProfiles.value
        ? ('hewn' as const)
        : compareCoping.value
          ? ('current' as const)
          : coping.value,
      ...(compareProfiles.value ? { capProfile: 'chamfered' as const } : {}),
    }
    const candidate = await renderFoundation(options)
    const baseline = compare.value ? await renderFoundationBaseline(options) : undefined
    const other = compareMaterials.value
      ? await renderFoundation({ ...options, treatment: otherTreatment() })
      : undefined
    const alternateFloor = compareFloors.value
      ? await renderFoundation({ ...options, floor: referenceFloor.value })
      : undefined
    const currentCaps = compareCaps.value
      ? await renderFoundation({ ...options, coping: 'current', capPolish: false })
      : undefined
    const hewn =
      compareCoping.value || compareProfiles.value
        ? await renderFoundation({
            ...options,
            coping: 'hewn',
            capProfile: compareProfiles.value ? 'chamfered' : 'raised',
            ...(compareProfiles.value ? { capFinish: 'cut' as const } : {}),
          })
        : undefined
    const broken = compareCoping.value
      ? await renderFoundation({ ...options, coping: 'broken' })
      : undefined
    if (id !== request) return
    await nextTick()
    rendered =
      compareCoping.value || compareProfiles.value
        ? cropCoping(candidate, view.value)
        : cropFoundation(candidate, view.value)
    copingPanelWidth.value = rendered.width
    paint(candidateCanvas.value, rendered)
    if (baseline) paint(baselineCanvas.value, cropFoundation(baseline, view.value, true))
    if (other) paint(otherCanvas.value, cropFoundation(other, view.value))
    if (alternateFloor)
      paint(floorComparisonCanvas.value, cropFoundation(alternateFloor, view.value))
    if (currentCaps) paint(capComparisonCanvas.value, cropFoundation(currentCaps, view.value))
    if (hewn) paint(hewnCanvas.value, cropCoping(hewn, view.value))
    if (broken) paint(brokenCanvas.value, cropCoping(broken, view.value))
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    if (id === request) busy.value = false
  }
}
function download() {
  if (!rendered) return
  let image = rendered
  if (compareProfiles.value && hewnCanvas.value) {
    const right = hewnCanvas.value
    image = document.createElement('canvas')
    image.width = rendered.width + right.width + 32
    image.height = Math.max(rendered.height, right.height) + 64
    const c = image.getContext('2d')!
    c.fillStyle = '#080d10'
    c.fillRect(0, 0, image.width, image.height)
    c.fillStyle = '#e8dac0'
    c.font = '24px sans-serif'
    c.fillText('Previous chamfered caps', 12, 38)
    c.fillText('Chiseled coping stones', rendered.width + 44, 38)
    c.drawImage(rendered, 0, 64)
    c.drawImage(right, rendered.width + 32, 64)
  }
  image.toBlob((blob) => {
    if (!blob) return
    const url = URL.createObjectURL(blob),
      anchor = document.createElement('a')
    anchor.href = url
    anchor.download = compareProfiles.value
      ? `visual-foundation-${treatment.value}-${floor.value}-${view.value}-chamfer-comparison.png`
      : `visual-foundation-${treatment.value}-${floor.value}-${view.value}-${doors.value}-${compareCoping.value ? 'current' : coping.value}${capPolish.value && separation.value && coping.value === 'current' && !compareCoping.value ? '-cap-polish' : ''}.png`
    anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, 'image/png')
}
function showChamfer() {
  compareCoping.value = false
  view.value = 'room'
  copingZoom.value = 0.5
  compareProfiles.value = true
}
onMounted(() => {
  void refresh()
})
watch(compareProfiles, (enabled) => {
  void router.replace({
    query: { ...route.query, profile: enabled ? 'chamfer' : undefined },
  })
  if (!enabled) return
  coping.value = 'hewn'
  compareCoping.value =
    compareCaps.value =
    compareMaterials.value =
    compareFloors.value =
    compare.value =
      false
})
// Same-page navigation to a shared comparison URL must update the mounted demo.
watch(
  () => route.query.profile,
  (profile) => {
    compareProfiles.value = profile === 'chamfer'
  },
)
watch(
  [
    view,
    doors,
    lighting,
    grid,
    secret,
    compare,
    treatment,
    compareMaterials,
    separation,
    floor,
    referenceFloor,
    compareFloors,
    capPolish,
    compareCaps,
    coping,
    compareCoping,
    compareProfiles,
    copingZoom,
  ],
  () => {
    void refresh()
  },
)
</script>

<style scoped lang="scss">
.foundation-page {
  max-width: 1800px;
  margin: auto;
}
.foundation-profile-notice {
  background: #252a30;
  border: 1px solid #b79b69;
}
.foundation-panels {
  display: grid;
  gap: 1rem;
}
.foundation-panels > .q-card {
  min-width: 0;
}
.foundation-panels--compare {
  grid-template-columns: 1fr 1fr;
}
.foundation-panels--coping {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}
.foundation-panels--compare > .q-card > .q-card__section {
  min-height: 7rem;
}
.foundation-image {
  background: #080d10;
  overflow: auto;
  border-radius: 0 0 8px 8px;
}
.foundation-image canvas {
  display: block;
  max-width: 100%;
  height: auto;
  margin: auto;
}
@media (max-width: 1000px) {
  .foundation-panels--compare,
  .foundation-panels--coping {
    grid-template-columns: 1fr;
  }
}
</style>
