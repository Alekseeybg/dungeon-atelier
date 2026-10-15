import { TILE_SIZE } from './tile-size'

const cache = new Map<string, HTMLCanvasElement>()
export type TileKind =
  | 'room'
  | 'corridor'
  | 'corridor-slab'
  | 'slab'
  | 'mosaic'
  | 'threshold'
  | 'wall'
  | 'wall-dressed'
  | 'rock'
export type StoneCondition = 'clean' | 'worn' | 'cracked' | 'mossy' | 'grimy'

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
  toneOffset = 0,
) {
  const tone = (wall ? 67 : 78) + Math.floor(random() * 18) + toneOffset
  const warm = wall ? 1 : 6
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
  face.addColorStop(0, `rgb(${tone + warm + 17} ${tone + 18} ${tone + 13})`)
  face.addColorStop(0.48, `rgb(${tone + warm} ${tone + 4} ${tone + 1})`)
  face.addColorStop(1, `rgb(${tone + warm - 12} ${tone - 10} ${tone - 12})`)
  context.fillStyle = face
  context.fillRect(x, y, width, height)
  for (let i = 0; i < width * height * 0.18; i++) {
    context.fillStyle =
      random() > 0.5
        ? `rgb(212 208 189 / ${random() * 0.16})`
        : `rgb(14 21 24 / ${random() * 0.24})`
    context.fillRect(x + random() * width, y + random() * height, random() > 0.85 ? 2 : 0.8, 0.8)
  }
  // Broad mineral veins sit below the bevels; sparse grains keep the material quiet at map scale.
  context.strokeStyle = '#d3d0ba12'
  context.lineWidth = 0.7
  context.beginPath()
  context.moveTo(x, y + height * 0.3)
  context.bezierCurveTo(
    x + width * 0.3,
    y + height * 0.1,
    x + width * 0.5,
    y + height * 0.8,
    x + width,
    y + height * 0.6,
  )
  context.stroke()
  context.strokeStyle = wall ? '#d0cbbb7b' : '#d2c8b364'
  context.lineWidth = 0.8
  context.beginPath()
  context.moveTo(x + chip, y + 0.5)
  context.lineTo(x + width - chip, y + 0.5)
  context.moveTo(x + 0.5, y + chip)
  context.lineTo(x + 0.5, y + height - chip)
  context.stroke()
  context.fillStyle = '#0b1216b8'
  context.fillRect(x, y + height - 1.2, width, 1.2)
  context.fillRect(x + width - 1, y, 1, height)
  if (!dressed && random() > 0.45) {
    const nick = x + 2 + random() * Math.max(1, width - 5)
    context.fillStyle = '#152022b0'
    context.fillRect(nick, y, 2.5, 1.4)
    context.fillStyle = '#c1b9a24d'
    context.fillRect(nick, y + 1.5, 2, 0.7)
  }
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
    context.fillStyle = '#10191d'
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
        stone(
          context,
          random,
          col * 9 + (row % 2 ? 4 : 0) + 0.5,
          row * 8 + 0.5,
          8,
          7,
          false,
          false,
          -10,
        )
      }
  } else if (kind === 'corridor-slab') {
    stone(context, random, 0.5, 0.5, 15, 31, false, false, -9)
    stone(context, random, 16.5, 0.5, 15, 15, false, false, -9)
    stone(context, random, 16.5, 16.5, 15, 15, false, false, -9)
  } else if (kind === 'mosaic') {
    stone(context, random, 0.5, 0.5, 31, 31, false, true)
    context.strokeStyle = '#aa9b7770'
    context.lineWidth = 1
    context.strokeRect(3.5, 3.5, 25, 25)
    context.strokeStyle = '#203037b0'
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
    context.fillStyle = '#27444124'
    context.fillRect(0, 0, 32, 32)
    for (let i = 0; i < 105; i++) {
      const x = random() * 32,
        y = random() * 32
      const inJoint = x % 16 < 5 || y % 16 < 4
      if (!inJoint && random() > 0.15) continue
      context.fillStyle = random() > 0.5 ? '#75815b65' : '#354c3899'
      context.fillRect(x, y, 1 + random() * 2, 0.7 + random())
    }
  }
  if (condition === 'grimy') {
    const stain = context.createRadialGradient(8 + random() * 16, 20, 1, 16, 20, 23)
    stain.addColorStop(0, '#25221cb0')
    stain.addColorStop(0.6, '#302e2438')
    stain.addColorStop(1, '#302e2400')
    context.fillStyle = stain
    context.fillRect(0, 0, 32, 32)
    for (let i = 0; i < 6; i++) {
      const x = random() * 30,
        y = 24 + random() * 7
      context.fillStyle = '#0b121873'
      context.fillRect(x, y + 0.6, 1.6, 1)
      context.fillStyle = '#b8ac8c66'
      context.fillRect(x, y, 1.3, 0.7)
    }
  }
  cache.set(key, canvas)
  return canvas
}
