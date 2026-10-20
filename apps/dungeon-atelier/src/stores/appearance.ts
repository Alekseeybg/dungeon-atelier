import { acceptHMRUpdate, defineStore } from 'pinia'
import { ref, reactive, watch } from 'vue'
import { MAP_STYLES } from '../features/dungeon/rendering/map-style'
import type { MapStyle } from '../features/dungeon/rendering/map-style'
import {
  DEFAULT_ANCIENT,
  isLegacyDefaultAncient,
  normalizeAncient,
} from '../features/dungeon/rendering/ancient-settings'

export const useAppearanceStore = defineStore('appearance', () => {
  const style = ref<MapStyle>('ancient'),
    ancient = reactive({ ...DEFAULT_ANCIENT })
  try {
    const saved = JSON.parse(localStorage.getItem('dungeon-atelier:appearance') ?? 'null') as {
      version?: number
      style?: MapStyle
      ancient?: typeof ancient
    } | null
    if (saved && MAP_STYLES.some((s) => s.value === saved.style)) style.value = saved.style!
    if (saved?.ancient) {
      const wasUntouchedDefault = !saved.version && isLegacyDefaultAncient(saved.ancient)
      if (!wasUntouchedDefault) Object.assign(ancient, normalizeAncient(saved.ancient))
    }
  } catch {
    /* Use approved defaults if storage is unavailable or malformed. */
  }
  watch(
    [style, ancient],
    () => {
      try {
        localStorage.setItem(
          'dungeon-atelier:appearance',
          JSON.stringify({ version: 2, style: style.value, ancient }),
        )
      } catch {
        /* Optional persistence. */
      }
    },
    { deep: true },
  )
  function reset() {
    Object.assign(ancient, DEFAULT_ANCIENT)
  }
  return { style, ancient, reset }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useAppearanceStore, import.meta.hot))
}
