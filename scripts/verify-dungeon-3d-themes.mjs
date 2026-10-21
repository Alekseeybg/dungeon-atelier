import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { browserSession, poll } from '../tests/helpers/browser.mjs'

const baseline = process.argv.includes('--baseline'),
  output = path.resolve('reports/dungeon-3d-themes'),
  base = process.env.ATELIER_URL ?? 'http://localhost:9000'
fs.mkdirSync(output, { recursive: true })
const b = await browserSession(base)
try {
  await b.send('Page.navigate', { url: base + '/#/dev/dungeon-3d' })
  await poll(
    () =>
      b.evaluate(
        `(()=>{let n=document.querySelector('.dungeon-3d-page')?.__vueParentComponent;while(n&&!n.exposed?.getPrototypeState)n=n.parent;if(!n)return false;window.themeProof=n.exposed;let s=themeProof.getPrototypeState();return !s.busy&&!s.error&&s.metrics?.calls>0})()`,
      ),
    'theme scene',
  )
  await b.evaluate(
    "document.querySelector('[aria-label=\"3D visual theme\"]')?.__vueParentComponent.emit('update:modelValue','restored-crypt')",
  )
  await b.evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
  const state = await b.evaluate('themeProof.getPrototypeState()'),
    proof = await b.evaluate('themeProof.getAssetProof()'),
    room = [...state.floor.rooms].sort((a, c) => c.width * c.height - a.width * a.height)[0],
    views = [
      { name: 'full', elevation: 68, rotation: 0 },
      {
        name: 'walls-caps',
        x: room.x + room.width / 2 - 0.5,
        z: room.y + room.height / 2 - 0.5,
        span: Math.max(room.width, room.height) + 1,
        y: 0,
        elevation: 55,
        rotation: -90,
      },
      {
        name: 'floors',
        x: room.x + room.width / 2 - 0.5,
        z: room.y + room.height / 2 - 0.5,
        span: Math.max(4, Math.min(room.width, room.height) - 1),
        y: 0,
        elevation: 82,
        rotation: -90,
      },
      ...proof.stairs.map((s) => ({
        name: 'stairs-' + s.direction,
        x: s.bounds.x + s.bounds.width / 2 - 0.5,
        z: s.bounds.z + s.bounds.depth / 2 - 0.5,
        span: 6.5,
        y: (s.floor + s.destination) / 2,
        elevation: s.direction === 'up' ? 60 : 82,
        rotation: -90,
      })),
    ]
  const slider = async (label, value) => {
    await b.evaluate(
      `document.querySelector('[aria-label=${JSON.stringify(label)}]').__vueParentComponent.emit('update:modelValue',${value})`,
    )
    await b.evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
  }
  const records = []
  const identity = baseline ? null : await b.evaluate('themeProof.getGeometryIdentity()')
  let ancientSurfaces
  if (!baseline) {
    const previous = JSON.parse(fs.readFileSync(path.join(output, 'baseline.json'), 'utf8'))
    assert.deepEqual(state.floor, previous.state.floor)
    assert.deepEqual(proof, previous.proof)
  }
  for (const view of views) {
    await slider('3D camera elevation', view.elevation)
    await slider('3D camera rotation', view.rotation)
    if (view.x !== undefined)
      await b.evaluate(`themeProof.focusTile(${view.x},${view.z},${view.span},${view.y})`)
    const camera = (await b.evaluate('themeProof.getPrototypeState()')).camera
    const themes = baseline ? ['baseline'] : ['restored-crypt', 'ancient-ruins', 'restored-return']
    for (const theme of themes) {
      if (!baseline) {
        const id = theme === 'restored-return' ? 'restored-crypt' : theme
        await b.evaluate(
          `document.querySelector('[aria-label="3D visual theme"]').__vueParentComponent.emit('update:modelValue',${JSON.stringify(id)})`,
        )
        await poll(
          () => b.evaluate(`themeProof.getPrototypeState().theme === ${JSON.stringify(id)}`),
          'theme switch',
        )
        await b.evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
      }
      const png = await b.evaluate('themeProof.capture3D()')
      if (!baseline) {
        const switched = await b.evaluate('themeProof.getPrototypeState()')
        assert.deepEqual(
          await b.evaluate('themeProof.getGeometryIdentity()'),
          identity,
          'Theme swaps retain actual mesh and buffer geometry objects',
        )
        assert.deepEqual(switched.floor, state.floor, 'Switching never regenerates the dungeon')
        assert.equal(switched.floorGeometryId, state.floorGeometryId)
        assert.deepEqual(switched.camera, camera, 'Camera, target and zoom stay fixed')
        const file =
          theme === 'ancient-ruins' ? null : path.join(output, `baseline-${view.name}.png`)
        if (file)
          assert(
            Buffer.from(png.split(',')[1], 'base64').equals(fs.readFileSync(file)),
            'Restored Crypt must match the pre-change image exactly, including on return: ' +
              view.name +
              ' / ' +
              theme,
          )
        if (theme === 'ancient-ruins' && !ancientSurfaces)
          ancientSurfaces = await b.evaluate('themeProof.getThemeState()')
      }
      fs.writeFileSync(
        path.join(output, `${theme}-${view.name}.png`),
        Buffer.from(png.split(',')[1], 'base64'),
      )
      records.push({
        theme,
        view: view.name,
        camera: (await b.evaluate('themeProof.getPrototypeState()')).camera,
      })
    }
  }
  if (!baseline) {
    // Repeated switching reuses palette resources; no per-switch texture/geometry allocation.
    const warm = (await b.evaluate('themeProof.getPrototypeState()')).metrics
    for (let i = 0; i < 12; i++)
      await slider('3D visual theme', JSON.stringify(i % 2 ? 'restored-crypt' : 'ancient-ruins'))
    const after = (await b.evaluate('themeProof.getPrototypeState()')).metrics
    assert.equal(after.geometries, warm.geometries)
    assert.equal(after.textures, warm.textures)
    assert.deepEqual(await b.evaluate('themeProof.getGeometryIdentity()'), identity)
    await slider('3D visual theme', JSON.stringify('ancient-ruins'))
    const withTorches = await b.evaluate('themeProof.capture3D()')
    await b.evaluate(`document.querySelector('[aria-label="3D torch lighting"]').click()`)
    await b.evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
    const noTorches = await b.evaluate('themeProof.capture3D()')
    assert.notEqual(noTorches, withTorches, 'Warm torch lighting remains functional')
    fs.writeFileSync(
      path.join(output, 'ancient-ruins-without-torches.png'),
      Buffer.from(noTorches.split(',')[1], 'base64'),
    )
    await b.evaluate(`document.querySelector('[aria-label="3D torch lighting"]').click()`)
    await slider('3D wall height', 1.25)
    assert.equal((await b.evaluate('themeProof.getThemeState()')).id, 'ancient-ruins')
    assert.equal(
      (await b.evaluate('themeProof.getPrototypeState()')).floorGeometryId,
      state.floorGeometryId,
    )
    await slider('3D wall height', 1)
    // Regenerate explicitly, separate from the invariant above, to check seeded material reproducibility.
    await b.evaluate(
      `Array.from(document.querySelectorAll('button')).find(n=>n.textContent.includes('Regenerate')).click()`,
    )
    await poll(
      () =>
        b.evaluate(
          '!themeProof.getPrototypeState().busy&&themeProof.getPrototypeState().metrics?.calls>0',
        ),
      'same-seed reload',
    )
    assert.deepEqual(
      (await b.evaluate('themeProof.getThemeState()')).surfaces,
      ancientSurfaces.surfaces,
    )
    assert.deepEqual((await b.evaluate('themeProof.getPrototypeState()')).floor, state.floor)
    await b.evaluate(
      `document.querySelector('[aria-label="3D dungeon seed"]').__vueParentComponent.emit('update:modelValue','ancient-theme-region-proof')`,
    )
    await b.evaluate(
      `Array.from(document.querySelectorAll('button')).find(n=>n.textContent.includes('Regenerate')).click()`,
    )
    await poll(
      () =>
        b.evaluate(
          '!themeProof.getPrototypeState().busy&&themeProof.getPrototypeState().metrics?.calls>0',
        ),
      'different-seed reload',
    )
    assert.notDeepEqual(
      (await b.evaluate('themeProof.getThemeState()')).surfaces,
      ancientSurfaces.surfaces,
    )
  }
  assert.deepEqual(b.errors, [])
  fs.writeFileSync(
    path.join(output, baseline ? 'baseline.json' : 'report.json'),
    JSON.stringify(
      {
        state,
        proof,
        views,
        records,
        ancientSurfaces,
        geometryPreserved: !baseline,
        restoredExact: !baseline,
        seedReproducible: !baseline,
        errors: b.errors,
      },
      null,
      2,
    ) + '\n',
  )
} finally {
  await b.close()
}
