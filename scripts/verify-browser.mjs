import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  generateDungeon,
  DEFAULT_CONFIG,
  exportFloorJson,
} from '../packages/dungeon-core/dist/index.js'

const args = process.argv.slice(2)
const option = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback)
const url = option('--url', 'http://localhost:9000')
const output = path.resolve(option('--output', 'reports/verification/browser'))
fs.mkdirSync(output, { recursive: true })
const chrome =
  process.env.CHROME_PATH ||
  (process.platform === 'win32'
    ? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
    : 'google-chrome')
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'atelier-browser-'))
const processHandle = spawn(
  chrome,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--remote-debugging-port=0',
    `--user-data-dir=${profile}`,
    'about:blank',
  ],
  { windowsHide: true, stdio: 'ignore' },
)
let socket
let launchError
processHandle.on('error', (error) => {
  launchError = error
})
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
async function until(action, label) {
  for (let i = 0; i < 150; i++) {
    if (launchError) throw launchError
    try {
      const value = await action()
      if (value) return value
    } catch {
      /* Browser/server still starting. */
    }
    await pause(200)
  }
  throw new Error(`Timed out: ${label}`)
}
try {
  const port = await until(
    () =>
      fs.existsSync(path.join(profile, 'DevToolsActivePort')) &&
      fs.readFileSync(path.join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0],
    'Chrome startup',
  )
  const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
  socket = new WebSocket(pages.find((page) => page.type === 'page').webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    socket.onopen = resolve
    socket.onerror = reject
  })
  let id = 0
  const pending = new Map()
  const runtimeErrors = []
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data)
    if (message.method === 'Runtime.exceptionThrown')
      runtimeErrors.push(message.params.exceptionDetails)
    const entry = pending.get(message.id)
    if (entry) {
      clearTimeout(entry.timer)
      pending.delete(message.id)
      message.error
        ? entry.reject(new Error(JSON.stringify(message.error)))
        : entry.resolve(message.result)
    }
  }
  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const messageId = ++id
      const timer = setTimeout(() => {
        pending.delete(messageId)
        reject(new Error(`CDP timeout: ${method}`))
      }, 30000)
      pending.set(messageId, { resolve, reject, timer })
      socket.send(JSON.stringify({ id: messageId, method, params }))
    })
  }
  async function evaluate(expression) {
    const result = await send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    })
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails))
    return result.result.value
  }
  await send('Runtime.enable')
  await send('Page.enable')
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1,
    mobile: false,
  })
  await send('Page.navigate', { url })
  await until(() => evaluate("!!document.querySelector('.dungeon-canvas')"), 'Dungeon app')
  await evaluate(`(async()=>{
    window.verification = {
      store: (await import('/src/stores/dungeon.ts')).useDungeonStore(),
      renderer: await import('/src/features/dungeon/rendering/dungeon-renderer.ts'),
      fog: await import('/src/features/dungeon/rendering/walk-fog.ts'),
      materials: await import('/src/features/dungeon/rendering/material-rules.ts')
    }
    verification.hash = canvas => {
      let hash = 2166136261
      for(const byte of canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data) hash = Math.imul(hash ^ byte,16777619)
      return (hash>>>0).toString(16)
    }
  })()`)
  const legacy = []
  for (const name of ['legacy-v1.json', 'legacy-v2.json']) {
    const json = fs.readFileSync(new URL('../tests/fixtures/' + name, import.meta.url), 'utf8')
    legacy.push(
      await evaluate(`(()=>{
      const v=verification, json=${JSON.stringify(json)}
      v.store.importJson(json)
      if(v.store.errors.length) throw new Error(v.store.errors.join('; '))
      if(JSON.stringify(v.store.floor)!==JSON.stringify(JSON.parse(json))) throw new Error('Legacy import changed geometry')
      for(const style of ['classic','stone']) v.renderer.createMapCanvas(v.store.floor,false,style)
      return {schema:v.store.floor.schemaVersion,rendered:true}
    })()`),
    )
  }
  const results = []
  for (const [index, dimensions] of [
    [0, [32, 32]],
    [1, [64, 64]],
    [2, [48, 32]],
  ]) {
    const generated = generateDungeon({
      ...DEFAULT_CONFIG,
      width: dimensions[0],
      height: dimensions[1],
      seed: `visual-verification-${index}`,
      roomShapeChance: 1,
      shortcutChance: 1,
      chamberBlockChance: 1,
    })
    assert.ok(generated.ok, JSON.stringify(generated))
    const floor = generated.floor
    const result = await evaluate(`(async()=>{
      const v=verification
      const json=${JSON.stringify(exportFloorJson(floor))}
      v.store.importJson(json)
      await new Promise(resolve=>setTimeout(resolve,100))
      if(v.store.errors.length) throw new Error(v.store.errors.join('; '))
      const before=JSON.stringify(v.store.floor), hashes={}, renderMs={}
      for(const style of ['classic','stone']) for(const grid of [false,true]) {
        const start=performance.now(), canvas=v.renderer.createMapCanvas(v.store.floor,grid,style)
        renderMs[style+'-'+grid]=performance.now()-start
        const hash=v.hash(canvas)
        if(v.hash(v.renderer.createMapCanvas(v.store.floor,grid,style))!==hash) throw new Error('Nondeterministic '+style)
        hashes[style+'-'+grid]=hash
        if(style==='stone'&&!grid) v.canvas=canvas
      }
      if(JSON.stringify(v.store.floor)!==before) throw new Error('Renderer mutated floor')
      const plan=v.materials.createMaterialPlan(v.store.floor), coverage={kinds:{},conditions:{},identities:{}}
      for(const room of plan.rooms) coverage.identities[room.role]=(coverage.identities[room.role]??0)+1
      for(let y=0;y<v.store.floor.height;y++) for(let x=0;x<v.store.floor.width;x++) {
        const material=plan.at(x,y)
        coverage.kinds[material.kind]=(coverage.kinds[material.kind]??0)+1
        coverage.conditions[material.condition]=(coverage.conditions[material.condition]??0)+1
        if((material.kind==='threshold'||material.kind==='wall-dressed')&&material.condition!=='clean') throw new Error('Weathered protected surface')
        const owner=plan.roomAt(x,y)
        if(owner && material.kind!=='threshold' && material.kind!==owner.kind) throw new Error('Mixed room paving family')
      }
      return {hashes,renderMs,source:v.store.source,seed:v.store.floor.seed,coverage}
    })()`)
    assert.equal(result.source, 'imported')
    results.push(result)
    const png = await evaluate('verification.canvas.toDataURL().split(",")[1]')
    fs.writeFileSync(path.join(output, `stone-${index}.png`), Buffer.from(png, 'base64'))
  }
  await evaluate('document.querySelector(\'[aria-label="Enter walk mode"]\').click()')
  await pause(150)
  const walk = await evaluate(`(()=>{
    const v=verification, node=document.querySelector('.dungeon-canvas'), walk=node.__vueParentComponent.props.walk
    if(!walk.active||walk.explored.size!==9) throw new Error('Initial walk reveal must be 3x3')
    v.exploredBefore=[...walk.explored]
    const canvas=v.renderer.createMapCanvas(v.store.floor,false,'stone')
    v.fog.renderWalkFog(canvas.getContext('2d'),v.store.floor,walk)
    const pixel=canvas.getContext('2d').getImageData(0,0,1,1).data
    if(pixel[0]!==8||pixel[1]!==12||pixel[2]!==13) throw new Error('Unexplored tiles leaked')
    return {initial:walk.explored.size}
  })()`)
  for (let i = 0; i < 4; i++) {
    await evaluate(
      'document.querySelector(\'[aria-label="Walk forward"]\').click();document.querySelector(\'[aria-label="Turn right"]\').click()',
    )
  }
  const moved = await evaluate(
    `(()=>{const w=document.querySelector('.dungeon-canvas').__vueParentComponent.props.walk; if(!verification.exploredBefore.every(key=>w.explored.has(key))) throw new Error('Lost discovery'); if(w.steps<1) throw new Error('Could not walk imported floor'); return {steps:w.steps,explored:w.explored.size}})()`,
  )
  await evaluate('document.querySelector(\'[aria-label="Exit walk mode"]\').click()')
  const screenshots = []
  for (const [width, height] of [
    [1920, 1080],
    [2560, 1440],
    [390, 844],
  ]) {
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: width < 600,
    })
    await pause(300)
    const layout = await evaluate(
      `({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,fontSize:getComputedStyle(document.documentElement).fontSize,errors:[...document.querySelectorAll('vite-error-overlay, vite-plugin-checker-error-overlay')].map(e=>e.shadowRoot?.querySelector('main')?.innerText||'').filter(Boolean)})`,
    )
    assert.ok(layout.scrollWidth <= width + 1, JSON.stringify(layout))
    assert.deepEqual(layout.errors, [])
    const { data } = await send('Page.captureScreenshot', { format: 'png' })
    fs.writeFileSync(path.join(output, `studio-${width}.png`), Buffer.from(data, 'base64'))
    screenshots.push(layout)
  }
  assert.deepEqual(runtimeErrors, [], 'Browser runtime exceptions')
  const baselineFile = option('--compare', null)
  if (baselineFile) {
    const baseline = JSON.parse(fs.readFileSync(baselineFile, 'utf8'))
    for (let i = 0; i < results.length; i++)
      for (const grid of [false, true])
        assert.equal(
          results[i].hashes['classic-' + grid],
          baseline.results[i].hashes['classic-' + grid],
          'Classic pixels changed',
        )
  }
  const materialCases = []
  const identities = new Set(),
    conditions = new Set(),
    kinds = new Set()
  for (let i = 0; i < 16; i++) {
    const generated = generateDungeon({
      ...DEFAULT_CONFIG,
      width: i === 15 ? 96 : 64,
      height: i === 15 ? 96 : 64,
      targetRoomCount: 16,
      minRoomSize: 5,
      maxRoomSize: 11,
      seed: 'material-verification-' + i,
      roomShapeChance: 0.65,
      extraConnectionChance: 1,
      shortcutChance: 1,
      chamberBlockChance: i % 2,
    })
    assert.ok(generated.ok, JSON.stringify(generated))
    const sample = await evaluate(`(()=>{
      const v=verification,floor=${JSON.stringify(generated.floor)},plan=v.materials.createMaterialPlan(floor)
      const before=JSON.stringify(floor),conditions=new Set(),kinds=new Set()
      for(let y=0;y<floor.height;y++) for(let x=0;x<floor.width;x++) {
        const m=plan.at(x,y),owner=plan.roomAt(x,y)
        conditions.add(m.condition);kinds.add(m.kind)
        if((m.kind==='threshold'||m.kind==='wall-dressed')&&m.condition!=='clean') throw new Error('Weathered protected material')
        if(owner && m.kind!=='threshold' && m.kind!==owner.kind) throw new Error('Inconsistent room material')
      }
      const start=performance.now(),canvas=v.renderer.createMapCanvas(floor,false,'stone'),renderMs=performance.now()-start
      if(JSON.stringify(floor)!==before) throw new Error('Art mutated geometry')
      if(${i}===0) v.detail=canvas.toDataURL().split(',')[1]
      return {seed:floor.seed,width:floor.width,renderMs,identities:[...new Set(plan.rooms.map(room=>room.role))],conditions:[...conditions],kinds:[...kinds]}
    })()`)
    sample.identities.forEach((role) => identities.add(role))
    sample.conditions.forEach((condition) => conditions.add(condition))
    sample.kinds.forEach((kind) => kinds.add(kind))
    materialCases.push(sample)
  }
  for (const identity of [
    'chamber',
    'hub',
    'stair',
    'secret-entry',
    'template',
    'ceremonial',
    'damp',
  ])
    assert.ok(identities.has(identity), 'Unexercised room finish ' + identity)
  for (const condition of ['clean', 'worn', 'cracked', 'mossy', 'grimy'])
    assert.ok(conditions.has(condition), 'Unexercised surface ' + condition)
  for (const kind of [
    'room',
    'slab',
    'mosaic',
    'corridor',
    'corridor-slab',
    'threshold',
    'wall',
    'wall-dressed',
  ])
    assert.ok(kinds.has(kind), 'Unexercised paving ' + kind)
  fs.writeFileSync(
    path.join(output, 'stone-detail.png'),
    Buffer.from(await evaluate('verification.detail'), 'base64'),
  )
  const report = {
    timestamp: new Date().toISOString(),
    browser: await send('Browser.getVersion'),
    results,
    walk: { ...walk, ...moved },
    screenshots,
    runtimeErrors,
    legacy,
    materialCases,
    classicCompared: !!baselineFile,
  }
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify(report, null, 2))
} finally {
  socket?.close()
  processHandle.kill()
  // Keep the isolated profile in the OS temp directory: Chrome may still be flushing it.
}
