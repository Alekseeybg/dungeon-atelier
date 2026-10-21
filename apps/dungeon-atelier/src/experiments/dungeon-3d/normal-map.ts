/** Central differences from the existing height pixels, never unrelated procedural noise. */
export function heightNormals(pixels: Uint8ClampedArray, width: number, height: number) {
  const out = new Uint8Array(width * height * 4),
    value = (x: number, y: number) =>
      pixels[
        (Math.max(0, Math.min(height - 1, y)) * width + Math.max(0, Math.min(width - 1, x))) * 4
      ]! / 255
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const dx = (value(x + 1, y) - value(x - 1, y)) * 3,
        dy = (value(x, y + 1) - value(x, y - 1)) * 3,
        length = Math.hypot(dx, dy, 1),
        i = (y * width + x) * 4
      out[i] = Math.round((0.5 - (dx / length) * 0.5) * 255)
      out[i + 1] = Math.round((0.5 + (dy / length) * 0.5) * 255)
      out[i + 2] = Math.round((0.5 + 0.5 / length) * 255)
      out[i + 3] = 255
    }
  return out
}
