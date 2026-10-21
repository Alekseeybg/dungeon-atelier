import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { browserSession, browserProfileRoot, poll } from '../tests/helpers/browser.mjs'

const before = fs.existsSync(browserProfileRoot) ? fs.readdirSync(browserProfileRoot).sort() : []
const browser = await browserSession(process.env.ATELIER_URL ?? 'http://localhost:9000')
assert.equal(path.dirname(browser.profileDirectory), path.resolve(browserProfileRoot))
assert(fs.existsSync(browser.profileDirectory))
browser.close() // Existing scripts can initiate cleanup without awaiting it.
await poll(() => !fs.existsSync(browser.profileDirectory), 'profile removed after close')
await browser.close() // Closing twice is harmless and returns the same completed cleanup.
const saved = process.env.CHROME_PATH
try {
  process.env.CHROME_PATH = path.join(browserProfileRoot, 'intentionally-missing-browser.exe')
  await assert.rejects(browserSession('http://localhost:9000'), /ENOENT/)
} finally {
  if (saved === undefined) delete process.env.CHROME_PATH
  else process.env.CHROME_PATH = saved
}
assert.deepEqual(
  fs.readdirSync(browserProfileRoot).sort(),
  before,
  'Successful and failed launches must leave no test profiles',
)
console.log(
  'Browser lifecycle passed: project-local profiles, automatic cleanup, idempotent close, failed-launch cleanup.',
)
