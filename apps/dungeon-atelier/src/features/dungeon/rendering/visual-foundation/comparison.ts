import { renderDimensional } from '../dimensional-renderer'
import { prepareDimensionalAtlas } from '../dimensional-sprites'
import { canvas } from './art'
import { createFoundationScene } from './model'
import type { FoundationOptions } from './renderer'

/** The production renderer is called as-is, on the same fixture, at the same pixel density. */
export async function renderFoundationBaseline(options: FoundationOptions = {}) {
  await prepareDimensionalAtlas()
  const { floor } = createFoundationScene(
    options.secret === 'hidden' || options.secret === 'revealed',
  )
  const result = canvas((floor.width * 32 + 64) * 2, (floor.height * 32 + 64) * 2),
    c = result.getContext('2d')!
  c.scale(2, 2)
  c.fillStyle = '#080d10'
  c.fillRect(0, 0, result.width, result.height)
  c.translate(32, 32)
  renderDimensional(c, floor, options.grid ?? false, {
    revealSecrets: options.secret === 'revealed',
    openDoorIds: options.doors === 'open' ? floor.doors.map((d) => d.id) : [],
  })
  return result
}
export type FoundationView =
  | 'room'
  | 'scene'
  | 'architecture'
  | 'wall-detail'
  | 'east-wall'
  | 'south-east'
  | 'floor-center'
  | 'floor-edge'
  | 'doors-ns'
  | 'doors-ew'
  | 'coping-edge'

/** Four-door camera trimmed to exclude a cut-off neighbouring outer wall. */
export function cropCoping(source: HTMLCanvasElement, view: FoundationView) {
  const image = cropFoundation(source, view)
  if (view !== 'room') return image
  const result = canvas(image.width - 32, image.height)
  result.getContext('2d')!.drawImage(image, 0, 0)
  return result
}
export function cropFoundation(source: HTMLCanvasElement, view: FoundationView, baseline = false) {
  if (view === 'scene') return source
  const depth = baseline ? 32 : 26
  if (
    view === 'coping-edge' ||
    view === 'wall-detail' ||
    view === 'east-wall' ||
    view === 'south-east' ||
    view === 'floor-center' ||
    view === 'floor-edge'
  ) {
    const region =
      view === 'coping-edge'
        ? { x: 6 * 32 - 6, y: 16 * depth - 34, width: 11 * 32 + 12, height: 94 }
        : view === 'floor-center'
          ? { x: 9 * 32, y: 9 * depth, width: 128, height: 4 * depth }
          : view === 'floor-edge'
            ? { x: 14 * 32 - 16, y: 13 * depth - 16, width: 96, height: 3 * depth }
            : view === 'east-wall'
              ? { x: 14 * 32, y: 11 * depth - 16, width: 128, height: 5 * depth }
              : view === 'south-east'
                ? { x: 13 * 32, y: 13 * depth - 24, width: 160, height: 4 * depth + 32 }
                : { x: 6 * 32 - 12, y: 6 * depth - 28, width: 152, height: 3 * depth + 20 }
    const { x, y, width, height } = region
    const result = canvas(width * 4, height * 4),
      c = result.getContext('2d')!
    c.imageSmoothingEnabled = false
    c.drawImage(
      source,
      (32 + x) * 2,
      (32 + y) * 2,
      width * 2,
      height * 2,
      0,
      0,
      result.width,
      result.height,
    )
    return result
  }
  if (view === 'doors-ns' || view === 'doors-ew') {
    const result = canvas(768, 352),
      c = result.getContext('2d')!
    c.fillStyle = '#080d10'
    c.fillRect(0, 0, 768, 352)
    c.imageSmoothingEnabled = false
    const doors =
      view === 'doors-ns'
        ? [
            { x: 11, y: 6 },
            { x: 11, y: 16 },
          ]
        : [
            { x: 16, y: 11 },
            { x: 6, y: 11 },
          ]
    doors.forEach((p, i) =>
      c.drawImage(
        source,
        (32 + p.x * 32 - 32) * 2,
        (32 + p.y * depth - 32) * 2,
        192,
        176,
        i * 384,
        0,
        384,
        352,
      ),
    )
    return result
  }
  const region =
    view === 'room'
      ? { x: 5 * 32, y: 5 * depth - 24, width: 13 * 32, height: 13 * depth + 52 }
      : { x: 5 * 32, y: 5 * depth - 24, width: 7 * 32, height: 7 * depth }
  const result = canvas(region.width * 2, region.height * 2)
  result
    .getContext('2d')!
    .drawImage(
      source,
      (32 + region.x) * 2,
      (32 + region.y) * 2,
      result.width,
      result.height,
      0,
      0,
      result.width,
      result.height,
    )
  return result
}
