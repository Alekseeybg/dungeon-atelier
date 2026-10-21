import fs from 'node:fs'
import { browserSession, poll } from '../tests/helpers/browser.mjs'
import assert from 'node:assert/strict'
const phase = process.argv.includes('--before') ? 'before' : 'after'
const out = 'reports/cap-edge-response'
fs.mkdirSync(out, { recursive: true })
const b = await browserSession('http://localhost:9000')
try {
  await b.send('Page.navigate', { url: 'http://localhost:9000/#/dev/dungeon-3d' })
  await poll(
    () =>
      b.evaluate(
        `(()=>{let n=document.querySelector('.dungeon-3d-page')?.__vueParentComponent;while(n&&!n.exposed?.getPrototypeState)n=n.parent;if(!n)return false;window.fx=n.exposed;const s=fx.getPrototypeState();return !s.busy&&!s.error&&s.metrics?.calls>0})()`,
      ),
    'scene',
  )
  await b.evaluate(
    `if(fx.getFlameState().enabled)document.querySelector('[aria-label="3D flame animation"]').click()`,
  )
  await b.evaluate(`fx.openEffects()`)
  await poll(() => b.evaluate(`!!document.querySelector('#dungeon-effects')`), 'panel')
  await b.evaluate(
    `(()=>{let n=document.querySelector('#dungeon-effects').__vueParentComponent;while(n&&!n.props.modelValue)n=n.parent;window.setFx=v=>n.emit('update:modelValue',{...fx.getEffectsState().settings,...v});window.setCam=(label,v)=>document.querySelector('[aria-label="'+label+'"]').__vueParentComponent.emit('update:modelValue',v)})()`,
  )
  const user = {
    aoIntensity: 1,
    aoRadius: 0.65,
    aoOnly: false,
    cavity: 0,
    edgeResponse: 2,
    shadowIntensity: 0.25,
    shadowSoftness: 6,
    keyLight: 0.75,
    ambientLight: 0.5,
    torchIntensity: 1,
    torchRange: 1,
    torchDecay: 2.2,
    torchShadows: false,
    torchBudget: 8,
    normals: false,
    normalStrength: 1,
    roughness: true,
    stoneRoughness: 0.05,
    woodRoughness: 0.05,
    ironRoughness: 0.35,
    grade: true,
    bloom: true,
    bloomStrength: 0.25,
    bloomRadius: 0.5,
    bloomThreshold: 1,
    exposure: 1.1,
    saturation: 1.5,
    contrast: 1.05,
    temperature: 0.3,
  }
  await b.evaluate(
    `setCam('3D camera elevation',63.75);setCam('3D camera rotation',38.5);setCam('3D camera zoom',1.22)`,
  )
  await b.evaluate(
    `(()=>{const r=[...fx.getPrototypeState().floor.rooms].sort((a,b)=>b.width*b.height-a.width*a.height)[0];fx.focusTile(r.x+r.width/2-.5,r.y+r.height/2-.5,Math.max(r.width,r.height)+1,.4)})()`,
  )
  const identity = await b.evaluate('fx.getGeometryIdentity()')
  const results = []
  for (const theme of ['ancient-ruins', 'restored-crypt']) {
    await b.evaluate(`setCam('3D visual theme','${theme}')`)
    for (const study of ['baseline', 'user']) {
      if (study === 'baseline') await b.evaluate('fx.resetEffects()')
      else
        await b.evaluate(
          `setFx(${JSON.stringify({ ...user, roughness: false, normals: true, normalStrength: 0.85 })})`,
        )
      await b.evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
      const capture = await b.evaluate('fx.capture3D()')
      const bytes = Buffer.from(capture.split(',')[1], 'base64'),
        name = theme + '-' + study
      fs.writeFileSync(out + '/' + phase + '-' + name + '.png', bytes)
      if (phase === 'after' && (study === 'baseline' || theme === 'restored-crypt'))
        assert(
          bytes.equals(fs.readFileSync(out + '/before-' + name + '.png')),
          name + ' must remain unchanged',
        )
      assert.deepEqual(await b.evaluate('fx.getGeometryIdentity()'), identity)
      results.push({ theme, study, settings: await b.evaluate('fx.getEffectsState()') })
    }
  }
  assert.deepEqual(b.errors, [])
  fs.writeFileSync(
    out + '/' + phase + '.json',
    JSON.stringify({ results, errors: b.errors }, null, 2),
  )
  console.log(phase + ' cap edge verification passed')
} finally {
  await b.close()
}
