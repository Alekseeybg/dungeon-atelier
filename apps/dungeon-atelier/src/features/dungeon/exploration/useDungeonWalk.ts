import { reactive, watch } from 'vue'
import { isWalkable } from '@dungeon-atelier/core'
import type { DungeonFloor, Position } from '@dungeon-atelier/core'

export type WalkAction = 'toggle' | 'reset' | 'forward' | 'back' | 'left' | 'right'
export interface WalkState {
  active: boolean
  position: Position | null
  heading: number
  explored: Set<number>
  visible: Set<number>
  steps: number
  message: string
}
export const DIRECTIONS: readonly Position[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
]
export const HEADING_NAMES = ['North', 'East', 'South', 'West'] as const

/** Temporary playtest state; never serialized into a dungeon definition. */
export function useDungeonWalk(getFloor: () => DungeonFloor | null) {
  const state = reactive<WalkState>({
    active: false,
    position: null,
    heading: 0,
    explored: new Set(),
    visible: new Set(),
    steps: 0,
    message: '',
  })
  function reveal() {
    const floor = getFloor()
    if (!floor || !state.position) return
    const visible = new Set<number>()
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const x = state.position.x + dx
        const y = state.position.y + dy
        if (x >= 0 && y >= 0 && x < floor.width && y < floor.height) {
          visible.add(y * floor.width + x)
        }
      }
    }
    state.visible = visible
    state.explored = new Set([...state.explored, ...visible])
  }
  function reset() {
    const floor = getFloor()
    const entry = floor?.stairs.find((stair) => stair.direction === 'up')
    state.position = entry ? { ...entry.position } : null
    state.heading = 0
    state.steps = 0
    state.explored = new Set()
    state.visible = new Set()
    state.message = 'Explore the surrounding tiles. Discovered areas stay lit.'
    if (entry) reveal()
  }
  function command(action: WalkAction) {
    if (action === 'toggle') {
      if (!getFloor()) return
      state.active = !state.active
      if (state.active && !state.position) reset()
      return
    }
    if (!state.active) return
    if (action === 'reset') {
      reset()
      return
    }
    if (action === 'left' || action === 'right') {
      state.heading = (state.heading + (action === 'left' ? 3 : 1)) % 4
      state.message = `Facing ${HEADING_NAMES[state.heading]}.`
      reveal()
      return
    }
    const floor = getFloor()
    if (!floor || !state.position) return
    const direction = DIRECTIONS[state.heading]!
    const sign = action === 'back' ? -1 : 1
    const next = {
      x: state.position.x + direction.x * sign,
      y: state.position.y + direction.y * sign,
    }
    if (!isWalkable(floor.tiles[next.y]?.[next.x])) {
      state.message = 'A wall blocks the way.'
      return
    }
    state.position = next
    state.steps++
    const stair = floor.stairs.find(
      (item) => item.position.x === next.x && item.position.y === next.y,
    )
    state.message = stair
      ? `You reached the ${stair.direction} staircase.`
      : 'Exploring the dungeon.'
    reveal()
  }
  watch(getFloor, () => {
    if (state.active) reset()
    else {
      state.position = null
      state.explored = new Set()
      state.visible = new Set()
    }
  })
  return { state, command }
}
