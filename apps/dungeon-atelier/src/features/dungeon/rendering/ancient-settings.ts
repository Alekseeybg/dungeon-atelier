import type { DungeonFloor } from '@dungeon-atelier/core'
import { roomCells } from '@dungeon-atelier/core'
import type { FoundationFloor, FoundationTreatment } from './visual-foundation/art'
import type { FoundationOptions } from './visual-foundation/renderer'

export const ANCIENT_FLOORS = [
  { value: 'refined', label: 'Worn realistic flagstones', usage: 'General rooms and corridors' },
  { value: 'previous', label: 'Classic flagstones', usage: 'General rooms and corridors' },
  { value: 'study-weathered', label: 'Weathered flagstones', usage: 'Secondary rooms' },
  { value: 'study-irregular', label: 'Irregular flagstones', usage: 'Ruined or special rooms' },
  { value: 'study-broad', label: 'Broad natural slabs', usage: 'Large chambers' },
  { value: 'study-blended', label: 'Blended wear', usage: 'Secondary rooms and corridors' },
  { value: 'study-early', label: 'Ancient large stones', usage: 'Rare ancient chambers' },
] as const
export const ANCIENT_WALLS = [
  { value: 'ruins', label: 'Ancient Ruined Dungeon' },
  { value: 'fortress', label: 'Medieval Fortress' },
  { value: 'original', label: 'Original dimensional masonry' },
] as const
export const ANCIENT_CAPS = [
  {
    value: 'cut',
    label: 'Chiseled chamfer · recommended',
    options: { coping: 'hewn', capProfile: 'chamfered', capFinish: 'cut' },
  },
  {
    value: 'chamfer',
    label: 'Weathered chamfer',
    options: { coping: 'hewn', capProfile: 'chamfered', capFinish: 'soft' },
  },
  {
    value: 'hewn',
    label: 'Heavy hewn coping',
    options: { coping: 'hewn', capProfile: 'raised', capFinish: 'soft' },
  },
  {
    value: 'fitted',
    label: 'Fitted cap stones',
    options: { coping: 'current', capProfile: 'raised', capFinish: 'soft' },
  },
  {
    value: 'broken',
    label: 'Broken ancient slabs',
    options: { coping: 'broken', capProfile: 'raised', capFinish: 'soft' },
  },
] as const
export interface AncientAppearance {
  floor: FoundationFloor
  wall: FoundationTreatment
  cap: (typeof ANCIENT_CAPS)[number]['value']
  distribution: 'uniform' | 'regional'
  corridor: FoundationFloor | 'inherit'
  secondary: FoundationFloor | 'inherit'
  rare: FoundationFloor | 'inherit'
  lighting: boolean
  torches: boolean
  stairSymbols: boolean
  doorsOpen: boolean
}
export const DEFAULT_ANCIENT: Readonly<AncientAppearance> = Object.freeze({
  floor: 'refined',
  wall: 'ruins',
  cap: 'cut',
  distribution: 'uniform',
  corridor: 'inherit',
  secondary: 'study-weathered',
  rare: 'study-early',
  lighting: true,
  torches: true,
  stairSymbols: true,
  doorsOpen: false,
})
export function normalizeAncient(value: Partial<AncientAppearance> = {}): AncientAppearance {
  const result = { ...DEFAULT_ANCIENT }
  for (const key of Object.keys(result) as (keyof AncientAppearance)[]) {
    const v = value[key]
    const valid =
      key === 'floor'
        ? ANCIENT_FLOORS.some((o) => o.value === v)
        : key === 'wall'
          ? ANCIENT_WALLS.some((o) => o.value === v)
          : key === 'cap'
            ? ANCIENT_CAPS.some((o) => o.value === v)
            : key === 'distribution'
              ? v === 'uniform' || v === 'regional'
              : ['corridor', 'secondary', 'rare'].includes(key)
                ? v === 'inherit' || ANCIENT_FLOORS.some((o) => o.value === v)
                : typeof v === 'boolean'
    if (valid) Object.assign(result, { [key]: v })
  }
  return result
}
export function ancientOptions(a: AncientAppearance): FoundationOptions {
  return {
    ...ANCIENT_CAPS.find((c) => c.value === a.cap)!.options,
    treatment: a.wall,
    floor: a.floor,
    separation: true,
    capPolish: false,
    stairs: 'recessed',
    stairProfile: 'ascending',
    depthSortedStairs: true,
    stairArrow: a.stairSymbols ? 'brass' : 'none',
    torches: 'mounted',
    northTorchMount: 'projecting',
    lighting: a.lighting,
    doors: a.doorsOpen ? 'open' : 'closed',
  }
}
function hash(seed: string) {
  let h = 2166136261
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return h >>> 0
}
/** Whole regions share a material. No per-tile random material assignment. */
export function ancientFloorAssignments(floor: DungeonFloor, a: AncientAppearance) {
  const assigned = new Map<number, FoundationFloor>(),
    rooms = new Set<number>()
  let rareUsed = false
  for (const room of floor.rooms) {
    const cells = roomCells(room),
      roll = hash(`${floor.seed}:${room.id}`) % 100
    let material = a.floor
    if (a.distribution === 'regional') {
      if (!rareUsed && roll < 5 && cells.length >= 36 && a.rare !== 'inherit') {
        material = a.rare
        rareUsed = true
      } else if (roll >= 5 && roll < 25 && a.secondary !== 'inherit') material = a.secondary
    }
    for (const p of cells) {
      const key = p.y * floor.width + p.x
      rooms.add(key)
      if (material !== a.floor) assigned.set(key, material)
    }
  }
  if (a.corridor !== 'inherit' && a.corridor !== a.floor)
    floor.tiles.forEach((row, y) =>
      row.forEach((tile, x) => {
        const key = y * floor.width + x
        if (tile === 'floor' && !rooms.has(key)) assigned.set(key, a.corridor as FoundationFloor)
      }),
    )
  return assigned
}
