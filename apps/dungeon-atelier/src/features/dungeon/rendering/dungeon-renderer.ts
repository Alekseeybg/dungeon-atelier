import { isWalkable, roomCells } from '@dungeon-atelier/core'
import { createMaterialPlan } from './material-rules'
import type { DungeonFloor, Position } from '@dungeon-atelier/core'
import { stoneTile, tileHash } from './stone-tiles'
import { drawStoneDoor } from './stone-doors'
import { drawWallTorch } from './wall-torches'
import { TILE_SIZE } from './tile-size'
import type { MapStyle, MapRenderOptions } from './map-style'
import { MAP_BACKGROUND } from './map-style'
import { mapProjection } from './map-projection'
export { disposeMapCanvas } from './map-resources'
import { renderAncient } from './ancient-renderer'
import {
  drawCorridorWear,
  drawRoomFinish,
  drawStairSurround,
  drawStoneVoid,
  drawTorchLight,
} from './stone-atmosphere'

export { TILE_SIZE } from './tile-size'
export { MAP_STYLES, MAP_BACKGROUND } from './map-style'
export type { MapStyle, MapRenderOptions } from './map-style'

/** Sprite padding is presentation space; tile (0,0) keeps its original world coordinates. */
export function mapRenderBounds(floor: DungeonFloor, style: MapStyle) {
  const p = mapProjection(style)
  if (style === 'ancient')
    return {
      width: floor.width * p.width + p.padding * 2,
      height: floor.height * p.height + p.padding * 2,
      origin: { x: p.padding, y: p.padding },
      density: p.density,
    }
  return {
    width: floor.width * TILE_SIZE,
    height: floor.height * TILE_SIZE,
    origin: { x: 0, y: 0 },
    density: p.density,
  }
}

function seedHash(seed: string) {
  let hash = 2166136261
  for (let i = 0; i < seed.length; i++) hash = Math.imul(hash ^ seed.charCodeAt(i), 16777619)
  return hash >>> 0
}

function drawStairs(context: CanvasRenderingContext2D, x: number, y: number, up: boolean) {
  context.fillStyle = '#111713'
  context.fillRect(x + 3, y + 2, 26, 28)
  for (let step = 0; step < 6; step++) {
    const depth = up ? step : 5 - step
    const tone = 43 + depth * 12
    const inset = up ? 3 + (5 - step) : 3 + step
    context.fillStyle = `rgb(${tone + 7} ${tone + 8} ${tone})`
    context.fillRect(x + inset, y + 3 + step * 4, 32 - inset * 2, 4)
    context.fillStyle = '#c1bba24d'
    context.fillRect(x + inset, y + 3 + step * 4, 32 - inset * 2, 1)
    context.fillStyle = '#050a0999'
    context.fillRect(x + inset, y + 6 + step * 4, 32 - inset * 2, 1)
  }
  context.strokeStyle = '#888773'
  context.lineWidth = 2
  context.strokeRect(x + 2, y + 2, 28, 28)
  context.fillStyle = up ? '#a7d7c4' : '#e1b574'
  context.beginPath()
  context.moveTo(x + 27, y + (up ? 4 : 10))
  context.lineTo(x + 24, y + (up ? 10 : 4))
  context.lineTo(x + 30, y + (up ? 10 : 4))
  context.fill()
}

/** Visual dressing is deterministic and never changes the authoritative floor. */
function renderStone(context: CanvasRenderingContext2D, floor: DungeonFloor, grid: boolean) {
  const size = TILE_SIZE
  const walkable = (x: number, y: number) => isWalkable(floor.tiles[y]?.[x])
  const materials = createMaterialPlan(floor)
  drawStoneVoid(context, floor.width * size, floor.height * size)
  const torchKeys = new Set<number>()
  const torches: Position[] = []
  for (const room of floor.rooms) {
    for (const p of roomCells(room)) {
      if ((p.x - room.x) % 4 !== 1 || walkable(p.x, p.y - 1)) continue
      const key = (p.y - 1) * floor.width + p.x
      if (torchKeys.has(key)) continue
      torches.push({ x: p.x, y: p.y - 1 })
      torchKeys.add(key)
    }
  }
  const visible = new Path2D()
  for (let y = 0; y < floor.height; y++) {
    for (let x = 0; x < floor.width; x++) {
      const px = x * size
      const py = y * size
      const open = walkable(x, y)
      let nearFloor = open
      for (let dy = -1; dy <= 1 && !nearFloor; dy++) {
        for (let dx = -1; dx <= 1; dx++) if (walkable(x + dx, y + dy)) nearFloor = true
      }
      if (!nearFloor) continue
      visible.rect(px, py, size, size)
      const material = materials.at(x, y)
      context.drawImage(stoneTile(material.kind, material.variant, material.condition), px, py)
      if (open) {
        if (material.kind === 'corridor' || material.kind === 'corridor-slab')
          drawCorridorWear(context, floor, x, y)
        for (const [dx, dy] of [
          [0, -1],
          [-1, 0],
          [1, 0],
          [0, 1],
        ] as const) {
          if (walkable(x + dx, y + dy)) continue
          const shade = context.createLinearGradient(
            px + (dx === 1 ? size : 0),
            py + (dy === 1 ? size : 0),
            px + (dx === 1 ? size - 9 : dx === -1 ? 9 : 0),
            py + (dy === 1 ? size - 9 : dy === -1 ? 9 : 0),
          )
          shade.addColorStop(0, '#040c12ce')
          shade.addColorStop(1, '#03080700')
          context.fillStyle = shade
          context.fillRect(px, py, size, size)
        }
      } else {
        context.fillStyle = '#050c1455'
        context.fillRect(px, py, size, size)
        if (walkable(x, y + 1)) {
          const coping = context.createLinearGradient(px, py, px, py + 9)
          coping.addColorStop(0, '#c9c4b863')
          coping.addColorStop(1, '#b6b4a400')
          context.fillStyle = coping
          context.fillRect(px, py, size, 9)
          context.fillStyle = '#d2cabb8a'
          context.fillRect(px + 1, py + 1, 30, 1)
          const face = context.createLinearGradient(px, py + 22, px, py + 32)
          face.addColorStop(0, '#02080e00')
          face.addColorStop(1, '#02080ec9')
          context.fillStyle = face
          context.fillRect(px, py + 22, size, 10)
        }
        context.fillStyle = '#afa99066'
        if (walkable(x, y - 1)) context.fillRect(px, py, size, 2)
        if (walkable(x - 1, y)) context.fillRect(px, py, 2, size)
        context.fillStyle = '#030807b0'
        if (walkable(x + 1, y)) context.fillRect(px + 30, py, 2, size)
      }
    }
  }
  for (const finish of materials.rooms) drawRoomFinish(context, floor, finish)
  for (const door of floor.doors) {
    drawStoneDoor(
      context,
      door.position.x * size,
      door.position.y * size,
      door.orientation,
      door.type === 'secret',
    )
  }
  for (const stair of floor.stairs) {
    if (
      [-1, 0, 1].every((dy) =>
        [-1, 0, 1].every((dx) => walkable(stair.position.x + dx, stair.position.y + dy)),
      )
    )
      drawStairSurround(context, stair.position)
    drawStairs(context, stair.position.x * size, stair.position.y * size, stair.direction === 'up')
  }
  context.save()
  context.clip(visible)
  for (const torch of torches) drawTorchLight(context, floor, torch)
  context.restore()
  for (const torch of torches) drawWallTorch(context, torch)
  if (grid) {
    context.save()
    context.clip(visible)
    context.strokeStyle = '#c5c5ad22'
    context.lineWidth = 1
    context.beginPath()
    for (let x = 0; x <= floor.width; x++) {
      context.moveTo(x * size + 0.5, 0)
      context.lineTo(x * size + 0.5, floor.height * size)
    }
    for (let y = 0; y <= floor.height; y++) {
      context.moveTo(0, y * size + 0.5)
      context.lineTo(floor.width * size, y * size + 0.5)
    }
    context.stroke()
    context.restore()
  }
}

/** Mordor-inspired automap: black interiors, pale boundary lines, and small symbols. */
function renderClassic(context: CanvasRenderingContext2D, floor: DungeonFloor, grid: boolean) {
  const size = TILE_SIZE
  const seed = seedHash(floor.seed)
  const walkable = (x: number, y: number) => isWalkable(floor.tiles[y]?.[x])
  // Rocky olive ground makes the negative space distinct from black room interiors.
  for (let y = 0; y < floor.height; y++) {
    for (let x = 0; x < floor.width; x++) {
      context.drawImage(stoneTile('rock', tileHash(x, y, seed) % 16), x * size, y * size)
    }
  }
  context.fillStyle = '#30331db0'
  context.fillRect(0, 0, floor.width * size, floor.height * size)
  for (let y = 0; y < floor.height; y++) {
    for (let x = 0; x < floor.width; x++) {
      if (!walkable(x, y)) continue
      const px = x * size
      const py = y * size
      context.fillStyle = '#050706'
      context.fillRect(px, py, size, size)
      if (grid) {
        context.strokeStyle = '#c9cbb31c'
        context.lineWidth = 1
        context.strokeRect(px + 0.5, py + 0.5, size - 1, size - 1)
      }
      context.strokeStyle = '#e1dfca'
      context.lineWidth = 2
      context.beginPath()
      if (!walkable(x, y - 1)) {
        context.moveTo(px, py + 1)
        context.lineTo(px + size, py + 1)
      }
      if (!walkable(x, y + 1)) {
        context.moveTo(px, py + size - 1)
        context.lineTo(px + size, py + size - 1)
      }
      if (!walkable(x - 1, y)) {
        context.moveTo(px + 1, py)
        context.lineTo(px + 1, py + size)
      }
      if (!walkable(x + 1, y)) {
        context.moveTo(px + size - 1, py)
        context.lineTo(px + size - 1, py + size)
      }
      context.stroke()
    }
  }
  for (const door of floor.doors) {
    context.save()
    context.translate(door.position.x * size + 16, door.position.y * size + 16)
    if (door.orientation === 'east-west') context.rotate(Math.PI / 2)
    context.strokeStyle = '#e1dfca'
    context.lineWidth = 2
    context.beginPath()
    context.moveTo(-16, 0)
    context.lineTo(-8, 0)
    context.moveTo(8, 0)
    context.lineTo(16, 0)
    context.stroke()
    if (door.type === 'secret') {
      context.fillStyle = '#142f2b'
      context.fillRect(-9, -5, 18, 10)
      context.strokeStyle = '#81e2d8'
      context.lineWidth = 1
      context.setLineDash([3, 2])
      context.strokeRect(-9, -5, 18, 10)
      context.setLineDash([])
      if (door.orientation === 'east-west') context.rotate(-Math.PI / 2)
      context.fillStyle = '#142f2b'
      context.fillRect(-5, -7, 10, 14)
      context.font = 'bold 12px monospace'
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      context.fillStyle = '#a4f4eb'
      context.fillText('S', 0, 0.5)
    } else {
      context.fillStyle = '#655239'
      context.fillRect(-8, -3, 16, 6)
      context.strokeStyle = '#cbb58a'
      context.strokeRect(-8, -3, 16, 6)
    }
    context.restore()
  }
  for (const stair of floor.stairs) {
    const x = stair.position.x * size
    const y = stair.position.y * size
    context.strokeStyle = stair.direction === 'up' ? '#87e096' : '#ef654a'
    context.lineWidth = 2
    context.strokeRect(x + 5, y + 5, 22, 22)
    for (let step = 0; step < 4; step++) {
      const width = stair.direction === 'up' ? 5 + step * 4 : 17 - step * 4
      context.beginPath()
      context.moveTo(x + 16 - width / 2, y + 9 + step * 5)
      context.lineTo(x + 16 + width / 2, y + 9 + step * 5)
      context.stroke()
    }
  }
}

export function renderDungeon(
  context: CanvasRenderingContext2D,
  floor: DungeonFloor,
  grid: boolean,
  style: MapStyle = 'stone',
) {
  if (style === 'ancient')
    throw new Error('Ancient artwork loads asynchronously. Use createMapCanvasAsync.')
  const bounds = mapRenderBounds(floor, style)
  context.save()
  context.fillStyle = MAP_BACKGROUND
  context.fillRect(0, 0, bounds.width, bounds.height)
  context.translate(bounds.origin.x, bounds.origin.y)
  if (style === 'classic') renderClassic(context, floor, grid)
  else renderStone(context, floor, grid)
  context.restore()
}

export function createMapCanvas(
  floor: DungeonFloor,
  grid: boolean,
  style: MapStyle = 'stone',
): HTMLCanvasElement {
  const bounds = mapRenderBounds(floor, style)
  const canvas = document.createElement('canvas')
  canvas.width = bounds.width
  canvas.height = bounds.height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Your browser could not create a Canvas 2D rendering context.')
  renderDungeon(context, floor, grid, style)
  return canvas
}

/** Shared viewport/export entry: awaits source artwork before returning a complete frame. */
export async function createMapCanvasAsync(
  floor: DungeonFloor,
  grid: boolean,
  style: MapStyle = 'ancient',
  options: MapRenderOptions = {},
) {
  if (style === 'ancient') return renderAncient(floor, grid, options)
  return createMapCanvas(floor, grid, style)
}
