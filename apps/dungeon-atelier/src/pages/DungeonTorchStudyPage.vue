<template>
  <q-layout view="hHh lpR fFf"
    ><q-page-container
      ><q-page class="torch-study q-pa-md">
        <div class="row items-center q-gutter-sm q-mb-md">
          <q-btn flat label="3D prototype" to="/dev/dungeon-3d" icon="arrow_back" />
          <div class="text-h5">Torch model selection</div>
          <q-space />
          <q-btn-toggle
            v-model="view"
            aria-label="Torch study view"
            :options="[
              { label: 'Front', value: 'front' },
              { label: 'Three-quarter', value: 'angled' },
              { label: 'Gameplay', value: 'gameplay' },
            ]"
          />
          <q-toggle v-model="warm" label="Amber light" aria-label="Torch study amber light" />
        </div>
        <p class="text-grey-4">
          Model B, the wall brazier, is selected and applied in the 3D prototype. These alternatives
          remain available with shared camera, wall context, and lighting.
        </p>
        <div class="row justify-center q-mb-md">
          <q-btn-toggle
            v-model="focus"
            aria-label="Torch study focus"
            :options="[
              { label: 'All three', value: -1 },
              { label: 'Existing close-up', value: 0 },
              { label: 'A close-up', value: 1 },
              { label: 'B close-up', value: 2 },
            ]"
          />
        </div>
        <div class="headings" v-if="focus < 0">
          <div><strong>Existing</strong><span>Current cage torch</span></div>
          <div>
            <strong>A · Forged basket</strong
            ><span>Tapered cage · long wall plate · straight bracket · charred handle</span>
          </div>
          <div>
            <strong>B · Wall brazier</strong
            ><span>Shallow iron cup · crown prongs · curved support · no handle</span>
          </div>
        </div>
        <div ref="host" class="study-viewport" />
        <q-banner v-if="error" class="bg-negative">{{ error }}</q-banner>
        <p class="q-mt-md text-grey-4">
          Selected: B · Wall brazier. Flames remain static here for comparison; the 3D prototype has
          optional flame flicker.
        </p>
      </q-page></q-page-container
    ></q-layout
  >
</template>
<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { createDoorStudy } from '../experiments/dungeon-3d/door-study'
const host = ref<HTMLElement>(),
  view = ref('angled'),
  focus = ref(-1),
  warm = ref(true),
  busy = ref(true),
  error = ref('')
let study: Awaited<ReturnType<typeof createDoorStudy>> | undefined,
  disposed = false
function update() {
  if (!study) return
  const views: Record<string, [number, number]> = {
    front: [12, 0],
    angled: [26, 35],
    gameplay: [55, 12],
  }
  study.setView(...views[view.value]!)
  study.setWarm(warm.value)
  study.setFocus(focus.value)
}
watch([view, warm, focus], update)
onMounted(async () => {
  try {
    study = await createDoorStudy(host.value!, 'torch')
    if (disposed) {
      study.dispose()
      return
    }
    update()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    busy.value = false
  }
})
onBeforeUnmount(() => {
  disposed = true
  study?.dispose()
})
defineExpose({
  getState: () => ({ busy: busy.value, error: error.value, ...study?.state() }),
  capture: () => study?.png(),
})
</script>
<style scoped>
.torch-study {
  background: #101619;
  color: #e6e2d7;
}
.headings {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  text-align: center;
  gap: 1rem;
}
.headings strong,
.headings span {
  display: block;
}
.headings span {
  font-size: 0.8rem;
  color: #aeb6b9;
  margin-top: 0.3rem;
}
.study-viewport {
  height: clamp(400px, 65vh, 780px);
  border: 1px solid #465057;
  border-radius: 4px;
}
</style>
