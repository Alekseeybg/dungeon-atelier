import { floorStudy } from '../../features/dungeon/rendering/visual-foundation/art'
import type { FoundationFloor } from '../../features/dungeon/rendering/visual-foundation/art'

/** Body-only grading. Approved cap generation, maps and material parameters are not used here. */
export function refineWallStone(image: HTMLCanvasElement) {
  const c = image.getContext('2d')!,
    pixels = c.getImageData(0, 0, image.width, image.height)
  for (let i = 0; i < pixels.data.length; i += 4) {
    const value =
        pixels.data[i]! * 0.2126 + pixels.data[i + 1]! * 0.7152 + pixels.data[i + 2]! * 0.0722,
      target = 112 + (value - 116) * 0.56
    for (let channel = 0; channel < 3; channel++)
      pixels.data[i + channel] =
        target + (pixels.data[i + channel]! - value) * 0.56 + [2, 1, -2][channel]!
  }
  c.putImageData(pixels, 0, 0)
  return image
}

export function refineOak(image: HTMLCanvasElement) {
  const c = image.getContext('2d')!,
    pixels = c.getImageData(0, 0, image.width, image.height)
  for (let i = 0; i < pixels.data.length; i += 4) {
    const value =
      pixels.data[i]! * 0.2126 + pixels.data[i + 1]! * 0.7152 + pixels.data[i + 2]! * 0.0722
    for (let channel = 0; channel < 3; channel++)
      pixels.data[i + channel] = value + (pixels.data[i + channel]! - value) * 0.56
  }
  c.putImageData(pixels, 0, 0)
  return image
}

/** Reuse Ancient stone interiors; geometry, rather than painted lines, defines the slab joints. */
export async function floorStoneAtlas(floor: FoundationFloor) {
  const source = new Image()
  source.src = floorStudy(floor).url
  await source.decode()
  const raw = document.createElement('canvas')
  raw.width = source.width
  raw.height = source.height
  raw.getContext('2d')!.drawImage(source, 0, 0)
  const data = raw.getContext('2d')!.getImageData(0, 0, raw.width, raw.height).data,
    size = floor === 'study-broad' ? 0.1 : 0.06,
    candidates: { x: number; y: number; mean: number; score: number }[] = []
  for (let row = 0; row < 16; row++)
    for (let col = 0; col < 16; col++) {
      const x = (col / 15) * (1 - size),
        y = (row / 15) * (1 - size)
      let sum = 0,
        squares = 0,
        dark = 0
      for (let j = 0; j < 5; j++)
        for (let i = 0; i < 5; i++) {
          const px = Math.floor((x + (size * (i + 0.5)) / 5) * raw.width),
            py = Math.floor((y + (size * (j + 0.5)) / 5) * raw.height),
            k = (py * raw.width + px) * 4,
            value = data[k]! * 0.2126 + data[k + 1]! * 0.7152 + data[k + 2]! * 0.0722
          sum += value
          squares += value * value
          if (value < 45) dark++
        }
      const mean = sum / 25
      if (mean > 70)
        candidates.push({ x, y, mean, score: dark * 60 + (squares / 25 - mean * mean) * 0.012 })
    }
  candidates.sort((a, b) => a.score - b.score)
  const chosen: typeof candidates = []
  for (const p of candidates)
    if (chosen.every((q) => Math.hypot(p.x - q.x, p.y - q.y) > size * 1.4)) {
      chosen.push(p)
      if (chosen.length === 16) break
    }
  if (!chosen.length) throw new Error(`No usable stone interiors in ${floor}`)
  const image = document.createElement('canvas')
  image.width = image.height = 1024
  const c = image.getContext('2d')!,
    mid = floor === 'study-broad' ? 111 : floor === 'study-weathered' ? 104 : 108
  for (let index = 0; index < 16; index++) {
    const p = chosen[index % chosen.length]!
    c.drawImage(
      source,
      p.x * source.width,
      p.y * source.height,
      size * source.width,
      size * source.height,
      (index % 4) * 256,
      Math.floor(index / 4) * 256,
      256,
      256,
    )
  }
  const pixels = c.getImageData(0, 0, 1024, 1024)
  for (let y = 0; y < 1024; y++)
    for (let x = 0; x < 1024; x++) {
      const i = (y * 1024 + x) * 4,
        index = Math.floor(y / 256) * 4 + Math.floor(x / 256),
        p = chosen[index % chosen.length]!,
        value =
          pixels.data[i]! * 0.2126 + pixels.data[i + 1]! * 0.7152 + pixels.data[i + 2]! * 0.0722,
        target = mid + (value - p.mean) * 0.55
      for (let ch = 0; ch < 3; ch++)
        pixels.data[i + ch] = target + (pixels.data[i + ch]! - value) * 0.35
    }
  c.putImageData(pixels, 0, 0)
  return image
}
