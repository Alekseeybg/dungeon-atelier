import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { browserSession, browserProfileRoot } from '../tests/helpers/browser.mjs'

const phase = process.argv.includes('--before') ? 'before' : 'after'
const out = path.resolve('reports/dungeon-3d-performance')
const base = process.env.ATELIER_URL ?? 'http://localhost:9000'
fs.mkdirSync(out, { recursive: true })
const profiles = fs.existsSync(browserProfileRoot) ? fs.readdirSync(browserProfileRoot).sort() : []
const b = await browserSession(base)
const report = {
  phase,
  seed: 'performance-audit-v1',
  viewport: [960, 640],
  cases: [],
  lifecycle: [],
}
const save = () =>
  fs.writeFileSync(path.join(out, phase + '.json'), JSON.stringify(report, null, 2) + '\n')
try {
  await b.send('Performance.enable')
  await b.evaluate(`(async()=>{
    const url='/src/experiments/dungeon-3d/viewport.ts';
    const code=await (await fetch(url)).text();
    window.T=await import(code.match(/"([^"]*three[.]js[^"]*)"/)[1]);
    window.module3D=await import(url);
    window.plans=await import('/src/experiments/dungeon-3d/plan.ts');
    window.settings=await import('/src/experiments/dungeon-3d/effects-settings.ts');
    window.host3D=document.createElement('div');host3D.style.cssText='position:fixed;left:0;top:0;width:960px;height:640px;z-index:999999;background:#080c0d';document.body.appendChild(host3D);
    window.settle=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    window.config3D=(theme,mode)=>{
      v.setTheme(theme);v.setFlameAnimation(false);
      v.setShadows(mode!=='off');v.setTorchLighting(mode!=='off');
      v.setContactOcclusion(mode!=='off');
      v.setEffects({...settings.EFFECT_PRESETS[mode==='combined'?'combined':'baseline'],...(mode==='off'?{aoMode:'off'}:{})});
    };
    window.create3D=async(size)=>{
      const start=performance.now();window.floor3D=plans.generatePrototypeFloor('performance-audit-v1',size);const generated=performance.now();
      window.notifications=0;window.v=await module3D.createDungeon3DViewport(host3D,floor3D,false,()=>notifications++);
      v.setFlameAnimation(false);v.setCamera(63.75,38.5);v.setZoom(1.22);
      window.buildTimes={generationMs:generated-start,viewportConstructionMs:performance.now()-generated};
      await settle();return buildTimes;
    };
    window.resources3D=()=>{
      const material=new Set(),texture=new Set(),image=new Set();let meshes=0,vertices=0;
      v.dungeon.root.traverse(n=>{if(!n.isMesh)return;meshes++;vertices+=n.geometry.attributes.position.count;for(const m of Array.isArray(n.material)?n.material:[n.material]){material.add(m);for(const value of Object.values(m)){if(value?.isTexture){texture.add(value);if(value.image)image.add(value.image)}}}});
      return {meshes,vertices,materials:material.size,sceneTextures:texture.size,sourceImages:image.size,...v.stats()};
    };
    window.bench3D=async(frames=24)=>{
      const shadow=v.renderer.shadowMap.render;let shadowCalls=0;
      v.renderer.shadowMap.render=function(...args){if(this.enabled&&args[0]?.length&&(this.autoUpdate||this.needsUpdate))shadowCalls++;return shadow.apply(this,args)};
      try{const result=await v.measurePerformance(frames);return {...result,eligibleShadowPasses:shadowCalls,notifications,resources:resources3D()}}
      finally{v.renderer.shadowMap.render=shadow}
    };
  })()`)
  for (const size of [32, 48, 64]) {
    const build = await b.evaluate(`create3D(${size})`)
    report.backend = await b.evaluate('v.backend()')
    for (const theme of ['ancient-ruins', 'restored-crypt']) {
      for (const mode of ['off', 'baseline', 'combined']) {
        await b.evaluate(`config3D('${theme}','${mode}');notifications=0`)
        await b.evaluate('settle()')
        const png = await b.evaluate('v.png(0)')
        const name = `${size}-${theme}-${mode}`
        const bytes = Buffer.from(png.split(',')[1], 'base64')
        fs.writeFileSync(path.join(out, `${phase}-${name}.png`), bytes)
        const baseline = path.join(out, `before-${name}.png`)
        if (phase === 'after')
          assert(bytes.equals(fs.readFileSync(baseline)), name + ' visual preservation')
        const sample = await b.evaluate('bench3D(24)')
        const mean = (xs) => (xs.length ? xs.reduce((a, c) => a + c, 0) / xs.length : null)
        const percentile = (xs, q) =>
          xs.length ? [...xs].sort((a, c) => a - c)[Math.ceil(xs.length * q) - 1] : null
        const interval = sample.samples.frameIntervalMs
        const record = {
          size,
          theme,
          mode,
          ...build,
          ...sample,
          averageFrameMs: mean(interval),
          p95FrameMs: percentile(interval, 0.95),
          averageFps: 1000 / mean(interval),
          averageCpuSubmissionMs: mean(sample.samples.cpuSubmissionMs),
          p95CpuSubmissionMs: percentile(sample.samples.cpuSubmissionMs, 0.95),
        }
        report.cases.push(record)
        save()
        console.log(
          `${phase}: ${name}: ${record.averageFrameMs.toFixed(1)} ms, ${record.calls} calls`,
        )
      }
    }
    // Theme changes and redundant architecture setters must not rebuild unchanged data.
    const switching = await b.evaluate(`(async()=>{
      config3D('ancient-ruins','combined');await settle();v.png(0);
      const ids=JSON.stringify(v.geometryIdentity()),before=resources3D(),times=[];
      for(let i=0;i<12;i++){const start=performance.now();v.setTheme(i%2?'ancient-ruins':'restored-crypt');times.push(performance.now()-start);v.png(0)}
      const sameThemeGeometry=JSON.stringify(v.geometryIdentity())===ids;
      const start=performance.now();v.setHeight(1);v.setDoorsOpen(false);v.setDoorHeadCutaway(false);const redundantMs=performance.now()-start;
      const sameSetterGeometry=JSON.stringify(v.geometryIdentity())===ids;
      v.setTheme('ancient-ruins');v.png(0);return {before,after:resources3D(),themeSwitchMs:times,sameThemeGeometry,sameSetterGeometry,redundantMs};
    })()`)
    assert(switching.sameThemeGeometry)
    if (phase === 'after')
      assert(switching.sameSetterGeometry, 'Unchanged settings preserve geometry identity')
    report.lifecycle.push({ size, switching })
    await b.evaluate('v.dispose();v=undefined')
    assert.equal(await b.evaluate('module3D.prototypeLifecycle.activeViewports'), 0)
    save()
  }
  // Repeated full construction/disposal, with GC only at documented checkpoints.
  report.memory = []
  for (let i = 0; i < 5; i++) {
    await b.evaluate('create3D(32)')
    await b.evaluate(`config3D('ancient-ruins','combined')`)
    await b.evaluate('settle()')
    await b.evaluate('v.png(0)')
    const live = await b.evaluate('resources3D()')
    await b.evaluate('v.dispose();v=undefined')
    await b.send('HeapProfiler.collectGarbage')
    const metrics = await b.send('Performance.getMetrics')
    const dom = await b.send('Memory.getDOMCounters')
    report.memory.push({
      cycle: i,
      live,
      heapUsed: metrics.metrics.find((m) => m.name === 'JSHeapUsedSize')?.value,
      dom,
      active: await b.evaluate('module3D.prototypeLifecycle.activeViewports'),
      canvases: await b.evaluate('host3D.querySelectorAll("canvas").length'),
    })
    save()
  }
  await b.evaluate('create3D(32)')
  await b.evaluate(`config3D('ancient-ruins','combined')`)
  await b.evaluate('settle()')
  const idle = await b.evaluate(`(async()=>{
    v.png(0);await settle();const render=v.renderer.render;let renders=0;v.renderer.render=function(...args){renders++;return render.apply(this,args)};
    try{await new Promise(r=>setTimeout(r,2500));const staticRenders=renders;renders=0;notifications=0;v.setFlameAnimation(true);await new Promise(r=>setTimeout(r,4000));v.setFlameAnimation(false);return {staticRenders,animatedPasses:renders,notifications,resources:resources3D()}}
    finally{v.renderer.render=render}
  })()`)
  report.idle = idle
  // Exercise actual mouse pan/tilt/zoom in the playground-sized canvas.
  const rect = await b.evaluate(
    '(()=>{const r=v.renderer.domElement.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}})()',
  )
  const x = rect.x + rect.width / 2,
    y = rect.y + rect.height / 2
  report.camera = { before: await b.evaluate('({target:v.target(),...v.stats()})') }
  await b.send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x,
    y,
    button: 'left',
    buttons: 1,
    clickCount: 1,
  })
  await b.send('Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    x: x + 40,
    y: y + 20,
    button: 'left',
    buttons: 1,
  })
  await b.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: x + 40,
    y: y + 20,
    button: 'left',
    buttons: 0,
    clickCount: 1,
  })
  await b.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x, y, deltaX: 0, deltaY: -100 })
  await b.evaluate('settle()')
  report.camera.after = await b.evaluate('({target:v.target(),...v.stats()})')
  assert.notDeepEqual(report.camera.before.target, report.camera.after.target)
  assert(report.camera.after.zoom > report.camera.before.zoom)
  await b.evaluate('v.dispose();v=undefined;host3D.remove()')
  report.errors = b.errors
  assert.deepEqual(b.errors, [])
  report.activeAtEnd = await b.evaluate('module3D.prototypeLifecycle.activeViewports')
  assert.equal(report.activeAtEnd, 0)
  save()
} finally {
  await b.close()
}
assert.deepEqual(fs.readdirSync(browserProfileRoot).sort(), profiles, 'No browser profile growth')
console.log(phase + ' performance and lifecycle audit complete')
