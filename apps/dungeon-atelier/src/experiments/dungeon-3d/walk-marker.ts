import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

type Point = readonly [number, number]
type Surface = THREE.Material | THREE.Material[]

/** Mockup 2: a heavy runic reliquary, with an independently rotating cracked-garnet arrow. */
export function createWalkMarker() {
  const root = new THREE.Group(),
    compass = new THREE.Group(),
    pointer = new THREE.Group()
  // Small shared maps: broad dark patina, hammer marks and sparse exposed-metal scores.
  // This changes surface response only; the approved silhouette and gem stay intact.
  const metalSize = 256,
    metalData = new Uint8Array(metalSize * metalSize * 4),
    patinaData = new Uint8Array(metalSize * metalSize * 4)
  for (let y = 0; y < metalSize; y++)
    for (let x = 0; x < metalSize; x++) {
      const u = (x / metalSize) * Math.PI * 2,
        v = (y / metalSize) * Math.PI * 2,
        hammered = Math.sin(u * 3 + Math.sin(v * 2)) * Math.cos(v * 4 + Math.sin(u)),
        score =
          Math.pow(Math.max(0, Math.cos(u * 19 + Math.sin(v * 3) * 0.3)), 32) *
          Math.pow(Math.max(0, Math.sin(v * 2 + u)), 6),
        index = (y * metalSize + x) * 4
      const px = x / metalSize - 0.5,
        pz = y / metalSize - 0.5,
        radius = Math.hypot(px, pz),
        angle = Math.atan2(pz, px),
        belt = Math.exp(-Math.pow((radius - 0.296) / 0.033, 8)),
        rimGrime = belt * Math.exp(-Math.pow((radius - 0.273) / 0.008, 2)),
        jointGrime = belt * Math.pow(Math.max(0, Math.cos(angle * 8)), 24),
        // Patina collects along the shank's inset, not uniformly over the metal.
        shankGrime =
          Math.exp(-Math.pow((Math.abs(px) - 0.052) / 0.012, 2)) *
          Math.exp(-Math.pow((pz - 0.01) / 0.16, 4)),
        grime = Math.min(1, rimGrime * 0.85 + jointGrime * 0.7 + shankGrime * 0.7),
        tarnish = Math.max(0, Math.sin(u + Math.sin(v * 2)) * Math.cos(v - Math.sin(u * 2))),
        oxidation =
          Math.max(0, Math.sin(u * 3 - v + Math.sin(v * 3)) - 0.15) * (0.35 + grime * 0.65),
        exposed = Math.min(1, score * 2.5),
        value = Math.min(1, 0.94 - tarnish * 0.3 - grime * 0.4 + hammered * 0.05 + exposed * 0.16)
      metalData[index] = Math.round(128 + hammered * 23 - oxidation * 18 - score * 24)
      metalData[index + 1] = Math.min(
        255,
        Math.round(218 + grime * 34 + oxidation * 22 - exposed * 45),
      )
      metalData[index + 2] = Math.round(255 - oxidation * 90 - grime * 65)
      metalData[index + 3] = 255
      // Muted umber oxidation and cool charcoal tarnish, with dark deposits at seams.
      patinaData[index] = Math.round(value * (1 - tarnish * 0.06) * 255)
      patinaData[index + 1] = Math.round(value * (1 - oxidation * 0.22) * 255)
      patinaData[index + 2] = Math.round(value * (1 - oxidation * 0.4 - grime * 0.08) * 255)
      patinaData[index + 3] = 255
    }
  const metalSurface = new THREE.DataTexture(metalData, metalSize, metalSize, THREE.RGBAFormat),
    metalPatina = new THREE.DataTexture(patinaData, metalSize, metalSize, THREE.RGBAFormat)
  for (const texture of [metalSurface, metalPatina]) {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping
    texture.magFilter = THREE.LinearFilter
    texture.minFilter = THREE.LinearMipmapLinearFilter
    texture.generateMipmaps = true
    texture.needsUpdate = true
  }
  metalPatina.colorSpace = THREE.LinearSRGBColorSpace
  const iron = new THREE.MeshStandardMaterial({
      color: '#50524f',
      metalness: 0.62,
      roughness: 0.66,
      vertexColors: true,
    }),
    steel = new THREE.MeshStandardMaterial({
      color: '#83857b',
      metalness: 0.68,
      roughness: 0.52,
      vertexColors: true,
    }),
    bronze = new THREE.MeshStandardMaterial({
      color: '#80684a',
      metalness: 0.67,
      roughness: 0.62,
      vertexColors: true,
    }),
    hollow = new THREE.MeshStandardMaterial({
      color: '#0d0b0b',
      metalness: 0.35,
      roughness: 0.9,
      vertexColors: true,
    }),
    garnet = new THREE.MeshPhysicalMaterial({
      color: '#790e17',
      metalness: 0.12,
      // Broad cut faces must not turn into white mirrors at a grid heading.
      // Retain colored gem reflections without a separate white clearcoat lobe.
      roughness: 0.42,
      clearcoat: 0,
      specularIntensity: 0.15,
      vertexColors: true,
    })
  for (const metal of [iron, steel, bronze]) {
    metal.map = metalPatina
    metal.roughnessMap = metalSurface
    metal.metalnessMap = metalSurface
    metal.bumpMap = metalSurface
    metal.bumpScale = 0.0012
  }
  const materials = [iron, steel, bronze, hollow, garnet],
    owned: THREE.BufferGeometry[] = [],
    batches = new Map<THREE.Group, Map<THREE.Material, THREE.BufferGeometry[]>>()
  function add(group: THREE.Group, surface: Surface, geometry: THREE.BufferGeometry) {
    if (Array.isArray(surface)) {
      for (const part of geometry.groups) {
        const sliced = new THREE.BufferGeometry()
        for (const name of ['position', 'normal', 'uv']) {
          const attribute = geometry.getAttribute(name)
          sliced.setAttribute(
            name,
            new THREE.BufferAttribute(
              new Float32Array(
                attribute.array.slice(
                  part.start * attribute.itemSize,
                  (part.start + part.count) * attribute.itemSize,
                ),
              ),
              attribute.itemSize,
            ),
          )
        }
        add(group, surface[part.materialIndex ?? 0]!, sliced)
      }
      geometry.dispose()
      return
    }
    const positions = geometry.getAttribute('position'),
      normals = geometry.getAttribute('normal'),
      isMetal = surface === iron || surface === steel || surface === bronze,
      colors = new Float32Array(positions.count * 3)
    if (isMetal) {
      // One local X/Z atlas keeps deposits and stains continuous across adjacent
      // bevels, plates and mouldings instead of repeating the texture on each face.
      const uv = new Float32Array(positions.count * 2)
      for (let i = 0; i < positions.count; i++) {
        uv[i * 2] = positions.getX(i) + 0.5
        uv[i * 2 + 1] = positions.getZ(i) + 0.5
      }
      geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
    }
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i),
        z = positions.getZ(i),
        wear = 0.88 + 0.075 * Math.sin(x * 49 + z * 29) + 0.035 * Math.cos(z * 83 - x * 17)
      if (isMetal) {
        const ny = Math.abs(normals.getY(i)),
          bevelWear = 0.26 * Math.sin(ny * Math.PI),
          patina = 0.88 + 0.1 * Math.sin(x * 16 + z * 9) * Math.cos(z * 21 - x * 7),
          value = patina + bevelWear
        colors[i * 3] = value * 0.97
        colors[i * 3 + 1] = value * 0.985
        colors[i * 3 + 2] = value
      } else {
        colors[i * 3] = wear
        colors[i * 3 + 1] = wear * 0.97
        colors[i * 3 + 2] = wear * 0.91
      }
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    let batch = batches.get(group)
    if (!batch) {
      batch = new Map()
      batches.set(group, batch)
    }
    const material = surface,
      parts = batch.get(material) ?? []
    parts.push(geometry.index ? geometry.toNonIndexed() : geometry)
    if (geometry.index) geometry.dispose()
    batch.set(material, parts)
  }
  function shape(points: readonly Point[]) {
    const s = new THREE.Shape()
    for (const [i, p] of points.entries()) {
      if (i === 0) s.moveTo(p[0], p[1])
      else s.lineTo(p[0], p[1])
    }
    s.closePath()
    return s
  }
  function turned(points: readonly Point[], angle: number): Point[] {
    return points.map(([x, y]) => [
      x * Math.cos(angle) + y * Math.sin(angle),
      y * Math.cos(angle) - x * Math.sin(angle),
    ])
  }
  function scaled(points: readonly Point[], scale: number): Point[] {
    return points.map(([x, y]) => [x * scale, y * scale])
  }
  function plate(
    group: THREE.Group,
    surface: Surface,
    outline: THREE.Shape,
    y: number,
    depth: number,
    bevel = 0.004,
    curves = 4,
  ) {
    const g = new THREE.ExtrudeGeometry(outline, {
      depth,
      steps: 1,
      bevelEnabled: true,
      bevelSegments: 2,
      bevelSize: bevel,
      bevelThickness: bevel,
      curveSegments: curves,
    })
    g.rotateX(-Math.PI / 2).translate(0, y, 0)
    add(group, surface, g)
  }
  function band(outer: number, inner: number, start: number, length: number) {
    const s = new THREE.Shape()
    s.absarc(0, 0, outer, start, start + length, false)
    s.absarc(0, 0, inner, start + length, start, true)
    s.closePath()
    return s
  }
  function line(
    group: THREE.Group,
    material: THREE.Material,
    a: Point,
    b: Point,
    y: number,
    radius = 0.0012,
  ) {
    const start = new THREE.Vector3(a[0], y, -a[1]),
      end = new THREE.Vector3(b[0], y, -b[1]),
      delta = end.clone().sub(start),
      g = new THREE.CylinderGeometry(radius, radius, delta.length(), 5)
    g.applyQuaternion(
      new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()),
    )
    g.translate((start.x + end.x) / 2, y, (start.z + end.z) / 2)
    add(group, material, g)
  }
  function facets(
    group: THREE.Group,
    points: readonly Point[],
    height: (p: Point) => number,
    material: THREE.Material = garnet,
  ) {
    const contour = points.map((p) => new THREE.Vector2(...p)),
      indices = THREE.ShapeUtils.triangulateShape(contour, []),
      position: number[] = [],
      uv: number[] = []
    for (const face of indices) {
      const a = points[face[0]!]!
      let b = points[face[1]!]!,
        c = points[face[2]!]!
      // XY is mapped onto X/-Z, so a counterclockwise contour faces upward.
      if ((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]) < 0) [b, c] = [c, b]
      for (const p of [a, b, c]) {
        position.push(p[0], height(p), -p[1])
        uv.push(p[0] + 0.5, p[1] + 0.5)
      }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(position, 3))
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
    g.computeVertexNormals()
    add(group, material, g)
  }
  function diamond(
    group: THREE.Group,
    cx: number,
    cy: number,
    radial: number,
    tangent: number,
    y: number,
    angle = 0,
  ) {
    const points: Point[] = [
        [0, radial],
        [-tangent, 0],
        [0, -radial],
        [tangent, 0],
      ],
      place = (p: readonly Point[]) => turned(p, angle).map(([x, z]) => [x + cx, z + cy] as Point)
    plate(group, hollow, shape(place(scaled(points, 1.06))), y - 0.025, 0.014, 0.003)
    const frame = shape(place(points))
    frame.holes.push(shape(place(scaled(points, 0.58))))
    plate(group, [iron, steel], frame, y, 0.018, 0.005)
    // A four-facet gem with a raised central ridge, fully below the housing bevel.
    const inset = place(scaled(points, 0.5)),
      center: Point = [cx, cy]
    for (let i = 0; i < 4; i++)
      facets(group, [inset[i]!, inset[(i + 1) % 4]!, center], (p) =>
        p === center ? y + 0.013 : y + 0.002,
      )
    // Paired setting claws hold the gem at its waist, leaving the red table clear.
    for (const side of [-1, 1]) {
      const claw = place([
        [side * tangent * 0.48, 0],
        [side * tangent * 0.73, 0],
      ])
      line(group, bronze, claw[0]!, claw[1]!, y + 0.016, 0.0017)
    }
  }

  // Broad blackened runic belt with bronze inner and outer mouldings.
  plate(compass, hollow, band(0.327, 0.274, 0, Math.PI * 2), 0.008, 0.027, 0.004, 24)
  for (let i = 0; i < 8; i++) {
    const start = (i * Math.PI) / 4 + 0.013,
      irregular = [0.001, -0.0008, 0.0004, -0.0003][i % 4]!
    plate(
      compass,
      [iron, bronze],
      band(0.322 + irregular, 0.268, start, Math.PI / 4 - 0.026),
      0.029,
      0.045,
      0.004,
    )
  }
  // Raised mouldings frame the recessed runic belt, rather than disappearing below it.
  for (let quadrant = 0; quadrant < 4; quadrant++) {
    // Stop the mouldings at the cardinal sockets so they never cross the gems.
    const start = (quadrant * Math.PI) / 2 + 0.14,
      length = Math.PI / 2 - 0.28
    plate(compass, [iron, steel], band(0.328, 0.321, start, length), 0.077, 0.006, 0.002, 6)
    plate(compass, [iron, bronze], band(0.272, 0.265, start, length), 0.077, 0.005, 0.002, 6)
  }

  // Angular incised runes on each quadrant, leaving room for the diagonal bolt plates.
  const runes: readonly (readonly [Point, Point])[][] = [
    [
      [
        [-1, -1],
        [-1, 1],
      ],
      [
        [-1, 1],
        [1, 0],
      ],
      [
        [-1, 0],
        [1, -1],
      ],
    ],
    [
      [
        [-1, 1],
        [0, -1],
      ],
      [
        [0, -1],
        [1, 1],
      ],
      [
        [-0.5, 0],
        [0.6, 0],
      ],
    ],
    [
      [
        [0, -1],
        [0, 1],
      ],
      [
        [-1, 0.8],
        [0, 0.1],
      ],
      [
        [0, 0.1],
        [1, 0.8],
      ],
    ],
    [
      [
        [-1, -0.7],
        [1, 0.7],
      ],
      [
        [1, 0.7],
        [0, 1],
      ],
      [
        [1, 0.7],
        [0.7, -0.4],
      ],
    ],
  ]
  for (let quadrant = 0; quadrant < 4; quadrant++)
    for (let j = 0; j < 4; j++) {
      const angle = (quadrant * Math.PI) / 2 + [0.23, 0.44, 1.12, 1.34][j]!,
        center: Point = [Math.sin(angle) * 0.295, Math.cos(angle) * 0.295]
      for (const [a, b] of runes[(quadrant + j) % 4]!) {
        const endpoints = turned(
          [
            [a[0] * 0.007, a[1] * 0.012],
            [b[0] * 0.007, b[1] * 0.012],
          ],
          angle,
        ).map(([x, y]) => [x + center[0], y + center[1]] as Point)
        line(compass, hollow, endpoints[0]!, endpoints[1]!, 0.079, 0.0021)
        line(compass, bronze, endpoints[0]!, endpoints[1]!, 0.0805, 0.00085)
      }
    }
  // Four compact eight-point mounting plates and hammered studs.
  const mounting: readonly Point[] = [
    [0, 0.037],
    [0.012, 0.014],
    [0.034, 0],
    [0.014, -0.012],
    [0, -0.035],
    [-0.012, -0.014],
    [-0.033, 0],
    [-0.014, 0.012],
  ]
  for (let i = 0; i < 4; i++) {
    const angle = Math.PI / 4 + (i * Math.PI) / 2,
      cx = Math.sin(angle) * 0.3,
      cy = Math.cos(angle) * 0.3,
      outline = turned(mounting, angle).map(([x, y]) => [x + cx, y + cy] as Point)
    plate(compass, [iron, steel], shape(outline), 0.077, 0.017, 0.004)
    // Inset chevrons give the diagonal mounts a carved, layered construction.
    for (const side of [-1, 1]) {
      const engraving = turned(
        [
          [side * 0.019, 0],
          [0, 0.022],
        ],
        angle,
      ).map(([x, y]) => [x + cx, y + cy] as Point)
      line(compass, bronze, engraving[0]!, engraving[1]!, 0.098, 0.0012)
    }
    add(
      compass,
      bronze,
      new THREE.CylinderGeometry(0.009, 0.011, 0.005, 8).translate(cx, 0.102, -cy),
    )
    add(
      compass,
      steel,
      new THREE.SphereGeometry(0.007, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2).translate(
        cx,
        0.104,
        -cy,
      ),
    )
    line(compass, hollow, [cx - 0.003, cy - 0.001], [cx + 0.003, cy + 0.001], 0.111, 0.001)
  }
  // Long cardinal sockets reproduce the gem-set compass points of reference 2.
  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2
    diamond(compass, Math.sin(angle) * 0.321, Math.cos(angle) * 0.321, 0.067, 0.038, 0.077, angle)
  }

  // A broad arrowhead, inward-curving shank and splayed, ceremonial heel.
  const outline: readonly Point[] = [
      [0, 0.295],
      [-0.187, 0.01],
      [-0.079, 0.058],
      [-0.065, -0.058],
      [-0.077, -0.143],
      [-0.122, -0.247],
      [0, -0.207],
      [0.122, -0.247],
      [0.077, -0.143],
      [0.065, -0.058],
      [0.079, 0.058],
      [0.187, 0.01],
    ],
    well: readonly Point[] = [
      [0, 0.264],
      [-0.14, 0.032],
      [-0.052, 0.083],
      [-0.046, -0.105],
      [-0.087, -0.211],
      [0, -0.175],
      [0.087, -0.211],
      [0.046, -0.105],
      [0.052, 0.083],
      [0.14, 0.032],
    ]
  plate(pointer, hollow, shape(scaled(outline, 1.025)), 0.045, 0.038, 0.006)
  const frame = shape(outline)
  frame.holes.push(shape(well))
  plate(pointer, [iron, steel], frame, 0.085, 0.047, 0.009)
  // Broad, ridge-ground blade rails: each side has two differently sloped metal
  // faces. These catch the existing light as a forged blade, even from overhead.
  for (const side of [-1, 1]) {
    const tip: Point = [0, 0.295],
      shoulder: Point = [side * 0.187, 0.01],
      innerShoulder: Point = [side * 0.14, 0.032],
      innerTip: Point = [0, 0.264],
      ridgeTip: Point = [0, 0.284],
      ridgeShoulder: Point = [side * 0.169, 0.025],
      height = (p: Point) => (p === ridgeTip || p === ridgeShoulder ? 0.158 : 0.133)
    facets(pointer, [tip, shoulder, ridgeShoulder, ridgeTip], height, steel)
    facets(pointer, [ridgeTip, ridgeShoulder, innerShoulder, innerTip], height, iron)
    // Separate cheek plates overlap the shank like a layered ceremonial tang.
    const cheek = (
      [
        [0.077, 0.05],
        [0.064, -0.057],
        [0.076, -0.141],
        [0.111, -0.231],
        [0.091, -0.216],
        [0.052, -0.108],
        [0.058, 0.06],
      ] as Point[]
    ).map(([x, y]) => [x * side, y] as Point)
    plate(pointer, [iron, steel], shape(cheek), 0.138, 0.005, 0.003)
    line(pointer, bronze, [side * 0.067, 0.041], [side * 0.056, -0.102], 0.146, 0.0011)
  }
  // A recessed antique-gold inner bead separates black iron from the garnet well.
  for (let i = 0; i < well.length; i++) {
    line(pointer, bronze, well[i]!, well[(i + 1) % well.length]!, 0.126, 0.0012)
  }
  const left: readonly Point[] = [
    [-0.002, 0.252],
    [-0.121, 0.045],
    [-0.048, 0.088],
    [-0.039, -0.102],
    [-0.073, -0.187],
    [-0.012, -0.161],
    [-0.005, -0.13],
    [-0.008, -0.085],
    [-0.002, -0.05],
    [-0.006, -0.014],
    [-0.002, 0.025],
    [-0.007, 0.072],
    [-0.002, 0.119],
    [-0.005, 0.164],
    [-0.001, 0.204],
  ]
  // The jagged open seam is real geometry; no painted crack or emitted red light.
  for (const side of [-1, 1]) {
    const points = left.map(([x, y]) => [x * side * (Math.abs(x) < 0.013 ? 0.45 : 1), y] as Point)
    facets(
      pointer,
      points,
      (p) => 0.101 + 0.02 * Math.max(0, 1 - Math.abs(p[0]) / 0.055) + 0.002 * Math.sin(p[1] * 53),
    )
  }
  // Short branching fractures split the large gem faces into a cut, ancient core.
  for (const side of [-1, 1]) {
    line(pointer, hollow, [side * 0.006, 0.119], [side * 0.026, 0.137], 0.115, 0.0007)
    line(pointer, hollow, [side * 0.008, -0.05], [side * 0.03, -0.076], 0.113, 0.0007)
  }
  diamond(pointer, 0, -0.218, 0.042, 0.031, 0.126)

  // Readable scars across the raised cheek surfaces; older scores below these
  // plates were hidden by the layered frame. Keep the cuts short and sparse.
  for (const side of [-1, 1])
    for (let i = 0; i < 3; i++) {
      const y = 0.005 - i * 0.035,
        x = 0.064 - i * 0.002
      line(
        pointer,
        hollow,
        [side * (x - 0.004), y - 0.005],
        [side * (x + 0.003), y + 0.006],
        0.1465,
        0.0012,
      )
      line(
        pointer,
        steel,
        [side * (x - 0.003), y - 0.005],
        [side * (x + 0.004), y + 0.006],
        0.1467,
        0.0006,
      )
    }

  // Fine chiselled scores and restrained worn edges on the shoulder and heel metal.
  for (const side of [-1, 1])
    for (let i = 0; i < 8; i++) {
      const x = side * (0.081 + i * 0.007),
        y = 0.019 - i * 0.003
      line(
        pointer,
        i % 3 === 0 ? bronze : hollow,
        [x, y],
        [x + side * 0.01, y - 0.006],
        0.124,
        0.0008,
      )
    }
  for (let i = 0; i < 22; i++) {
    const angle = 0.12 + i * 0.271,
      r = 0.29 + (i % 3) * 0.011,
      a: Point = [Math.sin(angle) * r, Math.cos(angle) * r],
      length = 0.009 + (i % 3) * 0.003,
      b: Point = [a[0] + Math.cos(angle) * length, a[1] - Math.sin(angle) * length]
    line(compass, i % 3 === 0 ? steel : hollow, a, b, 0.079, 0.0011)
  }

  for (const [group, batch] of batches)
    for (const [material, parts] of batch) {
      const geometry = mergeGeometries(parts)
      parts.forEach((part) => part.dispose())
      owned.push(geometry)
      const mesh = new THREE.Mesh(geometry, material)
      mesh.castShadow = true
      mesh.receiveShadow = true
      group.add(mesh)
    }
  compass.name = 'Runic ritual ring: cardinal garnets and bolted star plates'
  pointer.name = 'Sculpted spear: deep steel bevels and fractured blood garnet'
  root.name = 'Walk player: forged dark-fantasy compass artifact'
  root.add(compass, pointer)
  root.visible = false
  return {
    root,
    pointer,
    dispose() {
      owned.forEach((g) => g.dispose())
      materials.forEach((m) => m.dispose())
      metalSurface.dispose()
      metalPatina.dispose()
    },
  }
}
