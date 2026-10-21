import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { browserSession, poll } from '../tests/helpers/browser.mjs'
const baseline = process.argv.includes('--baseline'),
  phase = baseline ? 'before' : 'after',
  base = process.env.ATELIER_URL ?? 'http://localhost:9000',
  output = path.resolve('reports/runtime-fixes'),
  b = await browserSession(base)
fs.mkdirSync(output, { recursive: true })
try {
  await b.send('Page.navigate', { url: base + '/#/dev/dungeon-3d' })
  await poll(
    () =>
      b.evaluate(
        `(()=>{let n=document.querySelector('.dungeon-3d-page')?.__vueParentComponent;while(n&&!n.exposed?.getPrototypeState)n=n.parent;if(!n)return false;window.runtimeProof=n.exposed;const s=runtimeProof.getPrototypeState();return !s.busy&&!s.error&&s.metrics?.calls>0})()`,
      ),
    '3D scene',
  )
  await b.evaluate(
    "document.querySelector('[aria-label=\"3D visual theme\"]')?.__vueParentComponent.emit('update:modelValue','restored-crypt')",
  )
  await b.evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
  for (const label of ['3D torch lighting', '3D shadows', '3D flame animation'])
    await b.evaluate(`document.querySelector('[aria-label=${JSON.stringify(label)}]').click()`)
  const initial = await b.evaluate('runtimeProof.getPrototypeState()'),
    caps = await b.evaluate('runtimeProof.getAssetProof().caps'),
    room = [...initial.floor.rooms].sort((a, c) => c.width * c.height - a.width * a.height)[0]
  const slider = async (label, value) => {
    await b.evaluate(
      `document.querySelector('[aria-label=${JSON.stringify(label)}]').__vueParentComponent.emit('update:modelValue',${value})`,
    )
    await b.evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
  }
  async function capture(name) {
    const png = await b.evaluate('runtimeProof.capture3D()')
    fs.writeFileSync(
      path.join(output, `${phase}-${name}.png`),
      Buffer.from(png.split(',')[1], 'base64'),
    )
  }
  await b.evaluate(
    `runtimeProof.focusTile(${room.x + room.width / 2 - 0.5},${room.y + room.height / 2 - 0.5},${Math.max(room.width, room.height) + 2})`,
  )
  await slider('3D camera rotation', 0)
  await slider('3D camera elevation', 90)
  await capture('top-down')
  await slider('3D camera elevation', 55)
  await capture('angled')
  if (!baseline) {
    const previous = JSON.parse(fs.readFileSync(path.join(output, 'before-report.json'), 'utf8'))
    assert.deepEqual(caps, previous.caps, 'Approved cap geometry/maps unchanged')
    const start = await b.evaluate('runtimeProof.getPrototypeState()'),
      url = await b.evaluate('location.href')
    const point = await b.evaluate(
      `(()=>{const r=document.querySelector('.three-viewport canvas').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`,
    )
    await b.send('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      button: 'left',
      buttons: 1,
      modifiers: 1,
      clickCount: 1,
      ...point,
    })
    await b.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      button: 'left',
      buttons: 1,
      modifiers: 1,
      x: point.x + 100,
      y: point.y,
    })
    await b.send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      button: 'left',
      buttons: 0,
      modifiers: 1,
      clickCount: 1,
      x: point.x + 100,
      y: point.y,
    })
    await b.evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
    const turned = await b.evaluate('runtimeProof.getPrototypeState()')
    assert.notEqual(turned.camera.rotation, start.camera.rotation)
    assert(
      turned.camera.target.every((v, i) => Math.abs(v - start.camera.target[i]) < 1e-8),
      'Alt-left rotation must not pan',
    )
    assert.equal(turned.camera.elevation, start.camera.elevation)
    assert.equal(await b.evaluate('location.href'), url)
  }
  assert.deepEqual(b.errors, [])
  fs.writeFileSync(
    path.join(output, `${phase}-report.json`),
    JSON.stringify(
      { caps, initial, altLeftRotation: !baseline, browserErrors: b.errors },
      null,
      2,
    ) + '\n',
  )
  console.log(
    `Runtime fixes ${phase}: torch/shadow-free captures, cap fingerprints${baseline ? '' : ', Alt-left rotation without pan/navigation'}.`,
  )
} finally {
  await b.close()
}
