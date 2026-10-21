import { appearanceHash } from './plan.ts'

/** Periodic appearance field for the experimental cap map, independent of generation RNG. */
export function createCapWeathering(seed: string) {
  const base = Math.floor(appearanceHash(seed, 0, 0, 883) * 4294967295)
  function hash(x: number, y: number, salt: number) {
    let h = base ^ Math.imul(x + 1, 0x45d9f3b) ^ Math.imul(y + 1, 0x27d4eb2d) ^ salt
    h = Math.imul(h ^ (h >>> 16), 0x7feb352d)
    return ((h ^ (h >>> 15)) >>> 0) / 4294967295
  }
  const smooth = (v: number) => v * v * (3 - 2 * v),
    mix = (a: number, b: number, t: number) => a + (b - a) * t
  function noise(u: number, v: number, count: number, salt: number) {
    const x = (((u % 1) + 1) % 1) * count,
      y = (((v % 1) + 1) % 1) * count,
      ix = Math.floor(x),
      iy = Math.floor(y),
      fx = smooth(x - ix),
      fy = smooth(y - iy),
      value = (a: number, b: number) => hash(a % count, b % count, salt)
    return mix(
      mix(value(ix, iy), value(ix + 1, iy), fx),
      mix(value(ix, iy + 1), value(ix + 1, iy + 1), fx),
      fy,
    )
  }
  return {
    sample(u: number, v: number) {
      const patch = noise(u, v, 4, 31) * 0.7 + noise(u, v, 16, 53) * 0.3,
        dirt = Math.max(0, noise(u, v, 8, 71) - 0.32) * 0.95,
        edge = (value: number) => {
          const f = ((value % 1) + 1) % 1
          return Math.min(f, 1 - f, Math.abs(f - 0.1875), Math.abs(f - 0.8125))
        },
        crevice = 1 - Math.min(1, Math.min(edge(u), edge(v)) * 24),
        moss = Math.max(0, patch - 0.56) * 1.2 * (0.25 + crevice * 0.75)
      return { dirt, moss }
    },
    cracks: Array.from({ length: 12 }, (_, i) => ({
      u: 0.1 + hash(i, 0, 109) * 0.72,
      v: 0.1 + hash(i, 1, 109) * 0.72,
      du: (hash(i, 2, 109) - 0.5) * 0.2,
      dv: (hash(i, 3, 109) - 0.5) * 0.2,
      alpha: 0.48 + hash(i, 4, 109) * 0.3,
      width: 1.0 + hash(i, 5, 109) * 0.7,
      bends: Array.from({ length: 5 }, (_, k) => (hash(i, k + 7, 117) - 0.5) * 0.018),
    })),
  }
}
