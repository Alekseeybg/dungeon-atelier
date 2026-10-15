<template>
  <q-card flat bordered class="side-panel diagnostics-panel">
    <q-tabs
      v-model="tab"
      dense
      no-caps
      active-color="primary"
      indicator-color="primary"
      align="justify"
    >
      <q-tab name="report" label="Floor report" />
      <q-tab name="tile" label="Tile inspector" />
    </q-tabs>
    <q-separator />
    <q-tab-panels v-model="tab" class="inspector-panels scroll" animated>
      <q-tab-panel name="report" class="q-pa-none">
        <template v-if="floor">
          <q-card-section>
            <div class="row items-center justify-between q-mb-sm">
              <span class="text-subtitle2">Floor {{ floor.floorNumber }}</span
              ><q-badge outline color="positive" label="Connected" />
            </div>
            <DungeonAutomap :floor="floor" :selected="selected" :walk="walk" />
          </q-card-section>
          <q-separator />
          <q-card-section>
            <div class="text-overline text-grey-5">ACTIVE SEED</div>
            <div class="text-body2 text-primary text-monospace seed-readout">{{ floor.seed }}</div>
          </q-card-section>
          <q-list dense separator>
            <q-item
              ><q-item-section>Dimensions</q-item-section
              ><q-item-section side>{{ floor.width }} × {{ floor.height }}</q-item-section></q-item
            >
            <q-item
              ><q-item-section>Rooms / target</q-item-section
              ><q-item-section side
                >{{ floor.rooms.length }} / {{ floor.config.targetRoomCount }}</q-item-section
              ></q-item
            >
            <q-item
              ><q-item-section>Walkable tiles</q-item-section
              ><q-item-section side>{{
                floor.diagnostics.walkableTileCount.toLocaleString()
              }}</q-item-section></q-item
            >
            <q-item
              ><q-item-section>Doors</q-item-section
              ><q-item-section side>{{ floor.doors.length }}</q-item-section></q-item
            >
          </q-list>
          <q-separator class="q-mt-sm" />
          <q-card-section v-if="!walk.active" class="q-pb-xs"
            ><div class="text-subtitle2">Staircases</div></q-card-section
          >
          <q-list v-if="!walk.active">
            <q-item
              v-for="item in floor.stairs"
              :key="item.id"
              clickable
              @click="inspect(item.position)"
            >
              <q-item-section avatar
                ><q-icon
                  :name="item.direction === 'up' ? 'north' : 'south'"
                  :color="item.direction === 'up' ? 'positive' : 'primary'"
              /></q-item-section>
              <q-item-section
                ><q-item-label>{{
                  item.direction === 'up' ? 'Up staircase' : 'Down staircase'
                }}</q-item-label
                ><q-item-label caption
                  >x {{ item.position.x }}, y {{ item.position.y }}</q-item-label
                ></q-item-section
              >
              <q-item-section side><q-icon name="my_location" size="18px" /></q-item-section>
            </q-item>
          </q-list>
          <q-card-section v-if="floor.diagnostics.warnings.length">
            <q-banner dense rounded class="notes-banner"
              ><template #avatar
                ><q-icon name="warning_amber" color="warning" size="20px"
              /></template>
              <div
                v-for="warning in floor.diagnostics.warnings"
                :key="warning"
                class="text-caption"
              >
                {{ warning }}
              </div></q-banner
            >
          </q-card-section>
          <q-card-section class="text-caption text-grey-6"
            >Schema {{ floor.schemaVersion }} · Generator
            {{ floor.generatorVersion }}</q-card-section
          >
        </template>
        <q-card-section v-else class="text-grey-5"
          >Generate a dungeon to see its report.</q-card-section
        >
      </q-tab-panel>
      <q-tab-panel name="tile">
        <template v-if="selected && floor">
          <div class="row items-center justify-between q-mb-md">
            <div class="text-subtitle1">Tile {{ selected.x }}, {{ selected.y }}</div>
            <q-btn
              flat
              round
              dense
              icon="close"
              aria-label="Clear selection"
              @click="emit('inspect', null)"
            />
          </div>
          <q-list bordered separator class="rounded-borders">
            <q-item
              ><q-item-section>Terrain</q-item-section
              ><q-item-section side class="text-capitalize">{{
                floor.tiles[selected.y]?.[selected.x]
              }}</q-item-section></q-item
            >
            <q-item
              ><q-item-section>Room</q-item-section
              ><q-item-section side>{{ room?.id ?? '—' }}</q-item-section></q-item
            >
            <template v-if="door"
              ><q-item
                ><q-item-section
                  ><q-item-label>Door</q-item-label
                  ><q-item-label caption>{{ door.id }}</q-item-label></q-item-section
                ><q-item-section side>Regular</q-item-section></q-item
              ><q-item
                ><q-item-section>Travel axis</q-item-section
                ><q-item-section side>{{ door.orientation }}</q-item-section></q-item
              ></template
            >
            <q-item v-if="stair"
              ><q-item-section
                ><q-item-label>Staircase</q-item-label
                ><q-item-label caption>{{ stair.id }}</q-item-label></q-item-section
              ><q-item-section side class="text-capitalize">{{
                stair.direction
              }}</q-item-section></q-item
            >
          </q-list>
        </template>
        <div v-else class="text-center q-py-xl text-grey-5">
          <q-icon name="ads_click" size="32px" class="q-mb-md" />
          <p class="text-body2">Click a map tile to inspect its terrain and features.</p>
        </div>
      </q-tab-panel>
    </q-tab-panels>
  </q-card>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { containsPosition } from '@dungeon-atelier/core'
import type { WalkState } from '../exploration/useDungeonWalk'
import type { DungeonFloor, Position } from '@dungeon-atelier/core'
import DungeonAutomap from './DungeonAutomap.vue'
const props = defineProps<{
  floor: DungeonFloor | null
  selected: Position | null
  walk: WalkState
}>()
const emit = defineEmits<{ inspect: [position: Position | null] }>()
const tab = ref('report')
function inspect(position: Position) {
  emit('inspect', position)
  tab.value = 'tile'
}
watch(
  () => props.selected,
  (value) => {
    if (value) tab.value = 'tile'
  },
)
const room = computed(() =>
  props.floor?.rooms.find((room) => props.selected && containsPosition(room, props.selected)),
)
const door = computed(() =>
  props.floor?.doors.find(
    (door) => door.position.x === props.selected?.x && door.position.y === props.selected?.y,
  ),
)
const stair = computed(() =>
  props.floor?.stairs.find(
    (stair) => stair.position.x === props.selected?.x && stair.position.y === props.selected?.y,
  ),
)
</script>
