import type { DungeonFloor, Position } from '@dungeon-atelier/core'
import { createMaterialPlan } from './material-rules'
import type { RoomFinish } from './material-rules'
import {
  createDimensionalPlan,
  dimensionalLightCells,
  dimensionalProjection,
  visualHash,
  visualOpen,
  WALL,
} from './dimensional-model'
import type { DimensionalOptions, DimensionalPlan } from './dimensional-model'
import { drawDimensionalSprite, getDimensionalAtlas } from './dimensional-sprites'
import type { DimensionalAtlas } from './dimensional-sprites'
import { drawCorridorWear, drawStairSurround, drawStoneVoid } from './stone-atmosphere'
import { TILE_SIZE as SIZE } from './tile-size'
import type { WalkState } from '../exploration/useDungeonWalk'

interface Scene {
  plan: DimensionalPlan
  atlas: DimensionalAtlas
  materials: ReturnType<typeof createMaterialPlan>
  openDoors: ReadonlySet<string>
}
const scenes = new WeakMap<HTMLCanvasElement, Scene>()

function floorTile(context: CanvasRenderingContext2D, scene: Scene, x: number, y: number) {
  const { materials, atlas, plan } = scene,
    material = materials.at(x, y),
    owner = materials.roomAt(x, y)
  const feature =
    plan.floor.tiles[y]?.[x] === 'door' ||
    plan.floor.stairs.some((stair) => stair.position.x === x && stair.position.y === y)
  const paving =
    material.kind === 'threshold' && !feature ? (owner?.kind ?? 'corridor') : material.kind
  const kind =
    paving === 'mosaic'
      ? 'ornament'
      : paving === 'slab'
        ? 'slab'
        : paving === 'corridor-slab'
          ? 'repair'
          : paving === 'corridor'
            ? 'corridor'
            : paving === 'threshold'
              ? 'threshold'
              : 'flagstone'
  const localX = x - (owner?.room.x ?? 0),
    localY = y - (owner?.room.y ?? 0)
  const phase = visualHash(owner?.room.x ?? 0, owner?.room.y ?? 0, plan.seed)
  const variant =
    ((Math.floor(localX / 2) + (phase % 4)) % 4) +
    ((Math.floor(localY / 2) + ((phase >>> 3) % 4)) % 4) * 4
  const sprite = atlas.sprites.get(`floor.${kind}.${variant}`)
  if (!sprite) throw new Error(`Missing dimensional floor: ${kind}`)
  context.drawImage(
    atlas.image,
    sprite.source.x + (localX % 2) * SIZE,
    sprite.source.y + (localY % 2) * SIZE,
    SIZE,
    SIZE,
    x * SIZE,
    y * SIZE,
    SIZE,
    SIZE,
  )
  if (material.condition !== 'clean')
    drawDimensionalSprite(
      context,
      atlas,
      `detail.${material.condition}.${material.variant % 4}`,
      x * SIZE,
      y * SIZE,
    )
  if (!owner && kind !== 'threshold') drawCorridorWear(context, plan.floor, x, y)
  if (material.kind === 'corridor-slab') {
    context.strokeStyle = '#152028b3'
    context.lineWidth = 1
    for (const [dx, dy] of [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ] as const) {
      const neighbor = materials.at(x + dx, y + dy)
      if (neighbor.kind !== 'corridor') continue
      context.beginPath()
      if (dy) {
        context.moveTo(x * SIZE, y * SIZE + (dy > 0 ? SIZE : 0))
        context.lineTo((x + 1) * SIZE, y * SIZE + (dy > 0 ? SIZE : 0))
      } else {
        context.moveTo(x * SIZE + (dx > 0 ? SIZE : 0), y * SIZE)
        context.lineTo(x * SIZE + (dx > 0 ? SIZE : 0), (y + 1) * SIZE)
      }
      context.stroke()
    }
  }
}

function roomFinish(context: CanvasRenderingContext2D, scene: Scene, finish: RoomFinish) {
  if (finish.role === 'chamber' || finish.role === 'damp') return
  const { floor } = scene.plan,
    accented = finish.role === 'template' || finish.role === 'ceremonial'
  context.save()
  context.lineJoin = 'round'
  for (const key of finish.cells) {
    const x = key % floor.width,
      y = Math.floor(key / floor.width),
      px = x * SIZE,
      py = y * SIZE
    const north = !visualOpen(floor.tiles[y - 1]?.[x]),
      south = !visualOpen(floor.tiles[y + 1]?.[x]),
      west = !visualOpen(floor.tiles[y]?.[x - 1]),
      east = !visualOpen(floor.tiles[y]?.[x + 1])
    context.beginPath()
    for (const dy of [-1, 1])
      if (dy < 0 ? north : south) {
        const yy = py + (dy < 0 ? 5 : 27)
        context.moveTo(px + (west ? 5 : 0), yy)
        context.lineTo(px + (east ? 27 : 32), yy)
      }
    for (const dx of [-1, 1])
      if (dx < 0 ? west : east) {
        const xx = px + (dx < 0 ? 5 : 27)
        context.moveTo(xx, py + (north ? 5 : 0))
        context.lineTo(xx, py + (south ? 27 : 32))
      }
    context.lineWidth = 4
    context.strokeStyle = '#131d238c'
    context.stroke()
    context.lineWidth = 1
    context.strokeStyle = accented ? '#b69e697a' : '#b7b7a24d'
    context.stroke()
  }
  const cx = finish.room.x + Math.floor(finish.room.width / 2),
    cy = finish.room.y + Math.floor(finish.room.height / 2)
  const fits =
    [-1, 0, 1].every((dy) =>
      [-1, 0, 1].every((dx) => finish.cells.has((cy + dy) * floor.width + cx + dx)),
    ) &&
    !floor.stairs.some(
      (stair) => Math.abs(stair.position.x - cx) <= 1 && Math.abs(stair.position.y - cy) <= 1,
    )
  if (fits && (accented || finish.role === 'hub')) {
    context.globalAlpha = 0.87
    drawDimensionalSprite(
      context,
      scene.atlas,
      'inlay.center',
      (cx + 0.5) * SIZE,
      (cy + 0.5) * SIZE,
    )
  }
  context.restore()
}
function contactShadows(context: CanvasRenderingContext2D, scene: Scene, floorPath: Path2D) {
  context.save()
  context.clip(floorPath)
  for (const wall of scene.plan.walls) {
    const x = wall.x * SIZE,
      y = wall.y * SIZE
    if (wall.exposed & WALL.south) {
      const shade = context.createLinearGradient(x, y + SIZE, x, y + SIZE + SIZE * 0.18)
      shade.addColorStop(0, '#02070f99')
      shade.addColorStop(0.4, '#02070f50')
      shade.addColorStop(1, '#02070f00')
      context.fillStyle = shade
      context.fillRect(x - 1, y + SIZE, SIZE + 2, SIZE * 0.18)
    }
    for (const [bit, dx] of [
      [WALL.east, 1],
      [WALL.west, -1],
    ] as const) {
      if (!(wall.exposed & bit)) continue
      const edge = x + (dx === 1 ? SIZE : 0),
        shade = context.createLinearGradient(edge, 0, edge + dx * SIZE * 0.2, 0)
      shade.addColorStop(0, '#040b149c')
      shade.addColorStop(1, '#040b1400')
      context.fillStyle = shade
      context.fillRect(dx === 1 ? edge : edge - SIZE * 0.2, y, SIZE * 0.2, SIZE)
    }
  }
  context.restore()
}
function light(
  context: CanvasRenderingContext2D,
  scene: Scene,
  torch: Position,
  openDoors: ReadonlySet<string>,
) {
  const { rise } = dimensionalProjection(SIZE),
    cells = dimensionalLightCells(scene.plan, torch, openDoors),
    footprint = new Path2D()
  for (const p of cells.floors) footprint.rect(p.x * SIZE, p.y * SIZE, SIZE, SIZE)
  for (const p of cells.walls) footprint.rect(p.x * SIZE, p.y * SIZE - rise, SIZE, SIZE + rise)
  context.save()
  context.clip(footprint)
  context.globalCompositeOperation = 'screen'
  const x = torch.x * SIZE + SIZE * 0.5,
    y = torch.y * SIZE + SIZE * 0.65
  const falloff = context.createRadialGradient(x, y, 1, x, y, SIZE * 3.7)
  falloff.addColorStop(0, '#ffd08bc0')
  falloff.addColorStop(0.12, '#ffa5329c')
  falloff.addColorStop(0.36, '#b35f1c45')
  falloff.addColorStop(0.7, '#8052250b')
  falloff.addColorStop(1, '#80522500')
  context.fillStyle = falloff
  context.fillRect(x - SIZE * 4, y - SIZE * 4, SIZE * 8, SIZE * 8)
  // A small directional bounce warms the wall face separately from the floor wash.
  const bounce = context.createLinearGradient(x, y - rise, x, y + SIZE * 0.4)
  bounce.addColorStop(0, '#f4bd6c00')
  bounce.addColorStop(0.5, '#f4bd6c2a')
  bounce.addColorStop(1, '#f4bd6c00')
  context.fillStyle = bounce
  context.fillRect(x - SIZE * 0.55, y - rise, SIZE * 1.1, SIZE)
  context.restore()
}

/** Static layered scene. Coordinates remain unprojected; only architectural sprites rise north. */
export function renderDimensional(
  context: CanvasRenderingContext2D,
  source: DungeonFloor,
  grid: boolean,
  options: DimensionalOptions = {},
  atlas = getDimensionalAtlas(SIZE),
) {
  const plan = createDimensionalPlan(source, options),
    openDoors = new Set(options.openDoorIds ?? []),
    scene: Scene = { plan, atlas, materials: createMaterialPlan(plan.floor), openDoors }
  const { floor } = plan,
    { rise } = dimensionalProjection(SIZE),
    floorPath = new Path2D()
  drawStoneVoid(context, floor.width * SIZE, floor.height * SIZE)
  for (let y = 0; y < floor.height; y++)
    for (let x = 0; x < floor.width; x++) {
      if (!visualOpen(floor.tiles[y]?.[x])) continue
      floorTile(context, scene, x, y)
      floorPath.rect(x * SIZE, y * SIZE, SIZE, SIZE)
    }
  for (const finish of scene.materials.rooms) roomFinish(context, scene, finish)
  for (const stair of floor.stairs) {
    if (
      [-1, 0, 1].every((dy) =>
        [-1, 0, 1].every((dx) =>
          visualOpen(floor.tiles[stair.position.y + dy]?.[stair.position.x + dx]),
        ),
      )
    )
      drawStairSurround(context, stair.position)
    drawDimensionalSprite(
      context,
      atlas,
      `stairs.${stair.direction}`,
      stair.position.x * SIZE,
      stair.position.y * SIZE,
    )
  }
  contactShadows(context, scene, floorPath)
  // Shared floor baseline order handles overhangs at turns, ends, and portal jambs.
  const architecture = [
    ...plan.walls.map((wall) => ({ x: wall.x, y: wall.y, wall })),
    ...plan.doors.map((door) => ({ x: door.position.x, y: door.position.y, door })),
  ]
  architecture.sort((a, b) => a.y - b.y || Number('door' in a) - Number('door' in b) || a.x - b.x)
  for (const item of architecture) {
    if ('wall' in item) {
      const wall = item.wall,
        mask = wall.mask
      drawDimensionalSprite(
        context,
        atlas,
        `wall.${mask}.${wall.cornerFill}.${wall.variant}`,
        item.x * SIZE,
        item.y * SIZE,
      )
      const material = scene.materials.at(item.x, item.y)
      if (material.condition === 'mossy' || material.condition === 'cracked') {
        context.save()
        context.globalAlpha = 0.45
        drawDimensionalSprite(
          context,
          atlas,
          `detail.${material.condition}.${wall.variant}`,
          item.x * SIZE,
          item.y * SIZE - rise,
        )
        context.restore()
      }
    } else {
      const door = item.door,
        state = door.type === 'secret' ? 'secret' : openDoors.has(door.id) ? 'open' : 'closed'
      drawDimensionalSprite(
        context,
        atlas,
        `door.${door.orientation}.${state}`,
        item.x * SIZE,
        item.y * SIZE,
      )
    }
  }
  for (const torch of plan.torches) light(context, scene, torch, openDoors)
  for (const torch of plan.torches)
    drawDimensionalSprite(context, atlas, 'torch.sconce', torch.x * SIZE, torch.y * SIZE)
  if (grid) {
    context.save()
    context.clip(floorPath)
    context.strokeStyle = '#c8d5d32b'
    context.lineWidth = 1
    context.beginPath()
    for (let x = 0; x <= floor.width; x++) {
      context.moveTo(x * SIZE + 0.5, 0)
      context.lineTo(x * SIZE + 0.5, floor.height * SIZE)
    }
    for (let y = 0; y <= floor.height; y++) {
      context.moveTo(0, y * SIZE + 0.5)
      context.lineTo(floor.width * SIZE, y * SIZE + 0.5)
    }
    context.stroke()
    context.restore()
  }
  scenes.set(context.canvas, scene)
}

/** Restore only affected underfoot cells: unknown foreground caps cannot leak through fog.
 * The player's own cell receives the same cutaway, keeping the arrow clear at a raised wall. */
export function drawDimensionalWalkCutaway(
  context: CanvasRenderingContext2D,
  map: HTMLCanvasElement,
  walk: WalkState,
) {
  const scene = scenes.get(map)
  if (!scene || !walk.active) return
  const { floor } = scene.plan
  for (const key of walk.explored) {
    const x = key % floor.width,
      y = Math.floor(key / floor.width)
    if (!visualOpen(floor.tiles[y]?.[x])) continue
    const occluders = [
      [0, 1],
      [1, 0],
      [1, 1],
    ].flatMap(([dx, dy]) => {
      const nx = x + dx!,
        ny = y + dy!,
        other = ny * floor.width + nx
      return nx < floor.width &&
        ny < floor.height &&
        (scene.plan.wallKeys.has(other) || floor.tiles[ny]?.[nx] === 'door')
        ? [other]
        : []
    })
    if (!occluders.length) continue
    const underfoot = walk.position?.x === x && walk.position.y === y
    if (occluders.every((other) => walk.explored.has(other)) && !underfoot) continue
    context.save()
    context.beginPath()
    context.rect(x * SIZE, y * SIZE, SIZE, SIZE)
    context.clip()
    floorTile(context, scene, x, y)
    const room = scene.materials.roomAt(x, y)
    if (room) roomFinish(context, scene, room)
    const stair = floor.stairs.find((s) => s.position.x === x && s.position.y === y)
    if (stair)
      drawDimensionalSprite(context, scene.atlas, `stairs.${stair.direction}`, x * SIZE, y * SIZE)
    for (const torch of scene.plan.torches)
      if (Math.abs(torch.x - x) + Math.abs(torch.y - y) <= 6)
        light(context, scene, torch, scene.openDoors)
    context.restore()
  }
}
