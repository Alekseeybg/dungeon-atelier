import type { DungeonFloor, Position, Staircase } from '@dungeon-atelier/core'
import {
  createDimensionalPlan,
  wallCapRects,
  wallEastSegments,
  wallFrontSegments,
} from '../dimensional-model.ts'
import type { DimensionalPlan } from '../dimensional-model.ts'
import { FOUNDATION, doorSurface, project } from './model.ts'
import { stairMarkerPlacement } from './finishing-model.ts'
import type { StairMarkerBox } from './finishing-model.ts'
import {
  projectedRectangle as rect,
  projectedFace as face,
  convexOverlap,
} from './projected-geometry.ts'

interface Architecture extends Position {
  planes: Position[][]
}
const key = (x: number, y: number) => [x, y].join(',')

/** Matches the plaque's floor transform or its fitted vertical wall mounting. */
export function stairMarkerPoint(box: StairMarkerBox, dx = box.width / 2, dy = box.height / 2) {
  const p = project(box.x + dx, box.y, box.plane === 'wall' ? 1 : 0.035)
  return { x: p.x, y: p.y + dy * (box.plane === 'wall' ? 1 : FOUNDATION.depth) }
}
function markerOutline(box: StairMarkerBox, margin = 0) {
  const p = stairMarkerPoint(box, 0, 0),
    x = p.x - margin,
    y = p.y - margin,
    width = box.width + margin * 2,
    height = box.height * (box.plane === 'wall' ? 1 : FOUNDATION.depth) + margin * 2
  return [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height },
  ]
}
function flightOutline(stair: Staircase) {
  const p = stair.position,
    up = stair.direction === 'up'
  return rect(p.x * 32 - (up ? 3 : 0), p.y * 32 - (up ? 17 : 0), up ? 35 : 32, up ? 49 : 32)
}
function architecturePlanes(plan: DimensionalPlan): Architecture[] {
  const architecture = plan.walls.map((w) => {
    const x = w.x * 32,
      y = w.y * 32
    return {
      x: w.x,
      y: w.y,
      planes: [
        ...wallCapRects(w.mask, w.cornerFill, 32).map((r) =>
          rect(x + r.x, y + r.y, r.width, r.height, 1),
        ),
        ...wallFrontSegments(w.mask, w.cornerFill, 32).map((e) =>
          face({ x: x + e.x, y: y + e.y }, { x: x + e.x + e.width, y: y + e.y }),
        ),
        ...wallEastSegments(w.mask, w.cornerFill, 32).map((e) =>
          face({ x: x + e.x, y: y + e.y }, { x: x + e.x, y: y + e.y + e.height }),
        ),
      ],
    }
  })
  for (const d of plan.doors) {
    const s = doorSurface(d.position, d.orientation === 'north-south' ? 'north' : 'west'),
      mask = d.orientation === 'north-south' ? 10 : 5
    architecture.push({
      ...d.position,
      planes: [
        face(s.a, s.b),
        ...wallCapRects(mask, 0, 32).map((r) =>
          rect(d.position.x * 32 + r.x, d.position.y * 32 + r.y, r.width, r.height, 1),
        ),
      ],
    })
  }
  return architecture
}
/** Search only the same connected floor approach; never cross a door to place a level sign. */
function nearbyApproaches(floor: DungeonFloor, start: Position) {
  const distances = new Map<string, number>([[key(start.x, start.y), 0]]),
    queue = [start]
  for (const p of queue) {
    const distance = distances.get(key(p.x, p.y))!
    if (distance === 3) continue
    for (const [dx, dy] of [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ] as const) {
      const x = p.x + dx,
        y = p.y + dy,
        k = key(x, y)
      if (floor.tiles[y]?.[x] !== 'floor' || distances.has(k)) continue
      distances.set(k, distance + 1)
      queue.push({ x, y })
    }
  }
  return distances
}
function wallMarker(
  floor: DungeonFloor,
  plan: DimensionalPlan,
  stair: Staircase,
  architecture: Architecture[],
  blocked: (area: Position[]) => boolean,
): StairMarkerBox | undefined {
  // One-cell horizontal aisles cannot expose a full floor plaque below foreground caps.
  // Mount the same brass sign on receiving masonry rather than painting over the treads.
  const approaches = nearbyApproaches(floor, stair.position),
    targets = plan.walls
      .filter((w) => w.exposed & 4 && approaches.has(key(w.x, w.y + 1)))
      .sort(
        (a, b) =>
          approaches.get(key(a.x, a.y + 1))! - approaches.get(key(b.x, b.y + 1))! ||
          Math.abs(a.x - stair.position.x) - Math.abs(b.x - stair.position.x),
      )
  for (const w of targets) {
    const segment = wallFrontSegments(w.mask, w.cornerFill, 32).find(
      (s) => s.y === 26 && s.width >= 18,
    )
    if (!segment) continue
    const box: StairMarkerBox = {
        x: w.x * 32 + segment.x + segment.width / 2 - 7,
        y: w.y * 32 + 26 + 4 / FOUNDATION.depth,
        width: 14,
        height: 18,
        plane: 'wall',
      },
      area = markerOutline(box)
    if (blocked(area)) continue
    if (
      architecture.some(
        (other) =>
          (other.x !== w.x || other.y !== w.y) && other.planes.some((p) => convexOverlap(area, p)),
      )
    )
      continue
    return box
  }
  return undefined
}

/** Clear projected cap/face footprints as well as logical terrain. No floor mutation. */
export function projectedStairMarkers(
  floor: DungeonFloor,
  plan = createDimensionalPlan(floor, { revealSecrets: true }),
) {
  const architecture = architecturePlanes(plan),
    flights = floor.stairs.map(flightOutline),
    markers = new Map<string, StairMarkerBox>()
  const blocked = (area: Position[]) =>
    flights.some((p) => convexOverlap(area, p)) ||
    [...markers.values()].some((m) => convexOverlap(area, markerOutline(m)))
  for (const stair of floor.stairs) {
    const nearby = architecture.filter(
        (a) => Math.abs(a.x - stair.position.x) <= 2 && Math.abs(a.y - stair.position.y) <= 2,
      ),
      box =
        stairMarkerPlacement(floor, stair, (b) => {
          // Safety margin for the chiseled facet, raised coping and joint antialiasing.
          const area = rect(b.x - 1.5, b.y - 1.5, b.width + 3, b.height + 3, 0.035)
          return !blocked(area) && !nearby.some((a) => a.planes.some((p) => convexOverlap(area, p)))
        }) ?? wallMarker(floor, plan, stair, architecture, blocked)
    if (box) markers.set(stair.id, box)
  }
  return markers
}
