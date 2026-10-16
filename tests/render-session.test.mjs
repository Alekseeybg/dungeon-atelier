import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRenderSession } from '../apps/dungeon-atelier/src/features/dungeon/rendering/render-session.ts'

function deferred() {
  let resolve, reject
  const promise = new Promise((ok, fail) => {
    resolve = ok
    reject = fail
  })
  return { promise, resolve, reject }
}
const tick = () => new Promise((resolve) => setImmediate(resolve))
function harness() {
  const builds = [],
    committed = [],
    discarded = [],
    errors = [],
    busy = []
  const session = createRenderSession({
    build(request) {
      const work = deferred()
      builds.push({ request, ...work })
      return work.promise
    },
    commit: (result, request) => committed.push({ result, request }),
    discard: (result) => discarded.push(result),
    error: (error) => errors.push(error),
    busy: (value) => busy.push(value),
  })
  return { session, builds, committed, discarded, errors, busy }
}
test('render session coalesces requests and releases stale expensive frames before committing the latest', async () => {
  const h = harness(),
    first = h.session.request(1),
    second = h.session.request(2)
  assert.equal(first, second)
  await tick()
  assert.deepEqual(
    h.builds.map((b) => b.request),
    [2],
  )
  const third = h.session.request(3),
    fourth = h.session.request(4)
  assert.equal(third, fourth)
  h.builds[0].resolve('stale image')
  await tick()
  assert.deepEqual(h.discarded, ['stale image'])
  assert.deepEqual(
    h.builds.map((b) => b.request),
    [2, 4],
  )
  h.builds[1].resolve('latest image')
  await first
  assert.deepEqual(h.committed, [{ result: 'latest image', request: 4 }])
  assert.deepEqual(h.busy, [true, false])
})
test('current render failures leave the previous frame owned by the caller and allow recovery', async () => {
  const h = harness(),
    first = h.session.request('initial')
  await tick()
  h.builds[0].resolve('old frame')
  await first
  const failure = h.session.request('broken')
  await tick()
  h.builds[1].reject('asset failed')
  await failure
  assert.deepEqual(h.errors, ['asset failed'])
  assert.deepEqual(h.committed, [{ result: 'old frame', request: 'initial' }])
  assert.deepEqual(h.discarded, [])
  const recovery = h.session.request('recovered')
  await tick()
  h.builds[2].resolve('new frame')
  await recovery
  assert.equal(h.committed.at(-1).result, 'new frame')
})
test('stale failures do not surface errors for superseded settings', async () => {
  const h = harness(),
    first = h.session.request('broken')
  await tick()
  h.session.request('valid')
  h.builds[0].reject('stale error')
  await tick()
  h.builds[1].resolve('valid frame')
  await first
  assert.deepEqual(h.errors, [])
  assert.equal(h.committed.at(-1).request, 'valid')
})
test('unmount discards an in-flight result, cancels pending work and emits no later UI changes', async () => {
  const h = harness(),
    first = h.session.request(1)
  await tick()
  h.session.request(2)
  h.session.dispose()
  h.builds[0].resolve('orphan')
  await first
  await h.session.request(3)
  assert.equal(h.builds.length, 1)
  assert.deepEqual(h.discarded, ['orphan'])
  assert.deepEqual(h.committed, [])
  assert.deepEqual(h.busy, [true])
})
test('unmount before the first build creates no work or UI notifications', async () => {
  const h = harness(),
    queued = h.session.request('not mounted')
  h.session.dispose()
  await queued
  assert.deepEqual(h.builds, [])
  assert.deepEqual(h.busy, [])
})
