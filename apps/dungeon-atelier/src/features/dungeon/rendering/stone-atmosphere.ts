import { isWalkable } from '@dungeon-atelier/core'
import type { DungeonFloor, Position } from '@dungeon-atelier/core'
import type { RoomFinish } from './material-rules'
import { TILE_SIZE as SIZE } from './tile-size'
import { tileHash } from './stone-tiles'

/** Footprint-aware inlays and edging. No props, new features, or serialized room types. */
export function drawRoomFinish(
  context: CanvasRenderingContext2D,
  floor: DungeonFloor,
  finish: RoomFinish,
) {
  const { room, cells, role } = finish
  if (role === 'chamber' || role === 'damp') return
  context.save()
  context.lineWidth = 1
  const accented = role === 'template' || role === 'ceremonial'
  for (const key of cells) {
    const x = key % floor.width,
      y = Math.floor(key / floor.width)
    for (const [dx, dy] of [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ] as const) {
      if (cells.has((y + dy) * floor.width + x + dx) || isWalkable(floor.tiles[y + dy]?.[x + dx]))
        continue
      const px = x * SIZE,
        py = y * SIZE
      context.strokeStyle = accented ? '#b09b6a63' : '#c0bbb83b'
      context.beginPath()
      if (dy) {
        context.moveTo(px + 3, py + (dy < 0 ? 5 : 27))
        context.lineTo(px + 29, py + (dy < 0 ? 5 : 27))
      } else {
        context.moveTo(px + (dx < 0 ? 5 : 27), py + 3)
        context.lineTo(px + (dx < 0 ? 5 : 27), py + 29)
      }
      context.stroke()
      context.strokeStyle = '#0c151a82'
      context.beginPath()
      if (dy) {
        context.moveTo(px + 3, py + (dy < 0 ? 7 : 25))
        context.lineTo(px + 29, py + (dy < 0 ? 7 : 25))
      } else {
        context.moveTo(px + (dx < 0 ? 7 : 25), py + 3)
        context.lineTo(px + (dx < 0 ? 7 : 25), py + 29)
      }
      context.stroke()
    }
  }
  if (role === 'ceremonial' || role === 'template' || role === 'hub') {
    const cx = Math.floor(room.x + room.width / 2),
      cy = Math.floor(room.y + room.height / 2)
    let fits = true
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        if (
          !cells.has((cy + dy) * floor.width + cx + dx) ||
          floor.tiles[cy + dy]?.[cx + dx] !== 'floor'
        )
          fits = false
      }
    if (
      floor.stairs.some(
        (stair) => Math.abs(stair.position.x - cx) <= 1 && Math.abs(stair.position.y - cy) <= 1,
      )
    )
      fits = false
    if (fits) {
      context.translate((cx + 0.5) * SIZE, (cy + 0.5) * SIZE)
      context.strokeStyle = role === 'hub' ? '#b8c2bf48' : '#c4ad756b'
      context.lineWidth = 1.2
      context.beginPath()
      context.arc(0, 0, 23, 0, Math.PI * 2)
      context.stroke()
      context.strokeStyle = '#0b161a8c'
      context.beginPath()
      context.arc(0, 0, 25, 0, Math.PI * 2)
      context.stroke()
      context.strokeStyle = '#bda77770'
      context.beginPath()
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4,
          radius = i % 2 ? 8 : 17
        if (!i) context.moveTo(Math.cos(a) * radius, Math.sin(a) * radius)
        else context.lineTo(Math.cos(a) * radius, Math.sin(a) * radius)
      }
      context.closePath()
      context.stroke()
      context.fillStyle = '#bda77755'
      context.fillRect(-2, -2, 4, 4)
    }
  }
  context.restore()
}

export function drawStairSurround(context: CanvasRenderingContext2D, position: Position) {
  const x = position.x * SIZE,
    y = position.y * SIZE
  context.save()
  context.strokeStyle = '#c0b39189'
  context.lineWidth = 1
  context.strokeRect(x - 3.5, y - 3.5, 39, 39)
  context.strokeStyle = '#132027a0'
  context.strokeRect(x - 5, y - 5, 42, 42)
  for (const [dx, dy] of [
    [-4, -4],
    [36, -4],
    [36, 36],
    [-4, 36],
  ]) {
    context.fillStyle = '#c9b88892'
    context.fillRect(x + dx! - 1, y + dy! - 1, 2, 2)
  }
  context.restore()
}

/** Broad, faint traffic polish follows a corridor's actual axis, including bends. */
export function drawCorridorWear(
  context: CanvasRenderingContext2D,
  floor: DungeonFloor,
  x: number,
  y: number,
) {
  const px = x * SIZE,
    py = y * SIZE
  context.save()
  context.lineCap = 'round'
  context.strokeStyle = '#b9b4a012'
  context.lineWidth = 9
  context.beginPath()
  for (const [dx, dy] of [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ] as const) {
    if (!isWalkable(floor.tiles[y + dy]?.[x + dx])) continue
    context.moveTo(px + 16, py + 16)
    context.lineTo(px + 16 + dx * 16, py + 16 + dy * 16)
  }
  context.stroke()
  context.restore()
}

/** Connected local light footprints prevent a glow from spilling across solid masonry. */
export function drawTorchLight(
  context: CanvasRenderingContext2D,
  floor: DungeonFloor,
  torch: Position,
) {
  const start = { x: torch.x, y: torch.y + 1, distance: 0 }
  const queue = [start],
    visited = new Set<number>([start.y * floor.width + start.x])
  const lit = new Path2D()
  lit.rect(torch.x * SIZE, torch.y * SIZE, SIZE, SIZE)
  for (let index = 0; index < queue.length; index++) {
    const p = queue[index]!
    lit.rect(p.x * SIZE, p.y * SIZE, SIZE, SIZE)
    for (const [dx, dy] of [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ] as const) {
      const x = p.x + dx,
        y = p.y + dy,
        key = y * floor.width + x
      if (x < 0 || y < 0 || x >= floor.width || y >= floor.height) continue
      if (!isWalkable(floor.tiles[y]?.[x])) {
        lit.rect(x * SIZE, y * SIZE, SIZE, SIZE)
        continue
      }
      if (p.distance >= 4 || visited.has(key)) continue
      visited.add(key)
      queue.push({ x, y, distance: p.distance + 1 })
    }
  }
  context.save()
  context.clip(lit)
  context.globalCompositeOperation = 'screen'
  const x = torch.x * SIZE + 16,
    y = torch.y * SIZE + 26
  const light = context.createRadialGradient(x, y, 1, x, y, SIZE * 3.8)
  light.addColorStop(0, '#ffbd6885')
  light.addColorStop(0.15, '#eaa24b52')
  light.addColorStop(0.4, '#b46b2a29')
  light.addColorStop(0.75, '#8d48200c')
  light.addColorStop(1, '#8d482000')
  context.fillStyle = light
  context.fillRect(x - 124, y - 124, 248, 248)
  context.restore()
}

export function drawStoneVoid(context: CanvasRenderingContext2D, width: number, height: number) {
  const radius = Math.max(width, height) * 0.7
  const wash = context.createRadialGradient(
    width * 0.5,
    height * 0.45,
    0,
    width * 0.5,
    height * 0.45,
    radius,
  )
  wash.addColorStop(0, '#10191e')
  wash.addColorStop(1, '#060b10')
  context.fillStyle = wash
  context.fillRect(0, 0, width, height)
  // Sparse one-pixel grain is stable for PNG export and never animates.
  context.fillStyle = '#a4b0b803'
  for (let y = 0; y < height; y += 7)
    for (let x = 0; x < width; x += 7) {
      if (tileHash(x, y, 4187) % 5 === 0) context.fillRect(x, y, 1, 1)
    }
}
