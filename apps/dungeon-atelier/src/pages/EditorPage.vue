<template>
  <q-page class="editor-page">
    <q-toolbar class="workspace-toolbar q-px-md">
      <q-toolbar-title class="text-body2">
        {{ store.source === 'imported' ? 'Imported floor' : 'Generation studio' }}
        <q-badge
          v-if="store.hasPendingChanges"
          outline
          color="primary"
          label="Pending settings"
          class="q-ml-sm"
        />
      </q-toolbar-title>
      <q-btn-dropdown
        flat
        no-caps
        icon="tune"
        :label="$q.screen.lt.sm ? undefined : 'Display'"
        class="display-menu-button"
        aria-label="Display preferences"
      >
        <q-list class="display-menu">
          <q-item-label header>Interface text size</q-item-label>
          <q-item
            v-for="option in textSizes"
            :key="option.value"
            clickable
            v-close-popup
            @click="setTextSize(option.value)"
            :active="textSize === option.value"
            active-class="text-primary"
            :aria-label="option.label + ' text size'"
            :aria-pressed="textSize === option.value"
          >
            <q-item-section
              ><q-item-label>{{ option.label }}</q-item-label
              ><q-item-label caption>{{ option.caption }}</q-item-label></q-item-section
            >
            <q-item-section side
              ><q-icon v-if="textSize === option.value" name="check"
            /></q-item-section>
          </q-item>
        </q-list>
      </q-btn-dropdown>
      <input
        ref="fileInput"
        type="file"
        accept=".json,application/json"
        class="file-input"
        aria-label="Import dungeon JSON"
        @change="importFile"
      />
      <q-btn
        flat
        no-caps
        icon="upload_file"
        label="Import"
        :disable="store.busy || importing"
        :loading="importing"
        @click="fileInput?.click()"
        ><q-tooltip>Import dungeon JSON</q-tooltip></q-btn
      >
      <q-btn-dropdown
        outline
        no-caps
        color="primary"
        icon="download"
        label="Export"
        :disable="!store.floor || store.busy || exporting || rendering || !renderReady"
        :loading="exporting"
        class="q-ml-sm"
      >
        <q-list style="min-width: 210px">
          <q-item v-close-popup clickable @click="exportPng"
            ><q-item-section avatar><q-icon name="image" /></q-item-section
            ><q-item-section
              ><q-item-label>PNG image</q-item-label
              ><q-item-label caption>Full map, selected appearance</q-item-label></q-item-section
            ></q-item
          >
          <q-item v-close-popup clickable @click="exportJson"
            ><q-item-section avatar><q-icon name="data_object" /></q-item-section
            ><q-item-section
              ><q-item-label>Dungeon JSON</q-item-label
              ><q-item-label caption>Layout and settings</q-item-label></q-item-section
            ></q-item
          >
        </q-list>
      </q-btn-dropdown>
    </q-toolbar>
    <q-banner v-if="store.errors.length" rounded class="error-banner q-mx-md q-mt-md" role="alert">
      <template #avatar><q-icon name="error_outline" color="negative" /></template>
      <div class="text-weight-medium">Could not complete the operation.</div>
      <div v-for="error in store.errors" :key="error">{{ error }}</div>
      <template #action
        ><q-btn
          flat
          round
          dense
          icon="close"
          aria-label="Dismiss errors"
          @click="store.errors = []"
      /></template>
    </q-banner>
    <q-tabs
      v-model="workspaceTab"
      dense
      no-caps
      active-color="primary"
      indicator-color="primary"
      class="workspace-tabs"
      aria-label="Workspace panels"
      align="justify"
    >
      <q-tab name="map" label="Dungeon" icon="layers" />
      <q-tab name="settings" label="Settings" icon="tune" />
      <q-tab name="report" label="Report" icon="data_object" />
    </q-tabs>
    <div class="editor-workbench" :class="'workspace-view--' + workspaceTab">
      <GeneratorPanel class="workbench-settings" />
      <div class="center-panel workbench-map">
        <DungeonCanvas
          :floor="store.floor"
          :selected="selected"
          :walk="walker.state"
          :shortcut-focus="shortcutFocus"
          @inspect="inspectTile"
          @error="store.reportError"
          @grid="showGrid = $event"
          @style="mapStyle = $event"
          @secrets="revealSecrets = $event"
          @appearance="renderOptions = $event"
          @rendering="rendering = $event"
          @render-ready="renderReady = $event"
          @walk="walker.command"
        />
        <div class="workspace-footnote text-caption text-grey-5" role="status">
          <q-icon v-if="store.message" name="check" color="positive" class="q-mr-xs" />{{
            store.message || 'Ready to generate.'
          }}
        </div>
      </div>
      <DiagnosticsPanel
        class="workbench-report"
        :floor="store.floor"
        :selected="selected"
        :walk="walker.state"
        :map-style="mapStyle"
        :render-options="renderOptions"
        :conceal-secrets="mapStyle === 'ancient' && !revealSecrets"
        @inspect="locateTile"
        @locate-shortcut="locateShortcut"
      />
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import { useDungeonWalk } from '@/features/dungeon/exploration/useDungeonWalk'
import type { Position } from '@dungeon-atelier/core'
import type { MapStyle, MapRenderOptions } from '@/features/dungeon/rendering/dungeon-renderer'
import { useDungeonStore } from '@/stores/dungeon'
import GeneratorPanel from '@/features/dungeon/components/GeneratorPanel.vue'
import DungeonCanvas from '@/features/dungeon/components/DungeonCanvas.vue'
import DiagnosticsPanel from '@/features/dungeon/components/DiagnosticsPanel.vue'
import { downloadJson, downloadPng, readJsonFile } from '@/features/dungeon/files'

const store = useDungeonStore()
const quasar = useQuasar()
const workspaceTab = ref('map')
const textSize = ref('auto')
const textSizes = [
  { value: 'auto', label: 'Auto', caption: 'Scales with the window size' },
  { value: 'standard', label: 'Standard', caption: 'Consistent 16 px base text' },
  { value: 'large', label: 'Large', caption: 'Comfortable 20 px base text' },
]
function setTextSize(value: string) {
  textSize.value = value
  document.documentElement.dataset.uiScale = value
  try {
    localStorage.setItem('dungeon-atelier:ui-scale', value)
  } catch {
    /* Storage may be unavailable. */
  }
}
function inspectTile(position: Position | null) {
  selected.value = position
  if (position && quasar.screen.width < 1200) workspaceTab.value = 'report'
}
watch(
  () => store.floor,
  () => {
    if (quasar.screen.width < 1200) workspaceTab.value = 'map'
  },
)
const walker = useDungeonWalk(() => store.floor)
const selected = ref<Position | null>(null)
function locateTile(position: Position | null) {
  selected.value = position
  workspaceTab.value = 'map'
}
const shortcutFocus = ref(0)
function locateShortcut() {
  workspaceTab.value = 'map'
  if (walker.state.active) walker.command('toggle')
  shortcutFocus.value++
}
const showGrid = ref(false)
const mapStyle = ref<MapStyle>('ancient')
const renderOptions = ref<MapRenderOptions>({})
const revealSecrets = ref(false)
const fileInput = ref<HTMLInputElement>()
const importing = ref(false)
const exporting = ref(false)
const rendering = ref(false)
const renderReady = ref(false)

async function importFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file || store.busy) return
  importing.value = true
  store.busy = true
  try {
    const json = await readJsonFile(file)
    store.busy = false
    store.importJson(json)
  } catch (error) {
    store.reportError(error)
  } finally {
    store.busy = false
    input.value = ''
    importing.value = false
  }
}
function exportJson() {
  if (!store.floor) return
  try {
    downloadJson(store.floor)
  } catch (error) {
    store.reportError(error)
  }
}
async function exportPng() {
  if (!store.floor) return
  exporting.value = true
  try {
    await downloadPng(store.floor, showGrid.value, mapStyle.value, renderOptions.value)
  } catch (error) {
    store.reportError(error)
  } finally {
    exporting.value = false
  }
}
onMounted(() => {
  try {
    const saved = localStorage.getItem('dungeon-atelier:ui-scale')
    if (saved && textSizes.some((option) => option.value === saved)) setTextSize(saved)
  } catch {
    /* Keep automatic sizing when storage is unavailable. */
  }
  if (!store.floor) void store.generate()
})
</script>
