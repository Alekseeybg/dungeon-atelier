import {
  dimensionalSpriteDefinitions,
  dimensionalProjection,
  spriteDestination,
  visualHash,
  WALL,
  wallCapRects,
  wallFrontSegments,
  wallEastSegments,
} from './dimensional-model'
import type { SpriteDefinition } from './dimensional-model'
import {
  dimensionalArt,
  loadDimensionalArtwork,
  paintedFloorPattern,
  paintStoneMaterial,
} from './dimensional-art'

export interface DimensionalAtlas {
  image: CanvasImageSource
  sprites: ReadonlyMap<string, SpriteDefinition>
  provenance: 'procedural-placeholder' | 'generated-raster' | 'production'
}
const atlases = new Map<number, DimensionalAtlas>()
const { side: SIDE, rise: RISE } = dimensionalProjection(32)
export async function prepareDimensionalAtlas() {
  if (dimensionalArt()) return
  await loadDimensionalArtwork()
  atlases.clear()
}

function randomFor(seed: number) {
  let value = seed >>> 0
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0
    return value / 4294967296
  }
}
function block(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  tone: number,
  random: () => number,
  cap = false,
) {
  const chip = 0.6 + random() * 1.2
  c.save()
  c.beginPath()
  c.moveTo(x + chip, y)
  c.lineTo(x + w - chip, y)
  c.lineTo(x + w, y + chip)
  c.lineTo(x + w, y + h - chip)
  c.lineTo(x + w - chip, y + h)
  c.lineTo(x + chip, y + h)
  c.lineTo(x, y + h - chip)
  c.lineTo(x, y + chip)
  c.closePath()
  c.clip()
  const wash = c.createLinearGradient(x, y, x + w * 0.3, y + h)
  wash.addColorStop(0, `rgb(${tone + 22} ${tone + 21} ${tone + 12})`)
  wash.addColorStop(0.28, `rgb(${tone + 9} ${tone + 10} ${tone + 4})`)
  wash.addColorStop(1, `rgb(${tone - 7} ${tone - 4} ${tone - 6})`)
  c.fillStyle = wash
  c.fillRect(x, y, w, h)
  paintStoneMaterial(c, x, y, w, h, Math.floor(random() * 16))
  if (tone < 70) {
    c.fillStyle = `rgb(7 16 26 / ${(75 - tone) / 90})`
    c.fillRect(x, y, w, h)
  } else if (cap) {
    c.fillStyle = '#e5d4a015'
    c.fillRect(x, y, w, h)
  }
  c.strokeStyle = cap ? '#e0d3b685' : '#d5cab14a'
  c.lineWidth = 0.8
  c.beginPath()
  c.moveTo(x + 1, y + h - 1)
  c.lineTo(x + 1, y + 1)
  c.lineTo(x + w - 1, y + 1)
  c.stroke()
  c.strokeStyle = '#080d13a8'
  c.beginPath()
  c.moveTo(x + w - 0.5, y + 1)
  c.lineTo(x + w - 0.5, y + h - 0.5)
  c.lineTo(x + 1, y + h - 0.5)
  c.stroke()
  for (let i = 0; i < w * h * 0.065; i++) {
    c.fillStyle = random() > 0.5 ? '#d6cbbd18' : '#060f1621'
    c.fillRect(x + random() * w, y + random() * h, 0.8, 0.7)
  }
  c.strokeStyle = '#d0cab411'
  c.lineWidth = 0.6
  c.beginPath()
  c.moveTo(x, y + h * 0.7)
  c.bezierCurveTo(x + w * 0.3, y + h * 0.4, x + w * 0.5, y + h * 0.9, x + w, y + h * 0.5)
  c.stroke()
  c.restore()
}
function floor(c: CanvasRenderingContext2D, kind: string, variant: number) {
  if (dimensionalArt() && kind !== 'threshold') {
    const pattern = paintedFloorPattern(kind)
    c.drawImage(pattern, (variant % 4) * 64, Math.floor(variant / 4) * 64, 64, 64, 0, 0, 64, 64)
    return
  }
  const random = randomFor(visualHash(variant, 27, 84191))
  c.fillStyle = '#171d21'
  c.fillRect(0, 0, 64, 64)
  const corridor = kind === 'corridor' || kind === 'repair'
  const tone = corridor ? 61 : kind === 'ornament' ? 80 : 77
  const rows =
    kind === 'corridor'
      ? [13, 12, 15, 11, 13]
      : kind === 'slab' || kind === 'repair'
        ? [28, 36]
        : [22, 18, 24]
  let y = 0
  for (const height of rows) {
    const count =
      kind === 'corridor'
        ? 4
        : kind === 'slab' || kind === 'repair'
          ? 2
          : 2 + Math.floor(random() * 2)
    let x = 0
    for (let col = 0; col < count; col++) {
      const width =
        col === count - 1 ? 64 - x : Math.round((64 - x) / (count - col) + (random() - 0.5) * 8)
      block(c, x + 0.5, y + 0.5, width - 1, height - 1, tone + random() * 13, random)
      x += width
    }
    y += height
  }
  if (kind === 'ornament') {
    c.strokeStyle = '#b4a07158'
    c.lineWidth = 1
    c.strokeRect(5.5, 5.5, 53, 53)
    c.strokeRect(8.5, 8.5, 47, 47)
    c.strokeStyle = '#52696d66'
    c.beginPath()
    c.moveTo(32, 16)
    c.lineTo(48, 32)
    c.lineTo(32, 48)
    c.lineTo(16, 32)
    c.closePath()
    c.stroke()
    c.fillStyle = '#b6a17244'
    c.fillRect(30, 30, 4, 4)
  }
  if (kind === 'threshold') {
    c.fillStyle = '#222a2b'
    c.fillRect(0, 0, 64, 64)
    for (let row = 0; row < 4; row++)
      for (let col = 0; col < 2; col++)
        block(c, col * 32 + 0.5, row * 16 + 0.5, 31, 15, 85 + random() * 9, random)
  }
}
function wall(c: CanvasRenderingContext2D, mask: number, corner: number, variant: number) {
  const random = randomFor(visualHash(mask, variant, 4729))
  const rectangles = wallCapRects(mask, corner, 32),
    cap = new Path2D()
  for (const rect of rectangles) cap.rect(rect.x, rect.y, rect.width, rect.height)
  // A fixed northwest lift gives every block the same narrow east face.
  for (const { x, y, height } of wallEastSegments(mask, corner, 32)) {
    c.save()
    c.beginPath()
    c.moveTo(x, y)
    c.lineTo(x, y + height)
    c.lineTo(x + SIDE, y + height + RISE)
    c.lineTo(x + SIDE, y + RISE)
    c.closePath()
    c.clip()
    paintStoneMaterial(c, x, y, SIDE, height + RISE, variant + 4)
    c.fillStyle = '#07111c8c'
    c.fillRect(x, y, SIDE, height + RISE)
    c.strokeStyle = '#b4b09a40'
    c.lineWidth = 0.6
    c.beginPath()
    c.moveTo(x + 0.3, y)
    c.lineTo(x + 0.3, y + height)
    c.stroke()
    c.restore()
  }
  for (const segment of wallFrontSegments(mask, corner, 32)) {
    const { x, width } = segment,
      edge = segment.y
    c.save()
    c.beginPath()
    c.moveTo(x, edge)
    c.lineTo(x + width, edge)
    c.lineTo(x + width + SIDE, edge + RISE)
    c.lineTo(x + SIDE, edge + RISE)
    c.closePath()
    c.clip()
    c.transform(1, 0, SIDE / RISE, 1, (-edge * SIDE) / RISE, 0)
    c.fillStyle = '#111a20'
    c.fillRect(x, edge, width, 24)
    for (let course = 0; course < 2; course++)
      for (let col = -1; col < 3; col++)
        block(
          c,
          x + col * 16 + (course % 2 ? 8 : 0) + 0.3,
          edge + course * 12 + 0.3,
          15.4,
          11.4,
          43 + random() * 14,
          random,
        )
    const shadow = c.createLinearGradient(0, edge, 0, edge + 24)
    shadow.addColorStop(0, '#02070b00')
    shadow.addColorStop(1, '#02070bb5')
    c.fillStyle = shadow
    c.fillRect(x, edge, width, 24)
    c.restore()
  }
  c.save()
  c.clip(cap)
  // Caps share the projection anchor; face extrusion returns to the floor baseline.
  c.fillStyle = '#202729'
  c.fillRect(0, 0, 32, 32)
  for (let row = 0; row < 2; row++) {
    const split = 12 + Math.floor(random() * 9)
    block(c, 0.4, row * 16 + 0.4, split - 0.8, 15.2, 91 + random() * 13, random, true)
    block(c, split + 0.4, row * 16 + 0.4, 31.6 - split, 15.2, 91 + random() * 13, random, true)
  }
  // Bevel only exposed edges: connected caps meet at exactly the same plane.
  c.strokeStyle = '#d6c9a885'
  c.lineWidth = 1.2
  c.beginPath()
  if (!(mask & WALL.north)) {
    c.moveTo(0.5, 0.6)
    c.lineTo(31.5, 0.6)
  }
  if (!(mask & WALL.west)) {
    c.moveTo(0.6, 0.5)
    c.lineTo(0.6, 31.5)
  }
  c.stroke()
  c.strokeStyle = '#0b1419bf'
  c.beginPath()
  if (!(mask & WALL.east)) {
    c.moveTo(31.5, 0.5)
    c.lineTo(31.5, 31.5)
  }
  if (!(mask & WALL.south)) {
    c.moveTo(0.5, 31.5)
    c.lineTo(31.5, 31.5)
  }
  c.stroke()
  c.restore()
}
function portal(c: CanvasRenderingContext2D, facing: string, state: string, plane = false) {
  facing = facing === 'north-south' ? 'north' : facing === 'east-west' ? 'west' : facing
  const random = randomFor(91424)
  const front = plane || facing === 'north' || facing === 'south'
  // Separate plan/front drawings: side-facing doors never rotate a frontal sprite.
  if (front) {
    const art = dimensionalArt()
    if (art) {
      c.imageSmoothingEnabled = true
      c.imageSmoothingQuality = 'high'
      c.drawImage(art.portal, 0, 6, 40, 44)
      c.save()
      c.globalCompositeOperation = 'source-atop'
      c.fillStyle = '#17202a33'
      c.fillRect(0, 6, 40, 44)
      c.restore()
    } else {
      block(c, 0, 6, 40, 10, 92, random, true)
      for (const x of [0, 32]) block(c, x, 16, 8, 34, 76, random)
      c.fillStyle = '#754a2a'
      c.fillRect(8, 16, 24, 34)
    }
    if (state !== 'closed') {
      c.save()
      c.beginPath()
      c.arc(20, 28, 11.5, Math.PI, 0)
      c.lineTo(31.5, 50)
      c.lineTo(8.5, 50)
      c.closePath()
      c.clip()
      c.fillStyle = '#060d13'
      c.fillRect(8, 16, 24, 34)
      if (state === 'secret')
        for (let row = 0; row < 4; row++)
          for (let col = -1; col < 2; col++)
            block(
              c,
              8.5 + col * 12 + (row % 2 ? 6 : 0),
              16 + row * 9,
              11.5,
              8.5,
              58 + random() * 8,
              random,
            )
      c.restore()
      if (state === 'open') {
        const hinge = facing === 'south' || facing === 'west' ? 27 : 9
        c.save()
        c.beginPath()
        c.moveTo(hinge, 24)
        c.lineTo(hinge + 4, 20)
        c.lineTo(hinge + 4, 46)
        c.lineTo(hinge, 50)
        c.closePath()
        c.clip()
        c.fillStyle = '#7f542e'
        c.fillRect(hinge, 20, 4, 30)
        if (art) c.drawImage(art.door, hinge, 20, 4, 30)
        c.restore()
      }
    }
  } else {
    // Two narrow jambs continue the vertical wall footprint. The leaf is a real
    // vertical plane spanning the passage, with the SAME lift as the masonry.
    const jamb = (y: number) => {
      c.save()
      c.beginPath()
      c.moveTo(6, y + 6)
      c.lineTo(26, y + 6)
      c.lineTo(26 + SIDE, y + 30)
      c.lineTo(6 + SIDE, y + 30)
      c.closePath()
      c.clip()
      c.transform(1, 0, SIDE / RISE, 1, (-(y + 6) * SIDE) / RISE, 0)
      c.fillStyle = '#111a20'
      c.fillRect(6, y + 6, 20, 24)
      for (let row = 0; row < 2; row++)
        for (let col = -1; col < 2; col++)
          block(
            c,
            6.3 + col * 16 + (row % 2 ? 8 : 0),
            y + 6.3 + row * 12,
            15.4,
            11.4,
            46 + random() * 9,
            random,
          )
      c.restore()
      c.save()
      c.beginPath()
      c.moveTo(26, y)
      c.lineTo(26, y + 6)
      c.lineTo(26 + SIDE, y + 30)
      c.lineTo(26 + SIDE, y + 24)
      c.closePath()
      c.fillStyle = '#293136'
      c.fill()
      c.restore()
      block(c, 6.2, y + 0.2, 19.6, 5.6, 94, random, true)
    }
    jamb(0)
    jamb(26)
    // Map an upright architectural plane into the y/z plane. This is not a
    // quarter-turn: gravity and illumination keep their world-space directions.
    c.save()
    c.transform(0, 32 / 40, SIDE / 44, RISE / 44, 16, 0)
    c.translate(0, -6)
    portal(c, facing, state, true)
    c.restore()
  }
  if (state === 'secret') {
    c.save()
    if (front) c.translate(4, 1)
    c.fillStyle = '#132e32e8'
    c.fillRect(11, 25, 10, 14)
    c.strokeStyle = '#79dedb'
    c.setLineDash([2, 2])
    c.strokeRect(10, 24, 12, 16)
    c.setLineDash([])
    c.fillStyle = '#b2f4ed'
    c.font = 'bold 11px monospace'
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    c.fillText('S', 16, 32)
    c.restore()
  }
}
function stairs(c: CanvasRenderingContext2D, up: boolean) {
  c.fillStyle = '#0b1218'
  c.fillRect(2, 2, 28, 28)
  for (let i = 0; i < 7; i++) {
    const inset = up ? 7 - i * 0.6 : 3 + i * 0.6,
      tone = up ? 43 + i * 8 : 91 - i * 9
    c.fillStyle = `rgb(${tone + 8} ${tone + 9} ${tone + 4})`
    c.fillRect(inset, 3 + i * 3.8, 32 - inset * 2, 3.8)
    paintStoneMaterial(c, inset, 3 + i * 3.8, 32 - inset * 2, 3.8, i)
    c.fillStyle = `rgb(2 9 17 / ${up ? 0.4 - i * 0.03 : 0.1 + i * 0.08})`
    c.fillRect(inset, 3 + i * 3.8, 32 - inset * 2, 3.8)
    c.fillStyle = '#d2c9af66'
    c.fillRect(inset, 3 + i * 3.8, 32 - inset * 2, 0.8)
    c.fillStyle = '#000710ab'
    c.fillRect(inset, 5.8 + i * 3.8, 32 - inset * 2, 1)
  }
  c.strokeStyle = '#a49e8b'
  c.lineWidth = 1.3
  c.strokeRect(2, 2, 28, 28)
  c.fillStyle = up ? '#a2d4bd' : '#e0ad6d'
  c.beginPath()
  c.moveTo(26, up ? 4 : 10)
  c.lineTo(23, up ? 10 : 4)
  c.lineTo(29, up ? 10 : 4)
  c.fill()
}
function detail(c: CanvasRenderingContext2D, condition: string, variant: number) {
  const random = randomFor(visualHash(variant, 19, 8173))
  if (condition === 'cracked') {
    const x = 8 + random() * 14
    c.strokeStyle = '#0b131bbf'
    c.lineWidth = 0.8
    c.beginPath()
    c.moveTo(x, 0)
    c.lineTo(x - 3, 8)
    c.lineTo(x + 2, 16)
    c.lineTo(x - 1, 25)
    c.lineTo(x + 3, 32)
    c.moveTo(x + 2, 16)
    c.lineTo(x + 10, 20)
    c.stroke()
  } else if (condition === 'mossy') {
    const stain = c.createRadialGradient(8, 25, 0, 12, 25, 25)
    stain.addColorStop(0, '#37534940')
    stain.addColorStop(1, '#37534900')
    c.fillStyle = stain
    c.fillRect(0, 0, 32, 32)
    for (let i = 0; i < 30; i++) {
      c.fillStyle = i % 2 ? '#87915c55' : '#3b604b66'
      c.fillRect(random() * 32, 20 + random() * 12, 1 + random() * 2, 1)
    }
  } else {
    const wash = c.createRadialGradient(16, 17, 1, 16, 17, 22)
    wash.addColorStop(0, condition === 'worn' ? '#c1b39424' : '#211d1959')
    wash.addColorStop(1, '#211d1900')
    c.fillStyle = wash
    c.fillRect(0, 0, 32, 32)
  }
}

/** Generated stone/oak artwork fitted to connected, geometry-owned architectural sprites. */
export function getDimensionalAtlas(tileSize: number): DimensionalAtlas {
  const cached = atlases.get(tileSize)
  if (cached) return cached
  const definitions = dimensionalSpriteDefinitions(tileSize),
    canvas = document.createElement('canvas')
  canvas.width = tileSize * 32
  canvas.height = Math.max(...definitions.map((s) => s.source.y + s.height))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas 2D is unavailable.')
  context.imageSmoothingQuality = 'high'
  for (const sprite of definitions) {
    context.save()
    context.beginPath()
    context.rect(sprite.source.x, sprite.source.y, sprite.width, sprite.height)
    context.clip()
    context.translate(sprite.source.x, sprite.source.y)
    context.scale(tileSize / 32, tileSize / 32)
    const parts = sprite.id.split('.')
    const [category, kind, variant] = parts
    if (category === 'floor') floor(context, kind!, Number(variant))
    else if (category === 'wall') wall(context, Number(kind), Number(variant), Number(parts[3]))
    else if (category === 'door') {
      context.save()
      if (kind === 'north-south') {
        context.transform(1, 0, SIDE / 56, 1, 0, 0)
      }
      portal(context, kind!, variant!)
      context.restore()
    } else if (category === 'stairs') stairs(context, kind === 'up')
    else if (category === 'inlay') {
      const art = dimensionalArt()
      if (art) context.drawImage(art.inlay, 0, 0, 80, 80)
    } else if (category === 'torch') {
      const art = dimensionalArt()
      if (art) context.drawImage(art.torch, 0, 0, 12, 35)
    } else detail(context, kind!, Number(variant))
    context.restore()
  }
  const atlas: DimensionalAtlas = {
    image: canvas,
    sprites: new Map(definitions.map((s) => [s.id, s])),
    provenance: dimensionalArt() ? 'generated-raster' : 'procedural-placeholder',
  }
  atlases.set(tileSize, atlas)
  return atlas
}
export function drawDimensionalSprite(
  context: CanvasRenderingContext2D,
  atlas: DimensionalAtlas,
  id: string,
  x: number,
  y: number,
) {
  const sprite = atlas.sprites.get(id)
  if (!sprite) throw new Error(`Missing dimensional sprite: ${id}`)
  const destination = spriteDestination(sprite, x, y),
    source = sprite.source
  context.drawImage(
    atlas.image,
    source.x,
    source.y,
    source.width,
    source.height,
    destination.x,
    destination.y,
    destination.width,
    destination.height,
  )
}
