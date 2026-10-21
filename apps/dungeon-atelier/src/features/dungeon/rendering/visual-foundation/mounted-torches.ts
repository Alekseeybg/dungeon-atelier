import url from '../../../../assets/visual-foundation/wall-sconces-final-v2.png'
import componentsUrl from '../../../../assets/visual-foundation/north-sconce-components-v1.png'
import type { Position } from '@dungeon-atelier/core'
import { project, FOUNDATION } from './model'
import type { WallProjection } from './model'

export interface MountedTorchArt {
  front: HTMLCanvasElement
  side: HTMLCanvasElement
  basket: HTMLCanvasElement
  flame: HTMLCanvasElement
}
let loading: Promise<MountedTorchArt> | undefined
export function loadMountedTorchArt() {
  return (loading ??= (async () => {
    const sprites = await loadPair(url),
      components = await loadPair(componentsUrl)
    return { front: sprites[0]!, side: sprites[1]!, basket: components[0]!, flame: components[1]! }
  })().catch((error: unknown) => {
    loading = undefined
    throw error
  }))
}
async function loadPair(sourceUrl: string) {
  const image = new Image()
  image.src = sourceUrl
  await image.decode()
  const sprites: HTMLCanvasElement[] = []
  for (let col = 0; col < 2; col++) {
    const source = document.createElement('canvas')
    source.width = image.width / 2
    source.height = image.height
    const c = source.getContext('2d')!
    c.drawImage(image, -col * source.width, 0)
    const pixels = c.getImageData(0, 0, source.width, source.height).data
    let l = source.width,
      r = 0,
      t = source.height,
      b = 0
    for (let y = 0; y < source.height; y++)
      for (let x = 0; x < source.width; x++)
        if (pixels[(y * source.width + x) * 4 + 3]! > 24) {
          l = Math.min(l, x)
          r = Math.max(r, x)
          t = Math.min(t, y)
          b = Math.max(b, y)
        }
    const out = document.createElement('canvas')
    out.width = r - l + 1
    out.height = b - t + 1
    out
      .getContext('2d')!
      .drawImage(source, l, t, out.width, out.height, 0, 0, out.width, out.height)
    sprites.push(out)
  }
  return sprites
}
export function drawMountedTorch(
  c: CanvasRenderingContext2D,
  art: MountedTorchArt,
  position: Position,
  face: 'south' | 'east',
  northMount: 'flat' | 'projecting' = 'flat',
  projection: WallProjection = FOUNDATION,
) {
  if (face === 'south' && northMount === 'projecting') {
    drawNorthMount(c, art, position, true, projection)
    return
  }
  const x = position.x * 32,
    y = position.y * 32,
    side = face === 'east',
    p = project(x + (side ? 26 : 16), y + (side ? 16 : 26), 0.1, projection),
    width = side ? 12 : 11,
    height = 23
  c.save()
  // Contact sits on the actual wall plane, behind the riveted mounting plate.
  const plate = new Path2D(),
    points = side
      ? [
          [x + 26, y + 14, 0.1],
          [x + 26, y + 18, 0.1],
          [x + 26, y + 18, 0.52],
          [x + 26, y + 14, 0.52],
        ]
      : [
          [x + 13, y + 26, 0.1],
          [x + 19, y + 26, 0.1],
          [x + 19, y + 26, 0.52],
          [x + 13, y + 26, 0.52],
        ]
  points.forEach(([a, b, z], i) => {
    const v = project(a!, b!, z, projection)
    if (i) plate.lineTo(v.x, v.y)
    else plate.moveTo(v.x, v.y)
  })
  plate.closePath()
  c.fillStyle = '#0206078c'
  c.fill(plate)
  c.translate(p.x, p.y)
  c.transform(1, 0, projection.side / projection.rise, 1, 0, 0)
  c.drawImage(
    side ? art.side : art.front,
    side ? -width * 0.12 : -width / 2,
    -height,
    width,
    height,
  )
  c.restore()
}

/** Separate stable hardware and flame passes; no animation or lighting change here. */
export function drawNorthMount(
  c: CanvasRenderingContext2D,
  art: MountedTorchArt,
  position: Position,
  fire = true,
  projection: WallProjection = FOUNDATION,
) {
  const x = position.x * 32 + 16,
    wall = position.y * 32 + 26
  const face = (points: [number, number, number][], color: string) => {
    c.beginPath()
    points.forEach(([a, b, z], i) => {
      const p = project(a, b, z, projection)
      if (i) c.lineTo(p.x, p.y)
      else c.moveTo(p.x, p.y)
    })
    c.closePath()
    c.fillStyle = color
    c.fill()
  }
  c.save()
  // Backplate stays at the old masonry anchor. Only the original lower plate is used.
  face(
    [
      [x - 3, wall, 0.1],
      [x + 3, wall, 0.1],
      [x + 3, wall, 0.46],
      [x - 3, wall, 0.46],
    ],
    '#0206078c',
  )
  const plate = project(x, wall, 0.1, projection),
    split = 0.63
  c.save()
  c.translate(plate.x, plate.y)
  c.transform(1, 0, projection.side / projection.rise, 1, 0, 0)
  c.drawImage(
    art.front,
    0,
    art.front.height * split,
    art.front.width,
    art.front.height * (1 - split),
    -5.5,
    -23 * (1 - split),
    11,
    23 * (1 - split),
  )
  c.restore()
  // Short forged arm: +world Y projects into the room; the distal upstand supports the basket.
  // These are real top/side planes, not a rotated side sprite or an offset shadow.
  face(
    [
      [x - 1.2, wall, 0.39],
      [x + 1.2, wall, 0.39],
      [x + 1.2, wall + 12, 0.39],
      [x - 1.2, wall + 12, 0.39],
    ],
    '#695d4d',
  )
  face(
    [
      [x + 1.2, wall, 0.31],
      [x + 1.2, wall + 12, 0.31],
      [x + 1.2, wall + 12, 0.39],
      [x + 1.2, wall, 0.39],
    ],
    '#1b2021',
  )
  face(
    [
      [x - 1.2, wall + 12, 0.31],
      [x + 1.2, wall + 12, 0.31],
      [x + 1.2, wall + 12, 0.59],
      [x - 1.2, wall + 12, 0.59],
    ],
    '#343634',
  )
  face(
    [
      [x + 1.2, wall + 10, 0.39],
      [x + 1.2, wall + 12, 0.39],
      [x + 1.2, wall + 12, 0.59],
      [x + 1.2, wall + 10, 0.59],
    ],
    '#171d1f',
  )
  // Reuse the original forged stem material on the visible return of the bracket.
  // Its affine transform is the same vertical plane as the dimensional upstand.
  const knee = project(x, wall + 12, 0.31, projection)
  c.save()
  c.translate(knee.x, knee.y)
  c.transform(1, 0, projection.side / projection.rise, 1, 0, 0)
  c.drawImage(
    art.front,
    art.front.width * 0.43,
    art.front.height * 0.71,
    art.front.width * 0.14,
    art.front.height * 0.18,
    -1.2,
    -0.28 * projection.rise,
    2.4,
    0.28 * projection.rise,
  )
  c.restore()
  const basket = project(x, wall + 12, 0.59, projection)
  c.translate(basket.x, basket.y)
  c.transform(1, 0, projection.side / projection.rise, 1, 0, 0)
  c.drawImage(art.basket, -5.5, -9.5, 11, 9.5)
  if (fire) drawNorthTorchFlame(c, art.flame)
  // Front band and central upright occlude the flame; back rim remains behind it.
  c.drawImage(
    art.basket,
    0,
    art.basket.height * 0.46,
    art.basket.width,
    art.basket.height * 0.54,
    -5.5,
    -9.5 * 0.54,
    11,
    9.5 * 0.54,
  )
  c.drawImage(
    art.basket,
    art.basket.width * 0.4,
    art.basket.height * 0.2,
    art.basket.width * 0.2,
    art.basket.height * 0.26,
    -1.1,
    -9.5 * 0.8,
    2.2,
    9.5 * 0.26,
  )
  c.restore()
}

/** Independent flame artwork and ember-bed pivot for future flickering. Hardware never moves. */
export function drawNorthTorchFlame(c: CanvasRenderingContext2D, flame: HTMLCanvasElement) {
  c.drawImage(flame, -3.25, -15.8, 6.5, 10)
}
