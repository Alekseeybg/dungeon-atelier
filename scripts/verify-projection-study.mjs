import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { format, resolveConfig } from 'prettier'
import { browserSession, poll, browserProfileRoot } from '../tests/helpers/browser.mjs'

fs.mkdirSync(browserProfileRoot, { recursive: true })
const output = path.resolve('reports/projection-study'),
  downloads = fs.mkdtempSync(path.join(browserProfileRoot, 'projection-export-')),
  browser = await browserSession('http://localhost:9000')
fs.mkdirSync(output, { recursive: true })
const evaluate = browser.evaluate,
  ready = () =>
    poll(
      () =>
        evaluate(`!!document.querySelector('[data-projection-card] canvas') &&
    !document.querySelector('[aria-label="Rendering projection previews"]')`),
      'Projection previews',
    ),
  shot = async (name) =>
    fs.writeFileSync(
      path.join(output, name + '.png'),
      Buffer.from((await browser.send('Page.captureScreenshot', { format: 'png' })).data, 'base64'),
    )
async function choose(label, value) {
  await evaluate(`document.querySelector('[aria-label=${JSON.stringify(label)}]').click()`)
  await poll(
    () =>
      evaluate(`(()=>{const n=[...document.querySelectorAll('[role="option"]')]
    .find(n=>n.textContent.trim()===${JSON.stringify(value)});if(!n)return false;n.click();return true})()`),
    value,
  )
  await ready()
}
try {
  const technical = await evaluate(`(async()=>{
    const base='/src/features/dungeon/rendering/',v=base+'visual-foundation/',
      r=await import(v+'renderer.ts'),m=await import(v+'model.ts'),s=await import(v+'finishing-scene.ts'),
      a=await import(base+'ancient-settings.ts'),g=await import(base+'architecture-model.ts'),
      p=await import(v+'projection-study.ts'),rotation=await import(v+'view-angle.ts'),
      hash=c=>{let h=2166136261;for(const x of c.getContext('2d').getImageData(0,0,c.width,c.height).data)h=Math.imul(h^x,16777619);return(h>>>0).toString(16)},
      scene=s.createFinishingScene(),before=JSON.stringify(scene),options=a.ancientOptions(a.DEFAULT_ANCIENT),
      initial=await r.composeFoundation(scene,options),baseline=hash(initial.image),cases=[];
    const baselineView=p.cropProjectionStudy(initial.image,'room',0),baselineViewHash=hash(baselineView);baselineView.width=baselineView.height=1;
    initial.dispose();
    for(const angle of p.VIEW_ANGLES)for(const rise of p.UPWARD_SHIFTS){
      const projection=rotation.projectionBeforeTurn({side:6,rise},angle),
        frame=await r.composeFoundation(scene,{...options,projection}),room=p.cropProjectionStudy(frame.image,'room',angle),h=hash(room);
      room.width=room.height=1;
      for(const view of p.PROJECTION_VIEWS){const crop=p.cropProjectionStudy(frame.image,view.value,angle);if(!crop.width||!crop.height)throw Error('Empty crop '+view.value);if(crop!==frame.image)crop.width=crop.height=1}
      cases.push({angle,rise,hash:h});frame.dispose();
    }
    if(new Set(cases.map(c=>c.hash)).size!==16)throw Error('Projection variants do not all differ');
    if(cases.find(c=>c.angle===0&&c.rise===24).hash!==baselineViewHash)throw Error('Explicit default changes production pixels');
    const source=s.createFinishingScene(true),sealed=structuredClone(source),secretBefore=JSON.stringify(source);
    sealed.floor=g.concealSecretArchitecture(sealed.floor);
    for(const candidate of [{angle:0,rise:20},{angle:15,rise:32}]){
      const projection=rotation.projectionBeforeTurn({side:6,rise:candidate.rise},candidate.angle);
      const hidden=await r.composeFoundation(source,{...options,projection,secret:'hidden'}),
        twin=await r.composeFoundation(sealed,{...options,projection,secret:'revealed'}),
        revealed=await r.composeFoundation(source,{...options,projection,secret:'revealed'});
      if(hash(hidden.image)!==hash(twin.image))throw Error('Secret leaks at '+JSON.stringify(projection));
      if(hash(hidden.image)===hash(revealed.image))throw Error('Secret reveal missing');
      hidden.dispose();twin.dispose();revealed.dispose();
    }
    const final=await r.composeFoundation(scene,options),finalHash=hash(final.image);final.dispose();
    if(finalHash!==baseline||m.FOUNDATION.side!==6||m.FOUNDATION.rise!==24)throw Error('Study altered defaults');
    if(before!==JSON.stringify(scene)||secretBefore!==JSON.stringify(source))throw Error('Scene mutated');
    let rejected=false;try{await r.renderFoundation({projection:{side:Infinity,rise:24}})}catch{rejected=true}
    if(!rejected)throw Error('Invalid projection accepted');
    return {cases,baseline,productionUnchanged:true,secretConcealment:true,sourceUnchanged:true,allDetailCrops:true,invalidProjectionRejected:true};
  })()`)
  await browser.send('Page.navigate', {
    url: 'http://localhost:9000/#/visual-foundation/projection',
  })
  await ready()
  assert.deepEqual(
    await evaluate(
      `[...document.querySelectorAll('[data-projection-card]')].map(n=>n.dataset.projectionCard)`,
    ),
    ['angle-0', 'angle-5', 'angle-10', 'angle-15'],
  )
  await shot('view-angle-comparison')
  await choose('Projection comparison', 'Compare wall heights')
  assert.deepEqual(
    await evaluate(
      `[...document.querySelectorAll('[data-projection-card]')].map(n=>n.dataset.projectionCard)`,
    ),
    ['height-20', 'height-24', 'height-28', 'height-32'],
  )
  await evaluate(
    `document.querySelector('[aria-label="Projection view angle"]').querySelectorAll('button')[3].click()`,
  )
  await ready()
  await shot('height-comparison')
  await evaluate(
    `document.querySelector('[aria-label="Compare 15 degrees 32 upward with current"]').click()`,
  )
  await ready()
  assert.deepEqual(
    await evaluate(
      `[...document.querySelectorAll('[data-projection-card]')].map(n=>n.dataset.projectionCard)`,
    ),
    ['reference', 'selected'],
  )
  const hashes = () =>
    evaluate(
      `(()=>{let result=[];for(const c of document.querySelectorAll('[data-projection-card] canvas')){let h=2166136261;for(const b of c.getContext('2d').getImageData(0,0,c.width,c.height).data)h=Math.imul(h^b,16777619);result.push(h>>>0)}return result})()`,
    )
  const closed = await hashes()
  await evaluate(`document.querySelector('[aria-label="Projection open doors"]').click()`)
  await ready()
  assert.notDeepEqual(await hashes(), closed)
  for (const label of ['Projection lighting', 'Projection grid']) {
    const before = await hashes()
    await evaluate(`document.querySelector('[aria-label=${JSON.stringify(label)}]').click()`)
    await ready()
    assert.notDeepEqual(await hashes(), before)
  }
  await choose('Projection view', 'North / south door close-ups')
  await choose('Projection secret', 'Concealed secret')
  const hidden = await hashes()
  await choose('Projection secret', 'Revealed secret')
  assert.notDeepEqual(await hashes(), hidden)
  await choose('Projection view', 'Four-door room')
  await shot('current-vs-taller')
  await browser.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads })
  await evaluate(
    `document.querySelectorAll('button').forEach(n=>{if(n.textContent.includes('Save comparison PNG'))n.click()})`,
  )
  const file = await poll(
    () => fs.readdirSync(downloads).find((f) => f.endsWith('.png')),
    'Comparison PNG',
  )
  const png = fs.readFileSync(path.join(downloads, file))
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a')
  assert(png.readUInt32BE(16) > 1000)
  await browser.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: false,
  })
  await ready()
  assert(
    await evaluate(`document.documentElement.scrollWidth <= innerWidth`),
    'Mobile page overflows horizontally',
  )
  await shot('mobile')
  await evaluate(
    `document.querySelectorAll('button').forEach(n=>{if(n.textContent.includes('Reset preview'))n.click()})`,
  )
  await ready()
  assert.equal(await evaluate(`document.querySelectorAll('[data-projection-card]').length`), 4)
  await browser.send('Page.navigate', { url: 'http://localhost:9000' })
  await poll(() => evaluate(`!!document.querySelector('.dungeon-canvas')`), 'Return to editor')
  assert.deepEqual(browser.errors, [])
  const report = {
    passed: true,
    ...technical,
    controls: true,
    pngExport: true,
    responsive: true,
    editorReturn: true,
  }
  fs.writeFileSync(
    path.join(output, 'report.json'),
    await format(JSON.stringify(report), {
      ...(await resolveConfig('package.json')),
      parser: 'json',
    }),
  )
  console.log(
    `Projection study passed: ${technical.cases.length} combinations, controls, secret concealment, export, responsive layout, and unchanged production pixels.`,
  )
} finally {
  await browser.close()
  fs.rmSync(downloads, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
}
