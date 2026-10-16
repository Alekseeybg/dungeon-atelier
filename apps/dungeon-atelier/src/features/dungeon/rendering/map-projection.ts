import type { DungeonFloor, Position } from '@dungeon-atelier/core'
import type { MapStyle } from './map-style'
import { FOUNDATION } from './visual-foundation/model.ts'

/** Logical cells stay square. Only presentation coordinates and raster density vary. */
export function mapProjection(style: MapStyle) {
  return {
    width: FOUNDATION.tile,
    height: style === 'ancient' ? FOUNDATION.tile * FOUNDATION.depth : FOUNDATION.tile,
    density: style === 'ancient' ? FOUNDATION.density : 1,
    padding: style === 'ancient' ? FOUNDATION.padding : 0,
  }
}
export function cellCenter(position: Position, style: MapStyle): Position {
  const p = mapProjection(style)
  return { x: (position.x + 0.5) * p.width, y: (position.y + 0.5) * p.height }
}
export function groundCell(
  point: Position,
  floor: Pick<DungeonFloor, 'width' | 'height'>,
  style: MapStyle,
) {
  const p = mapProjection(style),
    x = Math.floor(point.x / p.width),
    y = Math.floor(point.y / p.height)
  return x >= 0 && y >= 0 && x < floor.width && y < floor.height ? { x, y } : null
}
