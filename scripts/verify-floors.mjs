import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { format, resolveConfig } from 'prettier'
import { browserSession, poll } from '../tests/helpers/browser.mjs'

const output = path.resolve('reports/visual-foundation/floors')
fs.mkdirSync(output, { recursive: true })
const browser = await browserSession('http://localhost:9000')
try {
  const proof = await browser.evaluate(`(async()=>{
   const r=await import('/src/features/dungeon/rendering/visual-foundation/renderer.ts'),
     m=await import('/src/features/dungeon/rendering/visual-foundation/model.ts'),
     c=await import('/src/features/dungeon/rendering/visual-foundation/comparison.ts'),
     art=await import('/src/features/dungeon/rendering/visual-foundation/art.ts')
   const hash=image=>{let h=2166136261;for(const v of image.getContext('2d').getImageData(0,0,image.width,image.height).data)h=Math.imul(h^v,16777619);return(h>>>0).toString(16)}
   const source=m.createFoundationScene(),before=JSON.stringify(source),images={},variants={}
   let previousArchitecture,previousContact
   for(const {value:floor} of art.FLOOR_STUDIES){
     const image=await r.renderFoundation({floor},source),again=await r.renderFoundation({floor},source)
     if(hash(image)!==hash(again))throw Error('Nondeterministic floor')
     images[floor]=image
     const architecture=await r.foundationAtlas({floor}),contact=await r.foundationContact({floor})
     const bytes=c=>c.getContext('2d').getImageData(0,0,c.width,c.height).data,
       architectureBytes=bytes(architecture),contactBytes=bytes(contact)
     if(previousArchitecture&&architectureBytes.some((v,i)=>v!==previousArchitecture[i]))throw Error('Architectural pixels changed')
     if(previousContact&&contactBytes.some((v,i)=>v!==previousContact[i]))throw Error('Contact pixels changed')
     previousArchitecture=architectureBytes;previousContact=contactBytes
     variants[floor]={sceneHash:hash(image),architectureHash:hash(architecture),contactHash:hash(contact)}
   }
   if(variants.previous.sceneHash!=='c814ac4d')throw Error('Previous accepted appearance changed: '+variants.previous.sceneHash)
   if(variants.refined.sceneHash===variants.previous.sceneHash)throw Error('Floor did not change')
   if(variants.previous.architectureHash!==variants.refined.architectureHash)throw Error('Floor pass changed architectural sprites')
   if(variants.previous.contactHash!==variants.refined.contactHash)throw Error('Floor pass changed structural contact layer')
   if(before!==JSON.stringify(source))throw Error('Floor pass mutated fixture')
   if(new Set(Object.values(variants).map(v=>v.sceneHash)).size!==art.FLOOR_STUDIES.length)throw Error('Duplicate or unmapped floor study')
   window.floorProof={r,m,c,images}
   return {variants,studies:art.FLOOR_STUDIES.map(({value,label})=>({value,label})),architecturePixelIdentical:true,structuralContactPixelIdentical:true,previousAppearanceMatchesAcceptedHash:true,fixtureUnchanged:true,projection:m.FOUNDATION}
 })()`)
  for (const { value: floor } of proof.studies)
    for (const lighting of [true, false]) {
      const files = await browser.evaluate(
        `(async()=>{const p=floorProof,image=await p.r.renderFoundation({floor:${JSON.stringify(floor)},lighting:${lighting}}),result={};for(const [name,view]of [['room','room'],['floor-center','floor-center'],['floor-edge','floor-edge'],['floor-wall','south-east']])result[name]=p.c.cropFoundation(image,view).toDataURL().split(',')[1];return result})()`,
      )
      for (const [view, png] of Object.entries(files))
        fs.writeFileSync(
          path.join(output, floor + '-' + view + (lighting ? '' : '-unlit') + '.png'),
          Buffer.from(png, 'base64'),
        )
    }
  const comparison = await browser.evaluate(`(()=>{
   const p=floorProof,a=p.c.cropFoundation(p.images.previous,'room'),b=p.c.cropFoundation(p.images.refined,'room'),image=document.createElement('canvas');image.width=1680;image.height=824
   const c=image.getContext('2d');c.fillStyle='#080d10';c.fillRect(0,0,image.width,image.height);c.fillStyle='#e8dac0';c.font='20px sans-serif';c.fillText('Previous floor',16,28);c.fillText('Refined realistic floor',864,28);c.drawImage(a,0,44);c.drawImage(b,848,44);return image.toDataURL().split(',')[1]
 })()`)
  fs.writeFileSync(path.join(output, 'comparison.png'), Buffer.from(comparison, 'base64'))
  const detail = await browser.evaluate(`(()=>{
   const p=floorProof,image=document.createElement('canvas');image.width=1568;image.height=612
   const c=image.getContext('2d');c.fillStyle='#080d10';c.fillRect(0,0,image.width,image.height);c.fillStyle='#e8dac0';c.font='20px sans-serif'
   let x=0;for(const [view,label]of [['floor-center','Floor center'],['floor-edge','Floor near wall'],['south-east','Floor + wall']]){const crop=p.c.cropFoundation(p.images.refined,view);c.fillText(label,x+8,28);c.drawImage(crop,x,52);x+=crop.width+16}return image.toDataURL().split(',')[1]
 })()`)
  fs.writeFileSync(path.join(output, 'details.png'), Buffer.from(detail, 'base64'))
  await browser.send('Page.navigate', { url: 'http://localhost:9000/#/visual-foundation' })
  const ready = () =>
    browser.evaluate(
      `document.querySelector('canvas[aria-label="Candidate artwork"]')?.width===832&&!document.querySelector('.q-spinner')`,
    )
  await poll(ready, 'Floor review')
  // This regression checks the accepted floor-study baseline; cap effects have their own proof.
  await browser.evaluate(`document.querySelector('[aria-label="Foundation cap polish"]').click()`)
  await poll(
    () =>
      browser.evaluate(
        `document.querySelector('[aria-label="Foundation cap polish"]').getAttribute('aria-checked')==='false'&&!document.querySelector('.q-spinner')`,
      ),
    'Baseline caps',
  )
  const pixels = () =>
    browser.evaluate(`document.querySelector('canvas[aria-label="Candidate artwork"]').toDataURL()`)
  const initial = await pixels()
  async function choose(aria, label) {
    await poll(
      () => browser.evaluate(`document.querySelectorAll('[role="option"]').length===0`),
      'Previous select closed',
    )
    await browser.evaluate(`document.querySelector('[aria-label=${JSON.stringify(aria)}]').click()`)
    await poll(
      () =>
        browser.evaluate(
          `(()=>{const n=[...document.querySelectorAll('[role="option"]')].find(n=>(n.querySelector('.q-item__label')?.textContent||n.textContent).trim()===${JSON.stringify(label)});if(!n)return false;n.click();return true})()`,
        ),
      'Select ' + label,
    )
    await poll(
      () => browser.evaluate(`document.querySelectorAll('[role="option"]').length===0`),
      'Select closed',
    )
  }
  for (const study of proof.studies) {
    await choose('Foundation floor', study.label)
    const expected = await browser.evaluate(
      `floorProof.c.cropFoundation(floorProof.images[${JSON.stringify(study.value)}],'room').toDataURL()`,
    )
    await poll(async () => (await pixels()) === expected && (await ready()), 'Floor ' + study.value)
  }
  await choose('Foundation floor', 'Refined realistic (current)')
  await poll(async () => (await pixels()) === initial && (await ready()), 'Refined floor restored')
  await browser.evaluate(
    `document.querySelector('[aria-label="Foundation floor comparison"]').click()`,
  )
  await poll(
    () =>
      browser.evaluate(
        `document.querySelector('canvas[aria-label="Comparison floor artwork"]')?.width===832&&!document.querySelector('.q-spinner')`,
      ),
    'Comparison canvas ready',
  )
  const comparisonPixels = () =>
    browser.evaluate(
      `document.querySelector('canvas[aria-label="Comparison floor artwork"]')?.toDataURL()`,
    )
  for (const study of proof.studies) {
    await choose('Foundation comparison floor', study.label)
    const expected = await browser.evaluate(
      `floorProof.c.cropFoundation(floorProof.images[${JSON.stringify(study.value)}],'room').toDataURL()`,
    )
    await poll(
      async () => (await comparisonPixels()) === expected && (await ready()),
      'Comparison ' + study.value,
    )
    assert.equal(await pixels(), initial, 'Comparison changed primary floor')
  }
  const reference = await comparisonPixels()
  assert(
    await browser.evaluate(`!!document.querySelector('[aria-label="Swap floors"] svg')`),
    'Swap uses the bundled SVG icon',
  )
  await browser.evaluate(`document.querySelector('[aria-label="Swap floors"]').click()`)
  await poll(
    async () =>
      (await pixels()) === reference && (await comparisonPixels()) === initial && (await ready()),
    'Swap floors',
  )
  const layouts = []
  for (const [width, height, dpr] of [
    [1920, 1080, 1],
    [390, 844, 2],
  ]) {
    await browser.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: dpr,
      mobile: width < 600,
    })
    const metrics = await browser.evaluate(
      `({width:innerWidth,scrollWidth:document.documentElement.scrollWidth})`,
    )
    assert(metrics.scrollWidth <= width + 1, JSON.stringify(metrics))
    layouts.push({ ...metrics, height, dpr })
    const screenshot = await browser.send('Page.captureScreenshot', { format: 'png' })
    fs.writeFileSync(
      path.join(output, 'studies-review-' + width + '.png'),
      Buffer.from(screenshot.data, 'base64'),
    )
  }
  for (const [label, width] of [
    ['Floor center', 512],
    ['Floor near wall', 384],
  ]) {
    await browser.evaluate(`document.querySelector('[aria-label="Foundation view"]').click()`)
    await poll(
      () =>
        browser.evaluate(
          `(()=>{const n=[...document.querySelectorAll('[role="option"]')].find(n=>n.textContent.trim()===${JSON.stringify(label)});if(!n)return false;n.click();return true})()`,
        ),
      'Floor detail selector',
    )
    await poll(
      () =>
        browser.evaluate(
          `document.querySelector('canvas[aria-label="Candidate artwork"]')?.width===${width}&&!document.querySelector('.q-spinner')`,
        ),
      'Floor detail crop',
    )
  }
  assert.deepEqual(browser.errors, [])
  const options = await resolveConfig('package.json')
  fs.writeFileSync(
    path.join(output, 'report.json'),
    await format(
      JSON.stringify({
        testedAt: new Date().toISOString(),
        ...proof,
        layouts,
        controls: { allStudies: true, floorComparison: true, swap: true, center: true, edge: true },
        runtimeErrors: browser.errors,
        artApproval: 'Pending user review; realistic floor only; four-door prototype only',
      }),
      { ...options, parser: 'json' },
    ),
  )
  console.log(JSON.stringify({ passed: true, ...proof, output }, null, 2))
} finally {
  browser.close()
}
