export const DUNGEON_3D_THEMES = {
  'restored-crypt': {
    label: 'Restored Crypt',
    lighting: { ambient: 1.9, sun: 3, fill: 1.2, exposure: 1.15, torch: 3.6 },
  },
  'ancient-ruins': {
    label: 'Ancient Ruins',
    lighting: { ambient: 1.3, sun: 2, fill: 0.65, exposure: 1.15, torch: 3.6 },
  },
} as const
export type Dungeon3DTheme = keyof typeof DUNGEON_3D_THEMES
export const DEFAULT_3D_THEME: Dungeon3DTheme = 'ancient-ruins'
