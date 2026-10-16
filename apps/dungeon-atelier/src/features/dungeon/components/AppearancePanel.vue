<template>
  <q-btn-dropdown flat dense no-caps icon="tune" label="Materials" aria-label="Dungeon materials">
    <q-card flat class="appearance-panel">
      <q-card-section class="row items-center">
        <div class="text-subtitle1 col">Dungeon appearance</div>
        <q-btn
          flat
          dense
          round
          icon="restart_alt"
          aria-label="Reset dungeon appearance"
          @click="store.reset"
          ><q-tooltip>Restore approved defaults</q-tooltip></q-btn
        >
      </q-card-section>
      <q-separator />
      <q-expansion-item label="Floors" icon="layers" default-opened>
        <q-card-section class="appearance-fields">
          <q-select
            v-model="a.floor"
            :options="ANCIENT_FLOORS"
            emit-value
            map-options
            outlined
            dense
            label="Primary floor"
            aria-label="Primary floor material"
          />
          <q-select
            v-model="a.corridor"
            :options="inheritedFloors"
            emit-value
            map-options
            outlined
            dense
            label="Corridor floor"
            aria-label="Corridor floor material"
          />
          <q-select
            v-model="a.distribution"
            :options="distribution"
            emit-value
            map-options
            outlined
            dense
            label="Room materials"
            aria-label="Floor distribution"
          />
          <template v-if="a.distribution === 'regional'">
            <q-select
              v-model="a.secondary"
              :options="inheritedFloors"
              emit-value
              map-options
              outlined
              dense
              label="Secondary rooms"
              aria-label="Secondary floor material"
            />
            <q-select
              v-model="a.rare"
              :options="inheritedFloors"
              emit-value
              map-options
              outlined
              dense
              label="Rare ancient chamber"
              aria-label="Rare floor material"
            />
            <div class="text-body2 text-grey-5">
              Secondary materials cover occasional whole rooms. At most one large chamber receives
              the rare material.
            </div>
          </template>
        </q-card-section>
      </q-expansion-item>
      <q-expansion-item label="Walls & coping" icon="grid_on">
        <q-card-section class="appearance-fields">
          <q-select
            v-model="a.wall"
            :options="ANCIENT_WALLS"
            emit-value
            map-options
            outlined
            dense
            label="Wall family"
            aria-label="Wall material family"
          />
          <q-select
            v-model="a.cap"
            :options="ANCIENT_CAPS"
            emit-value
            map-options
            outlined
            dense
            label="Cap profile"
            aria-label="Wall cap profile"
          />
        </q-card-section>
      </q-expansion-item>
      <q-expansion-item label="Lighting & details" icon="explore">
        <q-card-section class="column">
          <q-toggle v-model="a.lighting" label="Torch light spill" aria-label="Torch light spill" />
          <q-toggle v-model="a.torches" label="Mounted torches" aria-label="Mounted torches" />
          <q-toggle
            v-model="a.stairSymbols"
            label="Adjacent stair symbols"
            aria-label="Adjacent stair symbols"
          />
          <q-toggle v-model="a.doorsOpen" label="Show doors open" aria-label="Show doors open" />
        </q-card-section>
      </q-expansion-item>
      <q-card-section class="text-body2 text-grey-5"
        >Appearance changes apply to this map and PNG exports. Your dungeon layout stays the
        same.</q-card-section
      >
    </q-card>
  </q-btn-dropdown>
</template>
<script setup lang="ts">
import { useAppearanceStore } from '../../../stores/appearance'
import { ANCIENT_FLOORS, ANCIENT_WALLS, ANCIENT_CAPS } from '../rendering/ancient-settings'
const store = useAppearanceStore(),
  a = store.ancient,
  inheritedFloors = [{ value: 'inherit', label: 'Same as primary floor' }, ...ANCIENT_FLOORS],
  distribution = [
    { value: 'uniform', label: 'One material for rooms' },
    { value: 'regional', label: 'Coherent regional variation' },
  ]
</script>
<style scoped>
.appearance-panel {
  width: 27rem;
  max-width: calc(100vw - 24px);
  max-height: 75vh;
  overflow: auto;
  background: #1b2228;
}
.appearance-fields {
  display: grid;
  gap: 1rem;
}
</style>
