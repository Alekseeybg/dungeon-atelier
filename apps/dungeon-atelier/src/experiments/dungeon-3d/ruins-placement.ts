import { appearanceHash, type Dungeon3DPlan } from './plan.ts'
import { wallField } from './wall-wear.ts'
import type { WallRun } from './asset-model.ts'
import { ruinsCourses } from './ruins-courses.ts'

export type RuinsPool = 'wall' | 'straight' | 'corner' | 'transition'
export type RuinsWear = 'quiet' | 'medium' | 'strong' | 'hero'
export interface RuinsPlacement {
  atlas: number
  turn: number
  tint: number
  pool: RuinsPool
  wear: RuinsWear
  run: string
  grainScale?: number
}
const strong = (wear: RuinsWear) => wear === 'strong' || wear === 'hero'
const tier = (v: number): RuinsWear =>
  v < 0.57 ? 'quiet' : v < 0.95 ? 'medium' : v < 0.994 ? 'strong' : 'hero'
function atlas(pool: RuinsPool, wear: RuinsWear, variant: number) {
  const base = pool === 'corner' ? 8 : pool === 'transition' ? 16 : 0
  return (
    base +
    (wear === 'quiet'
      ? variant % 3
      : wear === 'medium'
        ? 3 + (variant % 3)
        : wear === 'strong'
          ? 6
          : 7)
  )
}
function macro(seed: string, x: number, z: number) {
  return 0.95 + wallField(seed, x / 8, 0, z / 8) * 0.07
}

/** Stair and doorway dressing comes from the wall quarry, with quieter wear at bearing edges. */
export function ruinsDressedStone(
  seed: string,
  x: number,
  y: number,
  z: number,
  role: 'tread' | 'riser' | 'frame',
): RuinsPlacement {
  const family = Math.floor(appearanceHash(seed, Math.floor(x / 4), Math.floor(z / 4), 9449) * 3),
    variant = Math.floor(appearanceHash(seed, x, z + y, 9683) * 3),
    wear = appearanceHash(seed, x, z + y, 9689) < 0.76 ? 'quiet' : 'medium',
    regional = 0.93 + wallField(seed, x / 7, y / 3, z / 7) * 0.12
  return {
    atlas: family * 8 + atlas('wall', wear, variant),
    turn: 0,
    tint: regional * (role === 'tread' ? 1.08 : 1),
    pool: 'wall',
    wear,
    run: `dressed:${Math.floor(x / 4)},${Math.floor(z / 4)}`,
    grainScale: 2,
  }
}

/** A run shares quarry and weathering zones; individual stones follow the coursed bond. */
export function planRuinsWallRun(seed: string, edge: WallRun, height: number) {
  const blocks = ruinsCourses(seed, edge, height),
    horizontal = edge.az === edge.bz,
    start = horizontal ? edge.ax : edge.az,
    end = horizontal ? edge.bx : edge.bz,
    face = horizontal ? edge.az : edge.ax,
    run = `${edge.ax},${edge.az}:${edge.bx},${edge.bz}:${edge.nx},${edge.nz}`,
    family = Math.floor(appearanceHash(seed, Math.floor(start / 4), face, 9449) * 3),
    marked: { x: number; y: number }[] = []
  let previous = -1
  return blocks.map((block) => {
    const along = (block.a + block.b) / 2,
      row = Math.round(block.low / (height / Math.max(1, Math.round(height / 0.34)))),
      group = Math.floor((along - start) / 3.2),
      patch = appearanceHash(
        seed,
        group + Math.floor(start / 3.2),
        Math.floor(face / 5) + Math.floor(row / 2),
        9451,
      )
    let wear = tier(patch)
    // Heavy defects never form matching vertical stacks or side-by-side stripes.
    if (
      strong(wear) &&
      (along - start < 1.2 ||
        end - along < 1.2 ||
        marked.some((p) => Math.hypot(p.x - along, (p.y - row) * 0.7) < 3.2))
    )
      wear = 'medium'
    if (wear === 'hero' && (end - start < 10 || appearanceHash(seed, start, face, 9461) < 0.92))
      wear = 'medium'
    if (strong(wear)) marked.push({ x: along, y: row })
    let variant = Math.floor(appearanceHash(seed, along, face + row, 9473 + family) * 3)
    let pick = family * 8 + atlas('wall', wear, variant)
    if (pick === previous && !strong(wear)) {
      variant = (variant + 1 + Math.floor(appearanceHash(seed, along, row, 9479) * 2)) % 3
      pick = family * 8 + atlas('wall', wear, variant)
    }
    previous = pick
    const x = horizontal ? along : face,
      z = horizontal ? face : along
    const placement: RuinsPlacement = {
      atlas: pick,
      turn: 0,
      tint: 0.91 + wallField(seed, x / 7, row / 6, z / 7) * 0.14,
      pool: 'wall',
      wear,
      run,
    }
    return { block, placement }
  })
}

/** Cap topology selects a pool first. Run wear is secondary; strong motifs have a global exclusion radius. */
export function planRuinsCaps(plan: Dungeon3DPlan) {
  const seed = plan.floor.seed,
    nodes = plan.walls
      .map((w) => ({ x: w.x, z: w.y, mask: w.mask, door: false }))
      .concat(plan.doors.map((d) => ({ x: d.position.x, z: d.position.y, mask: 0, door: true }))),
    byPosition = new Map(nodes.map((n) => [`${n.x},${n.z}`, n])),
    assigned = new Map<string, RuinsPlacement>(),
    marked: { x: number; z: number; wear: RuinsWear }[] = []
  nodes.sort((a, b) => a.z - b.z || a.x - b.x)
  for (const n of nodes) {
    const key = `${n.x},${n.z}`
    if (assigned.has(key)) continue
    const pool: RuinsPool =
        n.mask === 5 || n.mask === 10
          ? 'straight'
          : [3, 6, 12, 9].includes(n.mask)
            ? 'corner'
            : 'transition',
      horizontal = n.mask === 10,
      chain = [n]
    if (pool === 'straight') {
      for (const sign of [-1, 1]) {
        for (let step = 1; ; step++) {
          const next = byPosition.get(
            `${n.x + (horizontal ? step * sign : 0)},${n.z + (horizontal ? 0 : step * sign)}`,
          )
          if (!next || next.mask !== n.mask || next.door) break
          chain.push(next)
        }
      }
    }
    chain.sort((a, b) => a.z - b.z || a.x - b.x)
    const origin = chain[0]!,
      run = `${pool}:${origin.x},${origin.z}:${chain.length}`,
      family = Math.floor(appearanceHash(seed, origin.x, origin.z, 9511) * 3)
    chain.forEach((node, i) => {
      const group = Math.floor(i / 3),
        chance = appearanceHash(seed, origin.x + group, origin.z, 9517)
      let wear = tier(chance)
      if (pool === 'transition' || (pool === 'straight' && (i === 0 || i === chain.length - 1))) {
        if (strong(wear)) wear = 'medium'
      }
      if (
        wear === 'hero' &&
        (pool !== 'straight' ||
          chain.length < 12 ||
          appearanceHash(seed, origin.x, origin.z, 9521) < 0.9)
      )
        wear = 'medium'
      if (
        strong(wear) &&
        marked.some(
          (p) =>
            Math.hypot(p.x - node.x, p.z - node.z) <
            (wear === 'hero' || p.wear === 'hero' ? 10 : 4),
        )
      )
        wear = 'medium'
      if (strong(wear)) marked.push({ ...node, wear })
      const turn =
          pool === 'corner'
            ? Math.max(0, [3, 6, 12, 9].indexOf(node.mask))
            : pool === 'straight' && !horizontal
              ? 1
              : 0,
        placement: RuinsPlacement = {
          pool,
          wear,
          atlas: atlas(pool, wear, (family + i) % 3),
          turn,
          tint: macro(seed, node.x + 0.5, node.z + 0.5),
          run,
        }
      assigned.set(`${node.x},${node.z}`, placement)
    })
  }
  return assigned
}
