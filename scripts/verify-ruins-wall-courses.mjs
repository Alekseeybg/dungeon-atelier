import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { browserSession, poll } from '../tests/helpers/browser.mjs'

const baseline = process.argv.includes('--baseline'),
  phase = baseline ? 'before' : 'after',
  output = path.resolve(
    process.argv.find((arg) => arg.startsWith('--output='))?.slice('--output='.length) ??
      'reports/ruins-wall-courses',
  ),
  base = process.env.ATELIER_URL ?? 'http://localhost:9000'
fs.mkdirSync(output, { recursive: true })
const b = await browserSession(base)
try {
  await b.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `window.__ruinsErrors=[];const report=console.error;console.error=(...args)=>{window.__ruinsErrors.push(args.map(String).join(' '));report.apply(console,args)}`,
  })
  await b.evaluate(
    `(()=>{window.__ruinsErrors=[];const report=console.error;console.error=(...args)=>{window.__ruinsErrors.push(args.map(String).join(' '));report.apply(console,args)}})()`,
  )
  await b.send('Page.navigate', { url: base + '/#/dev/dungeon-3d' })
  await poll(
    () =>
      b.evaluate(
        `(()=>{let n=document.querySelector('.dungeon-3d-page')?.__vueParentComponent;while(n&&!n.exposed?.getPrototypeState)n=n.parent;if(!n)return false;window.placementProof=n.exposed;const s=placementProof.getPrototypeState();return !s.busy&&!s.error&&s.metrics?.calls>0})()`,
      ),
    'ruins scene',
  )
  async function slider(label, value) {
    await b.evaluate(
      `document.querySelector('[aria-label=${JSON.stringify(label)}]').__vueParentComponent.emit('update:modelValue',${JSON.stringify(value)})`,
    )
    await b.evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
  }
  const initialTheme = (await b.evaluate('placementProof.getPrototypeState()')).theme
  if (!baseline)
    assert.equal(initialTheme, 'ancient-ruins', 'Playground opens directly in Ancient Ruins')
  await slider('3D visual theme', 'ancient-ruins')
  const state = await b.evaluate('placementProof.getPrototypeState()'),
    assets = await b.evaluate('placementProof.getAssetProof()'),
    room = [...state.floor.rooms]
      .filter((r) => !state.floor.stairs.some((s) => s.roomId === r.id))
      .sort((a, c) => c.width * c.height - a.width * a.height)[0]
  fs.writeFileSync(
    path.join(output, `${phase}-full.png`),
    Buffer.from((await b.evaluate('placementProof.capture3D()')).split(',')[1], 'base64'),
  )
  for (const [name, x, z, span, y, elevation] of [
    ['walls', room.x + room.width - 0.3, room.y + room.height * 0.5 - 0.5, 5.6, 1, 48],
    ['caps', room.x + room.width - 0.3, room.y + room.height * 0.5 - 0.5, 3.8, 2, 68],
    ...assets.stairs.map((s) => [
      'stairs-' + s.direction,
      s.bounds.x + s.bounds.width / 2 - 0.5,
      s.bounds.z + s.bounds.depth / 2 - 0.5,
      5.8,
      (s.floor + s.destination) / 2,
      s.direction === 'up' ? 55 : 78,
    ]),
    [
      'door',
      state.doors.find((d) => d.type === 'regular').x,
      state.doors.find((d) => d.type === 'regular').z,
      4.8,
      0.9,
      48,
    ],
    [
      'area',
      room.x + room.width * 0.5 - 0.5,
      room.y + room.height * 0.5 - 0.5,
      Math.max(room.width, room.height) + 3,
      0.4,
      60,
    ],
  ]) {
    await slider('3D camera rotation', -90)
    await slider('3D camera elevation', elevation)
    await b.evaluate(`placementProof.focusTile(${x},${z},${span},${y})`)
    if (!baseline && name !== 'caps') {
      await b.evaluate(`document.querySelector('[aria-label="3D contact occlusion"]').click()`)
      await b.evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
      fs.writeFileSync(
        path.join(output, `${name}-ao-off.png`),
        Buffer.from((await b.evaluate('placementProof.capture3D()')).split(',')[1], 'base64'),
      )
      await b.evaluate(`document.querySelector('[aria-label="3D contact occlusion"]').click()`)
      await b.evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
    }
    const png = await b.evaluate('placementProof.capture3D()')
    fs.writeFileSync(
      path.join(output, `${phase}-${name}.png`),
      Buffer.from(png.split(',')[1], 'base64'),
    )
  }

  if (!baseline) {
    const old = JSON.parse(fs.readFileSync(path.join(output, 'before.json'), 'utf8'))
    assert.deepEqual(state.floor, old.state.floor)
    assert.deepEqual(assets.stairs, old.assets.stairs)
    assert.deepEqual(
      assets.caps,
      old.assets.caps,
      'Approved caps remain identical, including material',
    )
    assert.deepEqual(
      (await b.evaluate('placementProof.getThemeState()')).legacySurfaces,
      old.legacySurfaces,
      'All existing material maps are unchanged',
    )
  }
  assert.deepEqual(b.errors, [])
  assert.deepEqual(
    await b.evaluate('window.__ruinsErrors'),
    [],
    'No shader compile or console errors',
  )
  fs.writeFileSync(
    path.join(output, `${phase}.json`),
    JSON.stringify(
      {
        state,
        legacySurfaces: await b
          .evaluate('placementProof.getThemeState()')
          .then((s) => s.legacySurfaces),
        surfaces: await b.evaluate('placementProof.getThemeState()').then((s) => s.surfaces),
        assets,
        rules: baseline ? null : await b.evaluate('placementProof.getRuinsPlacement()'),
        errors: b.errors,
      },
      null,
      2,
    ) + '\n',
  )
} finally {
  await b.close()
}
