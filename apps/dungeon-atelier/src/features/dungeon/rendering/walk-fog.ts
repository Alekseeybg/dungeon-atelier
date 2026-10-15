import type { DungeonFloor } from '@dungeon-atelier/core'
import type { WalkState } from '../exploration/useDungeonWalk'
import { TILE_SIZE } from './tile-size'

/** Draw after the map in native map coordinates, for both the viewport and automap. */
export function renderWalkFog(
  context: CanvasRenderingContext2D,
  floor: DungeonFloor,
  walk: WalkState,
) {
  if (!walk.active || !walk.position) return
  context.save()
  const unknown = new Path2D()
  for (let y = 0; y < floor.height; y++) {
    for (let x = 0; x < floor.width; x++) {
      const key = y * floor.width + x
      if (walk.explored.has(key)) continue
      unknown.rect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE)
    }
  }
  context.fillStyle = '#080c0d'
  context.fill(unknown)
  context.translate((walk.position.x + 0.5) * TILE_SIZE, (walk.position.y + 0.5) * TILE_SIZE)
  context.rotate((walk.heading * Math.PI) / 2)
  context.fillStyle = '#080c0d'
  context.strokeStyle = '#f7d56b'
  context.lineWidth = 1.5
  context.beginPath()
  context.arc(0, 0, 12, 0, Math.PI * 2)
  context.fill()
  context.fillStyle = '#f7d56b'
  context.beginPath()
  context.moveTo(0, -10)
  context.lineTo(8, 8)
  context.lineTo(0, 4)
  context.lineTo(-8, 8)
  context.closePath()
  context.fill()
  context.stroke()
  context.restore()
}
