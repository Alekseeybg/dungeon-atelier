import { ROOM_DESIGNS } from '../models/dungeon.js'
import type { Door, GenerationConfig, Position, Room, RoomDesign } from '../models/dungeon.js'
import type { createSeededRandom } from '../utilities/random.js'
type Random = ReturnType<typeof createSeededRandom>

/** A footprint stays connected and reaches all four edges of its bounding rectangle. */
export function shapeRoom(room: Room, random: Random, chance: number, designs: RoomDesign[]) {
  if (random.next() >= chance) {
    room.shape = 'rectangle'
    return
  }
  const eligible = ROOM_DESIGNS.filter(
    (design) =>
      designs.includes(design.value) &&
      Math.min(room.width, room.height) >= design.minSide &&
      Math.max(room.width, room.height) >= design.minLength,
  )
  const weighted = eligible.flatMap((design) =>
    Array.from({ length: design.value === 'l-shaped' ? 3 : 2 }, () => design.value),
  )
  if (!weighted.length) {
    room.shape = 'rectangle'
    return
  }
  const shape = weighted[random.integer(0, weighted.length - 1)]
  room.shape = shape
  const flipX = random.next() < 0.5,
    flipY = random.next() < 0.5
  const horizontal = random.next() < 0.5
  const w = room.width,
    h = room.height
  room.floorCells = []
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const u = flipX ? w - 1 - x : x,
        v = flipY ? h - 1 - y : y
      let keep = false
      switch (shape) {
        case 'l-shaped':
          keep = !(u < Math.floor(w / 2) && v < Math.floor(h / 2))
          break
        case 't-shaped':
          keep = horizontal
            ? u < Math.max(1, Math.floor(w / 3)) ||
              Math.abs(v - Math.floor(h / 2)) < Math.max(1, Math.floor(h / 3))
            : v < Math.max(1, Math.floor(h / 3)) ||
              Math.abs(u - Math.floor(w / 2)) < Math.max(1, Math.floor(w / 3))
          break
        case 'cross-shaped':
          keep =
            (u >= Math.floor(w / 3) && u < w - Math.floor(w / 3)) ||
            (v >= Math.floor(h / 3) && v < h - Math.floor(h / 3))
          break
        case 'alcoved': {
          const across = w < h || (w === h && !horizontal) ? u : v
          const along = w < h || (w === h && !horizontal) ? v : u
          const breadth = Math.min(w, h),
            length = Math.max(w, h)
          keep = (across > 0 && across < breadth - 1) || (along % 2 === 0 && along < length - 1)
          break
        }
        case 'u-shaped': {
          const across = horizontal ? v : u,
            along = horizontal ? u : v
          const breadth = horizontal ? h : w,
            length = horizontal ? w : h
          const arm = Math.max(1, Math.floor(breadth / 3)),
            base = Math.max(1, Math.floor(length / 3))
          keep = across < arm || across >= breadth - arm || along >= length - base
          break
        }
        case 'chamfered':
          keep = Math.min(u, w - 1 - u) + Math.min(v, h - 1 - v) >= Math.floor(Math.min(w, h) / 3)
          break
      }
      if (keep) room.floorCells.push({ x, y })
    }
}

export interface ChamberBlueprint {
  width: number
  height: number
  orientation: Door['orientation']
  rooms: { x: number; y: number; width: number; height: number }[]
  corridorCells: Position[]
  entrances: { position: Position; roomIndex: number; orientation: Door['orientation'] }[]
}

/** Repeated paired chambers count individually; their shared spine is corridor terrain. */
export function chamberBlueprint(
  config: GenerationConfig,
  random: Random,
): ChamberBlueprint | undefined {
  const candidates: { size: number; rows: number; rotate: boolean }[] = []
  for (
    let size = config.minRoomSize;
    size <= Math.min(config.maxRoomSize, config.minRoomSize + 2);
    size++
  )
    for (const rows of [2, 3])
      for (const rotate of [false, true]) {
        const width = size * 2 + 5,
          height = rows * (size + 1) + 1
        if (
          rows * 2 <= config.targetRoomCount &&
          (rotate ? height : width) <= config.width - 6 &&
          (rotate ? width : height) <= config.height - 6
        )
          candidates.push({ size, rows, rotate })
      }
  if (!candidates.length) return
  const { size, rows, rotate } = candidates[random.integer(0, candidates.length - 1)]
  const width = size * 2 + 5,
    height = rows * (size + 1) + 1,
    spine = size + 2
  const transform = (p: Position): Position => (rotate ? { x: height - 1 - p.y, y: p.x } : p)
  const blueprint: ChamberBlueprint = {
    width: rotate ? height : width,
    height: rotate ? width : height,
    orientation: rotate ? 'east-west' : 'north-south',
    rooms: [],
    corridorCells: [],
    entrances: [],
  }
  const corridor = new Map<string, Position>()
  const addCorridor = (p: Position) => {
    const q = transform(p)
    corridor.set(`${q.x},${q.y}`, q)
  }
  for (let y = 0; y < height; y++) addCorridor({ x: spine, y })
  for (let row = 0; row < rows; row++) {
    const y = 1 + row * (size + 1),
      entryY = y + Math.floor(size / 2)
    for (const side of [0, 1]) {
      const x = side ? size + 5 : 0
      const top = rotate ? { x: height - y - size, y: x } : { x, y }
      const roomIndex = blueprint.rooms.length
      blueprint.rooms.push({ ...top, width: size, height: size })
      blueprint.entrances.push({
        position: transform({ x: side ? size + 4 : size, y: entryY }),
        roomIndex,
        orientation: rotate ? 'north-south' : 'east-west',
      })
    }
    for (let x = size + 1; x <= size + 3; x++) addCorridor({ x, y: entryY })
  }
  blueprint.corridorCells = [...corridor.values()].sort((a, b) => a.y - b.y || a.x - b.x)
  return blueprint
}
