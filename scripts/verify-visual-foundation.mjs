import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { format, resolveConfig } from 'prettier'
import { browserSession, poll, pause } from '../tests/helpers/browser.mjs'

const output = path.resolve('reports/visual-foundation')
fs.mkdirSync(output, { recursive: true })
const formatOptions = await resolveConfig(path.resolve('package.json'))
const writeJson = async (file, value) =>
  fs.writeFileSync(file, await format(JSON.stringify(value), { ...formatOptions, parser: 'json' }))
const browser = await browserSession('http://localhost:9000')
try {
  const evaluate = browser.evaluate
  const technical = await evaluate(`(async()=>{
    const r=await import('/src/features/dungeon/rendering/visual-foundation/renderer.ts'),m=await import('/src/features/dungeon/rendering/visual-foundation/model.ts'),c=await import('/src/features/dungeon/rendering/visual-foundation/comparison.ts'),a=await import('/src/features/dungeon/rendering/visual-foundation/art.ts')
    const hash=canvas=>{let v=2166136261;for(const byte of canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data)v=Math.imul(v^byte,16777619);return(v>>>0).toString(16)}
    const source=m.createFoundationScene(),before=JSON.stringify(source),closed=await r.renderFoundation({},source),again=await r.renderFoundation({},source)
    if(hash(closed)!==hash(again))throw new Error('Nondeterministic scene')
    if(before!==JSON.stringify(source))throw new Error('Rendering mutated scene')
    const open=await r.renderFoundation({doors:'open'}),changed={}
    for(const door of source.floor.doors){const p=m.spriteOrigin(door.position.x,door.position.y),x=(32+p.x-12)*2,y=(32+p.y-29)*2;const a=closed.getContext('2d').getImageData(x,y,100,120).data,b=open.getContext('2d').getImageData(x,y,100,120).data;let count=0;for(let i=0;i<a.length;i+=4)if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2])count++;if(count<30)throw new Error('Door leaf is hidden or does not change state: '+door.id);changed[door.id]=count}
    const secret=m.createFoundationScene(true),secretBefore=JSON.stringify(secret),twin=structuredClone(secret)
    for(const route of twin.floor.shortcuts)for(const p of route.path)twin.floor.tiles[p.y][p.x]='wall'
    twin.floor.doors=twin.floor.doors.filter(d=>d.type!=='secret');twin.floor.shortcuts=[]
    const concealed=await r.renderFoundation({secret:'hidden'},secret),sealed=await r.renderFoundation({secret:'hidden'},twin),revealed=await r.renderFoundation({secret:'revealed'},secret)
    if(hash(concealed)!==hash(sealed))throw new Error('Concealed secret leaks through artwork or light')
    if(hash(concealed)===hash(revealed))throw new Error('Reveal does not show secret architecture')
    if(JSON.stringify(secret)!==secretBefore)throw new Error('Secret preview mutated floor')
    const art=await a.loadFoundationArt(),alpha=art.frame.getContext('2d').getImageData(Math.floor(art.frame.width/2),Math.floor(art.frame.height*.75),1,1).data[3]
    if(alpha!==0)throw new Error('Arch opening is not transparent')
    window.foundationProof={r,m,c,a,hash,closed,open,concealed,revealed}
    return {deterministicHash:hash(closed),geometryUnchanged:true,doorStateChangedPixels:changed,concealedSecret:'Pixel-identical to independently sealed twin, including lighting',frameOpeningAlpha:alpha,dimensions:{width:closed.width,height:closed.height},inventory:await r.foundationInventory()}
  })()`)
  for (const [state, expression] of [
    ['closed', 'foundationProof.closed'],
    ['open', 'foundationProof.open'],
    ['unlit', 'await foundationProof.r.renderFoundation({lighting:false})'],
    ['grid', 'await foundationProof.r.renderFoundation({grid:true})'],
    ['secret-hidden', 'foundationProof.concealed'],
    ['secret-revealed', 'foundationProof.revealed'],
  ]) {
    const images = await evaluate(
      `(async()=>{const image=${expression},result={scene:image.toDataURL().split(',')[1]};for(const view of ['room','architecture','doors-ns','doors-ew'])result[view]=foundationProof.c.cropFoundation(image,view).toDataURL().split(',')[1];return result})()`,
    )
    for (const [view, png] of Object.entries(images))
      fs.writeFileSync(
        path.join(output, `candidate-${view}-${state}.png`),
        Buffer.from(png, 'base64'),
      )
  }
  const baseline = await evaluate(`(async()=>{
    const p=foundationProof,old=await p.c.renderFoundationBaseline(),result={}
    for(const view of ['scene','room','architecture','doors-ns','doors-ew'])result[view]=p.c.cropFoundation(old,view,true).toDataURL().split(',')[1]
    const a=p.c.cropFoundation(old,'room',true),b=p.c.cropFoundation(p.closed,'room'),image=document.createElement('canvas');image.width=a.width+b.width+24;image.height=Math.max(a.height,b.height)+44
    const c=image.getContext('2d');c.fillStyle='#10171b';c.fillRect(0,0,image.width,image.height);c.fillStyle='#e8dac0';c.font='20px sans-serif';c.fillText('Current Dimensional Stone',12,28);c.fillText('Visual foundation candidate',a.width+36,28);c.drawImage(a,0,44);c.drawImage(b,a.width+24,44);result.comparison=image.toDataURL().split(',')[1]
    return result
  })()`)
  for (const [view, png] of Object.entries(baseline))
    fs.writeFileSync(
      path.join(output, view === 'comparison' ? 'comparison-room.png' : `baseline-${view}.png`),
      Buffer.from(png, 'base64'),
    )
  const atlas = await evaluate(
    `(async()=>(await foundationProof.r.foundationAtlas()).toDataURL().split(',')[1])()`,
  )
  fs.writeFileSync(path.join(output, 'scene-atlas.png'), Buffer.from(atlas, 'base64'))
  await writeJson(path.join(output, 'scene-atlas.json'), technical.inventory)
  await browser.send('Page.navigate', { url: 'http://localhost:9000/#/visual-foundation' })
  await poll(
    () =>
      evaluate(
        `(()=>{const c=document.querySelector('canvas[aria-label="Candidate artwork"]');return c&&c.width===832&&!document.querySelector('.q-spinner')})()`,
      ),
    'Foundation page',
  )
  const pageHash = () =>
    evaluate(
      `(()=>{let h=2166136261;const c=document.querySelector('canvas[aria-label="Candidate artwork"]');for(const b of c.getContext('2d').getImageData(0,0,c.width,c.height).data)h=Math.imul(h^b,16777619);return(h>>>0).toString(16)})()`,
    )
  const initial = await pageHash()
  await evaluate(
    `document.querySelector('[aria-label="Foundation doors"]').querySelectorAll('button')[1].click()`,
  )
  await poll(
    async () =>
      (await pageHash()) !== initial && !(await evaluate("!!document.querySelector('.q-spinner')")),
    'Open control',
  )
  const openHash = await pageHash()
  await evaluate(`document.querySelector('[aria-label="Foundation lighting"]').click()`)
  await poll(
    async () =>
      (await pageHash()) !== openHash &&
      !(await evaluate("!!document.querySelector('.q-spinner')")),
    'Lighting control',
  )
  const unlitHash = await pageHash()
  await evaluate(`document.querySelector('[aria-label="Foundation grid"]').click()`)
  await poll(
    async () =>
      (await pageHash()) !== unlitHash &&
      !(await evaluate("!!document.querySelector('.q-spinner')")),
    'Grid control',
  )
  await evaluate(`document.querySelector('[aria-label="Foundation comparison"]').click()`)
  await poll(
    () =>
      evaluate(
        `!!document.querySelector('canvas[aria-label="Baseline artwork"]')&&!document.querySelector('.q-spinner')`,
      ),
    'Baseline comparison',
  )
  // Return to the default approval view before capturing the review UI.
  await evaluate('window.foundationReloadMarker=true')
  await browser.send('Page.reload')
  await poll(
    () =>
      evaluate(
        `(()=>{const c=document.querySelector('canvas[aria-label="Candidate artwork"]');return !window.foundationReloadMarker&&c&&c.width===832&&c.height===780&&!document.querySelector('.q-spinner')})()`,
      ),
    'Reload foundation',
  )
  async function choose(label, text) {
    await evaluate(`document.querySelector('[aria-label=${JSON.stringify(label)}]').click()`)
    await poll(
      () =>
        evaluate(
          `(()=>{const option=[...document.querySelectorAll('[role="option"]')].find(n=>n.textContent.trim()===${JSON.stringify(text)});if(!option)return false;option.click();return true})()`,
        ),
      'Select ' + text,
    )
  }
  await choose('Foundation view', 'East / west doors')
  await poll(
    () =>
      evaluate(
        `document.querySelector('canvas[aria-label="Candidate artwork"]').width===768&&!document.querySelector('.q-spinner')`,
      ),
    'Door profile view',
  )
  await choose('Foundation view', 'Central room')
  await poll(
    () =>
      evaluate(
        `document.querySelector('canvas[aria-label="Candidate artwork"]').width===832&&!document.querySelector('.q-spinner')`,
      ),
    'Room view',
  )
  const regularHash = await pageHash()
  await choose('Foundation secret', 'Concealed secret')
  await poll(
    async () =>
      (await pageHash()) !== regularHash &&
      !(await evaluate("!!document.querySelector('.q-spinner')")),
    'Secret control',
  )
  await choose('Foundation secret', 'Regular door')
  await poll(
    async () =>
      (await pageHash()) === regularHash &&
      !(await evaluate("!!document.querySelector('.q-spinner')")),
    'Restore regular door',
  )
  const downloads = path.resolve('apps/dungeon-atelier/.quasar/foundation-downloads-' + Date.now())
  fs.mkdirSync(downloads, { recursive: true })
  await browser.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads })
  await evaluate(
    `const button=[...document.querySelectorAll('button')].find(n=>n.textContent.includes('Save PNG'));button.click()`,
  )
  const downloaded = path.join(downloads, 'visual-foundation-ruins-refined-room-closed.png')
  await poll(() => fs.existsSync(downloaded), 'PNG export')
  const png = fs.readFileSync(downloaded)
  assert.equal(png.readUInt32BE(16), 832)
  assert.equal(png.readUInt32BE(20), 780)
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
    const metrics = await evaluate(
      `({scrollWidth:document.documentElement.scrollWidth,width:innerWidth,errors:[...document.querySelectorAll('vite-error-overlay,vite-plugin-checker-error-overlay')].map(e=>e.shadowRoot?.querySelector('main')?.innerText||'').filter(Boolean)})`,
    )
    assert(metrics.scrollWidth <= width + 1, JSON.stringify(metrics))
    assert.deepEqual(metrics.errors, [])
    layouts.push({ ...metrics, height, dpr })
    const { data } = await browser.send('Page.captureScreenshot', { format: 'png' })
    fs.writeFileSync(path.join(output, `review-${width}.png`), Buffer.from(data, 'base64'))
  }
  assert.deepEqual(browser.errors, [])
  const report = {
    testedAt: new Date().toISOString(),
    browser: await browser.send('Browser.getVersion'),
    technical,
    controls: {
      doors: true,
      lighting: true,
      grid: true,
      comparison: true,
      views: true,
      secrets: true,
      png: true,
    },
    layouts,
    runtimeErrors: browser.errors,
    visualApproval: 'Pending user review; technical checks are not art approval',
  }
  await writeJson(path.join(output, 'report.json'), report)
  console.log(
    JSON.stringify(
      {
        passed: true,
        doors: technical.doorStateChangedPixels,
        sprites: technical.inventory.spriteCount,
        geometryTypes: technical.inventory.geometryIds.length,
        layouts: layouts.length,
        output,
      },
      null,
      2,
    ),
  )
} finally {
  browser.close()
}
