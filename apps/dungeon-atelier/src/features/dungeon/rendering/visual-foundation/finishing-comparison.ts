import { canvas } from './art'
import { cropCoping } from './comparison'
export type FinishingView = 'room' | 'stairs' | 'torch' | 'mount' | 'side'
function detail(source: HTMLCanvasElement, x: number, y: number, w: number, h: number) {
  const result = canvas(w * 4, h * 4)
  result
    .getContext('2d')!
    .drawImage(source, (32 + x) * 2, (32 + y) * 2, w * 2, h * 2, 0, 0, result.width, result.height)
  return result
}
export function cropFinishing(source: HTMLCanvasElement, view: FinishingView) {
  if (view === 'room') return cropCoping(source, 'room')
  if (view === 'torch') return detail(source, 9 * 32 - 6, 6 * 26 - 14, 52, 58)
  if (view === 'mount') return detail(source, 8 * 32, 6 * 26 - 30, 128, 104)
  if (view === 'side') return detail(source, 6 * 32 - 24, 9 * 26 - 32, 88, 88)
  const a = detail(source, 8 * 32 - 24, 8 * 26 - 18, 84, 58),
    b = detail(source, 14 * 32 - 24, 8 * 26 - 18, 84, 58),
    out = canvas(a.width * 2 + 16, a.height + 36),
    c = out.getContext('2d')!
  c.fillStyle = '#080d10'
  c.fillRect(0, 0, out.width, out.height)
  c.fillStyle = '#dfd4bd'
  c.font = '18px sans-serif'
  c.fillText('Up · rising stone flight', 8, 25)
  c.fillText('Down · recessed well', a.width + 24, 25)
  c.drawImage(a, 0, 36)
  c.drawImage(b, a.width + 16, 36)
  return out
}
