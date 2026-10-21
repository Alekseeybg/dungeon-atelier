import { ancientOptions, DEFAULT_ANCIENT } from '../ancient-settings'
import { composeFoundation } from './renderer'
import { createFinishingScene } from './finishing-scene'
import { canvas } from './art'
import { projectionBeforeTurn, viewAngleTransform } from './view-angle'
export { VIEW_ANGLES } from './view-angle'
import type { WallProjection } from './model'

export const UPWARD_SHIFTS = [20, 24, 28, 32] as const
export const PROJECTION_VIEWS = [
  { value: 'room', label: 'Four-door room' },
  { value: 'doors-ew', label: 'East / west door close-ups' },
  { value: 'doors-ns', label: 'North / south door close-ups' },
  { value: 'stairs', label: 'Stairs and level plaques' },
  { value: 'mount', label: 'North wall and torch' },
  { value: 'side', label: 'Side wall and torch' },
  { value: 'scene', label: 'Full room and narrow approaches' },
] as const
export type ProjectionView = (typeof PROJECTION_VIEWS)[number]['value']
export interface ProjectionStudyOptions {
  doorsOpen: boolean
  lighting: boolean
  grid: boolean
  secret: 'none' | 'hidden' | 'revealed'
}

/** The real compositor and approved materials, using a disposable, fixed review fixture. */
export async function renderProjectionStudy(
  projection: WallProjection,
  options: ProjectionStudyOptions,
  angle = 0,
) {
  const scene = createFinishingScene(options.secret !== 'none')
  const frame = await composeFoundation(scene, {
    ...ancientOptions(DEFAULT_ANCIENT),
    projection: projectionBeforeTurn(projection, angle),
    doors: options.doorsOpen ? 'open' : 'closed',
    lighting: options.lighting,
    grid: options.grid,
    secret: options.secret,
  })
  return frame.image
}

/** Turn the entire ground plane around the inspected area, at one shared scale.
 * The source was rendered with the inverse-transformed wall lift, so this preserves
 * screen-space wall height while changing the angle of floors and wall faces together. */
function turnedDetail(
  source: HTMLCanvasElement,
  angle: number,
  cx: number,
  cy: number,
  width: number,
  height: number,
  scale: number,
) {
  const result = canvas(width * scale, height * scale),
    c = result.getContext('2d')!,
    t = viewAngleTransform(angle),
    x = 32 + cx,
    y = 32 + cy
  c.fillStyle = '#080d10'
  c.fillRect(0, 0, result.width, result.height)
  c.imageSmoothingQuality = 'high'
  c.transform(
    scale * t.a,
    scale * t.b,
    scale * t.c,
    scale * t.d,
    result.width / 2 - scale * (t.a * x + t.c * y),
    result.height / 2 - scale * (t.b * x + t.d * y),
  )
  c.drawImage(source, 0, 0, source.width / 2, source.height / 2)
  return result
}

/** Identical viewports prevent fit-to-panel scaling from disguising the angle difference. */
export function cropProjectionStudy(source: HTMLCanvasElement, view: ProjectionView, angle = 0) {
  if (view === 'room') return turnedDetail(source, angle, 368, 301, 528, 476, 2)
  if (view === 'scene') return turnedDetail(source, angle, 368, 299, 1000, 840, 2)
  if (view === 'mount') return turnedDetail(source, angle, 320, 178, 160, 144, 4)
  if (view === 'side') return turnedDetail(source, angle, 212, 246, 112, 112, 4)
  const parts =
      view === 'stairs'
        ? [
            { x: 8 * 32 + 18, y: 8 * 26 + 11, label: 'Up staircase' },
            { x: 14 * 32 + 18, y: 8 * 26 + 11, label: 'Down staircase' },
          ]
        : view === 'doors-ew'
          ? [
              { x: 16 * 32 + 16, y: 11 * 26 + 12, label: 'East door' },
              { x: 6 * 32 + 16, y: 11 * 26 + 12, label: 'West door' },
            ]
          : [
              { x: 11 * 32 + 16, y: 6 * 26 + 12, label: 'North door' },
              { x: 11 * 32 + 16, y: 16 * 26 + 12, label: 'South door' },
            ],
    result = canvas(912, 480),
    c = result.getContext('2d')!
  c.fillStyle = '#080d10'
  c.fillRect(0, 0, result.width, result.height)
  c.fillStyle = '#dfd4bd'
  c.font = '18px sans-serif'
  for (const [i, part] of parts.entries()) {
    const image = turnedDetail(source, angle, part.x, part.y, 112, 112, 4),
      x = i * 464
    c.fillText(part.label, x + 8, 23)
    c.drawImage(image, x, 32)
    image.width = image.height = 1
  }
  return result
}
