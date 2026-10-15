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
        :disable="!store.floor || store.busy || exporting"
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
    <div class="editor-workbench">
      <GeneratorPanel />
      <div class="center-panel">
        <DungeonCanvas
          :floor="store.floor"
          :selected="selected"
          :walk="walker.state"
          @inspect="selected = $event"
          @error="store.reportError"
          @grid="showGrid = $event"
          @style="mapStyle = $event"
          @walk="walker.command"
        />
        <div class="workspace-footnote text-caption text-grey-5" role="status">
          <q-icon v-if="store.message" name="check" color="positive" class="q-mr-xs" />{{
            store.message || 'Ready to generate.'
          }}
        </div>
      </div>
      <DiagnosticsPanel
        :floor="store.floor"
        :selected="selected"
        :walk="walker.state"
        @inspect="selected = $event"
      />
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useDungeonWalk } from '@/features/dungeon/exploration/useDungeonWalk'
import type { Position } from '@dungeon-atelier/core'
import type { MapStyle } from '@/features/dungeon/rendering/dungeon-renderer'
import { useDungeonStore } from '@/stores/dungeon'
import GeneratorPanel from '@/features/dungeon/components/GeneratorPanel.vue'
import DungeonCanvas from '@/features/dungeon/components/DungeonCanvas.vue'
import DiagnosticsPanel from '@/features/dungeon/components/DiagnosticsPanel.vue'
import { downloadJson, downloadPng, readJsonFile } from '@/features/dungeon/files'

const store = useDungeonStore()
const walker = useDungeonWalk(() => store.floor)
const selected = ref<Position | null>(null)
const showGrid = ref(false)
const mapStyle = ref<MapStyle>('stone')
const fileInput = ref<HTMLInputElement>()
const importing = ref(false)
const exporting = ref(false)

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
    await downloadPng(store.floor, showGrid.value, mapStyle.value)
  } catch (error) {
    store.reportError(error)
  } finally {
    exporting.value = false
  }
}
onMounted(() => {
  if (!store.floor) void store.generate()
})
</script>
