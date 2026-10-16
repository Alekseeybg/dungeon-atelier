import { dimensionalArt } from '../dimensional-art'
import { dimensionalProjection } from './dimensional-model'

type StonePainter = (
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  tone: number,
  random: () => number,
  cap?: boolean,
) => void
const { side, rise } = dimensionalProjection(32)

/** Study only. Materials are projected into architectural planes; no perspective frame is rotated. */
export function paintDoorAssembly(
  c: CanvasRenderingContext2D,
  facing: string,
  state: string,
  stone: StonePainter,
) {
  let seed = 71417
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 4294967296
  }
  const opening = new Path2D()
  opening.arc(16, 14, 10, Math.PI, 0)
  opening.lineTo(26, rise)
  opening.lineTo(6, rise)
  opening.closePath()
  const face = () => {
    c.save()
    c.clip(opening)
    c.fillStyle = '#040b124d'
    c.fillRect(6, 4, 20, rise - 4)
    const art = dimensionalArt()
    c.imageSmoothingEnabled = true
    c.imageSmoothingQuality = 'high'
    if (state === 'closed') {
      c.fillStyle = '#86552f'
      c.fillRect(6, 4, 20, rise - 4)
      if (art) c.drawImage(art.door, 6, 4, 20, rise - 4)
    } else if (state === 'secret') {
      for (let row = 0; row < 4; row++)
        for (let col = -1; col < 2; col++)
          stone(c, 6 + col * 12 + (row % 2 ? 6 : 0), 4 + row * 8, 11.5, 7.5, 59, random)
    } else {
      const hinge = facing === 'south' || facing === 'west' ? 22 : 6
      c.fillStyle = '#6f4528'
      c.fillRect(hinge, 6, 4, rise - 6)
      if (art) c.drawImage(art.door, hinge, 6, 4, rise - 6)
    }
    c.restore()
    const surround = new Path2D()
    surround.rect(0, 0, 32, rise)
    surround.addPath(opening)
    c.save()
    c.clip(surround, 'evenodd')
    c.fillStyle = '#111b22'
    c.fillRect(0, 0, 32, rise)
    for (let row = 0; row < 4; row++)
      for (let col = -1; col < 3; col++)
        stone(
          c,
          col * 16 + (row % 2 ? 8 : 0) + 0.3,
          (row * rise) / 4 + 0.3,
          15.4,
          rise / 4 - 0.6,
          57 + random() * 10,
          random,
        )
    c.restore()
    // Fitted voussoirs are in the wall face, below the same continuous coping plane.
    for (let i = 0; i < 7; i++) {
      const a = Math.PI + (i * Math.PI) / 7,
        b = Math.PI + ((i + 1) * Math.PI) / 7
      c.save()
      c.beginPath()
      c.arc(16, 14, 15.5, a, b)
      c.arc(16, 14, 10, b, a, true)
      c.closePath()
      c.clip()
      stone(c, 0, -2, 32, 24, 85 + (i % 2) * 5, random, true)
      c.restore()
      c.strokeStyle = '#182128'
      c.lineWidth = 0.7
      c.stroke()
    }
  }
  const horizontal = facing === 'north' || facing === 'south'
  if (horizontal) {
    // Threshold is a horizontal floor surface; its upper edge meets the leaf's feet.
    stone(c, side + 4, rise + 24, 24, 6, 78, random, true)
    c.save()
    c.transform(1, 0, side / rise, 1, 0, 26)
    face()
    c.restore()
    // The cap keeps the exact footprint and height of adjacent horizontal wall caps.
    for (let row = 0; row < 2; row++)
      for (let col = 0; col < 2; col++)
        stone(c, col * 16 + 0.3, 6 + row * 10 + 0.3, 15.4, 9.4, 94, random, true)
  } else {
    const jamb = (y: number) => {
      c.save()
      c.beginPath()
      c.moveTo(6, y + 6)
      c.lineTo(26, y + 6)
      c.lineTo(26 + side, y + 6 + rise)
      c.lineTo(6 + side, y + 6 + rise)
      c.closePath()
      c.clip()
      c.transform(1, 0, side / rise, 1, (-(y + 6) * side) / rise, 0)
      c.fillStyle = '#111b22'
      c.fillRect(6, y + 6, 20, rise)
      for (let row = 0; row < 4; row++)
        for (let col = -1; col < 2; col++)
          stone(
            c,
            6 + col * 16 + (row % 2 ? 8 : 0),
            y + 6 + (row * rise) / 4,
            15.5,
            rise / 4 - 0.5,
            53,
            random,
          )
      c.restore()
    }
    jamb(0)
    jamb(26)
    c.save()
    // The visible opening belongs to the EAST masonry surface, not the wall's
    // centerline. Placing it at x=16 embeds the leaf behind the foreground jamb.
    c.transform(0, 1, side / rise, 1, 26, 0)
    face()
    c.restore()
    for (const y of [0, 26]) stone(c, 6.2, y + 0.2, 19.6, 5.6, 94, random, true)
  }
  if (state === 'secret') {
    c.fillStyle = '#0e292ee8'
    c.fillRect(12, rise, 10, 14)
    c.fillStyle = '#a9eee7'
    c.font = 'bold 11px monospace'
    c.textAlign = 'center'
    c.fillText('S', 17, rise + 11)
  }
}
