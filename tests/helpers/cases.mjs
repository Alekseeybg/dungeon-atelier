import {
  DEFAULT_CONFIG,
  LAYOUT_PRESETS,
  ROOM_DESIGNS,
} from '../../packages/dungeon-core/dist/index.js'
export const dimensions = [
  [24, 24],
  [32, 32],
  [48, 48],
  [64, 64],
  [16, 16],
  [96, 96],
  [48, 32],
  [64, 48],
]
export function stressCase(index) {
  const [width, height] = dimensions[index % dimensions.length],
    preset = Math.floor(index / dimensions.length) % 2 ? 'compact' : 'classic',
    cycle = Math.floor(index / (dimensions.length * 2))
  return {
    ...DEFAULT_CONFIG,
    ...LAYOUT_PRESETS[preset],
    layoutStyle: preset,
    width,
    height,
    seed: `verification-${String(index).padStart(6, '0')}-${cycle.toString(36)}`,
    targetRoomCount:
      width === 16
        ? 4
        : Math.min(40, Math.max(6, Math.floor((width * height) / [140, 80, 50][cycle % 3]))),
    minRoomSize: 3,
    maxRoomSize: width === 16 ? 4 : [5, 7, 9][cycle % 3],
    roomShapeChance: [0, 0.25, 0.65, 1][cycle % 4],
    extraConnectionChance: [0, 0.2, 0.6, 1][Math.floor(cycle / 4) % 4],
    chamberBlockChance: [0, 0.2, 1][Math.floor(cycle / 3) % 3],
    shortcutChance: [0, 0.15, 1][Math.floor(cycle / 5) % 3],
    roomDesigns:
      cycle % 7 === 6
        ? [ROOM_DESIGNS[cycle % ROOM_DESIGNS.length].value]
        : [...DEFAULT_CONFIG.roomDesigns],
  }
}
