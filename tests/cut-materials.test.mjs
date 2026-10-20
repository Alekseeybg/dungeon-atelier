import { test } from 'node:test'
import assert from 'node:assert/strict'
import { assignCutMaterials } from '../apps/dungeon-atelier/src/features/dungeon/rendering/visual-foundation/cut-material-model.ts'
import { createFoundationScene } from '../apps/dungeon-atelier/src/features/dungeon/rendering/visual-foundation/model.ts'
import { createArchitecturePlan } from '../apps/dungeon-atelier/src/features/dungeon/rendering/architecture-model.ts'
import { copingBlocks } from '../apps/dungeon-atelier/src/features/dungeon/rendering/visual-foundation/coping-model.ts'
import { cutCopingBlocks } from '../apps/dungeon-atelier/src/features/dungeon/rendering/visual-foundation/cut-coping-model.ts'

// A run with a corner and doorway bonding blocks, matching the reported short-wall case.
const blocks = [
  { x: 192.6, y: 512.6, width: 30.8, height: 30.8, image: 9, junction: true },
  { x: 224.6, y: 518, width: 27.8, height: 20, image: 9 },
  { x: 253.6, y: 518, width: 24.8, height: 20, image: 11 },
  { x: 279.6, y: 518, width: 39.8, height: 20, image: 6 },
  { x: 320.6, y: 512.6, width: 30.8, height: 30.8, image: 9, junction: true },
  { x: 352.6, y: 512.6, width: 30.8, height: 30.8, image: 9, junction: true },
]
test('short-wall crack selection excludes nearby repeats across corners and door bonding blocks', () => {
  for (let seed = 0; seed < 100; seed++) {
    const picks = assignCutMaterials(blocks, String(seed))
    for (let i = 0; i < picks.length; i++)
      for (let j = i + 1; j < Math.min(picks.length, i + 4); j++)
        assert.notEqual(
          picks[i].image,
          picks[j].image,
          `Repeated source at ${i},${j}, seed ${seed}`,
        )
    assert(
      picks.every((p) => p.image >= 0 && p.image < 12 && p.quarterTurn >= 0 && p.quarterTurn < 4),
    )
    assert(
      picks.every(
        (p) =>
          p.crop.x >= 0.15 &&
          p.crop.y >= 0.15 &&
          p.crop.x + p.crop.width <= 0.85 &&
          p.crop.y + p.crop.height <= 0.85,
      ),
    )
  }
})
test('material choices are deterministic, seed-sensitive, order-independent and leave geometry untouched', () => {
  const before = JSON.stringify(blocks),
    a = assignCutMaterials(blocks, 'alpha')
  assert.deepEqual(a, assignCutMaterials(blocks, 'alpha'))
  assert.deepEqual(a, assignCutMaterials([...blocks].reverse(), 'alpha').reverse())
  assert.notDeepEqual(a, assignCutMaterials(blocks, 'beta'))
  assert.equal(JSON.stringify(blocks), before)
})

test('every neighboring stone in the actual four-door fixture has a different source pattern', () => {
  const scene = createFoundationScene(),
    plan = createArchitecturePlan(scene.floor, {}),
    nodes = [
      ...plan.walls.map((w) => ({ ...w, corner: w.cornerFill })),
      ...plan.doors.map((d) => ({
        ...d.position,
        mask: d.orientation === 'north-south' ? 10 : 5,
        corner: 0,
        door: true,
      })),
    ],
    stones = cutCopingBlocks(nodes, copingBlocks(nodes, 'hewn'))
  for (const seed of [scene.floor.seed, 'alpha', 'beta', 'gamma']) {
    const materials = assignCutMaterials(stones, seed)
    let neighbors = 0
    for (let i = 0; i < stones.length; i++)
      for (let j = i + 1; j < stones.length; j++) {
        const a = stones[i],
          b = stones[j],
          gapX = Math.max(a.x - b.x - b.width, b.x - a.x - a.width, 0),
          gapY = Math.max(a.y - b.y - b.height, b.y - a.y - a.height, 0)
        if (gapX > 1.21 || gapY > 1.21) continue
        neighbors++
        assert.notEqual(
          materials[i].image,
          materials[j].image,
          `Adjacent pattern repeated at ${i},${j}`,
        )
      }
    assert(neighbors > 80, 'Exercise the connected layout rather than an empty adjacency set')
  }
})
