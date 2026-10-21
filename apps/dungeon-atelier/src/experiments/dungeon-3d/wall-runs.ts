import type { Dungeon3DPlan } from './plan.ts'

/** Join collinear wall edges before laying courses, so logical tile borders don't split stones. */
export function masonryRuns(plan: Dungeon3DPlan) {
  type Edge = Dungeon3DPlan['walls'][number]['edges'][number]
  const groups = new Map<string, Edge[]>()
  for (const wall of plan.walls)
    for (const edge of wall.edges) {
      const horizontal = edge.az === edge.bz,
        key = `${horizontal}:${horizontal ? edge.az : edge.ax}:${edge.nx}:${edge.nz}`
      const group = groups.get(key) ?? []
      group.push({ ...edge })
      groups.set(key, group)
    }
  const result: Edge[] = []
  for (const edges of groups.values()) {
    const horizontal = edges[0]!.az === edges[0]!.bz
    edges.sort((a, b) => (horizontal ? a.ax - b.ax : a.az - b.az))
    let run = edges[0]!
    for (const edge of edges.slice(1)) {
      if ((horizontal ? edge.ax - run.bx : edge.az - run.bz) < 0.00001) {
        run.bx = Math.max(run.bx, edge.bx)
        run.bz = Math.max(run.bz, edge.bz)
      } else {
        result.push(run)
        run = edge
      }
    }
    result.push(run)
  }
  return result
}
