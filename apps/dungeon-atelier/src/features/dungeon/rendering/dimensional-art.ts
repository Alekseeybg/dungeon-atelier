import floorUrl from '../../../assets/dimensional/floor-stone-v1.webp'
import fittedUrl from '../../../assets/dimensional/fitted-floor-v1.webp'
import masonryUrl from '../../../assets/dimensional/masonry-v1.webp'
import doorUrl from '../../../assets/dimensional/door-leaf-v1.webp'
import portalUrl from '../../../assets/dimensional/doorway-front-v2.webp'
import inlayUrl from '../../../assets/dimensional/carved-inlay-v1.webp'
import torchUrl from '../../../assets/dimensional/wall-sconce-v1.webp'

export interface PaintedArt {
  floor: HTMLImageElement
  fitted: HTMLImageElement
  masonry: HTMLImageElement
  door: HTMLCanvasElement
  portal: HTMLCanvasElement
  inlay: HTMLCanvasElement
  torch: HTMLCanvasElement
}
let art: PaintedArt | undefined
let loading: Promise<void> | undefined
const patterns = new Map<string, HTMLCanvasElement>()
export const dimensionalArt = () => art

/** Alpha is preserved; transparent padding is measured rather than guessed from a contact sheet. */
function trimmed(image: HTMLImageElement) {
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  const context = canvas.getContext('2d')!
  context.drawImage(image, 0, 0)
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
  let left = canvas.width,
    top = canvas.height,
    right = 0,
    bottom = 0
  for (let y = 0; y < canvas.height; y++)
    for (let x = 0; x < canvas.width; x++)
      if (pixels[(y * canvas.width + x) * 4 + 3]! > 8) {
        left = Math.min(left, x)
        right = Math.max(right, x)
        top = Math.min(top, y)
        bottom = Math.max(bottom, y)
      }
  if (right < left || bottom < top) throw new Error('A dimensional art sprite is empty.')
  const result = document.createElement('canvas')
  result.width = right - left + 1
  result.height = bottom - top + 1
  result
    .getContext('2d')!
    .drawImage(canvas, left, top, result.width, result.height, 0, 0, result.width, result.height)
  return result
}
export function loadDimensionalArtwork(): Promise<void> {
  if (art) return Promise.resolve()
  if (loading) return loading
  const image = async (url: string) => {
    const element = new Image()
    element.src = url
    await element.decode()
    return element
  }
  loading = Promise.all(
    [floorUrl, fittedUrl, masonryUrl, doorUrl, portalUrl, inlayUrl, torchUrl].map(image),
  )
    .then(([floor, fitted, masonry, door, portal, inlay, torch]) => {
      art = {
        floor: floor!,
        fitted: fitted!,
        masonry: masonry!,
        door: trimmed(door!),
        portal: trimmed(portal!),
        inlay: trimmed(inlay!),
        torch: trimmed(torch!),
      }
    })
    .catch((error) => {
      loading = undefined
      throw error
    })
  return loading
}

/** Mirrored periods guarantee identical edge texels, independently of an AI texture's seam quality. */
export function paintedFloorPattern(kind: string) {
  const existing = patterns.get(kind)
  if (existing) return existing
  if (!art) throw new Error('Dimensional artwork has not loaded.')
  const base = document.createElement('canvas')
  base.width = base.height = 128
  const context = base.getContext('2d')!
  context.imageSmoothingQuality = 'high'
  const fitted = kind === 'slab' || kind === 'ornament' || kind === 'repair',
    image = fitted ? art.fitted : art.floor
  const crop = image.naturalWidth
  context.drawImage(image, 0, 0, crop, crop, 0, 0, 128, 128)
  context.fillStyle = '#0b18252e'
  context.fillRect(0, 0, 128, 128)
  if (kind === 'corridor' || kind === 'repair') {
    context.fillStyle = '#0c182629'
    context.fillRect(0, 0, 128, 128)
  } else if (kind === 'ornament') {
    context.fillStyle = '#9b7c4210'
    context.fillRect(0, 0, 128, 128)
  }
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 256
  const destination = canvas.getContext('2d')!
  for (let row = 0; row < 2; row++)
    for (let col = 0; col < 2; col++) {
      destination.save()
      destination.translate(col ? 256 : 0, row ? 256 : 0)
      destination.scale(col ? -1 : 1, row ? -1 : 1)
      destination.drawImage(base, 0, 0)
      destination.restore()
    }
  patterns.set(kind, canvas)
  return canvas
}

/** Stone material inside a geometry-owned block; mortar/joins never depend on an image crop. */
export function paintStoneMaterial(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  variant: number,
) {
  if (!art) return
  const image = art.masonry,
    cellX = variant % 4,
    cellY = Math.floor(variant / 4) % 4
  c.save()
  c.imageSmoothingQuality = 'high'
  c.globalAlpha = 0.83
  c.drawImage(
    image,
    image.naturalWidth * (0.035 + cellX * 0.21),
    image.naturalHeight * (0.025 + cellY * 0.125),
    image.naturalWidth * 0.12,
    image.naturalHeight * 0.09,
    x,
    y,
    w,
    h,
  )
  c.restore()
}
