import * as THREE from 'three'
import { dressedBoxGeometry } from './asset-geometry'
import type { GeometryBatches } from './geometry'
import type { Dungeon3DMaterials } from './materials'

const at = (p: THREE.Matrix4, x: number, y: number, z: number) =>
  p.clone().multiply(new THREE.Matrix4().setPosition(x, y, z))
function block(
  b: GeometryBatches,
  m: THREE.Material,
  p: THREE.Matrix4,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
) {
  const g = dressedBoxGeometry(w, h, d, 0.003)
  b.add(m, g, at(p, x, y, z), null)
  g.dispose()
}
function band(
  b: GeometryBatches,
  m: THREE.Material,
  p: THREE.Matrix4,
  y: number,
  z: number,
  r: number,
  h: number,
) {
  const shape = new THREE.Shape().absarc(0, 0, r, 0, Math.PI * 2, false),
    hole = new THREE.Path().absarc(0, 0, r - 0.014, 0, Math.PI * 2, true)
  shape.holes.push(hole)
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: h,
    bevelEnabled: true,
    bevelSize: 0.002,
    bevelThickness: 0.002,
    bevelSegments: 1,
    steps: 1,
    curveSegments: 14,
  })
    .rotateX(Math.PI / 2)
    .translate(0, h / 2, 0)
  b.add(m, g, at(p, 0, y, z), null)
  g.dispose()
}

/** Two independently constructed alternatives; no current torch geometry is reused. */
export function addTorchCandidate(
  b: GeometryBatches,
  m: Dungeon3DMaterials,
  parent: THREE.Matrix4,
  variant: 'basket' | 'brazier',
  options: { mount?: number; faceOffset?: number } = {},
) {
  const basket = variant === 'basket',
    iron = m.selectedDoor.iron,
    p = at(parent, 0, options.mount ?? 1.26, options.faceOffset ?? 0.325),
    z = basket ? 0.25 : 0.24
  // Flush wall plate and three raised hammered fixing heads.
  block(b, iron, p, 0, -0.1, 0.012, basket ? 0.105 : 0.14, basket ? 0.43 : 0.34, 0.025)
  for (const y of [-0.26, -0.1, 0.065]) {
    const pin = new THREE.SphereGeometry(0.013, 10, 6)
    b.add(m.selectedDoor.rivet, pin, at(p, 0, y, 0.032), null)
    pin.dispose()
  }
  block(b, iron, p, 0, basket ? -0.18 : -0.12, z / 2, 0.042, 0.052, z)
  if (basket) {
    const shaft = new THREE.CylinderGeometry(0.024, 0.016, 0.25, 12)
    b.add(m.charcoal, shaft, at(p, 0, -0.205, z), null)
    shaft.dispose()
    band(b, iron, p, -0.13, z, 0.039, 0.04)
    band(b, iron, p, -0.18, z, 0.033, 0.035)
    band(b, iron, p, 0.075, z, 0.079, 0.035)
    // Flared flat ribs form a true tapered cage, open between the bars.
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3,
        shape = new THREE.Shape([
          new THREE.Vector2(0.029, -0.15),
          new THREE.Vector2(0.044, -0.15),
          new THREE.Vector2(0.086, 0.15),
          new THREE.Vector2(0.069, 0.15),
        ]),
        g = new THREE.ExtrudeGeometry(shape, {
          depth: 0.015,
          bevelEnabled: true,
          bevelSize: 0.002,
          bevelThickness: 0.002,
          bevelSegments: 1,
          steps: 1,
        }).translate(0, 0, -0.0075),
        pose = at(p, 0, 0, z).multiply(new THREE.Matrix4().makeRotationY(angle))
      b.add(iron, g, pose, null)
      g.dispose()
    }
  } else {
    // A shallow wall brazier: broad cup, short crown prongs, no timber handle.
    const points = [
        new THREE.Vector2(0.025, -0.12),
        new THREE.Vector2(0.055, -0.1),
        new THREE.Vector2(0.105, -0.015),
        new THREE.Vector2(0.11, 0.025),
        new THREE.Vector2(0.096, 0.025),
        new THREE.Vector2(0.09, -0.012),
        new THREE.Vector2(0.042, -0.083),
        new THREE.Vector2(0.025, -0.09),
      ],
      cup = new THREE.LatheGeometry(points, 20)
    b.add(iron, cup, at(p, 0, 0, z), null)
    cup.dispose()
    band(b, iron, p, 0.025, z, 0.112, 0.034)
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4,
        pose = at(p, Math.cos(a) * 0.101, 0.065, z + Math.sin(a) * 0.101).multiply(
          new THREE.Matrix4().makeRotationY(-a),
        ),
        g = dressedBoxGeometry(0.019, 0.095, 0.012, 0.002)
      b.add(iron, g, pose, null)
      g.dispose()
      const rivet = new THREE.SphereGeometry(0.007, 8, 5)
      b.add(
        m.selectedDoor.rivet,
        rivet,
        at(p, Math.cos(a) * 0.116, 0.025, z + Math.sin(a) * 0.116),
        null,
      )
      rivet.dispose()
    }
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2,
        rib = new THREE.TubeGeometry(
          new THREE.CatmullRomCurve3([
            new THREE.Vector3(Math.cos(a) * 0.045, -0.105, z + Math.sin(a) * 0.045),
            new THREE.Vector3(Math.cos(a) * 0.08, -0.055, z + Math.sin(a) * 0.08),
            new THREE.Vector3(Math.cos(a) * 0.106, 0.01, z + Math.sin(a) * 0.106),
          ]),
          5,
          0.005,
          6,
          false,
        )
      b.add(iron, rib, p, null)
      rib.dispose()
    }
    const support = new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, -0.23, 0.03),
        new THREE.Vector3(0, -0.22, 0.11),
        new THREE.Vector3(0, -0.12, z),
      ]),
      6,
      0.014,
      8,
      false,
    )
    b.add(iron, support, p, null)
    support.dispose()
  }
  const fuel = new THREE.CylinderGeometry(
    basket ? 0.05 : 0.084,
    basket ? 0.031 : 0.045,
    basket ? 0.18 : 0.08,
    14,
  )
  b.add(m.selectedDoor.coal, fuel, at(p, 0, basket ? -0.025 : 0.005, z), null)
  fuel.dispose()
  if (!basket)
    for (let i = 0; i < 9; i++) {
      const a = i * 2.39996,
        r = 0.018 + Math.sqrt(i / 9) * 0.054,
        coal = new THREE.DodecahedronGeometry(0.016 + (i % 3) * 0.004)
      b.add(
        m.selectedDoor.coal,
        coal,
        at(p, Math.cos(a) * r, 0.045 + (i % 2) * 0.008, z + Math.sin(a) * r),
        null,
      )
      coal.dispose()
    }
  for (let i = 0; i < 3; i++) {
    const g = new THREE.PlaneGeometry(basket ? 0.23 : 0.27, basket ? 0.38 : 0.32).translate(
        0,
        basket ? 0.19 : 0.16,
        0,
      ),
      pose = at(p, 0, basket ? -0.025 : 0.005, z)
        .multiply(new THREE.Matrix4().makeRotationY((i * Math.PI) / 3))
        .multiply(new THREE.Matrix4().makeRotationX(i === 1 ? 0.2 : -0.1))
    b.add(m.fire, g, pose, null)
    g.dispose()
  }
}
