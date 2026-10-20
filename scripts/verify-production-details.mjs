import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { browserSession, poll } from '../tests/helpers/browser.mjs'
import { formatProductionReports } from './format-production-reports.mjs'

const output = path.resolve('reports/production'),
  b = await browserSession('http://localhost:9000'),
  report = { references: [], checks: {} }
const save = (name, data) =>
  fs.writeFileSync(path.join(output, name + '.png'), Buffer.from(data, 'base64'))
const state = () => b.evaluate(`proof.state()`)
const ready = (seed) =>
  poll(async () => {
    const s = await state()
    return s.seed === seed && !s.loading
  }, 'Reference ' + seed)
const shot = async (name) =>
  save(name, (await b.send('Page.captureScreenshot', { format: 'png' })).data)
const click = (aria) =>
  b.evaluate(`document.querySelector('[aria-label=${JSON.stringify(aria)}]').click()`)
try {
  await b.evaluate(`(async()=>{const r=await import('/src/features/dungeon/rendering/dungeon-renderer.ts'),
    store=(await import('/src/stores/dungeon.ts')).useDungeonStore(),a=(await import('/src/stores/appearance.ts')).useAppearanceStore(),
    m=await import('/src/features/dungeon/rendering/architecture-model.ts'),
    fog=await import('/src/features/dungeon/rendering/walk-fog.ts'),walk=await import('/src/features/dungeon/rendering/ancient-renderer.ts'),
    component=()=>document.querySelector('.dungeon-canvas').__vueParentComponent,
    png=c=>c.toDataURL().split(',')[1],hash=c=>{let h=2166136261;for(const x of c.getContext('2d').getImageData(0,0,c.width,c.height).data)h=Math.imul(h^x,16777619);return(h>>>0).toString(16)},
    overview=source=>{const c=document.createElement('canvas');c.width=Math.min(1800,source.width);c.height=Math.round(source.height*c.width/source.width);c.getContext('2d').drawImage(source,0,0,c.width,c.height);return c};
    window.proof={r,store,a,m,fog,walk,component,state:()=>component().exposed.getRenderState(),png,hash,overview}})()`)
  await poll(async () => {
    const s = await state()
    return s.seed && !s.loading
  }, 'Initial scene')
  for (const size of [32, 64, 96]) {
    const floor = JSON.parse(
      fs.readFileSync(path.join(output, `production-${size}-classic-amber.json`), 'utf8'),
    )
    await b.evaluate(
      `(async()=>{proof.a.reset();Object.assign(proof.store.config,${JSON.stringify(floor.config)});await proof.store.generate()})()`,
    )
    await ready(floor.seed)
    await shot(`recommended-${size}-editor`)
    const image = await b.evaluate(
      `(async()=>{const p=proof,s=p.state(),c=await p.r.createMapCanvasAsync(p.store.floor,s.grid,s.style,s.options),data=p.png(p.overview(c));p.r.disposeMapCanvas(c);return data})()`,
    )
    save(`recommended-${size}`, image)
    const start = performance.now()
    const pan = await b.evaluate(
      `(()=>{const p=proof,c=p.component().exposed,initial=p.state().camera.scale,times=[];c.zoomAtCenter(1/initial);for(let i=0;i<24;i++){const t=performance.now();c.zoomAtCenter(i%2?1/1.01:1.01);times.push(performance.now()-t)}return {averageMs:times.reduce((a,b)=>a+b,0)/times.length,maxMs:Math.max(...times)}})()`,
    )
    for (const zoom of [0.5, 1, 2]) {
      await b.evaluate(
        `(()=>{const p=proof,c=p.component().exposed;c.zoomAtCenter(${zoom}/p.state().camera.scale);c.centerOnCell(p.store.floor.stairs.find(s=>s.direction==='up').position)})()`,
      )
      await shot(`recommended-${size}-zoom-${zoom}`)
      assert(Math.abs((await state()).camera.scale - zoom) < 1e-6)
    }
    report.references.push({
      size,
      seed: floor.seed,
      file: `recommended-${size}.png`,
      zooms: [0.5, 1, 2],
      pan,
      interactionCaptureMs: Math.round(performance.now() - start),
    })
    console.log(
      `Approved default ${size}: 50/100/200% view; mean cached draw ${pan.averageMs.toFixed(2)} ms`,
    )
  }
  const matrices = JSON.parse(fs.readFileSync(path.join(output, 'matrix.json'), 'utf8')),
    secret = matrices
      .map((m) => JSON.parse(fs.readFileSync(path.join(output, m.seed + '.json'), 'utf8')))
      .find((f) => f.shortcuts?.length)
  assert(secret, 'A generated secret route is required for concealment validation')
  await b.evaluate(
    `proof.a.reset();proof.store.importJson(${JSON.stringify(JSON.stringify(secret))})`,
  )
  await ready(secret.seed)
  const secrecy = await b.evaluate(`(async()=>{
    const p=proof,f=p.store.floor,before=JSON.stringify(f),options=p.state().options,
      hidden=await p.r.createMapCanvasAsync(f,false,'ancient',{...options,revealSecrets:false}),
      inert=await p.r.createMapCanvasAsync(p.m.concealSecretArchitecture(f),false,'ancient',{...options,revealSecrets:false}),
      hiddenHash=p.hash(hidden),equal=hiddenHash===p.hash(inert);
    p.r.disposeMapCanvas(inert);
    const revealed=await p.r.createMapCanvasAsync(f,false,'ancient',{...options,revealSecrets:true}),different=p.hash(revealed)!==hiddenHash,
      door=f.doors.find(d=>d.type==='secret'),detail=source=>{const c=document.createElement('canvas');c.width=384;c.height=320;c.getContext('2d').drawImage(source,(32+door.position.x*32-32)*2,(32+door.position.y*26-32)*2,192,160,0,0,384,320);return p.png(c)},
      result={equal,different,sourceUnchanged:before===JSON.stringify(f),hidden:detail(hidden),revealed:detail(revealed)};
    p.r.disposeMapCanvas(hidden);p.r.disposeMapCanvas(revealed);return result
  })()`)
  assert(secrecy.equal && secrecy.different && secrecy.sourceUnchanged)
  save('secret-hidden', secrecy.hidden)
  save('secret-revealed', secrecy.revealed)
  report.checks.concealedEqualsUntouchedRock = true
  await click('Map overlays')
  await click('Reveal secret architecture')
  await click('Map overlays')
  await poll(async () => {
    const s = await state()
    return !s.loading && s.options.revealSecrets
  }, 'Secret reveal in editor')
  await shot('secret-revealed-editor')
  report.checks.secretRevealControl = true
  await click('Map overlays')
  await click('Show tile grid')
  await click('Map overlays')
  await poll(async () => {
    const s = await state()
    return !s.loading && s.grid
  }, 'Projected grid')
  report.checks.projectedGrid = true
  // Navigate from the logical square automap to the new projected canvas.
  await b.evaluate(
    `([...document.querySelectorAll('[role="tab"]')].find(n=>n.textContent.trim()==='Floor report')).click()`,
  )
  await poll(() => b.evaluate(`!!document.querySelector('.automap-canvas')`), 'Automap')
  const nav = await b.evaluate(
    `(()=>{const r=document.querySelector('.automap-canvas').getBoundingClientRect(),p=proof.store.floor.stairs[0].position,f=proof.store.floor;return{x:r.left+(p.x+.5)/f.width*r.width,y:r.top+(p.y+.5)/f.height*r.height,position:p}})()`,
  )
  for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased'])
    await b.send('Input.dispatchMouseEvent', {
      type,
      x: nav.x,
      y: nav.y,
      button: type === 'mouseMoved' ? 'none' : 'left',
      clickCount: 1,
    })
  await poll(
    async () => JSON.stringify((await state()).selected) === JSON.stringify(nav.position),
    'Automap selection',
  )
  report.checks.automapNavigation = true
  await click('Enter walk mode')
  await poll(async () => {
    const s = await state()
    return s.walk.active && !s.loading
  }, 'Walk reveal')
  const before = await state(),
    wallHeading = await b.evaluate(
      `(()=>{const p=proof.state().walk.position,f=proof.store.floor;return [[0,-1],[1,0],[0,1],[-1,0]].findIndex(([dx,dy])=>!['floor','door'].includes(f.tiles[p.y+dy]?.[p.x+dx]))})()`,
    )
  if (wallHeading >= 0) {
    for (let i = 0; i < wallHeading; i++) await click('Turn right')
    await click('Walk forward')
    assert.deepEqual((await state()).walk.position, before.walk.position)
    report.checks.wallCollision = true
  } else {
    // Find a real reachable wall through ordinary walking, without changing the floor or player state.
    let found = false
    for (let step = 0; step < 32 && !found; step++) {
      const s = await state(),
        blocked = await b.evaluate(
          `(()=>{const p=proof.state().walk.position,f=proof.store.floor,h=proof.state().walk.heading,ds=[[0,-1],[1,0],[0,1],[-1,0]],d=ds[h];return !['floor','door'].includes(f.tiles[p.y+d[1]]?.[p.x+d[0]])})()`,
        )
      await click('Walk forward')
      if (blocked) {
        assert.deepEqual((await state()).walk.position, s.walk.position)
        found = true
      }
    }
    assert(found)
    report.checks.wallCollision = true
  }
  report.checks.projectedFog = await b.evaluate(`(async()=>{
    const p=proof,s=p.state(),f=p.store.floor,walk=p.component().props.walk,image=await p.r.createMapCanvasAsync(f,false,'ancient',s.options),
      c=document.createElement('canvas');c.width=f.width*32+64;c.height=f.height*26+64;const ctx=c.getContext('2d');
    ctx.drawImage(image,0,0,c.width,c.height);ctx.translate(32,32);p.walk.drawAncientWalkCutaway(ctx,image,walk);p.fog.renderWalkFog(ctx,f,walk,'ancient');
    let unknown=0,hidden=0;for(let y=0;y<f.height;y++)for(let x=0;x<f.width;x++){if(walk.explored.has(y*f.width+x))continue;unknown++;const pixel=ctx.getImageData(32+x*32+16,32+y*26+13,1,1).data;if(pixel[0]===8&&pixel[1]===12&&pixel[2]===13)hidden++}
    const marker=ctx.getImageData(32+(walk.position.x+.5)*32,32+(walk.position.y+.5)*26,1,1).data,playerVisible=marker[0]>150;
    p.r.disposeMapCanvas(image);return{unknown,hidden,playerVisible}
  })()`)
  assert.equal(report.checks.projectedFog.unknown, report.checks.projectedFog.hidden)
  assert(report.checks.projectedFog.playerVisible)
  await shot('walk-projection-detail')
  const resources = await b.evaluate(
    `(async()=>(await import('/src/features/dungeon/rendering/map-resources.ts')).mapResourceStats())()`,
  )
  assert.equal(resources.live, 1)
  report.resources = resources
  assert.deepEqual(b.errors, [])
  report.runtimeErrors = b.errors
  fs.writeFileSync(path.join(output, 'details-report.json'), JSON.stringify(report, null, 2) + '\n')
  await formatProductionReports()
  console.log(JSON.stringify({ passed: true, ...report }, null, 2))
} catch (error) {
  await shot('failed-detail-check')
  throw error
} finally {
  b.close()
}
