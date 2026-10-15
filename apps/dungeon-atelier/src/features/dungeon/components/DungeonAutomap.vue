<template>
  <section class="report-section automap-section" aria-label="Floor automap">
    <div class="automap-heading">
      <h3>Automap</h3>
      <span>{{ walk.active ? 'EXPLORED' : 'FULL FLOOR' }}</span>
    </div>
    <canvas
      ref="canvas"
      class="automap-canvas"
      role="img"
      :aria-label="`Classic overview of floor ${floor.floorNumber}, ${floor.width} by ${floor.height} tiles`"
    />
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { renderWalkFog } from '../rendering/walk-fog'
import type { WalkState } from '../exploration/useDungeonWalk'
import type { DungeonFloor, Position } from '@dungeon-atelier/core'
import { createMapCanvas, TILE_SIZE } from '../rendering/dungeon-renderer'

const props = defineProps<{ floor: DungeonFloor; selected: Position | null; walk: WalkState }>()
const canvas = ref<HTMLCanvasElement>()
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
  overview = createMapCanvas(props.floor, false, 'classic')
  paint()
}
onMounted(rebuild)
watch(() => props.floor, rebuild)
watch(() => props.selected, paint)
watch(() => props.walk, paint, { deep: true })
</script>
