<template>
  <q-layout view="hHh lpR fFf"
    ><q-page-container
      ><q-page class="door-study q-pa-md">
        <div class="row items-center q-gutter-sm q-mb-md">
          <q-btn flat icon="arrow_back" label="3D prototype" to="/dev/dungeon-3d" />
          <div class="text-h5">Door model selection</div>
          <q-space />
          <q-btn-toggle
            v-model="view"
            aria-label="Door study view"
            :options="[
              { label: 'Front', value: 'front' },
              { label: 'Three-quarter', value: 'angled' },
              { label: 'Gameplay', value: 'gameplay' },
            ]"
          />
          <q-toggle v-model="opened" label="Open doors" aria-label="Door study open doors" />
          <q-toggle v-model="warm" label="Amber light" aria-label="Door study amber light" />
          <q-toggle
            v-model="selected"
            label="Selected combination"
            aria-label="Door study selected combination"
          />
        </div>
        <p class="text-grey-4">
          The selected ironbound door now has a thinner surround in the wall's stone, with the broad
          pale threshold retained. This combination is used in the 3D prototype.
        </p>
        <div class="model-headings">
          <div><strong>Original</strong><span>Previous prototype door and pale frame</span></div>
          <div>
            <strong>{{
              selected ? 'Selected · Ironbound and pale stone' : 'A · Quoin-framed oak'
            }}</strong>
            <span>{{
              selected
                ? 'Door 3 · thin wall-stone frame · broad pale threshold'
                : 'Broad oak planks · two forged straps · solid stone lintel'
            }}</span>
          </div>
          <div>
            <strong>B · Arched ironbound</strong
            ><span>Dark narrow planks · three bands · iron edging · wedge-stone arch</span>
          </div>
        </div>
        <div ref="host" class="study-viewport" />
        <q-banner v-if="error" class="bg-negative">{{ error }}</q-banner>
        <div v-if="busy" class="q-pa-md">Loading door models…</div>
        <p class="q-mt-md text-grey-4">
          Toggle Selected combination off to revisit the original three choices. The selected door
          has a straight crown to fit the rectangular frame. Torch selection remains a separate
          step.
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
  opened = ref(false),
  warm = ref(true),
  selected = ref(true),
  busy = ref(true),
  error = ref('')
let study: Awaited<ReturnType<typeof createDoorStudy>> | undefined,
  disposed = false
function update() {
  if (!study) return
  const views: Record<string, [number, number]> = {
    front: [12, 0],
    angled: [26, 16],
    gameplay: [55, 12],
  }
  study.setView(...views[view.value]!)
  study.setWarm(warm.value)
}
watch([view, warm], update)
watch(opened, (value) => study?.setOpen(value))
watch(selected, (value) => study?.setSelected(value))
onMounted(async () => {
  try {
    study = await createDoorStudy(host.value!)
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
.door-study {
  background: #101619;
  color: #e6e2d7;
}
.model-headings {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
  text-align: center;
}
.model-headings strong {
  display: block;
  font-size: 1.1rem;
}
.model-headings span {
  display: block;
  font-size: 0.8rem;
  color: #aeb6b9;
  margin-top: 0.3rem;
}
.study-viewport {
  height: clamp(400px, 65vh, 780px);
  margin-top: 1rem;
  border: 1px solid #465057;
  border-radius: 4px;
}
</style>
