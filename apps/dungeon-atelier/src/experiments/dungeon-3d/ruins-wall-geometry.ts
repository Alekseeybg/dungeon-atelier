import * as THREE from 'three'

/** Dressed stone with a short return, a shallow light-catching arris and a flat face.
 * All dimensions are world units, so long blocks do not acquire oversized bevels.
 */
export function ruinsWallGeometry(
  width: number,
  height: number,
  relief: number,
  sampleU = 0.5,
  sampleV = 0.5,
) {
  const positions: number[] = [],
    uvs: number[] = [],
    bevel = Math.min(0.014, width * 0.08, height * 0.08),
    ring = (inset: number, z: number) => [
      [-width / 2 + inset, -height / 2 + inset, z],
      [width / 2 - inset, -height / 2 + inset, z],
      [width / 2 - inset, height / 2 - inset, z],
      [-width / 2 + inset, height / 2 - inset, z],
    ],
    back = ring(0, 0),
    shoulder = ring(0, relief - 0.008),
    face = ring(bevel, relief)
  function quad(points: number[][]) {
    for (const i of [0, 1, 2, 0, 2, 3]) {
      const p = points[i]!
      positions.push(...p)
      // Keep mineral grain at one world scale instead of stretching it into horizontal stripes.
      uvs.push(
        p[0]! / 2 + 0.5 + (sampleU - 0.5) * (1 - width / 2),
        p[1]! / 2 + 0.5 + (sampleV - 0.5) * (1 - height / 2),
      )
    }
  }
  quad(face)
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4
    quad([back[i]!, back[j]!, shoulder[j]!, shoulder[i]!])
    quad([shoulder[i]!, shoulder[j]!, face[j]!, face[i]!])
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.computeVertexNormals()
  return geometry
}
