import type { Position } from '@dungeon-atelier/core'
import { FOUNDATION as P } from './model'
import type { WallProjection } from './model'
import { capBoundarySegments } from './plane-separation'

export type CapEffect = 'highlights' | 'occlusion' | 'wear' | 'shading'
export const CAP_EFFECTS: CapEffect[] = ['highlights', 'occlusion', 'wear', 'shading']
const fields = new WeakMap<CanvasPattern, Uint8ClampedArray>()
function textureField(pattern: CanvasPattern) {
  let pixels = fields.get(pattern)
  if (!pixels) {
    const field = document.createElement('canvas')
    field.width = field.height = 256 // Existing cap's full mirrored world-space period.
    const c = field.getContext('2d')!
    c.fillStyle = pattern
    c.fillRect(0, 0, 256, 256)
    pixels = c.getImageData(0, 0, 256, 256).data
    fields.set(pattern, pixels)
  }
  return pixels
}

/** A shallow shadow immediately under the coping, clipped to the actual visible masonry face. */
export function shadeCapJoint(c: CanvasRenderingContext2D, points: Position[]) {
  const [a, b, , d] = points as [Position, Position, Position, Position]
  c.save()
  c.globalCompositeOperation = 'source-atop'
  // Shade in face coordinates: a screen-space gradient would fade along east-facing runs.
  c.transform(b.x - a.x, b.y - a.y, d.x - a.x, d.y - a.y, a.x, a.y)
  const shadow = c.createLinearGradient(0, 0, 0, 0.14)
  shadow.addColorStop(0, '#03080b88')
  shadow.addColorStop(0.35, '#03080b36')
  shadow.addColorStop(1, '#03080b00')
  c.fillStyle = shadow
  c.fillRect(0, 0, 1, 0.14)
  c.restore()
}

/** Existing stone controls the worn arris. No new source art, random noise or tile outlines. */
export function polishCap(
  c: CanvasRenderingContext2D,
  cap: Path2D,
  rects: Parameters<typeof capBoundarySegments>[0],
  x: number,
  y: number,
  pattern: CanvasPattern,
  effects: CapEffect[] = CAP_EFFECTS,
  projection: WallProjection = P,
) {
  const edges = capBoundarySegments(rects),
    pixels = textureField(pattern)
  const tone = (px: number, py: number) => {
    const i =
      ((((Math.floor(py) % 256) + 256) % 256) * 256 + (((Math.floor(px) % 256) + 256) % 256)) * 4
    return (pixels[i]! * 0.2126 + pixels[i + 1]! * 0.7152 + pixels[i + 2]! * 0.0722) / 255
  }
  c.save()
  c.clip(cap)
  // Preserve the existing silhouette/coverage, including antialiased edge pixels.
  c.globalCompositeOperation = 'source-atop'
  c.transform(1, 0, 0, P.depth, -projection.side, -projection.rise)
  c.lineCap = 'butt'
  for (const edge of edges) {
    const vertical = edge.ax === edge.bx,
      ax = x + edge.ax,
      ay = y + edge.ay,
      bx = x + edge.bx,
      by = y + edge.by,
      direction = edge.light ? 1 : -1,
      nx = vertical ? direction : 0,
      ny = vertical ? 0 : direction
    // A small directional roll across the last few pixels, rather than a bevel filter.
    if (effects.includes('shading')) {
      const wash = c.createLinearGradient(ax, ay, ax + nx * 3.5, ay + ny * 3.5)
      wash.addColorStop(0, edge.light ? '#fff0ca24' : '#09101844')
      wash.addColorStop(1, edge.light ? '#fff0ca00' : '#09101800')
      c.fillStyle = wash
      c.fillRect(
        Math.min(ax, ax + nx * 3.5),
        Math.min(ay, ay + ny * 3.5),
        vertical ? 3.5 : bx - ax,
        vertical ? by - ay : 3.5,
      )
    }
    if (effects.includes('highlights')) {
      c.strokeStyle = edge.light ? '#f3e2b84a' : '#e4d5b62e'
      c.lineWidth = edge.light ? 0.8 : 0.55
      c.beginPath()
      c.moveTo(ax + nx * 0.55, ay + ny * 0.55)
      c.lineTo(bx + nx * 0.55, by + ny * 0.55)
      c.stroke()
    }
    if (effects.includes('wear')) {
      const start = vertical ? ay : ax,
        end = vertical ? by : bx,
        step = 1.6
      // Sample in absolute world coordinates, so connected placements share the same phase.
      for (let p = Math.floor(start / step) * step; p < end; p += step) {
        const lo = Math.max(p, start),
          hi = Math.min(p + step, end),
          px = vertical ? ax : (lo + hi) / 2,
          py = vertical ? (lo + hi) / 2 : ay,
          value = tone(px + nx, py + ny),
          inset = 0.2 + Math.max(0, 0.62 - value) * 1.8
        c.lineWidth = 0.65
        c.strokeStyle = `rgba(7,12,15,${0.12 + (1 - value) * 0.17})`
        c.beginPath()
        c.moveTo(vertical ? ax + nx * 0.2 : lo, vertical ? lo : ay + ny * 0.2)
        c.lineTo(vertical ? ax + nx * inset : hi, vertical ? hi : ay + ny * inset)
        c.stroke()
        c.strokeStyle = `rgba(236,219,181,${(edge.light ? 0.13 : 0.08) + value * 0.14})`
        c.beginPath()
        c.moveTo(vertical ? ax + nx * (inset + 0.45) : lo, vertical ? lo : ay + ny * (inset + 0.45))
        c.lineTo(vertical ? ax + nx * (inset + 0.55) : hi, vertical ? hi : ay + ny * (inset + 0.55))
        c.stroke()
      }
    }
  }
  if (effects.includes('occlusion')) {
    // Only contour turns inside a placement; never invent joints at tile borders.
    const vertices = new Map<string, { x: number; y: number; axes: Set<boolean> }>()
    for (const e of edges)
      for (const p of [
        { x: e.ax, y: e.ay },
        { x: e.bx, y: e.by },
      ]) {
        const key = `${p.x},${p.y}`,
          vertex = vertices.get(key) ?? { ...p, axes: new Set<boolean>() }
        vertex.axes.add(e.ax === e.bx)
        vertices.set(key, vertex)
      }
    for (const vertex of vertices.values()) {
      if (vertex.axes.size < 2) continue
      const occupied = (dx: number, dy: number) =>
        rects.some(
          (r) =>
            vertex.x + dx >= r.x &&
            vertex.x + dx < r.x + r.width &&
            vertex.y + dy >= r.y &&
            vertex.y + dy < r.y + r.height,
        )
      if (
        [
          [-0.1, -0.1],
          [0.1, -0.1],
          [-0.1, 0.1],
          [0.1, 0.1],
        ].filter(([dx, dy]) => occupied(dx!, dy!)).length !== 3
      )
        continue
      const ao = c.createRadialGradient(
        x + vertex.x,
        y + vertex.y,
        0,
        x + vertex.x,
        y + vertex.y,
        3.2,
      )
      ao.addColorStop(0, '#03090d60')
      ao.addColorStop(1, '#03090d00')
      c.fillStyle = ao
      c.fillRect(x + vertex.x - 3.2, y + vertex.y - 3.2, 6.4, 6.4)
    }
  }
  c.restore()
}
