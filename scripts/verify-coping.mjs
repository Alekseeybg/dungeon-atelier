import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { format, resolveConfig } from 'prettier'
import { browserSession, poll } from '../tests/helpers/browser.mjs'
const output = path.resolve('reports/visual-foundation/coping')
fs.mkdirSync(output, { recursive: true })
const report = { families: {}, floorArtwork: {} }
const floorBaseline = JSON.parse(
  fs.readFileSync(
    'apps/dungeon-atelier/src/assets/visual-foundation/coping-floor-preservation.json',
    'utf8',
  ),
)
for (const [filename, expected] of Object.entries(floorBaseline)) {
  const hash = createHash('sha256')
    .update(
      fs.readFileSync(path.join('apps/dungeon-atelier/src/assets/visual-foundation', filename)),
    )
    .digest('hex')
    .toUpperCase()
  assert.equal(hash, expected)
  report.floorArtwork[filename] = { sha256: hash, unchanged: true }
}
assert.equal(Object.keys(report.floorArtwork).length, 7)
const browser = await browserSession('http://localhost:9000')
try {
  await browser.evaluate(`(async()=>{
    const r=await import('/src/features/dungeon/rendering/visual-foundation/renderer.ts'),m=await import('/src/features/dungeon/rendering/visual-foundation/model.ts'),c=await import('/src/features/dungeon/rendering/visual-foundation/comparison.ts'),a=await import('/src/features/dungeon/rendering/visual-foundation/coping-art.ts');
    const bytes=c=>c.getContext('2d').getImageData(0,0,c.width,c.height).data,hash=c=>{let h=2166136261;for(const v of bytes(c))h=Math.imul(h^v,16777619);return(h>>>0).toString(16)},png=c=>c.toDataURL().split(',')[1],sheet=(images,labels,scale=1)=>{const width=images[0].width*scale,height=images[0].height*scale,result=document.createElement('canvas');result.width=(width+16)*images.length-16;result.height=height+44;const c=result.getContext('2d');c.fillStyle='#080d10';c.fillRect(0,0,result.width,result.height);c.fillStyle='#e8dac0';c.font='18px sans-serif';images.forEach((image,i)=>{c.fillText(labels[i],i*(width+16)+10,28);c.drawImage(image,i*(width+16),44,width,height)});return result};
    window.copingProof={r,m,c,a,bytes,hash,png,sheet,source:m.createFoundationScene()};copingProof.before=JSON.stringify(copingProof.source)
  })()`)
  for (const treatment of ['ruins', 'fortress']) {
    const proof = await browser.evaluate(`(async()=>{
      const p=copingProof,options={treatment:${JSON.stringify(treatment)},capPolish:false},art=await p.a.loadCopingArt(options.treatment),baseline=await p.r.renderFoundation(options),baselineAtlas=await p.r.foundationAtlas(options),base=p.bytes(baselineAtlas),inventory=await p.r.foundationInventory(options),contact=await p.r.foundationContact(options),results={};
      p.images={};p.options=options;
      for(const coping of ['current','hewn','broken']){
        const o={...options,coping},image=await p.r.renderFoundation(o,p.source),again=await p.r.renderFoundation(o,p.source),atlas=await p.r.foundationAtlas(o),data=p.bytes(atlas);
        if(p.hash(image)!==p.hash(again))throw Error('Nondeterministic coping');
        if(p.hash(await p.r.foundationContact(o))!==p.hash(contact))throw Error('Floor contact changed');
        let changed=0,alphaChanges=0;
        for(let i=0;i<data.length;i+=4){const y=Math.floor(i/4/atlas.width)%120;if(y>=76&&(data[i]!==base[i]||data[i+1]!==base[i+1]||data[i+2]!==base[i+2]||data[i+3]!==base[i+3]))throw Error('Face below coping lip / door pixels changed');if(data[i]!==base[i]||data[i+1]!==base[i+1]||data[i+2]!==base[i+2])changed++;if(data[i+3]!==base[i+3])alphaChanges++}
        const crop=c=>{const result=document.createElement('canvas');result.width=result.height=128;result.getContext('2d').drawImage(c,32*2+10*64,32*2+10*52,128,128,0,0,128,128);return p.hash(result)};
        if(crop(image)!==crop(baseline))throw Error('Interior floor changed');
        if(coping!=='current'&&(changed<10000||alphaChanges<1000))throw Error('Treatment does not change actual cap silhouette');
        results[coping]={hash:p.hash(image),changedArchitecturalPixels:changed,changedCoveragePixels:alphaChanges,floorInteriorIdentical:true,floorContactIdentical:true,lowerFacesAndDoorLeavesIdentical:true};p.images[coping]=image
      }
      if(p.before!==JSON.stringify(p.source))throw Error('Fixture changed');
      return{...results,art:{width:art.width,height:art.height,stoneCount:art.stones.length},geometryIds:inventory.geometryIds,projection:p.m.FOUNDATION,fixtureUnchanged:true}
    })()`)
    report.families[treatment] = proof
    const connections = await browser.evaluate(`(async()=>{
      const p=copingProof,q=await import('/src/features/dungeon/rendering/visual-foundation/coping-coupon.ts'),d=await import('/src/features/dungeon/rendering/architecture-model.ts'),m=await import('/src/features/dungeon/rendering/visual-foundation/coping-model.ts'),r=await import('/src/features/dungeon/rendering/visual-foundation/coping-renderer.ts'),source=q.createCopingCoupon(),before=JSON.stringify(source),plan=d.createArchitecturePlan(source.floor,{}),nodes=plan.walls.map(w=>({x:w.x,y:w.y,mask:w.mask,corner:w.cornerFill})),lookup=new Map(nodes.map(n=>[n.x+','+n.y,n])),art=await p.a.loadCopingArt(${JSON.stringify(treatment)}),results={};
      if(!nodes.some(n=>n.mask===15))throw Error('Coupon lacks cross intersection');
      for(const study of ['hewn','broken']){
        const blocks=m.copingBlocks(nodes,study),surface=r.buildCopingSurface(nodes,blocks,art,study),image=surface.top,c=image.getContext('2d');
        const alpha=(x,y)=>c.getImageData(Math.floor((x+surface.padding)*2),Math.floor((y+surface.padding)*2),1,1).data[3];let joins=0;
        for(const node of nodes)for(const [dx,dy,bit,opposite]of [[1,0,2,8],[0,1,4,1]]){const neighbor=lookup.get((node.x+dx)+','+(node.y+dy));if(!(node.mask&bit)||!neighbor||!(neighbor.mask&opposite))continue;for(const offset of [-5,0,5])for(const side of [-.125,.125]){const x=node.x*32+(dx?32+side:16+offset),y=node.y*32+(dy?32+side:16+offset);if(alpha(x,y)<250)throw Error('Open cap seam at '+node.x+','+node.y+' '+study)}joins++}
        const straight=Array.from({length:10},(_,i)=>({x:i+2,y:3,mask:10,corner:0})),stones=m.copingBlocks(straight,study),field=r.buildCopingSurface(straight,stones,art,study,false),a=field.top,b=document.createElement('canvas');b.width=a.width;b.height=a.height;const cb=b.getContext('2d');cb.scale(2,2);cb.translate(field.padding,field.padding);cb.fillStyle='#292b28';cb.fillRect(64,102,320,20);for(const stone of stones)cb.drawImage(art.stones[stone.image],stone.x,stone.y,stone.width,stone.height);if(p.hash(a)!==p.hash(b))throw Error('Top field differs from continuous stone assembly');
        const sliced=document.createElement('canvas');sliced.width=a.width;sliced.height=a.height;const slice=sliced.getContext('2d');for(const node of straight){const x=(node.x*32+field.padding)*2,y=(node.y*32+field.padding)*2;slice.drawImage(a,x,y,64,64,x,y,64,64)}if(p.hash(sliced)!==p.hash(a))throw Error('Atlas slicing introduced a cap seam');
        results[study]={connectedJoins:joins,centerBandOpaque:true,straightRunMatchesUnclippedAssembly:true,tileSlicesMatchContinuousField:true};image.width=image.height=surface.rim.width=surface.rim.height=1
      }
      p.coupon=source;if(before!==JSON.stringify(source))throw Error('Coupon mutated');return{...results,crossIntersection:true}
    })()`)
    report.families[treatment].connections = connections
    for (const lighting of [true, false])
      for (const view of [
        'room',
        'wall-detail',
        'east-wall',
        'south-east',
        'coping-edge',
        'doors-ns',
        'doors-ew',
        'architecture',
        'scene',
      ]) {
        const png = await browser.evaluate(
          `(async()=>{const p=copingProof,images=[];for(const coping of ['current','hewn','broken'])images.push(p.c.cropCoping(await p.r.renderFoundation({...p.options,coping,lighting:${lighting}}),${JSON.stringify(view)}));return p.png(p.sheet(images,['Current cap','Heavy hewn coping','Broken ancient slabs'],${view === 'room' || view === 'coping-edge' ? 0.5 : 1}))})()`,
        )
        fs.writeFileSync(
          path.join(output, `${treatment}-${view}-${lighting ? 'lit' : 'unlit'}.png`),
          Buffer.from(png, 'base64'),
        )
      }
    const coupon = await browser.evaluate(
      `(async()=>{const p=copingProof,images=[];for(const coping of ['current','hewn','broken'])images.push(await p.r.renderFoundation({...p.options,coping,lighting:false},p.coupon));return p.png(p.sheet(images,['Current · connection coupon','Hewn · connection coupon','Broken · connection coupon'],.5))})()`,
    )
    fs.writeFileSync(
      path.join(output, `${treatment}-connections.png`),
      Buffer.from(coupon, 'base64'),
    )
    console.log(treatment + ': three cap treatments captured')
  }
  assert.equal(report.families.ruins.current.hash, '45bcf9c0')
  await browser.send('Page.navigate', { url: 'http://localhost:9000/#/visual-foundation' })
  await poll(
    () =>
      browser.evaluate(
        `document.querySelector('canvas[aria-label="Candidate artwork"]')?.width===832&&!document.querySelector('.q-spinner')`,
      ),
    'Four-door review',
  )
  await browser.evaluate(
    `document.querySelector('[aria-label="Foundation coping comparison"]').click()`,
  )
  const ready = () =>
    browser.evaluate(
      `document.querySelector('canvas[aria-label="Hewn coping artwork"]')?.width===800&&document.querySelector('canvas[aria-label="Broken coping artwork"]')?.width===800&&!document.querySelector('.q-spinner')`,
    )
  await poll(ready, 'Three cap panels')
  const ui = await browser.evaluate(
    `(async()=>{const p=copingProof,results={};for(const [coping,label]of [['current','Candidate artwork'],['hewn','Hewn coping artwork'],['broken','Broken coping artwork']]){const actual=document.querySelector('canvas[aria-label="'+label+'"]'),expected=p.c.cropCoping(await p.r.renderFoundation({coping,capPolish:false}),'room');if(p.hash(actual)!==p.hash(expected))throw Error('Incorrect comparison panel '+coping);results[coping]={width:actual.width,cssWidth:actual.getBoundingClientRect().width}}return results})()`,
  )
  for (const panel of Object.values(ui)) assert.equal(panel.cssWidth, 400)
  report.ui = ui
  await browser.evaluate(
    `document.querySelector('[aria-label="Foundation coping zoom"] button:last-child').click()`,
  )
  await poll(
    () =>
      browser.evaluate(
        `document.querySelector('canvas[aria-label="Candidate artwork"]').getBoundingClientRect().width>400&&!document.querySelector('.q-spinner')`,
      ),
    'Enlarged review',
  )
  const layouts = []
  await browser.evaluate(
    `document.querySelector('[aria-label="Foundation coping zoom"] button:first-child').click()`,
  )
  await poll(
    () =>
      browser.evaluate(
        `document.querySelector('canvas[aria-label="Candidate artwork"]').getBoundingClientRect().width===400&&!document.querySelector('.q-spinner')`,
      ),
    'Normal review restored',
  )
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
    layouts.push({ ...metrics, height, dpr })
    const shot = await browser.send('Page.captureScreenshot', { format: 'png' })
    fs.writeFileSync(path.join(output, `review-${width}.png`), Buffer.from(shot.data, 'base64'))
  }
  report.layouts = layouts
  await browser.send('Page.navigate', {
    url: 'http://localhost:9000/#/visual-foundation?coping=compare',
  })
  await browser.send('Page.reload')
  await poll(ready, 'Direct comparison URL')
  report.directComparisonUrl = true
  assert.deepEqual(browser.errors, [])
  report.runtimeErrors = browser.errors
  report.scope =
    'Four-door architectural review only. No production renderer rollout. Source floors preserved.'
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
