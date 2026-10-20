import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { format, resolveConfig } from 'prettier'
import { browserSession, poll } from '../tests/helpers/browser.mjs'
const output = path.resolve('reports/visual-foundation/chamfer')
fs.mkdirSync(output, { recursive: true })
const browser = await browserSession('http://localhost:9000'),
  report = { families: {} }
try {
  await browser.evaluate(
    `(async()=>{const r=await import('/src/features/dungeon/rendering/visual-foundation/renderer.ts'),c=await import('/src/features/dungeon/rendering/visual-foundation/comparison.ts'),m=await import('/src/features/dungeon/rendering/visual-foundation/model.ts'),d=await import('/src/features/dungeon/rendering/architecture-model.ts'),p=await import('/src/features/dungeon/rendering/visual-foundation/chamfer-renderer.ts'),a=await import('/src/features/dungeon/rendering/visual-foundation/coping-art.ts');const hash=c=>{let h=2166136261;for(const v of c.getContext('2d').getImageData(0,0,c.width,c.height).data)h=Math.imul(h^v,16777619);return(h>>>0).toString(16)},png=c=>c.toDataURL().split(',')[1],pair=(a,b,scale=1)=>{const out=document.createElement('canvas');out.width=a.width*scale*2+16;out.height=a.height*scale+44;const c=out.getContext('2d');c.fillStyle='#080d10';c.fillRect(0,0,out.width,out.height);c.fillStyle='#e8dac0';c.font='18px sans-serif';c.fillText('Previous chamfered caps',12,28);c.fillText('Chiseled coping stones',a.width*scale+28,28);c.drawImage(a,0,44,a.width*scale,a.height*scale);c.drawImage(b,a.width*scale+16,44,b.width*scale,b.height*scale);return out};window.chamferProof={r,c,m,d,p,a,hash,png,pair}})()`,
  )
  for (const treatment of ['ruins', 'fortress']) {
    report.families[treatment] = await browser.evaluate(
      `(async()=>{const p=chamferProof,options={treatment:${JSON.stringify(treatment)},coping:'hewn',capPolish:false,capProfile:'chamfered'},source=p.m.createFoundationScene(),before=JSON.stringify(source),a=await p.r.renderFoundation(options,source),b=await p.r.renderFoundation({...options,capFinish:'cut'},source),again=await p.r.renderFoundation({...options,capFinish:'cut'},source);if(p.hash(b)!==p.hash(again)||p.hash(a)===p.hash(b))throw Error('Profile did not change deterministically');if(before!==JSON.stringify(source))throw Error('Fixture mutated');const contactA=await p.r.foundationContact(options),contactB=await p.r.foundationContact({...options,capFinish:'cut'});if(p.hash(contactA)!==p.hash(contactB))throw Error('Floor contact changed');const floorPatch=image=>{const c=document.createElement('canvas');c.width=c.height=128;c.getContext('2d').drawImage(image,32*2+10*64,32*2+10*52,128,128,0,0,128,128);return p.hash(c)};if(floorPatch(a)!==floorPatch(b))throw Error('Floor interior changed');const plan=p.d.createArchitecturePlan(source.floor,{}),nodes=[...plan.walls.map(w=>({x:w.x,y:w.y,mask:w.mask,corner:w.cornerFill})),...plan.doors.map(d=>({x:d.position.x,y:d.position.y,mask:d.orientation==='north-south'?10:5,corner:0,door:true}))],profile=p.p.buildCapChamfer(nodes,source.floor,await p.a.loadCopingArt(options.treatment));const normals=[...new Set(profile.facets.map(f=>f.edge.nx+','+f.edge.ny))];if(normals.length!==4)throw Error('Missing contour direction');const inner=profile.facets.some(f=>f.edge.ny===1&&f.edge.ay===218),outer=profile.facets.some(f=>f.edge.ny===-1&&f.edge.ay===198);if(!inner||!outer)throw Error('Missing inner or outer cap facet');const rects=nodes.flatMap(n=>p.d.wallCapRects(n.mask,n.corner,32).map(r=>({...r,x:r.x+n.x*32,y:r.y+n.y*32}))),inside=q=>rects.some(r=>q.x>=r.x-1e-6&&q.y>=r.y-1e-6&&q.x<=r.x+r.width+1e-6&&q.y<=r.y+r.height+1e-6);for(const f of profile.facets){for(const q of f.footprint)if(!inside(q))throw Error('Chamfer corner leaves cap footprint '+JSON.stringify(q));for(const u of [.2,.5,.8])for(const v of [.2,.5,.8]){const mix=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t}),q=mix(mix(f.footprint[0],f.footprint[1],u),mix(f.footprint[3],f.footprint[2],u),v);if(!inside(q))throw Error('Chamfer crosses empty space')}}p.options=options;return{innerAndOuterContours:true,facetsStayInsideCap:true,baseline:p.hash(a),chamfered:p.hash(b),facetCount:profile.facets.length,normals,profile:profile.profile,floorContactIdentical:true,floorInteriorIdentical:true,fixtureUnchanged:true,projection:p.m.FOUNDATION}})()`,
    )
    for (const lighting of [true, false])
      for (const view of [
        'room',
        'wall-detail',
        'east-wall',
        'south-east',
        'coping-edge',
        'doors-ns',
        'doors-ew',
      ]) {
        const png = await browser.evaluate(
          `(async()=>{const p=chamferProof,o={...p.options,lighting:${lighting}},a=p.c.cropCoping(await p.r.renderFoundation(o),${JSON.stringify(view)}),b=p.c.cropCoping(await p.r.renderFoundation({...o,capFinish:'cut'}),${JSON.stringify(view)});return p.png(p.pair(a,b,${view === 'room' || view === 'coping-edge' ? 0.5 : 1}))})()`,
        )
        fs.writeFileSync(
          path.join(output, `${treatment}-${view}-${lighting ? 'lit' : 'unlit'}.png`),
          Buffer.from(png, 'base64'),
        )
      }
    const sides = await browser.evaluate(
      `(async()=>{const p=chamferProof,a=await p.r.renderFoundation(p.options),b=await p.r.renderFoundation({...p.options,capFinish:'cut'}),out=document.createElement('canvas');out.width=1584;out.height=912;const c=out.getContext('2d');c.fillStyle='#080d10';c.fillRect(0,0,out.width,out.height);const views=[['North wall',256,130],['East wall',494,184],['South wall',256,390],['West wall',174,184]];for(let i=0;i<views.length;i++){const [label,x,y]=views[i],crop=source=>{const out=document.createElement('canvas');out.width=out.height=384;out.getContext('2d').drawImage(source,(32+x)*2,(32+y)*2,192,192,0,0,384,384);return out},pair=p.pair(crop(a),crop(b)),ox=i%2*800,oy=Math.floor(i/2)*456;c.fillStyle='#e8dac0';c.font='18px sans-serif';c.fillText(label,ox+12,oy+20);c.drawImage(pair,ox,oy+26)}return p.png(out)})()`,
    )
    fs.writeFileSync(path.join(output, `${treatment}-all-sides.png`), Buffer.from(sides, 'base64'))
    const fixedWall = await browser.evaluate(
      `(async()=>{const p=chamferProof,image=p.c.cropCoping(await p.r.renderFoundation({...p.options,capFinish:'cut'}),'coping-edge'),out=document.createElement('canvas');out.width=image.width/2;out.height=image.height/2;out.getContext('2d').drawImage(image,0,0,out.width,out.height);return p.png(out)})()`,
    )
    fs.writeFileSync(
      path.join(output, `${treatment}-short-wall-fixed.png`),
      Buffer.from(fixedWall, 'base64'),
    )
    const connections = await browser.evaluate(
      `(async()=>{const p=chamferProof,q=await import('/src/features/dungeon/rendering/visual-foundation/coping-coupon.ts'),source=q.createCopingCoupon(),before=JSON.stringify(source),plan=p.d.createArchitecturePlan(source.floor,{}),shapes=[...new Set(plan.walls.map(w=>w.shape))];if(!plan.walls.some(w=>w.mask===15)||!plan.walls.some(w=>[3,6,9,12].includes(w.mask)))throw Error('Missing connection cases');const a=await p.r.renderFoundation(p.options,source),b=await p.r.renderFoundation({...p.options,capFinish:'cut'},source);if(JSON.stringify(source)!==before)throw Error('Connection fixture mutated');if(p.hash(a)===p.hash(b))throw Error('Connection treatment unchanged');return{png:p.png(p.pair(a,b,.5)),shapes,fixtureUnchanged:true}})()`,
    )
    fs.writeFileSync(
      path.join(output, `${treatment}-connections.png`),
      Buffer.from(connections.png, 'base64'),
    )
    report.families[treatment].connections = {
      shapes: connections.shapes,
      fixtureUnchanged: connections.fixtureUnchanged,
    }
    console.log(treatment + ': previous chamfer / chiseled coping captured')
  }
  assert.equal(report.families.ruins.baseline, '711a992d')
  assert.equal(report.families.fortress.baseline, '25e45802')
  await browser.send('Page.navigate', {
    url: 'http://localhost:9000/#/visual-foundation',
  })
  await poll(
    () =>
      browser.evaluate(
        `!!document.querySelector('[aria-label="Show chamfer comparison"]')&&!document.querySelector('.q-spinner')`,
      ),
    'Prominent chamfer entry on the ordinary demo page',
  )
  await browser.evaluate(`document.querySelector('[aria-label="Show chamfer comparison"]').click()`)
  const ready = () =>
    browser.evaluate(
      `document.querySelector('canvas[aria-label="Chamfered cap artwork"]')?.width===800&&!document.querySelector('.q-spinner')`,
    )
  await poll(ready, 'Chamfer profile comparison')
  assert(await browser.evaluate(`location.hash.includes('profile=chamfer')`))
  // Sharing a comparison URL also works when this Vue page is already mounted.
  await browser.send('Page.navigate', { url: 'http://localhost:9000/#/visual-foundation' })
  await poll(
    () =>
      browser.evaluate(
        `!document.querySelector('canvas[aria-label="Chamfered cap artwork"]')&&!document.querySelector('.q-spinner')`,
      ),
    'Profile route reset without reload',
  )
  await browser.send('Page.navigate', {
    url: 'http://localhost:9000/#/visual-foundation?profile=chamfer',
  })
  await poll(ready, 'Shared profile URL without reload')
  report.ui = await browser.evaluate(
    `(async()=>{const r=await import('/src/features/dungeon/rendering/visual-foundation/renderer.ts'),c=await import('/src/features/dungeon/rendering/visual-foundation/comparison.ts'),results={};for(const [capFinish,label]of [['soft','Candidate artwork'],['cut','Chamfered cap artwork']]){const actual=document.querySelector('canvas[aria-label="'+label+'"]'),expected=c.cropCoping(await r.renderFoundation({coping:'hewn',capProfile:'chamfered',capFinish,capPolish:false}),'room');if(actual.toDataURL()!==expected.toDataURL())throw Error('Wrong profile panel '+label);results[capFinish]={cssWidth:actual.getBoundingClientRect().width,width:actual.width}}return results})()`,
  )
  assert.equal(report.ui.soft.cssWidth, 400)
  assert.equal(report.ui.cut.cssWidth, 400)
  report.ui.prominentEntry = true
  report.ui.samePageSharedUrl = true
  const downloads = path.resolve('apps/dungeon-atelier/.quasar/chamfer-downloads-' + Date.now())
  fs.mkdirSync(downloads, { recursive: true })
  await browser.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads })
  await browser.evaluate(
    `([...document.querySelectorAll('button')].find(n=>n.textContent.trim()==='Save comparison PNG')).click()`,
  )
  const filename = path.join(
    downloads,
    'visual-foundation-ruins-refined-room-chamfer-comparison.png',
  )
  await poll(() => fs.existsSync(filename), 'Labeled comparison export')
  const png = fs.readFileSync(filename)
  assert.equal(png.readUInt32BE(16), 1632)
  assert.equal(png.readUInt32BE(20), 844)
  report.ui.exportContainsBothPanels = await browser.evaluate(
    `(async()=>{const image=new Image();image.src='data:image/png;base64,${png.toString('base64')}';await image.decode();for(const [x,label]of [[0,'Candidate artwork'],[832,'Chamfered cap artwork']]){const actual=document.querySelector('canvas[aria-label="'+label+'"]'),c=document.createElement('canvas');c.width=actual.width;c.height=actual.height;c.getContext('2d').drawImage(image,x,64,c.width,c.height,0,0,c.width,c.height);if(c.toDataURL()!==actual.toDataURL())throw Error('Export omitted '+label)}return true})()`,
  )
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
    fs.writeFileSync(
      path.join(output, 'review-' + width + '.png'),
      Buffer.from(shot.data, 'base64'),
    )
  }
  assert.deepEqual(browser.errors, [])
  report.runtimeErrors = browser.errors
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
