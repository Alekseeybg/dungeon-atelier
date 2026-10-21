import { FOUNDATION } from './model.ts'
import type { WallProjection } from './model.ts'

export const VIEW_ANGLES = [0, 5, 10, 15] as const

/** Turn the ground before its vertical compression, keeping wall height screen-aligned. */
export function viewAngleTransform(angle: number) {
  if (!Number.isFinite(angle) || angle < 0 || angle > 15)
    throw new Error('The view-angle study supports angles from 0 to 15 degrees.')
  const radians = (angle * Math.PI) / 180,
    cos = Math.cos(radians),
    sin = Math.sin(radians)
  return { a: cos, b: FOUNDATION.depth * sin, c: -sin / FOUNDATION.depth, d: cos }
}

/** Inverse-transform the height vector before rendering. Applying the ground turn afterward
 * then leaves walls upright, rather than spinning a completed flat screenshot. */
export function projectionBeforeTurn(projection: WallProjection, angle: number): WallProjection {
  const t = viewAngleTransform(angle)
  return {
    side: t.d * projection.side - t.c * projection.rise,
    rise: -t.b * projection.side + t.a * projection.rise,
  }
}
