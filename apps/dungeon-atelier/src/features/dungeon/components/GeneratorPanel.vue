<template>
  <q-card flat bordered class="side-panel generator-panel">
    <q-card-section class="panel-heading">
      <div class="text-overline text-primary">CONFIGURATION</div>
      <h1 class="text-h6 q-my-none">Dungeon generator</h1>
    </q-card-section>
    <q-card-section class="preset-section q-pt-none">
      <q-select
        v-model="layoutStyle"
        :options="layoutOptions"
        emit-value
        map-options
        outlined
        dense
        label="Layout preset"
        :disable="store.busy"
      />
      <div class="preset-status text-caption text-grey-5 q-mt-xs">
        <span v-if="customized" class="text-primary">Customized spacing or shape rate</span>
        <span v-else>Preset spacing and shape rate</span>
      </div>
    </q-card-section>
    <q-tabs
      v-model="tab"
      dense
      no-caps
      active-color="primary"
      indicator-color="primary"
      align="justify"
      class="settings-tabs"
      aria-label="Generator categories"
    >
      <q-tab name="layout" label="Layout" />
      <q-tab name="connections" label="Connections" />
      <q-tab name="details" label="Details" />
    </q-tabs>
    <q-separator />
    <q-form class="generator-form" @submit="store.generate()">
      <q-tab-panels v-model="tab" keep-alive class="generator-fields scroll">
        <q-tab-panel name="layout" class="q-pa-none">
          <q-card-section>
            <div class="text-subtitle2 q-mb-md">Map dimensions</div>
            <q-btn-toggle
              :model-value="squareSize"
              :options="sizeOptions"
              toggle-color="primary"
              toggle-text-color="dark"
              color="grey-9"
              text-color="grey-4"
              unelevated
              spread
              no-caps
              :disable="store.busy"
              aria-label="Square map size presets"
              @update:model-value="setSize"
            />
            <div class="row q-col-gutter-sm q-mt-sm">
              <div class="col-6">
                <NumberStepper
                  v-model="store.config.width"
                  label="Width"
                  :min="CONFIG_LIMITS.minDimension"
                  :max="CONFIG_LIMITS.maxDimension"
                  :disable="store.busy"
                />
              </div>
              <div class="col-6">
                <NumberStepper
                  v-model="store.config.height"
                  label="Height"
                  :min="CONFIG_LIMITS.minDimension"
                  :max="CONFIG_LIMITS.maxDimension"
                  :disable="store.busy"
                />
              </div>
            </div>
            <div class="text-caption text-grey-5 q-mt-sm">16–96 tiles per side.</div>
          </q-card-section>
          <q-separator />
          <q-card-section>
            <div class="text-subtitle2 q-mb-md">Rooms</div>
            <NumberStepper
              v-model="store.config.targetRoomCount"
              label="Target room count"
              :min="2"
              :max="80"
              :disable="store.busy"
            />
            <div class="text-caption text-grey-5 q-mt-sm">The number that fits may be lower.</div>
            <div class="row q-col-gutter-sm q-mt-sm">
              <div class="col-6">
                <NumberStepper
                  v-model="store.config.minRoomSize"
                  label="Min. room side"
                  :min="3"
                  :max="16"
                  :disable="store.busy"
                />
              </div>
              <div class="col-6">
                <NumberStepper
                  v-model="store.config.maxRoomSize"
                  label="Max. room side"
                  :min="3"
                  :max="16"
                  :disable="store.busy"
                />
              </div>
            </div>
          </q-card-section>
          <q-separator />
          <q-expansion-item
            label="Spacing & shapes"
            caption="Fine-tune the layout preset"
            header-class="text-grey-4"
          >
            <q-card-section>
              <NumberStepper
                v-model="roomSpacing"
                label="Room spacing"
                :min="1"
                :max="6"
                :disable="store.busy"
              />
              <div class="text-caption text-grey-5 q-mt-sm">
                One tile allows shared walls. Larger gaps leave space for corridors.
              </div>
              <div class="setting-label q-mt-lg">
                <label for="shape-chance">Irregular rooms</label
                ><q-badge color="grey-9" text-color="primary">{{ shapeChance }}%</q-badge>
              </div>
              <q-slider
                id="shape-chance"
                v-model="shapeChance"
                :min="0"
                :max="100"
                :step="5"
                :disable="store.busy"
                aria-label="Irregular room chance"
              />
              <div class="text-caption text-grey-5">
                Uses the selected room designs when the sampled dimensions are large enough.
              </div>
            </q-card-section>
          </q-expansion-item>
          <q-expansion-item
            label="Room designs"
            caption="Footprint families and chamber blocks"
            header-class="text-grey-4"
          >
            <q-card-section>
              <div class="text-subtitle2 q-mb-sm">Individual room footprints</div>
              <q-option-group
                v-model="roomDesigns"
                :options="designOptions"
                type="checkbox"
                color="primary"
                :disable="store.busy"
                class="room-design-options"
                aria-label="Enabled room designs"
              />
              <p class="text-caption text-grey-5 q-mt-sm">
                Crosses, U-shaped galleries, and chamfered chambers need sides of at least five
                tiles. Alcoved halls need at least 5 × 7. Smaller rooms use an eligible design or
                stay rectangular.
              </p>
              <div v-if="!roomDesigns.length" class="text-caption text-primary">
                No footprint families selected: individual rooms will be rectangular.
              </div>
              <q-separator class="q-my-md" />
              <div class="text-subtitle2 q-mb-sm">Chamber blocks</div>
              <p class="text-caption text-grey-5">
                Four or six separate chambers with doors onto a central corridor. Each chamber
                counts toward the target room count.
              </p>
              <div class="setting-label">
                <label for="chamber-chance">Chance per floor</label
                ><q-badge color="grey-9" text-color="primary">{{ chamberChance }}%</q-badge>
              </div>
              <q-slider
                id="chamber-chance"
                v-model="chamberChance"
                :min="0"
                :max="100"
                :step="5"
                :disable="store.busy"
                aria-label="Chamber block chance per floor"
              />
              <div class="text-caption text-grey-5">
                At most one block. Needs at least four room slots and enough map space. Chambers
                respect the room-size range; the whole block can be larger.
              </div>
            </q-card-section>
          </q-expansion-item>
        </q-tab-panel>
        <q-tab-panel name="connections" class="q-pa-none">
          <q-card-section>
            <div class="text-subtitle2 q-mb-sm">Regional loops</div>
            <p class="text-caption text-grey-5">
              Add alternate routes between rooms. Every floor already has a connected main route.
            </p>
            <div class="setting-label">
              <label for="loop-chance">Extra connections</label
              ><q-badge color="grey-9" text-color="primary">{{ loopChance }}%</q-badge>
            </div>
            <q-slider
              id="loop-chance"
              v-model="loopChance"
              :min="0"
              :max="100"
              :step="5"
              color="primary"
              :disable="store.busy"
              aria-label="Chance of an additional connection"
            />
            <div class="text-caption text-grey-5">Chance per candidate connection.</div>
          </q-card-section>
          <q-separator />
          <q-card-section>
            <div class="text-subtitle2 q-mb-sm">Secret shortcuts</div>
            <p class="text-caption text-grey-5">
              Rare, short passages that bypass a substantial detour. Hidden doors are marked S in
              both views.
            </p>
            <div class="setting-label">
              <label for="shortcut-chance">Chance per floor</label
              ><q-badge color="grey-9" text-color="primary">{{ shortcutChance }}%</q-badge>
            </div>
            <q-slider
              id="shortcut-chance"
              v-model="shortcutChance"
              :min="0"
              :max="100"
              :step="5"
              :disable="store.busy"
              aria-label="Rare shortcut chance per floor"
            />
            <div class="text-caption text-grey-5">
              At most one. A suitable connection must still exist, even at 100%.
            </div>
          </q-card-section>
          <q-expansion-item label="Connection rules" header-class="text-grey-4">
            <q-card-section class="text-caption text-grey-5">
              <p>
                Regional loops save at least four walking steps. Major short links use the separate
                shortcut roll.
              </p>
              <p class="q-mb-none">
                A secret shortcut must save at least 12 steps and 35% of its previous route. It uses
                a shared-wall door or up to 12 corridor tiles. Hidden entrances are new openings,
                and the passage stays walled off from ordinary corridors between them.
              </p>
            </q-card-section>
          </q-expansion-item>
        </q-tab-panel>
        <q-tab-panel name="details" class="q-pa-none">
          <q-card-section>
            <div class="text-subtitle2 q-mb-md">Floor identity</div>
            <q-input
              v-model="store.config.seed"
              outlined
              dense
              label="Seed"
              maxlength="128"
              :disable="store.busy"
              autocomplete="off"
              spellcheck="false"
              input-class="text-monospace"
            />
            <div class="text-caption text-grey-5 q-mt-sm">Same seed and settings, same floor.</div>
            <NumberStepper
              v-model="store.config.floorNumber"
              label="Floor number"
              :min="1"
              :max="999"
              :disable="store.busy"
              class="q-mt-md"
            />
          </q-card-section>
          <q-separator />
          <q-card-section class="q-pb-sm">
            <div class="text-subtitle2">Stone appearance</div>
            <p class="text-caption text-grey-5 q-mt-sm q-mb-none">
              Materials and torch placement follow seeded rules. These details are decorative;
              switch views and overlays in the dungeon toolbar.
            </p>
          </q-card-section>
          <q-expansion-item label="Wall & floor rules" header-class="text-grey-4">
            <q-card-section
              ><p
                v-for="rule in MATERIAL_RULES"
                :key="rule"
                class="text-caption text-grey-5 q-mb-sm"
              >
                {{ rule }}
              </p></q-card-section
            >
          </q-expansion-item>
          <q-expansion-item label="Torch placement" header-class="text-grey-4">
            <q-card-section class="text-caption text-grey-5"
              >Torches sit on north-facing room boundaries, starting one tile from the left edge and
              repeating every four tiles. Doorways are skipped. Their light does not change fog of
              war.</q-card-section
            >
          </q-expansion-item>
        </q-tab-panel>
      </q-tab-panels>
      <q-separator />
      <q-card-section class="generation-actions">
        <q-btn
          type="submit"
          unelevated
          color="primary"
          text-color="dark"
          icon="auto_awesome"
          label="Generate dungeon"
          no-caps
          class="full-width"
          :loading="store.busy"
        />
        <q-btn
          outline
          color="grey-5"
          icon="shuffle"
          label="New seed & generate"
          no-caps
          class="full-width q-mt-sm"
          :disable="store.busy"
          @click="store.generate(true)"
        />
        <div v-if="store.hasPendingChanges" class="text-caption text-primary q-mt-sm">
          Settings changed. Generate to apply.
        </div>
      </q-card-section>
    </q-form>
  </q-card>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { MATERIAL_RULES } from '../rendering/material-rules'
import NumberStepper from './NumberStepper.vue'
import { CONFIG_LIMITS, LAYOUT_PRESETS, ROOM_DESIGNS } from '@dungeon-atelier/core'
import type { RoomDesign } from '@dungeon-atelier/core'
import { useDungeonStore } from '@/stores/dungeon'

const store = useDungeonStore()
const tab = ref('layout')
const designOptions = ROOM_DESIGNS.map((design) => ({ label: design.label, value: design.value }))
const roomDesigns = computed({
  get: () => store.config.roomDesigns ?? ['l-shaped', 't-shaped'],
  set: (value: RoomDesign[]) => {
    store.config.roomDesigns = value
  },
})
const chamberChance = computed({
  get: () => Math.round((store.config.chamberBlockChance ?? 0) * 100),
  set: (value: number) => {
    store.config.chamberBlockChance = value / 100
  },
})
const customized = computed(() => {
  const preset = LAYOUT_PRESETS[layoutStyle.value]
  return (
    roomSpacing.value !== preset.roomSpacing ||
    shapeChance.value !== Math.round(preset.roomShapeChance * 100)
  )
})
const layoutOptions = [
  { label: 'Classic Rooms', value: 'classic' },
  { label: 'Compact Labyrinth', value: 'compact' },
]
const layoutStyle = computed({
  get: () => store.config.layoutStyle ?? 'classic',
  set: (value: 'classic' | 'compact') => {
    Object.assign(store.config, LAYOUT_PRESETS[value], { layoutStyle: value })
  },
})
const roomSpacing = computed({
  get: () => store.config.roomSpacing ?? 3,
  set: (value: number) => {
    store.config.roomSpacing = value
  },
})
const shapeChance = computed({
  get: () => Math.round((store.config.roomShapeChance ?? 0) * 100),
  set: (value: number) => {
    store.config.roomShapeChance = value / 100
  },
})
const shortcutChance = computed({
  get: () => Math.round((store.config.shortcutChance ?? 0) * 100),
  set: (value: number) => {
    store.config.shortcutChance = value / 100
  },
})
const sizeOptions = [24, 32, 48, 64].map((value) => ({ label: `${value}²`, value }))
const squareSize = computed(() =>
  store.config.width === store.config.height ? store.config.width : null,
)
const loopChance = computed({
  get: () => Math.round(store.config.extraConnectionChance * 100),
  set: (value: number) => {
    store.config.extraConnectionChance = value / 100
  },
})
function setSize(size: number) {
  store.config.width = size
  store.config.height = size
}
</script>
