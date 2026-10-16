import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { format, resolveConfig } from 'prettier'
import { browserSession, poll } from '../tests/helpers/browser.mjs'

const output = path.resolve('reports/visual-foundation/readability')
fs.mkdirSync(output, { recursive: true })
const browser = await browserSession('http://localhost:9000')
try {
  const report = await browser.evaluate(`(async()=>{
    const r=await import('/src/features/dungeon/rendering/visual-foundation/renderer.ts'),
      m=await import('/src/features/dungeon/rendering/visual-foundation/model.ts'),
      c=await import('/src/features/dungeon/rendering/visual-foundation/comparison.ts'),
      a=await import('/src/features/dungeon/rendering/visual-foundation/art.ts')
    const source=m.createFoundationScene(),before=JSON.stringify(source),variants={}
    const gray=image=>{const d=image.getContext('2d').getImageData(0,0,image.width,image.height).data;let sum=0;for(let i=0;i<d.length;i+=4)sum+=.2126*d[i]+.7152*d[i+1]+.0722*d[i+2];return sum/(d.length/4)}
    const patch=(image,x,y,w,h)=>{const p=document.createElement('canvas');p.width=w*2;p.height=h*2;p.getContext('2d').drawImage(image,(32+x)*2,(32+y)*2,w*2,h*2,0,0,w*2,h*2);return p}
    window.readabilityProof={r,m,c,images:{}}
    for(const treatment of ['ruins','fortress','original']){
      const raw=await r.renderFoundation({treatment,separation:false},source),image=await r.renderFoundation({treatment},source),unlit=await r.renderFoundation({treatment,lighting:false},source)
      const p=patch(raw,8*32,8*26,7*32,7*26),q=patch(image,8*32,8*26,7*32,7*26)
      const x=p.getContext('2d').getImageData(0,0,p.width,p.height).data,y=q.getContext('2d').getImageData(0,0,q.width,q.height).data
      if(x.some((v,i)=>v!==y[i]))throw Error('Interior floor changed: '+treatment)
      const samples={floor:[],cap:[],face:[]}
      for(const row of [8,9,10,12,13,14]){
        samples.floor.push(gray(patch(unlit,14*32+10,row*26+9,8,8)))
        samples.cap.push(gray(patch(unlit,16*32+7,row*26-14,8,8)))
        const point=m.project(16*32+26,row*32+16,.5)
        samples.face.push(gray(patch(unlit,point.x-.5,point.y-1,1,2)))
      }
      const values=Object.fromEntries(Object.entries(samples).map(([key,list])=>[key,list.reduce((a,b)=>a+b)/list.length]))
      if(!(values.cap>values.floor+10&&values.floor>values.face+15))throw Error('Planes merged: '+treatment+' '+JSON.stringify(values))
      const contact=await r.foundationContact({treatment}),cc=contact.getContext('2d')
      const alpha=(x,y)=>cc.getImageData(Math.round((32+x)*2),Math.round((32+y)*2),1,1).data[3]
      const contacts={east:alpha(511,9*26),south:alpha(10*32,396),west:alpha(219,9*26),north:alpha(10*32,178),southEast:alpha(511,396),interior:alpha(12*32,12*26)}
      if(Object.entries(contacts).some(([side,v])=>side==='interior'?v!==0:v<25))throw Error('Missing contact: '+treatment+' '+JSON.stringify(contacts))
      const material=await a.loadFoundationArt(treatment)
      const swatch=document.createElement('canvas');swatch.width=swatch.height=4;const s=swatch.getContext('2d');s.fillStyle='rgb(105,105,105)';s.fillRect(0,0,4,4)
      const neutral=await r.renderFoundation({treatment,lighting:false},source,{...material,floor:s.createPattern(swatch,'repeat')})
      const neutralMean=gray(patch(neutral,10*32,10*26,4,4))
      if(Math.abs(neutralMean-105)>.01)throw Error('Neutral floor probe did not reach renderer')
      window.readabilityProof.images[treatment+'-gray']=neutral
      window.readabilityProof.images[treatment+'-before']=raw
      window.readabilityProof.images[treatment+'-after']=image
      window.readabilityProof.images[treatment+'-unlit']=unlit
      variants[treatment]={meanUnlitSrgbLuminance:values,contactAlpha:contacts,interiorFloorPixelIdentical:true,neutralFloorProbeMean:neutralMean}
    }
    if(JSON.stringify(source)!==before)throw Error('Fixture mutated')
    return {variants,fixtureUnchanged:true,projection:m.FOUNDATION}
  })()`)
  for (const treatment of ['ruins', 'fortress', 'original'])
    for (const state of ['before', 'after', 'unlit', 'gray']) {
      const images = await browser.evaluate(
        `(()=>{const p=readabilityProof,image=p.images[${JSON.stringify(treatment + '-' + state)}],result={};for(const view of ['room','east-wall','south-east'])result[view]=p.c.cropFoundation(image,view).toDataURL().split(',')[1];return result})()`,
      )
      for (const [view, png] of Object.entries(images))
        fs.writeFileSync(
          path.join(output, treatment + '-' + view + '-' + state + '.png'),
          Buffer.from(png, 'base64'),
        )
    }
  await browser.send('Page.navigate', { url: 'http://localhost:9000/#/visual-foundation' })
  await poll(
    () =>
      browser.evaluate(
        `document.querySelector('canvas[aria-label="Candidate artwork"]')?.width===832&&!document.querySelector('.q-spinner')`,
      ),
    'Review page',
  )
  const pixels = () =>
    browser.evaluate(`document.querySelector('canvas[aria-label="Candidate artwork"]').toDataURL()`)
  const separated = await pixels()
  await browser.evaluate(`document.querySelector('[aria-label="Foundation separation"]').click()`)
  await poll(
    async () =>
      (await pixels()) !== separated &&
      !(await browser.evaluate(`!!document.querySelector('.q-spinner')`)),
    'Separation toggle off',
  )
  await browser.evaluate(`document.querySelector('[aria-label="Foundation separation"]').click()`)
  await poll(
    async () =>
      (await pixels()) === separated &&
      !(await browser.evaluate(`!!document.querySelector('.q-spinner')`)),
    'Separation toggle restored',
  )
  for (const label of ['East wall detail', 'South-east corner']) {
    await browser.evaluate(`document.querySelector('[aria-label="Foundation view"]').click()`)
    await poll(
      () =>
        browser.evaluate(
          `(()=>{const o=[...document.querySelectorAll('[role="option"]')].find(n=>n.textContent.trim()===${JSON.stringify(label)});if(!o)return false;o.click();return true})()`,
        ),
      'Detail selector',
    )
    const width = label.startsWith('East') ? 512 : 640
    await poll(
      () =>
        browser.evaluate(
          `document.querySelector('canvas[aria-label="Candidate artwork"]')?.width===${width}&&!document.querySelector('.q-spinner')`,
        ),
      'Detail render',
    )
  }
  assert.deepEqual(browser.errors, [])
  const options = await resolveConfig('package.json')
  fs.writeFileSync(
    path.join(output, 'report.json'),
    await format(
      JSON.stringify({
        testedAt: new Date().toISOString(),
        ...report,
        controls: { separation: true, eastWall: true, southEastCorner: true },
        runtimeErrors: browser.errors,
        scope: 'Four-door prototype only; no production-theme rollout',
      }),
      { ...options, parser: 'json' },
    ),
  )
  console.log(JSON.stringify({ passed: true, ...report, output }, null, 2))
} finally {
  browser.close()
}
