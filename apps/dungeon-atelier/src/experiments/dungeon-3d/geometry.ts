import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { RuinsPlacement } from './ruins-placement.ts'

/** Merge static geometry per material, retaining coherent world-space texture coordinates. */
export class GeometryBatches {
  /** Optional grid cell owning a door/torch; -1 means ordinary spatial masonry. */
  walkOwner = -1
  private batches = new Map<THREE.Material, THREE.BufferGeometry[]>()
  add(
    material: THREE.Material,
    source: THREE.BufferGeometry,
    matrix = new THREE.Matrix4(),
    period: number | 'wall' | null = 8,
    tint = 1,
    atlas?: number,
    uvTurn = 0,
    ruins?: RuinsPlacement,
  ) {
    const geometry = source.index ? source.toNonIndexed() : source.clone()
    const grainPositions = ruins?.grainScale
        ? geometry.getAttribute('position').clone()
        : undefined,
      grainNormals = ruins?.grainScale ? geometry.getAttribute('normal').clone() : undefined
    geometry.applyMatrix4(matrix)
    const positions = geometry.getAttribute('position'),
      normals = geometry.getAttribute('normal'),
      uv = geometry.getAttribute('uv'),
      colors = new Float32Array(positions.count * 3),
      ruleUv = new Float32Array(positions.count * 2),
      rule = new Float32Array(positions.count),
      ruleTone = new Float32Array(positions.count)
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i),
        y = positions.getY(i),
        z = positions.getZ(i),
        nx = Math.abs(normals.getX(i)),
        ny = Math.abs(normals.getY(i))
      if (ruins) {
        let u = uv.getX(i),
          v = uv.getY(i)
        if (ruins.grainScale && grainPositions && grainNormals) {
          // Local dressed-box coordinates retain physical grain density on every stone face.
          const p = grainPositions,
            n = grainNormals,
            ax = Math.abs(n.getX(i)),
            ay = Math.abs(n.getY(i)),
            az = Math.abs(n.getZ(i))
          u =
            0.5 +
            (ay > ax && ay > az ? p.getX(i) : ax > az ? p.getZ(i) : p.getX(i)) / ruins.grainScale
          v = 0.5 + (ay > ax && ay > az ? p.getZ(i) : p.getY(i)) / ruins.grainScale
        }
        for (let turn = 0; turn < ruins.turn % 4; turn++) {
          const previous = u
          u = 1 - v
          v = previous
        }
        ruleUv[i * 2] = (4 + (ruins.atlas % 6) + 0.02 + u * 0.96) / 10
        ruleUv[i * 2 + 1] = (3 - Math.floor(ruins.atlas / 6) + 0.02 + v * 0.96) / 4
        rule[i] = 1
        ruleTone[i] = ruins.tint
      }
      if (atlas !== undefined) {
        let u = uv.getX(i),
          v = uv.getY(i)
        if (uvTurn >= 4) u = 1 - u
        for (let turn = 0; turn < uvTurn % 4; turn++) {
          const previous = u
          u = 1 - v
          v = previous
        }
        uv.setXY(
          i,
          ((atlas % 4) + 0.02 + u * 0.96) / 4,
          (Math.floor(atlas / 4) + 0.02 + v * 0.96) / 4,
        )
      } else if (period !== null) {
        const scale = period === 'wall' ? 8 : period
        uv.setXY(
          i,
          (ny > 0.25 ? x : nx > 0.7 ? z : x) / scale,
          ny > 0.25 ? -z / scale : y / (period === 'wall' ? 0.75 : scale),
        )
      }
      colors.fill(tint, i * 3, i * 3 + 3)
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geometry.setAttribute(
      'walkOwner',
      new THREE.BufferAttribute(new Float32Array(positions.count).fill(this.walkOwner), 1),
    )
    geometry.setAttribute('ruinsUv', new THREE.BufferAttribute(ruleUv, 2))
    geometry.setAttribute('ruinsRule', new THREE.BufferAttribute(rule, 1))
    geometry.setAttribute('ruinsTone', new THREE.BufferAttribute(ruleTone, 1))
    const list = this.batches.get(material) ?? []
    list.push(geometry)
    this.batches.set(material, list)
  }
  box(
    material: THREE.Material,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    parent = new THREE.Matrix4(),
    period: number | 'wall' | null = 8,
    tint = 1,
  ) {
    const source = new THREE.BoxGeometry(1, 1, 1),
      matrix = new THREE.Matrix4().compose(
        new THREE.Vector3(x, y, z),
        new THREE.Quaternion(),
        new THREE.Vector3(w, h, d),
      )
    this.add(material, source, parent.clone().multiply(matrix), period, tint)
    source.dispose()
  }
  finish() {
    const group = new THREE.Group()
    for (const [material, parts] of this.batches) {
      const geometry = mergeGeometries(parts)
      parts.forEach((p) => p.dispose())
      if (!geometry) throw new Error('Could not merge prototype geometry.')
      const mesh = new THREE.Mesh(geometry, material)
      mesh.castShadow = !material.transparent
      mesh.receiveShadow = true
      group.add(mesh)
    }
    this.batches.clear()
    return group
  }
}

/** Front and four shallow chiseled edges: ten triangles per block, fewer than the old boxes. */
export function masonryFaceGeometry() {
  const vertices: number[] = [],
    uvs: number[] = []
  const outer = [
      [-0.5, -0.5, 0],
      [0.5, -0.5, 0],
      [0.5, 0.5, 0],
      [-0.5, 0.5, 0],
    ],
    inner = [
      [-0.475, -0.46, 1],
      [0.475, -0.46, 1],
      [0.475, 0.46, 1],
      [-0.475, 0.46, 1],
    ]
  function quad(points: number[][]) {
    for (const index of [0, 1, 2, 0, 2, 3]) {
      const p = points[index]!
      vertices.push(...p)
      uvs.push(p[0]! + 0.5, p[1]! + 0.5)
    }
  }
  quad(inner)
  for (let i = 0; i < 4; i++) quad([outer[i]!, outer[(i + 1) % 4]!, inner[(i + 1) % 4]!, inner[i]!])
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.computeVertexNormals()
  return geometry
}
export function disposeGeometry(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>()
  root.traverse((node) => {
    if (node instanceof THREE.Mesh && node.geometry instanceof THREE.BufferGeometry)
      geometries.add(node.geometry as THREE.BufferGeometry)
  })
  geometries.forEach((g) => g.dispose())
}

/** Trace the union of the existing inset wall footprint, including connected arms/corners. */
export function copingGeometry(
  rects: { x: number; z: number; width: number; depth: number }[],
  x: number,
  z: number,
  occupied: (x: number, z: number) => boolean = () => false,
  wear?: number,
) {
  const steps = [0, 3 / 16, 13 / 16, 1],
    edges: number[][] = [],
    inside = (a: number, b: number) =>
      rects.some(
        (r) =>
          x + a >= r.x - 1e-6 &&
          x + a < r.x + r.width - 1e-6 &&
          z + b >= r.z - 1e-6 &&
          z + b < r.z + r.depth - 1e-6,
      )
  for (let row = 0; row < 3; row++)
    for (let col = 0; col < 3; col++) {
      const l = steps[col]!,
        r = steps[col + 1]!,
        t = steps[row]!,
        b = steps[row + 1]!
      if (!inside((l + r) / 2, (t + b) / 2)) continue
      if (!inside((l + r) / 2, t - 0.001)) edges.push([l, t, r, t])
      if (!inside(r + 0.001, (t + b) / 2)) edges.push([r, t, r, b])
      if (!inside((l + r) / 2, b + 0.001)) edges.push([r, b, l, b])
      if (!inside(l - 0.001, (t + b) / 2)) edges.push([l, b, l, t])
    }
  const start = edges.shift()
  if (!start) throw new Error('Empty coping footprint.')
  const outline = [new THREE.Vector2(start[0], start[1]), new THREE.Vector2(start[2], start[3])]
  let a = start[2]!,
    b = start[3]!
  while (edges.length) {
    const index = edges.findIndex((e) => e[0] === a && e[1] === b)
    if (index < 0) throw new Error('Disconnected coping outline.')
    const edge = edges.splice(index, 1)[0]!
    a = edge[2]!
    b = edge[3]!
    outline.push(new THREE.Vector2(a, b))
  }
  outline.pop() // Closing endpoint is already the first vertex.
  const exposed = outline.map((p, i) => {
    const next = outline[(i + 1) % outline.length]!,
      direction = next.clone().sub(p).normalize(),
      nx = direction.y,
      nz = -direction.x
    return !occupied(x + (p.x + next.x) / 2 + nx * 0.001, z + (p.y + next.y) / 2 + nz * 0.001)
  })
  return capProfileGeometry(outline, exposed, wear)
}

export const CAP_PROFILE = Object.freeze({
  bottom: 0,
  shoulder: 0.015,
  top: 0.085,
  chamfer: 0.085,
  joint: 0.003,
})

/** An inward cut: flat top → planar chamfer → vertical face, entirely inside the wall footprint. */
export function capProfileGeometry(outline: THREE.Vector2[], exposed: boolean[], wear?: number) {
  const normals = outline.map((p, i) => {
      const d = outline[(i + 1) % outline.length]!.clone().sub(p).normalize()
      return new THREE.Vector2(d.y, -d.x)
    }),
    top = outline.map((p, i) => {
      const previous = (i + outline.length - 1) % outline.length,
        a = normals[previous]!,
        b = normals[i]!,
        wa = exposed[previous] ? CAP_PROFILE.chamfer : CAP_PROFILE.joint,
        wb = exposed[i] ? CAP_PROFILE.chamfer : CAP_PROFILE.joint,
        det = a.x * b.y - a.y * b.x
      if (Math.abs(det) < 1e-8) return p.clone().addScaledVector(b, -Math.max(wa, wb))
      return p
        .clone()
        .add(new THREE.Vector2((-wa * b.y + wb * a.y) / det, (-wb * a.x + wa * b.x) / det))
    }),
    positions: number[] = [],
    uvs: number[] = []
  function triangle(
    a: THREE.Vector2,
    ay: number,
    b: THREE.Vector2,
    by: number,
    c: THREE.Vector2,
    cy: number,
  ) {
    for (const [p, y] of [
      [a, ay],
      [b, by],
      [c, cy],
    ] as const) {
      positions.push(p.x, y, p.y)
      uvs.push(p.x, 1 - p.y)
    }
  }
  const topTriangles = THREE.ShapeUtils.triangulateShape(
    top.map((p) => new THREE.Vector2(p.x, -p.y)),
    [],
  )
  for (const t of topTriangles)
    triangle(
      top[t[0]!]!,
      CAP_PROFILE.top,
      top[t[1]!]!,
      CAP_PROFILE.top,
      top[t[2]!]!,
      CAP_PROFILE.top,
    )
  for (let i = 0; i < outline.length; i++) {
    const j = (i + 1) % outline.length,
      hash = Math.imul((wear ?? 0) + 1, 0x45d9f3b) ^ Math.imul(i + 1, 0x27d4eb2d),
      choice = ((hash ^ (hash >>> 16)) >>> 0) / 4294967295,
      chipped =
        wear !== undefined &&
        exposed[i] &&
        choice > 0.56 &&
        outline[i]!.distanceTo(outline[j]!) > 0.4,
      center = 0.3 + choice * 0.35,
      ts = chipped ? [0, center - 0.07, center, center + 0.07, 1] : [0, 1],
      points = ts.map((t, k) => {
        const base = outline[i]!.clone().lerp(outline[j]!, t),
          depth = chipped && k === 2 ? 0.018 + choice * 0.018 : 0
        return {
          base,
          shoulder: base.clone().addScaledVector(normals[i]!, -depth),
          sy: CAP_PROFILE.shoulder - depth * 0.25,
          top: top[i]!.clone().lerp(top[j]!, t),
        }
      })
    for (let k = 0; k < points.length - 1; k++) {
      const a = points[k]!,
        b = points[k + 1]!
      triangle(a.base, CAP_PROFILE.bottom, a.shoulder, a.sy, b.shoulder, b.sy)
      triangle(a.base, CAP_PROFILE.bottom, b.shoulder, b.sy, b.base, CAP_PROFILE.bottom)
      triangle(a.shoulder, a.sy, a.top, CAP_PROFILE.top, b.top, CAP_PROFILE.top)
      triangle(a.shoulder, a.sy, b.top, CAP_PROFILE.top, b.shoulder, b.sy)
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.computeVertexNormals()
  return geometry
}

export function doorCopingGeometry(width: number, depth: number, wear?: number) {
  const geometry = capProfileGeometry(
    [
      new THREE.Vector2(-width / 2, -depth / 2),
      new THREE.Vector2(width / 2, -depth / 2),
      new THREE.Vector2(width / 2, depth / 2),
      new THREE.Vector2(-width / 2, depth / 2),
    ],
    [true, false, true, false],
    wear,
  )
  const uv = geometry.getAttribute('uv')
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) + 0.5, uv.getY(i) - 0.5)
  return geometry
}
