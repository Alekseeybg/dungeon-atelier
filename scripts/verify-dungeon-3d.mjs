import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { format, resolveConfig } from 'prettier'
import { browserSession, poll } from '../tests/helpers/browser.mjs'
import { generatePrototypeFloor } from '../apps/dungeon-atelier/src/experiments/dungeon-3d/plan.ts'
import { stairPoint } from '../apps/dungeon-atelier/src/experiments/dungeon-3d/stair-layout.ts'

const base = process.env.ATELIER_URL ?? 'http://localhost:9001',
  output = path.resolve('reports/dungeon-3d'),
  browser = await browserSession(base),
  samples = [],
  captures = [],
  report = {}
fs.mkdirSync(output, { recursive: true })
const evaluate = browser.evaluate,
  writePNG = (name, png) => {
    fs.writeFileSync(path.join(output, name + '.png'), Buffer.from(png.split(',').at(-1), 'base64'))
    captures.push(name)
  },
  attach = () =>
    evaluate(
      `(()=>{let n=document.querySelector('.dungeon-3d-page')?.__vueParentComponent;while(n&&!n.exposed?.getPrototypeState)n=n.parent;if(!n)return false;window.threeProof=n.exposed;return true})()`,
    ),
  state = () => evaluate('threeProof.getPrototypeState()'),
  ready = () =>
    poll(async () => {
      const s = await state()
      return !s.busy && !s.error && s.metrics?.calls > 0
    }, '3D scene'),
  capture = async (name) => {
    await ready()
    writePNG(name, await evaluate('threeProof.capture3D()'))
  },
  shot = async (name) =>
    writePNG(name, (await browser.send('Page.captureScreenshot', { format: 'png' })).data)
async function choose(label, value) {
  await evaluate(`document.querySelector('[aria-label=${JSON.stringify(label)}]').click()`)
  await poll(
    () =>
      evaluate(
        `(()=>{const option=[...document.querySelectorAll('[role="option"]')].find(n=>n.textContent.trim()===${JSON.stringify(value)});if(!option)return false;option.click();return true})()`,
      ),
    value,
  )
  await ready()
}
async function slider(label, value) {
  await evaluate(
    `document.querySelector('[aria-label=${JSON.stringify(label)}]').__vueParentComponent.emit('update:modelValue',${value})`,
  )
  await ready()
  await new Promise((r) => setTimeout(r, 80))
  samples.push((await state()).metrics.renderMs)
}
async function toggle(label) {
  await evaluate(`document.querySelector('[aria-label=${JSON.stringify(label)}]').click()`)
  await ready()
  await new Promise((r) => setTimeout(r, 80))
}
async function sheet(name, entries, columns = 2) {
  const data = entries.map(([label, source]) => ({
    label,
    png: source.startsWith('data:')
      ? source
      : 'data:image/png;base64,' +
        fs.readFileSync(path.join(output, source + '.png')).toString('base64'),
  }))
  const png = await evaluate(
    `(async()=>{const data=${JSON.stringify(data)},w=800,h=500,columns=${columns},c=document.createElement('canvas');c.width=columns*w;c.height=Math.ceil(data.length/columns)*h;const x=c.getContext('2d');x.fillStyle='#101418';x.fillRect(0,0,c.width,c.height);for(const [i,item]of data.entries()){const image=new Image();image.src=item.png;await image.decode();const ox=(i%columns)*w,oy=Math.floor(i/columns)*h,scale=Math.min((w-24)/image.width,(h-48)/image.height);x.fillStyle='#dfd4bd';x.font='19px sans-serif';x.fillText(item.label,ox+12,oy+28);x.drawImage(image,ox+(w-image.width*scale)/2,oy+42+(h-48-image.height*scale)/2,image.width*scale,image.height*scale)}return c.toDataURL()})()`,
  )
  writePNG(name, png)
}
try {
  await browser.send('Emulation.setDeviceMetricsOverride', {
    width: 1920,
    height: 1280,
    deviceScaleFactor: 1,
    mobile: false,
  })
  await browser.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `window.__threeErrors=[];const previous=console.error;console.error=(...args)=>{window.__threeErrors.push(args.map(String).join(' '));previous.apply(console,args)}`,
  })
  const baseline = await evaluate(
    `(async()=>{const r=await import('/src/features/dungeon/rendering/dungeon-renderer.ts'),store=(await import('/src/stores/dungeon.ts')).useDungeonStore(),floor=JSON.parse(JSON.stringify(store.floor)),c=await r.createMapCanvasAsync(floor,false,'ancient');let h=2166136261;for(const b of c.getContext('2d').getImageData(0,0,c.width,c.height).data)h=Math.imul(h^b,16777619);r.disposeMapCanvas(c);return{floor,hash:h>>>0,appearance:localStorage.getItem('dungeon-atelier:appearance')}})()`,
  )
  await browser.send('Page.navigate', { url: base + '/#/dev/dungeon-3d' })
  await poll(attach, '3D prototype component')
  await ready()
  const initial = await state(),
    sourceJSON = JSON.stringify(initial.floor)
  assert.deepEqual(initial.floor, generatePrototypeFloor(initial.floor.seed))
  assert(initial.metrics.calls < 100)
  assert(initial.backend.webgl2)
  assert.deepEqual(
    new Set(initial.materials),
    new Set(['study-broad', 'study-weathered', 'study-irregular']),
  )
  report.generated32 = {
    seed: initial.floor.seed,
    materials: initial.materials,
    metrics: initial.metrics,
    backend: initial.backend,
  }
  await capture('3d-default')
  for (const label of ['3D torch lighting', '3D shadows', '3D wireframe']) {
    const before = await evaluate('threeProof.capture3D()')
    await toggle(label)
    assert((await evaluate('threeProof.capture3D()')) !== before, `${label} must affect rendering`)
    await toggle(label)
  }
  report.lightingAndDiagnostics = { torchLighting: true, shadows: true, wireframe: true }
  const canvasPNG = await evaluate(
    `(async()=>{const r=await import('/src/features/dungeon/rendering/dungeon-renderer.ts'),c=await r.createMapCanvasAsync(threeProof.getPrototypeState().floor,false,'ancient');const png=c.toDataURL();r.disposeMapCanvas(c);return png})()`,
  )
  writePNG('canvas-same-layout', canvasPNG)
  await toggle('3D Canvas comparison')
  await poll(
    () => evaluate(`document.querySelector('.canvas-viewport canvas')?.width>10`),
    'Canvas comparison',
  )
  await shot('editor-comparison')
  await toggle('3D Canvas comparison')
  await slider('3D camera rotation', 15)
  assert.equal((await state()).camera.rotation, 15)
  await capture('3d-rotated')
  await slider('3D camera elevation', 65)
  assert.equal((await state()).camera.elevation, 65)
  await capture('3d-lower')
  await slider('3D camera elevation', 68)
  await slider('3D camera rotation', 0)
  const floorGeometryId = (await state()).floorGeometryId,
    baseY = (await state()).geometryBounds.max.y
  await choose('3D wall height', '1.75× walls')
  assert((await state()).geometryBounds.max.y > baseY + 1)
  assert.equal((await state()).floorGeometryId, floorGeometryId)
  await capture('3d-taller-walls')
  const tallGeometryCount = (await state()).metrics.geometries
  await choose('3D wall height', '1.00× walls')
  await choose('3D wall height', '1.75× walls')
  await choose('3D wall height', '1.00× walls')
  assert(
    (await state()).metrics.geometries <= tallGeometryCount + 2,
    'Wall rebuild accumulates GPU geometries',
  )
  report.heightRebuild = { floorGeometryPreserved: true, geometriesBounded: true }
  const beforeWheel = (await state()).camera.zoom,
    bounds = await evaluate(
      `(()=>{const r=document.querySelector('.three-viewport canvas').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`,
    )
  await browser.send('Input.dispatchMouseEvent', {
    type: 'mouseWheel',
    x: bounds.x,
    y: bounds.y,
    deltaX: 0,
    deltaY: -140,
  })
  await poll(async () => (await state()).camera.zoom > beforeWheel, 'Wheel zoom')
  const beforePan = (await state()).camera.position
  await browser.send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    button: 'left',
    buttons: 1,
    clickCount: 1,
    x: bounds.x,
    y: bounds.y,
  })
  await browser.send('Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    button: 'left',
    buttons: 1,
    x: bounds.x + 90,
    y: bounds.y + 40,
  })
  await browser.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    button: 'left',
    buttons: 0,
    clickCount: 1,
    x: bounds.x + 90,
    y: bounds.y + 40,
  })
  assert.notDeepEqual((await state()).camera.position, beforePan)
  report.camera = { elevation: true, rotation: true, wheelZoom: true, leftDragPan: true }
  await evaluate(
    `document.querySelectorAll('button').forEach(n=>{if(n.textContent.includes('Reset camera'))n.click()})`,
  )
  await ready()
  assert.equal((await state()).camera.zoom, 1)
  await evaluate(
    `document.querySelectorAll('button').forEach(n=>{if(n.textContent.includes('Regenerate'))n.click()})`,
  )
  await ready()
  assert.equal(JSON.stringify((await state()).floor), sourceJSON)
  report.sameSeedSameFloor = true
  const hidden = (await state()).visibleFloor
  await toggle('3D reveal secrets')
  assert.equal(JSON.stringify((await state()).floor), sourceJSON)
  report.secretPreview = {
    hiddenDoors: hidden.doors.length,
    revealedDoors: (await state()).doors.length,
  }
  await toggle('3D reveal secrets')
  await choose('3D scene source', 'Fixed four-door diagnostic')
  const diagnostic = await state()
  assert.equal(diagnostic.doors.length, 4)
  assert.deepEqual(
    new Set(diagnostic.doors.map((d) => d.facing)),
    new Set(['north', 'south', 'east', 'west']),
  )
  const probes = []
  for (const door of diagnostic.doors)
    probes.push(await evaluate(`threeProof.probeDoorOpening(${JSON.stringify(door.id)})`))
  assert(probes.every(Boolean), 'Closed wooden leaves should intersect the doorway rays')
  const doorFrames = []
  for (const facing of ['north', 'south', 'east', 'west']) {
    await choose('3D inspect feature', facing[0].toUpperCase() + facing.slice(1) + ' doorway')
    doorFrames.push([
      facing + ' · same reusable doorway geometry',
      await evaluate('threeProof.capture3D()'),
    ])
  }
  await sheet('directional-doors', doorFrames)
  await toggle('3D door head cutaway')
  const cutawayFrames = []
  for (const facing of ['east', 'west']) {
    await choose('3D inspect feature', facing[0].toUpperCase() + facing.slice(1) + ' doorway')
    cutawayFrames.push([
      facing + ' · optional overhead lintel cutaway',
      await evaluate('threeProof.capture3D()'),
    ])
  }
  await sheet('side-door-cutaway', cutawayFrames)
  await toggle('3D door head cutaway')
  await toggle('3D open doors')
  const openProbes = []
  for (const door of diagnostic.doors)
    openProbes.push(await evaluate(`threeProof.probeDoorOpening(${JSON.stringify(door.id)})`))
  assert(
    openProbes.every((value) => value === false),
    'An open door must leave a real unobstructed portal',
  )
  report.doorways = {
    orientations: ['north', 'south', 'east', 'west'],
    closedLeavesBlockRays: true,
    openPortalsClearRays: true,
  }
  await toggle('3D open doors')
  const stairFrames = []
  for (const stair of (await evaluate('threeProof.getAssetProof()')).stairs) {
    const p = stairPoint(
      stair,
      stair.width * (stair.form === 'straight' ? 0.5 : 0.25),
      stair.landing + stair.run * 0.6,
    )
    const y = await evaluate(`threeProof.probeFloor(${p.x - 0.5},${p.z - 0.5})`)
    if (stair.direction === 'up') assert(y > 0.3)
    else assert(y < -0.1, 'Down stairs must occupy a real hole in the floor')
    await choose(
      '3D inspect feature',
      stair.direction === 'up' ? 'Upward staircase' : 'Downward staircase',
    )
    stairFrames.push([
      stair.direction + ' · actual treads and risers',
      await evaluate('threeProof.capture3D()'),
    ])
  }
  await sheet('staircases', stairFrames)
  report.staircases = { trueRisingSteps: true, trueRecessedOpening: true }
  await choose('3D scene source', 'Generated dungeon')
  await choose('3D map size', '64')
  const large = await state()
  assert.deepEqual(large.floor, generatePrototypeFloor(large.floor.seed, 64))
  await capture('3d-64-map')
  report.generated64 = {
    seed: large.floor.seed,
    metrics: large.metrics,
    materials: large.materials,
  }
  const secretCount = large.floor.doors.filter((door) => door.type === 'secret').length
  assert(secretCount > 0, 'The large fixture must exercise real generated secret doors')
  await toggle('3D reveal secrets')
  assert.equal((await state()).doors.length, large.doors.length + secretCount)
  assert.deepEqual((await state()).floor, large.floor)
  await toggle('3D reveal secrets')
  assert.equal((await state()).doors.length, large.doors.length)
  report.secretPreview.generatedSecretDoorsExercised = secretCount
  await choose('3D inspect feature', 'Largest chamber')
  await capture('larger-chamber')
  await browser.send('Page.navigate', { url: base })
  await poll(
    () => evaluate(`!!document.querySelector('.dungeon-canvas')`),
    'Return to production editor',
  )
  assert.equal(
    await evaluate(
      `(async()=>(await import('/src/experiments/dungeon-3d/viewport.ts')).prototypeLifecycle.activeViewports)()`,
    ),
    0,
  )
  assert.equal(
    await evaluate(`localStorage.getItem('dungeon-atelier:appearance')`),
    baseline.appearance,
  )
  const finalHash = await evaluate(
    `(async()=>{const r=await import('/src/features/dungeon/rendering/dungeon-renderer.ts'),c=await r.createMapCanvasAsync(${JSON.stringify(baseline.floor)},false,'ancient');let h=2166136261;for(const b of c.getContext('2d').getImageData(0,0,c.width,c.height).data)h=Math.imul(h^b,16777619);r.disposeMapCanvas(c);return h>>>0})()`,
  )
  assert.equal(finalHash, baseline.hash)
  report.production = {
    pixelsUnchanged: true,
    savedAppearanceUnchanged: true,
    activeViewportsAfterLeave: 0,
  }
  assert.deepEqual(browser.errors, [])
  assert.deepEqual(await evaluate('window.__threeErrors'), [])
  await sheet('contact-sheet', [
    ['Canvas · same generated floor', 'canvas-same-layout'],
    ['Three.js · default high angle', '3d-default'],
    ['Three.js · +15° rotation', '3d-rotated'],
    ['Three.js · 1.75× physical walls', '3d-taller-walls'],
  ])
  samples.sort((a, b) => a - b)
  report.performance = {
    samplesMs: samples,
    medianCPUSubmissionMs: samples[Math.floor(samples.length / 2)],
    gpuBytes: 'Unavailable',
    textureBytes: 'RGBA+mipmap estimate only; excludes driver/shadow overhead',
  }
  report.passed = true
  const options = await resolveConfig('package.json')
  fs.writeFileSync(
    path.join(output, 'report.json'),
    await format(JSON.stringify(report), { ...options, parser: 'json' }),
  )
  fs.writeFileSync(
    path.join(output, 'index.html'),
    await format(
      `<!doctype html><html lang="en"><meta charset="utf-8"><title>DungeonAtelier · Three.js prototype evidence</title><style>body{background:#101418;color:#ddd;font:16px system-ui;margin:2rem}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(400px,1fr));gap:1rem}img{width:100%;background:#080c0d}a{color:#d3b479}figure{margin:0}figcaption{padding:.5rem}</style><h1>Ancient dungeon · true 3D prototype</h1><p>Generated captures share the seed side-door-readability-0. Door and stair details use the explicitly fixed four-door diagnostic. <a href="report.json">Validation and observed performance</a></p><main>${captures.map((name) => `<figure><a href="${name}.png"><img src="${name}.png" alt="${name}"></a><figcaption>${name}</figcaption></figure>`).join('')}</main></html>`,
      { ...options, parser: 'html' },
    ),
  )
  console.log(
    'Three.js prototype passed: 32/64 maps, four real portals, rising/recessed stairs, camera controls, bounded wall rebuild resources, production parity and cleanup.',
  )
} finally {
  browser.close()
}
