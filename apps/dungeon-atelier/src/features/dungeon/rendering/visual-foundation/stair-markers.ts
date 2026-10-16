import type { DungeonFloor, Staircase } from '@dungeon-atelier/core'
import type { FoundationArt } from './art'
import { FOUNDATION } from './model'
import { stairArrowOutline, stairMarkerPlacement } from './finishing-model'
import type { StairArrow } from './finishing-model'

const materials = {
  brass: { dark: '#51452c', mid: '#b4a171', light: '#d2bd8c' },
  stone: { dark: '#655e4c', mid: '#bcb4a0', light: '#e1d6b9' },
  iron: { dark: '#394442', mid: '#87938a', light: '#b6c2b4' },
}

/** A level sign on adjacent floor: never painted onto the steps or their entrance. */
export function drawStairMarker(
  c: CanvasRenderingContext2D,
  art: FoundationArt,
  floor: DungeonFloor,
  stair: Staircase,
  style: StairArrow = 'none',
  placement?: ReturnType<typeof stairMarkerPlacement>,
) {
  if (style === 'none') return
  const box = placement ?? stairMarkerPlacement(floor, stair)
  if (!box) return
  const { x, y, width: w, height: h } = box,
    material = materials[style],
    plaque = new Path2D()
  for (const [i, [a, b]] of [
    [x + 2, y],
    [x + w - 2, y],
    [x + w, y + 2],
    [x + w, y + h - 2],
    [x + w - 2, y + h],
    [x + 2, y + h],
    [x, y + h - 2],
    [x, y + 2],
  ].entries()) {
    if (i) plaque.lineTo(a!, b!)
    else plaque.moveTo(a!, b!)
  }
  plaque.closePath()
  c.save()
  if (box.plane === 'wall')
    c.transform(1, 0, 0, 1, -FOUNDATION.side, y * FOUNDATION.depth - y - FOUNDATION.rise)
  else c.transform(1, 0, 0, FOUNDATION.depth, -FOUNDATION.side * 0.035, -FOUNDATION.rise * 0.035)
  // A restrained stone carrier separates the level symbol from the physical stair flight.
  c.fillStyle = '#0b1314'
  c.lineWidth = 1.2
  c.strokeStyle = '#0b1314'
  c.stroke(plaque)
  c.fillStyle = art.cap
  c.fill(plaque)
  c.fillStyle = '#101a19c9'
  c.fill(plaque)
  c.strokeStyle = '#8b816166'
  c.lineWidth = 0.45
  c.stroke(plaque)
  const arrow = new Path2D()
  stairArrowOutline(stair.direction).forEach((p, i) => {
    const a = x + 2.5 + ((p.x - 10) / 12) * (w - 5),
      b = y + 3 + ((p.y - 6) / 20) * (h - 6)
    if (i) arrow.lineTo(a, b)
    else arrow.moveTo(a, b)
  })
  arrow.closePath()
  const fill = c.createLinearGradient(x + 2, 0, x + w - 2, 0)
  fill.addColorStop(0, material.dark)
  fill.addColorStop(0.25, material.mid)
  fill.addColorStop(0.65, material.light)
  fill.addColorStop(1, material.mid)
  c.strokeStyle = '#050c0b'
  c.lineWidth = 0.9
  c.stroke(arrow)
  c.fillStyle = fill
  c.fill(arrow)
  c.strokeStyle = material.light
  c.lineWidth = 0.25
  c.stroke(arrow)
  c.restore()
}
