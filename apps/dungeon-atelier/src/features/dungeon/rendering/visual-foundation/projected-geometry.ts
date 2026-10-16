import type { Position } from '@dungeon-atelier/core'
import { project } from './model.ts'

/** The same planes drive artwork, occlusion-aware placement and architectural picking. */
export function projectedRectangle(
  x: number,
  y: number,
  width: number,
  height: number,
  elevation = 0,
) {
  return [
    project(x, y, elevation),
    project(x + width, y, elevation),
    project(x + width, y + height, elevation),
    project(x, y + height, elevation),
  ]
}
export function projectedFace(a: Position, b: Position, height = 1) {
  return [
    project(a.x, a.y, height),
    project(b.x, b.y, height),
    project(b.x, b.y),
    project(a.x, a.y),
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
