import { appearanceHash } from './plan.ts'

/** Stone-interior crops, with aspect ratios chosen for blocks and coping rather than whole walls. */
export function ruinsAtlasCrop(seed: string, index: number, coping: boolean) {
  return {
    x: coping
      ? [0.04, 0.35, 0.69, 0.12][index % 4]!
      : [0.025, 0.19, 0.355, 0.52, 0.685, 0.845][index % 6]!,
    y: coping
      ? [0.035, 0.215, 0.41, 0.61][Math.floor(index / 4)]!
      : Math.floor(index / 6) % 2
        ? 0.56
        : 0.075,
    width: coping ? 0.18 : 0.125,
    height: coping ? 0.125 : 0.18,
    patina: 0.02 + appearanceHash(seed, index, 0, 9109) * 0.035,
  }
}
