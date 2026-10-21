import * as THREE from 'three'
import atlasUrl from '../../assets/architecture/door-study-materials-v1.png'
import type { GeometryBatches } from './geometry'
import { dressedBoxGeometry } from './asset-geometry'

export type DoorCandidate = 'lintel' | 'arch'

export async function createDoorCandidateMaterials() {
  const image = new Image()
  image.src = atlasUrl
  await image.decode()
  const textures: THREE.Texture[] = [],
    materials: THREE.Material[] = []
  function surface(col: number, row: number, color: string, metalness = 0) {
    const c = document.createElement('canvas')
    c.width = c.height = 512
    c.getContext('2d')!.drawImage(
      image,
      (image.width * col) / 2,
      (image.height * row) / 2,
      image.width / 2,
      image.height / 2,
      0,
      0,
      512,
      512,
    )
    const map = new THREE.CanvasTexture(c)
    map.colorSpace = THREE.SRGBColorSpace
    map.anisotropy = 8
    const bump = new THREE.CanvasTexture(c)
    const m = new THREE.MeshStandardMaterial({
      map,
      bumpMap: bump,
      bumpScale: 0.0008,
      color,
      roughness: 0.86,
      metalness,
    })
    textures.push(map, bump)
    materials.push(m)
    return m
  }
  const oak = surface(0, 0, '#e0b98b'),
    darkOak = surface(0, 0, '#9b7953'),
    iron = surface(1, 0, '#858c88', 0.35),
    stone = surface(0, 1, '#c8bfaa'),
    coal = surface(1, 1, '#7d7268'),
    rivet = new THREE.MeshStandardMaterial({ color: '#73776d', roughness: 0.7, metalness: 0.45 })
  materials.push(rivet)
  coal.emissive.set('#3a1002')
  coal.emissiveMap = coal.map
  coal.emissiveIntensity = 0.4
  return {
    oak,
    darkOak,
    iron,
    stone,
    coal,
    rivet,
    get estimatedTextureBytes() {
      return (textures.length * 512 * 512 * 4 * 4) / 3
    },
    setWireframe(value: boolean) {
      for (const m of materials)
        if (m instanceof THREE.MeshStandardMaterial) {
          m.wireframe = value
          m.needsUpdate = true
        }
    },
    invalidateShaders() {
      materials.forEach((m) => (m.needsUpdate = true))
    },
    dispose() {
      materials.forEach((m) => m.dispose())
      textures.forEach((t) => t.dispose())
    },
  }
}
type Materials = Awaited<ReturnType<typeof createDoorCandidateMaterials>>
function mapStone(g: THREE.BufferGeometry) {
  g.computeBoundingBox()
  const p = g.getAttribute('position'),
    n = g.getAttribute('normal'),
    uv = g.getAttribute('uv'),
    bounds = g.boundingBox!,
    size = bounds.getSize(new THREE.Vector3())
  for (let i = 0; i < p.count; i++) {
    const nx = Math.abs(n.getX(i)),
      ny = Math.abs(n.getY(i)),
      nz = Math.abs(n.getZ(i)),
      x = (p.getX(i) - bounds.min.x) / size.x,
      y = (p.getY(i) - bounds.min.y) / size.y,
      z = (p.getZ(i) - bounds.min.z) / size.z
    if (ny > nx && ny > nz) uv.setXY(i, x, z)
    else if (nx > nz) uv.setXY(i, z, y)
    else uv.setXY(i, x, y)
  }
}
const pose = (parent: THREE.Matrix4, x: number, y: number, z: number) =>
  parent.clone().multiply(new THREE.Matrix4().setPosition(x, y, z))
function box(
  b: GeometryBatches,
  m: THREE.Material,
  parent: THREE.Matrix4,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  bevel = 0.008,
) {
  const g = dressedBoxGeometry(w, h, d, bevel)
  b.add(m, g, pose(parent, x, y, z), null)
  g.dispose()
}
function pin(
  b: GeometryBatches,
  m: THREE.Material,
  parent: THREE.Matrix4,
  x: number,
  y: number,
  z: number,
  r = 0.015,
) {
  const g = new THREE.SphereGeometry(r, 10, 6)
  b.add(m, g, pose(parent, x, y, z), null)
  g.dispose()
}

/** Independently modeled alternatives; existing door geometry is never called or modified. */
export function addDoorCandidate(
  b: GeometryBatches,
  m: Materials,
  parent: THREE.Matrix4,
  variant: DoorCandidate,
  open = false,
  options: { surround?: boolean; squareTop?: boolean } = {},
) {
  const arch = variant === 'arch',
    width = 0.76,
    spring = 1.36,
    leaf = parent
      .clone()
      .multiply(new THREE.Matrix4().setPosition(-width / 2, 0, -0.07))
      .multiply(new THREE.Matrix4().makeRotationY(open ? -Math.PI * 0.43 : 0)),
    wood = arch ? m.darkOak : m.oak,
    count = arch ? 8 : 6
  // Chunky, separately dressed quoin stones, rather than a thin frame around the old leaf.
  if (options.surround !== false) {
    for (const side of [-1, 1])
      for (let row = 0; row < (arch ? 4 : 5); row++) {
        const h = (arch ? spring : 1.68) / (arch ? 4 : 5),
          w = row % 2 === 0 ? 0.225 : 0.19
        box(
          b,
          m.stone,
          parent,
          side * (0.38 + w / 2 + 0.012),
          (row + 0.5) * h,
          0.035,
          w,
          h - 0.014,
          0.78,
          0.015,
        )
      }
    if (arch) {
      for (let i = 0; i < 9; i++) {
        const a = (i * Math.PI) / 9 + 0.012,
          c = ((i + 1) * Math.PI) / 9 - 0.012,
          shape = new THREE.Shape([
            new THREE.Vector2(Math.cos(a) * 0.395, spring + Math.sin(a) * 0.31),
            new THREE.Vector2(Math.cos(a) * 0.61, spring + Math.sin(a) * 0.57),
            new THREE.Vector2(Math.cos(c) * 0.61, spring + Math.sin(c) * 0.57),
            new THREE.Vector2(Math.cos(c) * 0.395, spring + Math.sin(c) * 0.31),
          ]),
          g = new THREE.ExtrudeGeometry(shape, {
            depth: 0.76,
            bevelEnabled: true,
            bevelSize: 0.006,
            bevelThickness: 0.006,
            bevelSegments: 1,
            steps: 1,
          }).translate(0, 0, -0.345)
        mapStone(g)
        b.add(m.stone, g, parent, null)
        g.dispose()
      }
      // Stone spandrel above the arch closes the wall below the unchanged coping.
      const outline: THREE.Vector2[] = []
      for (let i = 0; i <= 18; i++) {
        const a = Math.PI - (i * Math.PI) / 18
        outline.push(new THREE.Vector2(Math.cos(a) * 0.61, spring + Math.sin(a) * 0.57))
      }
      outline.push(new THREE.Vector2(0.61, 2), new THREE.Vector2(-0.61, 2))
      const g = new THREE.ExtrudeGeometry(new THREE.Shape(outline), {
        depth: 0.61,
        bevelEnabled: false,
        steps: 1,
      }).translate(0, 0, -0.305)
      mapStone(g)
      b.add(m.stone, g, parent, null)
      g.dispose()
    } else {
      box(b, m.stone, parent, 0, 1.825, 0.035, 1.24, 0.275, 0.78, 0.018)
      // A recessed stone inner stop makes the deep opening legible around the timber.
      for (const s of [-1, 1])
        box(b, m.stone, parent, s * 0.365, 0.85, -0.22, 0.035, 1.65, 0.09, 0.006)
    }
    box(b, m.stone, parent, 0, 0.035, 0.1, 1.17, 0.065, 0.9, 0.01)
  }
  for (let i = 0; i < count; i++) {
    const l = (i * width) / count + 0.003,
      r = ((i + 1) * width) / count - 0.003,
      top = (x: number) =>
        arch && !options.squareTop
          ? spring + 0.29 * Math.sqrt(Math.max(0, 1 - ((x - width / 2) / (width / 2)) ** 2))
          : 1.65,
      outline = [new THREE.Vector2(l, 0.075), new THREE.Vector2(r, 0.075)]
    for (let j = 0; j <= 4; j++) {
      const x = r - ((r - l) * j) / 4
      outline.push(new THREE.Vector2(x, top(x)))
    }
    const g = new THREE.ExtrudeGeometry(new THREE.Shape(outline), {
        depth: arch ? 0.2 : 0.18,
        bevelEnabled: true,
        bevelSize: 0.0025,
        bevelThickness: 0.0025,
        bevelSegments: 1,
        steps: 1,
      }).translate(0, 0, arch ? -0.1 : -0.09),
      p = g.getAttribute('position'),
      uv = g.getAttribute('uv')
    for (let k = 0; k < p.count; k++)
      uv.setXY(k, 0.04 + i * 0.115 + (p.getX(k) - l) / width, p.getY(k) / 1.72)
    b.add(wood, g, leaf, null)
    g.dispose()
  }
  for (const side of [-1, 1]) {
    for (const y of arch ? [0.28, 0.86, 1.35] : [0.36, 1.32]) {
      box(
        b,
        m.iron,
        leaf,
        width / 2,
        y,
        side * 0.113,
        width - 0.02,
        arch ? 0.1 : 0.145,
        0.028,
        0.004,
      )
      for (let i = 0; i < 6; i++)
        pin(
          b,
          m.rivet,
          leaf,
          0.055 + (i * (width - 0.11)) / 5,
          y,
          side * 0.136,
          arch ? 0.012 : 0.016,
        )
      const hinge = new THREE.CylinderGeometry(0.027, 0.027, 0.19, 12)
      b.add(m.iron, hinge, pose(leaf, 0.018, y, side * 0.12), null)
      hinge.dispose()
    }
    if (arch)
      for (const x of [0.035, width - 0.035])
        box(b, m.iron, leaf, x, 0.8, side * 0.115, 0.05, 1.43, 0.024, 0.003)
    const hx = width - 0.17,
      hy = arch ? 0.7 : 0.86
    box(b, m.iron, leaf, hx, hy + 0.025, side * 0.12, 0.14, 0.2, 0.025, 0.008)
    for (const s of [-1, 1]) pin(b, m.rivet, leaf, hx + s * 0.043, hy + 0.085, side * 0.143, 0.012)
    const staple = new THREE.TorusGeometry(0.025, 0.009, 8, 16).rotateY(Math.PI / 2)
    b.add(m.iron, staple, pose(leaf, hx, hy + 0.04, side * 0.155), null)
    staple.dispose()
    const ring = new THREE.TorusGeometry(arch ? 0.067 : 0.081, 0.014, 10, 28).scale(1, 1.12, 1)
    b.add(m.iron, ring, pose(leaf, hx, hy - 0.035, side * 0.185), null)
    ring.dispose()
  }
}
