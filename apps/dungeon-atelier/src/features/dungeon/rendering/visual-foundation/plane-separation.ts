/** Shared material response, before warm lighting. Mortar stays dark; stone planes separate. */
export function planeValue(value: number, plane: 'cap' | 'face') {
  const x = Math.max(0, Math.min(255, value)) / 255
  return plane === 'cap' ? 22 + 200 * Math.pow(x, 0.76) : 5 + 97 * Math.pow(x, 0.84)
}

/** Exposed coping contours only; connected tile boundaries never acquire an outline. */
export function capBoundarySegments(
  rects: { x: number; y: number; width: number; height: number }[],
) {
  const steps = [0, 6, 26, 32]
  const occupied = (x: number, y: number) =>
    rects.some((r) => x >= r.x && x < r.x + r.width && y >= r.y && y < r.y + r.height)
  const edges: { ax: number; ay: number; bx: number; by: number; light: boolean }[] = []
  for (let row = 0; row < 3; row++)
    for (let col = 0; col < 3; col++) {
      const x = steps[col]!,
        y = steps[row]!,
        right = steps[col + 1]!,
        bottom = steps[row + 1]!
      if (!occupied((x + right) / 2, (y + bottom) / 2)) continue
      if (y > 0 && !occupied((x + right) / 2, y - 0.1))
        edges.push({ ax: x, ay: y, bx: right, by: y, light: true })
      if (x > 0 && !occupied(x - 0.1, (y + bottom) / 2))
        edges.push({ ax: x, ay: y, bx: x, by: bottom, light: true })
      if (bottom < 32 && !occupied((x + right) / 2, bottom + 0.1))
        edges.push({ ax: x, ay: bottom, bx: right, by: bottom, light: false })
      if (right < 32 && !occupied(right + 0.1, (y + bottom) / 2))
        edges.push({ ax: right, ay: y, bx: right, by: bottom, light: false })
    }
  return edges
}
