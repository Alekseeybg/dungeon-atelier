import { Worker } from 'node:worker_threads'
import { availableParallelism, cpus, platform, release } from 'node:os'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { stressCase } from '../tests/helpers/cases.mjs'
import { GENERATOR_VERSION, SCHEMA_VERSION } from '../packages/dungeon-core/dist/index.js'
const argument = (name, fallback) => {
  const i = process.argv.indexOf(name)
  return i < 0 ? fallback : process.argv[i + 1]
}
const count = Number(argument('--count', '10000')),
  workers = Number(argument('--workers', String(Math.min(4, availableParallelism())))),
  output = resolve(argument('--output', 'reports/verification/latest'))
if (
  !Number.isInteger(count) ||
  count < 1 ||
  !Number.isInteger(workers) ||
  workers < 1 ||
  workers > 32
)
  throw Error('Use positive integer --count and --workers (maximum 32).')
const runId = new Date().toISOString().replace(/[:.]/g, '-')
await mkdir(resolve(output, 'failures'), { recursive: true })
let completed = 0
const received = new Set()
const successes = [],
  failures = [],
  coverage = { groups: 0, secrets: 0, shapes: {}, dimensions: {}, presets: {}, attempts: {} },
  writes = []
const start = performance.now()
await Promise.all(
  Array.from(
    { length: workers },
    (_, worker) =>
      new Promise((resolveWorker) => {
        const thread = new Worker(new URL('./stress-worker.mjs', import.meta.url), {
          workerData: { worker, workers, count },
        })
        thread.on('message', (m) => {
          received.add(m.index)
          completed++
          if (m.failure) {
            failures.push(m)
            writes.push(
              writeFile(
                resolve(output, 'failures', `case-${m.index}-${runId}.json`),
                JSON.stringify(m, null, 2) + '\n',
              ),
            )
          } else {
            successes.push({ index: m.index, ms: m.result.generationMs })
            coverage.attempts[m.result.attempts] = (coverage.attempts[m.result.attempts] ?? 0) + 1
            coverage.groups += m.result.groups
            coverage.secrets += m.result.secrets
            for (const shape of m.result.shapes)
              coverage.shapes[shape] = (coverage.shapes[shape] ?? 0) + 1
            const dim = `${m.config.width}x${m.config.height}`
            coverage.dimensions[dim] = (coverage.dimensions[dim] ?? 0) + 1
            coverage.presets[m.config.layoutStyle] =
              (coverage.presets[m.config.layoutStyle] ?? 0) + 1
          }
          if (completed % 500 === 0)
            console.log(`${completed}/${count}: ${failures.length} failures`)
        })
        let workerError
        thread.on('error', (error) => {
          workerError = error
        })
        thread.on('exit', (code) => {
          for (let index = worker; index < count; index += workers) {
            if (received.has(index)) continue
            const failure = {
              index,
              config: stressCase(index),
              failure: {
                name: 'WorkerFailure',
                message:
                  workerError?.message ?? 'Worker exited ' + code + ' before returning this case',
              },
            }
            failures.push(failure)
            writes.push(
              writeFile(
                resolve(output, 'failures', 'case-' + index + '-' + runId + '.json'),
                JSON.stringify(failure, null, 2) + '\n',
              ),
            )
          }
          resolveWorker()
        })
      }),
  ),
)
await Promise.all(writes)
const timings = successes.map((s) => s.ms).sort((a, b) => a - b),
  p = (f) => timings[Math.min(timings.length - 1, Math.floor((timings.length - 1) * f))] ?? null
const slowest = [...successes]
  .sort((a, b) => b.ms - a.ms)
  .slice(0, 10)
  .map((item) => ({ ...item, config: stressCase(item.index) }))
const report = {
  runAt: new Date().toISOString(),
  generatorVersion: GENERATOR_VERSION,
  schemaVersion: SCHEMA_VERSION,
  count,
  successful: successes.length,
  failed: failures.length,
  workers,
  wallSeconds: (performance.now() - start) / 1000,
  environment: {
    node: process.version,
    platform: platform(),
    release: release(),
    cpu: cpus()[0]?.model,
  },
  generationMs: {
    average: timings.reduce((a, b) => a + b, 0) / (timings.length || 1),
    median: timings.length
      ? (timings[Math.floor((timings.length - 1) / 2)] + timings[Math.floor(timings.length / 2)]) /
        2
      : null,
    p95: p(0.95),
    worst: p(1),
  },
  slowest,
  coverage,
  failures: failures.map(({ index, config, failure }) => ({ index, config, failure })),
}
await writeFile(resolve(output, `report-${runId}.json`), JSON.stringify(report, null, 2) + '\n')
await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2) + '\n')
await writeFile(
  resolve(output, 'report.md'),
  `# Dungeon stress verification\n\nGenerator ${GENERATOR_VERSION}; schema ${SCHEMA_VERSION}.\n\n- Cases: ${count}\n- Successful: ${successes.length}\n- Failed: ${failures.length}\n- Workers: ${workers}\n- Wall time: ${report.wallSeconds.toFixed(2)} seconds\n- Generation mean / median / p95 / worst: ${Object.values(
    report.generationMs,
  )
    .map((v) => v?.toFixed(2))
    .join(
      ' / ',
    )} ms\n\nEvery successful case was regenerated, independently graph-checked, exported, imported, and checked again. Timings measure the first generation including production validation; parallel-worker CPU contention affects results. Full reproduction data and coverage are in report.json. Failures are never skipped.\n`,
)
console.log(JSON.stringify({ ...report, failures: report.failures.slice(0, 3) }, null, 2))
if (failures.length) process.exitCode = 1
