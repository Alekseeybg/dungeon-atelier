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
    <q-tab-panels v-model="tab" class="inspector-panels scroll">
      <q-tab-panel name="report" class="q-pa-none">
        <template v-if="floor">
          <q-card-section>
            <div class="row items-center justify-between q-mb-sm">
              <span class="text-subtitle2">Floor {{ floor.floorNumber }}</span
              ><q-badge outline color="positive" label="Connected" />
            </div>
            <div class="text-caption text-grey-5 q-mb-sm">
              Generator {{ floor.generatorVersion
              }}<span v-if="floor.generatorVersion !== GENERATOR_VERSION"> · stored layout</span>
            </div>
            <q-expansion-item
              v-if="(floor.diagnostics.generationAttempts ?? 1) > 1"
              dense
              class="text-caption q-mb-sm"
              :label="`${floor.diagnostics.generationAttempts} layout attempts`"
              caption="Bounded deterministic retries"
            >
              <div
                v-for="(reason, index) in floor.diagnostics.retryReasons"
                :key="index"
                class="q-px-md q-pb-sm"
              >
                Attempt {{ index + 1 }}: {{ reason }}
              </div>
            </q-expansion-item>
            <DungeonAutomap
              :floor="floor"
              :selected="selected"
              :walk="walk"
              :conceal-secrets="concealSecrets"
              @inspect="emit('inspect', $event)"
            />
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
            <q-item v-if="floor.diagnostics.stairDistance !== undefined"
              ><q-item-section>Stair route</q-item-section
              ><q-item-section side
                >{{ floor.diagnostics.stairDistance }} steps</q-item-section
              ></q-item
            >
            <q-item v-if="floor.diagnostics.shortcutCount !== undefined">
              <q-item-section
                ><q-item-label>Rare shortcuts</q-item-label
                ><q-item-label
                  v-if="floor.diagnostics.shortcutCount && !floor.shortcuts?.length"
                  caption
                  >Regenerate this floor to record its location.</q-item-label
                ></q-item-section
              >
              <q-item-section side
                >{{ floor.diagnostics.shortcutCount
                }}<span v-if="floor.diagnostics.shortcutTilesSaved" class="text-caption"
                  >−{{ floor.diagnostics.shortcutTilesSaved }} steps</span
                ></q-item-section
              >
            </q-item>
          </q-list>

          <q-expansion-item
            label="Room designs"
            caption="Footprints and grouped chambers"
            header-class="text-grey-4"
          >
            <q-list dense separator>
              <q-item
                v-for="design in designCounts"
                :key="design.value"
                clickable
                @click="inspect(roomCenter(design.room))"
              >
                <q-item-section>{{ design.label }}</q-item-section
                ><q-item-section side>{{ design.count }}</q-item-section
                ><q-item-section side
                  ><q-icon name="my_location" size="1rem" /><q-tooltip
                    >Inspect an example room</q-tooltip
                  ></q-item-section
                >
              </q-item>
              <q-item v-if="floor.roomGroups?.length"
                ><q-item-section
                  >Chamber blocks<q-item-label caption
                    >Members are counted as separate rooms.</q-item-label
                  ></q-item-section
                ><q-item-section side>{{ floor.roomGroups.length }}</q-item-section></q-item
              >
            </q-list>
          </q-expansion-item>
          <q-expansion-item
            label="Route statistics"
            caption="Loops, dead ends, corridor coverage"
            header-class="text-grey-4"
            ><q-list dense separator>
              <q-item v-if="floor.diagnostics.loopCount !== undefined"
                ><q-item-section>Independent loops</q-item-section
                ><q-item-section side>{{ floor.diagnostics.loopCount }}</q-item-section></q-item
              >
              <q-item v-if="floor.diagnostics.deadEndCount !== undefined"
                ><q-item-section>Dead ends</q-item-section
                ><q-item-section side>{{ floor.diagnostics.deadEndCount }}</q-item-section></q-item
              >
              <q-item v-if="floor.diagnostics.corridorCoverage !== undefined"
                ><q-item-section>Corridor share</q-item-section
                ><q-item-section side
                  >{{ Math.round(floor.diagnostics.corridorCoverage * 100) }}%</q-item-section
                ></q-item
              >
              <q-item v-if="floor.diagnostics.sharedDoorCount !== undefined"
                ><q-item-section>Shared-wall doors</q-item-section
                ><q-item-section side>{{
                  floor.diagnostics.sharedDoorCount
                }}</q-item-section></q-item
              >
            </q-list></q-expansion-item
          >
          <q-card-section v-if="floor.shortcuts?.length" class="q-py-sm">
            <q-btn
              outline
              dense
              no-caps
              color="cyan-4"
              icon="my_location"
              label="Locate shortcut"
              class="full-width"
              @click="emit('locateShortcut')"
              ><q-tooltip>Center and highlight the shortcut in the editor</q-tooltip></q-btn
            >
            <div class="text-caption text-grey-5 q-mt-xs">
              S marks a hidden door in both map styles.
            </div>
          </q-card-section>
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
            <q-item v-if="room"
              ><q-item-section>Room shape</q-item-section
              ><q-item-section side class="text-capitalize">{{
                shapeLabel
              }}</q-item-section></q-item
            >
            <q-item v-if="roomGroup"
              ><q-item-section
                >Chamber block<q-item-label caption>{{
                  roomGroup.id
                }}</q-item-label></q-item-section
              ><q-item-section side>{{ roomGroup.roomIds.length }} rooms</q-item-section></q-item
            >
            <q-item v-if="ancientMaterial">
              <q-item-section>{{ ancientMaterial.kind }}</q-item-section>
              <q-item-section side class="material-value">{{
                ancientMaterial.label
              }}</q-item-section>
            </q-item>
            <q-item v-if="ancientMaterial?.kind === 'Wall family'">
              <q-item-section>Cap profile</q-item-section>
              <q-item-section side class="material-value">{{ ancientCap }}</q-item-section>
            </q-item>
            <q-item v-if="material && mapStyle !== 'ancient'"
              ><q-item-section
                ><q-item-label>Stone material</q-item-label
                ><q-item-label caption>{{ material.rule }}</q-item-label></q-item-section
              ><q-item-section side
                ><span>{{ material.label }}</span
                ><span class="text-caption text-capitalize">{{
                  material.condition
                }}</span></q-item-section
              ></q-item
            >
            <q-item v-if="material?.roomIdentity && mapStyle !== 'ancient'"
              ><q-item-section>Stone room finish</q-item-section
              ><q-item-section side>{{ material.roomIdentity }}</q-item-section></q-item
            >
            <q-item v-if="shortcut"
              ><q-item-section
                ><q-item-label>Rare shortcut</q-item-label
                ><q-item-label caption
                  >{{ shortcut.fromRoomId }} ↔ {{ shortcut.toRoomId }}</q-item-label
                ></q-item-section
              ><q-item-section side>−{{ shortcut.tilesSaved }} steps</q-item-section></q-item
            >
            <template v-if="door"
              ><q-item
                ><q-item-section
                  ><q-item-label>Door</q-item-label
                  ><q-item-label caption>{{ door.id }}</q-item-label></q-item-section
                ><q-item-section side>{{
                  door.type === 'secret' ? 'Hidden · S' : 'Regular'
                }}</q-item-section></q-item
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
import {
  containsPosition,
  ROOM_DESIGNS,
  roomCenter,
  GENERATOR_VERSION,
} from '@dungeon-atelier/core'
import type { WalkState } from '../exploration/useDungeonWalk'
import type { DungeonFloor, Position } from '@dungeon-atelier/core'
import DungeonAutomap from './DungeonAutomap.vue'
import { createMaterialPlan } from '../rendering/material-rules'
import type { MapStyle, MapRenderOptions } from '../rendering/dungeon-renderer'
import {
  ANCIENT_FLOORS,
  ANCIENT_WALLS,
  ANCIENT_CAPS,
  normalizeAncient,
  ancientFloorAssignments,
} from '../rendering/ancient-settings'
const props = defineProps<{
  floor: DungeonFloor | null
  selected: Position | null
  walk: WalkState
  concealSecrets?: boolean
  mapStyle?: MapStyle
  renderOptions?: MapRenderOptions
}>()
const emit = defineEmits<{ inspect: [position: Position | null]; locateShortcut: [] }>()
const tab = ref('report')
const designCounts = computed(() =>
  [{ value: 'rectangle', label: 'Rectangular rooms' }, ...ROOM_DESIGNS].flatMap((design) => {
    const matches =
      props.floor?.rooms.filter((room) => (room.shape ?? 'rectangle') === design.value) ?? []
    return matches[0] ? [{ ...design, count: matches.length, room: matches[0] }] : []
  }),
)
const shapeLabel = computed(
  () => ROOM_DESIGNS.find((design) => design.value === room.value?.shape)?.label ?? 'Rectangle',
)
const roomGroup = computed(() =>
  props.floor?.roomGroups?.find(
    (group) =>
      props.selected &&
      props.selected.x >= group.x &&
      props.selected.y >= group.y &&
      props.selected.x < group.x + group.width &&
      props.selected.y < group.y + group.height,
  ),
)
const materialPlan = computed(() =>
  props.floor && props.mapStyle !== 'ancient' ? createMaterialPlan(props.floor) : null,
)
const material = computed(() =>
  props.selected ? materialPlan.value?.at(props.selected.x, props.selected.y) : null,
)
const ancientAppearance = computed(() => normalizeAncient(props.renderOptions?.ancient)),
  ancientAssignments = computed(() =>
    props.floor && props.mapStyle === 'ancient'
      ? ancientFloorAssignments(props.floor, ancientAppearance.value)
      : new Map(),
  ),
  ancientCap = computed(
    () => ANCIENT_CAPS.find((c) => c.value === ancientAppearance.value.cap)?.label,
  ),
  ancientMaterial = computed(() => {
    if (props.mapStyle !== 'ancient' || !props.selected || !props.floor) return null
    const { x, y } = props.selected,
      tile = props.floor.tiles[y]?.[x]
    return tile === 'wall' || tile === 'door'
      ? {
          kind: 'Wall family',
          label: ANCIENT_WALLS.find((w) => w.value === ancientAppearance.value.wall)?.label,
        }
      : tile === 'floor'
        ? {
            kind: 'Floor material',
            label: ANCIENT_FLOORS.find(
              (f) =>
                f.value ===
                (ancientAssignments.value.get(y * props.floor!.width + x) ??
                  ancientAppearance.value.floor),
            )?.label,
          }
        : null
  })
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
const shortcut = computed(() =>
  props.floor?.shortcuts?.find((s) =>
    s.path.some((p) => p.x === props.selected?.x && p.y === props.selected?.y),
  ),
)
const stair = computed(() =>
  props.floor?.stairs.find(
    (stair) => stair.position.x === props.selected?.x && stair.position.y === props.selected?.y,
  ),
)
</script>

<style scoped>
.material-value {
  max-width: 62%;
  white-space: normal;
  text-align: right;
}
</style>
