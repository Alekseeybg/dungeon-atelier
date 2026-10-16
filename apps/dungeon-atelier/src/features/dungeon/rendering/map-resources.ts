const resources = new WeakMap<HTMLCanvasElement, () => void>()
let live = 0,
  bytes = 0
export function ownMapCanvas(canvas: HTMLCanvasElement, release: () => void) {
  const size = canvas.width * canvas.height * 4
  live++
  bytes += size
  resources.set(canvas, () => {
    release()
    live--
    bytes -= size
  })
}
export function disposeMapCanvas(canvas: HTMLCanvasElement | undefined) {
  if (!canvas) return
  resources.get(canvas)?.()
  resources.delete(canvas)
  canvas.width = canvas.height = 1
}
export function mapResourceStats() {
  return { live, bytes }
}
