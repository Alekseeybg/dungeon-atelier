import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { browserSession, poll } from '../tests/helpers/browser.mjs'
const base = process.env.ATELIER_URL ?? 'http://localhost:9000',
  browser = await browserSession(base),
  output = path.resolve('reports/torch-study')
fs.mkdirSync(output, { recursive: true })
try {
  await browser.send('Page.navigate', { url: base + '/#/dev/dungeon-torches' })
  await poll(
    () =>
      browser.evaluate(
        `(()=>{let n=document.querySelector('.torch-study')?.__vueParentComponent;while(n&&!n.exposed?.getState)n=n.parent;if(!n)return false;window.torchProof=n.exposed;return !torchProof.getState().busy})()`,
      ),
    'torch comparison',
  )
  const state = await browser.evaluate('torchProof.getState()')
  assert.equal(state.error, '')
  assert.deepEqual(state.models, ['existing', 'basket', 'brazier'])
  async function capture(name) {
    await browser.evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
    const png = await browser.evaluate('torchProof.capture()')
    fs.writeFileSync(path.join(output, name + '.png'), Buffer.from(png.split(',')[1], 'base64'))
  }
  async function click(label) {
    await browser.evaluate(
      `(()=>{const n=[...document.querySelectorAll('button')].find(n=>n.textContent.trim()===${JSON.stringify(label)});if(!n)throw new Error('Missing control');n.click()})()`,
    )
  }
  await capture('three-quarter')
  await click('Gameplay')
  await capture('gameplay')
  await click('Three-quarter')
  for (const [label, file] of [
    ['Existing close-up', 'existing'],
    ['A close-up', 'basket'],
    ['B close-up', 'brazier'],
  ]) {
    await click(label)
    await capture(file)
  }
  await browser.evaluate(`document.querySelector('[aria-label="Torch study amber light"]').click()`)
  await capture('brazier-neutral')
  assert.deepEqual(browser.errors, [])
  fs.writeFileSync(
    path.join(output, 'report.json'),
    JSON.stringify({ state, errors: browser.errors }, null, 2) + '\n',
  )
  await browser.send('Page.navigate', { url: base + '/#/' })
  await poll(() => browser.evaluate('!!document.querySelector(".dungeon-canvas")'), 'editor return')
  console.log(
    'Torch comparison passed: existing + two new models, close-ups, gameplay, lighting, clean editor return.',
  )
} finally {
  browser.close()
}
