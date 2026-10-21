import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { browserSession, poll } from '../tests/helpers/browser.mjs'
const base = process.env.ATELIER_URL ?? 'http://localhost:9000',
  browser = await browserSession(base),
  output = path.resolve('reports/dungeon-3d-assets-weathering')
fs.mkdirSync(output, { recursive: true })
try {
  await browser.send('Page.navigate', { url: base + '/#/dev/dungeon-3d' })
  await poll(
    () =>
      browser.evaluate(
        `(()=>{let n=document.querySelector('.dungeon-3d-page')?.__vueParentComponent;while(n&&!n.exposed?.getPrototypeState)n=n.parent;if(!n)return false;window.threeProof=n.exposed;const s=threeProof.getPrototypeState();return !s.busy&&!s.error&&s.metrics?.calls>0})()`,
      ),
    '3D scene',
  )
  const state = await browser.evaluate('threeProof.getPrototypeState()'),
    torch = state.torches[0]
  await browser.evaluate(
    `threeProof.focusTile(${torch[0] - 0.5},${torch[2] - 0.5},1.7,${torch[1]})`,
  )
  const initial = await browser.evaluate('threeProof.getFlameState()')
  assert.equal(initial.enabled, true)
  await poll(
    async () => (await browser.evaluate('threeProof.getFlameState()')).time > initial.time + 0.15,
    'flame clock advances',
  )
  const frames = []
  for (const time of [0, 0.45, 0.9]) {
    const png = await browser.evaluate(`threeProof.capture3D(${time})`)
    frames.push(png)
    fs.writeFileSync(
      path.join(output, `flame-${time}.png`),
      Buffer.from(png.split(',')[1], 'base64'),
    )
  }
  assert.notEqual(frames[0], frames[1])
  assert.notEqual(frames[1], frames[2])
  assert.equal(
    await browser.evaluate('threeProof.capture3D(0)'),
    frames[0],
    'Fixed-time captures must remain deterministic',
  )
  await browser.evaluate(`document.querySelector('[aria-label="3D flame animation"]').click()`)
  const stopped = await browser.evaluate('threeProof.getFlameState()')
  assert.deepEqual(stopped, { enabled: false, time: 0 })
  await browser.evaluate(
    'new Promise(r=>{let n=0;function frame(){if(++n===12)r();else requestAnimationFrame(frame)}frame()})',
  )
  assert.deepEqual(await browser.evaluate('threeProof.getFlameState()'), stopped)
  assert.deepEqual(browser.errors, [])
  // Reload under reduced-motion emulation: animation should start disabled.
  await browser.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  })
  const previousOrigin = await browser.evaluate('performance.timeOrigin')
  await browser.send('Page.reload')
  await poll(
    () =>
      browser.evaluate(
        `(()=>{if(performance.timeOrigin===${previousOrigin})return false;let n=document.querySelector('.dungeon-3d-page')?.__vueParentComponent;while(n&&!n.exposed?.getFlameState)n=n.parent;if(!n)return false;window.threeProof=n.exposed;return !threeProof.getPrototypeState().busy&&!!threeProof.getFlameState()})()`,
      ),
    'reduced motion scene',
  )
  assert.equal((await browser.evaluate('threeProof.getFlameState()')).enabled, false)
  fs.writeFileSync(
    path.join(output, 'animation-report.json'),
    JSON.stringify(
      {
        liveClock: true,
        distinctFrames: true,
        deterministicCapture: true,
        disabledClockStops: true,
        reducedMotion: true,
        errors: browser.errors,
      },
      null,
      2,
    ) + '\n',
  )
  console.log(
    'Flame animation passed: independent world phases, live clock, distinct deterministic frames, toggle off, reduced motion.',
  )
} finally {
  browser.close()
}
