import { wallCapRects } from '../dimensional-model'
import { FOUNDATION as P } from './model'
import type { CopingArt } from './coping-art'
import type { CopingBlock, CopingNode, CopingStudy } from './coping-model'

/** Ground-space cap only. Existing face images, door panels and fixed height remain untouched. */
function paintCopingTop(
  c: CanvasRenderingContext2D,
  nodes: CopingNode[],
  blocks: CopingBlock[],
  art: CopingArt,
  study: Exclude<CopingStudy, 'current'>,
) {
  const lookup = new Map(nodes.map((n) => [`${n.x},${n.y}`, n]))
  c.fillStyle = '#292b28'
  const inner = (v: number) => v
  for (const node of nodes)
    for (const r of wallCapRects(node.mask, node.corner, 32))
      c.fillRect(
        node.x * 32 + inner(r.x),
        node.y * 32 + inner(r.y),
        inner(r.x + r.width) - inner(r.x),
        inner(r.y + r.height) - inner(r.y),
      )
  for (const b of blocks) {
    if (b.junction) {
      const node = lookup.get(`${b.x / 32},${b.y / 32}`)!,
        x = b.x,
        y = b.y,
        rects = wallCapRects(node.mask, node.corner, 32)
      const spread = study === 'hewn' ? 2 : 3,
        edge = (v: number) => (v === 6 ? 6 - spread : v === 26 ? 26 + spread : v)
      c.save()
      c.beginPath()
      c.rect(x, y, 32, 32)
      c.clip()
      c.beginPath()
      for (const r of rects)
        c.rect(
          x + edge(r.x),
          y + edge(r.y),
          edge(r.x + r.width) - edge(r.x),
          edge(r.y + r.height) - edge(r.y),
        )
      c.clip()
      c.drawImage(art.stones[b.image]!, x - 3, y - 3, 38, 38)
      c.restore()
    } else c.drawImage(art.stones[b.image]!, b.x, b.y, b.width, b.height)
  }
}

export interface CopingSurface {
  top: HTMLCanvasElement
  rim: HTMLCanvasElement
  padding: number
}
/** Alpha-shaped top, worn bevel and short extruded stone fascia, in the fixed projection. */
export function buildCopingSurface(
  nodes: CopingNode[],
  blocks: CopingBlock[],
  art: CopingArt,
  study: Exclude<CopingStudy, 'current'>,
  bevelEnabled = true,
): CopingSurface {
  const padding = 8,
    width = (Math.max(...nodes.map((n) => n.x)) + 1) * 32 + padding * 2,
    height = (Math.max(...nodes.map((n) => n.y)) + 1) * 32 + padding * 2,
    top = document.createElement('canvas'),
    rim = document.createElement('canvas')
  top.width = rim.width = width * 2
  top.height = rim.height = height * 2
  const c = top.getContext('2d')!
  c.scale(2, 2)
  c.translate(padding, padding)
  // Resample each stone exactly once before atlas slicing, including stones crossing cells.
  paintCopingTop(c, nodes, blocks, art, study)
  const image = c.getImageData(0, 0, top.width, top.height),
    distance = new Float32Array(top.width * top.height),
    w = top.width,
    h = top.height
  for (let i = 0; i < distance.length; i++) distance[i] = image.data[i * 4 + 3]! > 128 ? 10000 : 0
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x
      if (!distance[i]) continue
      distance[i] = Math.min(
        distance[i],
        distance[i - 1]! + 1,
        distance[i - w]! + 1,
        distance[i - w - 1]! + 1.414,
        distance[i - w + 1]! + 1.414,
      )
    }
  for (let y = h - 2; y > 0; y--)
    for (let x = w - 2; x > 0; x--) {
      const i = y * w + x
      if (!distance[i]) continue
      distance[i] = Math.min(
        distance[i],
        distance[i + 1]! + 1,
        distance[i + w]! + 1,
        distance[i + w + 1]! + 1.414,
        distance[i + w - 1]! + 1.414,
      )
    }
  const bevel = bevelEnabled ? (study === 'hewn' ? 3.4 : 4.2) : 0
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x,
        d = distance[i]!
      if (d <= 0 || d > bevel) continue
      const gx = distance[i + 1]! - distance[i - 1]!,
        gy = distance[i + w]! - distance[i - w]!,
        length = Math.hypot(gx, gy) || 1,
        light = (gx * 0.64 + gy * 0.77) / length,
        bias = light * 44 * (1 - d / (bevel + 1))
      for (let channel = 0; channel < 3; channel++)
        image.data[i * 4 + channel] = image.data[i * 4 + channel]! + bias
    }
  c.putImageData(image, 0, 0)
  // The lower lip carries the same stone as a darker vertical plane, not a cast shadow.
  for (let i = 0; i < image.data.length; i += 4)
    for (let channel = 0; channel < 3; channel++)
      image.data[i + channel] = image.data[i + channel]! * 0.32 + 32
  rim.getContext('2d')!.putImageData(image, 0, 0)
  return { top, rim, padding }
}

export function drawRaisedCoping(
  c: CanvasRenderingContext2D,
  node: CopingNode,
  surface: CopingSurface,
  study: Exclude<CopingStudy, 'current'>,
) {
  const x = node.x * 32,
    y = node.y * 32,
    sx = (x + surface.padding) * 2,
    sy = (y + surface.padding) * 2,
    thickness = study === 'hewn' ? 2.8 : 3.8,
    drop = thickness / P.rise
  c.save()
  c.transform(1, 0, 0, P.depth, -P.side, -P.rise)
  for (let step = 8; step >= 1; step--) {
    const t = step / 8
    c.drawImage(
      surface.rim,
      sx,
      sy,
      64,
      64,
      x + P.side * drop * t,
      y + (thickness / P.depth) * t,
      32,
      32,
    )
  }
  c.drawImage(surface.top, sx, sy, 64, 64, x, y, 32, 32)
  c.restore()
}
