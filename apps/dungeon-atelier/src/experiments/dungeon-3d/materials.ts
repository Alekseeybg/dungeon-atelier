import * as THREE from 'three'
import { loadFoundationArt } from '../../features/dungeon/rendering/visual-foundation/art'
import type { FoundationFloor } from '../../features/dungeon/rendering/visual-foundation/art'
import ancientFaceUrl from '../../assets/visual-foundation/ruins-face-v2.png'
import ancientCapUrl from '../../assets/visual-foundation/ruins-cap-v2.png'
import { createCapWeathering } from './cap-weathering'
import { floorStoneAtlas, refineWallStone, refineOak } from './body-materials'
import { createTorchMaterials } from './torch-materials'
import { createDoorCandidateMaterials } from './door-candidates'
import { createWallWeathering } from './wall-weathering'

/** Cut-stone surface only: the profile supplies the edge, not a painted mortar stripe. */
async function copingSurface(seed: string) {
  const source = new Image()
  source.src = ancientCapUrl
  await source.decode()
  const image = document.createElement('canvas')
  image.width = image.height = 512
  const c = image.getContext('2d')!
  const crops = [
    [0.08, 0.04],
    [0.39, 0.04],
    [0.25, 0.23],
    [0.57, 0.41],
  ]
  for (let index = 0; index < 16; index++) {
    const p = crops[(index + Math.floor(index / 4)) % 4]!
    c.drawImage(
      source,
      p[0]! * source.width,
      p[1]! * source.height,
      source.width * 0.15,
      source.height * 0.11,
      (index % 4) * 128,
      Math.floor(index / 4) * 128,
      128,
      128,
    )
  }
  stoneAlbedo(image, 'cap')
  const pixels = c.getImageData(0, 0, 512, 512),
    weather = Array.from({ length: 16 }, (_, i) => createCapWeathering(`${seed}:cap:${i}`)),
    dirt = [95, 91, 81],
    moss = [61, 73, 36],
    trim = document.createElement('canvas')
  trim.width = trim.height = 128
  const trimContext = trim.getContext('2d')!,
    trimPixels = trimContext.createImageData(128, 128)
  for (let i = 0; i < pixels.data.length; i += 4) {
    const value =
        pixels.data[i]! * 0.2126 + pixels.data[i + 1]! * 0.7152 + pixels.data[i + 2]! * 0.0722,
      target = 140 + (value - 135) * 0.35,
      x = (i / 4) % 512,
      y = Math.floor(i / 4 / 512),
      index = Math.floor(y / 128) * 4 + Math.floor(x / 128),
      kind = index % 4,
      wear = weather[index]!.sample((x % 128) / 128, (y % 128) / 128),
      dirtAmount = wear.dirt * [0.03, 0.65, 0.08, 0.18][kind]!,
      mossAmount = wear.moss * [0.05, 0, 1.2, 0.08][kind]!
    for (let channel = 0; channel < 3; channel++) {
      const base = target + (pixels.data[i + channel]! - value) * 0.6,
        stained = base + (dirt[channel]! - base) * dirtAmount
      pixels.data[i + channel] = stained + (moss[channel]! - stained) * mossAmount
      if (x < 128 && y < 128) {
        // Keep jamb/stair trim at its prior stone value; only the cap base becomes darker.
        const neutral = base + 14,
          neutralStain = neutral + (dirt[channel]! - neutral) * dirtAmount,
          t = (y * 128 + x) * 4
        trimPixels.data[t + channel] = neutralStain + (moss[channel]! - neutralStain) * mossAmount
        trimPixels.data[t + 3] = 255
      }
    }
  }
  c.putImageData(pixels, 0, 0)
  trimContext.putImageData(trimPixels, 0, 0)
  c.lineCap = 'round'
  for (let index = 0; index < 16; index++) {
    const kind = index % 4,
      ox = (index % 4) * 128,
      oy = Math.floor(index / 4) * 128
    if (kind !== 1 && kind !== 3) continue
    c.save()
    c.beginPath()
    c.rect(ox + 2, oy + 2, 124, 124)
    c.clip()
    for (const crack of weather[index]!.cracks.slice(0, kind === 3 ? 2 : 1)) {
      const length = Math.max(0.001, Math.hypot(crack.du, crack.dv)),
        points = Array.from({ length: 7 }, (_, i) => {
          const t = i / 6,
            bend = i === 0 || i === 6 ? 0 : crack.bends[i - 1]!
          return {
            x: ox + (crack.u + crack.du * t * 1.8 - (crack.dv / length) * bend) * 128,
            y: oy + (crack.v + crack.dv * t * 1.8 + (crack.du / length) * bend) * 128,
          }
        })
      for (let i = 0; i < points.length - 1; i++) {
        const a = points[i]!,
          b = points[i + 1]!
        c.beginPath()
        c.moveTo(a.x, a.y)
        c.lineTo(b.x, b.y)
        c.strokeStyle = `rgba(79,67,46,${crack.alpha * 0.25})`
        c.lineWidth = crack.width + 1.1
        c.stroke()
        c.strokeStyle = `rgba(70,60,44,${crack.alpha})`
        c.lineWidth = crack.width * (1 - i * 0.1)
        c.stroke()
      }
      const branch = points[3]!
      c.beginPath()
      c.moveTo(branch.x, branch.y)
      c.lineTo(branch.x + crack.du * 45 - crack.dv * 25, branch.y + crack.dv * 45 + crack.du * 25)
      c.lineWidth = 0.6
      c.stroke()
    }
    c.restore()
  }
  return { image, trim }
}

/** Crop stone interiors, leaving course joints to geometry rather than double-painting them. */
async function masonryAtlas() {
  const source = new Image()
  source.src = ancientFaceUrl
  await source.decode()
  const image = document.createElement('canvas')
  image.width = image.height = 512
  const c = image.getContext('2d')!
  for (let index = 0; index < 16; index++) {
    const col = index % 4,
      row = Math.floor(index / 4),
      sx = (row < 2 ? [0.08, 0.37, 0.53, 0.72] : [0.15, 0.34, 0.48, 0.79])[col]!,
      sy = [0.1, 0.22, 0.58, 0.74][row]!
    c.drawImage(
      source,
      sx * source.width,
      sy * source.height,
      source.width * 0.1,
      source.height * 0.16,
      col * 128,
      row * 128,
      128,
      128,
    )
  }
  stoneAlbedo(image, 'face')
  // Match the crop values before choosing blocks: broad wear stays, high-contrast
  // photographic speckle and accidental dark/light atlas stripes are restrained.
  const pixels = c.getImageData(0, 0, 512, 512),
    means = new Float64Array(16)
  for (let y = 0; y < 512; y++)
    for (let x = 0; x < 512; x++) {
      const i = (y * 512 + x) * 4,
        cell = Math.floor(y / 128) * 4 + Math.floor(x / 128)
      means[cell]! +=
        (pixels.data[i]! * 0.2126 + pixels.data[i + 1]! * 0.7152 + pixels.data[i + 2]! * 0.0722) /
        16384
    }
  for (let y = 0; y < 512; y++)
    for (let x = 0; x < 512; x++) {
      const i = (y * 512 + x) * 4,
        cell = Math.floor(y / 128) * 4 + Math.floor(x / 128),
        value =
          pixels.data[i]! * 0.2126 + pixels.data[i + 1]! * 0.7152 + pixels.data[i + 2]! * 0.0722,
        target = 116 + (means[cell]! - 116) * 0.25 + (value - means[cell]!) * 0.8
      for (let channel = 0; channel < 3; channel++)
        pixels.data[i + channel] = target + (pixels.data[i + channel]! - value) * 0.8
    }
  c.putImageData(pixels, 0, 0)
  return refineWallStone(image)
}

function sample(pattern: CanvasPattern, width: number, height: number, resolution = 1024) {
  const image = document.createElement('canvas')
  image.width = resolution
  image.height = Math.max(64, Math.round((resolution * height) / width))
  const c = image.getContext('2d', { willReadFrequently: true })!
  c.scale(image.width / width, image.height / height)
  c.fillStyle = pattern
  c.fillRect(0, 0, width, height)
  return image
}
function texture(image: HTMLCanvasElement, color = true) {
  const result = new THREE.CanvasTexture(image)
  result.wrapS = result.wrapT = THREE.RepeatWrapping
  result.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace
  result.anisotropy = 4
  return result
}
/** Remove baked darkness from reused albedo, without changing the approved floor images. */
function stoneAlbedo(image: HTMLCanvasElement, plane: 'face' | 'cap' | 'wood') {
  const c = image.getContext('2d')!,
    pixels = c.getImageData(0, 0, image.width, image.height)
  for (let i = 0; i < pixels.data.length; i += 4) {
    const r = pixels.data[i]!,
      g = pixels.data[i + 1]!,
      b = pixels.data[i + 2]!,
      value = 0.2126 * r + 0.7152 * g + 0.0722 * b,
      target =
        plane === 'cap'
          ? 20 + 230 * Math.pow(value / 255, 0.78)
          : plane === 'face'
            ? 10 + 232 * Math.pow(value / 255, 0.82)
            : 6 + 245 * Math.pow(value / 255, 0.9),
      chroma = plane === 'wood' ? 1 : 0.72
    pixels.data[i] = target + (r - value) * chroma
    pixels.data[i + 1] = target + (g - value) * chroma
    pixels.data[i + 2] = target + (b - value) * chroma
  }
  c.putImageData(pixels, 0, 0)
  return image
}
/** Restrained relief and roughness follow actual painted joints and wear, never random noise. */
function surfaceMaps(source: HTMLCanvasElement) {
  const bump = document.createElement('canvas'),
    rough = document.createElement('canvas')
  bump.width = rough.width = source.width
  bump.height = rough.height = source.height
  const pixels = source.getContext('2d')!.getImageData(0, 0, source.width, source.height),
    b = bump.getContext('2d')!.createImageData(source.width, source.height),
    r = rough.getContext('2d')!.createImageData(source.width, source.height)
  for (let i = 0; i < pixels.data.length; i += 4) {
    const luminance =
        pixels.data[i]! * 0.2126 + pixels.data[i + 1]! * 0.7152 + pixels.data[i + 2]! * 0.0722,
      height = Math.max(0, Math.min(255, (luminance - 22) * 1.7))
    for (const channel of [0, 1, 2]) {
      b.data[i + channel] = height
      r.data[i + channel] = 214 + (255 - height) * 0.14
    }
    b.data[i + 3] = r.data[i + 3] = 255
  }
  bump.getContext('2d')!.putImageData(b, 0, 0)
  rough.getContext('2d')!.putImageData(r, 0, 0)
  return { bumpMap: texture(bump, false), roughnessMap: texture(rough, false) }
}
export async function createDungeon3DMaterials(floors: FoundationFloor[], seed = 'ancient') {
  const textures = new Set<THREE.Texture>(),
    materials = new Set<THREE.Material>()
  const stone = (image: HTMLCanvasElement, bumpScale = 0.018) => {
    const map = texture(image),
      surface = surfaceMaps(image)
    for (const value of [map, surface.bumpMap, surface.roughnessMap]) textures.add(value)
    const result = new THREE.MeshStandardMaterial({
      map,
      ...surface,
      bumpScale,
      roughness: 1,
      metalness: 0,
    })
    materials.add(result)
    return result
  }
  const floorMaterials = new Map<FoundationFloor, THREE.MeshStandardMaterial>()
  for (const floor of [...new Set(floors)]) {
    const floorMaterial = stone(await floorStoneAtlas(floor), 0.0009)
    floorMaterial.vertexColors = true
    floorMaterials.set(floor, floorMaterial)
  }
  const { image: capImage, trim: trimImage } = await copingSurface(seed)
  const art = await loadFoundationArt('ruins', false, 'study-broad'),
    masonry = stone(await masonryAtlas(), 0.0018),
    cap = stone(capImage, 0.002),
    trim = stone(trimImage, 0.002),
    step = stone(sample(art.cap, 256, 256, 512), 0.009)
  cap.color.set('#e8decb')
  trim.color.copy(cap.color)
  step.color.set('#aaa595')
  const frame = masonry.clone()
  frame.color.setRGB(1.28, 1.23, 1.1)
  frame.vertexColors = true
  materials.add(frame)
  const wallWeathering = createWallWeathering(seed)
  wallWeathering.apply(masonry)
  wallWeathering.apply(frame, 0.65)
  const stairEdge = frame.clone()
  stairEdge.color.setRGB(0.66, 0.65, 0.6)
  wallWeathering.apply(stairEdge, 0.45)
  materials.add(stairEdge)
  textures.add(wallWeathering.cracks)
  // Crop grain between the source leaf's painted metal bands; hardware is real geometry.
  const woodImage = document.createElement('canvas')
  woodImage.width = 256
  woodImage.height = 512
  woodImage
    .getContext('2d')!
    .drawImage(
      art.wood,
      art.wood.width * 0.33,
      art.wood.height * 0.34,
      art.wood.width * 0.065,
      art.wood.height * 0.29,
      0,
      0,
      256,
      512,
    )
  const wood = stone(refineOak(stoneAlbedo(woodImage, 'wood')), 0.0006)
  wood.color.set('#dfbb8f')
  const iron = new THREE.MeshStandardMaterial({
      color: '#353834',
      metalness: 0.7,
      roughness: 0.8,
    }),
    rivet = new THREE.MeshStandardMaterial({ color: '#77796e', metalness: 0.5, roughness: 0.68 }),
    brass = new THREE.MeshStandardMaterial({ color: '#b69a59', metalness: 0.7, roughness: 0.47 }),
    dark = new THREE.MeshStandardMaterial({ color: '#101413', roughness: 1 }),
    mortar = new THREE.MeshStandardMaterial({ color: '#5a574d', roughness: 1 }),
    grout = new THREE.MeshStandardMaterial({ color: '#555044', roughness: 1 }),
    torches = createTorchMaterials()
  for (const m of [
    iron,
    rivet,
    brass,
    dark,
    mortar,
    grout,
    torches.torchIron,
    torches.charcoal,
    torches.fuel,
    torches.fire,
  ])
    materials.add(m)
  textures.add(torches.bump)
  const selectedDoor = await createDoorCandidateMaterials()
  return {
    floors: floorMaterials,
    masonry,
    mortar,
    grout,
    cap,
    trim,
    frame,
    stairEdge,
    selectedDoor,
    step,
    wood,
    iron,
    rivet,
    brass,
    dark,
    torchIron: torches.torchIron,
    charcoal: torches.charcoal,
    fuel: torches.fuel,
    fire: torches.fire,
    flameClock: torches.flameClock,
    get estimatedTextureBytes() {
      return (
        selectedDoor.estimatedTextureBytes +
        [...textures].reduce((sum, t) => {
          const image = t.image as HTMLCanvasElement
          return sum + (image.width * image.height * 4 * 4) / 3
        }, 0)
      )
    },
    dispose() {
      selectedDoor.dispose()
      materials.forEach((m) => m.dispose())
      textures.forEach((t) => t.dispose())
    },
    invalidateShaders() {
      selectedDoor.invalidateShaders()
      materials.forEach((m) => {
        m.needsUpdate = true
      })
    },
    setWireframe(value: boolean) {
      selectedDoor.setWireframe(value)
      for (const m of materials)
        if (m instanceof THREE.MeshStandardMaterial) {
          m.wireframe = value
          m.needsUpdate = true
        }
    },
  }
}
export type Dungeon3DMaterials = Awaited<ReturnType<typeof createDungeon3DMaterials>>
