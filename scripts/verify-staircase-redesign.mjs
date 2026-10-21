import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { browserSession, poll } from '../tests/helpers/browser.mjs'
import { stairPoint } from '../apps/dungeon-atelier/src/experiments/dungeon-3d/stair-layout.ts'

const base = process.env.ATELIER_URL ?? 'http://localhost:9000',
  output = path.resolve('reports/staircase-redesign')
fs.mkdirSync(output, { recursive: true })
const b = await browserSession(base)
try {
  await b.send('Page.navigate', { url: base + '/#/dev/dungeon-3d' })
  await poll(
    () =>
      b.evaluate(
        `(()=>{let n=document.querySelector('.dungeon-3d-page')?.__vueParentComponent;while(n&&!n.exposed?.getPrototypeState)n=n.parent;if(!n)return false;window.stairProof=n.exposed;const s=stairProof.getPrototypeState();return !s.busy&&!s.error&&s.metrics?.calls>0})()`,
      ),
    'new staircase scene',
  )
  const slider = async (label, value) => {
    await b.evaluate(
      `document.querySelector('[aria-label=${JSON.stringify(label)}]').__vueParentComponent.emit('update:modelValue',${value})`,
    )
    await b.evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
  }
  async function capture(name) {
    const png = await b.evaluate('stairProof.capture3D()')
    fs.writeFileSync(path.join(output, name + '.png'), Buffer.from(png.split(',')[1], 'base64'))
  }
  await b.evaluate(
    "document.querySelector('[aria-label=\"3D visual theme\"]')?.__vueParentComponent.emit('update:modelValue','restored-crypt')",
  )
  await b.evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
  const proof = await b.evaluate('stairProof.getAssetProof()')
  const capBaseline = 'reports/runtime-fixes/after-report.json'
  if (fs.existsSync(capBaseline)) {
    const baseline = JSON.parse(fs.readFileSync(capBaseline, 'utf8'))
    assert.deepEqual(proof.caps, baseline.caps, 'Approved caps stay unchanged')
  }
  await capture('gameplay')
  const probes = []
  for (const stair of proof.stairs) {
    const { bounds, floor, destination, landing, run, count, rise } = stair
    const focus = (span, y) =>
      b.evaluate(
        `stairProof.focusTile(${bounds.x + bounds.width / 2 - 0.5},${bounds.z + bounds.depth / 2 - 0.5},${span},${y})`,
      )
    await focus(10, (floor + destination) / 2)
    await slider('3D camera rotation', -90)
    await slider('3D camera elevation', 68)
    await capture(stair.direction + '-gameplay')
    await focus(6.5, (floor + destination) / 2)
    await slider('3D camera elevation', stair.direction === 'up' ? 60 : 74)
    await capture(stair.direction + '-full-ascent')
    await focus(4.6, (floor + destination) / 2)
    await capture(stair.direction + '-close-up')
    await slider('3D camera elevation', 82)
    await capture(stair.direction + '-top-down')
    for (let flight = 0; flight < 2; flight++) {
      for (let i = 0; i < count; i++) {
        const p = stairPoint(
            stair,
            stair.width * (flight ? 0.75 : 0.25),
            flight
              ? stair.length - landing - ((i + 0.5) * run) / count
              : landing + ((i + 0.5) * run) / count,
          ),
          y = await b.evaluate(`stairProof.probeFloor(${p.x - 0.5},${p.z - 0.5})`),
          expected = floor + rise * (flight * count + i + 1)
        assert(
          y !== null && Math.abs(y - expected) < 0.002,
          `${stair.direction} flight ${flight} tread ${i}: ${y} vs ${expected}`,
        )
        probes.push({ id: stair.id, flight, tread: i, actual: y, expected })
      }
    }
    const p = stairPoint(stair, stair.width * 0.75 + 0.1, landing * 0.35),
      endpoint = await b.evaluate(`stairProof.probeFloor(${p.x - 0.5},${p.z - 0.5})`)
    assert(Math.abs(endpoint - destination) < 0.002, 'Full destination landing exists')
  }
  const floorGeometry = (await b.evaluate('stairProof.getPrototypeState()')).floorGeometryId
  await slider('3D wall height', 1.75)
  const tallest = await b.evaluate('stairProof.getAssetProof()')
  assert.equal((await b.evaluate('stairProof.getPrototypeState()')).floorGeometryId, floorGeometry)
  for (const stair of tallest.stairs) {
    const { bounds, floor, destination, landing } = stair
    if (stair.direction === 'up') assert.equal(destination, 3.585)
    const p = stairPoint(stair, stair.width * 0.75 + 0.1, landing * 0.35),
      y = await b.evaluate(`stairProof.probeFloor(${p.x - 0.5},${p.z - 0.5})`)
    assert(Math.abs(y - destination) < 0.002, 'Destination follows highest wall setting')
    await b.evaluate(
      `stairProof.focusTile(${bounds.x + bounds.width / 2 - 0.5},${bounds.z + bounds.depth / 2 - 0.5},8,${(floor + destination) / 2})`,
    )
    await slider('3D camera rotation', -90)
    await slider('3D camera elevation', stair.direction === 'up' ? 60 : 82)
    await capture(stair.direction + '-maximum-height')
  }
  assert.deepEqual(b.errors, [])
  fs.writeFileSync(
    path.join(output, 'report.json'),
    JSON.stringify(
      {
        proof,
        tallest: tallest.stairs,
        probes,
        capBaselineChecked: fs.existsSync(capBaseline),
        errors: b.errors,
      },
      null,
      2,
    ) + '\n',
  )
  console.log(
    'Both new staircases: all treads and destination landings verified; gameplay, close-up, full ascent and top-down screenshots captured.',
  )
} finally {
  await b.close()
}
