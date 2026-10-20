import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { DEFAULT_CONFIG, generateDungeon, roomCells } from '../packages/dungeon-core/dist/index.js'
import { browserSession } from '../tests/helpers/browser.mjs'
import { formatProductionReports } from './format-production-reports.mjs'

const output = path.resolve('reports/production/side-doors')
fs.mkdirSync(output, { recursive: true })
const inside = (room, x, y) => roomCells(room).some((p) => p.x === x && p.y === y)
const facing = (floor, door) => {
  const room = floor.rooms.find((candidate) => candidate.id === door.roomId),
    { x, y } = door.position
  if (!room) return door.orientation === 'north-south' ? 'north' : 'west'
  if (door.orientation === 'north-south') return inside(room, x, y + 1) ? 'north' : 'south'
  return inside(room, x - 1, y) ? 'east' : 'west'
}
const fixtures = new Map()
for (let i = 0; i < 160 && fixtures.size < 4; i++) {
  const result = generateDungeon({
    ...DEFAULT_CONFIG,
    width: 64,
    height: 64,
    seed: `side-door-readability-${i}`,
    layoutStyle: i % 2 ? 'compact' : 'classic',
    roomSpacing: i % 2 ? 1 : 3,
    targetRoomCount: 24,
    maxRoomSize: 12,
    roomShapeChance: 0.6,
    chamberBlockChance: 0.5,
  })
  assert(result.ok, JSON.stringify(result))
  for (const door of result.floor.doors.filter(
    (candidate) => candidate.type === 'regular' && candidate.orientation === 'east-west',
  )) {
    const face = facing(result.floor, door)
    if (!['east', 'west'].includes(face)) continue
    const room = result.floor.rooms.find((candidate) => candidate.id === door.roomId),
      direction = face === 'east' ? 1 : -1,
      outside = { x: door.position.x + direction, y: door.position.y },
      narrow =
        result.floor.tiles[outside.y]?.[outside.x] === 'floor' &&
        result.floor.tiles[outside.y - 1]?.[outside.x] === 'wall' &&
        result.floor.tiles[outside.y + 1]?.[outside.x] === 'wall'
    for (const context of narrow ? ['corridor'] : ['room']) {
      const id = `${context}-${face}`
      if (!fixtures.has(id) && room && roomCells(room).length >= 36)
        fixtures.set(id, { floor: result.floor, door, face, context })
    }
  }
}
assert.deepEqual([...fixtures.keys()].sort(), [
  'corridor-east',
  'corridor-west',
  'room-east',
  'room-west',
])

const browser = await browserSession('http://localhost:9000'),
  report = { passed: true, cases: [], isolation: {} }
const save = (name, png) =>
  fs.writeFileSync(path.join(output, `${name}.png`), Buffer.from(png, 'base64'))
try {
  await browser.evaluate(`(async()=>{
    const base='/src/features/dungeon/rendering/',v=base+'visual-foundation/';
    window.sideDoorProof={
      renderer:await import(v+'renderer.ts'),generated:await import(v+'generated-scene.ts'),
      settings:await import(base+'ancient-settings.ts'),model:await import(v+'model.ts'),
      comparison:await import(v+'comparison.ts'),final:await import(v+'final-style.ts')
    }
  })()`)
  for (const [id, fixture] of fixtures) {
    const result = await browser.evaluate(`(async()=>{
      const p=sideDoorProof,floor=${JSON.stringify(fixture.floor)},position=${JSON.stringify(fixture.door.position)},
        render=async sideDoors=>{const source=p.generated.generatedFoundationScene(floor,true);source.torches=[];
          const options={...p.settings.ancientOptions(p.settings.DEFAULT_ANCIENT),sideDoors,lighting:false},
            composed=await p.renderer.composeFoundation(source,options,p.settings.ancientFloorAssignments(source.floor,p.settings.DEFAULT_ANCIENT));return composed},
        crop=(source)=>{const c=document.createElement('canvas');c.width=512;c.height=432;
          c.getContext('2d').drawImage(source,(32+position.x*32-48)*2,(32+position.y*26-54)*2,256,216,0,0,512,432);return c},
        png=c=>c.toDataURL().split(',')[1],hash=c=>{let h=2166136261;for(const x of c.getContext('2d').getImageData(0,0,c.width,c.height).data)h=Math.imul(h^x,16777619);return(h>>>0).toString(16)},
        before=await render('legacy'),after=await render('defined'),a=crop(before.image),b=crop(after.image),out=document.createElement('canvas');
      out.width=1040;out.height=474;const c=out.getContext('2d');c.fillStyle='#080d10';c.fillRect(0,0,out.width,out.height);
      c.fillStyle='#dfd4bd';c.font='18px sans-serif';c.fillText('Before · legacy side doorway',12,27);c.fillText('After · defined side doorway',540,27);c.drawImage(a,0,42);c.drawImage(b,528,42);
      const value={comparison:png(out),before:png(a),after:png(b),beforeHash:hash(a),afterHash:hash(b)};
      before.dispose();after.dispose();return value
    })()`)
    assert.notEqual(result.beforeHash, result.afterHash)
    save(`${id}-comparison`, result.comparison)
    save(`${id}-before`, result.before)
    save(`${id}-after`, result.after)
    report.cases.push({
      id,
      seed: fixture.floor.seed,
      doorId: fixture.door.id,
      facing: fixture.face,
      context: fixture.context,
      comparison: `${id}-comparison.png`,
      beforeHash: result.beforeHash,
      afterHash: result.afterHash,
    })
  }
  report.isolation = await browser.evaluate(`(async()=>{
    const p=sideDoorProof,hash=c=>{let h=2166136261;for(const x of c.getContext('2d').getImageData(0,0,c.width,c.height).data)h=Math.imul(h^x,16777619);return(h>>>0).toString(16)},
      check=async secret=>{const source=p.model.createFoundationScene(secret),base={...p.final.FINAL_FOUNDATION,secret:secret?'revealed':'none'},
        before=await p.renderer.renderFoundation({...base,sideDoors:'legacy'},source),after=await p.renderer.renderFoundation({...base,sideDoors:'defined'},source),
        nsBefore=hash(p.comparison.cropFoundation(before,'doors-ns')),nsAfter=hash(p.comparison.cropFoundation(after,'doors-ns')),
        ewBefore=hash(p.comparison.cropFoundation(before,'doors-ew')),ewAfter=hash(p.comparison.cropFoundation(after,'doors-ew'));
        before.width=before.height=after.width=after.height=1;return{nsBefore,nsAfter,ewBefore,ewAfter}},
      sideSecret=async reveal=>{const source=p.model.createFoundationScene(false);for(const door of source.floor.doors)if(door.orientation==='east-west')door.type='secret';
        const base={...p.final.FINAL_FOUNDATION,secret:reveal?'revealed':'hidden'},before=await p.renderer.renderFoundation({...base,sideDoors:'legacy'},source),
          after=await p.renderer.renderFoundation({...base,sideDoors:'defined'},source),a=hash(p.comparison.cropFoundation(before,'doors-ew')),b=hash(p.comparison.cropFoundation(after,'doors-ew'));
        before.width=before.height=after.width=after.height=1;return a===b},
      regular=await check(false),secret=await check(true);
      return{northSouthExact:regular.nsBefore===regular.nsAfter,eastWestChanged:regular.ewBefore!==regular.ewAfter,
        revealedSecretNorthExact:secret.nsBefore===secret.nsAfter,hiddenSecretEastWestExact:await sideSecret(false),revealedSecretEastWestExact:await sideSecret(true)}
  })()`)
  assert.deepEqual(report.isolation, {
    northSouthExact: true,
    eastWestChanged: true,
    revealedSecretNorthExact: true,
    hiddenSecretEastWestExact: true,
    revealedSecretEastWestExact: true,
  })
  assert.deepEqual(browser.errors, [])
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n')
  fs.writeFileSync(
    path.join(output, 'index.html'),
    `<!doctype html><html lang="en"><meta charset="utf-8"><title>Side-door readability</title><style>body{background:#101619;color:#e9e4d8;font:18px system-ui;margin:24px}img{max-width:100%;display:block;margin-bottom:40px}a{color:#dfc48a}</style><h1>East/west doorway readability</h1><p>Actual generated doors in one-tile corridors and larger rooms. North/south pixels and hidden or revealed secret panels remain unchanged.</p>${report.cases.map((c) => `<h2>${c.context} · ${c.facing}</h2><p>${c.seed} · ${c.doorId}</p><img src="${c.comparison}" alt="Before and after ${c.id} doorway">`).join('')}</html>`,
  )
  await formatProductionReports()
  console.log(JSON.stringify(report, null, 2))
} finally {
  browser.close()
}
