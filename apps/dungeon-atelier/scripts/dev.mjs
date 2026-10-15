import { spawn } from 'node:child_process'
import { watch } from 'node:fs'
import { fileURLToPath } from 'node:url'

const appDirectory = fileURLToPath(new URL('../', import.meta.url))
const coreOutput = fileURLToPath(new URL('../../../packages/dungeon-core/dist/', import.meta.url))
const quasarCli = fileURLToPath(
  new URL('../../../node_modules/@quasar/app-vite/bin/quasar.js', import.meta.url),
)
let child
let rebuildTimer
let restarting = false
let closing = false

function start() {
  restarting = false
  child = spawn(process.execPath, [quasarCli, 'dev', ...process.argv.slice(2)], {
    cwd: appDirectory,
    stdio: 'inherit',
    windowsHide: true,
  })
  child.on('error', (error) => {
    console.error(error.message)
    child = undefined
    stop(1)
  })
  child.on('exit', (code) => {
    child = undefined
    if (restarting && !closing) start()
    else stop(code ?? 0)
  })
}

// Restart the process, including its type-aware ESLint worker, after a core build.
// A Vite-only restart can retain the worker's old dependency declarations.
const watcher = watch(coreOutput, { recursive: true }, (_event, filename) => {
  if (closing || !filename || !/\.(?:js|ts|json)$/.test(filename)) return
  clearTimeout(rebuildTimer)
  rebuildTimer = setTimeout(() => {
    if (closing || restarting) return
    console.info('\nDungeon core rebuilt; restarting the generator server and type checker.\n')
    restarting = true
    if (child) child.kill('SIGTERM')
    else start()
  }, 400)
})
watcher.on('error', (error) => {
  console.error(error.message)
  stop(1)
})

function stop(code = 0) {
  if (closing) return
  closing = true
  clearTimeout(rebuildTimer)
  watcher.close()
  if (child) {
    child.once('exit', () => process.exit(code))
    child.kill('SIGTERM')
  } else process.exit(code)
}
process.on('SIGINT', () => stop())
process.on('SIGTERM', () => stop())
start()
