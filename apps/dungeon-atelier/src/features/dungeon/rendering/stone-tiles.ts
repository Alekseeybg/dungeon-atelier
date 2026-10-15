import { TILE_SIZE } from './tile-size'

const cache = new Map<string, HTMLCanvasElement>()
export type TileKind =
  'room' | 'corridor' | 'slab' | 'mosaic' | 'threshold' | 'wall' | 'wall-dressed' | 'rock'
export type StoneCondition = 'clean' | 'worn' | 'cracked' | 'mossy'

export function tileHash(x: number, y: number, seed: number) {
  let value = Math.imul(x + 1, 374761393) ^ Math.imul(y + 1, 668265263) ^ seed
  value = Math.imul(value ^ (value >>> 13), 1274126177)
  return (value ^ (value >>> 16)) >>> 0
}
function textureRandom(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 4294967296
  }
}
function stone(
  context: CanvasRenderingContext2D,
  random: () => number,
  x: number,
  y: number,
  width: number,
  height: number,
  wall: boolean,
  dressed = false,
) {
  const tone = (wall ? 76 : 67) + Math.floor(random() * 19)
  const warm = wall ? 0 : 5
  const chip = dressed ? 0.6 : 1 + random()
  const shape = new Path2D()
  shape.moveTo(x + chip, y)
  shape.lineTo(x + width - chip, y)
  shape.lineTo(x + width, y + chip)
  shape.lineTo(x + width, y + height - chip)
  shape.lineTo(x + width - chip, y + height)
  shape.lineTo(x + chip, y + height)
  shape.lineTo(x, y + height - chip)
  shape.lineTo(x, y + chip)
  shape.closePath()
  context.save()
  context.clip(shape)
  const face = context.createLinearGradient(x, y, x + width, y + height)
  face.addColorStop(0, `rgb(${tone + warm + 16} ${tone + 15} ${tone + 3})`)
  face.addColorStop(0.45, `rgb(${tone + warm} ${tone + 2} ${tone - 7})`)
  face.addColorStop(1, `rgb(${tone + warm - 10} ${tone - 9} ${tone - 15})`)
  context.fillStyle = face
  context.fillRect(x, y, width, height)
  for (let i = 0; i < width * height * 0.65; i++) {
    context.fillStyle =
      random() > 0.5 ? `rgb(205 196 164 / ${random() * 0.19})` : `rgb(14 24 17 / ${random() * 0.3})`
    context.fillRect(x + random() * width, y + random() * height, random() > 0.85 ? 2 : 0.8, 0.8)
  }
  context.strokeStyle = '#d2c8a96b'
  context.lineWidth = 0.8
  context.beginPath()
  context.moveTo(x + chip, y + 0.5)
  context.lineTo(x + width - chip, y + 0.5)
  context.moveTo(x + 0.5, y + chip)
  context.lineTo(x + 0.5, y + height - chip)
  context.stroke()
  context.fillStyle = '#101b13a0'
  context.fillRect(x, y + height - 1.2, width, 1.2)
  context.fillRect(x + width - 1, y, 1, height)
  context.restore()
}

/** Original cached stone sprites. The Classic rock texture retains its original recipe. */
export function stoneTile(kind: TileKind, variant: number, condition: StoneCondition = 'clean') {
  const key = `${kind}-${variant % 16}-${condition}`
  const existing = cache.get(key)
  if (existing) return existing
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = TILE_SIZE
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Your browser could not create stone textures.')
  const random = textureRandom(
    (variant % 16) + (kind === 'wall' ? 170 : kind === 'room' ? 410 : 910),
  )
  context.fillStyle = '#151915'
  context.fillRect(0, 0, TILE_SIZE, TILE_SIZE)
  if (kind === 'rock') {
    context.fillStyle = '#3c4030'
    context.fillRect(0, 0, TILE_SIZE, TILE_SIZE)
    for (let i = 0; i < 500; i++) {
      const tone = 35 + Math.floor(random() * 48)
      context.fillStyle = 'rgb(' + (tone + 4) + ' ' + (tone + 7) + ' ' + (tone - 7) + ' / 0.6)'
      context.fillRect(
        Math.floor(random() * 32),
        Math.floor(random() * 32),
        1 + Math.floor(random() * 3),
        1 + Math.floor(random() * 2),
      )
    }
    cache.set(key, canvas)
    return canvas
  }
  if (kind === 'wall' || kind === 'wall-dressed') {
    context.fillStyle = '#151f18'
    context.fillRect(0, 0, 32, 32)
    for (let row = 0; row < 2; row++) {
      const offset = row % 2 ? -8 : 0
      for (let col = 0; col < 3; col++)
        stone(
          context,
          random,
          offset + col * 16 + 0.5,
          row * 16 + 0.5,
          15,
          15,
          true,
          kind === 'wall-dressed',
        )
    }
    if (kind === 'wall-dressed') {
      context.fillStyle = '#b5b49a5c'
      context.fillRect(1, 1, 30, 1)
      context.fillRect(1, 1, 1, 30)
    }
  } else if (kind === 'corridor') {
    for (let row = 0; row < 4; row++)
      for (let col = -1; col < 4; col++) {
        stone(context, random, col * 9 + (row % 2 ? 4 : 0) + 0.5, row * 8 + 0.5, 8, 7, false)
      }
  } else if (kind === 'mosaic') {
    stone(context, random, 0.5, 0.5, 31, 31, false, true)
    context.strokeStyle = '#b0a17c7a'
    context.lineWidth = 1
    context.strokeRect(3.5, 3.5, 25, 25)
    context.strokeStyle = '#202d23c0'
    context.beginPath()
    context.moveTo(16, 7)
    context.lineTo(25, 16)
    context.lineTo(16, 25)
    context.lineTo(7, 16)
    context.closePath()
    context.stroke()
    context.fillStyle = '#beb08d60'
    context.fillRect(14, 14, 4, 4)
  } else {
    for (let row = 0; row < 2; row++) {
      const split = kind === 'slab' ? 32 : kind === 'threshold' ? 16 : 12 + Math.floor(random() * 9)
      stone(context, random, 0.5, row * 16 + 0.5, split - 1, 15, false, kind === 'threshold')
      if (split < 32)
        stone(
          context,
          random,
          split + 0.5,
          row * 16 + 0.5,
          31 - split,
          15,
          false,
          kind === 'threshold',
        )
    }
    if (kind === 'threshold') {
      context.strokeStyle = '#c0b18b55'
      context.lineWidth = 0.6
      context.strokeRect(2, 2, 28, 28)
    }
  }
  if (condition === 'worn') {
    const wear = context.createRadialGradient(16, 16, 1, 16, 16, 19)
    wear.addColorStop(0, '#b3ab8538')
    wear.addColorStop(1, '#a79f7e00')
    context.fillStyle = wear
    context.fillRect(0, 0, 32, 32)
  }
  if (condition === 'cracked') {
    context.strokeStyle = '#101c15d9'
    context.lineWidth = 0.9
    const x = 8 + random() * 16
    context.beginPath()
    context.moveTo(x, 0)
    context.lineTo(x - 3, 8)
    context.lineTo(x + 1, 13)
    context.lineTo(x - 2, 21)
    context.lineTo(x + 3, 28)
    context.moveTo(x + 1, 13)
    context.lineTo(x + 9, 17)
    context.lineTo(x + 11, 24)
    context.stroke()
    context.strokeStyle = '#d5cda833'
    context.lineWidth = 0.5
    context.beginPath()
    context.moveTo(x + 0.8, 0)
    context.lineTo(x - 2.2, 8)
    context.lineTo(x + 1.8, 13)
    context.stroke()
  }
  if (condition === 'mossy') {
    context.fillStyle = '#30492b30'
    context.fillRect(0, 0, 32, 32)
    for (let i = 0; i < 105; i++) {
      const x = random() * 32,
        y = random() * 32
      const inJoint = x % 16 < 5 || y % 16 < 4
      if (!inJoint && random() > 0.15) continue
      context.fillStyle = random() > 0.5 ? '#71804b78' : '#354b2c99'
      context.fillRect(x, y, 1 + random() * 2, 0.7 + random())
    }
  }
  cache.set(key, canvas)
  return canvas
}
