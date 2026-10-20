import type { ArchitectureOptions } from './architecture-model'
import type { AncientAppearance } from './ancient-settings'

/** Presentation choices are independent of renderer implementation and floor serialization. */
export const MAP_STYLES = [
  { label: 'Ancient Ruined Dungeon', value: 'ancient' },
  { label: 'Stone', value: 'stone' },
  { label: 'Classic', value: 'classic' },
] as const
export type MapStyle = (typeof MAP_STYLES)[number]['value']
export interface MapRenderOptions extends ArchitectureOptions {
  ancient?: Partial<AncientAppearance>
}
export const MAP_BACKGROUND = '#080c0d'
