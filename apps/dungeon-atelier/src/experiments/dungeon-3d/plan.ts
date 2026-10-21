import { DEFAULT_CONFIG, generateDungeon } from '@dungeon-atelier/core'
import type { DungeonFloor } from '@dungeon-atelier/core'
import {
  createArchitecturePlan,
  doorFacing,
  wallCapRects,
} from '../../features/dungeon/rendering/architecture-model.ts'
import {
  ancientFloorAssignments,
  DEFAULT_ANCIENT,
} from '../../features/dungeon/rendering/ancient-settings.ts'
import { mountedTorchPlacements } from '../../features/dungeon/rendering/mounted-placement.ts'
import { capBoundarySegments } from '../../features/dungeon/rendering/visual-foundation/plane-separation.ts'

export const BASE_WALL_HEIGHT = 2
export const DEFAULT_3D_SEED = 'side-door-readability-0'
export const WALL_HEIGHTS = [1, 1.25, 1.5, 1.75] as const
export function generatePrototypeFloor(seed: string, size = 32): DungeonFloor {
  const result = generateDungeon({
    ...DEFAULT_CONFIG,
    seed,
    width: size,
    height: size,
    targetRoomCount: size === 32 ? 8 : 24,
    maxRoomSize: size === 32 ? 7 : 12,
    roomShapeChance: 0.6,
    chamberBlockChance: 0.5,
    shortcutChance: 1,
  })
  if (!result.ok) throw new Error(result.errors.join(' '))
  return result.floor
}

/** Logical X/Y map directly to world X/Z; one tile is one world unit. */
export function planDungeon3D(source: DungeonFloor, revealSecrets = false) {
  const architecture = createArchitecturePlan(source, { revealSecrets }),
    floor = architecture.floor,
    assignments = ancientFloorAssignments(floor, DEFAULT_ANCIENT),
    walls = architecture.walls.map((wall) => ({
      ...wall,
      rects: wallCapRects(wall.mask, wall.cornerFill, 32).map((r) => ({
        x: wall.x + r.x / 32,
        z: wall.y + r.y / 32,
        width: r.width / 32,
        depth: r.height / 32,
      })),
      edges: capBoundarySegments(wallCapRects(wall.mask, wall.cornerFill, 32)).map((e) => ({
        ax: wall.x + e.ax / 32,
        az: wall.y + e.ay / 32,
        bx: wall.x + e.bx / 32,
        bz: wall.y + e.by / 32,
        nx: e.ax === e.bx ? (e.light ? -1 : 1) : 0,
        nz: e.ay === e.by ? (e.light ? -1 : 1) : 0,
      })),
    })),
    doors = floor.doors.map((door) => {
      const facing = doorFacing(floor, door)
      return {
        ...door,
        facing,
        x: door.position.x + 0.5,
        z: door.position.y + 0.5,
        rotation: { south: 0, north: Math.PI, east: Math.PI / 2, west: -Math.PI / 2 }[facing],
      }
    }),
    tiles = floor.tiles.flatMap((row, y) =>
      row.flatMap((tile, x) =>
        tile === 'wall'
          ? []
          : [
              {
                x,
                z: y,
                material: assignments.get(y * floor.width + x) ?? DEFAULT_ANCIENT.floor,
                down: floor.stairs.some(
                  (s) => s.direction === 'down' && s.position.x === x && s.position.y === y,
                ),
              },
            ],
      ),
    )
  return { floor, walls, doors, tiles, mounts: mountedTorchPlacements(floor), stairs: floor.stairs }
}
export type Dungeon3DPlan = ReturnType<typeof planDungeon3D>

/** Door heads and neighboring wall caps must agree on which edges are actually exposed. */
export function createCapOccupancy(plan: Dungeon3DPlan, cutaway = false) {
  const walls = new Map(plan.walls.map((w) => [`${w.x},${w.y}`, w.rects])),
    heads = plan.doors.filter((d) => !cutaway || d.type === 'secret')
  return (x: number, z: number) => {
    if (
      walls
        .get(`${Math.floor(x)},${Math.floor(z)}`)
        ?.some(
          (r) =>
            x >= r.x - 1e-6 &&
            x <= r.x + r.width + 1e-6 &&
            z >= r.z - 1e-6 &&
            z <= r.z + r.depth + 1e-6,
        )
    )
      return true
    return heads.some((d) => {
      const dx = x - d.x,
        dz = z - d.z,
        c = Math.cos(d.rotation),
        s = Math.sin(d.rotation)
      return Math.abs(c * dx - s * dz) <= 0.5 + 1e-6 && Math.abs(s * dx + c * dz) <= 0.3125 + 1e-6
    })
  }
}

/** Appearance-only variation never consumes the generator's random stream. */
export function appearanceHash(seed: string, x: number, z: number, detail = 0) {
  let hash = 2166136261
  for (const char of `${seed}:${x}:${z}:${detail}`)
    hash = Math.imul(hash ^ char.charCodeAt(0), 16777619)
  // Avalanche the sequential coordinate hash before choosing adjacent atlas cells.
  hash = Math.imul(hash ^ (hash >>> 16), 0x7feb352d)
  hash = Math.imul(hash ^ (hash >>> 15), 0x846ca68b)
  return ((hash ^ (hash >>> 16)) >>> 0) / 4294967295
}

/** Independent local choices over a smooth regional value field; never consumes core RNG state. */
export function masonryAppearance(seed: string, x: number, z: number, course: number) {
  const gx = Math.floor(x / 6),
    gz = Math.floor(z / 6),
    smooth = (v: number) => v * v * (3 - 2 * v),
    sx = smooth(x / 6 - gx),
    sz = smooth(z / 6 - gz),
    mix = (a: number, b: number, t: number) => a + (b - a) * t,
    region = mix(
      mix(appearanceHash(seed, gx, gz, 101), appearanceHash(seed, gx + 1, gz, 101), sx),
      mix(appearanceHash(seed, gx, gz + 1, 101), appearanceHash(seed, gx + 1, gz + 1, 101), sx),
      sz,
    ),
    tone = appearanceHash(seed, x, z, course + 211),
    atlas = appearanceHash(seed, x, z, course + 307),
    depth = appearanceHash(seed, x, z, course + 401)
  return {
    atlas: Math.min(15, Math.floor(atlas * 16)),
    tint: 0.94 + region * 0.08 + (tone - 0.5) * 0.045,
    relief: 0.016 + depth * 0.01,
    region,
  }
}

/** A majority of neutral worn stones, with independent soil, moss and fracture variants. */
export function capAppearance(seed: string, x: number, z: number) {
  const choice = appearanceHash(seed, x, z, 911),
    kind = choice < 0.55 ? 0 : choice < 0.77 ? 1 : choice < 0.89 ? 2 : 3,
    row = Math.min(3, Math.floor(appearanceHash(seed, x, z, 919) * 4)),
    turn = Math.min(7, Math.floor(appearanceHash(seed, x, z, 929) * 8))
  return { atlas: row * 4 + kind, turn, kind }
}
