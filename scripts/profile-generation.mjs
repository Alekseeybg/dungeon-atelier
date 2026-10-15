import { performance } from 'node:perf_hooks'
import { generateDungeon } from '../packages/dungeon-core/dist/index.js'
import { stressCase } from '../tests/helpers/cases.mjs'
const start = performance.now()
for (let i = 0; i < 1000; i++) {
  const r = generateDungeon(stressCase(i))
  if (!r.ok) throw Error(JSON.stringify({ config: stressCase(i), errors: r.errors }))
}
console.log(JSON.stringify({ generations: 1000, wallMs: performance.now() - start }))
