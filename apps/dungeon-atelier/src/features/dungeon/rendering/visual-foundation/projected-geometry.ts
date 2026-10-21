import type { Position } from '@dungeon-atelier/core'
import { FOUNDATION, project } from './model.ts'
import type { WallProjection } from './model.ts'

/** The same planes drive artwork, occlusion-aware placement and architectural picking. */
export function projectedRectangle(
  x: number,
  y: number,
  width: number,
  height: number,
  elevation = 0,
  projection: WallProjection = FOUNDATION,
) {
  return [
    project(x, y, elevation, projection),
    project(x + width, y, elevation, projection),
    project(x + width, y + height, elevation, projection),
    project(x, y + height, elevation, projection),
  ]
}
export function projectedFace(
  a: Position,
  b: Position,
  height = 1,
  projection: WallProjection = FOUNDATION,
) {
  return [
    project(a.x, a.y, height, projection),
    project(b.x, b.y, height, projection),
    project(b.x, b.y, 0, projection),
    project(a.x, a.y, 0, projection),
  ]
}
/** Convex planes overlap iff none of their edge normals separates them. */
export function convexOverlap(a: Position[], b: Position[]) {
  for (const polygon of [a, b])
    for (let i = 0; i < polygon.length; i++) {
      const p = polygon[i]!,
        q = polygon[(i + 1) % polygon.length]!,
        nx = p.y - q.y,
        ny = q.x - p.x,
        aa = a.map((v) => v.x * nx + v.y * ny),
        bb = b.map((v) => v.x * nx + v.y * ny)
      if (Math.max(...aa) <= Math.min(...bb) || Math.max(...bb) <= Math.min(...aa)) return false
    }
  return true
}
