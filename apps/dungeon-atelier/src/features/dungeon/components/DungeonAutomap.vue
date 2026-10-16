<template>
  <section class="report-section automap-section" aria-label="Floor automap">
    <div class="automap-heading">
      <h3>Automap</h3>
      <span>{{ walk.active ? 'EXPLORED' : 'FULL FLOOR' }}</span>
    </div>
    <canvas
      ref="canvas"
      class="automap-canvas"
      role="button"
      tabindex="0"
      @click="navigate"
      @keydown.enter="locateEntry"
      @keydown.space.prevent="locateEntry"
      :aria-label="`Classic overview of floor ${floor.floorNumber}, ${floor.width} by ${floor.height} tiles`"
    />
  </section>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { renderWalkFog } from '../rendering/walk-fog'
import type { WalkState } from '../exploration/useDungeonWalk'
import type { DungeonFloor, Position } from '@dungeon-atelier/core'
import { createMapCanvas, disposeMapCanvas, TILE_SIZE } from '../rendering/dungeon-renderer'
import { concealSecretArchitecture } from '../rendering/dimensional-model'

const props = defineProps<{
  floor: DungeonFloor
  selected: Position | null
  walk: WalkState
  concealSecrets?: boolean
}>()
const canvas = ref<HTMLCanvasElement>()
const emit = defineEmits<{ inspect: [position: Position] }>()
function locateEntry() {
  const p = props.selected ?? props.floor.stairs.find((s) => s.direction === 'up')?.position
  if (p && !props.walk.active) emit('inspect', p)
}
function navigate(event: MouseEvent) {
  if (props.walk.active || !canvas.value) return
  const bounds = canvas.value.getBoundingClientRect(),
    x = Math.floor(((event.clientX - bounds.left) / bounds.width) * props.floor.width),
    y = Math.floor(((event.clientY - bounds.top) / bounds.height) * props.floor.height)
  if (x >= 0 && y >= 0 && x < props.floor.width && y < props.floor.height) emit('inspect', { x, y })
}
let overview: HTMLCanvasElement | undefined

function paint() {
  const target = canvas.value
  const context = target?.getContext('2d')
  if (!target || !context || !overview) return
  const scale = 216 / (props.floor.width * TILE_SIZE)
  target.width = 432
  target.height = Math.round((432 * props.floor.height) / props.floor.width)
  context.scale(2, 2)
  context.drawImage(overview, 0, 0, 216, target.height / 2)
  if (props.walk.active) {
    context.save()
    context.scale(scale, scale)
    renderWalkFog(context, props.floor, props.walk)
    context.restore()
  }
  if (props.selected && !props.walk.active) {
    context.fillStyle = '#f5ce63'
    context.beginPath()
    context.arc(
      (props.selected.x + 0.5) * TILE_SIZE * scale,
      (props.selected.y + 0.5) * TILE_SIZE * scale,
      2.5,
      0,
      Math.PI * 2,
    )
    context.fill()
  }
}
function rebuild() {
  const old = overview
  overview = createMapCanvas(
    props.concealSecrets ? concealSecretArchitecture(props.floor) : props.floor,
    false,
    'classic',
  )
  paint()
  disposeMapCanvas(old)
}
onBeforeUnmount(() => disposeMapCanvas(overview))
onMounted(rebuild)
watch(() => props.floor, rebuild)
watch(() => props.concealSecrets, rebuild)
watch(() => props.selected, paint)
watch(() => props.walk, paint, { deep: true })
</script>
