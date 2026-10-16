import type { DungeonFloor, Position } from '@dungeon-atelier/core'

/** Presentation-only sconces: exposed camera-facing masonry, clear approaches, stable spacing. */
export function mountedTorchPlacements(floor: DungeonFloor) {
  const torches: Position[] = [],
    facings: Record<string, 'south' | 'east'> = {},
    clear = (x: number, y: number) => floor.tiles[y]?.[x] === 'floor',
    entrances = [...floor.doors.map((d) => d.position), ...floor.stairs.map((s) => s.position)],
    limit = Math.min(144, Math.ceil((floor.width * floor.height) / 50))
  let seed = 0
  for (const c of floor.seed) seed = (Math.imul(seed, 31) + c.charCodeAt(0)) >>> 0
  for (let y = 1; y < floor.height - 1; y++)
    for (let x = 1; x < floor.width - 1; x++) {
      if (floor.tiles[y]?.[x] !== 'wall' || torches.length >= limit) continue
      const south = clear(x, y + 1),
        east = clear(x + 1, y)
      if (!south && !east) continue
      if (((Math.imul(x + seed, 73856093) ^ Math.imul(y + 1, 19349663)) >>> 0) % 3 !== 0) continue
      if (entrances.some((p) => Math.abs(p.x - x) + Math.abs(p.y - y) <= 2)) continue
      if (torches.some((p) => Math.abs(p.x - x) + Math.abs(p.y - y) < 5)) continue
      torches.push({ x, y })
      facings[`${x},${y}`] = south ? 'south' : 'east'
    }
  return { torches, facings }
}
