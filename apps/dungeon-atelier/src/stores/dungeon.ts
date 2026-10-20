import { computed, reactive, ref, shallowRef } from 'vue'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { DEFAULT_CONFIG, generateDungeon, importFloorJson } from '@dungeon-atelier/core'
import type { DungeonFloor } from '@dungeon-atelier/core'

function newSeed() {
  const values = crypto.getRandomValues(new Uint32Array(2))
  return `atelier-${values[0]!.toString(36)}-${values[1]!.toString(36)}`
}

export const useDungeonStore = defineStore('dungeon', () => {
  const config = reactive({
    ...DEFAULT_CONFIG,
    roomDesigns: [...(DEFAULT_CONFIG.roomDesigns ?? [])],
  })
  const floor = shallowRef<DungeonFloor | null>(null)
  const busy = ref(false)
  const errors = ref<string[]>([])
  const message = ref('')
  const source = ref<'generated' | 'imported'>('generated')
  const effectiveConfig = (stored: DungeonFloor['config']) => ({
    ...DEFAULT_CONFIG,
    layoutStyle: 'classic' as const,
    roomSpacing: 3,
    roomShapeChance: 0,
    shortcutChance: 0,
    roomDesigns: ['l-shaped', 't-shaped'],
    chamberBlockChance: 0,
    ...stored,
  })
  const hasPendingChanges = computed(
    () =>
      floor.value !== null &&
      JSON.stringify(config) !== JSON.stringify(effectiveConfig(floor.value.config)),
  )

  function reportError(error: unknown) {
    errors.value = [
      error instanceof Error ? error.message : 'The operation could not be completed.',
    ]
    message.value = ''
  }

  async function generate(useNewSeed = false) {
    if (busy.value) return
    if (useNewSeed) config.seed = newSeed()
    const snapshot = { ...config, roomDesigns: [...config.roomDesigns] }
    busy.value = true
    errors.value = []
    message.value = ''
    // Give the browser a chance to display the busy state before bounded CPU work.
    await new Promise((resolve) => setTimeout(resolve, 0))
    try {
      const result = generateDungeon(snapshot)
      if (result.ok) {
        floor.value = result.floor
        source.value = 'generated'
        message.value = 'Floor generated and validated.'
      } else errors.value = result.errors
    } catch (error) {
      reportError(error)
    } finally {
      busy.value = false
    }
  }

  function importJson(json: string) {
    if (busy.value) return
    try {
      const result = importFloorJson(json)
      if (!result.ok) {
        errors.value = result.errors
        message.value = ''
        return
      }
      floor.value = result.floor
      Object.assign(config, effectiveConfig(result.floor.config))
      source.value = 'imported'
      errors.value = []
      message.value = 'Stored floor imported and validated. Its layout was preserved.'
    } catch (error) {
      reportError(error)
    }
  }

  return {
    config,
    floor,
    busy,
    errors,
    message,
    source,
    hasPendingChanges,
    generate,
    importJson,
    reportError,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useDungeonStore, import.meta.hot))
}
