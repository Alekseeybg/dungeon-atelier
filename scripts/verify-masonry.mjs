import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { format, resolveConfig } from 'prettier'
import { browserSession, poll, pause } from '../tests/helpers/browser.mjs'

const output = path.resolve('reports/visual-foundation/masonry')
fs.mkdirSync(output, { recursive: true })
const browser = await browserSession('http://localhost:9000')
const prettier = await resolveConfig(path.resolve('package.json'))
try {
  const proof = await browser.evaluate(`(async()=>{
    const r=await import('/src/features/dungeon/rendering/visual-foundation/renderer.ts'),
      m=await import('/src/features/dungeon/rendering/visual-foundation/model.ts'),
      c=await import('/src/features/dungeon/rendering/visual-foundation/comparison.ts'),
      art=await import('/src/features/dungeon/rendering/visual-foundation/art.ts')
    const hash=image=>{let h=2166136261;for(const v of image.getContext('2d').getImageData(0,0,image.width,image.height).data)h=Math.imul(h^v,16777619);return(h>>>0).toString(16)}
    const source=m.createFoundationScene(),before=JSON.stringify(source),variants={},roomFloors={}
    let floorBytes
    window.masonryProof={r,m,c,hash,images:{}}
    for(const treatment of ['original','ruins','fortress']){
      const image=await r.renderFoundation({treatment},source),again=await r.renderFoundation({treatment},source)
      if(hash(image)!==hash(again))throw Error('Nondeterminism: '+treatment)
      if(JSON.stringify(source)!==before)throw Error('Scene mutation: '+treatment)
      window.masonryProof.images[treatment]=image
      const patch=document.createElement('canvas');patch.width=448;patch.height=364
      patch.getContext('2d').drawImage(image,(32+8*32)*2,(32+8*26)*2,448,364,0,0,448,364)
      const bytes=patch.getContext('2d').getImageData(0,0,448,364).data
      if(floorBytes&&bytes.some((v,i)=>v!==floorBytes[i]))throw Error('Floor pixels changed: '+treatment)
      floorBytes=bytes
      roomFloors[treatment]=hash(patch)
      const open=await r.renderFoundation({treatment,doors:'open'}),doorChanges={}
      for(const d of source.floor.doors){
        const p=m.spriteOrigin(d.position.x,d.position.y),x=(32+p.x-12)*2,y=(32+p.y-29)*2,
          a=image.getContext('2d').getImageData(x,y,100,120).data,b=open.getContext('2d').getImageData(x,y,100,120).data
        let changed=0;for(let i=0;i<a.length;i+=4)if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2])changed++
        if(changed<30)throw Error('Hidden/broken leaf: '+treatment+' '+d.id)
        doorChanges[d.id]=changed
      }
      const secret=m.createFoundationScene(true),secretBefore=JSON.stringify(secret),sealed=structuredClone(secret)
      for(const route of sealed.floor.shortcuts)for(const p of route.path)sealed.floor.tiles[p.y][p.x]='wall'
      sealed.floor.doors=sealed.floor.doors.filter(d=>d.type!=='secret');sealed.floor.shortcuts=[]
      const hidden=await r.renderFoundation({treatment,secret:'hidden'},secret),twin=await r.renderFoundation({treatment,secret:'hidden'},sealed),revealed=await r.renderFoundation({treatment,secret:'revealed'},secret)
      if(hash(hidden)!==hash(twin))throw Error('Concealment leak: '+treatment)
      if(hash(hidden)===hash(revealed))throw Error('Reveal broken: '+treatment)
      if(JSON.stringify(secret)!==secretBefore)throw Error('Secret source mutated')
      const material=await art.loadFoundationArt(treatment)
      variants[treatment]={hash:hash(image),doorChanges,sourceSizes:material.sourceSizes,opening:material.opening,concealment:'Identical to independently sealed twin'}
    }
    if(new Set(Object.values(roomFloors)).size!==1)throw Error('Floor changed between treatments')
    if(new Set(Object.values(variants).map(v=>v.hash)).size!==3)throw Error('Treatments are identical')
    return {variants,unchangedCentralFloorHashes:roomFloors,projection:m.FOUNDATION,fixtureUnchanged:true}
  })()`)
  // Keep a rendered copy of the preceding candidate for direct material comparison.
  for (const treatment of ['original', 'ruins', 'fortress']) {
    for (const [state, options] of [
      ['closed', {}],
      ['open', { doors: 'open' }],
      ['unlit', { lighting: false }],
    ]) {
      const images = await browser.evaluate(`(async()=>{
        const p=masonryProof,image=await p.r.renderFoundation({treatment:${JSON.stringify(treatment)},...${JSON.stringify(options)}}),result={}
        for(const view of ['room','doors-ns','doors-ew','architecture','wall-detail'])result[view]=p.c.cropFoundation(image,view).toDataURL().split(',')[1]
        return result
      })()`)
      for (const [view, png] of Object.entries(images))
        fs.writeFileSync(
          path.join(output, `${treatment}-${view}-${state}.png`),
          Buffer.from(png, 'base64'),
        )
    }
  }
  const comparison = await browser.evaluate(`(()=>{
    const p=masonryProof,a=p.c.cropFoundation(p.images.ruins,'room'),b=p.c.cropFoundation(p.images.fortress,'room'),image=document.createElement('canvas')
    image.width=1680;image.height=824;const c=image.getContext('2d');c.fillStyle='#080d10';c.fillRect(0,0,image.width,image.height)
    c.fillStyle='#e8dac0';c.font='20px sans-serif';c.fillText('A — Ancient Ruined Dungeon',16,28);c.fillText('B — Medieval Fortress',864,28)
    c.drawImage(a,0,44);c.drawImage(b,848,44);return image.toDataURL().split(',')[1]
  })()`)
  fs.writeFileSync(path.join(output, 'comparison-a-b.png'), Buffer.from(comparison, 'base64'))
  const details = await browser.evaluate(`(()=>{
    const p=masonryProof,image=document.createElement('canvas');image.width=1552;image.height=1264
    const c=image.getContext('2d');c.fillStyle='#080d10';c.fillRect(0,0,image.width,image.height);c.fillStyle='#e8dac0';c.font='20px sans-serif'
    c.fillText('A — Ancient Ruined Dungeon',16,28);c.fillText('B — Medieval Fortress',800,28)
    let y=64
    for(const [view,label]of[['doors-ns','North / south doorways'],['doors-ew','East / west doorways'],['wall-detail','Corner / wall face']]){
      for(const [i,treatment]of ['ruins','fortress'].entries()){
        const detail=p.c.cropFoundation(p.images[treatment],view)
        c.fillText(label,i*784+16,y);c.drawImage(detail,i*784+(768-detail.width)/2,y+16)
      }
      y+=view==='wall-detail'?424:392
    }
    return image.toDataURL().split(',')[1]
  })()`)
  fs.writeFileSync(path.join(output, 'details-a-b.png'), Buffer.from(details, 'base64'))
  await browser.send('Page.navigate', { url: 'http://localhost:9000/#/visual-foundation' })
  const ready = () =>
    browser.evaluate(
      `(()=>{const c=document.querySelector('canvas[aria-label="Candidate artwork"]');return c&&c.width===832&&!document.querySelector('.q-spinner')})()`,
    )
  await poll(ready, 'Masonry review')
  const pageHash = () =>
    browser.evaluate(
      `(()=>{const c=document.querySelector('canvas[aria-label="Candidate artwork"]');let h=2166136261;for(const v of c.getContext('2d').getImageData(0,0,c.width,c.height).data)h=Math.imul(h^v,16777619);return(h>>>0).toString(16)})()`,
    )
  async function choose(text) {
    await browser.evaluate(`document.querySelector('[aria-label="Foundation treatment"]').click()`)
    await poll(
      () =>
        browser.evaluate(
          `(()=>{const o=[...document.querySelectorAll('[role="option"]')].find(n=>n.textContent.trim()===${JSON.stringify(text)});if(!o)return false;o.click();return true})()`,
        ),
      'Treatment select',
    )
    await poll(ready, 'Treatment artwork')
  }
  const first = await pageHash()
  await choose('B · Medieval Fortress')
  await poll(async () => (await pageHash()) !== first && (await ready()), 'Fortress selected')
  await choose('A · Ancient Ruined Dungeon')
  await poll(async () => (await pageHash()) === first && (await ready()), 'Ruins restored')
  await browser.evaluate(
    `document.querySelector('[aria-label="Foundation materials comparison"]').click()`,
  )
  await poll(
    () =>
      browser.evaluate(
        `document.querySelector('canvas[aria-label="Alternate masonry artwork"]')?.width===832&&!document.querySelector('.q-spinner')`,
      ),
    'A/B comparison',
  )
  const layouts = []
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
    await pause(200)
    const metrics = await browser.evaluate(
      `({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,overlays:[...document.querySelectorAll('vite-error-overlay,vite-plugin-checker-error-overlay')].map(e=>e.shadowRoot?.querySelector('main')?.innerText||'').filter(Boolean)})`,
    )
    assert(metrics.scrollWidth <= width + 1, JSON.stringify(metrics))
    assert.deepEqual(metrics.overlays, [])
    layouts.push({ ...metrics, height, dpr })
    const shot = await browser.send('Page.captureScreenshot', { format: 'png' })
    fs.writeFileSync(path.join(output, `review-${width}.png`), Buffer.from(shot.data, 'base64'))
  }
  assert.deepEqual(browser.errors, [])
  fs.writeFileSync(
    path.join(output, 'report.json'),
    await format(
      JSON.stringify({
        testedAt: new Date().toISOString(),
        ...proof,
        layouts,
        runtimeErrors: browser.errors,
        visualApproval: 'Pending user review; isolated fixture only',
      }),
      { ...prettier, parser: 'json' },
    ),
  )
  console.log(
    JSON.stringify(
      { passed: true, variants: proof.variants, floors: proof.unchangedCentralFloorHashes, output },
      null,
      2,
    ),
  )
} finally {
  browser.close()
}
