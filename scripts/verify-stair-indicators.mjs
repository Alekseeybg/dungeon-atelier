import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { browserSession, poll } from '../tests/helpers/browser.mjs'

const baseline = process.argv.includes('--baseline'),
  phase = baseline ? 'before' : 'after',
  output = path.resolve('reports/stair-indicators'),
  base = process.env.ATELIER_URL ?? 'http://localhost:9000'
fs.mkdirSync(output, { recursive: true })
const b = await browserSession(base)
try {
  await b.send('Page.navigate', { url: base + '/#/dev/dungeon-3d' })
  await poll(
    () =>
      b.evaluate(
        `(()=>{let n=document.querySelector('.dungeon-3d-page')?.__vueParentComponent;while(n&&!n.exposed?.getPrototypeState)n=n.parent;if(!n)return false;window.indicatorProof=n.exposed;let s=indicatorProof.getPrototypeState();return !s.busy&&!s.error&&s.metrics?.calls>0})()`,
      ),
    '3D indicator scene',
  )
  await b.evaluate(
    "document.querySelector('[aria-label=\"3D visual theme\"]')?.__vueParentComponent.emit('update:modelValue','restored-crypt')",
  )
  await b.evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
  const state = await b.evaluate('indicatorProof.getPrototypeState()'),
    proof = await b.evaluate('indicatorProof.getAssetProof()')
  const slider = async (label, value) => {
    await b.evaluate(
      `document.querySelector('[aria-label=${JSON.stringify(label)}]').__vueParentComponent.emit('update:modelValue',${value})`,
    )
    await b.evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
  }
  async function capture(name) {
    const clip = await b.evaluate(
      `(()=>{const r=document.querySelector('.three-viewport').getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,scale:1}})()`,
    )
    const png = await b.send('Page.captureScreenshot', { format: 'png', clip })
    fs.writeFileSync(path.join(output, `${phase}-${name}.png`), Buffer.from(png.data, 'base64'))
  }
  const interactions = []
  if (!baseline) {
    const previous = JSON.parse(fs.readFileSync(path.join(output, 'before-report.json'), 'utf8'))
    assert.deepEqual(state.floor, previous.state.floor)
    assert.deepEqual(proof.stairs, previous.proof.stairs)
    assert.deepEqual(proof.caps, previous.proof.caps)
    assert.deepEqual(proof.floor, previous.proof.floor)
    assert.equal(
      await b.evaluate(`document.querySelectorAll('[data-stair-label]:not([hidden])').length`),
      0,
    )
  }
  for (const stair of proof.stairs) {
    if (!baseline) await b.evaluate('indicatorProof.selectStair(null)')
    const r = stair.bounds
    await b.evaluate(
      `indicatorProof.focusTile(${r.x + r.width / 2 - 0.5},${r.z + r.depth / 2 - 0.5},6.5,${(stair.floor + stair.destination) / 2})`,
    )
    for (const [view, elevation, rotation] of [
      ['tilted', 60, -90],
      ['high-angle', 86, 90],
    ]) {
      await slider('3D camera elevation', elevation)
      await slider('3D camera rotation', rotation)
      if (!baseline) {
        await b.evaluate('indicatorProof.selectStair(null)')
        const points = await b.evaluate(
          `indicatorProof.stairScreenPoints(${JSON.stringify(stair.id)})`,
        )
        let hoveredPoint
        for (const p of points) {
          await b.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...p })
          await b.evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
          if ((await b.evaluate('indicatorProof.getStairInspection()')).hovered === stair.id) {
            hoveredPoint = p
            break
          }
        }
        assert(
          hoveredPoint,
          `${stair.direction}/${view}: actual visible stair surfaces must be hoverable`,
        )
        assert.equal(
          (await b.evaluate('indicatorProof.getStairInspection()')).label,
          stair.direction === 'up' ? 'Stairs Up' : 'Stairs Down',
        )
        await capture(`${stair.direction}-${view}-hover`)
        await b.send('Input.dispatchMouseEvent', {
          type: 'mousePressed',
          button: 'left',
          buttons: 1,
          clickCount: 1,
          ...hoveredPoint,
        })
        await b.send('Input.dispatchMouseEvent', {
          type: 'mouseReleased',
          button: 'left',
          buttons: 0,
          clickCount: 1,
          ...hoveredPoint,
        })
        await poll(
          () =>
            b.evaluate(
              `indicatorProof.getStairInspection().selected === ${JSON.stringify(stair.id)}`,
            ),
          'click selection',
        )
        await b.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 10, y: 10 })
        interactions.push({ direction: stair.direction, view, hover: true, click: true })
        await poll(
          () =>
            b.evaluate(
              `(()=>{const n=document.querySelector('[data-stair-label]');return n&&!n.hidden&&n.dataset.mode==='selection'&&n.textContent === ${JSON.stringify(stair.direction === 'up' ? 'Stairs Up' : 'Stairs Down')}})()`,
            ),
          'selected stair label',
        )
      }
      await capture(`${stair.direction}-${view}`)
      if (!baseline) {
        await b.send('Input.dispatchKeyEvent', {
          type: 'keyDown',
          key: 'Escape',
          code: 'Escape',
          windowsVirtualKeyCode: 27,
        })
        await b.send('Input.dispatchKeyEvent', {
          type: 'keyUp',
          key: 'Escape',
          code: 'Escape',
          windowsVirtualKeyCode: 27,
        })
        await poll(
          () => b.evaluate('indicatorProof.getStairInspection().label === null'),
          'Escape clears label',
        )
        await capture(`${stair.direction}-${view}-clean`)
        await b.evaluate(
          `document.querySelector('[aria-label="3D inspect feature"]').__vueParentComponent.emit('update:modelValue',${JSON.stringify('stair:' + stair.id)})`,
        )
        await poll(
          () =>
            b.evaluate(
              `indicatorProof.getStairInspection().selected === ${JSON.stringify(stair.id)}`,
            ),
          'Inspect selector identifies stairs',
        )
      }
    }
  }
  assert.deepEqual(b.errors, [])
  fs.writeFileSync(
    path.join(output, `${phase}-report.json`),
    JSON.stringify({ state, proof, interactions, errors: b.errors }, null, 2) + '\n',
  )
} finally {
  await b.close()
}
