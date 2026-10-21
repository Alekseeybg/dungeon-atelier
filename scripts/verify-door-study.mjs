import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { browserSession, poll } from '../tests/helpers/browser.mjs'
const base = process.env.ATELIER_URL ?? 'http://localhost:9000',
  browser = await browserSession(base),
  output = path.resolve(process.env.ATELIER_DOOR_REPORT_DIR ?? 'reports/door-study')
fs.mkdirSync(output, { recursive: true })
try {
  await browser.send('Emulation.setDeviceMetricsOverride', {
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1,
    mobile: false,
  })
  await browser.send('Page.navigate', { url: base + '/#/dev/dungeon-doors' })
  await poll(
    () =>
      browser.evaluate(
        `(()=>{let n=document.querySelector('.door-study')?.__vueParentComponent;while(n&&!n.exposed?.getState)n=n.parent;if(!n)return false;window.doorProof=n.exposed;return !doorProof.getState().busy})()`,
      ),
    'door study',
  )
  const state = await browser.evaluate('doorProof.getState()')
  assert.equal(state.error, '')
  assert.deepEqual(state.models, ['existing', 'selected', 'arch'])
  async function settle() {
    await browser.evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
  }
  async function capture(name) {
    await settle()
    const png = await browser.evaluate('doorProof.capture()')
    fs.writeFileSync(path.join(output, name + '.png'), Buffer.from(png.split(',')[1], 'base64'))
  }
  await capture('three-quarter')
  assert.deepEqual(state.doorBlocked, [true, true, true])
  await browser.evaluate(`document.querySelector('[aria-label="Door study amber light"]').click()`)
  await capture('selected-neutral')
  await browser.evaluate(`document.querySelector('[aria-label="Door study amber light"]').click()`)
  for (const name of ['Front', 'Gameplay']) {
    await browser.evaluate(
      `(()=>{const n=[...document.querySelectorAll('button')].find(n=>n.textContent.trim()===${JSON.stringify(name)});n.click()})()`,
    )
    await capture(name.toLowerCase())
  }
  await browser.evaluate(`document.querySelector('[aria-label="Door study open doors"]').click()`)
  await settle()
  assert.equal((await browser.evaluate('doorProof.getState()')).opened, true)
  assert.deepEqual((await browser.evaluate('doorProof.getState()')).doorBlocked, [
    false,
    false,
    false,
  ])
  await capture('open')
  await browser.evaluate(`document.querySelector('[aria-label="Door study amber light"]').click()`)
  await capture('neutral-open')
  await browser.evaluate(
    `document.querySelector('[aria-label="Door study selected combination"]').click()`,
  )
  await settle()
  assert.deepEqual((await browser.evaluate('doorProof.getState()')).models, [
    'existing',
    'lintel',
    'arch',
  ])
  assert.deepEqual(browser.errors, [])
  fs.writeFileSync(
    path.join(output, 'report.json'),
    JSON.stringify({ state, browserErrors: browser.errors }, null, 2) + '\n',
  )
  // Return to the existing editor after unmounting the study.
  await browser.send('Page.navigate', { url: base + '/#/' })
  await poll(() => browser.evaluate('!!document.querySelector(".dungeon-canvas")'), 'editor return')
  console.log(
    'Door comparison passed: three models, shared views, open state, lighting, editor return, no browser errors.',
  )
} finally {
  browser.close()
}
