import floorUrl from '../../../../assets/visual-foundation/flagstone-field-v1.png'
import refinedFloorUrl from '../../../../assets/visual-foundation/flagstone-realistic-v3.png'
import weatheredFloorUrl from '../../../../assets/visual-foundation/floor-study-weathered.png'
import irregularFloorUrl from '../../../../assets/visual-foundation/floor-study-irregular.png'
import broadFloorUrl from '../../../../assets/visual-foundation/floor-study-broad.png'
import blendedFloorUrl from '../../../../assets/visual-foundation/floor-study-blended.png'
import earlyFloorUrl from '../../../../assets/visual-foundation/flagstone-large-v1.png'
import wallUrl from '../../../../assets/visual-foundation/masonry-profile-v1.png'
import frameUrl from '../../../../assets/visual-foundation/arch-frame-v1.png'
import capUrl from '../../../../assets/visual-foundation/coping-stone-v1.png'
import woodUrl from '../../../../assets/architecture/door-leaf-v1.webp'
import torchUrl from '../../../../assets/architecture/wall-sconce-v1.webp'
import ruinsFace from '../../../../assets/visual-foundation/ruins-face-v2.png'
import ruinsCap from '../../../../assets/visual-foundation/ruins-cap-v2.png'
import ruinsFrame from '../../../../assets/visual-foundation/ruins-frame-v2.png'
import ruinsSill from '../../../../assets/visual-foundation/ruins-sill-v2.png'
import fortressFace from '../../../../assets/visual-foundation/fortress-face-v2.png'
import fortressCap from '../../../../assets/visual-foundation/fortress-cap-v2.png'
import fortressFrame from '../../../../assets/visual-foundation/fortress-frame-v2.png'
import fortressSill from '../../../../assets/visual-foundation/fortress-sill-v2.png'
import { planeValue } from './plane-separation'

export type FoundationTreatment = 'original' | 'ruins' | 'fortress'
export const FLOOR_STUDIES = [
  {
    value: 'refined',
    label: 'Refined realistic (current)',
    url: refinedFloorUrl,
    exposure: 0.8,
    edgeTone: true,
    description: 'Calmer worn slabs; the current floor candidate.',
  },
  {
    value: 'previous',
    label: 'Previous flagstones',
    url: floorUrl,
    exposure: 1,
    edgeTone: false,
    description: 'The preceding room floor, retained unchanged.',
  },
  {
    value: 'study-weathered',
    label: 'Study 1 · Weathered flagstones',
    url: weatheredFloorUrl,
    exposure: 1,
    edgeTone: true,
    description: 'An early refinement with pronounced surface wear.',
  },
  {
    value: 'study-irregular',
    label: 'Study 2 · Irregular flagstones',
    url: irregularFloorUrl,
    exposure: 1,
    edgeTone: true,
    description: 'More irregular shapes and stronger stone-to-stone variation.',
  },
  {
    value: 'study-broad',
    label: 'Study 3 · Broad natural slabs',
    url: broadFloorUrl,
    exposure: 0.8,
    edgeTone: true,
    description: 'The photographic material before the slab-scale refinement.',
  },
  {
    value: 'study-blended',
    label: 'Study 4 · Blended wear',
    url: blendedFloorUrl,
    exposure: 1,
    edgeTone: true,
    description: 'The original construction with a different wear treatment.',
  },
  {
    value: 'study-early',
    label: 'Early study · Large flagstones',
    url: earlyFloorUrl,
    exposure: 1,
    edgeTone: true,
    description: 'The earlier large-scale flagstone material.',
  },
] as const
export type FoundationFloor = (typeof FLOOR_STUDIES)[number]['value']
export function floorStudy(value: FoundationFloor) {
  return FLOOR_STUDIES.find((study) => study.value === value)!
}
const materials = {
  original: { cap: capUrl, wall: wallUrl, frame: frameUrl },
  ruins: { cap: ruinsCap, wall: ruinsFace, frame: ruinsFrame, sill: ruinsSill },
  fortress: { cap: fortressCap, wall: fortressFace, frame: fortressFrame, sill: fortressSill },
}

export interface FoundationArt {
  treatment: FoundationTreatment
  floorTreatment: FoundationFloor
  floor: CanvasPattern
  cap: CanvasPattern
  face: CanvasPattern
  frame: HTMLCanvasElement
  aperture?: HTMLCanvasElement
  sill?: HTMLCanvasElement
  opening: { x: number; y: number; width: number; height: number }
  wood: HTMLCanvasElement
  torch: HTMLCanvasElement
  sourceSizes: Record<string, { width: number; height: number }>
}
const loading = new Map<string, Promise<FoundationArt>>()
export function canvas(width: number, height: number) {
  const result = document.createElement('canvas')
  result.width = width
  result.height = height
  return result
}
function trim(image: HTMLImageElement) {
  const source = canvas(image.naturalWidth, image.naturalHeight),
    c = source.getContext('2d')!
  c.drawImage(image, 0, 0)
  const data = c.getImageData(0, 0, source.width, source.height).data
  let left = source.width,
    top = source.height,
    right = -1,
    bottom = -1
  for (let y = 0; y < source.height; y++)
    for (let x = 0; x < source.width; x++)
      if (data[(y * source.width + x) * 4 + 3]! > 16) {
        left = Math.min(left, x)
        right = Math.max(right, x)
        top = Math.min(top, y)
        bottom = Math.max(bottom, y)
      }
  if (right < left) throw new Error('Empty foundation artwork')
  const result = canvas(right - left + 1, bottom - top + 1)
  result
    .getContext('2d')!
    .drawImage(source, left, top, result.width, result.height, 0, 0, result.width, result.height)
  return result
}
function repeat(
  image: CanvasImageSource,
  width: number,
  height: number,
  sy = 0,
  sh?: number,
  mirrorY = false,
  plane?: 'cap' | 'face',
  exposure = 1,
) {
  const source = image as HTMLCanvasElement | HTMLImageElement
  const sw = 'naturalWidth' in source ? source.naturalWidth : source.width
  const sourceHeight = 'naturalHeight' in source ? source.naturalHeight : source.height
  const base = canvas(width * 2, height * 2),
    b = base.getContext('2d')!
  b.imageSmoothingQuality = 'high'
  b.drawImage(image, 0, sy, sw, sh ?? sourceHeight, 0, 0, base.width, base.height)
  if (plane || exposure !== 1) {
    const pixels = b.getImageData(0, 0, base.width, base.height)
    for (let i = 0; i < pixels.data.length; i += 4) {
      const r = pixels.data[i]!,
        g = pixels.data[i + 1]!,
        blue = pixels.data[i + 2]!,
        value = 0.2126 * r + 0.7152 * g + 0.0722 * blue,
        target = plane ? planeValue(value, plane) : value * exposure
      // Preserve restrained stone hue, while luminance is governed by the plane.
      const chroma = plane ? 0.65 : exposure
      pixels.data[i] = target + (r - value) * chroma
      pixels.data[i + 1] = target + (g - value) * chroma
      pixels.data[i + 2] = target + (blue - value) * chroma
    }
    b.putImageData(pixels, 0, 0)
  }
  const period = canvas(base.width * 2, base.height * (mirrorY ? 2 : 1)),
    p = period.getContext('2d')!
  for (let row = 0; row < (mirrorY ? 2 : 1); row++)
    for (let col = 0; col < 2; col++) {
      p.save()
      p.translate(col ? base.width * 2 : 0, row ? base.height * 2 : 0)
      p.scale(col ? -1 : 1, row ? -1 : 1)
      p.drawImage(base, 0, 0)
      p.restore()
    }
  const pattern = p.createPattern(period, 'repeat')!
  pattern.setTransform(new DOMMatrix().scale(0.5))
  return pattern
}
export function loadFoundationArt(
  treatment: FoundationTreatment = 'ruins',
  separation = true,
  floorTreatment: FoundationFloor = 'refined',
): Promise<FoundationArt> {
  const key = `${treatment}:${separation}:${floorTreatment}`
  const cached = loading.get(key)
  if (cached) return cached
  const pending = (async () => {
    const entries = await Promise.all(
      Object.entries({
        floor: floorStudy(floorTreatment).url,
        ...materials[treatment],
        wood: woodUrl,
        torch: torchUrl,
      }).map(async ([name, url]) => {
        const image = new Image()
        image.src = url
        await image.decode()
        return [name, image] as const
      }),
    )
    const images = Object.fromEntries(entries) as Record<string, HTMLImageElement>
    const profile = trim(images.wall!)
    let frame = trim(images.frame!)
    if (treatment !== 'original') {
      // Keep the authored arch and jambs, not the unrelated side-wall patch.
      const pixels = frame.getContext('2d')!.getImageData(0, 0, frame.width, frame.height).data
      const cy = Math.floor(frame.height * 0.7)
      let left = Math.floor(frame.width / 2),
        right = left
      const clear = (x: number) => pixels[(cy * frame.width + x) * 4 + 3]! < 16
      while (left > 0 && clear(left - 1)) left--
      while (right < frame.width - 1 && clear(right + 1)) right++
      const margin = Math.round((right - left) * 0.3),
        x = Math.max(0, left - margin),
        cropped = canvas(Math.min(frame.width, right + margin) - x, frame.height)
      cropped.getContext('2d')!.drawImage(frame, -x, 0)
      frame = cropped
    }
    const pixels = frame.getContext('2d')!.getImageData(0, 0, frame.width, frame.height).data
    const cx = Math.floor(frame.width / 2),
      cy = Math.floor(frame.height * 0.7)
    const clear = (x: number, y: number) => pixels[(y * frame.width + x) * 4 + 3]! < 16
    let left = cx,
      right = cx,
      top = cy
    while (left > 0 && clear(left - 1, cy)) left--
    while (right < frame.width - 1 && clear(right + 1, cy)) right++
    while (top > 0 && clear(cx, top - 1)) top--
    let aperture: HTMLCanvasElement | undefined
    if (treatment !== 'original') {
      aperture = canvas(frame.width, frame.height)
      const mask = aperture.getContext('2d')!.createImageData(frame.width, frame.height)
      for (let y = top; y < frame.height; y++)
        for (let x = left; x <= right; x++) {
          const i = (y * frame.width + x) * 4
          mask.data[i + 3] = 255 - pixels[i + 3]!
        }
      aperture.getContext('2d')!.putImageData(mask, 0, 0)
      // Blend only the outer stone edges into the continuous wall field.
      const c = frame.getContext('2d')!,
        fade = c.createLinearGradient(0, 0, frame.width, 0)
      fade.addColorStop(0, '#fff0')
      fade.addColorStop(0.1, '#ffff')
      fade.addColorStop(0.9, '#ffff')
      fade.addColorStop(1, '#fff0')
      c.globalCompositeOperation = 'destination-in'
      c.fillStyle = fade
      c.fillRect(0, 0, frame.width, frame.height)
      c.globalCompositeOperation = 'source-over'
    }
    // Profile contains one painted coping course, then two face courses.
    // This split retains the authored mortar/bevels; there are no procedural brick cells.
    const split = Math.round(profile.height * 0.44)
    return {
      treatment,
      floorTreatment,
      floor: repeat(
        images.floor!,
        384,
        384,
        0,
        undefined,
        true,
        undefined,
        floorStudy(floorTreatment).exposure,
      ),
      cap: repeat(images.cap!, 128, 128, 0, undefined, true, separation ? 'cap' : undefined),
      face:
        treatment === 'original'
          ? repeat(
              profile,
              128,
              24,
              split,
              profile.height - split,
              false,
              separation ? 'face' : undefined,
            )
          : repeat(profile, 128, 24, 0, undefined, false, separation ? 'face' : undefined),
      frame,
      ...(aperture ? { aperture } : {}),
      ...(images.sill ? { sill: trim(images.sill) } : {}),
      opening: {
        x: left / frame.width,
        y: top / frame.height,
        width: (right - left + 1) / frame.width,
        height: (frame.height - top) / frame.height,
      },
      wood: trim(images.wood!),
      torch: trim(images.torch!),
      sourceSizes: Object.fromEntries(
        entries.map(([name, image]) => [
          name,
          { width: image.naturalWidth, height: image.naturalHeight },
        ]),
      ),
    }
  })().catch((error: unknown) => {
    loading.delete(key)
    throw error
  })
  loading.set(key, pending)
  while (loading.size > 6) loading.delete(loading.keys().next().value!)
  return pending
}
