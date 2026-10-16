import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { format, resolveConfig } from 'prettier'
import { browserSession, poll } from '../tests/helpers/browser.mjs'

const output = path.resolve('reports/visual-foundation/cap-polish')
fs.mkdirSync(output, { recursive: true })
const browser = await browserSession('http://localhost:9000')
const report = { treatments: {}, floors: {}, layouts: [] }
const save = (name, png) => fs.writeFileSync(path.join(output, name), Buffer.from(png, 'base64'))
try {
  await browser.evaluate(`(async()=>{
    const r=await import('/src/features/dungeon/rendering/visual-foundation/renderer.ts'),
      m=await import('/src/features/dungeon/rendering/visual-foundation/model.ts'),
      c=await import('/src/features/dungeon/rendering/visual-foundation/comparison.ts'),
      a=await import('/src/features/dungeon/rendering/visual-foundation/art.ts')
    const bytes=c=>c.getContext('2d').getImageData(0,0,c.width,c.height).data,
      hash=c=>{let h=2166136261;for(const v of bytes(c))h=Math.imul(h^v,16777619);return(h>>>0).toString(16)},
      png=c=>c.toDataURL().split(',')[1],
      pair=(a,b,labelA='Current caps · effects off',labelB='Same art · cap effects on')=>{const image=document.createElement('canvas');image.width=a.width+b.width+16;image.height=Math.max(a.height,b.height)+44;const c=image.getContext('2d');c.fillStyle='#080d10';c.fillRect(0,0,image.width,image.height);c.fillStyle='#e8dac0';c.font='18px sans-serif';c.fillText(labelA,12,28);c.fillText(labelB,a.width+28,28);c.drawImage(a,0,44);c.drawImage(b,a.width+16,44);return image}
    window.capProof={r,m,c,a,bytes,hash,png,pair,source:m.createFoundationScene()}
    capProof.before=JSON.stringify(capProof.source)
  })()`)
  for (const treatment of ['ruins', 'fortress', 'original']) {
    const proof = await browser.evaluate(`(async()=>{
      const p=capProof,options={treatment:${JSON.stringify(treatment)}},
        before=await p.r.renderFoundation(options,p.source),after=await p.r.renderFoundation({...options,capPolish:true},p.source),
        again=await p.r.renderFoundation({...options,capPolish:true},p.source),
        atlasBefore=await p.r.foundationAtlas(options),atlasAfter=await p.r.foundationAtlas({...options,capPolish:true}),
        a=p.bytes(atlasBefore),b=p.bytes(atlasAfter)
      if(p.hash(after)!==p.hash(again))throw Error('Nondeterministic cap effects')
      if(p.hash(after)===p.hash(before))throw Error('No effect')
      if(a.length!==b.length)throw Error('Atlas size changed')
      let changes=0;for(let i=0;i<a.length;i+=4){if(a[i+3]!==b[i+3])throw Error('Architectural coverage changed at '+i);if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2])changes++}
      const contactBefore=await p.r.foundationContact(options),contactAfter=await p.r.foundationContact({...options,capPolish:true})
      if(p.hash(contactBefore)!==p.hash(contactAfter))throw Error('Floor contact shadow changed')
      const sample=source=>{const c=document.createElement('canvas');c.width=c.height=120;c.getContext('2d').drawImage(source,32*2+10*64,32*2+10*52,120,120,0,0,120,120);return p.hash(c)}
      if(sample(before)!==sample(after))throw Error('Interior floor changed')
      const invA=await p.r.foundationInventory(options),invB=await p.r.foundationInventory({...options,capPolish:true})
      if(JSON.stringify(invA)!==JSON.stringify(invB))throw Error('Geometry, anchors or source art changed')
      if(JSON.stringify(p.source)!==p.before)throw Error('Fixture mutated')
      p.current={before,after,options}
      return{before:p.hash(before),after:p.hash(after),changedArchitecturalPixels:changes,coverageIdentical:true,contactIdentical:true,floorInteriorIdentical:true,inventoryIdentical:true,fixtureUnchanged:true}
    })()`)
    report.treatments[treatment] = proof
    for (const lighting of [true, false])
      for (const view of [
        'room',
        'east-wall',
        'south-east',
        'wall-detail',
        'doors-ns',
        'doors-ew',
      ]) {
        const png = await browser.evaluate(`(async()=>{
          const p=capProof,o={...p.current.options,lighting:${lighting}},
            a=p.c.cropFoundation(await p.r.renderFoundation(o),${JSON.stringify(view)}),
            b=p.c.cropFoundation(await p.r.renderFoundation({...o,capPolish:true}),${JSON.stringify(view)});
          return p.png(p.pair(a,b))
        })()`)
        save(`${treatment}-${view}-${lighting ? 'lit' : 'unlit'}.png`, png)
      }
  }
  assert.equal(report.treatments.ruins.before, '45bcf9c0', 'Accepted baseline changed')
  report.doorAndSecretChecks = await browser.evaluate(`(async()=>{
    const p=capProof,options={capPolish:true},closed=await p.r.renderFoundation(options),open=await p.r.renderFoundation({...options,doors:'open'}),changes={};
    for(const door of p.source.floor.doors){const origin=p.m.spriteOrigin(door.position.x,door.position.y),x=(32+origin.x-12)*2,y=(32+origin.y-29)*2,a=closed.getContext('2d').getImageData(x,y,100,120).data,b=open.getContext('2d').getImageData(x,y,100,120).data;let count=0;for(let i=0;i<a.length;i+=4)if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2])count++;if(count<30)throw Error('Open doorway did not change: '+door.id);changes[door.id]=count}
    const secret=p.m.createFoundationScene(true),before=JSON.stringify(secret),twin=structuredClone(secret);
    for(const route of twin.floor.shortcuts)for(const cell of route.path)twin.floor.tiles[cell.y][cell.x]='wall';
    twin.floor.doors=twin.floor.doors.filter(d=>d.type!=='secret');twin.floor.shortcuts=[];
    const hidden=await p.r.renderFoundation({...options,secret:'hidden'},secret),sealed=await p.r.renderFoundation({...options,secret:'hidden'},twin),revealed=await p.r.renderFoundation({...options,secret:'revealed'},secret);
    if(p.hash(hidden)!==p.hash(sealed)||p.hash(hidden)===p.hash(revealed))throw Error('Cap effects broke secret concealment');
    if(before!==JSON.stringify(secret))throw Error('Secret floor mutated');
    const module=await import('/src/features/dungeon/rendering/visual-foundation/cap-polish.ts'),samples={};
    for(const [name,points]of [['east',[{x:20,y:20},{x:20,y:60},{x:26,y:84},{x:26,y:44}]],['south',[{x:20,y:20},{x:60,y:20},{x:66,y:44},{x:26,y:44}]]]){
      const image=document.createElement('canvas');image.width=image.height=800;const c=image.getContext('2d');c.scale(8,8);c.fillStyle='#888888';c.fillRect(0,0,100,100);module.shadeCapJoint(c,points);
      const sample=(u,v)=>{const a=points[0],b=points[1],d=points[3],x=Math.round((a.x+(b.x-a.x)*u+(d.x-a.x)*v)*8),y=Math.round((a.y+(b.y-a.y)*u+(d.y-a.y)*v)*8);return c.getImageData(x,y,1,1).data[0]},values=[sample(.25,.05),sample(.75,.05),sample(.5,.5)];
      if(Math.abs(values[0]-values[1])>3||values[0]>=values[2]-15)throw Error('Inconsistent cap-to-face shadow on '+name+': '+values);samples[name]=values
    }
    return{openDoorChangedPixels:changes,concealedSecretMatchesSealedTwin:true,secretInputUnchanged:true,faceShadowSamples:samples}
  })()`)
  // Effect attribution: compare each isolated layer with the same unlit baseline.
  report.effects = {}
  for (const effect of ['highlights', 'occlusion', 'wear', 'shading']) {
    const proof = await browser.evaluate(`(async()=>{
      const p=capProof,options={lighting:false},a=await p.r.renderFoundation(options),
        b=await p.r.renderFoundation({...options,capPolish:true,capEffects:[${JSON.stringify(effect)}]});
      if(p.hash(a)===p.hash(b))throw Error('Inactive effect layer');
      return{hash:p.hash(b),png:p.png(p.pair(p.c.cropFoundation(a,'wall-detail'),p.c.cropFoundation(b,'wall-detail'),'Current caps',${JSON.stringify(effect + ' only')}))}
    })()`)
    save(`layer-${effect}.png`, proof.png)
    report.effects[effect] = proof.hash
  }
  const floors = await browser.evaluate(`capProof.a.FLOOR_STUDIES.map(s=>s.value)`)
  for (const floor of floors) {
    report.floors[floor] = await browser.evaluate(`(async()=>{
      const p=capProof,o={floor:${JSON.stringify(floor)}},a=await p.r.foundationContact(o),b=await p.r.foundationContact({...o,capPolish:true}),
        image=await p.r.renderFoundation({...o,capPolish:true});
      if(p.hash(a)!==p.hash(b))throw Error('Floor transition changed');return{hash:p.hash(image),contactIdentical:true}
    })()`)
  }
  // Reuse an actual generated map from the floor audit to inspect connected cap runs.
  const floor = JSON.parse(
    fs.readFileSync(
      'reports/visual-foundation/generated-floors/floor-audit-64-compact-amber.json',
      'utf8',
    ),
  )
  const generated = await browser.evaluate(`(async()=>{
    const p=capProof,g=await import('/src/features/dungeon/rendering/visual-foundation/generated-scene.ts'),source=g.generatedFoundationScene(${JSON.stringify(floor)}),before=JSON.stringify(source),images=[];
    for(const capPolish of [false,true]){const review=await p.r.prepareFoundationReview(source,{capPolish,secret:'revealed'}),full=await review.render('refined'),small=document.createElement('canvas');small.width=1024;small.height=Math.round(full.height*1024/full.width);small.getContext('2d').drawImage(full,0,0,small.width,small.height);images.push(small);full.width=full.height=1;review.dispose()}
    if(before!==JSON.stringify(source))throw Error('Generated source changed');
    return{png:p.png(p.pair(...images)),seed:source.floor.seed}
  })()`)
  save('generated-map-before-after.png', generated.png)
  report.generatedSeed = generated.seed
  await browser.send('Page.navigate', { url: 'http://localhost:9000/#/visual-foundation' })
  const ready = () =>
    browser.evaluate(
      `document.querySelector('canvas[aria-label="Candidate artwork"]')?.width===832&&!document.querySelector('.q-spinner')`,
    )
  await poll(ready, 'Cap review UI')
  const expected = await browser.evaluate(
    `(async()=>capProof.c.cropFoundation(await capProof.r.renderFoundation({capPolish:true}),'room').toDataURL())()`,
  )
  const actual = () =>
    browser.evaluate(`document.querySelector('canvas[aria-label="Candidate artwork"]').toDataURL()`)
  await poll(async () => (await actual()) === expected && (await ready()), 'Polished default')
  await browser.evaluate(
    `document.querySelector('[aria-label="Foundation cap comparison"]').click()`,
  )
  await poll(
    () =>
      browser.evaluate(
        `document.querySelector('canvas[aria-label="Current cap artwork"]')?.width===832&&!document.querySelector('.q-spinner')`,
      ),
    'Comparison ready',
  )
  const baseline = await browser.evaluate(
    `(async()=>capProof.c.cropFoundation(await capProof.r.renderFoundation(),'room').toDataURL())()`,
  )
  assert.equal(
    await browser.evaluate(
      `document.querySelector('canvas[aria-label="Current cap artwork"]').toDataURL()`,
    ),
    baseline,
  )
  await browser.evaluate(`document.querySelector('[aria-label="Foundation cap polish"]').click()`)
  await poll(async () => (await actual()) === baseline && (await ready()), 'Baseline restored')
  await browser.evaluate(`document.querySelector('[aria-label="Foundation cap polish"]').click()`)
  await poll(async () => (await actual()) === expected && (await ready()), 'Effects restored')
  for (const [width, height, dpr] of [
    [1920, 1080, 1],
    [2560, 1440, 1],
    [390, 844, 2],
  ]) {
    await browser.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: dpr,
      mobile: width < 600,
    })
    const metrics = await browser.evaluate(
      `({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,overlays:[...document.querySelectorAll('vite-error-overlay,vite-plugin-checker-error-overlay')].map(e=>e.shadowRoot?.querySelector('main')?.innerText||'').filter(Boolean)})`,
    )
    assert(metrics.scrollWidth <= width + 1)
    assert.deepEqual(metrics.overlays, [])
    report.layouts.push({ ...metrics, height, dpr })
    const screenshot = await browser.send('Page.captureScreenshot', { format: 'png' })
    save(`review-${width}.png`, screenshot.data)
  }
  assert.deepEqual(browser.errors, [])
  report.runtimeErrors = browser.errors
  report.scope = 'Existing textures; prototype and review only. Production themes unchanged.'
  fs.writeFileSync(
    path.join(output, 'report.json'),
    await format(JSON.stringify(report), {
      ...(await resolveConfig('package.json')),
      parser: 'json',
    }),
  )
  console.log(JSON.stringify({ passed: true, ...report, output }, null, 2))
} finally {
  browser.close()
}
