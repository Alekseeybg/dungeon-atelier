import * as THREE from 'three'
import { addDoorCandidate } from './door-candidates'
import { dressedBoxGeometry } from './asset-geometry'
import type { GeometryBatches } from './geometry'
import { ruinsDressedStone } from './ruins-placement'
import type { Dungeon3DMaterials } from './materials'

/** Selected ironbound leaf, thin bonded surround in wall stone, and pale broad threshold. */
export function addSelectedDoor(
  batch: GeometryBatches,
  materials: Dungeon3DMaterials,
  parent: THREE.Matrix4,
  height: number,
  open: boolean,
  head = true,
  seed = '',
) {
  const position = new THREE.Vector3().setFromMatrixPosition(parent)
  const dressing = (y: number, offset = 0) =>
    ruinsDressedStone(seed, position.x + offset, y, position.z, 'frame')
  const rows = Math.round(height / 0.34),
    course = height / rows
  for (const side of [-1, 1])
    for (let row = 0; row < rows; row++) {
      const stone = dressedBoxGeometry(0.1, course - 0.008, 0.65, 0.005)
      batch.add(
        materials.masonry,
        stone,
        parent
          .clone()
          .multiply(new THREE.Matrix4().setPosition(side * 0.432, (row + 0.5) * course, 0)),
        null,
        1,
        (row * 3 + (side > 0 ? 2 : 0)) % 16,
        0,
        dressing((row + 0.5) * course, side * 0.432),
      )
      stone.dispose()
    }
  if (head)
    for (let i = 0; i < 3; i++) {
      const stone = dressedBoxGeometry(0.76 / 3 - 0.006, height * 0.16, 0.625, 0.005)
      batch.add(
        materials.masonry,
        stone,
        parent
          .clone()
          .multiply(new THREE.Matrix4().setPosition(((i - 1) * 0.76) / 3, height * 0.92, 0)),
        null,
        1,
        (i * 5) % 16,
        0,
        dressing(height * 0.92, ((i - 1) * 0.76) / 3),
      )
      stone.dispose()
    }
  const threshold = dressedBoxGeometry(1.17, 0.065, 0.9, 0.01)
  batch.add(
    materials.frame,
    threshold,
    parent.clone().multiply(new THREE.Matrix4().setPosition(0, 0.035, 0.1)),
    null,
    1,
    0,
    0,
    dressing(0.035),
  )
  threshold.dispose()
  const scaled = parent.clone().multiply(new THREE.Matrix4().makeScale(1, height / 2, 1))
  addDoorCandidate(batch, materials.selectedDoor, scaled, 'arch', open, {
    surround: false,
    squareTop: true,
  })
}
