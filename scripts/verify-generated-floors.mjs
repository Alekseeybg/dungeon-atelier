import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { format, resolveConfig } from 'prettier'
import {
  DEFAULT_CONFIG,
  generateDungeon,
  roomCells,
  validateFloor,
} from '../packages/dungeon-core/dist/index.js'
import { browserSession } from '../tests/helpers/browser.mjs'

const output = path.resolve('reports/visual-foundation/generated-floors')
fs.mkdirSync(output, { recursive: true })
const browser = await browserSession('http://localhost:9000')
const report = {
  generator: '3.1.0',
  zooms: [0.5, 1, 2],
  zoomRegions: ['room', 'corridor'],
  maps: [],
  cases: [],
}
function save(name, png) {
  fs.writeFileSync(path.join(output, name), Buffer.from(png, 'base64'))
}
try {
  const studies = await browser.evaluate(`(async()=>{
    const r=await import('/src/features/dungeon/rendering/visual-foundation/renderer.ts'),
      g=await import('/src/features/dungeon/rendering/visual-foundation/generated-scene.ts'),
      a=await import('/src/features/dungeon/rendering/visual-foundation/art.ts')
    const image=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c},
      png=c=>c.toDataURL().split(',')[1],
      hash=c=>{let h=2166136261;for(const v of c.getContext('2d').getImageData(0,0,c.width,c.height).data)h=Math.imul(h^v,16777619);return(h>>>0).toString(16)},
      overview=source=>{const w=Math.min(1536,source.width),c=image(w,Math.round(source.height*w/source.width));c.getContext('2d').drawImage(source,0,0,c.width,c.height);return c},
      crop=(source,p,zoom,w=512,h=384)=>{const c=image(w,h),ctx=c.getContext('2d');ctx.fillStyle='#080d10';ctx.fillRect(0,0,w,h);ctx.drawImage(source,(32+p.x*32)*2-w/zoom,(32+p.y*26)*2-h/zoom,w*2/zoom,h*2/zoom,0,0,w,h);return c}
    window.audit={r,g,a,image,png,hash,overview,crop,target:image(1,1)}
    return a.FLOOR_STUDIES.map(({value,label})=>({value,label}))
  })()`)
  report.studies = studies
  for (const size of [32, 64, 96])
    for (const layout of ['classic', 'compact'])
      for (const suffix of ['amber', 'slate', 'moss']) {
        const seed = `floor-audit-${size}-${layout}-${suffix}`
        const result = generateDungeon({
          ...DEFAULT_CONFIG,
          width: size,
          height: size,
          seed,
          layoutStyle: layout,
          roomSpacing: layout === 'classic' ? 3 : 1,
          targetRoomCount: size === 32 ? 8 : size === 64 ? 24 : 48,
          maxRoomSize: size === 32 ? 7 : 12,
          roomShapeChance: layout === 'classic' ? 0.3 : 0.7,
          chamberBlockChance: 0.5,
        })
        assert(result.ok, JSON.stringify(result))
        const floor = result.floor
        assert(validateFloor(floor).valid)
        const original = JSON.stringify(floor)
        fs.writeFileSync(path.join(output, seed + '.json'), original)
        const cells = floor.rooms.flatMap(roomCells)
        const owned = new Set(cells.map((p) => `${p.x},${p.y}`))
        const room = [...floor.rooms].sort((a, b) => roomCells(b).length - roomCells(a).length)[0]
        const center = roomCells(room).sort(
          (a, b) =>
            Math.hypot(a.x - room.x - room.width / 2, a.y - room.y - room.height / 2) -
            Math.hypot(b.x - room.x - room.width / 2, b.y - room.y - room.height / 2),
        )[0]
        const corridors = []
        for (let y = 2; y < size - 2; y++)
          for (let x = 2; x < size - 2; x++) {
            if (floor.tiles[y][x] !== 'floor' || owned.has(`${x},${y}`)) continue
            let run = 0
            for (let d = -5; d <= 5; d++)
              if (floor.tiles[y]?.[x + d] === 'floor' && !owned.has(`${x + d},${y}`)) run++
            corridors.push({ x, y, run })
          }
        const corridor = corridors.sort((a, b) => b.run - a.run)[0] || center
        const points = { room: center, corridor }
        for (const orientation of ['north-south', 'east-west']) {
          const door = floor.doors.find(
            (d) => d.type === 'regular' && d.orientation === orientation,
          )
          assert(door, `Missing orientation in ${seed}`)
          points[orientation] = door.position
        }
        const metadata = {
          seed,
          size,
          layout,
          rooms: floor.rooms.length,
          doors: floor.doors.length,
          points,
        }
        report.maps.push(metadata)
        await browser.evaluate(`(async()=>{
          const a=audit; a.source=a.g.generatedFoundationScene(${original});a.before=JSON.stringify(a.source);
          a.review=await a.r.prepareFoundationReview(a.source,{secret:'revealed'});
          a.sheets={};for(const region of ['room','corridor']){const sheet=a.image(7*384,3*320+42);sheet.getContext('2d').fillStyle='#080d10';sheet.getContext('2d').fillRect(0,0,sheet.width,sheet.height);a.sheets[region]=sheet}
        })()`)
        for (const [index, { value: material, label }] of studies.entries()) {
          const data = await browser.evaluate(`(async()=>{
            const a=audit,c=await a.review.render(${JSON.stringify(material)},a.target),
              overview=a.overview(c),points=${JSON.stringify(points)};
            const crops={};
            for(const region of ['room','corridor']){const ctx=a.sheets[region].getContext('2d');ctx.fillStyle='#e8dac0';ctx.font='16px sans-serif';ctx.fillText(${JSON.stringify(label)},${index}*384+8,27);let row=0;for(const zoom of [.5,1,2]){const detail=a.crop(c,points[region],zoom,384,320);ctx.drawImage(detail,${index}*384,42+row++*320)}}
            for(const [name,p]of Object.entries(points))crops[name]=a.png(a.crop(c,p,2));
            if(a.before!==JSON.stringify(a.source))throw Error('Generated source mutated');
            return{hash:a.hash(overview),dimensions:[c.width,c.height],overview:a.png(overview),crops}
          })()`)
          report.cases.push({
            seed,
            material,
            zooms: [0.5, 1, 2],
            hash: data.hash,
            dimensions: data.dimensions,
          })
          if (suffix === 'amber') {
            save(`${size}-${layout}-${material}-map.png`, data.overview)
            for (const [view, png] of Object.entries(data.crops))
              save(`${size}-${layout}-${material}-${view}.png`, png)
          }
          if (index === 0) {
            const again = await browser.evaluate(
              `(async()=>audit.hash(audit.overview(await audit.review.render('refined',audit.target))))()`,
            )
            assert.equal(again, data.hash, 'Nondeterministic generated-map review')
          }
        }
        for (const region of ['room', 'corridor']) {
          const zoomSheet = await browser.evaluate(
            `audit.png(audit.sheets[${JSON.stringify(region)}])`,
          )
          const name = region === 'room' ? 'zoom-comparison' : 'corridor-zoom-comparison'
          save(`${seed}-${name}.png`, zoomSheet)
          if (suffix === 'amber') save(`${size}-${layout}-${name}.png`, zoomSheet)
        }
        await browser.evaluate(
          `(()=>{audit.review.dispose();audit.review=null;audit.target.width=audit.target.height=1;for(const sheet of Object.values(audit.sheets))sheet.width=sheet.height=1})()`,
        )
        assert.equal(JSON.stringify(floor), original)
        console.log(`${seed}: seven floors at 50%, 100%, 200%`)
      }
  assert.equal(report.maps.length, 18)
  assert.equal(report.cases.length, 126)
  assert.deepEqual(browser.errors, [])
  report.runtimeErrors = browser.errors
  report.inputUnchanged = true
  report.deterministic = true
  report.scope =
    'Real generated geometry through the isolated visual-foundation renderer; not a production theme rollout. Stair metadata retained; preview has no stair artwork.'
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n')
  const options = studies.map((s) => `<option value="${s.value}">${s.label}</option>`).join('')
  fs.writeFileSync(
    path.join(output, 'index.html'),
    `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Generated floor verification</title><style>body{background:#101619;color:#e9e4d8;font:18px system-ui;margin:24px}select,a{font:inherit;color:inherit;background:#273237;padding:8px}header{position:sticky;top:0;background:#101619;padding:12px 0}img{display:block;max-width:100%;margin:16px 0}section{display:grid;grid-template-columns:1fr 1fr;gap:16px}@media(max-width:800px){section{display:block}}</style><h1>Generated floor review</h1><p>18 seeded dungeons · 126 material/map combinations · 50%, 100%, 200% zoom. Compare identical geometry. The seven-column sheet rows show those three zooms in order.</p><header><select id="size"><option>32</option><option>64</option><option>96</option></select> <select id="layout"><option>classic</option><option>compact</option></select> <select id="floor">${options}</select> <a href="report.json">Report and seeds</a></header><h2>Full map</h2><img id="map" alt="Generated full map"><h2>Room / corridor · 200%</h2><section><img id="room" alt="Room detail"><img id="corridor" alt="Corridor detail"></section><h2>North–south / east–west thresholds · 200%</h2><section><img id="ns" alt="North-south doorway"><img id="ew" alt="East-west doorway"></section><h2>Seven floors × three zooms</h2><img id="zooms" alt="Seven floors at 50, 100 and 200 percent"><script>const el=id=>document.getElementById(id);function update(){const stem=el('size').value+'-'+el('layout').value,material=stem+'-'+el('floor').value;for(const [id,suffix]of [['map','map'],['room','room'],['corridor','corridor'],['ns','north-south'],['ew','east-west']])el(id).src=material+'-'+suffix+'.png';el('zooms').src=stem+'-zoom-comparison.png'}document.querySelectorAll('select').forEach(n=>n.onchange=update);update()</script></html>`,
  )
  const prettier = await resolveConfig('package.json')
  for (const file of fs.readdirSync(output).filter((file) => /\.(json|html)$/.test(file))) {
    const target = path.join(output, file)
    fs.writeFileSync(
      target,
      await format(fs.readFileSync(target, 'utf8'), {
        ...prettier,
        parser: file.endsWith('.json') ? 'json' : 'html',
      }),
    )
  }
  console.log(
    JSON.stringify({ passed: true, maps: 18, materialCases: 126, zoomViews: 756, output }),
  )
} finally {
  browser.close()
}
