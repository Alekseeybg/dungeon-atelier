import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {
  DEFAULT_CONFIG,
  generateDungeon,
  validateFloor,
} from '../packages/dungeon-core/dist/index.js'
import { browserSession, poll } from '../tests/helpers/browser.mjs'
import { formatProductionReports } from './format-production-reports.mjs'

const output = path.resolve('reports/production')
fs.mkdirSync(output, { recursive: true })
const b = await browserSession('http://localhost:9000'),
  report = { maps: [], variants: [], interactions: {}, layouts: [] }
const save = (file, png) =>
  fs.writeFileSync(path.join(output, file + '.png'), Buffer.from(png, 'base64'))
const state = () => b.evaluate(`prod.state()`)
const ready = async (seed) =>
  poll(async () => {
    const s = await state()
    return s.seed === seed && !s.loading
  }, 'Committed ' + seed)
const shot = async (name) =>
  save(name, (await b.send('Page.captureScreenshot', { format: 'png' })).data)
async function click(aria) {
  await b.evaluate(`document.querySelector('[aria-label=${JSON.stringify(aria)}]').click()`)
}
async function choose(aria, label) {
  await click(aria)
  await poll(
    () =>
      b.evaluate(
        `(()=>{const n=[...document.querySelectorAll('[role="option"]')].find(n=>n.textContent.trim()===${JSON.stringify(label)});if(!n)return false;n.click();return true})()`,
      ),
    'Choose ' + label,
  )
}
try {
  await b.evaluate(`(async()=>{
    const r=await import('/src/features/dungeon/rendering/dungeon-renderer.ts'),a=await import('/src/features/dungeon/rendering/ancient-settings.ts'),
      store=(await import('/src/stores/dungeon.ts')).useDungeonStore(),appearance=(await import('/src/stores/appearance.ts')).useAppearanceStore(),
      component=()=>document.querySelector('.dungeon-canvas').__vueParentComponent,
      resources=await import('/src/features/dungeon/rendering/map-resources.ts'),
      png=c=>c.toDataURL().split(',')[1],hash=c=>{let h=2166136261;for(const x of c.getContext('2d').getImageData(0,0,c.width,c.height).data)h=Math.imul(h^x,16777619);return(h>>>0).toString(16)},
      overview=source=>{const c=document.createElement('canvas');c.width=Math.min(1536,source.width);c.height=Math.round(source.height*c.width/source.width);c.getContext('2d').drawImage(source,0,0,c.width,c.height);return c},
      detail=(source,p)=>{const c=document.createElement('canvas');c.width=512;c.height=384;c.getContext('2d').drawImage(source,(32+p.x*32-32)*2,(32+p.y*26-32)*2,256,192,0,0,512,384);return c};
    window.prod={r,a,store,appearance,component,state:()=>component().exposed.getRenderState(),resources,png,hash,overview,detail};
  })()`)
  await poll(async () => {
    const s = await state()
    return s.seed && !s.loading
  }, 'Initial approved renderer')
  assert.equal((await state()).style, 'ancient')
  report.defaultStyle = 'ancient'
  // Pixel reference is the existing approved scene compositor, not a second implementation.
  report.approvedSceneParity = await b.evaluate(
    `(async()=>{const base='/src/features/dungeon/rendering/visual-foundation/',r=await import(base+'renderer.ts'),s=await import(base+'finishing-scene.ts'),p=await import(base+'final-style.ts'),source=s.createFinishingScene(),expected=await r.renderFoundation(p.FINAL_FOUNDATION,source),actual=await r.composeFoundation(source,p.FINAL_FOUNDATION),equal=prod.hash(expected)===prod.hash(actual.image);expected.width=expected.height=1;actual.dispose();return equal})()`,
  )
  assert(report.approvedSceneParity)
  const checkpoint = path.join(output, 'matrix.json'),
    replay = process.argv.includes('--interactions-only') && fs.existsSync(checkpoint)
  if (replay) report.maps = JSON.parse(fs.readFileSync(checkpoint, 'utf8'))
  let index = 0
  for (const size of replay ? [] : [32, 64, 96])
    for (const layout of ['classic', 'compact'])
      for (const suffix of ['amber', 'slate']) {
        const config = {
            ...DEFAULT_CONFIG,
            width: size,
            height: size,
            seed: `production-${size}-${layout}-${suffix}`,
            layoutStyle: layout,
            roomSpacing: layout === 'classic' ? 3 : 1,
            targetRoomCount: size === 32 ? 8 : size === 64 ? 24 : 48,
            maxRoomSize: size === 32 ? 7 : 12,
            roomShapeChance: 0.6,
            chamberBlockChance: 0.5,
            shortcutChance: 1,
          },
          result = generateDungeon(config)
        assert(result.ok, JSON.stringify(result))
        assert(validateFloor(result.floor).valid)
        const floor = result.floor,
          material = [
            'refined',
            'previous',
            'study-weathered',
            'study-irregular',
            'study-broad',
            'study-blended',
            'study-early',
          ][index % 7],
          cap = ['cut', 'chamfer', 'hewn', 'fitted', 'broken'][index % 5],
          wall = ['ruins', 'fortress', 'original'][index % 3],
          regional = [3, 7, 10].includes(index),
          stem = `${size}-${layout}-${suffix}-${material}-${cap}`,
          settings = {
            floor: material,
            cap,
            wall,
            distribution: regional ? 'regional' : 'uniform',
            corridor: regional ? 'previous' : 'inherit',
          }
        const started = performance.now()
        await b.evaluate(
          `(async()=>{prod.appearance.style='ancient';Object.assign(prod.appearance.ancient,prod.a.DEFAULT_ANCIENT,${JSON.stringify(settings)});Object.assign(prod.store.config,${JSON.stringify(config)});await prod.store.generate()})()`,
        )
        await ready(config.seed)
        assert.equal(await b.evaluate(`JSON.stringify(prod.store.floor)`), JSON.stringify(floor))
        const data = await b.evaluate(`(async()=>{
      const p=prod,s=p.state(),before=JSON.stringify(p.store.floor),start=performance.now(),image=await p.r.createMapCanvasAsync(p.store.floor,s.grid,s.style,s.options),duration=performance.now()-start,
        g=await import('/src/features/dungeon/rendering/visual-foundation/generated-scene.ts'),m=await import('/src/features/dungeon/rendering/dimensional-model.ts'),
        markerApi=await import('/src/features/dungeon/rendering/visual-foundation/stair-placement.ts'),projection=await import('/src/features/dungeon/rendering/visual-foundation/model.ts'),
        scene=g.generatedFoundationScene(p.store.floor,s.options.revealSecrets),plan=m.createDimensionalPlan(scene.floor,{revealSecrets:true}),
        markers=markerApi.projectedStairMarkers(scene.floor,plan),markerPixels=scene.floor.stairs.map(stair=>{const box=markers.get(stair.id);if(!box)throw Error('No visible stair sign '+stair.id);const point=markerApi.stairMarkerPoint(box);return{direction:stair.direction,mount:box.plane??'floor',color:[...image.getContext('2d').getImageData((32+point.x)*2,(32+point.y)*2,1,1).data]}}),
        map=p.png(p.overview(image)),stairs=scene.floor.stairs.map(stair=>({direction:stair.direction,png:p.png(p.detail(image,stair.position))})),
        hash=p.hash(image),raster=[image.width,image.height],torchFacings=Object.values(scene.torchFacings),geometry=[...new Set(plan.walls.map(w=>w.mask))],details=[];
      if(${index}===0){for(const face of ['south','east']){const t=scene.torches.find(t=>scene.torchFacings[t.x+','+t.y]===face);if(t)details.push({name:'torch-'+face,png:p.png(p.detail(image,t))})}for(const face of ['north','south','east','west']){const d=scene.floor.doors.find(d=>scene.facings[d.id]===face);if(d)details.push({name:'door-'+face,png:p.png(p.detail(image,d.position))})}}
      p.r.disposeMapCanvas(image);if(before!==JSON.stringify(p.store.floor))throw Error('Renderer mutated source');return{map,stairs,details,hash,raster,renderMs:Math.round(duration),torches:scene.torches.length,front:torchFacings.filter(f=>f==='south').length,side:torchFacings.filter(f=>f==='east').length,markerPixels,geometry,resources:p.resources.mapResourceStats()}
    })()`)
        save(stem, data.map)
        for (const d of data.details) save('detail-' + d.name, d.png)
        for (const stair of data.stairs) save(`${stem}-stairs-${stair.direction}`, stair.png)
        if (suffix === 'amber') await shot(`${size}-${layout}-editor`)
        fs.writeFileSync(
          path.join(output, config.seed + '.json'),
          JSON.stringify(floor, null, 2) + '\n',
        )
        report.maps.push({
          seed: config.seed,
          size,
          layout,
          material,
          wall,
          cap,
          regional,
          file: stem + '.png',
          hash: data.hash,
          raster: data.raster,
          renderMs: data.renderMs,
          editorReadyMs: Math.round(performance.now() - started),
          torches: data.torches,
          front: data.front,
          side: data.side,
          geometry: data.geometry,
          markerPixels: data.markerPixels,
          resources: data.resources,
          sourceUnchanged: true,
        })
        assert.equal(data.resources.live, 1)
        for (const marker of data.markerPixels) {
          const [r, g, b] = marker.color
          assert(
            r > 170 && g > 145 && b < 160 && r - b > 45,
            `${config.seed}: obscured ${marker.direction} marker ${marker.color}`,
          )
        }
        console.log(
          `${config.seed}: ${material} / ${wall} / ${cap}; ${data.renderMs} ms; ${data.torches} sconces`,
        )
        index++
      }
  fs.writeFileSync(checkpoint, JSON.stringify(report.maps, null, 2) + '\n')
  const compareAt = process.argv.indexOf('--compare-baseline')
  if (compareAt !== -1) {
    const baseline = JSON.parse(fs.readFileSync(process.argv[compareAt + 1], 'utf8'))
    assert.equal(report.maps.length, baseline.length)
    for (const map of report.maps)
      assert.equal(
        map.hash,
        baseline.find((m) => m.seed === map.seed)?.hash,
        `${map.seed}: refactor changed rendered pixels`,
      )
    report.refactorPixelsUnchanged = true
  }
  report.variants = {
    floors: [...new Set(report.maps.map((m) => m.material))],
    walls: [...new Set(report.maps.map((m) => m.wall))],
    caps: [...new Set(report.maps.map((m) => m.cap))],
  }
  assert.equal(new Set(report.maps.map((m) => m.material)).size, 7)
  assert.equal(new Set(report.maps.map((m) => m.wall)).size, 3)
  assert.equal(new Set(report.maps.map((m) => m.cap)).size, 5)
  // All seven source materials can be selected through the same production entry.
  await b.evaluate(
    `(async()=>{Object.assign(prod.store.config,{width:32,height:32,targetRoomCount:8,maxRoomSize:7,seed:'production-controls',layoutStyle:'classic',roomSpacing:3});prod.appearance.reset();await prod.store.generate()})()`,
  )
  await ready('production-controls')
  await click('Dungeon materials')
  await choose('Primary floor material', 'Broad natural slabs')
  await poll(async () => {
    const s = await state()
    return !s.loading && s.options.ancient.floor === 'study-broad'
  }, 'Material control committed')
  await click('Dungeon materials')
  await poll(
    () => b.evaluate(`document.querySelectorAll('.q-menu').length===0`),
    'Materials popup closed',
  )
  report.interactions.materialControl = true
  // Inverse projection and actual canvas pointer inspection at a protected room interior.
  const target = await b.evaluate(
    `prod.store.floor.rooms.flatMap(r=>{const cells=[];for(let y=r.y+1;y<r.y+r.height-1;y++)for(let x=r.x+1;x<r.x+r.width-1;x++)if([-1,0,1].every(dy=>[-1,0,1].every(dx=>prod.store.floor.tiles[y+dy]?.[x+dx]==='floor')))cells.push({x,y});return cells})[0]`,
  )
  assert(target)
  const location = await b.evaluate(
    `(()=>{const s=prod.state(),r=document.querySelector('.dungeon-canvas').getBoundingClientRect(),p=${JSON.stringify(target)};return {x:r.left+s.camera.x+(p.x+.5)*32*s.camera.scale,y:r.top+s.camera.y+(p.y+.5)*26*s.camera.scale}})()`,
  )
  for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased'])
    await b.send('Input.dispatchMouseEvent', {
      type,
      x: location.x,
      y: location.y,
      button: type === 'mouseMoved' ? 'none' : 'left',
      clickCount: 1,
    })
  await poll(
    async () => JSON.stringify((await state()).selected) === JSON.stringify(target),
    'Projected pointer selection',
  )
  report.interactions.projectedSelection = true
  const previous = await state()
  await click('Zoom in')
  assert((await state()).camera.scale > previous.camera.scale)
  const afterZoom = await state()
  await b.evaluate(
    `document.querySelector('.dungeon-canvas').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}))`,
  )
  assert.equal((await state()).camera.x, afterZoom.camera.x - 40)
  report.interactions.zoomAndPan = true
  await click('Enter walk mode')
  await poll(async () => {
    const s = await state()
    return s.walk.active && !s.loading && s.options.revealSecrets
  }, 'Projected walk frame')
  const entry = await state()
  assert.equal(entry.walk.explored, 9)
  const heading = await b.evaluate(
    `(()=>{const p=prod.state().walk.position,f=prod.store.floor;return [[0,-1],[1,0],[0,1],[-1,0]].findIndex(([dx,dy])=>['floor','door'].includes(f.tiles[p.y+dy]?.[p.x+dx]))})()`,
  )
  for (let i = 0; i < heading; i++) await click('Turn right')
  await click('Walk forward')
  const advanced = await state()
  assert.equal(advanced.walk.steps, 1)
  assert(advanced.walk.explored >= entry.walk.explored)
  await click('Walk backward')
  const returned = await state()
  assert.deepEqual(returned.walk.position, entry.walk.position)
  assert.equal(returned.walk.explored, advanced.walk.explored)
  await shot('walk-fog')
  report.interactions.walkAndPersistentFog = true
  await click('Exit walk mode')
  await poll(async () => {
    const s = await state()
    return !s.walk.active && !s.loading
  }, 'Walk exit')
  // Race the async renderer: only the final settings may commit; retention returns to one scene.
  await b.evaluate(
    `(async()=>{for(const floor of prod.a.ANCIENT_FLOORS){prod.appearance.ancient.floor=floor.value;await Promise.resolve()}prod.appearance.ancient.floor='refined'})()`,
  )
  await poll(async () => {
    const s = await state()
    return !s.loading && s.options.ancient.floor === 'refined'
  }, 'Final material after rapid changes')
  assert.equal(await b.evaluate(`prod.resources.mapResourceStats().live`), 1)
  report.interactions.staleRequestsAndBoundedRetention = true
  // Inject a failed decode for a nonresident combination. The committed image survives.
  const validFrame = await state()
  await b.evaluate(
    `(()=>{prod.Image=window.Image;window.Image=class extends prod.Image{decode(){return Promise.reject(new Error('Injected artwork failure'))}};Object.assign(prod.appearance.ancient,{wall:'original',floor:'study-weathered'})})()`,
  )
  await poll(
    () => b.evaluate(`prod.store.errors.some(s=>s.includes('Injected artwork failure'))`),
    'Asset error reported',
  )
  const failed = await state()
  assert.deepEqual(failed.options, validFrame.options)
  assert.deepEqual(failed.raster, validFrame.raster)
  await b.evaluate(`window.Image=prod.Image;prod.store.errors=[];prod.appearance.reset()`)
  await poll(async () => {
    const s = await state()
    return !s.loading && s.options.ancient.wall === 'ruins'
  }, 'Asset recovery')
  report.interactions.assetFailurePreservesFrame = true
  for (const style of ['classic', 'stone', 'dimensional', 'ancient']) {
    await b.evaluate(`prod.appearance.style=${JSON.stringify(style)}`)
    await poll(async () => {
      const s = await state()
      return s.style === style && !s.loading
    }, 'Fallback ' + style)
  }
  report.interactions.fallbackThemes = true
  // PNG download must contain the same settings/native raster as the editor, without camera overlays.
  const downloads = path.resolve('apps/dungeon-atelier/.quasar/production-downloads-' + Date.now())
  fs.mkdirSync(downloads, { recursive: true })
  await b.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads })
  const expected = await b.evaluate(
    `(async()=>{const s=prod.state(),c=await prod.r.createMapCanvasAsync(prod.store.floor,s.grid,s.style,s.options),result={hash:prod.hash(c),width:c.width,height:c.height};prod.r.disposeMapCanvas(c);return result})()`,
  )
  await b.evaluate(
    `([...document.querySelectorAll('button')].find(n=>n.textContent.includes('Export'))).click()`,
  )
  await poll(
    () =>
      b.evaluate(
        `(()=>{const n=[...document.querySelectorAll('.q-item')].find(n=>n.textContent.includes('PNG image'));if(!n)return false;n.click();return true})()`,
      ),
    'PNG menu',
  )
  const file = path.join(downloads, 'dungeon-floor-1-production-controls.png')
  await poll(() => fs.existsSync(file), 'PNG download')
  const png = fs.readFileSync(file)
  assert.equal(png.readUInt32BE(16), expected.width)
  assert.equal(png.readUInt32BE(20), expected.height)
  const actualHash = await b.evaluate(
    `(async()=>{const image=new Image();image.src='data:image/png;base64,${png.toString('base64')}';await image.decode();const c=document.createElement('canvas');c.width=image.width;c.height=image.height;c.getContext('2d').drawImage(image,0,0);return prod.hash(c)})()`,
  )
  assert.equal(actualHash, expected.hash)
  fs.writeFileSync(path.join(output, 'export-native.png'), png)
  report.interactions.pngExactPixels = true
  for (const [width, height, dpr] of [
    [1920, 1080, 1],
    [2560, 1440, 1],
    [390, 844, 2],
  ]) {
    await b.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: dpr,
      mobile: width < 600,
    })
    await poll(
      () => b.evaluate(`document.documentElement.scrollWidth<=innerWidth+1`),
      'Responsive editor ' + width,
    )
    const metrics = await b.evaluate(
      `({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,overlays:[...document.querySelectorAll('vite-error-overlay,vite-plugin-checker-error-overlay')].map(n=>n.shadowRoot?.querySelector('main')?.innerText||'').filter(Boolean)})`,
    )
    assert.deepEqual(metrics.overlays, [])
    report.layouts.push({ ...metrics, height, dpr })
    await shot('editor-' + width)
  }
  assert.deepEqual(b.errors, [])
  report.runtimeErrors = b.errors
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n')
  fs.writeFileSync(
    path.join(output, 'index.html'),
    `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Dungeon Atelier · production integration</title><style>body{background:#101619;color:#e9e4d8;font:18px system-ui;margin:24px}a{color:#dfc48a}img{max-width:100%;display:block}article{margin:32px 0}h2{font-size:22px}</style><h1>Production visual integration</h1><p>12 generated maps, 3 sizes, 2 layouts, 2 seeds each. All seven floors, three wall families and five cap assemblies run through the actual editor and its shared export renderer.</p><p><a href="report.json">Validation report</a> · <a href="details-report.json">Zoom and interaction details</a> · <a href="placement-report.json">300-layout placement audit</a></p><p>Recommended Ancient theme: <a href="recommended-32.png">Small</a> · <a href="recommended-64.png">Medium</a> · <a href="recommended-96.png">Large</a></p><p>Architecture close-ups: <a href="detail-torch-south.png">North sconce</a> · <a href="detail-torch-east.png">Side sconce</a> · <a href="detail-door-north.png">North doorway</a> · <a href="detail-door-south.png">South doorway</a> · <a href="detail-door-east.png">East doorway</a> · <a href="detail-door-west.png">West doorway</a></p>${report.maps.map((m) => `<article><h2>${m.size}×${m.size} · ${m.layout} · ${m.material} · ${m.wall} · ${m.cap}</h2><p>${m.seed} · ${m.torches} sconces · ${m.renderMs} ms render · <a href="${m.file.replace('.png', '-stairs-up.png')}">Up stairs</a> · <a href="${m.file.replace('.png', '-stairs-down.png')}">Down stairs</a></p><a href="${m.file}"><img loading="lazy" src="${m.file}" alt="Generated dungeon using production artwork"></a></article>`).join('')}</html>`,
  )
  await formatProductionReports()
  console.log(
    JSON.stringify(
      {
        passed: true,
        maps: report.maps.length,
        interactions: report.interactions,
        layouts: report.layouts,
      },
      null,
      2,
    ),
  )
} catch (error) {
  await shot('failed-check')
  console.log(
    await b.evaluate(
      `({state:prod.state(),text:document.body.innerText.slice(-1800),errors:prod.store.errors})`,
    ),
  )
  throw error
} finally {
  b.close()
}
