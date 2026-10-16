import type { DungeonFloor, Position } from '@dungeon-atelier/core'
import {
  createDimensionalPlan,
  dimensionalLightCells,
  wallCapRects,
  wallEastSegments,
  wallFrontSegments,
  visualOpen,
} from '../dimensional-model'
import type { DimensionalOptions, SpriteDefinition } from '../dimensional-model'
import { canvas, loadFoundationArt, floorStudy } from './art'
import type { FoundationArt, FoundationTreatment, FoundationFloor } from './art'
import {
  FOUNDATION as P,
  createFoundationScene,
  doorSurface,
  project,
  spriteOrigin,
  viewBounds,
} from './model'
import type { FoundationScene } from './model'
import { capBoundarySegments } from './plane-separation'
import { CAP_EFFECTS, polishCap, shadeCapJoint } from './cap-polish'
import type { CapEffect } from './cap-polish'
import { copingBlocks } from './coping-model'
import type { CopingStudy } from './coping-model'
import { loadCopingArt } from './coping-art'
import type { CopingArt } from './coping-art'
import { buildCopingSurface, drawRaisedCoping } from './coping-renderer'
import { buildCapChamfer } from './chamfer-renderer'
import { drawFoundationStair } from './stone-stairs'
import { drawStairMarker } from './stair-markers'
import { projectedStairMarkers } from './stair-placement'
import { projectedRectangle, projectedFace } from './projected-geometry'
import { loadMountedTorchArt, drawMountedTorch } from './mounted-torches'
import type { MountedTorchArt } from './mounted-torches'
import { mountedLightCells } from './finishing-model'
import type { StairPresentation, StairArrow, StairProfile } from './finishing-model'

export interface FoundationOptions {
  floor?: FoundationFloor
  separation?: boolean
  treatment?: FoundationTreatment
  doors?: 'closed' | 'open'
  lighting?: boolean
  grid?: boolean
  secret?: 'none' | 'hidden' | 'revealed'
  capPolish?: boolean
  /** Isolated effect layers for review captures; the UI enables the complete treatment. */
  capEffects?: CapEffect[]
  coping?: CopingStudy
  capProfile?: 'raised' | 'chamfered'
  capFinish?: 'soft' | 'cut'
  stairs?: StairPresentation
  stairArrow?: StairArrow
  stairProfile?: StairProfile
  torches?: 'current' | 'mounted'
  northTorchMount?: 'flat' | 'projecting'
  openDoorIds?: readonly string[]
  depthSortedStairs?: boolean
}
interface ArchitecturalSprite {
  definition: SpriteDefinition
  image: HTMLCanvasElement
  path: Path2D
  x: number
  y: number
}
interface BuiltScene {
  scene: FoundationScene
  plan: ReturnType<typeof createDimensionalPlan>
  atlas: ArchitecturalSprite[]
  floorPath: Path2D
  art: FoundationArt
  contact?: HTMLCanvasElement
  edgeTone?: HTMLCanvasElement
  chamfer?: ReturnType<typeof buildCapChamfer>
  torchArt?: MountedTorchArt
  markers?: ReturnType<typeof projectedStairMarkers>
  surfaces?: {
    assignments: Map<number, FoundationFloor>
    patterns: Map<FoundationFloor, CanvasPattern>
  }
}
const scenes = new Map<string, BuiltScene>()
function polygon(points: Position[]) {
  const path = new Path2D()
  path.moveTo(points[0]!.x, points[0]!.y)
  for (const p of points.slice(1)) path.lineTo(p.x, p.y)
  path.closePath()
  return path
}
function plane(a: Position, b: Position, height = 1) {
  return projectedFace(a, b, height)
}
function rectangle(x: number, y: number, width: number, height: number, elevation = 0) {
  return polygon(projectedRectangle(x, y, width, height, elevation))
}
function patternFace(
  c: CanvasRenderingContext2D,
  pattern: CanvasPattern,
  points: Position[],
  start: number,
  length: number,
  shade = false,
) {
  const a = points[0]!,
    b = points[1]!,
    d = points[3]!,
    path = polygon(points)
  c.save()
  c.clip(path)
  const ux = (b.x - a.x) / length,
    uy = (b.y - a.y) / length
  c.transform(
    ux,
    uy,
    (d.x - a.x) / P.rise,
    (d.y - a.y) / P.rise,
    a.x - ux * start,
    a.y - uy * start,
  )
  c.fillStyle = '#1b2023'
  c.fillRect(start, 0, length, P.rise)
  c.fillStyle = pattern
  c.fillRect(start, 0, length, P.rise)
  if (shade) {
    c.fillStyle = '#07101c36'
    c.fillRect(start, 0, length, P.rise)
  }
  c.restore()
  return path
}
function imagePlane(c: CanvasRenderingContext2D, image: CanvasImageSource, points: Position[]) {
  const a = points[0]!,
    b = points[1]!,
    d = points[3]!
  c.save()
  c.clip(polygon(points))
  c.transform((b.x - a.x) / 32, (b.y - a.y) / 32, (d.x - a.x) / 24, (d.y - a.y) / 24, a.x, a.y)
  c.drawImage(image, 0, 0, 32, 24)
  c.restore()
}
function framePanel(art: FoundationArt, closed: boolean, start = 0) {
  if (art.aperture) {
    const panel = canvas(88, 48),
      c = panel.getContext('2d')!
    c.save()
    c.scale(2, 2)
    c.translate(-start, 0)
    c.fillStyle = art.face
    c.fillRect(start, 0, 44, 24)
    c.restore()
    c.globalCompositeOperation = 'destination-out'
    c.drawImage(art.aperture, 0, 0, 88, 48)
    c.globalCompositeOperation = 'source-over'
    c.drawImage(art.frame, 0, 0, 88, 48)
    if (closed) {
      const leaf = canvas(88, 48),
        l = leaf.getContext('2d')!,
        hole = art.opening
      const x = hole.x * 88,
        y = hole.y * 48,
        w = hole.width * 88,
        h = hole.height * 48
      // A shallow stone reveal surrounds a slightly recessed wooden leaf.
      l.fillStyle = '#231f18'
      l.fillRect(x, y, w, h)
      l.drawImage(art.wood, x + 1.8, y + 1.5, w - 3.6, h - 1.5)
      const shade = l.createLinearGradient(0, y, 0, y + h)
      shade.addColorStop(0, '#090b0be0')
      shade.addColorStop(0.22, '#090b0b45')
      shade.addColorStop(0.7, '#090b0b00')
      l.fillStyle = shade
      l.fillRect(x, y, w, h)
      l.globalCompositeOperation = 'destination-in'
      l.drawImage(art.aperture, 0, 0, 88, 48)
      c.globalCompositeOperation = 'destination-over'
      c.drawImage(leaf, 0, 0)
    }
    return panel
  }
  const panel = canvas(64, 48),
    c = panel.getContext('2d')!
  c.imageSmoothingQuality = 'high'
  c.drawImage(art.frame, 0, 0, 64, 48)
  if (closed) {
    c.globalCompositeOperation = 'destination-over'
    c.save()
    c.beginPath()
    c.rect(9, 6, 46, 42)
    c.clip()
    const hole = art.opening
    c.drawImage(art.wood, hole.x * 64, hole.y * 48, hole.width * 64, hole.height * 48)
    c.fillStyle = '#81532f'
    c.fillRect(0, 0, 64, 48)
    c.restore()
  }
  return panel
}
function buildArchitecture(
  scene: FoundationScene,
  plan: BuiltScene['plan'],
  art: FoundationArt,
  options: FoundationOptions,
  copingArt?: CopingArt,
) {
  const items = [
    ...plan.walls.map((wall) => ({ x: wall.x, y: wall.y, wall })),
    ...plan.doors.map((door) => ({ x: door.position.x, y: door.position.y, door })),
  ]
  items.sort((a, b) => a.y - b.y || Number('door' in a) - Number('door' in b) || a.x - b.x)
  const nodes = items.map((item) => ({
      x: item.x,
      y: item.y,
      mask: 'door' in item ? (item.door.orientation === 'north-south' ? 10 : 5) : item.wall.mask,
      corner: 'door' in item ? 0 : item.wall.cornerFill,
      door: 'door' in item,
    })),
    coping = options.coping ?? 'current',
    blocks = coping === 'current' ? [] : copingBlocks(nodes, coping),
    copingSurface =
      copingArt && coping !== 'current' && options.capProfile !== 'chamfered'
        ? buildCopingSurface(nodes, blocks, copingArt, coping)
        : undefined
  const closed = framePanel(art, true),
    open = framePanel(art, false)
  const sprites = items.map((item, index) => {
    const x = item.x * 32,
      y = item.y * 32,
      origin = spriteOrigin(item.x, item.y)
    const image = canvas(100, 120),
      c = image.getContext('2d')!
    c.scale(2, 2)
    c.translate(12 - origin.x, 29 - origin.y)
    c.imageSmoothingQuality = 'high'
    const isDoor = 'door' in item,
      mask = isDoor ? (item.door.orientation === 'north-south' ? 10 : 5) : item.wall.mask
    const corner = isDoor ? 0 : item.wall.cornerFill,
      silhouette = new Path2D()
    if (!isDoor) {
      for (const edge of wallEastSegments(mask, corner, 32)) {
        const points = plane(
          { x: x + edge.x, y: y + edge.y },
          { x: x + edge.x, y: y + edge.y + edge.height },
        )
        silhouette.addPath(patternFace(c, art.face, points, y + edge.y, edge.height, true))
        if (
          options.capPolish &&
          options.separation !== false &&
          (options.capEffects ?? CAP_EFFECTS).includes('occlusion')
        )
          shadeCapJoint(c, points)
      }
      for (const edge of wallFrontSegments(mask, corner, 32)) {
        const points = plane(
          { x: x + edge.x, y: y + edge.y },
          { x: x + edge.x + edge.width, y: y + edge.y },
        )
        silhouette.addPath(patternFace(c, art.face, points, x + edge.x, edge.width))
        if (
          options.capPolish &&
          options.separation !== false &&
          (options.capEffects ?? CAP_EFFECTS).includes('occlusion')
        )
          shadeCapJoint(c, points)
      }
    } else {
      const surface = doorSurface(item.door.position, scene.facings[item.door.id]!),
        points = plane(surface.a, surface.b)
      silhouette.addPath(polygon(points))
      if (item.door.type === 'secret') {
        patternFace(c, art.face, points, (surface.horizontal ? x : y) - 6, 44, !surface.horizontal)
      } else {
        const doorOpen = options.doors === 'open' || options.openDoorIds?.includes(item.door.id)
        const panel = art.aperture
          ? framePanel(art, !doorOpen, (surface.horizontal ? x : y) - 6)
          : doorOpen
            ? open
            : closed
        imagePlane(c, panel, points)
        if (art.aperture && !surface.horizontal) {
          c.save()
          c.clip(polygon(points))
          c.fillStyle = '#07101c36'
          c.fillRect(x - 12, y * P.depth - 30, 60, 80)
          c.restore()
        }
      }
    }
    const cap = new Path2D()
    for (const rect of wallCapRects(mask, corner, 32))
      cap.addPath(rectangle(x + rect.x, y + rect.y, rect.width, rect.height, 1))
    if (options.capProfile === 'chamfered' && coping === 'hewn') {
      /* Global mitered profile layer follows the faces. */
    } else if (coping !== 'current' && copingSurface)
      drawRaisedCoping(c, nodes[index]!, copingSurface, coping)
    else {
      c.save()
      c.clip(cap)
      c.transform(1, 0, 0, P.depth, -P.side, -P.rise)
      c.fillStyle = '#323334'
      c.fillRect(x, y, 32, 32)
      c.fillStyle = art.cap
      c.fillRect(x, y, 32, 32)
      c.restore()
      if (options.separation !== false) {
        // Fine coping arrises follow the exposed contour, never each texture tile.
        c.save()
        c.clip(cap)
        c.lineWidth = 1.1
        c.lineCap = 'square'
        for (const edge of capBoundarySegments(wallCapRects(mask, corner, 32))) {
          const a = project(x + edge.ax, y + edge.ay, 1),
            b = project(x + edge.bx, y + edge.by, 1)
          c.strokeStyle = edge.light ? '#ede3c659' : '#121b20b0'
          c.beginPath()
          c.moveTo(a.x, a.y)
          c.lineTo(b.x, b.y)
          c.stroke()
        }
        c.restore()
      }
      if (options.capPolish && options.separation !== false)
        polishCap(c, cap, wallCapRects(mask, corner, 32), x, y, art.cap, options.capEffects)
    }
    silhouette.addPath(cap)
    if (isDoor && item.door.type === 'secret') {
      const surface = doorSurface(item.door.position, scene.facings[item.door.id]!),
        p = project((surface.a.x + surface.b.x) / 2, (surface.a.y + surface.b.y) / 2, 0.4)
      c.fillStyle = '#0b2b31dd'
      c.fillRect(p.x - 5, p.y - 7, 10, 13)
      c.fillStyle = '#99e6dd'
      c.font = 'bold 10px monospace'
      c.textAlign = 'center'
      c.fillText('S', p.x, p.y + 3)
    }
    const definition: SpriteDefinition = {
      id: isDoor
        ? `door.${scene.facings[item.door.id]}.${options.doors ?? 'closed'}`
        : `wall.${mask}.${corner}.${item.x}.${item.y}`,
      atlas: 'visual-foundation-scene-v1',
      source: { x: 0, y: 0, width: 100, height: 120 },
      footprint: { width: 1, height: 1 },
      width: 50,
      height: 60,
      anchor: { x: 12, y: 29 },
      offset: { x: 0, y: 0 },
      layer: 'architecture',
      connectivityMask: mask,
    }
    return { definition, image, path: silhouette, x: item.x, y: item.y }
  })
  // Keep large generated-map review atlases below browser canvas dimension limits.
  const columns = sprites.length > 256 ? 32 : 8
  const atlas = canvas(columns * 100, Math.ceil(sprites.length / columns) * 120),
    target = atlas.getContext('2d')!
  sprites.forEach((sprite, i) => {
    const x = (i % columns) * 100,
      y = Math.floor(i / columns) * 120
    const source = sprite.image
    target.drawImage(source, x, y)
    sprite.definition.source.x = x
    sprite.definition.source.y = y
    sprite.image = atlas
    source.width = source.height = 1
  })
  if (copingSurface) {
    copingSurface.top.width = copingSurface.top.height = 1
    copingSurface.rim.width = copingSurface.rim.height = 1
  }
  return sprites
}
function buildFloorPath(floor: DungeonFloor) {
  const path = new Path2D()
  for (let y = 0; y < floor.height; y++)
    for (let x = 0; x < floor.width; x++)
      if (visualOpen(floor.tiles[y]?.[x])) path.addPath(rectangle(x * 32 - 6, y * 32 - 6, 44, 44))
  return path
}
async function built(
  options: FoundationOptions,
  source?: FoundationScene,
  material?: FoundationArt,
) {
  const key = `${options.treatment ?? 'ruins'}:${options.doors ?? 'closed'}:${options.secret ?? 'none'}:${options.separation !== false}:${options.floor ?? 'refined'}:${!!options.capPolish}:${options.capEffects?.join(',') ?? 'all'}:${options.coping ?? 'current'}:${options.capProfile ?? 'raised'}:${options.capFinish ?? 'soft'}:${options.stairs ?? 'none'}:${options.torches ?? 'current'}`
  const cached = source || material ? undefined : scenes.get(key)
  if (cached) return cached
  const scene =
    source ?? createFoundationScene(options.secret === 'hidden' || options.secret === 'revealed')
  const renderOptions: DimensionalOptions = { revealSecrets: options.secret === 'revealed' }
  const plan = createDimensionalPlan(scene.floor, renderOptions),
    art =
      material ??
      (await loadFoundationArt(options.treatment, options.separation !== false, options.floor))
  const result: BuiltScene = {
    scene,
    plan,
    art,
    atlas: buildArchitecture(
      scene,
      plan,
      art,
      {
        ...options,
        capPolish: options.coping && options.coping !== 'current' ? false : !!options.capPolish,
      },
      options.coping && options.coping !== 'current'
        ? await loadCopingArt(art.treatment)
        : undefined,
    ),
    floorPath: buildFloorPath(plan.floor),
  }
  if (options.torches === 'mounted') result.torchArt = await loadMountedTorchArt()
  if (options.capProfile === 'chamfered' && options.coping === 'hewn')
    result.chamfer = buildCapChamfer(
      [
        ...plan.walls.map((w) => ({ x: w.x, y: w.y, mask: w.mask, corner: w.cornerFill })),
        ...plan.doors.map((d) => ({
          x: d.position.x,
          y: d.position.y,
          mask: d.orientation === 'north-south' ? 10 : 5,
          corner: 0,
          door: true,
        })),
      ],
      plan.floor,
      await loadCopingArt(art.treatment),
      options.capFinish,
    )
  // Comparison holds the accepted floor contact and broad edge tone constant.
  const contactSource =
    options.coping && options.coping !== 'current'
      ? {
          ...result,
          atlas: buildArchitecture(scene, plan, art, {
            ...options,
            coping: 'current',
            capPolish: false,
          }),
        }
      : result
  if (options.separation !== false) result.contact = buildContact(contactSource)
  if (floorStudy(art.floorTreatment).edgeTone)
    result.edgeTone = buildContact(contactSource, 20, 0.18)
  if (contactSource !== result && contactSource.atlas.length)
    contactSource.atlas[0]!.image.width = contactSource.atlas[0]!.image.height = 1
  if (!source && !material) scenes.set(key, result)
  while (scenes.size > 4) scenes.delete(scenes.keys().next().value!)
  return result
}
function drawArchitecture(
  c: CanvasRenderingContext2D,
  data: BuiltScene,
  options?: FoundationOptions,
) {
  const stairs = options?.depthSortedStairs
    ? [...data.plan.floor.stairs].sort((a, b) => a.position.y - b.position.y)
    : []
  let cursor = 0
  const nextStair = () => {
    const stair = stairs[cursor++]!
    if (options?.stairs)
      drawFoundationStair(
        c,
        stairArt(data, stair.position),
        stair,
        options.stairs,
        options.stairProfile,
      )
  }
  for (const sprite of data.atlas) {
    while (cursor < stairs.length && stairs[cursor]!.position.y <= sprite.y) nextStair()
    const origin = spriteOrigin(sprite.x, sprite.y),
      d = sprite.definition
    c.drawImage(
      sprite.image,
      d.source.x,
      d.source.y,
      d.source.width,
      d.source.height,
      origin.x - d.anchor.x,
      origin.y - d.anchor.y,
      d.width,
      d.height,
    )
  }
  while (cursor < stairs.length) nextStair()
}
/** One union silhouette avoids dark overlaps at corners and seams between connected tiles. */
function buildContact(data: BuiltScene, blur = 5, opacity = 0.86) {
  const bounds = viewBounds(data.plan.floor),
    width = bounds.width * 2,
    height = bounds.height * 2,
    solid = canvas(width, height),
    s = solid.getContext('2d')!
  s.scale(2, 2)
  s.translate(bounds.origin.x, bounds.origin.y)
  drawArchitecture(s, data)
  s.setTransform(1, 0, 0, 1, 0, 0)
  s.globalCompositeOperation = 'source-in'
  s.fillStyle = '#03070aff'
  s.fillRect(0, 0, width, height)
  const result = canvas(width, height),
    c = result.getContext('2d')!
  c.save()
  c.scale(2, 2)
  c.translate(bounds.origin.x, bounds.origin.y)
  c.clip(data.floorPath)
  c.setTransform(1, 0, 0, 1, 0, 0)
  c.filter = `blur(${blur}px)`
  c.globalAlpha = opacity
  c.drawImage(solid, 0, 0)
  c.filter = 'none'
  c.globalAlpha = 1
  c.globalCompositeOperation = 'destination-out'
  c.drawImage(solid, 0, 0)
  c.restore()
  solid.width = solid.height = 1
  return result
}
function drawGround(c: CanvasRenderingContext2D, data: BuiltScene) {
  c.save()
  c.clip(data.floorPath)
  c.scale(1, P.depth)
  c.translate(160, 160)
  c.fillStyle = data.art.floor
  c.fillRect(-160, -160, data.plan.floor.width * 32 + 160, data.plan.floor.height * 32 + 160)
  c.restore()
  if (data.surfaces) {
    const paths = new Map<FoundationFloor, Path2D>()
    for (const [key, material] of data.surfaces.assignments) {
      const path = paths.get(material) ?? new Path2D(),
        x = key % data.plan.floor.width,
        y = Math.floor(key / data.plan.floor.width)
      path.addPath(rectangle(x * 32 - 6, y * 32 - 6, 44, 44))
      paths.set(material, path)
    }
    for (const [material, path] of paths) {
      c.save()
      c.clip(data.floorPath)
      c.clip(path)
      c.scale(1, P.depth)
      c.translate(160, 160)
      c.fillStyle = data.surfaces.patterns.get(material)!
      c.fillRect(-160, -160, data.plan.floor.width * 32 + 160, data.plan.floor.height * 32 + 160)
      c.restore()
    }
  }
  // Fitted, floor-level threshold surfaces meet the doorway's visible face baseline.
  for (const door of data.plan.doors) {
    const { x, y } = door.position,
      ns = door.orientation === 'north-south'
    if (data.art.sill) {
      c.save()
      c.scale(1, P.depth)
      c.translate(x * 32, y * 32)
      if (!ns) {
        c.translate(32, 0)
        c.rotate(Math.PI / 2)
      }
      const sillY = ns ? 22 : 0
      c.drawImage(data.art.sill, 1, sillY, 30, 10)
      const contact = c.createLinearGradient(0, sillY + 3, 0, sillY + 8)
      contact.addColorStop(0, '#0b0d0d65')
      contact.addColorStop(1, '#0b0d0d00')
      c.fillStyle = contact
      c.fillRect(3, sillY + 3, 26, 5)
      c.restore()
      continue
    }
    const threshold = rectangle(
      x * 32 + (ns ? 3 : 23),
      y * 32 + (ns ? 23 : 3),
      ns ? 26 : 8,
      ns ? 8 : 26,
    )
    c.save()
    c.clip(threshold)
    c.transform(1, 0, 0, P.depth, 0, 0)
    c.fillStyle = data.art.cap
    c.fillRect(x * 32, y * 32, 32, 32)
    c.restore()
  }
  // Six-pixel floor skirts close the physical gap between the inset wall bases and logical floor cells.
  c.save()
  c.clip(data.floorPath)
  for (const wall of data.plan.walls) {
    const x = wall.x * 32,
      y = wall.y * 32
    for (const [dx, dy] of [
      [0, 1],
      [1, 0],
      [0, -1],
      [-1, 0],
    ]) {
      if (!visualOpen(data.plan.floor.tiles[wall.y + dy!]?.[wall.x + dx!])) continue
      const edge = project(
        x + (dx! > 0 ? 26 : dx! < 0 ? 6 : 0),
        y + (dy! > 0 ? 26 : dy! < 0 ? 6 : 0),
      )
      const end = { x: edge.x + dx! * 7, y: edge.y + dy! * 6 }
      const shadow = c.createLinearGradient(edge.x, edge.y, end.x, end.y)
      shadow.addColorStop(0, '#01080eaa')
      shadow.addColorStop(1, '#01080e00')
      c.fillStyle = shadow
      c.fillRect(
        dx ? Math.min(edge.x, end.x) : x - 1,
        dy ? Math.min(edge.y, end.y) : y * P.depth - 1,
        dx ? 7 : 34,
        dy ? 6 : 28,
      )
    }
  }
  c.restore()
}
function illuminate(
  c: CanvasRenderingContext2D,
  data: BuiltScene,
  open: boolean,
  mounted = false,
  ids: readonly string[] = [],
) {
  const openDoors = new Set(open ? data.plan.doors.map((d) => d.id) : ids)
  for (const torch of data.scene.torches) {
    const face = data.scene.torchFacings?.[`${torch.x},${torch.y}`] ?? 'south',
      reach = mounted
        ? mountedLightCells(data.plan.floor, torch, face, openDoors)
        : dimensionalLightCells(data.plan, torch, openDoors, 5),
      mask = new Path2D()
    for (const cell of reach.floors)
      mask.addPath(rectangle(cell.x * 32 - 6, cell.y * 32 - 6, 44, 44))
    const touched = new Set(reach.walls.map((p) => p.y * data.plan.floor.width + p.x))
    for (const sprite of data.atlas)
      if (touched.has(sprite.y * data.plan.floor.width + sprite.x)) mask.addPath(sprite.path)
    c.save()
    c.clip(mask)
    c.globalCompositeOperation = 'screen'
    const center = mounted
      ? project(
          torch.x * 32 + (face === 'east' ? 40 : 16),
          torch.y * 32 + (face === 'south' ? 40 : 16),
        )
      : project(torch.x * 32 + 16, (torch.y + 1) * 32 + 16)
    const glow = c.createRadialGradient(
      center.x,
      center.y - 10,
      0,
      center.x,
      center.y - 10,
      mounted ? 76 : 104,
    )
    glow.addColorStop(0, mounted ? '#f4bc6650' : '#fbc36c6a')
    glow.addColorStop(0.3, mounted ? '#d28c382c' : '#d28c383c')
    glow.addColorStop(0.65, mounted ? '#93531e0c' : '#93531e12')
    glow.addColorStop(1, '#93531e00')
    c.fillStyle = glow
    c.fillRect(center.x - 110, center.y - 120, 220, 220)
    c.restore()
  }
}
/** Same fixture and pixels for on-screen rendering, comparisons, and PNG export. */
export async function renderFoundation(
  options: FoundationOptions = {},
  source?: FoundationScene,
  material?: FoundationArt,
) {
  // Optional isolated material input supports visual probes without changing cached art.
  return paintFoundation(await built(options, source, material), options)
}
function paintFoundation(data: BuiltScene, options: FoundationOptions, result = canvas(1, 1)) {
  const bounds = viewBounds(data.plan.floor)
  result.width = bounds.width * 2
  result.height = bounds.height * 2
  const c = result.getContext('2d')!
  c.scale(2, 2)
  c.fillStyle = '#080d10'
  c.fillRect(0, 0, bounds.width, bounds.height)
  c.translate(bounds.origin.x, bounds.origin.y)
  drawGround(c, data)
  if (data.edgeTone) {
    c.save()
    c.setTransform(1, 0, 0, 1, 0, 0)
    c.drawImage(data.edgeTone, 0, 0)
    c.restore()
  }
  if (options.stairs && !options.depthSortedStairs)
    for (const stair of data.plan.floor.stairs)
      drawFoundationStair(
        c,
        stairArt(data, stair.position),
        stair,
        options.stairs,
        options.stairProfile,
      )
  if (options.stairs)
    for (const stair of data.plan.floor.stairs)
      if (
        (!data.markers || data.markers.has(stair.id)) &&
        data.markers?.get(stair.id)?.plane !== 'wall'
      )
        drawStairMarker(
          c,
          data.art,
          data.plan.floor,
          stair,
          options.stairArrow,
          data.markers?.get(stair.id),
        )
  drawArchitecture(c, data, options)
  if (data.chamfer) {
    c.save()
    c.setTransform(1, 0, 0, 1, 0, 0)
    c.drawImage(data.chamfer.image, 0, 0)
    c.restore()
  }
  if (options.stairs)
    for (const stair of data.plan.floor.stairs) {
      const marker = data.markers?.get(stair.id)
      if (marker?.plane === 'wall')
        drawStairMarker(c, data.art, data.plan.floor, stair, options.stairArrow, marker)
    }
  if (options.lighting !== false)
    illuminate(
      c,
      data,
      options.doors === 'open',
      options.torches === 'mounted',
      options.openDoorIds,
    )
  if (data.contact) {
    c.save()
    c.setTransform(1, 0, 0, 1, 0, 0)
    c.drawImage(data.contact, 0, 0)
    c.restore()
  }
  for (const torch of data.scene.torches) {
    if (data.torchArt) {
      drawMountedTorch(
        c,
        data.torchArt,
        torch,
        data.scene.torchFacings?.[`${torch.x},${torch.y}`] ?? 'south',
        options.northTorchMount,
      )
      continue
    }
    const p = project(torch.x * 32 + 16, torch.y * 32 + 26, 0.85)
    c.drawImage(data.art.torch, p.x - 4.5, p.y - 6, 9, 23)
  }
  if (options.grid) {
    c.save()
    c.clip(data.floorPath)
    c.strokeStyle = '#e5d8b23b'
    c.lineWidth = 0.5
    c.beginPath()
    for (let x = 0; x <= data.plan.floor.width; x++) {
      c.moveTo(x * 32, 0)
      c.lineTo(x * 32, data.plan.floor.height * 26)
    }
    for (let y = 0; y <= data.plan.floor.height; y++) {
      c.moveTo(0, y * 26)
      c.lineTo(data.plan.floor.width * 32, y * 26)
    }
    c.stroke()
    c.restore()
  }
  return result
}
function stairArt(data: BuiltScene, position: Position): FoundationArt {
  const key = position.y * data.plan.floor.width + position.x,
    material = data.surfaces?.assignments.get(key),
    floor = material ? data.surfaces?.patterns.get(material) : undefined
  return floor ? { ...data.art, floor } : data.art
}
function releaseConstruction(data: BuiltScene) {
  for (const image of new Set(data.atlas.map((a) => a.image))) image.width = image.height = 1
  if (data.contact) data.contact.width = data.contact.height = 1
  if (data.edgeTone) data.edgeTone.width = data.edgeTone.height = 1
  if (data.chamfer) data.chamfer.image.width = data.chamfer.image.height = 1
}
/** Production uses the exact approved compositor, then releases construction-sized buffers.
 * Only patterns and lightweight paths survive for picking and localized walk cutaways. */
export async function composeFoundation(
  source: FoundationScene,
  options: FoundationOptions,
  assignments = new Map<number, FoundationFloor>(),
) {
  const data = await built(options, source)
  try {
    data.markers = projectedStairMarkers(data.plan.floor, data.plan)
    const patterns = new Map<FoundationFloor, CanvasPattern>()
    await Promise.all(
      [...new Set(assignments.values())].map(async (f) => {
        patterns.set(f, (await loadFoundationArt(options.treatment, true, f)).floor)
      }),
    )
    if (assignments.size) data.surfaces = { assignments, patterns }
    const image = paintFoundation(data, options),
      paths = [...data.atlas].reverse(),
      probe = canvas(1, 1).getContext('2d')!
    releaseConstruction(data)
    return {
      image,
      pick(point: Position) {
        for (const sprite of paths) {
          const origin = spriteOrigin(sprite.x, sprite.y),
            d = sprite.definition,
            x = point.x - origin.x + d.anchor.x,
            y = point.y - origin.y + d.anchor.y
          if (x < 0 || x > d.width || y < 0 || y > d.height) continue
          if (probe.isPointInPath(sprite.path, point.x, point.y))
            return { x: sprite.x, y: sprite.y }
        }
        return null
      },
      groundCell(c: CanvasRenderingContext2D, x: number, y: number) {
        c.save()
        c.beginPath()
        c.rect(x * 32, y * 26, 32, 26)
        c.clip()
        const art = stairArt(data, { x, y })
        c.save()
        c.scale(1, P.depth)
        c.translate(160, 160)
        c.fillStyle = art.floor
        c.fillRect(x * 32 - 160, y * 32 - 160, 32, 32)
        c.restore()
        const stair = data.plan.floor.stairs.find((s) => s.position.x === x && s.position.y === y)
        if (stair && options.stairs)
          drawFoundationStair(c, art, stair, options.stairs, options.stairProfile)
        if (options.stairs)
          for (const s of data.plan.floor.stairs)
            if (
              (!data.markers || data.markers.has(s.id)) &&
              data.markers?.get(s.id)?.plane !== 'wall'
            )
              drawStairMarker(
                c,
                data.art,
                data.plan.floor,
                s,
                options.stairArrow,
                data.markers?.get(s.id),
              )
        c.restore()
      },
      dispose() {
        image.width = image.height = 1
        probe.canvas.width = probe.canvas.height = 1
      },
    }
  } catch (error) {
    releaseConstruction(data)
    throw error
  }
}
/** Review multiple floors on one generated dungeon without rebuilding its architecture. */
export async function prepareFoundationReview(
  source: FoundationScene,
  options: FoundationOptions = {},
) {
  const data = await built({ ...options, floor: 'refined' }, source)
  return {
    async render(floor: FoundationFloor, target?: HTMLCanvasElement) {
      const art = await loadFoundationArt(options.treatment, options.separation !== false, floor)
      const variant = { ...data, art }
      if (!floorStudy(floor).edgeTone) delete variant.edgeTone
      return paintFoundation(variant, options, target)
    },
    dispose() {
      data.atlas[0]!.image.width = data.atlas[0]!.image.height = 1
      if (data.contact) data.contact.width = data.contact.height = 1
      if (data.edgeTone) data.edgeTone.width = data.edgeTone.height = 1
      if (data.chamfer) data.chamfer.image.width = data.chamfer.image.height = 1
    },
  }
}
export async function foundationInventory(options: FoundationOptions = {}) {
  const data = await built(options)
  return {
    treatment: data.art.treatment,
    floorTreatment: data.art.floorTreatment,
    projection: P,
    sourceSizes: data.art.sourceSizes,
    spriteCount: data.atlas.length,
    geometryIds: [
      ...new Set(
        data.atlas
          .filter((s) => s.definition.id.startsWith('wall.'))
          .map((s) => s.definition.id.split('.').slice(0, 3).join('.')),
      ),
    ],
    sprites: data.atlas.map((s) => ({ ...s.definition, position: { x: s.x, y: s.y } })),
  }
}
export async function foundationAtlas(options: FoundationOptions = {}) {
  return (await built(options)).atlas[0]!.image
}
/** Inspection layer: floor-clipped projected contact only, before compositing. */
export async function foundationContact(options: FoundationOptions = {}) {
  return (await built(options)).contact
}
