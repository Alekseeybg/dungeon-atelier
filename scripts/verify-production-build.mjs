import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { browserSession, poll } from '../tests/helpers/browser.mjs'
import { formatProductionReports } from './format-production-reports.mjs'

// Serve apps/dungeon-atelier/dist/spa on port 9010 before running. No dev-module imports.
const url = process.argv[2] ?? 'http://localhost:9010',
  output = path.resolve('reports/production'),
  b = await browserSession(url)
const frame = () =>
  b.evaluate(
    `(()=>{const c=document.querySelector('.dungeon-canvas'),data=c?.getContext('2d').getImageData(0,0,c.width,c.height).data;if(!data)return null;let h=2166136261;const colors=new Set();for(let i=0;i<data.length;i+=16){h=Math.imul(h^data[i],16777619);colors.add(data.slice(i,i+3).join(','))}return {hash:(h>>>0).toString(16),colors:colors.size,loading:!!document.querySelector('.map-style-select .q-spinner')}})()`,
  )
try {
  await poll(async () => {
    const f = await frame()
    return f?.colors > 100 && !f.loading
  }, 'Built app rendered authored artwork')
  assert(
    await b.evaluate(
      `document.querySelector('[aria-label="Map appearance"]').closest('.q-field').innerText.includes('Ancient Ruined')`,
    ),
  )
  const before = await frame()
  await b.evaluate(`document.querySelector('[aria-label="Dungeon materials"]').click()`)
  await poll(
    () =>
      b.evaluate(
        `(()=>{const n=document.querySelector('[aria-label="Primary floor material"]');if(!n)return false;n.click();return true})()`,
      ),
    'Built material menu',
  )
  await poll(
    () =>
      b.evaluate(
        `(()=>{const n=[...document.querySelectorAll('[role="option"]')].find(n=>n.textContent.trim()==='Broad natural slabs');if(!n)return false;n.click();return true})()`,
      ),
    'Built material picker',
  )
  await poll(async () => {
    const f = await frame()
    return f && !f.loading && f.hash !== before.hash
  }, 'Built app material update')
  await b.evaluate(`document.querySelector('[aria-label="Dungeon materials"]').click()`)
  await b.send('Page.reload')
  await poll(async () => {
    const f = await frame()
    return f?.colors > 100 && !f.loading
  }, 'Built app reload')
  assert.equal(
    await b.evaluate(
      `JSON.parse(localStorage.getItem('dungeon-atelier:appearance')).ancient.floor`,
    ),
    'study-broad',
  )
  const resources = await b.evaluate(
    `performance.getEntriesByType('resource').map(e=>({name:new URL(e.name).pathname,status:e.responseStatus,type:e.initiatorType}))`,
  )
  assert(
    resources.filter((r) => r.type === 'img').length >= 10,
    'Bundled stone/door/torch images must load',
  )
  assert.deepEqual(
    resources.filter((r) => r.status >= 400),
    [],
  )
  assert.deepEqual(b.errors, [])
  fs.writeFileSync(
    path.join(output, 'production-build.png'),
    Buffer.from((await b.send('Page.captureScreenshot', { format: 'png' })).data, 'base64'),
  )
  const report = {
    passed: true,
    builtArtifact: true,
    defaultAncient: true,
    materialPicker: true,
    persistenceAfterReload: true,
    loadedImages: resources.filter((r) => r.type === 'img').length,
    failedResources: [],
    runtimeErrors: b.errors,
  }
  fs.writeFileSync(path.join(output, 'build-report.json'), JSON.stringify(report, null, 2) + '\n')
  await formatProductionReports()
  console.log(JSON.stringify(report, null, 2))
} finally {
  b.close()
}
