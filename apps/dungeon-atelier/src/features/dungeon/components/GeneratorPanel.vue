<template>
  <q-card flat bordered class="side-panel generator-panel">
    <q-card-section>
      <div class="text-overline text-primary">CONFIGURATION</div>
      <h1 class="text-h6 q-my-none">Dungeon generator</h1>
      <p class="text-caption text-grey-5 q-mt-xs q-mb-none">Set the shape of your next floor.</p>
    </q-card-section>
    <q-separator />
    <q-form class="generator-form" @submit="store.generate()">
      <div class="generator-fields scroll">
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
        <q-card-section>
          <div class="text-subtitle2 q-mb-md">Generation seed</div>
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
        </q-card-section>
        <q-separator />
        <q-card-section>
          <div class="text-subtitle2 q-mb-md">Rooms &amp; passages</div>
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
          <div class="row items-center justify-between q-mt-lg q-mb-sm">
            <span class="text-body2">Extra connections</span>
            <q-badge color="grey-9" text-color="primary">{{ loopChance }}%</q-badge>
          </div>
          <q-slider
            v-model="loopChance"
            :min="0"
            :max="100"
            :step="5"
            color="primary"
            :disable="store.busy"
            aria-label="Chance of an additional connection"
          />
          <div class="text-caption text-grey-5">Chance to carve extra routes between rooms.</div>
        </q-card-section>
      </div>
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
import { computed } from 'vue'
import NumberStepper from './NumberStepper.vue'
import { CONFIG_LIMITS } from '@dungeon-atelier/core'
import { useDungeonStore } from '@/stores/dungeon'

const store = useDungeonStore()
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
