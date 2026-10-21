import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browserSession, poll } from '../tests/helpers/browser.mjs'

const b = await browserSession(process.env.ATELIER_URL ?? 'http://localhost:9000')
const results = []
const idle = []
try {
  await b.send('Performance.enable')
  await b.evaluate(`(async()=>{
    window.mod=await import('/src/experiments/dungeon-3d/viewport.ts');
    const plans=await import('/src/experiments/dungeon-3d/plan.ts');
    window.settings=await import('/src/experiments/dungeon-3d/effects-settings.ts');
    window.host=document.createElement('div');host.style.cssText='position:fixed;inset:0;width:960px;height:640px;z-index:99999';document.body.appendChild(host);
    window.v=await mod.createDungeon3DViewport(host,plans.generatePrototypeFloor('performance-audit-v1',32),false,()=>{});
    window.fx={...settings.EFFECT_PRESETS.combined};v.setTheme('ancient-ruins');v.setEffects(fx);v.setFlameAnimation(false);v.setCamera(63.75,38.5);v.setZoom(1.22);
    window.settle=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  })()`)
  async function verify(name) {
    await b.evaluate('settle()')
    const data = await b.evaluate(`(()=>{
      const cold=v.png(0),cached=v.png(0),before=v.effectsState().ao;
      v.renderer.shadowMap.needsUpdate=true;v.setCamera(v.stats().elevation,v.stats().rotation);
      const fresh=v.png(0);return {cold,cached,fresh,before,after:v.effectsState().ao};
    })()`)
    assert(data.cold === data.cached, name + ': cached frame matches cold frame')
    assert(data.cached === data.fresh, name + ': forced fresh AO/shadows match cached frame')
    assert(data.before.occlusionReuses > 0, 'AO cache was exercised')
    assert(data.after.occlusionComputations > data.before.occlusionComputations)
    results.push({ name, ...data.after })
  }
  await verify('initial')
  const ids = await b.evaluate('v.geometryIdentity()')
  await b.evaluate('v.setHeight(1);v.setDoorsOpen(false);v.setDoorHeadCutaway(false)')
  assert.deepEqual(await b.evaluate('v.geometryIdentity()'), ids)
  for (const [name, action] of [
    ['rotation', 'v.setCamera(55,-60)'],
    ['minimum elevation', 'v.setCamera(25,40)'],
    ['top down', 'v.setCamera(90,0)'],
    ['maximum zoom', 'v.setZoom(9)'],
    ['reset camera', 'v.reset()'],
    ['AO radius', 'fx.aoRadius=1.2;v.setEffects(fx)'],
    ['AO diagnostic', 'fx.aoOnly=true;v.setEffects(fx)'],
    ['AO compositing', 'fx.aoOnly=false;fx.aoIntensity=.5;v.setEffects(fx)'],
    ['height', 'v.setHeight(1.25)'],
    ['open doors', 'v.setDoorsOpen(true)'],
    ['door cutaway', 'v.setDoorHeadCutaway(true)'],
    ['torch range', 'fx.torchRange=1.5;v.setEffects(fx)'],
    ['torch budget', 'fx.torchBudget=3;v.setEffects(fx)'],
    ['torch lighting off', 'v.setTorchLighting(false)'],
    ['torch lighting on', 'v.setTorchLighting(true)'],
    ['shadows off', 'v.setShadows(false)'],
    ['shadows on', 'v.setShadows(true)'],
    ['crypt', "v.setTheme('restored-crypt')"],
    ['ruins', "v.setTheme('ancient-ruins')"],
  ]) {
    await b.evaluate(action)
    await verify(name)
  }
  const original = await b.evaluate('v.png(0)')
  await b.evaluate("host.style.width='800px';host.style.height='600px'")
  await b.evaluate('settle()')
  await verify('resize')
  await b.evaluate("host.style.width='960px';host.style.height='640px'")
  await b.evaluate('settle()')
  assert(original === (await b.evaluate('v.png(0)')), 'Resize round trip preserves output')
  await b.evaluate('v.renderer.forceContextLoss()')
  await poll(() => b.evaluate('v.renderer.getContext().isContextLost()'), 'Context lost')
  await b.evaluate('new Promise(r=>setTimeout(r,250))')
  await b.evaluate('v.renderer.forceContextRestore()')
  await poll(() => b.evaluate('!v.renderer.getContext().isContextLost()'), 'Context restored')
  await b.evaluate('settle()')
  const restored = await b.evaluate('v.png(0)')
  assert(original === restored, 'Context restoration preserves output and recomputes caches')
  await verify('context restored')
  if (process.argv.includes('--extended-idle')) {
    await b.evaluate(`(async()=>{
      v.setFlameAnimation(false);await settle();
      window.idlePasses=0;window.idleRender=v.renderer.render;
      v.renderer.render=function(...args){idlePasses++;return idleRender.apply(this,args)};
    })()`)
    for (const animated of [false, true]) {
      if (animated) await b.evaluate('idlePasses=0;v.setFlameAnimation(true)')
      for (let i = 0; i < 6; i++) {
        const sample = await b.evaluate(
          '(async()=>{await new Promise(r=>setTimeout(r,5000));return {passes:idlePasses,metrics:v.stats()}})()',
        )
        idle.push({ animated, seconds: (i + 1) * 5, ...sample })
      }
      if (!animated) assert.equal(idle.at(-1).passes, 0, 'Static idle performs no GPU rendering')
      else assert(idle.at(-1).passes > 0, 'Flame animation continues rendering')
      await b.send('HeapProfiler.collectGarbage')
      const memory = await b.send('Performance.getMetrics')
      idle.at(-1).heapUsed = memory.metrics.find((m) => m.name === 'JSHeapUsedSize')?.value
    }
    assert.equal(
      idle[0].metrics.textures,
      idle.at(-1).metrics.textures,
      'Idle animation does not allocate more textures',
    )
    assert.equal(
      idle[0].metrics.geometries,
      idle.at(-1).metrics.geometries,
      'Idle animation does not allocate more geometry',
    )
    await b.evaluate('v.renderer.render=idleRender;v.setFlameAnimation(false)')
  }
  await b.evaluate('v.renderer.forceContextLoss()')
  await poll(() => b.evaluate('v.renderer.getContext().isContextLost()'), 'Second context loss')
  await b.evaluate('v.dispose();host.remove()')
  assert.equal(await b.evaluate('mod.prototypeLifecycle.activeViewports'), 0)
  assert.deepEqual(b.errors, [])
  fs.mkdirSync('reports/dungeon-3d-performance', { recursive: true })
  fs.writeFileSync(
    'reports/dungeon-3d-performance/cache-regressions.json',
    JSON.stringify(
      { results, idle, contextRestored: true, disposedWhileLost: true, errors: b.errors },
      null,
      2,
    ) + '\n',
  )
  console.log(
    'Render cache regression checks passed: ' +
      results.length +
      ' states, resize and context lifecycle.',
  )
} finally {
  await b.close()
}
