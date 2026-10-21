import * as THREE from 'three'
import { dressedBoxGeometry } from './asset-geometry'
import { appearanceHash } from './plan'
import type { GeometryBatches } from './geometry'
import type { Dungeon3DMaterials } from './materials'

const local = (x: number, y: number, z: number) => new THREE.Matrix4().setPosition(x, y, z)
function dressed(
  batch: GeometryBatches,
  material: THREE.Material,
  parent: THREE.Matrix4,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  bevel = 0.006,
  tint = 1,
  atlas?: number,
) {
  const g = dressedBoxGeometry(w, h, d, bevel)
  batch.add(material, g, parent.clone().multiply(local(x, y, z)), null, tint, atlas)
  g.dispose()
}

export function addDoorFrame(
  batch: GeometryBatches,
  m: Dungeon3DMaterials,
  parent: THREE.Matrix4,
  height: number,
  opening: number,
  head: boolean,
  threshold = true,
) {
  const course = height / 5
  for (const sign of [-1, 1])
    for (let row = 0; row < 5; row++)
      dressed(
        batch,
        m.frame,
        parent,
        sign * 0.47,
        (row + 0.5) * course,
        0,
        0.18,
        course - 0.012,
        0.74,
        0.012,
        0.98 + (row % 2) * 0.025,
        (row * 3 + (sign > 0 ? 2 : 0)) % 16,
      )
  if (head)
    for (let stone = 0; stone < 3; stone++)
      dressed(
        batch,
        m.frame,
        parent,
        ((stone - 1) * 0.76) / 3,
        (height + opening) / 2,
        0,
        0.76 / 3 - 0.006,
        height - opening,
        0.74,
        0.012,
        1,
        stone * 5,
      )
  for (let stone = 0; threshold && stone < 5; stone++)
    dressed(
      batch,
      m.step,
      parent,
      -0.49 + (stone + 0.5) * 0.196,
      0.025,
      0.03,
      0.188,
      0.05,
      0.82,
      0.005,
    )
}

/** The established hinge and portal stay put; all added details travel with the leaf. */
export function addDoorLeaf(
  batch: GeometryBatches,
  m: Dungeon3DMaterials,
  leaf: THREE.Matrix4,
  width: number,
  opening: number,
  seed: string,
  doorX: number,
  doorZ: number,
) {
  m.wood.vertexColors = true
  const bottom = 0.045,
    top = opening - 0.022,
    plankHeight = top - bottom
  for (let plank = 0; plank < 6; plank++) {
    const g = dressedBoxGeometry(width / 6 - 0.005, plankHeight, 0.17, 0.004),
      uv = g.getAttribute('uv')
    for (let i = 0; i < uv.count; i++)
      uv.setXY(i, uv.getX(i) * 0.75 + (plank % 3) * 0.08, uv.getY(i) * 0.9 + 0.03)
    batch.add(
      m.wood,
      g,
      leaf.clone().multiply(local(((plank + 0.5) * width) / 6, (top + bottom) / 2, 0)),
      null,
      0.95 + appearanceHash(seed, doorX, doorZ, plank + 1501) * 0.09,
    )
    g.dispose()
  }
  for (const face of [-1, 1]) {
    for (const ratio of [0.24, 0.73]) {
      const h = 0.14,
        w = width - 0.025,
        shape = new THREE.Shape([
          new THREE.Vector2(-w / 2, -h / 2),
          new THREE.Vector2(w / 2 - 0.05, -h / 2),
          new THREE.Vector2(w / 2, 0),
          new THREE.Vector2(w / 2 - 0.05, h / 2),
          new THREE.Vector2(-w / 2, h / 2),
        ]),
        strap = new THREE.ExtrudeGeometry(shape, {
          depth: 0.024,
          bevelEnabled: true,
          bevelSize: 0.003,
          bevelThickness: 0.003,
          bevelSegments: 1,
          steps: 1,
          curveSegments: 1,
        })
      batch.add(
        m.iron,
        strap,
        leaf.clone().multiply(local(width / 2, opening * ratio, face > 0 ? 0.092 : -0.116)),
        null,
      )
      strap.dispose()
      for (let rivet = 0; rivet < 5; rivet++) {
        const g = new THREE.SphereGeometry(0.019, 8, 6)
        batch.add(
          m.rivet,
          g,
          leaf
            .clone()
            .multiply(local(0.05 + (rivet * (width - 0.12)) / 4, opening * ratio, face * 0.124)),
          null,
        )
        g.dispose()
      }
      const hinge = new THREE.CylinderGeometry(0.026, 0.026, 0.15, 8)
      batch.add(
        m.iron,
        hinge,
        leaf.clone().multiply(local(0.016, opening * ratio, face * 0.106)),
        null,
      )
      hinge.dispose()
    }
    dressed(batch, m.iron, leaf, width - 0.13, opening * 0.49, face * 0.1, 0.13, 0.18, 0.022, 0.006)
    dressed(
      batch,
      m.iron,
      leaf,
      width - 0.13,
      opening * 0.5,
      face * 0.125,
      0.035,
      0.03,
      0.045,
      0.004,
    )
    const ring = new THREE.TorusGeometry(0.073, 0.014, 8, 20)
    batch.add(
      m.iron,
      ring,
      leaf.clone().multiply(local(width - 0.13, opening * 0.46, face * 0.153)),
      null,
    )
    ring.dispose()
  }
}

/** Compact cage sconce with a broad forged support and visible wall fixings. */
export function addTorchProp(
  batch: GeometryBatches,
  m: Dungeon3DMaterials,
  parent: THREE.Matrix4,
  mount: number,
) {
  const transform = parent.clone().multiply(local(0, mount, 0)),
    plateShape = new THREE.Shape([
      new THREE.Vector2(-0.052, -0.23),
      new THREE.Vector2(0.052, -0.23),
      new THREE.Vector2(0.052, 0.16),
      new THREE.Vector2(-0.052, 0.16),
    ]),
    plate = new THREE.ExtrudeGeometry(plateShape, {
      depth: 0.014,
      bevelEnabled: true,
      bevelThickness: 0.002,
      bevelSize: 0.002,
      bevelSegments: 1,
      steps: 1,
    })
  batch.add(m.torchIron, plate, transform.clone().multiply(local(0, 0, 0.02)), null)
  plate.dispose()
  for (const y of [-0.18, 0.1]) {
    const pin = new THREE.SphereGeometry(0.014, 8, 6)
    batch.add(m.torchIron, pin, transform.clone().multiply(local(0, y, 0.039)), null)
    pin.dispose()
  }
  dressed(batch, m.torchIron, transform, 0, -0.075, 0.155, 0.045, 0.055, 0.26, 0.005)
  const shaft = new THREE.CylinderGeometry(0.025, 0.016, 0.27, 12)
  batch.add(m.charcoal, shaft, transform.clone().multiply(local(0, -0.12, 0.29)), null)
  shaft.dispose()
  const head = new THREE.CylinderGeometry(0.058, 0.035, 0.16, 12)
  batch.add(m.fuel, head, transform.clone().multiply(local(0, 0.075, 0.29)), null)
  head.dispose()
  // Uneven charred splinters break the manufactured-cylinder silhouette at the crown.
  for (let i = 0; i < 7; i++) {
    const angle = (i * Math.PI * 2) / 7,
      splinter = new THREE.CylinderGeometry(0.003, 0.007, 0.07 + (i % 3) * 0.013, 5),
      pose = transform
        .clone()
        .multiply(local(Math.cos(angle) * 0.04, 0.135, 0.29 + Math.sin(angle) * 0.04))
        .multiply(new THREE.Matrix4().makeRotationZ(Math.cos(angle) * 0.15))
    batch.add(m.charcoal, splinter, pose, null)
    splinter.dispose()
  }
  for (const y of [-0.065, 0.085]) {
    const radius = y < 0 ? 0.04 : 0.075,
      rim = new THREE.TorusGeometry(radius, 0.012, 4, 16).rotateX(Math.PI / 2)
    batch.add(m.torchIron, rim, transform.clone().multiply(local(0, y, 0.29)), null)
    rim.dispose()
    for (let pin = 0; pin < 6; pin++) {
      const angle = (pin * Math.PI) / 3,
        rivet = new THREE.SphereGeometry(0.007, 6, 4)
      batch.add(
        m.torchIron,
        rivet,
        transform
          .clone()
          .multiply(
            local(Math.cos(angle) * (radius + 0.009), y, 0.29 + Math.sin(angle) * (radius + 0.009)),
          ),
        null,
      )
      rivet.dispose()
    }
  }
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3,
      rib = dressedBoxGeometry(0.018, 0.24, 0.012, 0.002),
      pose = transform
        .clone()
        .multiply(local(Math.cos(angle) * 0.061, 0.025, 0.29 + Math.sin(angle) * 0.061))
        .multiply(new THREE.Matrix4().makeRotationY(-angle))
        .multiply(new THREE.Matrix4().makeRotationZ(-0.17))
    batch.add(m.torchIron, rib, pose, null)
    rib.dispose()
  }
  // Crossed soft flame sheets keep volume when orbiting; no solid cone or opaque inner shell.
  for (let i = 0; i < 3; i++) {
    const sheet = new THREE.PlaneGeometry(0.22, 0.35).translate(0, 0.175, 0),
      pose = transform
        .clone()
        .multiply(local(0, 0.075, 0.29))
        .multiply(new THREE.Matrix4().makeRotationY((i * Math.PI) / 3))
        .multiply(new THREE.Matrix4().makeRotationX(i === 1 ? 0.24 : -0.12))
    batch.add(m.fire, sheet, pose, null)
    sheet.dispose()
  }
}
