import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { browserSession, poll } from '../tests/helpers/browser.mjs'
const stage = process.argv.find((a) => a.startsWith('--stage='))?.slice(8) ?? 'baseline',
  out = path.resolve('reports/dungeon-effects'),
  base = process.env.ATELIER_URL ?? 'http://localhost:9000'
fs.mkdirSync(out, { recursive: true })
const b = await browserSession(base)
try {
  await b.evaluate(
    `(()=>{window.effectErrors=[];const original=console.error;console.error=(...a)=>{effectErrors.push(a.map(String).join(' '));original.apply(console,a)}})()`,
  )
  await b.send('Page.navigate', { url: base + '/#/dev/dungeon-3d' })
  await poll(
    () =>
      b.evaluate(
        `(()=>{let n=document.querySelector('.dungeon-3d-page')?.__vueParentComponent;while(n&&!n.exposed?.getPrototypeState)n=n.parent;if(!n)return false;window.fx=n.exposed;let s=fx.getPrototypeState();return !s.busy&&!s.error&&s.metrics?.calls>0})()`,
      ),
    'effects scene',
  )
  await b.evaluate(
    `(()=>{if(fx.getFlameState().enabled)document.querySelector('[aria-label="3D flame animation"]').click()})()`,
  )
  const settle = () =>
    b.evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
  const control = async (label, value) => {
    await b.evaluate(
      `document.querySelector('[aria-label=${JSON.stringify(label)}]').__vueParentComponent.emit('update:modelValue',${JSON.stringify(value)})`,
    )
    await settle()
  }
  const state = await b.evaluate('fx.getPrototypeState()'),
    room = [...state.floor.rooms].sort((a, c) => c.width * c.height - a.width * a.height)[0]
  const assets = await b.evaluate('fx.getAssetProof()'),
    identity = await b.evaluate('fx.getGeometryIdentity()')
  const views = [
    {
      name: 'room',
      x: room.x + room.width / 2 - 0.5,
      z: room.y + room.height / 2 - 0.5,
      span: Math.max(room.width, room.height) + 1,
      y: 0.4,
    },
    ...assets.stairs.map((s) => ({
      name: 'stairs-' + s.direction,
      x: s.bounds.x + s.bounds.width / 2 - 0.5,
      z: s.bounds.z + s.bounds.depth / 2 - 0.5,
      span: 5.8,
      y: (s.floor + s.destination) / 2,
    })),
  ]
  if (stage === 'combined') {
    const door = state.doors.find((d) => d.type === 'regular'),
      dark = [...state.floor.rooms].sort((a, c) => {
        const count = (r) =>
          state.torches.filter(
            ([x, , z]) => x >= r.x && x < r.x + r.width && z >= r.y && z < r.y + r.height,
          ).length
        return count(a) - count(c)
      })[0]
    if (door) views.push({ name: 'door', x: door.x - 0.5, z: door.z - 0.5, span: 4.8, y: 1 })
    views.push({
      name: 'quiet-room',
      x: dark.x + dark.width / 2 - 0.5,
      z: dark.y + dark.height / 2 - 0.5,
      span: Math.max(dark.width, dark.height) + 1,
      y: 0.4,
    })
  }
  const records = []
  for (const theme of ['ancient-ruins', 'restored-crypt']) {
    await control('3D visual theme', theme)
    for (const angle of [55, 90]) {
      await control('3D camera elevation', angle)
      await control('3D camera rotation', -90)
      for (const view of views) {
        if (stage !== 'baseline' && stage !== 'combined' && view.name !== 'room') continue
        await b.evaluate(`fx.focusTile(${view.x},${view.z},${view.span},${view.y})`)
        await settle()
        const baselineFile = path.join(out, `baseline-${theme}-${angle}-${view.name}-baseline.png`)
        if (stage === 'combined' && !fs.existsSync(baselineFile)) {
          await b.evaluate('fx.resetEffects()')
          await settle()
          fs.writeFileSync(
            baselineFile,
            Buffer.from((await b.evaluate('fx.capture3D()')).split(',')[1], 'base64'),
          )
        }
        const variants =
          stage === 'baseline'
            ? ['baseline']
            : stage === 'combined' && view.name !== 'room'
              ? ['normal']
              : ['off', 'normal', 'diagnostic']
        for (const variant of variants) {
          if (stage !== 'baseline') {
            await b.evaluate(
              `fx.setEffectsStudy(${JSON.stringify(stage)},${JSON.stringify(variant)})`,
            )
            await settle()
          }
          const png = await b.evaluate('fx.capture3D()'),
            file = `${stage}-${theme}-${angle}-${view.name}-${variant}.png`
          fs.writeFileSync(path.join(out, file), Buffer.from(png.split(',')[1], 'base64'))
          const metrics = (await b.evaluate('fx.getPrototypeState()')).metrics,
            effects = stage === 'baseline' ? null : await b.evaluate('fx.getEffectsState()')
          if (stage !== 'baseline') {
            assert.deepEqual(await b.evaluate('fx.getGeometryIdentity()'), identity)
            assert.deepEqual((await b.evaluate('fx.getPrototypeState()')).floor, state.floor)
            await b.evaluate('fx.resetEffects()')
            await settle()
            const restored = Buffer.from(
              (await b.evaluate('fx.capture3D()')).split(',')[1],
              'base64',
            )
            assert(
              restored.equals(
                fs.readFileSync(
                  path.join(out, `baseline-${theme}-${angle}-${view.name}-baseline.png`),
                ),
              ),
              'Reset must recover exact baseline ' + theme + '/' + angle,
            )
          }
          records.push({
            theme,
            angle,
            view: view.name,
            variant,
            file,
            metrics,
            effects,
          })
        }
      }
    }
  }
  if (stage === 'combined') {
    await b.evaluate('fx.resetEffects()')
    await settle()
    await control('3D camera elevation', 55)
    await b.evaluate(`fx.focusTile(${views[0].x},${views[0].z},${views[0].span},${views[0].y})`)
    const performance = []
    for (const theme of ['ancient-ruins', 'restored-crypt']) {
      await control('3D visual theme', theme)
      for (const preset of ['baseline', 'materials', 'depth', 'atmosphere', 'combined']) {
        await b.evaluate(`fx.applyEffectsPreset(${JSON.stringify(preset)})`)
        await settle()
        const timing = await b.evaluate('fx.measureEffects(16)')
        performance.push({ theme, preset, ...timing })
      }
    }
    fs.writeFileSync(
      path.join(out, 'performance.json'),
      JSON.stringify(performance, null, 2) + '\n',
    )
    await b.evaluate(`fx.setEffectsStudy('torch-shadows','normal')`)
    await settle()
    await b.evaluate('fx.capture3D()')
    assert.equal(
      (await b.evaluate('fx.getPrototypeState()')).lights.filter((l) => l.visible && l.castShadow)
        .length,
      2,
    )
    await b.evaluate(`document.querySelector('[aria-label="3D shadows"]').click()`)
    await settle()
    assert(
      (await b.evaluate('fx.getPrototypeState()')).lights.every((l) => !l.castShadow),
      'Master Shadows disables torch casters',
    )
    await b.evaluate(`document.querySelector('[aria-label="3D shadows"]').click()`)
    await settle()
    await b.evaluate(`document.querySelector('[aria-label="3D torch lighting"]').click()`)
    await settle()
    assert(
      (await b.evaluate('fx.getPrototypeState()')).lights.every((l) => !l.visible && !l.castShadow),
      'Turning torch lighting off removes light and shadows together',
    )
    await b.evaluate('fx.resetEffects()')
    await settle()
    await b.evaluate(`fx.applyEffectsPreset('combined')`)
    await settle()
    await b.evaluate('fx.capture3D()')
    const warm = await b.evaluate('fx.getPrototypeState()'),
      derived = await b.evaluate('fx.getEffectsState()')
    for (let i = 0; i < 12; i++) {
      await b.evaluate(
        `fx.applyEffectsPreset(${JSON.stringify(['baseline', 'materials', 'depth', 'atmosphere', 'combined'][i % 5])})`,
      )
      await settle()
      await b.evaluate('fx.capture3D()')
    }
    await b.evaluate(`fx.applyEffectsPreset('combined')`)
    await settle()
    await b.evaluate('fx.capture3D()')
    const after = await b.evaluate('fx.getPrototypeState()'),
      maps = await b.evaluate('fx.getEffectsState()')
    assert.equal(after.metrics.textures, warm.metrics.textures, 'Preset changes reuse GPU textures')
    assert.equal(
      after.metrics.geometries,
      warm.metrics.geometries,
      'Preset changes reuse GPU geometry',
    )
    assert.equal(maps.derivedNormalMaps, derived.derivedNormalMaps)
    assert.equal(maps.derivedRoughnessMaps, derived.derivedRoughnessMaps)
    assert.deepEqual(await b.evaluate('fx.getGeometryIdentity()'), identity)
    await b.evaluate('fx.openEffects()')
    await settle()
    await poll(
      () => b.evaluate(`!!document.querySelector('[aria-label="Effects preset"]')`),
      'Effects panel',
    )
    await poll(
      () =>
        b.evaluate(
          `(()=>{const r=document.querySelector('.effects-panel')?.getBoundingClientRect();return r&&r.right<=innerWidth&&r.left>=0})()`,
        ),
      'Effects panel transition',
    )
    const screenshot = await b.send('Page.captureScreenshot', { format: 'png' })
    fs.writeFileSync(path.join(out, 'playground-ui.png'), Buffer.from(screenshot.data, 'base64'))
    await b.evaluate(`document.querySelector('[aria-label="Close Effects Playground"]').click()`)
    await settle()
    await b.evaluate('fx.resetEffects()')
    await settle()
    const saved = await b.evaluate(`localStorage.getItem('dungeon-atelier:appearance')`)
    assert.deepEqual(await b.evaluate('window.effectErrors'), [])
    await b.send('Page.navigate', { url: base })
    await poll(() => b.evaluate(`!!document.querySelector('.dungeon-canvas')`), 'Return to editor')
    assert.equal(
      await b.evaluate(
        `(async()=>(await import('/src/experiments/dungeon-3d/viewport.ts')).prototypeLifecycle.activeViewports)()`,
      ),
      0,
    )
    assert.equal(await b.evaluate(`localStorage.getItem('dungeon-atelier:appearance')`), saved)
  }
  assert.deepEqual(b.errors, [])
  if (stage !== 'combined') assert.deepEqual(await b.evaluate('window.effectErrors'), [])
  fs.writeFileSync(
    path.join(out, stage + '.json'),
    JSON.stringify({ state, assets, records, errors: b.errors }, null, 2) + '\n',
  )
  process.stdout.write(stage + ' visual validation passed\n')
} finally {
  await b.close()
}
