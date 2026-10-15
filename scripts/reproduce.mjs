import fs from 'node:fs'
import { verifyCase } from '../tests/helpers/verify-floor.mjs'
import { stressCase } from '../tests/helpers/cases.mjs'
const args = process.argv.slice(2),
  promote = args.includes('--promote')
const file = args.find((a) => a !== '--promote' && a !== '--index'),
  record = args.includes('--index')
    ? { config: stressCase(Number(file)) }
    : JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''))
if (promote) {
  const target = new URL('../tests/fixtures/regressions.json', import.meta.url),
    cases = JSON.parse(fs.readFileSync(target, 'utf8'))
  if (!cases.some((c) => JSON.stringify(c.config) === JSON.stringify(record.config))) {
    cases.push({
      id: 'promoted-' + cases.length,
      config: record.config,
      originalFailure: record.failure?.message ?? 'Manually preserved case',
    })
    fs.writeFileSync(target, JSON.stringify(cases, null, 2) + '\n')
  }
}
console.log(JSON.stringify({ config: record.config, result: verifyCase(record.config) }, null, 2))
