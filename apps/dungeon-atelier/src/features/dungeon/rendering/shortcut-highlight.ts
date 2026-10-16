import type { Shortcut } from '@dungeon-atelier/core'
import { mapProjection } from './map-projection'
import type { MapStyle } from './map-style'

/** Optional editor overlay; kept out of the base map, PNG exports, and exploration fog. */
export function drawShortcutHighlight(
  context: CanvasRenderingContext2D,
  shortcuts: Shortcut[],
  scale: number,
  style: MapStyle = 'stone',
) {
  const { width, height } = mapProjection(style)
  context.save()
  context.fillStyle = '#58dce144'
  for (const shortcut of shortcuts) {
    for (const p of shortcut.path)
      context.fillRect(p.x * width + 2, p.y * height + 2, width - 4, height - 4)
    context.strokeStyle = '#79f0f2'
    context.lineWidth = 2 / scale
    context.lineJoin = 'round'
    context.lineCap = 'round'
    context.setLineDash([5 / scale, 4 / scale])
    context.beginPath()
    shortcut.path.forEach((p, i) => {
      const x = (p.x + 0.5) * width,
        y = (p.y + 0.5) * height
      if (i === 0) context.moveTo(x, y)
      else context.lineTo(x, y)
    })
    context.stroke()
    context.setLineDash([])
    for (const p of [shortcut.path[0], shortcut.path[shortcut.path.length - 1]]) {
      if (!p) continue
      context.beginPath()
      context.arc((p.x + 0.5) * width, (p.y + 0.5) * height, 5 / scale, 0, Math.PI * 2)
      context.fillStyle = '#112b2c'
      context.fill()
      context.stroke()
    }
  }
  context.restore()
}
