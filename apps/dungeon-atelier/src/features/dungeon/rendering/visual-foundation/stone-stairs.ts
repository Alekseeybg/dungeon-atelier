import type { Staircase } from '@dungeon-atelier/core'
import type { FoundationArt } from './art'
import { FOUNDATION, project } from './model'
import type { WallProjection } from './model'
import { stairTreads } from './finishing-model'
import type { StairPresentation, StairProfile, StonePoint } from './finishing-model'

function shape(points: StonePoint[], projection: WallProjection = FOUNDATION) {
  const path = new Path2D()
  points.forEach((p, i) => {
    const v = project(p.x, p.y, p.z, projection)
    if (i) path.lineTo(v.x, v.y)
    else path.moveTo(v.x, v.y)
  })
  path.closePath()
  return path
}
function stone(
  c: CanvasRenderingContext2D,
  points: StonePoint[],
  material: CanvasPattern,
  shade = 0,
  projection: WallProjection = FOUNDATION,
) {
  const p = points.map((v) => project(v.x, v.y, v.z, projection)),
    a = p[0]!,
    b = p[1]!,
    d = p[3]!,
    path = shape(points, projection)
  c.save()
  c.clip(path)
  c.transform((b.x - a.x) / 32, (b.y - a.y) / 32, (d.x - a.x) / 8, (d.y - a.y) / 8, a.x, a.y)
  c.fillStyle = material
  c.fillRect(0, 0, 32, 8)
  if (shade) {
    c.fillStyle = `rgba(3,9,11,${shade})`
    c.fillRect(0, 0, 32, 8)
  }
  c.restore()
  return path
}
function slab(
  c: CanvasRenderingContext2D,
  art: FoundationArt,
  x: number,
  y: number,
  w: number,
  h: number,
  z: number,
  projection: WallProjection = FOUNDATION,
) {
  const top = [
      { x, y, z },
      { x: x + w, y, z },
      { x: x + w, y: y + h, z },
      { x, y: y + h, z },
    ],
    low = 0
  if (z > 0)
    stone(
      c,
      [top[3]!, top[2]!, { ...top[2]!, z: low }, { ...top[3]!, z: low }],
      art.face,
      0,
      projection,
    )
  stone(c, top, art.cap, 0.2, projection)
}
/** Actual tread/riser planes in the approved projection, with floor-level entry and fitted edging. */
export function drawFoundationStair(
  c: CanvasRenderingContext2D,
  art: FoundationArt,
  stair: Staircase,
  presentation: StairPresentation,
  profile: StairProfile = 'current',
  projection: WallProjection = FOUNDATION,
) {
  const x = stair.position.x * 32,
    y = stair.position.y * 32,
    down = stair.direction === 'down',
    opening = shape(
      [
        { x: x + 4, y: y + 3, z: 0 },
        { x: x + 28, y: y + 3, z: 0 },
        { x: x + 28, y: y + 29, z: 0 },
        { x: x + 4, y: y + 29, z: 0 },
      ],
      projection,
    )
  c.save()
  // A narrow inset surrounds the fitted stonework; it never becomes a glowing icon border.
  c.fillStyle = '#0b100ed9'
  c.fill(
    shape(
      [
        { x: x + 1, y: y + 1, z: 0 },
        { x: x + 31, y: y + 1, z: 0 },
        { x: x + 31, y: y + 31, z: 0 },
        { x: x + 1, y: y + 31, z: 0 },
      ],
      projection,
    ),
  )
  c.fillStyle = '#080d0e'
  c.fill(opening)
  c.save()
  if (down) c.clip(opening)
  const treads = stairTreads(stair, profile)
  for (const tread of treads) {
    const points = tread.points
    if (!down)
      stone(
        c,
        [points[1]!, points[2]!, { ...points[2]!, z: 0 }, { ...points[1]!, z: 0 }],
        art.face,
        0.05,
        projection,
      )
    stone(c, points, art.floor, down ? 0.1 : 0.05, projection)
    const a = points[3]!,
      b = points[2]!
    stone(
      c,
      [a, b, { ...b, z: tread.nextZ }, { ...a, z: tread.nextZ }],
      art.face,
      down ? 0.15 : profile === 'ascending' ? 0.2 : 0,
      projection,
    )
    const pa = project(a.x, a.y, a.z, projection),
      pb = project(b.x, b.y, b.z, projection)
    c.strokeStyle = down ? '#c3bba573' : '#dfd3b380'
    c.lineWidth = 0.65
    c.beginPath()
    c.moveTo(pa.x, pa.y)
    c.lineTo(pb.x, pb.y)
    c.stroke()
  }
  if (down) {
    const a = project(x + 16, y + 3, 0, projection),
      b = project(x + 16, y + 23, 0, projection),
      shade = c.createLinearGradient(a.x, a.y, b.x, b.y)
    shade.addColorStop(0, '#020608f5')
    shade.addColorStop(0.42, '#02060885')
    shade.addColorStop(1, '#02060800')
    c.fillStyle = shade
    c.fill(opening)
  }
  c.restore()
  const height = presentation === 'cheeked' ? 0.2 : presentation === 'recessed' ? 0.055 : 0
  for (const side of [x + 1, x + 27]) {
    slab(c, art, side, y + 2, 4, 27, height, projection)
    // Bonding breaks keep the rim in the same cut-stone language as the coping.
    for (const dy of [11, 21]) {
      const a = project(side, y + dy, height, projection),
        b = project(side + 4, y + dy, height, projection)
      c.strokeStyle = '#0d1515b3'
      c.lineWidth = 0.6
      c.beginPath()
      c.moveTo(a.x, a.y)
      c.lineTo(b.x, b.y)
      c.stroke()
    }
  }
  if (down) slab(c, art, x + 5, y + 1, 22, 3, height, projection)
  slab(c, art, x + 4, y + 28, 24, 3, 0, projection)
  c.restore()
}
