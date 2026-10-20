import type { DungeonFloor } from '@dungeon-atelier/core'
import { wallCapRects } from '../architecture-model'
import { capBoundarySegments } from './plane-separation'
import { copingBlocks } from './coping-model'
import type { CopingNode } from './coping-model'
import type { CopingArt } from './coping-art'
import { buildCopingSurface } from './coping-renderer'
import { buildCutCopingSurface } from './cut-coping-renderer'
import { FOUNDATION as P, project, viewBounds } from './model'
import { CHAMFER, chamferFacets, facetTransform } from './chamfer-model'
import type { CapEdge, ProfilePoint } from './chamfer-model'
function polygon(points: ProfilePoint[]) {
  const path = new Path2D()
  points.forEach((p, i) => {
    const v = project(p.x, p.y, p.z)
    if (i) path.lineTo(v.x, v.y)
    else path.moveTo(v.x, v.y)
  })
  path.closePath()
  return path
}
/** Cut every exposed contour, inside and outside; connected tile joins stay flat. */
export function buildCapChamfer(
  nodes: CopingNode[],
  floor: DungeonFloor,
  art: CopingArt,
  finish: 'soft' | 'cut' = 'soft',
) {
  const edges: CapEdge[] = [],
    cap = new Path2D()
  for (const node of nodes) {
    const x = node.x * 32,
      y = node.y * 32,
      rects = wallCapRects(node.mask, node.corner, 32)
    for (const r of rects)
      cap.addPath(
        polygon([
          { x: x + r.x, y: y + r.y, z: 1 },
          { x: x + r.x + r.width, y: y + r.y, z: 1 },
          { x: x + r.x + r.width, y: y + r.y + r.height, z: 1 },
          { x: x + r.x, y: y + r.y + r.height, z: 1 },
        ]),
      )
    for (const e of capBoundarySegments(rects)) {
      const vertical = e.ax === e.bx,
        nx = vertical ? (e.light ? -1 : 1) : 0,
        ny = vertical ? 0 : e.light ? -1 : 1,
        edge = { ax: x + e.ax, ay: y + e.ay, bx: x + e.bx, by: y + e.by, nx, ny }
      edges.push(edge)
    }
  }
  const facets = chamferFacets(edges),
    blocks = copingBlocks(nodes, 'hewn'),
    cut = finish === 'cut' ? buildCutCopingSurface(nodes, blocks, art, floor.seed) : undefined,
    surface = cut ?? buildCopingSurface(nodes, blocks, art, 'hewn', false),
    bounds = viewBounds(floor),
    image = document.createElement('canvas')
  image.width = bounds.width * 2
  image.height = bounds.height * 2
  const c = image.getContext('2d')!
  c.scale(2, 2)
  c.translate(bounds.origin.x, bounds.origin.y)
  const exclusions = new Path2D()
  exclusions.rect(-100, -100, bounds.width + 200, bounds.height + 200)
  for (const f of facets) exclusions.addPath(polygon(f.footprint))
  c.save()
  c.clip(cap)
  c.clip(exclusions, 'evenodd')
  c.transform(1, 0, 0, P.depth, -P.side, -P.rise)
  c.drawImage(
    surface.top,
    -surface.padding,
    -surface.padding,
    surface.top.width / 2,
    surface.top.height / 2,
  )
  c.restore()
  for (const facet of facets) {
    const path = polygon(facet.points),
      t = facetTransform(facet.edge, P.depth, P.side)
    c.save()
    c.clip(path)
    c.transform(t.a, t.b, t.c, t.d, t.e, t.f)
    c.drawImage(
      surface.top,
      -surface.padding,
      -surface.padding,
      surface.top.width / 2,
      surface.top.height / 2,
    )
    c.restore()
    // Muted cut-stone response: the geometry carries the profile, with a small
    // directional lift that retains texture and mortar rather than a pale band.
    const mx = (facet.edge.ax + facet.edge.bx) / 2,
      my = (facet.edge.ay + facet.edge.by) / 2,
      a = project(mx - facet.edge.nx * CHAMFER.width, my - facet.edge.ny * CHAMFER.width, 1),
      b = project(mx, my, 1 - CHAMFER.drop / CHAMFER.wallHeight),
      exposure = 0.125 - 0.025 * (facet.edge.nx + facet.edge.ny),
      light = c.createLinearGradient(a.x, a.y, facet.edge.nx ? b.x : a.x, facet.edge.ny ? b.y : a.y)
    light.addColorStop(0, `rgba(212,205,188,${exposure + 0.03})`)
    light.addColorStop(1, `rgba(212,205,188,${exposure - 0.03})`)
    c.save()
    c.clip(path)
    c.fillStyle = cut ? `rgba(212,205,188,${exposure})` : light
    c.fill(path)
    c.restore()
    if (cut) {
      // Crisp plane creases, confined to the actual stone profile; never a broad bevel glow.
      c.save()
      c.clip(path)
      for (const [first, last, color] of [
        [0, 1, '#c4bda64d'],
        [3, 2, '#0c12128c'],
      ] as const) {
        const a = facet.points[first]!,
          b = facet.points[last]!,
          from = project(a.x, a.y, a.z),
          to = project(b.x, b.y, b.z)
        c.lineWidth = 0.65
        c.strokeStyle = color
        c.beginPath()
        c.moveTo(from.x, from.y)
        c.lineTo(to.x, to.y)
        c.stroke()
      }
      c.transform(t.a, t.b, t.c, t.d, t.e, t.f)
      // Recessed joints cross the chamfer at the same UVs and interrupt the crease.
      c.drawImage(
        cut.joints,
        -surface.padding,
        -surface.padding,
        cut.joints.width / 2,
        cut.joints.height / 2,
      )
      c.restore()
    }
  }
  surface.top.width = surface.top.height = 1
  if (cut) cut.joints.width = cut.joints.height = 1
  else if ('rim' in surface) surface.rim.width = surface.rim.height = 1
  return { image, facets, profile: CHAMFER }
}
