import fs from 'node:fs'
import assert from 'node:assert/strict'
import { DEFAULT_CONFIG, generateDungeon } from '../packages/dungeon-core/dist/index.js'
import { projectedStairMarkers } from '../apps/dungeon-atelier/src/features/dungeon/rendering/visual-foundation/stair-placement.ts'
import { mountedTorchPlacements } from '../apps/dungeon-atelier/src/features/dungeon/rendering/mounted-placement.ts'
import { formatProductionReports } from './format-production-reports.mjs'
const report = {
  maps: 0,
  stairs: 0,
  torches: 0,
  sizes: [16, 24, 32, 64, 96],
  seedsPerSize: 60,
  missing: [],
  floorPlaques: 0,
  wallPlaques: 0,
}
for (const size of report.sizes)
  for (let i = 0; i < report.seedsPerSize; i++) {
    const r = generateDungeon({
      ...DEFAULT_CONFIG,
      width: size,
      height: size,
      seed: `visual-placement-${size}-${i}`,
      layoutStyle: i % 2 ? 'compact' : 'classic',
      roomSpacing: i % 2 ? 1 : 3,
      targetRoomCount: size < 32 ? 4 : size === 32 ? 8 : 30,
      maxRoomSize: size < 32 ? 6 : 12,
      roomShapeChance: 0.8,
      chamberBlockChance: 0.6,
      shortcutChance: 1,
    })
    assert(r.ok, JSON.stringify(r))
    report.maps++
    const before = JSON.stringify(r.floor)
    const markers = projectedStairMarkers(r.floor)
    for (const stair of r.floor.stairs) {
      report.stairs++
      if (!markers.has(stair.id)) report.missing.push({ seed: r.floor.seed, stair })
      else if (markers.get(stair.id).plane === 'wall') report.wallPlaques++
      else report.floorPlaques++
    }
    report.torches += mountedTorchPlacements(r.floor).torches.length
    assert.equal(JSON.stringify(r.floor), before)
  }
assert.deepEqual(report.missing, [])
fs.mkdirSync('reports/production', { recursive: true })
fs.writeFileSync('reports/production/placement-report.json', JSON.stringify(report, null, 2) + '\n')
await formatProductionReports()
console.log(JSON.stringify({ passed: true, ...report }, null, 2))
