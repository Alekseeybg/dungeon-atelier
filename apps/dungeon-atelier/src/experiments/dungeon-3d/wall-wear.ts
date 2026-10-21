import { appearanceHash } from './plan.ts'

const ease = (v: number) => v * v * (3 - 2 * v)
/** Smooth, seeded world-space field; continuous across block and course boundaries. */
export function wallField(seed: string, x: number, y: number, z: number) {
  const a = Math.floor(x),
    b = Math.floor(y),
    c = Math.floor(z),
    u = ease(x - a),
    v = ease(y - b),
    w = ease(z - c)
  let result = 0
  for (let i = 0; i < 2; i++)
    for (let j = 0; j < 2; j++)
      for (let k = 0; k < 2; k++)
        result +=
          appearanceHash(seed, a + i, c + k, (b + j) * 109 + 7717) *
          (i ? u : 1 - u) *
          (j ? v : 1 - v) *
          (k ? w : 1 - w)
  return result
}

export function wallCracks(seed: string) {
  return Array.from({ length: 11 }, (_, i) => {
    const h = (salt: number) => appearanceHash(seed, i, salt, 7823),
      x = h(1) * 8,
      y = 0.15 + h(2) * 3.7,
      dx = (h(3) - 0.5) * 0.6,
      dy = -(0.2 + h(4) * 0.65),
      points = Array.from({ length: 7 }, (_, j) => ({
        x: x + (dx * j) / 6 + (j === 0 || j === 6 ? 0 : (h(j + 12) - 0.5) * 0.1),
        y: y + (dy * j) / 6,
      }))
    return {
      points,
      branch: [points[3]!, { x: points[3]!.x + (h(8) - 0.5) * 0.32, y: points[3]!.y - 0.16 }],
      width: 0.65 + h(9) * 0.55,
    }
  })
}
