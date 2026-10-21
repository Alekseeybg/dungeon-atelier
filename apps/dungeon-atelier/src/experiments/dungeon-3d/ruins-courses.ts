import { appearanceHash } from './plan.ts'
import { wallField } from './wall-wear.ts'
import type { WallRun } from './asset-model.ts'

/** A mason's coursed bond: mixed stock lengths, lapped joints and no end slivers.
 * Course heights remain shared across adjoining runs; neither caps nor openings move.
 */
export function ruinsCourses(seed: string, edge: WallRun, height: number) {
  const horizontal = edge.az === edge.bz,
    start = horizontal ? edge.ax : edge.az,
    end = horizontal ? edge.bx : edge.bz,
    face = horizontal ? edge.az : edge.ax,
    rows = Math.max(1, Math.round(height / 0.34)),
    courseHeight = height / rows,
    stock = [0.52, 0.76, 1.04, 1.36, 1.68],
    blocks: { a: number; b: number; low: number; high: number; relief: number }[] = []
  let below: number[] = []
  for (let row = 0; row < rows; row++) {
    const joints: number[] = [],
      lengths: number[] = []
    let cursor = start
    while (cursor < end - 1e-6) {
      const remaining = end - cursor,
        region = wallField(
          seed,
          horizontal ? cursor / 7 : face / 7,
          0,
          horizontal ? face / 7 : cursor / 7,
        ),
        candidates = stock.map((length, i) => ({
          length: length + (appearanceHash(seed, cursor, face + row, 9601 + i) - 0.5) * 0.09,
          weight: [0.7, 1.6, 2.5, 1.8, 0.7][i]! * (i > 2 ? 0.7 + region : 1.3 - region * 0.4),
        }))
      // A closure stone is considered alongside stock, rather than clipping off a tiny fragment.
      if (remaining <= 1.85)
        candidates.push({ length: remaining, weight: remaining < 0.65 ? 5 : 1.2 })
      let chosen = remaining,
        best = Infinity
      candidates.forEach(({ length, weight }, i) => {
        if (length > remaining + 1e-6 || (remaining - length > 1e-6 && remaining - length < 0.38))
          return
        const boundary = cursor + length,
          lap =
            boundary < end - 1e-6
              ? Math.min(...below.map((j) => Math.abs(j - boundary)), Infinity)
              : Infinity,
          repeat = lengths.slice(-2).filter((n) => Math.abs(n - length) < 0.13).length,
          chance = Math.max(0.0001, appearanceHash(seed, cursor + row * 0.137, face, 9623 + i)),
          score = -Math.log(chance) / weight + repeat * 1.3 + Math.max(0, 0.19 - lap) * 120
        if (score < best) {
          best = score
          chosen = length
        }
      })
      const next = Math.min(end, cursor + chosen),
        along = (cursor + next) / 2,
        x = horizontal ? along : face,
        z = horizontal ? face : along,
        zone = wallField(seed, x / 4, row / 4, z / 4),
        individual = appearanceHash(seed, along, face + row, 9641),
        // Most stones lie in a quiet common plane; occasional headers sit slightly proud/recessed.
        accent = individual > 0.88 ? 0.012 : individual < 0.12 ? -0.009 : 0,
        relief = 0.028 + zone * 0.012 + accent,
        joint = 0.009 + wallField(seed, x / 3, row / 4, z / 3) * 0.003
      blocks.push({
        a: cursor + joint,
        b: next - joint,
        low: row * courseHeight + 0.009,
        high: Math.min(height - 0.012, (row + 1) * courseHeight - 0.009),
        relief,
      })
      if (next < end - 1e-6) joints.push(next)
      lengths.push(chosen)
      cursor = next
    }
    below = joints
  }
  return blocks
}
