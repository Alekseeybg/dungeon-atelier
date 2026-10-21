import * as THREE from 'three'
import type { GeometryBatches } from './geometry.ts'
import { dressedBoxGeometry } from './asset-geometry.ts'
import { appearanceHash } from './plan.ts'
import { ruinsDressedStone } from './ruins-placement.ts'
import { stairLevels, type StairLayout } from './stair-layout.ts'
import type { Dungeon3DMaterials } from './materials.ts'

/** Separate real vertical stone faces from the worn upper face; no painted shadow strips. */
export function treadSurfaces(source: THREE.BufferGeometry) {
  const p = source.getAttribute('position'),
    n = source.getAttribute('normal'),
    uv = source.getAttribute('uv'),
    surfaces = [new THREE.BufferGeometry(), new THREE.BufferGeometry()]
  for (let side = 0; side < 2; side++) {
    const positions: number[] = [],
      normals: number[] = [],
      uvs: number[] = []
    for (let i = 0; i < p.count; i += 3) {
      if ((n.getY(i) > 0.5 ? 0 : 1) !== side) continue
      for (let j = i; j < i + 3; j++) {
        positions.push(p.getX(j), p.getY(j), p.getZ(j))
        normals.push(n.getX(j), n.getY(j), n.getZ(j))
        uvs.push(uv.getX(j), uv.getY(j))
      }
    }
    surfaces[side]!.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    surfaces[side]!.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
    surfaces[side]!.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  }
  return { top: surfaces[0]!, edge: surfaces[1]! }
}

/** Two opposed masonry flights, joined by a full-width return landing. No legacy stair geometry. */
export function addStoneStaircase(
  batch: GeometryBatches,
  materials: Dungeon3DMaterials,
  s: StairLayout,
  height: number,
  seed: string,
) {
  const parent = new THREE.Matrix4().makeRotationY(s.rotation).setPosition(s.x, 0, s.z),
    levels = stairLevels(s, height),
    { floor, destination, middle, landing, run, count, rise, going } = levels,
    down = s.direction === 'down',
    straight = s.form === 'straight',
    edge = 0.13,
    gap = 0.045,
    lane = (s.width - 2 * edge - gap) / 2,
    left = edge + lane / 2,
    right = s.width - edge - lane / 2
  let serial = 0
  function stone(
    x: number,
    top: number,
    z: number,
    w: number,
    h: number,
    d: number,
    tread = false,
  ) {
    if (h <= 0.003) return
    const hash = appearanceHash(seed, s.x + serial++, s.z, 2371),
      geometry = dressedBoxGeometry(w, h, d, tread ? 0.012 : 0.008),
      transform = parent.clone().multiply(new THREE.Matrix4().makeTranslation(x, top - h / 2, z))
    const position = new THREE.Vector3(x, top, z).applyMatrix4(parent)
    const add = (g: THREE.BufferGeometry, material: THREE.Material, role: 'tread' | 'riser') =>
      batch.add(
        material,
        g,
        transform,
        null,
        0.88 + hash * 0.13,
        Math.floor(hash * 16),
        Math.floor(hash * 32) % 8,
        ruinsDressedStone(seed, position.x, position.y, position.z, role),
      )
    if (tread) {
      const faces = treadSurfaces(geometry)
      add(faces.top, materials.frame, 'tread')
      add(faces.edge, materials.stairEdge, 'riser')
      faces.top.dispose()
      faces.edge.dispose()
    } else add(geometry, materials.masonry, 'riser')
    geometry.dispose()
  }
  // Bonded supporting masonry, rather than a hollow floating set of stair plates.
  function foundation(x: number, top: number, z: number, w: number, d: number) {
    const base = down ? destination - 0.22 : -0.09,
      courses = Math.max(1, Math.ceil((top - base) / 0.26)),
      course = (top - base) / courses
    for (let row = 0; row < courses; row++) {
      const pieces = Math.max(1, Math.ceil(d / 0.48)),
        length = d / pieces
      // Alternating half-bond joints across the exposed foundation faces.
      const brick = 0.56,
        phase = row % 2 ? brick / 2 : 0
      for (let a = -w / 2 - phase; a < w / 2; a += brick) {
        const l = Math.max(-w / 2, a),
          r = Math.min(w / 2, a + brick)
        if (r - l < 0.025) continue
        for (let p = 0; p < pieces; p++)
          stone(
            x + (l + r) / 2,
            base + (row + 1) * course,
            z - d / 2 + (p + 0.5) * length,
            r - l - 0.008,
            course - 0.009,
            length - 0.008,
          )
      }
    }
  }
  function platform(x: number, top: number, z: number, w: number, d: number) {
    foundation(x, top - 0.1, z, w - 0.025, d - 0.025)
    const rows = Math.max(1, Math.ceil(d / 0.4)),
      columns = Math.max(1, Math.ceil(w / 0.62))
    for (let row = 0; row < rows; row++)
      for (let col = 0; col < columns; col++)
        stone(
          x - w / 2 + ((col + 0.5) * w) / columns,
          top,
          z - d / 2 + ((row + 0.5) * d) / rows,
          w / columns - 0.008,
          0.1,
          d / rows - 0.008,
          true,
        )
  }
  // Entry and destination are full-depth landings, not an arbitrary final tread.
  if (straight) {
    const width = s.width - 2 * edge,
      x = s.width / 2
    platform(x, floor, landing / 2, width, landing)
    const extension = !down && s.upperWall ? 0.19 : 0
    platform(x, destination, s.length - landing / 2 + extension / 2, width, landing + extension)
    for (let i = 0; i < count; i++) {
      const top = floor + rise * (i + 1),
        z = landing + (i + 0.5) * going
      foundation(x, top - 0.09, z, width - 0.025, going)
      stone(x, top, z, width + 0.018, 0.105, going + 0.014, true)
      for (const side of [edge / 2, s.width - edge / 2]) {
        const cheek = down ? floor + 0.065 : top + 0.12
        foundation(side, cheek - 0.075, z, edge, going)
        stone(side, cheek, z, edge + 0.025, 0.075, going - 0.006, true)
      }
    }
    for (const side of [edge / 2, s.width - edge / 2]) {
      const top = down ? floor + 0.065 : destination + 0.22
      foundation(side, top - 0.075, s.length - landing / 2, edge, landing)
      stone(side, top, s.length - landing / 2, edge + 0.025, 0.075, landing - 0.006, true)
    }
    return { ...s, ...levels, design: 'bonded-straight-v1', flights: 1, totalSteps: count, run }
  }
  platform(left, floor, landing / 2, lane, landing)
  platform(s.width / 2, middle, s.length - landing / 2, s.width - 2 * edge, landing)
  const extension = !down && s.upperWall ? edge + 0.19 : 0
  platform(right + extension / 2, destination, landing / 2, lane + extension, landing)
  for (let flight = 0; flight < 2; flight++) {
    const x = flight ? right : left,
      start = flight ? middle : floor
    for (let i = 0; i < count; i++) {
      const top = start + rise * (i + 1),
        z = flight ? s.length - landing - (i + 0.5) * going : landing + (i + 0.5) * going
      foundation(x, top - 0.09, z, lane - 0.025, going)
      // A substantial dressed tread overhangs a recessed, closed stone riser.
      stone(x, top, z, lane + 0.018, 0.105, going + 0.014, true)
    }
  }
  if (down) {
    // Lined open well. The room floor is cut away by exactly this bay's footprint.
    for (const x of [edge / 2, s.width - edge / 2]) {
      foundation(x, floor - 0.015, s.length / 2, edge, s.length)
      for (let i = 0; i < Math.ceil(s.length / 0.5); i++) {
        const d = s.length / Math.ceil(s.length / 0.5)
        stone(x, floor + 0.065, (i + 0.5) * d, edge + 0.04, 0.11, d - 0.008, true)
      }
    }
    foundation(s.width / 2, floor - 0.015, s.length - edge / 2, s.width - 2 * edge, edge)
    stone(s.width / 2, floor + 0.065, s.length - edge / 2, s.width, 0.11, edge + 0.04, true)
    foundation(s.width / 2, floor - 0.015, edge / 2, gap, edge)
  } else {
    // Stepped retaining cheeks tie the two flights into a massive built stair bay.
    for (let flight = 0; flight < 2; flight++) {
      const x = flight ? s.width - edge / 2 : edge / 2
      for (let i = 0; i < count; i++) {
        const top = (flight ? middle : floor) + rise * (i + 1) + 0.12,
          z = flight ? s.length - landing - (i + 0.5) * going : landing + (i + 0.5) * going
        foundation(x, top - 0.075, z, edge, going)
        stone(x, top, z, edge + 0.035, 0.075, going - 0.006, true)
      }
    }
    foundation(s.width / 2, middle + 0.12, s.length - edge / 2, s.width, edge)
    stone(s.width / 2, middle + 0.19, s.length - edge / 2, s.width, 0.07, edge + 0.035, true)
    // Upper arrival terrace ends at coping level, with a low protective outside parapet.
    if (!s.upperWall) {
      foundation(s.width - edge / 2, destination + 0.22, landing / 2, edge, landing)
      stone(s.width - edge / 2, destination + 0.29, landing / 2, edge + 0.035, 0.07, landing, true)
    }
    foundation(s.width / 2 + gap / 2, destination - 0.11, landing / 2, gap, landing)
  }
  return { ...s, ...levels, design: 'bonded-switchback-v1', flights: 2, totalSteps: count * 2, run }
}
