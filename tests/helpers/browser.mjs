import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
export const browserProfileRoot = fileURLToPath(
  new URL('../../.cache/browser-tests/', import.meta.url),
)
export const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
export async function poll(action, label) {
  for (let i = 0; i < 150; i++) {
    try {
      const value = await action()
      if (value) return value
    } catch {}
    await pause(200)
  }
  throw new Error('Timed out: ' + label)
}
export async function browserSession(url) {
  const chrome =
    process.env.CHROME_PATH ||
    (process.platform === 'win32'
      ? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
      : 'google-chrome')
  fs.mkdirSync(browserProfileRoot, { recursive: true })
  const profile = fs.mkdtempSync(path.join(browserProfileRoot, 'session-'))
  const child = spawn(
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
  let socket, launchError
  const exited = new Promise((resolve) => {
    child.once('exit', resolve)
    child.once('error', resolve)
  })
  let closing
  const close = () => {
    if (closing) return closing
    closing = (async () => {
      // Ask Chrome to close its own subprocesses and release profile locks first.
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ id: -1, method: 'Browser.close' }))
      }
      await new Promise((resolve) => {
        const timer = setTimeout(() => {
          child.kill()
          resolve()
        }, 1500)
        exited.then(() => {
          clearTimeout(timer)
          resolve()
        })
      })
      socket?.close()
      await fs.promises.rm(profile, {
        recursive: true,
        force: true,
        maxRetries: 10,
        retryDelay: 100,
      })
    })()
    return closing
  }
  child.on('error', (error) => {
    launchError = error
  })
  try {
    await new Promise((resolve, reject) => {
      child.once('spawn', resolve)
      child.once('error', reject)
    })
    const port = await poll(() => {
      if (launchError) throw launchError
      return (
        fs.existsSync(path.join(profile, 'DevToolsActivePort')) &&
        fs.readFileSync(path.join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0]
      )
    }, 'Chrome startup')
    const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
    socket = new WebSocket(pages.find((page) => page.type === 'page').webSocketDebuggerUrl)
    await new Promise((resolve, reject) => {
      socket.onopen = resolve
      socket.onerror = reject
    })
    let id = 0
    const pending = new Map(),
      errors = []
    socket.onmessage = (event) => {
      const message = JSON.parse(event.data)
      if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails)
      const task = pending.get(message.id)
      if (task) {
        pending.delete(message.id)
        clearTimeout(task.timer)
        message.error
          ? task.reject(new Error(JSON.stringify(message.error)))
          : task.resolve(message.result)
      }
    }
    const send = (method, params = {}) =>
      new Promise((resolve, reject) => {
        const messageId = ++id
        const timer = setTimeout(() => {
          pending.delete(messageId)
          reject(new Error('CDP timeout: ' + method))
        }, 30000)
        pending.set(messageId, { resolve, reject, timer })
        socket.send(JSON.stringify({ id: messageId, method, params }))
      })
    const evaluate = async (expression) => {
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
    await poll(() => evaluate("!!document.querySelector('.dungeon-canvas')"), 'Dungeon app')
    return {
      send,
      evaluate,
      errors,
      profileDirectory: profile,
      close,
    }
  } catch (error) {
    await close()
    throw error
  }
}
