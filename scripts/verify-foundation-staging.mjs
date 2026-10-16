import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { format, resolveConfig } from 'prettier'
import {
  DEFAULT_CONFIG,
  generateDungeon,
  validateFloor,
} from '../packages/dungeon-core/dist/index.js'
import { browserSession } from '../tests/helpers/browser.mjs'
const output = path.resolve('reports/visual-foundation/staging')
fs.mkdirSync(output, { recursive: true })
const browser = await browserSession('http://localhost:9000'),
  report = {
    scope: 'Staging preflight, not a production rollout. Stairs and torches await visual approval.',
    maps: [],
    cases: [],
  }
try {
  const floors = await browser.evaluate(`(async()=>{
    const r=await import('/src/features/dungeon/rendering/visual-foundation/renderer.ts'),g=await import('/src/features/dungeon/rendering/visual-foundation/generated-scene.ts'),p=await import('/src/features/dungeon/rendering/visual-foundation/final-style.ts'),a=await import('/src/features/dungeon/rendering/visual-foundation/art.ts');
    const png=c=>c.toDataURL().split(',')[1],hash=c=>{let h=2166136261;for(const v of c.getContext('2d').getImageData(0,0,c.width,c.height).data)h=Math.imul(h^v,16777619);return(h>>>0).toString(16)},overview=source=>{const out=document.createElement('canvas');out.width=Math.min(1536,source.width);out.height=Math.round(source.height*out.width/source.width);out.getContext('2d').drawImage(source,0,0,out.width,out.height);return out},detail=(source,p)=>{const out=document.createElement('canvas');out.width=384;out.height=320;out.getContext('2d').drawImage(source,(32+p.x*32-32)*2,(32+p.y*26-32)*2,192,160,0,0,384,320);return out};
    window.staging={r,g,p,a,png,hash,overview,detail};return a.FLOOR_STUDIES.map(s=>s.value)
  })()`)
  let mapIndex = 0
  for (const size of [32, 64, 96])
    for (const layout of ['classic', 'compact']) {
      const seed = `floor-audit-${size}-${layout}-amber`,
        result = generateDungeon({
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
          shortcutChance: 1,
        })
      assert(result.ok, JSON.stringify(result))
      assert(validateFloor(result.floor).valid)
      const floor = result.floor,
        original = JSON.stringify(floor)
      fs.writeFileSync(
        path.join(output, seed + '.json'),
        await format(original, { ...(await resolveConfig('package.json')), parser: 'json' }),
      )
      report.maps.push({
        seed,
        size,
        layout,
        stairs: floor.stairs.length,
        torches: 0,
        secrets: floor.doors.filter((d) => d.type === 'secret').length,
      })
      for (const [index, cap] of ['cut', 'hewn', 'fitted'].entries()) {
        const material = floors[(mapIndex * 3 + index) % floors.length],
          stem = `${size}-${layout}-${material}-${cap}`
        const data = await browser.evaluate(
          `(async()=>{const a=staging,source=a.g.generatedFoundationScene(${original}),before=JSON.stringify(source),options={...a.p.FINAL_FOUNDATION,...${JSON.stringify(cap === 'cut' ? {} : cap === 'hewn' ? { capProfile: 'raised', capFinish: 'soft' } : { coping: 'current', capProfile: 'raised', capFinish: 'soft' })},secret:'revealed'},review=await a.r.prepareFoundationReview(source,options),image=await review.render(${JSON.stringify(material)}),map=a.png(a.overview(image)),stairs=source.floor.stairs.map(s=>({direction:s.direction,png:a.png(a.detail(image,s.position))})),hash=a.hash(image);if(before!==JSON.stringify(source))throw Error('Staging render mutated floor');image.width=image.height=1;review.dispose();return{map,stairs,hash,torches:source.torches.length,sourceUnchanged:true}})()`,
        )
        fs.writeFileSync(path.join(output, stem + '.png'), Buffer.from(data.map, 'base64'))
        if (index === 0)
          for (const stair of data.stairs)
            fs.writeFileSync(
              path.join(output, `${size}-${layout}-stairs-${stair.direction}.png`),
              Buffer.from(stair.png, 'base64'),
            )
        assert.equal(JSON.stringify(floor), original)
        report.maps.at(-1).torches = data.torches
        report.cases.push({
          seed,
          size,
          layout,
          floor: material,
          cap,
          hash: data.hash,
          stairs: data.stairs.map((s) => s.direction),
          torches: data.torches,
          sourceUnchanged: data.sourceUnchanged,
          file: stem + '.png',
        })
        console.log(`${size} ${layout} ${material} ${cap}: stairs and mounted torches rendered`)
      }
      mapIndex++
    }
  assert.equal(new Set(report.cases.map((c) => c.floor)).size, 7)
  assert(report.cases.every((c) => c.stairs.includes('up') && c.stairs.includes('down')))
  assert.deepEqual(browser.errors, [])
  report.runtimeErrors = browser.errors
  const config = await resolveConfig('package.json')
  fs.writeFileSync(
    path.join(output, 'report.json'),
    await format(JSON.stringify(report), { ...config, parser: 'json' }),
  )
  const cards = report.cases
    .map(
      (c) =>
        `<article data-size="${c.size}" data-cap="${c.cap}"><h2>${c.size} × ${c.size} · ${c.layout} · ${c.floor} · ${c.cap}</h2><p>${c.seed} · ${c.torches} sconces · up/down stairs</p><a href="${c.file}"><img loading="lazy" src="${c.file}" alt="Generated dungeon staging preview"></a></article>`,
    )
    .join('')
  fs.writeFileSync(
    path.join(output, 'index.html'),
    await format(
      `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Final visual foundation staging</title><style>body{background:#101619;color:#e9e4d8;font:18px system-ui;margin:24px}a{color:#dfc48a}img{max-width:100%;display:block}article{margin:30px 0}h2{font-size:22px}select{font:inherit;background:#252c32;color:inherit;padding:8px}</style><h1>Final visual foundation · staging preflight</h1><p>6 seeded maps · 18 material/cap cases · all seven floors. This is a preview through the shared rendering code, not activation in the editor. Stairs and torches remain pending visual approval.</p><p><a href="report.json">Report and seeds</a></p><label>Map size <select id="size"><option value="all">All</option><option>32</option><option>64</option><option>96</option></select></label> <label>Caps <select id="cap"><option value="all">All</option><option value="cut">Cut stone</option><option value="hewn">Heavy hewn fallback</option><option value="fitted">Fitted fallback</option></select></label>${cards}<script>function update(){for(const a of document.querySelectorAll('article'))a.hidden=!( (size.value==='all'||a.dataset.size===size.value)&&(cap.value==='all'||a.dataset.cap===cap.value))}const size=document.querySelector('#size'),cap=document.querySelector('#cap');size.onchange=cap.onchange=update;</script></html>`,
      { ...config, parser: 'html' },
    ),
  )
  console.log(
    JSON.stringify(
      {
        passed: true,
        maps: report.maps.length,
        cases: report.cases.length,
        floors: 7,
        scope: report.scope,
      },
      null,
      2,
    ),
  )
} finally {
  browser.close()
}
