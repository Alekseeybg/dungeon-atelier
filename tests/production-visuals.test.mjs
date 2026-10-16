import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_CONFIG, generateDungeon, roomCells } from '../packages/dungeon-core/dist/index.js'
import {
  mapProjection,
  cellCenter,
  groundCell,
} from '../apps/dungeon-atelier/src/features/dungeon/rendering/map-projection.ts'
import {
  DEFAULT_ANCIENT,
  ANCIENT_FLOORS,
  ANCIENT_CAPS,
  normalizeAncient,
  ancientOptions,
  ancientFloorAssignments,
} from '../apps/dungeon-atelier/src/features/dungeon/rendering/ancient-settings.ts'
import { mountedTorchPlacements } from '../apps/dungeon-atelier/src/features/dungeon/rendering/mounted-placement.ts'
import { concealSecretArchitecture } from '../apps/dungeon-atelier/src/features/dungeon/rendering/dimensional-model.ts'
import { projectedStairMarkers } from '../apps/dungeon-atelier/src/features/dungeon/rendering/visual-foundation/stair-placement.ts'

const floors = []
for (const size of [32, 64, 96])
  for (const layout of ['classic', 'compact'])
    for (const suffix of ['amber', 'slate']) {
      const result = generateDungeon({
        ...DEFAULT_CONFIG,
        width: size,
        height: size,
        seed: `production-${size}-${layout}-${suffix}`,
        layoutStyle: layout,
        roomSpacing: layout === 'classic' ? 3 : 1,
        targetRoomCount: size === 32 ? 8 : size === 64 ? 24 : 48,
        maxRoomSize: size === 32 ? 7 : 12,
        roomShapeChance: 0.6,
        chamberBlockChance: 0.5,
        shortcutChance: 1,
      })
      assert(result.ok, JSON.stringify(result))
      floors.push(result.floor)
    }
test('all presentation styles round-trip square logical cells independently of raster density', () => {
  for (const style of ['ancient', 'stone', 'classic', 'dimensional'])
    for (const floor of floors) {
      const p = mapProjection(style)
      assert.equal(p.width, 32)
      assert.equal(p.height, style === 'ancient' ? 26 : 32)
      for (const cell of [
        { x: 0, y: 0 },
        { x: floor.width - 1, y: floor.height - 1 },
        ...floor.stairs.map((s) => s.position),
      ])
        assert.deepEqual(groundCell(cellCenter(cell, style), floor, style), cell)
      assert.equal(groundCell({ x: -0.1, y: 0 }, floor, style), null)
      assert.equal(groundCell({ x: 0, y: floor.height * p.height }, floor, style), null)
    }
})
test('appearance catalog preserves all seven floors and valid cap assemblies; malformed persistence uses defaults', () => {
  assert.equal(new Set(ANCIENT_FLOORS.map((f) => f.value)).size, 7)
  assert.equal(new Set(ANCIENT_CAPS.map((f) => f.value)).size, 5)
  assert.deepEqual(
    normalizeAncient({ floor: 'missing', wall: 'x', cap: 'oops', lighting: 'true' }),
    DEFAULT_ANCIENT,
  )
  for (const c of ANCIENT_CAPS) {
    const options = ancientOptions({ ...DEFAULT_ANCIENT, cap: c.value })
    if (options.capProfile === 'chamfered') assert.equal(options.coping, 'hewn')
    assert.equal(options.separation, true)
  }
})
test('material zoning is coherent per room, rare use is bounded, and floor data never changes', () => {
  for (const floor of floors) {
    const before = JSON.stringify(floor),
      a = { ...DEFAULT_ANCIENT, distribution: 'regional', corridor: 'previous' },
      assigned = ancientFloorAssignments(floor, a)
    assert.deepEqual(assigned, ancientFloorAssignments(floor, a))
    let rareRooms = 0
    for (const room of floor.rooms) {
      const materials = new Set(
        roomCells(room).map((p) => assigned.get(p.y * floor.width + p.x) ?? a.floor),
      )
      assert.equal(materials.size, 1)
      if (materials.has(a.rare)) rareRooms++
    }
    assert(rareRooms <= 1)
    assert.equal(ancientFloorAssignments(floor, DEFAULT_ANCIENT).size, 0)
    assert.equal(JSON.stringify(floor), before)
  }
})
test('generated sconces mount only on exposed masonry with clear approaches and deterministic spacing', () => {
  let side = 0,
    north = 0
  for (const original of floors) {
    const floor = concealSecretArchitecture(original),
      before = JSON.stringify(floor),
      mounts = mountedTorchPlacements(floor)
    assert.deepEqual(mounts, mountedTorchPlacements(floor))
    for (const [i, p] of mounts.torches.entries()) {
      assert.equal(floor.tiles[p.y][p.x], 'wall')
      const face = mounts.facings[`${p.x},${p.y}`]
      assert.equal(
        floor.tiles[p.y + (face === 'south' ? 1 : 0)][p.x + (face === 'east' ? 1 : 0)],
        'floor',
      )
      if (face === 'east') side++
      else north++
      for (const other of mounts.torches.slice(i + 1))
        assert(Math.abs(other.x - p.x) + Math.abs(other.y - p.y) >= 5)
      for (const d of [...floor.doors, ...floor.stairs])
        assert(Math.abs(d.position.x - p.x) + Math.abs(d.position.y - p.y) > 2)
    }
    assert.equal(JSON.stringify(floor), before)
    const inert = { ...floor, shortcuts: [], doors: floor.doors.filter((d) => d.type !== 'secret') }
    assert.deepEqual(mountedTorchPlacements(inert), mounts)
  }
  assert(north > 0 && side > 0)
})
test('every generated staircase in the release layout matrix has a separate clear-floor level marker', () => {
  for (const floor of floors) {
    const markers = projectedStairMarkers(floor)
    for (const stair of floor.stairs) {
      const box = markers.get(stair.id)
      assert(box, `${floor.seed} ${stair.direction} has no clear symbol placement`)
      const x = stair.position.x * 32,
        y = stair.position.y * 32
      assert(box.x + box.width < x || box.x > x + 32 || box.y > y + 32 || box.y + box.height < y)
    }
  }
})
