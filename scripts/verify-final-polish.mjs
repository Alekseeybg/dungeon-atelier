import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { format, resolveConfig } from 'prettier'
import { browserSession, poll } from '../tests/helpers/browser.mjs'
const output = path.resolve('reports/visual-foundation/final-polish')
fs.mkdirSync(output, { recursive: true })
const browser = await browserSession('http://localhost:9000')
const save = (name, png) =>
  fs.writeFileSync(path.join(output, name + '.png'), Buffer.from(png, 'base64'))
try {
  const report = await browser.evaluate(`(async()=>{
    const r=await import('/src/features/dungeon/rendering/visual-foundation/renderer.ts'),m=await import('/src/features/dungeon/rendering/visual-foundation/model.ts'),s=await import('/src/features/dungeon/rendering/visual-foundation/finishing-scene.ts'),v=await import('/src/features/dungeon/rendering/visual-foundation/finishing-comparison.ts'),p=await import('/src/features/dungeon/rendering/visual-foundation/final-style.ts'),a=await import('/src/features/dungeon/rendering/visual-foundation/mounted-torches.ts'),source=s.createFinishingScene(),before=JSON.stringify(source),base=m.createFoundationScene(),hash=c=>{let h=2166136261;for(const x of c.getContext('2d').getImageData(0,0,c.width,c.height).data)h=Math.imul(h^x,16777619);return(h>>>0).toString(16)},png=c=>c.toDataURL().split(',')[1],resize=(source,scale)=>{const c=document.createElement('canvas');c.width=source.width*scale;c.height=source.height*scale;c.getContext('2d').drawImage(source,0,0,c.width,c.height);return c};
    if(JSON.stringify(base.floor.tiles)!==JSON.stringify(source.floor.tiles)||JSON.stringify(base.floor.doors)!==JSON.stringify(source.floor.doors))throw Error('Approved room geometry changed');
    const legacy=await r.renderFoundation({coping:'hewn',capProfile:'chamfered',capFinish:'cut',capPolish:false});if(hash(legacy)!=='f0481d58')throw Error('Accepted cap/floor scene changed');
    const image=await r.renderFoundation(p.FINAL_FOUNDATION,source),again=await r.renderFoundation(p.FINAL_FOUNDATION,source);if(hash(image)!==hash(again))throw Error('Nondeterministic final details');if(before!==JSON.stringify(source))throw Error('Fixture mutated');
    const art=await a.loadMountedTorchArt();window.finalProof={r,m,s,v,p,source,before,hash,png,resize,image};return{approvedGeometryUnchanged:true,legacyAppearanceUnchanged:true,deterministic:true,fixtureUnchanged:true,stairDirections:source.floor.stairs.map(s=>s.direction),torchCount:source.torches.length,frontAndSideArt:{front:[art.front.width,art.front.height],side:[art.side.width,art.side.height]},projection:m.FOUNDATION}
  })()`)
  for (const stairs of ['recessed', 'cheeked', 'plain'])
    for (const view of ['room', 'stairs', 'torch', 'mount', 'side']) {
      if (stairs !== 'recessed' && !['room', 'stairs'].includes(view)) continue
      const png = await browser.evaluate(
        `(async()=>{const p=finalProof,image=await p.r.renderFoundation({...p.p.FINAL_FOUNDATION,stairs:${JSON.stringify(stairs)}},p.source);return p.png(p.v.cropFinishing(image,${JSON.stringify(view)}))})()`,
      )
      save(`${stairs}-${view}`, png)
    }
  save(
    'full-room-normal',
    await browser.evaluate(
      `finalProof.png(finalProof.resize(finalProof.v.cropFinishing(finalProof.image,'room'),.5))`,
    ),
  )
  save(
    'stairs-options',
    await browser.evaluate(
      `(async()=>{const p=finalProof,out=document.createElement('canvas');out.width=p.v.cropFinishing(p.image,'stairs').width*3+32;out.height=312;const c=out.getContext('2d');c.fillStyle='#080d10';c.fillRect(0,0,out.width,out.height);let x=0;for(const [stairs,label]of [['recessed','A · Fitted well (recommended)'],['cheeked','B · Raised cheeks'],['plain','C · Low-profile flight']]){const image=p.v.cropFinishing(await p.r.renderFoundation({...p.p.FINAL_FOUNDATION,stairs},p.source),'stairs');c.fillStyle='#dfd4bd';c.font='18px sans-serif';c.fillText(label,x+8,25);c.drawImage(image,x,42);x+=image.width+16}return p.png(out)})()`,
    ),
  )
  save(
    'torch-before-after',
    await browser.evaluate(
      `(async()=>{const p=finalProof,a=p.v.cropFinishing(await p.r.renderFoundation({...p.p.FINAL_FOUNDATION,northTorchMount:'flat'},p.source),'mount'),b=p.v.cropFinishing(p.image,'mount'),out=document.createElement('canvas');out.width=a.width*2+16;out.height=a.height+44;const c=out.getContext('2d');c.fillStyle='#080d10';c.fillRect(0,0,out.width,out.height);c.fillStyle='#dfd4bd';c.font='18px sans-serif';c.fillText('Before: flat wall mounting',12,28);c.fillText('After: projecting mount / separate flame',a.width+28,28);c.drawImage(a,0,44);c.drawImage(b,a.width+16,44);return p.png(out)})()`,
    ),
  )
  report.northMount = await browser.evaluate(`(async()=>{
    const p=finalProof,a=await p.r.renderFoundation({...p.p.FINAL_FOUNDATION,northTorchMount:'flat'},p.source),b=p.image;
    for(const view of ['side','stairs'])if(p.hash(p.v.cropFinishing(a,view))!==p.hash(p.v.cropFinishing(b,view)))throw Error(view+' changed');
    const x=a.getContext('2d').getImageData(0,0,a.width,a.height).data,y=b.getContext('2d').getImageData(0,0,b.width,b.height).data;
    let count=0;for(let i=0;i<x.length;i+=4){if(x.slice(i,i+4).every((v,j)=>v===y[i+j]))continue;count++;const px=(i/4)%a.width,py=Math.floor(i/4/a.width);if(![9,13].some(tx=>px>=(32+tx*32-2)*2&&px<(32+tx*32+30)*2&&py>=(32+140)*2&&py<(32+184)*2))throw Error('Changes outside north torch bounds: '+px+','+py)}
    if(!count)throw Error('North mounting unchanged');
    const art=await import('/src/features/dungeon/rendering/visual-foundation/mounted-torches.ts'),sprites=await art.loadMountedTorchArt(),images=[];
    for(const fire of [false,true]){const c=document.createElement('canvas');c.width=128;c.height=128;const ctx=c.getContext('2d');ctx.scale(4,4);ctx.translate(0,-4);art.drawNorthMount(ctx,sprites,{x:0,y:0},fire);images.push(c)}
    if(p.hash(images[0])===p.hash(images[1]))throw Error('Flame is not independent');
    // All pixels below the ember bed remain identical when switching only the fire pass.
    const lower=c=>{const out=document.createElement('canvas');out.width=128;out.height=64;out.getContext('2d').drawImage(c,0,64,128,64,0,0,128,64);return out};
    if(p.hash(lower(images[0]))!==p.hash(lower(images[1])))throw Error('Flame changed lower hardware');
    return{sideWallExactPixels:true,stairsExactPixels:true,onlyNorthTorchPixelsChanged:true,changedPixels:count,separateFlame:true,lowerHardwareUnchanged:true,basket:[sprites.basket.width,sprites.basket.height],flame:[sprites.flame.width,sprites.flame.height]}
  })()`)
  save(
    'north-torch-close-up',
    await browser.evaluate(
      `(async()=>{const p=finalProof,a=p.v.cropFinishing(await p.r.renderFoundation({...p.p.FINAL_FOUNDATION,northTorchMount:'flat'},p.source),'torch'),b=p.v.cropFinishing(p.image,'torch'),out=document.createElement('canvas');out.width=a.width*2+16;out.height=a.height+44;const c=out.getContext('2d');c.fillStyle='#080d10';c.fillRect(0,0,out.width,out.height);c.fillStyle='#dfd4bd';c.font='16px sans-serif';c.fillText('Before · flat',12,28);c.fillText('After · projecting',a.width+28,28);c.drawImage(a,0,44);c.drawImage(b,a.width+16,44);return p.png(out)})()`,
    ),
  )
  await browser.send('Page.navigate', {
    url: 'http://localhost:9000/#/visual-foundation/final-polish',
  })
  const ready = () =>
    browser.evaluate(
      `document.querySelector('canvas[aria-label="Final details artwork"]')?.width===800&&!document.querySelector('.q-spinner')`,
    )
  await poll(ready, 'Final polish review page')
  assert(
    await browser.evaluate(
      `document.querySelector('canvas[aria-label="Final details artwork"]').toDataURL()===finalProof.v.cropFinishing(finalProof.image,'room').toDataURL()`,
    ),
  )
  report.uiExactPixels = true
  async function choose(aria, label) {
    await poll(
      () => browser.evaluate(`document.querySelectorAll('[role="option"]').length===0`),
      'Select closed',
    )
    await browser.evaluate(`document.querySelector('[aria-label=${JSON.stringify(aria)}]').click()`)
    await poll(
      () =>
        browser.evaluate(
          `(()=>{const n=[...document.querySelectorAll('[role="option"]')].find(n=>n.textContent.trim()===${JSON.stringify(label)});if(!n)return false;n.click();return true})()`,
        ),
      'Choose ' + label,
    )
    await poll(
      () =>
        browser.evaluate(
          `document.querySelectorAll('[role="option"]').length===0&&!document.querySelector('.q-spinner')`,
        ),
      'Review refreshed',
    )
  }
  for (const [stairs, label] of [
    ['recessed', 'A · Fitted stone well · recommended'],
    ['cheeked', 'B · Raised stone cheeks'],
    ['plain', 'C · Low-profile flight'],
  ]) {
    await choose('Final stair presentation', label)
    const expected = await browser.evaluate(
      `(async()=>{const p=finalProof;return p.v.cropFinishing(await p.r.renderFoundation({...p.p.FINAL_FOUNDATION,stairs:${JSON.stringify(stairs)}},p.source),'room').toDataURL()})()`,
    )
    await poll(
      () =>
        browser.evaluate(
          `document.querySelector('canvas[aria-label="Final details artwork"]').toDataURL()===${JSON.stringify(expected)}`,
        ),
      'Selected stair artwork',
    )
  }
  await choose('Final stair presentation', 'A · Fitted stone well · recommended')
  for (const [view, label] of [
    ['stairs', 'Stairs · up / down'],
    ['torch', 'Torch close-up'],
    ['mount', 'Torch + wall integration'],
    ['side', 'Side-mounted sconce'],
    ['room', 'Four-door room'],
  ]) {
    await choose('Final polish view', label)
    const expected = await browser.evaluate(
      `finalProof.v.cropFinishing(finalProof.image,${JSON.stringify(view)}).toDataURL()`,
    )
    await poll(
      () =>
        browser.evaluate(
          `document.querySelector('canvas[aria-label="Final details artwork"]').toDataURL()===${JSON.stringify(expected)}`,
        ),
      'Selected view artwork',
    )
  }
  await browser.evaluate(`document.querySelector('[aria-label="Final torch comparison"]').click()`)
  await poll(
    () =>
      browser.evaluate(
        `!!document.querySelector('canvas[aria-label="Previous torch presentation"]')&&!document.querySelector('.q-spinner')`,
      ),
    'Torch comparison',
  )
  assert(
    await browser.evaluate(
      `document.querySelector('canvas[aria-label="Previous torch presentation"]').toDataURL()!==document.querySelector('canvas[aria-label="Final details artwork"]').toDataURL()`,
    ),
  )
  await browser.evaluate(`document.querySelector('[aria-label="Final torch comparison"]').click()`)
  await poll(ready, 'Single review restored')
  const downloads = path.resolve(
    'apps/dungeon-atelier/.quasar/final-polish-downloads-' + Date.now(),
  )
  fs.mkdirSync(downloads, { recursive: true })
  await browser.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads })
  await browser.evaluate(
    `([...document.querySelectorAll('button')].find(n=>n.textContent.trim()==='Save PNG')).click()`,
  )
  const filename = path.join(downloads, 'final-polish-recessed-room.png')
  await poll(() => fs.existsSync(filename), 'Final details PNG export')
  const exported = fs.readFileSync(filename)
  assert.equal(exported.readUInt32BE(16), 800)
  assert.equal(exported.readUInt32BE(20), 780)
  report.controls = { threeStairs: true, fiveViews: true, torchComparison: true, pngExport: true }
  report.layouts = []
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
    assert(metrics.scrollWidth <= width + 1, JSON.stringify(metrics))
    assert.deepEqual(metrics.overlays, [])
    report.layouts.push({ ...metrics, height, dpr })
    const shot = await browser.send('Page.captureScreenshot', { format: 'png' })
    save('review-' + width, shot.data)
  }
  assert.deepEqual(browser.errors, [])
  report.runtimeErrors = browser.errors
  report.scope = 'Approved-reference regression; production uses the same compositor.'
  fs.writeFileSync(
    path.join(output, 'report.json'),
    await format(JSON.stringify(report), {
      ...(await resolveConfig('package.json')),
      parser: 'json',
    }),
  )
  console.log(JSON.stringify({ passed: true, ...report }, null, 2))
} finally {
  browser.close()
}
