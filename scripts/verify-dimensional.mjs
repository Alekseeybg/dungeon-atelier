import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {
  DEFAULT_CONFIG,
  generateDungeon,
  exportFloorJson,
} from '../packages/dungeon-core/dist/index.js'
import { browserSession, pause, poll } from '../tests/helpers/browser.mjs'
import { dimensionalBenchmark } from './scenes/dimensional-benchmark.mjs'
const args = process.argv.slice(2),
  option = (key, fallback) => (args.includes(key) ? args[args.indexOf(key) + 1] : fallback)
const output = path.resolve(option('--output', 'reports/dimensional/final'))
fs.mkdirSync(output, { recursive: true })
const baseline = JSON.parse(fs.readFileSync('reports/dimensional/baseline.json', 'utf8'))
const browser = await browserSession(option('--url', 'http://localhost:9000'))
try {
  const evaluate = browser.evaluate
  await evaluate(`(async()=>{
  window.dimensionalTest={renderer:await import('/src/features/dungeon/rendering/dungeon-renderer.ts'),sprites:await import('/src/features/dungeon/rendering/dimensional-sprites.ts'),model:await import('/src/features/dungeon/rendering/dimensional-model.ts'),art:await import('/src/features/dungeon/rendering/dimensional-art.ts'),cutaway:await import('/src/features/dungeon/rendering/dimensional-renderer.ts'),fog:await import('/src/features/dungeon/rendering/walk-fog.ts'),store:(await import('/src/stores/dungeon.ts')).useDungeonStore()}
  const start=performance.now();await dimensionalTest.sprites.prepareDimensionalAtlas();dimensionalTest.loadMs=performance.now()-start
  dimensionalTest.hash=canvas=>{let value=2166136261;for(const byte of canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data)value=Math.imul(value^byte,16777619);return(value>>>0).toString(16)}
  dimensionalTest.state=()=>document.querySelector('.dungeon-canvas').__vueParentComponent.setupState
 })()`)
  const oldThemeComparisons = []
  for (const [index, [width, height]] of [
    [0, [32, 32]],
    [1, [64, 64]],
    [2, [48, 32]],
  ]) {
    const result = generateDungeon({
      ...DEFAULT_CONFIG,
      width,
      height,
      seed: `visual-verification-${index}`,
      roomShapeChance: 1,
      shortcutChance: 1,
      chamberBlockChance: 1,
    })
    assert(result.ok)
    const hashes = await evaluate(
      `(()=>{const t=dimensionalTest,floor=${JSON.stringify(result.floor)},hashes={};for(const style of ['stone','classic'])for(const grid of [false,true])hashes[style+'-'+grid]=t.hash(t.renderer.createMapCanvas(floor,grid,style));return hashes})()`,
    )
    assert.deepEqual(hashes, baseline.results[index].hashes, 'Existing theme pixels changed')
    oldThemeComparisons.push({ seed: result.floor.seed, hashes })
  }
  const benchmark = dimensionalBenchmark()
  const architecture = await evaluate(`(async()=>{
  const t=dimensionalTest,floor=${JSON.stringify(benchmark)},before=JSON.stringify(floor),tw=structuredClone(floor)
  for(const route of tw.shortcuts)for(const p of route.path)tw.tiles[p.y][p.x]='wall'
  tw.doors=tw.doors.filter(door=>door.type!=='secret');tw.shortcuts=[]
  const hashes={}
  for(const grid of [false,true]){
    const hidden=t.renderer.createMapCanvas(floor,grid,'dimensional'),twin=t.renderer.createMapCanvas(tw,grid,'dimensional')
    if(t.hash(hidden)!==t.hash(twin))throw new Error('Secret architecture visually leaked')
    if(t.hash(hidden)!==t.hash(t.renderer.createMapCanvas(floor,grid,'dimensional')))throw new Error('Nondeterministic dimensional rendering')
    hashes['concealed-'+grid]=t.hash(hidden)
  }
  const shown=t.renderer.createMapCanvas(floor,false,'dimensional',{revealSecrets:true,openDoorIds:['door-a']})
  t.benchmark=shown
  const bounds=t.renderer.mapRenderBounds(floor,'dimensional')
  if(shown.width!==bounds.width||shown.height!==bounds.height)throw new Error('Padded canvas dimensions do not match')
  const blob=await new Promise(resolve=>shown.toBlob(resolve,'image/png')),image=await createImageBitmap(blob)
  if(image.width!==bounds.width||image.height!==bounds.height)throw new Error('PNG dimensions lost padding');image.close()
  if(JSON.stringify(floor)!==before)throw new Error('Rendering mutated floor')
  const atlas=t.sprites.getDimensionalAtlas(32)
  if(atlas.provenance!=='generated-raster')throw new Error('Raster art was not loaded')
  for(const family of ['flagstone','slab','corridor','repair','ornament']){
    const pattern=t.art.paintedFloorPattern(family),c=pattern.getContext('2d'),p=c.getImageData(0,0,256,256).data
    for(let i=0;i<256;i++)for(let channel=0;channel<4;channel++){
      if(p[(i*256)*4+channel]!==p[(i*256+255)*4+channel]||p[i*4+channel]!==p[(255*256+i)*4+channel])throw new Error('Material period has an edge seam: '+family)
    }
  }
  const art=t.art.dimensionalArt()
  for(const key of ['door','portal','inlay','torch']){const data=art[key].getContext('2d').getImageData(0,0,art[key].width,art[key].height).data;if(!data.some((byte,index)=>index%4===3&&byte<255))throw new Error('Missing alpha: '+key)}
  t.atlas=atlas
  return {hashes,concealment:'Pixel-identical to independently sealed public twin',dimensions:bounds,atlasProvenance:atlas.provenance,atlasSprites:atlas.sprites.size,materialSeams:'All repeat edges match',loadMs:t.loadMs}
 })()`)
  for (const [name, expression] of [
    ['benchmark', 'dimensionalTest.benchmark'],
    ['atlas', 'dimensionalTest.atlas.image'],
  ])
    fs.writeFileSync(
      path.join(output, name + '.png'),
      Buffer.from(await evaluate(expression + '.toDataURL().split(",")[1]'), 'base64'),
    )
  fs.writeFileSync(
    path.join(output, 'atlas.json'),
    JSON.stringify(await evaluate('[...dimensionalTest.atlas.sprites.values()]'), null, 2) + '\n',
  )
  const maps = []
  for (const size of [24, 32, 48, 64, 96])
    for (const preset of ['classic', 'compact']) {
      const result = generateDungeon({
        ...DEFAULT_CONFIG,
        width: size,
        height: size,
        layoutStyle: preset,
        roomSpacing: preset === 'classic' ? 3 : 1,
        seed: `dimensional-${size}-${preset}`,
        targetRoomCount: size === 96 ? 30 : 12,
        roomShapeChance: 0.65,
        shortcutChance: 1,
        chamberBlockChance: 1,
      })
      assert(result.ok, result.errors?.join(';'))
      const measurements = await evaluate(
        `(()=>{const t=dimensionalTest,floor=${JSON.stringify(result.floor)},before=JSON.stringify(floor),times={};for(const style of ['stone','classic','dimensional']){const samples=[];for(let i=0;i<3;i++){const start=performance.now();const canvas=t.renderer.createMapCanvas(floor,false,style,{revealSecrets:true});samples.push(performance.now()-start);if(style==='dimensional')t.last=canvas}times[style]=samples}if(JSON.stringify(floor)!==before)throw new Error('Changed source geometry');return times})()`,
      )
      maps.push({ size, preset, measurements })
    }
  for (const file of ['legacy-v1.json', 'legacy-v2.json']) {
    const json = fs.readFileSync(new URL('../tests/fixtures/' + file, import.meta.url), 'utf8')
    assert.equal(
      await evaluate(
        `(()=>{const t=dimensionalTest;t.store.importJson(${JSON.stringify(json)});if(t.store.errors.length)throw new Error(t.store.errors.join(';'));t.renderer.createMapCanvas(t.store.floor,false,'dimensional');return JSON.stringify(t.store.floor)===JSON.stringify(JSON.parse(${JSON.stringify(json)}))})()`,
      ),
      true,
    )
  }
  await evaluate(`dimensionalTest.store.importJson(${JSON.stringify(exportFloorJson(benchmark))})`)
  await pause(180)
  async function theme(label, value) {
    await evaluate(`document.querySelector('[aria-label="Map appearance"]').click()`)
    await poll(
      () =>
        evaluate(
          `(()=>{const option=[...document.querySelectorAll('[role="option"]')].find(item=>item.textContent.trim()===${JSON.stringify(label)});if(!option)return false;option.click();return true})()`,
        ),
      'theme option',
    )
    await poll(
      () =>
        evaluate(
          `dimensionalTest.state().mapStyle===${JSON.stringify(value)}&&!dimensionalTest.state().loadingTheme`,
        ),
      'theme change',
    )
    await pause(100)
  }
  await theme('Dimensional Stone', 'dimensional')
  const initial = await evaluate(
    `(()=>{const t=dimensionalTest;const floor=t.store.floor;t.before=JSON.stringify(floor);t.cameraBefore={...t.state().camera};const mini=document.querySelector('.automap-canvas'),expected=document.createElement('canvas');expected.width=mini.width;expected.height=mini.height;expected.getContext('2d').drawImage(t.renderer.createMapCanvas(t.model.concealSecretArchitecture(floor),false,'classic'),0,0,expected.width,expected.height);if(t.hash(mini)!==t.hash(expected))throw new Error('Minimap revealed secrets');return {minimapConcealed:true,camera:{...t.state().camera}}})()`,
  )
  await evaluate(`document.querySelector('[aria-label="Zoom in"]').click()`)
  assert(await evaluate('dimensionalTest.state().camera.scale>dimensionalTest.cameraBefore.scale'))
  await evaluate(`document.querySelector('[aria-label="Fit map to viewport"]').click()`)
  const point = await evaluate(
    `(()=>{const t=dimensionalTest,r=document.querySelector('.dungeon-canvas').getBoundingClientRect(),camera=t.state().camera,p=t.store.floor.stairs[0].position;return{x:r.left+camera.x+(p.x+.5)*32*camera.scale,y:r.top+camera.y+(p.y+.5)*32*camera.scale,expected:p}})()`,
  )
  for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased'])
    await browser.send('Input.dispatchMouseEvent', {
      type,
      x: point.x,
      y: point.y,
      ...(type === 'mouseMoved' ? {} : { button: 'left', clickCount: 1 }),
    })
  await pause(100)
  assert.deepEqual(
    await evaluate(
      "JSON.parse(JSON.stringify(document.querySelector('.dungeon-canvas').__vueParentComponent.props.selected))",
    ),
    point.expected,
    'Padding broke tile inspection',
  )
  const cameraBeforePan = await evaluate('({...dimensionalTest.state().camera})')
  await browser.send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: 'ArrowRight',
    code: 'ArrowRight',
    windowsVirtualKeyCode: 39,
  })
  assert(
    await evaluate(`dimensionalTest.state().camera.x<${cameraBeforePan.x}`),
    'Keyboard pan did not move camera',
  )
  await evaluate(
    `document.querySelector('[aria-label="Fit map to viewport"]').click();document.querySelector('[aria-label="Map overlays"]').click()`,
  )
  await pause(100)
  await evaluate(
    `document.querySelector('[aria-label="Reveal secret architecture"]').click();document.querySelector('[aria-label="Show tile grid"]').click()`,
  )
  await pause(180)
  assert(
    await evaluate(
      'dimensionalTest.state().renderOptions.revealSecrets&&dimensionalTest.state().showGrid',
    ),
  )
  await browser.send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: 'Escape',
    code: 'Escape',
    windowsVirtualKeyCode: 27,
  })
  await evaluate(`document.querySelector('[aria-label="Enter walk mode"]').click()`)
  await pause(180)
  assert(
    await evaluate(
      `(()=>{const n=document.querySelector('.dungeon-canvas'),w=n.__vueParentComponent.props.walk;if(!w.active||w.explored.size!==9||dimensionalTest.state().renderOptions.revealSecrets)throw new Error('Walk privacy/reveal mismatch');dimensionalTest.exploredBefore=[...w.explored];return true})()`,
    ),
  )
  for (let i = 0; i < 4; i++)
    await evaluate(
      `document.querySelector('[aria-label="Walk forward"]').click();document.querySelector('[aria-label="Turn right"]').click()`,
    )
  const walk = await evaluate(
    `(()=>{const w=document.querySelector('.dungeon-canvas').__vueParentComponent.props.walk;if(w.steps<1||!dimensionalTest.exploredBefore.every(key=>w.explored.has(key)))throw new Error('Walking lost explored tiles');return{steps:w.steps,explored:w.explored.size}})()`,
  )
  const cutaway = await evaluate(`(()=>{
  const t=dimensionalTest,floor=t.store.floor,map=t.renderer.createMapCanvas(floor,false,'dimensional'),bounds=t.renderer.mapRenderBounds(floor,'dimensional')
  const canvas=document.createElement('canvas');canvas.width=map.width;canvas.height=map.height
  const c=canvas.getContext('2d');c.drawImage(map,0,0);c.translate(bounds.origin.x,bounds.origin.y)
  const walk={active:true,position:{x:6,y:9},heading:0,explored:new Set(),visible:new Set(),steps:0,message:''}
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)walk.explored.add((9+dy)*floor.width+6+dx)
  const before=t.hash(canvas);t.cutaway.drawDimensionalWalkCutaway(c,map,walk)
  if(t.hash(canvas)===before)throw new Error('Underfoot cap cutaway was not applied')
  t.fog.renderWalkFog(c,floor,walk)
  const arrow=c.getImageData(bounds.origin.x+6*32+16,bounds.origin.y+9*32+16,1,1).data
  if(arrow[0]!==247||arrow[1]!==213||arrow[2]!==107)throw new Error('Raised wall obscured arrow')
  const unknown=c.getImageData(bounds.origin.x+32,bounds.origin.y+32,1,1).data
  if(unknown[0]!==8||unknown[1]!==12||unknown[2]!==13)throw new Error('Unexplored art leaked through fog')
  t.walkProof=canvas
  return {arrowVisible:true,foregroundCutaway:true,unknownCovered:true}
 })()`)
  fs.writeFileSync(
    path.join(output, 'walk-cutaway.png'),
    Buffer.from(await evaluate('dimensionalTest.walkProof.toDataURL().split(",")[1]'), 'base64'),
  )
  await evaluate(`document.querySelector('[aria-label="Exit walk mode"]').click()`)
  await pause(100)
  assert.equal(
    await evaluate('JSON.stringify(dimensionalTest.store.floor)===dimensionalTest.before'),
    true,
    'Editor interactions mutated dungeon',
  )
  await evaluate(`document.querySelector('[aria-label="Map overlays"]').click()`)
  await pause(100)
  await evaluate(`document.querySelector('[aria-label="Show tile grid"]').click()`)
  await browser.send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: 'Escape',
    code: 'Escape',
    windowsVirtualKeyCode: 27,
  })
  const layouts = []
  for (const [width, height, deviceScaleFactor] of [
    [1920, 1080, 1],
    [1920, 1080, 2],
    [2560, 1440, 1],
    [390, 844, 2],
  ]) {
    await browser.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor,
      mobile: width < 600,
    })
    await evaluate("window.dispatchEvent(new Event('resize'))")
    await pause(300)
    const layout = await evaluate(
      `(()=>{const node=document.querySelector('.dungeon-canvas'),rect=node.getBoundingClientRect();return{width:innerWidth,scrollWidth:document.documentElement.scrollWidth,backingWidth:node.width,cssWidth:rect.width,dpr:devicePixelRatio,errors:[...document.querySelectorAll('vite-error-overlay,vite-plugin-checker-error-overlay')].map(node=>node.shadowRoot?.querySelector('main')?.innerText||'').filter(Boolean)}})()`,
    )
    assert(layout.scrollWidth <= width + 1, JSON.stringify(layout))
    assert(
      Math.abs(layout.backingWidth - layout.cssWidth * deviceScaleFactor) <= 1,
      'DPR backing dimensions are wrong: ' + JSON.stringify(layout),
    )
    assert.deepEqual(layout.errors, [])
    layouts.push(layout)
    const { data } = await browser.send('Page.captureScreenshot', { format: 'png' })
    fs.writeFileSync(
      path.join(output, `studio-${width}-dpr${deviceScaleFactor}.png`),
      Buffer.from(data, 'base64'),
    )
  }
  assert.deepEqual(browser.errors, [])
  const showcase = generateDungeon({
    ...DEFAULT_CONFIG,
    width: 64,
    height: 64,
    targetRoomCount: 16,
    minRoomSize: 5,
    maxRoomSize: 11,
    seed: 'material-verification-1',
    roomShapeChance: 0.65,
    chamberBlockChance: 1,
    shortcutChance: 1,
  })
  assert(showcase.ok)
  const png = await evaluate(
    `dimensionalTest.renderer.createMapCanvas(${JSON.stringify(showcase.floor)},false,'dimensional',{revealSecrets:true}).toDataURL().split(',')[1]`,
  )
  fs.writeFileSync(path.join(output, 'showcase.png'), Buffer.from(png, 'base64'))
  const report = {
    testedAt: new Date().toISOString(),
    browser: await browser.send('Browser.getVersion'),
    oldThemeComparisons,
    architecture,
    maps,
    editor: {
      ...initial,
      tileInspection: true,
      zoom: true,
      pan: true,
      fit: true,
      reveal: true,
      grid: true,
      walk,
      cutaway,
      geometryUnchanged: true,
    },
    layouts,
    runtimeErrors: browser.errors,
  }
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify(report, null, 2))
} finally {
  browser.close()
}
