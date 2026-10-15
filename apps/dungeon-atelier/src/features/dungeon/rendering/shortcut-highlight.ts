import type { Shortcut } from '@dungeon-atelier/core'
import { TILE_SIZE } from './tile-size'

/** Optional editor overlay; kept out of the base map, PNG exports, and exploration fog. */
export function drawShortcutHighlight(
  context: CanvasRenderingContext2D,
  shortcuts: Shortcut[],
  scale: number,
) {
  context.save()
  context.fillStyle = '#58dce144'
  for (const shortcut of shortcuts) {
    for (const p of shortcut.path)
      context.fillRect(p.x * TILE_SIZE + 2, p.y * TILE_SIZE + 2, TILE_SIZE - 4, TILE_SIZE - 4)
    context.strokeStyle = '#79f0f2'
    context.lineWidth = 2 / scale
    context.lineJoin = 'round'
    context.lineCap = 'round'
    context.setLineDash([5 / scale, 4 / scale])
    context.beginPath()
    shortcut.path.forEach((p, i) => {
      const x = (p.x + 0.5) * TILE_SIZE,
        y = (p.y + 0.5) * TILE_SIZE
      if (i === 0) context.moveTo(x, y)
      else context.lineTo(x, y)
    })
    context.stroke()
    context.setLineDash([])
    for (const p of [shortcut.path[0], shortcut.path[shortcut.path.length - 1]]) {
      if (!p) continue
      context.beginPath()
      context.arc((p.x + 0.5) * TILE_SIZE, (p.y + 0.5) * TILE_SIZE, 5 / scale, 0, Math.PI * 2)
      context.fillStyle = '#112b2c'
      context.fill()
      context.stroke()
    }
  }
  context.restore()
}
