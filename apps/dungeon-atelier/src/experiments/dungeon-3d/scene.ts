import * as THREE from 'three'
import { GeometryBatches, copingGeometry, disposeGeometry, doorCopingGeometry } from './geometry'
import { BASE_WALL_HEIGHT, appearanceHash, createCapOccupancy, capAppearance } from './plan'
import { floorFootprint, planStoneSlabs, wallCourses } from './asset-model'
import { slabGeometry, dressedMasonryGeometry } from './asset-geometry'
import { addDoorFrame } from './asset-props'
import { addSelectedDoor } from './selected-door'
import { addTorchCandidate } from './torch-candidates'
import type { Dungeon3DPlan } from './plan'
import type { Dungeon3DMaterials } from './materials'
import { planStaircases } from './stair-layout'
import { addStoneStaircase } from './stone-staircase'
import { masonryRuns } from './wall-runs'
import { planRuinsCaps, planRuinsWallRun } from './ruins-placement'
import { ruinsWallGeometry } from './ruins-wall-geometry'
import type { Dungeon3DTheme } from './themes'

const identity = new THREE.Matrix4()
function matrix(x: number, y: number, z: number, rotation = 0) {
  return new THREE.Matrix4().makeRotationY(rotation).setPosition(x, y, z)
}

export function buildDungeon3D(plan: Dungeon3DPlan, materials: Dungeon3DMaterials) {
  const root = new THREE.Group(),
    floors = new GeometryBatches()
  root.name = 'Ancient experimental dungeon'
  const capRules = planRuinsCaps(plan)
  const ruleProof: { walls: { run: string; wear: string }[]; caps: unknown[] } = {
    walls: [],
    caps: [...capRules.entries()],
  }
  const staircaseLayouts = planStaircases(plan)
  const staircaseProof: ReturnType<typeof addStoneStaircase>[] = []
  const slabPlan = planStoneSlabs(plan)
  for (const r of floorFootprint(plan)) {
    const bed = new THREE.PlaneGeometry(r.width, r.depth)
      .rotateX(-Math.PI / 2)
      .translate(r.x + r.width / 2, -0.012, r.z + r.depth / 2)
    floors.add(materials.grout, bed, identity, null)
    bed.dispose()
  }
  let slabCount = 0
  for (const slab of slabPlan) {
    const geometry = slabGeometry(slab)
    if (!geometry) continue
    floors.add(
      materials.floors.get(slab.material)!,
      geometry,
      identity,
      null,
      slab.tint,
      slab.atlas,
      slab.turn,
    )
    geometry.dispose()
    slabCount++
  }
  const floorGroup = floors.finish()
  floorGroup.name = 'Beveled Ancient slabs over recessed grout'
  floorGroup.userData = {
    slabCount,
    minimumTop: Math.min(...slabPlan.map((s) => s.top)),
    maximumTop: Math.max(...slabPlan.map((s) => s.top)),
  }
  root.add(floorGroup)
  let restoredWalls = new THREE.Group(),
    ruinedWalls = new THREE.Group()
  let activeTheme: Dungeon3DTheme = 'restored-crypt'
  function setTheme(theme: Dungeon3DTheme) {
    activeTheme = theme
    restoredWalls.visible = theme === 'restored-crypt'
    ruinedWalls.visible = theme === 'ancient-ruins'
  }
  let architecture = new THREE.Group(),
    height = BASE_WALL_HEIGHT,
    open = false,
    doorHeadCutaway = false
  const torchLights: THREE.PointLight[] = []
  const torchPositions: THREE.Vector3[] = [],
    lightTarget = new THREE.Vector3()
  let torchLighting = true,
    torchLightBudget = 8
  let torchVisible: ((x: number, z: number) => boolean) | undefined
  const intactCoverage = createCapOccupancy(plan),
    cutawayCoverage = createCapOccupancy(plan, true),
    capOccupied = (x: number, z: number) =>
      (doorHeadCutaway ? cutawayCoverage : intactCoverage)(x, z)

  // Reuse eight local lights near the inspected area instead of leaving later torches unlit.
  function updateTorchLights(target = lightTarget, force = false) {
    if (!force && lightTarget.equals(target)) return false
    lightTarget.copy(target)
    const nearest = torchPositions
      .filter((_, index) => {
        const mount = plan.mounts.torches[index]!
        return !torchVisible || torchVisible(mount.x, mount.y)
      })
      .sort(
        (a, b) =>
          Math.hypot(a.x - target.x, a.z - target.z) - Math.hypot(b.x - target.x, b.z - target.z),
      )
    let changed = false
    torchLights.forEach((light, index) => {
      const position = nearest[index]
      const visible = torchLighting && !!position && index < torchLightBudget
      if (light.visible !== visible || (position && !light.position.equals(position))) {
        changed = true
        light.shadow.needsUpdate = true
      }
      light.visible = visible
      if (position) light.position.copy(position)
    })
    return changed
  }

  function rebuild() {
    root.remove(architecture)
    disposeGeometry(architecture)
    torchLights.forEach((light) => light.shadow.dispose())
    torchLights.length = 0
    torchPositions.length = 0
    ruleProof.walls.length = 0
    const batch = new GeometryBatches(),
      restoredBatch = new GeometryBatches(),
      ruinedBatch = new GeometryBatches(),
      detail = dressedMasonryGeometry(),
      caps = new Map<string, THREE.BufferGeometry>()
    materials.masonry.vertexColors = true
    materials.cap.vertexColors = true
    materials.trim.vertexColors = true
    for (const wall of plan.walls) {
      const tint = 0.97 + appearanceHash(plan.floor.seed, wall.x, wall.y) * 0.06
      for (const r of wall.rects)
        batch.box(
          materials.mortar,
          r.x + r.width / 2,
          height / 2,
          r.z + r.depth / 2,
          r.width,
          height,
          r.depth,
          identity,
          'wall',
          tint,
        )
      const boundary = wall.edges
          .map((e) =>
            capOccupied((e.ax + e.bx) / 2 + e.nx * 0.001, (e.az + e.bz) / 2 + e.nz * 0.001) ? 1 : 0,
          )
          .join(''),
        wear = Math.floor(appearanceHash(plan.floor.seed, wall.x, wall.y, 719) * 8),
        key = `${wall.mask}:${wall.cornerFill}:${boundary}:${wear}`
      let cap = caps.get(key)
      if (!cap) {
        cap = copingGeometry(wall.rects, wall.x, wall.y, capOccupied, wear)
        caps.set(key, cap)
      }
      const finish = capAppearance(plan.floor.seed, wall.x, wall.y)
      batch.add(
        materials.cap,
        cap,
        matrix(wall.x, height, wall.y),
        null,
        tint,
        finish.atlas,
        finish.turn,
        capRules.get(`${wall.x},${wall.y}`),
      )
    }
    for (const edge of masonryRuns(plan)) {
      const alongX = edge.az === edge.bz
      for (const block of wallCourses(plan.floor.seed, edge, height)) {
        const { a, b, low, high } = block,
          transform = new THREE.Matrix4().compose(
            new THREE.Vector3(
              alongX ? (a + b) / 2 : edge.ax,
              (low + high) / 2,
              alongX ? edge.az : (a + b) / 2,
            ),
            new THREE.Quaternion().setFromAxisAngle(
              new THREE.Vector3(0, 1, 0),
              Math.atan2(edge.nx, edge.nz),
            ),
            new THREE.Vector3(b - a, high - low, block.relief),
          )
        restoredBatch.add(
          materials.masonry,
          detail,
          transform,
          null,
          block.tint,
          block.atlas,
          block.turn,
        )
      }
    }
    for (const edge of masonryRuns(plan)) {
      const alongX = edge.az === edge.bz
      for (const { block, placement } of planRuinsWallRun(plan.floor.seed, edge, height)) {
        ruleProof.walls.push({ run: placement.run, wear: placement.wear })
        const geometry = ruinsWallGeometry(
            block.b - block.a,
            block.high - block.low,
            block.relief,
            appearanceHash(plan.floor.seed, block.a, edge.ax + edge.az + block.low, 9653),
            appearanceHash(plan.floor.seed, block.a, edge.ax + edge.az + block.low, 9659),
          ),
          transform = matrix(
            alongX ? (block.a + block.b) / 2 : edge.ax,
            (block.low + block.high) / 2,
            alongX ? edge.az : (block.a + block.b) / 2,
            Math.atan2(edge.nx, edge.nz),
          )
        ruinedBatch.add(materials.masonry, geometry, transform, null, 1, 0, 0, placement)
        geometry.dispose()
      }
    }
    restoredWalls = restoredBatch.finish()
    ruinedWalls = ruinedBatch.finish()
    restoredWalls.name = 'Restored Crypt original coursed faces'
    ruinedWalls.name = 'Ancient Ruins mixed bonded stone faces'
    // Three.js raycasts hidden meshes. Ignore the inactive presentation for picking too.
    for (const group of [restoredWalls, ruinedWalls])
      group.traverse((object) => {
        if (object instanceof THREE.Mesh)
          object.raycast = function (raycaster, intersections) {
            if (group.visible) THREE.Mesh.prototype.raycast.call(this, raycaster, intersections)
          }
      })
    setTheme(activeTheme)

    for (const door of plan.doors) {
      batch.walkOwner = door.position.y * plan.floor.width + door.position.x
      const parent = matrix(door.x, 0, door.z, door.rotation),
        opening = height * 0.84,
        width = 0.76,
        depth = 0.625
      if (door.type === 'secret')
        addDoorFrame(
          batch,
          materials,
          parent,
          height,
          opening,
          !doorHeadCutaway || door.type === 'secret',
        )
      if (!doorHeadCutaway || door.type === 'secret') {
        const lintel = doorCopingGeometry(
          1,
          depth,
          Math.floor(appearanceHash(plan.floor.seed, door.x, door.z, 719) * 8),
        )
        const finish = capAppearance(plan.floor.seed, door.x, door.z)
        batch.add(
          materials.cap,
          lintel,
          parent.clone().multiply(matrix(0, height, 0)),
          null,
          1,
          finish.atlas,
          finish.turn,
          capRules.get(`${door.position.x},${door.position.y}`),
        )
        lintel.dispose()
      }
      if (door.type === 'secret') {
        // Only explicitly revealed secret doors reach this branch; concealed ones became ordinary masonry.
        batch.box(materials.trim, 0, opening / 2, 0.02, width, opening, 0.15, parent, 'wall')
        batch.box(materials.brass, 0.22, opening * 0.5, 0.105, 0.025, 0.11, 0.035, parent)
        continue
      }
      addSelectedDoor(batch, materials, parent, height, open, !doorHeadCutaway, plan.floor.seed)
    }
    staircaseProof.length = 0
    const stairGroups: THREE.Group[] = []
    for (const stair of staircaseLayouts) {
      const stairBatch = new GeometryBatches()
      const logical = plan.stairs.find((item) => item.id === stair.id)!
      stairBatch.walkOwner = logical.position.y * plan.floor.width + logical.position.x
      staircaseProof.push(addStoneStaircase(stairBatch, materials, stair, height, plan.floor.seed))
      const group = stairBatch.finish()
      group.name = `Architectural staircase ${stair.direction}`
      group.userData.stairId = stair.id
      stairGroups.push(group)
    }
    const lightGroup = new THREE.Group()
    for (const torch of plan.mounts.torches) {
      batch.walkOwner = torch.y * plan.floor.width + torch.x
      const facing = plan.mounts.facings[`${torch.x},${torch.y}`],
        side = facing === 'east',
        parent = matrix(
          torch.x + (side ? 0.8125 : 0.5),
          0,
          torch.y + (side ? 0.5 : 0.8125),
          side ? Math.PI / 2 : 0,
        ),
        mount = height * 0.64
      addTorchCandidate(batch, materials, parent, 'brazier', { mount, faceOffset: 0 })
      torchPositions.push(new THREE.Vector3(0, mount + 0.3, 0.4).applyMatrix4(parent))
      if (torchLights.length < 8) {
        const light = new THREE.PointLight('#ffa23e', 3.6, 6, 2)
        lightGroup.add(light)
        torchLights.push(light)
      }
    }
    detail.dispose()
    caps.forEach((g) => g.dispose())
    architecture = batch.finish()
    architecture.name = 'Masonry, actual portals, stairs and sconces'
    architecture.add(lightGroup, ...stairGroups, restoredWalls, ruinedWalls)
    root.add(architecture)
    updateTorchLights(lightTarget, true)
  }
  rebuild()
  const bounds = new THREE.Box3()
  function updateBounds() {
    // Cosmetic relief must not move the shared camera fit or the established light rig.
    architecture.remove(ruinedWalls)
    bounds.setFromObject(root)
    architecture.add(ruinedWalls)
  }
  updateBounds()
  return {
    root,
    floorGroup,
    staircaseProof,
    ruleProof,
    bounds,
    plan,
    torchLights,
    torchPositions,
    updateTorchLights,
    setTorchVisibility(predicate?: (x: number, z: number) => boolean) {
      torchVisible = predicate
      updateTorchLights(lightTarget, true)
    },
    setTheme,
    setHeight(multiplier: number) {
      if (height === BASE_WALL_HEIGHT * multiplier) return
      height = BASE_WALL_HEIGHT * multiplier
      rebuild()
      updateBounds()
    },
    setDoorsOpen(value: boolean) {
      if (open === value) return
      open = value
      rebuild()
    },
    setDoorHeadCutaway(value: boolean) {
      if (doorHeadCutaway === value) return
      doorHeadCutaway = value
      rebuild()
    },
    setTorchLightBudget(value: number) {
      if (torchLightBudget === value) return
      torchLightBudget = value
      updateTorchLights(lightTarget, true)
    },
    setTorchLighting(value: boolean) {
      if (torchLighting === value) return
      torchLighting = value
      updateTorchLights(lightTarget, true)
    },
    get height() {
      return height
    },
    dispose() {
      torchLights.forEach((light) => light.shadow.dispose())
      disposeGeometry(root)
      root.clear()
    },
  }
}
export type Dungeon3DScene = ReturnType<typeof buildDungeon3D>
