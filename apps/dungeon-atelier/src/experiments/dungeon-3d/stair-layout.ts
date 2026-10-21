import type { Dungeon3DPlan } from './plan.ts'

export interface StairLayout {
  id: string
  direction: 'up' | 'down'
  form: 'switchback' | 'straight'
  upperWall: boolean
  x: number
  z: number
  rotation: number
  width: number
  length: number
  bounds: { x: number; z: number; width: number; depth: number }
}

/** Cardinal transform shared by floor cutting, masonry construction and inspection. */
export function stairPoint(s: StairLayout, x: number, z: number) {
  const c = Math.round(Math.cos(s.rotation)),
    n = Math.round(Math.sin(s.rotation))
  return { x: s.x + c * x + n * z, z: s.z - n * x + c * z }
}

/** Presentation only: reserve a two-flight stair bay without moving any logical features. */
export function planStaircases(plan: Dungeon3DPlan): StairLayout[] {
  const result: StairLayout[] = []
  for (const stair of plan.stairs) {
    const room = plan.floor.rooms.find((r) => r.id === stair.roomId),
      floor = (x: number, z: number) =>
        plan.floor.tiles[z]?.[x] === 'floor' &&
        (!room ||
          (x >= room.x && z >= room.y && x < room.x + room.width && z < room.y + room.height)),
      primary = [{ x: stair.position.x + 0.5, z: stair.position.y + 0.5 }],
      alternatives = plan.tiles
        .filter((t) => floor(t.x, t.z))
        .map((t) => ({ x: t.x + 0.5, z: t.z + 0.5 }))
    let best: StairLayout | undefined,
      bestScore = -Infinity
    // A logical stair can be in a one-cell arm of an irregular room. In that case,
    // reserve the nearest usable bay in the same room; the core data stays intact.
    for (const anchors of [primary, alternatives]) {
      for (const anchorPosition of anchors)
        for (const [width, length] of [
          [2.05, 3.4],
          [1.9, 3],
          [1.7, 2.7],
          [1.5, 2.4],
          [1.6, 1.9],
          [0.92, 4.2],
          [0.92, 3.6],
          [0.92, 3],
          [0.92, 2.4],
          [0.92, 1.9],
        ]) {
          if (width === undefined || length === undefined) continue
          for (let turn = 0; turn < 4; turn++) {
            for (const along of [0.25, 0.36, 0.5, 0.64, 0.75]) {
              const s: StairLayout = {
                id: stair.id,
                direction: stair.direction,
                form: width < 1 ? 'straight' : 'switchback',
                upperWall: false,
                x: 0,
                z: 0,
                rotation: (turn * Math.PI) / 2,
                width,
                length,
                bounds: { x: 0, z: 0, width: 0, depth: 0 },
              }
              const anchor = stairPoint(
                s,
                width * (s.form === 'straight' ? 0.5 : 0.25),
                length * along,
              )
              s.x = anchorPosition.x - anchor.x
              s.z = anchorPosition.z - anchor.z
              const baseX = s.x,
                baseZ = s.z,
                corners = [
                  stairPoint(s, 0, 0),
                  stairPoint(s, width, 0),
                  stairPoint(s, 0, length),
                  stairPoint(s, width, length),
                ],
                minX = Math.min(...corners.map((p) => p.x)),
                maxX = Math.max(...corners.map((p) => p.x)),
                minZ = Math.min(...corners.map((p) => p.z)),
                maxZ = Math.max(...corners.map((p) => p.z))
              for (const dx of [Math.round(minX) - minX, Math.round(maxX) - maxX])
                for (const dz of [Math.round(minZ) - minZ, Math.round(maxZ) - maxZ]) {
                  s.x = baseX + dx
                  s.z = baseZ + dz
                  const l = minX + dx,
                    r = maxX + dx,
                    t = minZ + dz,
                    b = maxZ + dz
                  s.bounds = { x: l, z: t, width: r - l, depth: b - t }
                  let valid = true,
                    contact = 0
                  for (let z = Math.floor(t + 1e-6); z < Math.ceil(b - 1e-6); z++)
                    for (let x = Math.floor(l + 1e-6); x < Math.ceil(r - 1e-6); x++)
                      if (!floor(x, z)) valid = false
                  if (!valid) continue
                  for (const door of plan.doors) {
                    const dx = Math.max(l - door.x, 0, door.x - r),
                      dz = Math.max(t - door.z, 0, door.z - b)
                    if (Math.hypot(dx, dz) < 0.4) valid = false
                  }
                  for (const other of result) {
                    const a = other.bounds
                    if (
                      l < a.x + a.width + 0.15 &&
                      r > a.x - 0.15 &&
                      t < a.z + a.depth + 0.15 &&
                      b > a.z - 0.15
                    )
                      valid = false
                  }
                  // Keep the entry open; prefer a wall at the back or beside the bay.
                  const entry = stairPoint(s, width * (s.form === 'straight' ? 0.5 : 0.25), -0.3),
                    sideEntry = stairPoint(s, -0.2, 0.25),
                    accessible = (p: { x: number; z: number }) =>
                      ['floor', 'door'].includes(
                        plan.floor.tiles[Math.floor(p.z)]?.[Math.floor(p.x)] ?? '',
                      )
                  if (!accessible(entry) && !accessible(sideEntry)) valid = false
                  for (const p of [
                    stairPoint(s, -0.25, length * 0.5),
                    stairPoint(s, width + 0.25, length * 0.5),
                    stairPoint(s, width * 0.5, length + 0.25),
                  ])
                    if (plan.floor.tiles[Math.floor(p.z)]?.[Math.floor(p.x)] === 'wall') contact++
                  const exit =
                    s.form === 'switchback'
                      ? stairPoint(s, width + 0.22, 0.3)
                      : stairPoint(s, width * 0.5, length + 0.22)
                  s.upperWall =
                    plan.floor.tiles[Math.floor(exit.z)]?.[Math.floor(exit.x)] === 'wall'
                  const distance = Math.hypot(
                    anchorPosition.x - primary[0]!.x,
                    anchorPosition.z - primary[0]!.z,
                  )
                  const score =
                    width * length * 2 +
                    (s.form === 'switchback' ? 6 : 0) +
                    contact * 1.3 +
                    (s.upperWall && s.direction === 'up' ? 18 : 0) -
                    Math.abs(along - 0.5) -
                    distance * 3
                  if (valid && score > bestScore) {
                    best = { ...s, bounds: { ...s.bounds } }
                    bestScore = score
                  }
                }
            }
          }
        }
    }
    if (!best) throw new Error(`No architectural stair bay fits ${stair.id}`)
    result.push(best)
  }
  return result
}

export function stairLevels(s: StairLayout, wallHeight: number) {
  const floor = 0.033,
    destination = s.direction === 'up' ? wallHeight + 0.085 : -wallHeight,
    landing = Math.min(0.65, s.length * 0.22),
    run = s.length - landing * 2,
    count = Math.max(
      5,
      Math.ceil(Math.abs(destination - floor) / (s.form === 'straight' ? 1 : 2) / 0.18),
    )
  return {
    floor,
    destination,
    middle: (floor + destination) / 2,
    landing,
    run,
    count,
    rise: (destination - floor) / ((s.form === 'straight' ? 1 : 2) * count),
    going: run / count,
  }
}
