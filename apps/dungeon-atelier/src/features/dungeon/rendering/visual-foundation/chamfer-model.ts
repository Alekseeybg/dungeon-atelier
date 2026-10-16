// Both exposed edges are cut. Preserve a five-unit flat crown in the 20-unit
// wall width, with a shallow slope that remains visible on the foreshortened side.
export const CHAMFER = Object.freeze({ width: 7.5, drop: 1.5, wallHeight: 24 })
export interface CapEdge {
  ax: number
  ay: number
  bx: number
  by: number
  nx: number
  ny: number
}
export interface ProfilePoint {
  x: number
  y: number
  z: number
}
export interface ChamferFacet {
  edge: CapEdge
  footprint: ProfilePoint[]
  points: ProfilePoint[]
}

/** Merge collinear room edges before insetting; tile boundaries never become profile joints. */
export function mergeCapEdges(edges: CapEdge[]) {
  const groups = new Map<string, CapEdge[]>()
  for (const e of edges) {
    const key = `${e.nx},${e.ny},${e.nx ? e.ax : e.ay}`,
      group = groups.get(key) ?? []
    group.push({ ...e })
    groups.set(key, group)
  }
  const result: CapEdge[] = []
  for (const group of groups.values()) {
    group.sort((a, b) => (a.nx ? a.ay - b.ay : a.ax - b.ax))
    let current: CapEdge | undefined
    for (const edge of group) {
      if (current && current.bx === edge.ax && current.by === edge.ay) {
        current.bx = edge.bx
        current.by = edge.by
      } else {
        current = { ...edge }
        result.push(current)
      }
    }
  }
  return result
}
export function chamferFacets(source: CapEdge[]): ChamferFacet[] {
  const edges = mergeCapEdges(source),
    vertices = new Map<string, CapEdge[]>()
  for (const e of edges)
    for (const [x, y] of [
      [e.ax, e.ay],
      [e.bx, e.by],
    ]) {
      const key = `${x},${y}`,
        list = vertices.get(key) ?? []
      list.push(e)
      vertices.set(key, list)
    }
  return edges.map((edge) => {
    const inner = (x: number, y: number): ProfilePoint => {
      const other = vertices.get(`${x},${y}`)?.find((e) => e.nx * edge.nx + e.ny * edge.ny === 0)
      return {
        x: x - CHAMFER.width * (edge.nx + (other?.nx ?? 0)),
        y: y - CHAMFER.width * (edge.ny + (other?.ny ?? 0)),
        z: 1,
      }
    }
    const a = inner(edge.ax, edge.ay),
      b = inner(edge.bx, edge.by),
      outerB = { x: edge.bx, y: edge.by, z: 1 - CHAMFER.drop / CHAMFER.wallHeight },
      outerA = { x: edge.ax, y: edge.ay, z: outerB.z }
    return {
      edge,
      points: [a, b, outerB, outerA],
      footprint: [a, b, { ...outerB, z: 1 }, { ...outerA, z: 1 }],
    }
  })
}
/** Affine ground-UV -> screen mapping of a genuine sloped plane, not a vertical extrusion. */
export function facetTransform(edge: CapEdge, depth: number, side: number) {
  const k = CHAMFER.drop / (CHAMFER.wallHeight * CHAMFER.width),
    z = 1 - CHAMFER.drop / CHAMFER.wallHeight,
    dot = edge.nx * edge.ax + edge.ny * edge.ay
  return {
    a: 1 + side * k * edge.nx,
    b: CHAMFER.wallHeight * k * edge.nx,
    c: side * k * edge.ny,
    d: depth + CHAMFER.wallHeight * k * edge.ny,
    e: -side * z - side * k * dot,
    f: -CHAMFER.wallHeight * z - CHAMFER.wallHeight * k * dot,
  }
}
