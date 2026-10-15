import { TILE_SIZE } from './tile-size'

const cache = new Map<string, HTMLCanvasElement>()
type TileKind = 'room' | 'corridor' | 'wall' | 'rock'

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
) {
  const tone = (wall ? 70 : 60) + Math.floor(random() * 24)
  context.fillStyle = `rgb(${tone + 7} ${tone + 5} ${tone - 3})`
  context.fillRect(x, y, width, height)
  for (let i = 0; i < width * height * 0.7; i++) {
    context.fillStyle =
      random() > 0.46 ? `rgb(193 181 145 / ${random() * 0.18})` : `rgb(8 12 9 / ${random() * 0.35})`
    context.fillRect(x + Math.floor(random() * width), y + Math.floor(random() * height), 1, 1)
  }
  context.fillStyle = '#c4bda436'
  context.fillRect(x + 1, y, width - 2, 1)
  context.fillRect(x, y + 1, 1, height - 2)
  context.fillStyle = '#080c0ce0'
  context.fillRect(x, y + height - 1, width, 1)
  context.fillRect(x + width - 1, y, 1, height)
  context.fillStyle = '#080c0c50'
  context.fillRect(x + 1, y + height - 2, width - 2, 1)
  if (random() > 0.45) {
    context.strokeStyle = '#161c17a0'
    context.lineWidth = 0.7
    const start = x + 2 + random() * (width - 4)
    context.beginPath()
    context.moveTo(start, y)
    context.lineTo(start - 2, y + height * 0.35)
    context.lineTo(start + 1, y + height * 0.55)
    context.lineTo(start - 1, y + height * 0.8)
    context.stroke()
  }
}

/** Cached, original stone sprites. Texture randomness is separate from generation. */
export function stoneTile(kind: TileKind, variant: number) {
  const key = `${kind}-${variant % 16}`
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
  } else if (kind === 'wall') {
    for (let row = 0; row < 4; row++) {
      const offset = row % 2 ? -8 : 0
      for (let col = 0; col < 3; col++) {
        stone(context, random, offset + col * 16 + 1, row * 8 + 1, 15, 7, true)
      }
    }
  } else {
    for (let row = 0; row < 2; row++) {
      const left = 11 + Math.floor(random() * 11)
      stone(context, random, 1, row * 16 + 1, left - 1, 15, false)
      stone(context, random, left + 1, row * 16 + 1, 30 - left, 15, false)
    }
    if (kind === 'corridor') {
      context.fillStyle = '#09151228'
      context.fillRect(0, 0, TILE_SIZE, TILE_SIZE)
    }
    if (variant % 5 === 0) {
      for (let i = 0; i < 36; i++) {
        context.fillStyle = `rgb(78 91 37 / ${random() * 0.42})`
        context.fillRect(Math.floor(random() * 12), Math.floor(random() * 32), 2, 1)
      }
    }
  }
  cache.set(key, canvas)
  return canvas
}
