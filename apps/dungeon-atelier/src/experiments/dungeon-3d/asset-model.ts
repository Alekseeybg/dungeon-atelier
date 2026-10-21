import { planStaircases } from './stair-layout.ts'
import { appearanceHash } from './plan.ts'
import type { Dungeon3DPlan } from './plan.ts'
import { wallField } from './wall-wear.ts'

export interface FloorRect {
  x: number
  z: number
  width: number
  depth: number
  material: Dungeon3DPlan['tiles'][number]['material']
}
export interface Point {
  x: number
  z: number
}
export interface StoneSlab {
  id: string
  rects: FloorRect[]
  material: FloorRect['material']
  top: number
  tint: number
  atlas: number
  turn: number
}
const rounded = (value: number) => Math.round(value * 1e6) / 1e6

/** Room paving with full architectural stairwell openings, including under-wall margins. */
export function floorFootprint(plan: Dungeon3DPlan): FloorRect[] {
  const holes = planStaircases(plan)
    .filter((s) => s.direction === 'down')
    .map((s) => s.bounds)
  return plan.tiles.flatMap((tile) => {
    const x = tile.x,
      z = tile.z,
      wall = (a: number, b: number) => plan.floor.tiles[b]?.[a] === 'wall',
      l = x - (wall(x - 1, z) ? 0.1875 : 0),
      r = x + 1 + (wall(x + 1, z) ? 0.1875 : 0),
      t = z - (wall(x, z - 1) ? 0.1875 : 0),
      b = z + 1 + (wall(x, z + 1) ? 0.1875 : 0),
      rect = (left: number, top: number, right: number, bottom: number) => ({
        x: left,
        z: top,
        width: right - left,
        depth: bottom - top,
        material: tile.material,
      })
    let pieces = [rect(l, t, r, b)]
    for (const hole of holes) {
      pieces = pieces.flatMap((p) => {
        const left = Math.max(p.x, hole.x),
          right = Math.min(p.x + p.width, hole.x + hole.width),
          top = Math.max(p.z, hole.z),
          bottom = Math.min(p.z + p.depth, hole.z + hole.depth)
        if (left >= right || top >= bottom) return [p]
        return [
          rect(p.x, p.z, p.x + p.width, top),
          rect(p.x, bottom, p.x + p.width, p.z + p.depth),
          rect(p.x, top, left, bottom),
          rect(right, top, p.x + p.width, bottom),
        ].filter((q) => q.width > 0.00001 && q.depth > 0.00001)
      })
    }
    return pieces
  })
}

/** Slabs belong to a world-space course, not to a logical tile; clip and reunite their pieces. */
export function planStoneSlabs(plan: Dungeon3DPlan): StoneSlab[] {
  const footprint = floorFootprint(plan),
    slabs: StoneSlab[] = []
  for (const material of new Set(footprint.map((r) => r.material))) {
    const rects = footprint.filter((r) => r.material === material),
      broad = material === 'study-broad',
      corridor = material === 'study-weathered',
      rowHeight = broad ? 0.95 : corridor ? 0.6 : 0.76,
      baseWidth = broad ? 1.24 : corridor ? 0.78 : 0.94,
      widths = [1, 1.25, 0.8, 1.1, 0.9]
    for (let row = -1; row * rowHeight < plan.floor.height + 1; row++) {
      const top = rounded(row * rowHeight),
        bottom = rounded((row + 1) * rowHeight),
        candidates = rects.filter((r) => r.z < bottom && r.z + r.depth > top),
        phase = appearanceHash(plan.floor.seed, row, 0, 1201),
        shift = Math.floor(phase * widths.length)
      if (!candidates.length) continue
      let x = -baseWidth * (1.5 + phase),
        column = -2
      while (x < plan.floor.width + 1) {
        const width =
            baseWidth *
            widths[(((column + shift) % widths.length) + widths.length) % widths.length]!,
          left = rounded(x),
          right = rounded(x + width),
          pieces: FloorRect[] = []
        for (const r of candidates) {
          const l = Math.max(left, r.x),
            t = Math.max(top, r.z),
            rr = Math.min(right, r.x + r.width),
            b = Math.min(bottom, r.z + r.depth)
          if (rr - l > 0.004 && b - t > 0.004)
            pieces.push({
              x: rounded(l),
              z: rounded(t),
              width: rounded(rr - l),
              depth: rounded(b - t),
              material,
            })
        }
        if (pieces.length)
          slabs.push({
            id: `${material}:${row}:${column}`,
            rects: pieces,
            material,
            top: 0.023 + appearanceHash(plan.floor.seed, row, column, 1211) * 0.01,
            tint: 0.96 + appearanceHash(plan.floor.seed, row, column, 1223) * 0.08,
            atlas: Math.min(
              15,
              Math.floor(appearanceHash(plan.floor.seed, row, column, 1231) * 16),
            ),
            turn: Math.min(7, Math.floor(appearanceHash(plan.floor.seed, row, column, 1237) * 8)),
          })
        x += width
        column++
      }
    }
  }
  return slabs
}

/** Trace the union of rectangular pieces, retaining holes and disjoint fragments. */
export function rectangleContours(
  rects: { x: number; z: number; width: number; depth: number }[],
): Point[][] {
  const xs = [...new Set(rects.flatMap((r) => [rounded(r.x), rounded(r.x + r.width)]))].sort(
      (a, b) => a - b,
    ),
    zs = [...new Set(rects.flatMap((r) => [rounded(r.z), rounded(r.z + r.depth)]))].sort(
      (a, b) => a - b,
    ),
    occupied = new Set<string>(),
    key = (x: number, z: number) => `${x},${z}`
  for (let j = 0; j < zs.length - 1; j++)
    for (let i = 0; i < xs.length - 1; i++) {
      const x = (xs[i]! + xs[i + 1]!) / 2,
        z = (zs[j]! + zs[j + 1]!) / 2
      if (
        rects.some(
          (r) =>
            x > r.x - 1e-6 &&
            x < r.x + r.width + 1e-6 &&
            z > r.z - 1e-6 &&
            z < r.z + r.depth + 1e-6,
        )
      )
        occupied.add(key(i, j))
    }
  const edges: { a: Point; b: Point }[] = []
  for (let j = 0; j < zs.length - 1; j++)
    for (let i = 0; i < xs.length - 1; i++) {
      if (!occupied.has(key(i, j))) continue
      const l = xs[i]!,
        r = xs[i + 1]!,
        t = zs[j]!,
        b = zs[j + 1]!
      if (!occupied.has(key(i, j - 1))) edges.push({ a: { x: l, z: t }, b: { x: r, z: t } })
      if (!occupied.has(key(i + 1, j))) edges.push({ a: { x: r, z: t }, b: { x: r, z: b } })
      if (!occupied.has(key(i, j + 1))) edges.push({ a: { x: r, z: b }, b: { x: l, z: b } })
      if (!occupied.has(key(i - 1, j))) edges.push({ a: { x: l, z: b }, b: { x: l, z: t } })
    }
  const result: Point[][] = []
  while (edges.length) {
    const first = edges.shift()!,
      loop = [first.a],
      start = key(first.a.x, first.a.z)
    let previous = first.a,
      current = first.b
    while (key(current.x, current.z) !== start) {
      loop.push(current)
      const options = edges
        .map((e, i) => ({ e, i }))
        .filter(({ e }) => key(e.a.x, e.a.z) === key(current.x, current.z))
      if (!options.length) throw new Error('Disconnected slab outline')
      options.sort((a, b) => {
        const angle = (p: Point) =>
          Math.atan2(
            (current.x - previous.x) * (p.z - current.z) -
              (current.z - previous.z) * (p.x - current.x),
            (current.x - previous.x) * (p.x - current.x) +
              (current.z - previous.z) * (p.z - current.z),
          )
        return angle(b.e.b) - angle(a.e.b)
      })
      const next = edges.splice(options[0]!.i, 1)[0]!
      previous = current
      current = next.b
    }
    const simple = loop.filter((p, i) => {
      const a = loop[(i + loop.length - 1) % loop.length]!,
        b = loop[(i + 1) % loop.length]!
      return Math.abs((p.x - a.x) * (b.z - p.z) - (p.z - a.z) * (b.x - p.x)) > 1e-8
    })
    if (simple.length >= 3) result.push(simple)
  }
  return result
}

export type WallRun = Dungeon3DPlan['walls'][number]['edges'][number]
export function wallCourses(seed: string, edge: WallRun, height: number) {
  const horizontal = edge.az === edge.bz,
    start = horizontal ? edge.ax : edge.az,
    end = horizontal ? edge.bx : edge.bz,
    face = horizontal ? edge.az : edge.ax,
    rows = Math.max(1, Math.round(height / 0.34)),
    courseHeight = height / rows,
    blocks: {
      a: number
      b: number
      low: number
      high: number
      tint: number
      atlas: number
      turn: number
      relief: number
    }[] = []
  for (let row = 0; row < rows; row++) {
    const bond = appearanceHash(seed, Math.floor(face / 4), 0, 1301),
      unit = 0.92 + bond * 0.16,
      offset = (row % 2) * unit * 0.5,
      low = row * courseHeight + 0.006,
      high = Math.min(height - 0.012, (row + 1) * courseHeight - 0.006)
    for (let index = Math.floor((start - offset) / unit); index * unit + offset < end; index++) {
      const a = Math.max(start, index * unit + offset + 0.006),
        b = Math.min(end, (index + 1) * unit + offset - 0.006)
      if (b - a < 0.025) continue
      const along = (a + b) / 2,
        group = wallField(
          seed,
          horizontal ? along / 4 : face / 4,
          row / 3,
          horizontal ? face / 4 : along / 4,
        ),
        course = wallField(
          seed,
          horizontal ? along / 9 : face / 9,
          row / 5,
          horizontal ? face / 9 : along / 9,
        ),
        grain = appearanceHash(seed, index, row + face, 1337)
      blocks.push({
        a,
        b,
        low,
        high,
        tint: 0.965 + group * 0.055 + course * 0.015,
        atlas: Math.min(3, Math.floor(group * 4)) * 4 + Math.min(3, Math.floor(grain * 4)),
        turn: grain > 0.5 ? 4 : 0,
        relief: 0.009 + group * 0.005,
      })
    }
  }
  return blocks
}
