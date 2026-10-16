import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { browserSession, poll } from '../tests/helpers/browser.mjs'

const output = path.resolve('reports/visual-foundation/stair-direction')
fs.mkdirSync(output, { recursive: true })
const save = (name, png) =>
  fs.writeFileSync(path.join(output, name + '.png'), Buffer.from(png, 'base64'))
const browser = await browserSession('http://localhost:9000')
try {
  const report = await browser.evaluate(`(async()=>{
    const base='/src/features/dungeon/rendering/visual-foundation/',
      r=await import(base+'renderer.ts'),s=await import(base+'finishing-scene.ts'),
      p=await import(base+'final-style.ts'),v=await import(base+'finishing-comparison.ts'),
      m=await import(base+'finishing-model.ts'),source=s.createFinishingScene(),immutable=JSON.stringify(source),
      png=c=>c.toDataURL().split(',')[1],hash=c=>{let h=2166136261;for(const x of c.getContext('2d').getImageData(0,0,c.width,c.height).data)h=Math.imul(h^x,16777619);return(h>>>0).toString(16)},
      normal=source=>{const c=document.createElement('canvas');c.width=source.width/2;c.height=source.height/2;c.getContext('2d').drawImage(source,0,0,c.width,c.height);return c},
      previous=await r.renderFoundation({...p.FINAL_FOUNDATION,stairArrow:'none'},source),
      images={};
    for(const {value}of m.STAIR_ARROWS){images[value]=await r.renderFoundation({...p.FINAL_FOUNDATION,stairArrow:value},source);if(hash(images[value])!==hash(await r.renderFoundation({...p.FINAL_FOUNDATION,stairArrow:value},source)))throw Error('Unstable stair material')}
    const a=previous.getContext('2d').getImageData(0,0,previous.width,previous.height).data,b=images.brass.getContext('2d').getImageData(0,0,previous.width,previous.height).data;
    const markers=source.floor.stairs.map(stair=>m.stairMarkerPlacement(source.floor,stair));
    let changed=0;for(let i=0;i<a.length;i+=4){if(a.slice(i,i+4).every((v,j)=>v===b[i+j]))continue;changed++;const x=(i/4)%previous.width,y=Math.floor(i/4/previous.width);if(!markers.some(box=>x>=(32+box.x-2)*2&&x<(32+box.x+box.width+2)*2&&y>=(32+box.y*.8125-2)*2&&y<(32+(box.y+box.height)*.8125+2)*2))throw Error('Changed pixels outside adjacent plaques: '+x+','+y)}
    if(!changed)throw Error('Stairs unchanged');if(JSON.stringify(source)!==immutable)throw Error('Scene mutated');
    const down=source.floor.stairs.find(s=>s.direction==='down');if(JSON.stringify(m.stairTreads(down))!==JSON.stringify(m.stairTreads(down,'ascending')))throw Error('Down well geometry changed');
    window.stairProof={r,p,v,m,source,png,hash,normal,previous,images};
    return{styles:m.STAIR_ARROWS,deterministic:true,onlyAdjacentMarkerPixelsChanged:true,stairArtworkExactPixels:true,changedPixels:changed,downWellGeometryUnchanged:true,sceneUnchanged:true,recommendation:'brass',upRisePixels:16}
  })()`)
  for (const style of ['brass', 'stone', 'iron']) {
    save(
      style + '-stairs',
      await browser.evaluate(
        `stairProof.png(stairProof.v.cropFinishing(stairProof.images.${style},'stairs'))`,
      ),
    )
    save(
      style + '-room-normal',
      await browser.evaluate(
        `stairProof.png(stairProof.normal(stairProof.v.cropFinishing(stairProof.images.${style},'room')))`,
      ),
    )
  }
  for (const [name, view, normal] of [
    ['arrow-options', 'stairs', false],
    ['normal-zoom-options', 'room', true],
  ]) {
    save(
      name,
      await browser.evaluate(
        `(()=>{const p=stairProof,panels=p.m.STAIR_ARROWS.map(s=>({label:s.label,image:${normal ? 'p.normal(p.v.cropFinishing(p.images[s.value],"room"))' : 'p.v.cropFinishing(p.images[s.value],"stairs")'}})),out=document.createElement('canvas'),w=panels[0].image.width;out.width=w*3+32;out.height=panels[0].image.height+44;const c=out.getContext('2d');c.fillStyle='#080d10';c.fillRect(0,0,out.width,out.height);c.font='17px sans-serif';panels.forEach((p,i)=>{c.fillStyle='#dfd4bd';c.fillText(p.label,(w+16)*i+8,28);c.drawImage(p.image,(w+16)*i,44)});return p.png(out)})()`,
      ),
    )
  }
  save(
    'before-after',
    await browser.evaluate(
      `(()=>{const p=stairProof,a=p.v.cropFinishing(p.previous,'stairs'),b=p.v.cropFinishing(p.images.brass,'stairs'),out=document.createElement('canvas');out.width=a.width*2+16;out.height=a.height+44;const c=out.getContext('2d');c.fillStyle='#080d10';c.fillRect(0,0,out.width,out.height);c.font='17px sans-serif';c.fillStyle='#dfd4bd';c.fillText('Staircases without symbols',8,28);c.fillText('Matching level symbols beside the stairs',a.width+24,28);c.drawImage(a,0,44);c.drawImage(b,a.width+16,44);return p.png(out)})()`,
    ),
  )
  await browser.send('Page.navigate', {
    url: 'http://localhost:9000/#/visual-foundation/final-polish?view=stairs&compare=stairs',
  })
  await poll(
    () =>
      browser.evaluate(
        `!!document.querySelector('canvas[aria-label="Previous torch presentation"]')&&!document.querySelector('.q-spinner')`,
      ),
    'Stair comparison ready',
  )
  for (const { value, label } of report.styles) {
    await browser.evaluate(`document.querySelector('[aria-label="Stair arrow style"]').click()`)
    await poll(
      () =>
        browser.evaluate(
          `(()=>{const n=[...document.querySelectorAll('[role="option"]')].find(n=>n.textContent.trim()===${JSON.stringify(label)});if(!n)return false;n.click();return true})()`,
        ),
      'Select ' + label,
    )
    await poll(
      () =>
        browser.evaluate(
          `(()=>{const p=stairProof,c=document.querySelector('canvas[aria-label="Final details artwork"]');return !document.querySelector('.q-spinner')&&c?.toDataURL()===p.v.cropFinishing(p.images.${value},'stairs').toDataURL()})()`,
        ),
      'Selected level symbol artwork',
    )
    assert(
      await browser.evaluate(
        `document.querySelector('canvas[aria-label="Previous torch presentation"]').toDataURL()===stairProof.v.cropFinishing(stairProof.previous,'stairs').toDataURL()`,
      ),
    )
  }
  report.uiThreeStylesAndBeforeAfter = true
  assert.deepEqual(browser.errors, [])
  report.runtimeErrors = browser.errors
  report.overlays = await browser.evaluate(
    `[...document.querySelectorAll('vite-error-overlay,vite-plugin-checker-error-overlay')].map(e=>e.shadowRoot?.querySelector('main')?.innerText||'').filter(Boolean)`,
  )
  assert.deepEqual(report.overlays, [])
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify({ passed: true, ...report }, null, 2))
} finally {
  browser.close()
}
