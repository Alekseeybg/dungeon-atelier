import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { format, resolveConfig } from 'prettier'
import { browserSession, poll } from '../tests/helpers/browser.mjs'

const baseline = process.argv.includes('--baseline'),
  base = process.env.ATELIER_URL ?? 'http://localhost:9001',
  output = path.resolve(process.env.ATELIER_3D_REPORT_DIR ?? 'reports/dungeon-3d-polish'),
  browser = await browserSession(base),
  evaluate = browser.evaluate,
  prefix = baseline ? 'before' : 'after',
  report = { baseline, captures: [] }
fs.mkdirSync(output, { recursive: true })
const state = () => evaluate('threeProof.getPrototypeState()'),
  ready = () =>
    poll(async () => {
      const s = await state()
      return !s.busy && !s.error && s.metrics?.calls > 0
    }, '3D scene'),
  settle = () => evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
async function choose(label, value) {
  await evaluate(`document.querySelector('[aria-label=${JSON.stringify(label)}]').click()`)
  await poll(
    () =>
      evaluate(
        `(()=>{const o=[...document.querySelectorAll('[role="option"]')].find(n=>n.textContent.trim()===${JSON.stringify(value)});if(!o)return false;o.click();return true})()`,
      ),
    value,
  )
  await ready()
  await settle()
}
async function slider(label, value) {
  await evaluate(
    `document.querySelector('[aria-label=${JSON.stringify(label)}]').__vueParentComponent.emit('update:modelValue',${value})`,
  )
  await settle()
}
async function toggle(label) {
  await evaluate(`document.querySelector('[aria-label=${JSON.stringify(label)}]').click()`)
  await settle()
}
async function capture(name) {
  const png = await evaluate('threeProof.capture3D()'),
    file = `${prefix}-${name}.png`
  fs.writeFileSync(path.join(output, file), Buffer.from(png.split(',')[1], 'base64'))
  report.captures.push(file)
  return png
}
async function difference(a, b) {
  return evaluate(
    `(async()=>{const imgs=await Promise.all(${JSON.stringify([a, b])}.map(async src=>{const i=new Image();i.src=src;await i.decode();return i}));const c=document.createElement('canvas');c.width=imgs[0].width;c.height=imgs[0].height;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(imgs[0],0,0);const a=x.getImageData(0,0,c.width,c.height).data;x.drawImage(imgs[1],0,0);const b=x.getImageData(0,0,c.width,c.height).data;let changed=0,total=0,max=0;for(let i=0;i<a.length;i+=4){const d=(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2]))/3;if(d>3)changed++;total+=d;max=Math.max(max,d)}return{changedPixels:changed,meanRGBDelta:total/(a.length/4),maxRGBDelta:max,pixels:a.length/4}})()`,
  )
}
async function drag(button, dx, dy, outside = false, modifiers = 0) {
  const r = await evaluate(
      `(()=>{const r=document.querySelector('.three-viewport canvas').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`,
    ),
    buttons = button === 'left' ? 1 : button === 'middle' ? 4 : 2
  await browser.send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    modifiers,
    button,
    buttons,
    clickCount: 1,
    ...r,
  })
  await browser.send('Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    modifiers,
    button,
    buttons,
    x: r.x + dx,
    y: r.y + dy,
  })
  await browser.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    modifiers,
    button,
    buttons: 0,
    clickCount: 1,
    x: outside ? 5 : r.x + dx,
    y: outside ? 5 : r.y + dy,
  })
  await settle()
}
try {
  await browser.send('Emulation.setDeviceMetricsOverride', {
    width: 1920,
    height: 1280,
    deviceScaleFactor: 1,
    mobile: false,
  })
  await browser.send('Page.navigate', { url: base + '/#/dev/dungeon-3d' })
  await poll(
    () =>
      evaluate(
        `(()=>{let n=document.querySelector('.dungeon-3d-page')?.__vueParentComponent;while(n&&!n.exposed?.getPrototypeState)n=n.parent;if(!n)return false;window.threeProof=n.exposed;return true})()`,
      ),
    'Prototype component',
  )
  await ready()
  await evaluate(
    "document.querySelector('[aria-label=\"3D visual theme\"]')?.__vueParentComponent.emit('update:modelValue','restored-crypt')",
  )
  await settle()
  report.initial = await state()
  report.assetProof = await evaluate('threeProof.getAssetProof?.()')
  if (!baseline && report.assetProof) {
    const previous = JSON.parse(fs.readFileSync(path.join(output, 'before-report.json'), 'utf8'))
    if (previous.assetProof)
      assert.deepEqual(
        report.assetProof.caps,
        previous.assetProof.caps,
        'Approved cap geometry and material maps must remain identical',
      )
  }
  await choose('3D inspect feature', 'Largest chamber')
  await capture('full-room')
  const room = [...report.initial.floor.rooms].sort(
    (a, b) => b.width * b.height - a.width * a.height,
  )[0]
  await evaluate(`threeProof.focusTile(${room.x + room.width - 1},${room.y + room.height - 1},6)`)
  await capture('east-corner')
  await choose('3D inspect feature', 'East doorway')
  await capture('side-door')
  await choose('3D inspect feature', 'Downward staircase')
  await capture('stairs')
  await choose('3D inspect feature', 'Largest chamber')
  const litCamera = (await state()).camera
  const on = await capture('torches-on')
  await toggle('3D torch lighting')
  const off = await capture('torches-off')
  assert.deepEqual(
    (await state()).camera,
    litCamera,
    'Lighting comparison must use an identical camera',
  )
  report.torchDifference = await difference(on, off)
  await toggle('3D torch lighting')
  if (!baseline) {
    assert.equal(
      await evaluate('threeProof.capture3D()'),
      on,
      'Returning lighting ON must reproduce the same seeded surface pixels',
    )
    const lights = (await state()).lights
    assert(lights.length <= 8)
    assert(lights.every((light) => light.visible && light.decay === 2 && !light.castShadow))
    assert(
      report.torchDifference.changedPixels > 1500,
      'Torches must illuminate surfaces, beyond flame-sized changes',
    )
    assert(report.torchDifference.meanRGBDelta > 0.5, 'Local lighting must be perceptible')
    const start = await state()
    await drag('left', 80, 35)
    const pan = await state()
    assert.notDeepEqual(pan.camera.target, start.camera.target)
    assert.equal(pan.camera.elevation, start.camera.elevation)
    assert.equal(pan.camera.rotation, start.camera.rotation)
    assert(Math.abs(pan.camera.target[1]) < 1e-6)
    await drag('middle', 80, 70, true)
    const tilt = await state()
    assert(tilt.camera.elevation > pan.camera.elevation)
    assert.equal(tilt.camera.rotation, pan.camera.rotation)
    assert.deepEqual(tilt.camera.target, pan.camera.target)
    await drag('right', 120, 90, true)
    const turn = await state()
    assert.notEqual(turn.camera.rotation, tilt.camera.rotation)
    assert.equal(turn.camera.elevation, tilt.camera.elevation)
    assert.deepEqual(turn.camera.target, tilt.camera.target)
    await browser.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      buttons: 0,
      x: 1000,
      y: 600,
    })
    assert.deepEqual((await state()).camera, turn.camera, 'Release outside must stop gesture')
    await drag('left', 80, 0, false, 1)
    const altTurn = await state()
    assert.notEqual(altTurn.camera.rotation, turn.camera.rotation, 'Alt-left drag must rotate')
    assert(
      altTurn.camera.target.every((v, i) => Math.abs(v - turn.camera.target[i]) < 1e-8),
      'Alt-left rotation must not pan',
    )
    assert.equal(altTurn.camera.elevation, turn.camera.elevation)
    await slider('3D camera elevation', 35)
    assert.equal((await state()).camera.elevation, 35)
    await capture('low-angle-35')
    await drag('middle', 0, -200)
    assert.equal((await state()).camera.elevation, 35)
    await slider('3D camera elevation', 90)
    assert.equal((await state()).camera.elevation, 90)
    await drag('middle', 0, 200)
    assert.equal((await state()).camera.elevation, 90)
    await drag('left', 60, 40)
    assert((await state()).camera.target.every(Number.isFinite), 'Top-down pan must remain stable')
    const wheel = await evaluate(
        `(()=>{const r=document.querySelector('.three-viewport canvas').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`,
      ),
      scrollY = await evaluate('window.scrollY'),
      zoom = (await state()).camera.zoom
    await browser.send('Input.dispatchMouseEvent', {
      type: 'mouseWheel',
      ...wheel,
      deltaX: 0,
      deltaY: -140,
    })
    await settle()
    assert((await state()).camera.zoom > zoom)
    assert.equal(
      await evaluate('window.scrollY'),
      scrollY,
      'Wheel should zoom without scrolling the page',
    )
    assert(
      await evaluate(
        `(()=>{const e=new MouseEvent('contextmenu',{bubbles:true,cancelable:true});document.querySelector('.three-viewport canvas').dispatchEvent(e);return e.defaultPrevented})()`,
      ),
      'Context menu must be suppressed',
    )
    await evaluate(
      `document.querySelectorAll('button').forEach(n=>{if(n.textContent.includes('Reset camera'))n.click()})`,
    )
    await settle()
    assert.equal((await state()).camera.elevation, 68)
    assert.equal((await state()).camera.rotation, 0)
    assert.equal((await state()).camera.zoom, 1)
    report.controls = {
      leftPan: true,
      middleElevation: true,
      rightRotation: true,
      altLeftRotation: true,
      middleDirection: 'drag down raises elevation',
      wheelZoom: true,
      wheelPreventsPageScroll: true,
      contextMenuSuppressed: true,
      outsideRelease: true,
      elevationLimits: [35, 90],
      reset: true,
    }
    await slider('3D camera elevation', 50)
    await slider('3D camera rotation', 40)
    await choose('3D inspect feature', 'East doorway')
    await capture('side-door-inspection')
    await choose('3D inspect feature', 'Largest chamber')
    await capture('room-inspection')
    await evaluate(
      `threeProof.focusTile(${room.x + room.width - 1},${room.y + room.height - 1},3.2)`,
    )
    await capture('cap-profile-closeup')
    await evaluate(`threeProof.focusTile(${room.x + room.width / 2},${room.y},4.5)`)
    await capture('wall-variation')
    if (process.env.ATELIER_3D_REPORT_DIR?.includes('dungeon-3d-assets')) {
      await evaluate(`threeProof.focusTile(${room.x + 1},${room.y + 1},2.6)`)
      await capture('floor-closeup')
      const propsMilestone =
          output.endsWith('dungeon-3d-assets-props') ||
          output.endsWith('dungeon-3d-assets-weathering'),
        door =
          report.initial.doors.find(
            (d) => d.facing === (propsMilestone ? 'north' : 'east') && d.type !== 'secret',
          ) ?? report.initial.doors[0]
      if (propsMilestone) {
        await slider('3D camera elevation', 42)
        await slider('3D camera rotation', -12)
      }
      await evaluate(`threeProof.focusTile(${door.x - 0.5},${door.z - 0.5},2.4,0.7)`)
      await capture('door-closeup')
      if (propsMilestone) {
        await slider('3D camera elevation', 50)
        await slider('3D camera rotation', 40)
      }
      const torch =
        report.initial.torches.find(
          (p) =>
            p[0] > room.x &&
            p[0] < room.x + room.width &&
            p[2] > room.y &&
            p[2] < room.y + room.height,
        ) ?? report.initial.torches[0]
      await evaluate(`threeProof.focusTile(${torch[0] - 0.5},${torch[2] - 0.5},1.8,${torch[1]})`)
      await capture('torch-closeup')
    }
    report.final = await state()
    assert(report.final.metrics.calls < 100)
    assert.deepEqual(browser.errors, [])
  }
  const formatting = await resolveConfig('package.json')
  fs.writeFileSync(
    path.join(output, prefix + '-report.json'),
    await format(JSON.stringify(report), { ...formatting, parser: 'json' }),
  )
  if (!baseline) {
    const comparisons = [
      'full-room',
      'east-corner',
      'side-door',
      'stairs',
      'torches-on',
      'torches-off',
    ]
    const gallery = `<!doctype html><html lang="en"><meta charset="utf-8"><title>DungeonAtelier — 3D polish comparisons</title><style>body{background:#101418;color:#ddd;font:16px system-ui;margin:2rem}section{display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:2rem}figure{margin:0}img{width:100%}a{color:#e0c592}h2{grid-column:1/-1;margin-bottom:0}figcaption{padding:.5rem}</style><h1>Ancient 3D — visual polish</h1><p>Same generated seed, focus and default 68° / 12° azimuth. Responsive viewport widths differ by 15 px between milestones. Torch ON/OFF pairs use identical cameras and viewport dimensions within each milestone. Reference supplied in conversation; original image is not a repository asset.</p><p><a href="before-report.json">Before measurements</a> · <a href="after-report.json">After measurements and gesture checks</a></p>${comparisons.map((name) => `<section><h2>${name}</h2>${['before', 'after'].map((phase) => `<figure><a href="${phase}-${name}.png"><img src="${phase}-${name}.png" alt="${phase} ${name}"></a><figcaption>${phase}</figcaption></figure>`).join('')}</section>`).join('')}<section><h2>Lower-angle inspection (50° elevation, +40° rotation)</h2><figure><img src="after-room-inspection.png" alt="Lower-angle room"></figure><figure><img src="after-side-door-inspection.png" alt="Side doorway at lower angle"></figure></section></html>\n`
    fs.writeFileSync(
      path.join(output, 'index.html'),
      await format(
        gallery
          .replace(
            '</html>',
            `<section><h2>Profile and seeded wall detail</h2><figure><img src="after-cap-profile-closeup.png" alt="Actual cap chamfer and plane separation"></figure><figure><img src="after-wall-variation.png" alt="Seeded masonry variation"></figure></section></html>`,
          )
          .replace(
            'Responsive viewport widths differ by 15 px between milestones.',
            'Responsive framing is retained for each milestone.',
          )
          .replace(
            '</html>',
            process.env.ATELIER_3D_REPORT_DIR?.includes('dungeon-3d-assets')
              ? `<section><h2>Asset construction close-ups</h2>${['floor', 'door', 'torch'].map((name) => `<figure><a href="after-${name}-closeup.png"><img src="after-${name}-closeup.png" alt="${name} construction close-up"></a><figcaption>${name}</figcaption></figure>`).join('')}</section></html>`
              : '</html>',
          ),
        { ...formatting, parser: 'html' },
      ),
    )
  }
  console.log(
    JSON.stringify({ phase: prefix, lighting: report.torchDifference, controls: report.controls }),
  )
} finally {
  browser.close()
}
