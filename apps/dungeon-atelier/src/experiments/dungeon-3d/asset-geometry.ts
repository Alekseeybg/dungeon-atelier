import * as THREE from 'three'
import { rectangleContours } from './asset-model.ts'
import type { Point, StoneSlab } from './asset-model.ts'

const area = (loop: Point[]) =>
  loop.reduce((sum, p, i) => {
    const q = loop[(i + 1) % loop.length]!
    return sum + p.x * q.z - q.x * p.z
  }, 0) / 2
function inset(loop: Point[], distance: number) {
  return loop.map((p, i) => {
    const previous = loop[(i + loop.length - 1) % loop.length]!,
      next = loop[(i + 1) % loop.length]!,
      a = new THREE.Vector2(p.z - previous.z, previous.x - p.x).normalize(),
      b = new THREE.Vector2(next.z - p.z, p.x - next.x).normalize(),
      det = a.x * b.y - a.y * b.x
    return { x: p.x + (distance * (a.y - b.y)) / det, z: p.z + (distance * (b.x - a.x)) / det }
  })
}
function contains(loop: Point[], p: Point) {
  let inside = false
  for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
    const a = loop[i]!,
      b = loop[j]!
    if (a.z > p.z !== b.z > p.z && p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x)
      inside = !inside
  }
  return inside
}

/** Actual beveled slab bodies; inset first so the bevel never closes the recessed joints. */
export function slabGeometry(slab: StoneSlab) {
  const contours = rectangleContours(slab.rects),
    shapes: THREE.Shape[] = [],
    minX = Math.min(...slab.rects.map((r) => r.x)),
    maxX = Math.max(...slab.rects.map((r) => r.x + r.width)),
    minZ = Math.min(...slab.rects.map((r) => r.z)),
    maxZ = Math.max(...slab.rects.map((r) => r.z + r.depth))
  for (const loop of contours.filter((p) => area(p) > 0)) {
    const xs = loop.map((p) => p.x),
      zs = loop.map((p) => p.z)
    if (
      Math.max(...xs) - Math.min(...xs) < 0.09 ||
      Math.max(...zs) - Math.min(...zs) < 0.09 ||
      area(loop) < 0.012
    )
      continue
    const ring = inset(loop, 0.024)
    if (ring.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.z))) continue
    const shape = new THREE.Shape(ring.map((p) => new THREE.Vector2(p.x, -p.z)))
    for (const hole of contours.filter((p) => area(p) < 0 && contains(loop, p[0]!))) {
      const points = inset(hole, 0.024)
      shape.holes.push(new THREE.Path(points.map((p) => new THREE.Vector2(p.x, -p.z))))
    }
    shapes.push(shape)
  }
  if (!shapes.length) return null
  const geometry = new THREE.ExtrudeGeometry(shapes, {
      depth: 0.038,
      bevelEnabled: true,
      bevelSize: 0.01,
      bevelThickness: 0.008,
      bevelSegments: 1,
      steps: 1,
      curveSegments: 1,
    })
      .rotateX(-Math.PI / 2)
      .translate(0, slab.top - 0.046, 0),
    positions = geometry.getAttribute('position'),
    uv = geometry.getAttribute('uv')
  for (let i = 0; i < positions.count; i++)
    uv.setXY(
      i,
      (positions.getX(i) - minX) / (maxX - minX),
      1 - (positions.getZ(i) - minZ) / (maxZ - minZ),
    )
  return geometry
}

/** Low-poly dressed timber/stone, with a consistent bevel measured in world units. */
export function dressedBoxGeometry(width: number, height: number, depth: number, bevel = 0.006) {
  const shape = new THREE.Shape([
      new THREE.Vector2(-width / 2 + bevel, -height / 2 + bevel),
      new THREE.Vector2(width / 2 - bevel, -height / 2 + bevel),
      new THREE.Vector2(width / 2 - bevel, height / 2 - bevel),
      new THREE.Vector2(-width / 2 + bevel, height / 2 - bevel),
    ]),
    geometry = new THREE.ExtrudeGeometry(shape, {
      depth: depth - 2 * bevel,
      bevelEnabled: true,
      bevelSize: bevel,
      bevelThickness: bevel,
      bevelSegments: 1,
      steps: 1,
      curveSegments: 1,
    }).translate(0, 0, -depth / 2 + bevel),
    p = geometry.getAttribute('position'),
    n = geometry.getAttribute('normal'),
    uv = geometry.getAttribute('uv')
  for (let i = 0; i < p.count; i++) {
    const nx = Math.abs(n.getX(i)),
      ny = Math.abs(n.getY(i)),
      nz = Math.abs(n.getZ(i))
    if (ny > nx && ny > nz) uv.setXY(i, p.getX(i) / width + 0.5, p.getZ(i) / depth + 0.5)
    else if (nx > nz) uv.setXY(i, p.getZ(i) / depth + 0.5, p.getY(i) / height + 0.5)
    else uv.setXY(i, p.getX(i) / width + 0.5, p.getY(i) / height + 0.5)
  }
  return geometry
}

/** A calmer shallow edge than the previous protruding ten-triangle wall patches. */
export function dressedMasonryGeometry() {
  const vertices: number[] = [],
    uvs: number[] = [],
    outer = [
      [-0.5, -0.5, 0],
      [0.5, -0.5, 0],
      [0.5, 0.5, 0],
      [-0.5, 0.5, 0],
    ],
    inner = [
      [-0.485, -0.475, 1],
      [0.485, -0.475, 1],
      [0.485, 0.475, 1],
      [-0.485, 0.475, 1],
    ]
  function quad(points: number[][]) {
    for (const i of [0, 1, 2, 0, 2, 3]) {
      const p = points[i]!
      vertices.push(...p)
      uvs.push(p[0]! + 0.5, p[1]! + 0.5)
    }
  }
  quad(inner)
  for (let i = 0; i < 4; i++) quad([outer[i]!, outer[(i + 1) % 4]!, inner[(i + 1) % 4]!, inner[i]!])
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  g.computeVertexNormals()
  return g
}
