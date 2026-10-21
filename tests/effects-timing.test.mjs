import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  advanceFlameFrame,
  createEffectsTiming,
} from '../apps/dungeon-atelier/src/experiments/dungeon-3d/effects-timing.ts'

test('flame pacing averages 30 FPS across display refresh rates without accumulating drift', () => {
  for (const hz of [60, 75, 144]) {
    let previous = -Infinity
    const rendered = []
    for (let frame = 0; frame < hz * 10; frame++) {
      const time = (frame * 1000) / hz,
        next = advanceFlameFrame(time, previous)
      if (next !== null) {
        previous = next
        rendered.push(time)
      }
    }
    assert.ok(Math.abs(rendered.length - 300) <= 1, `${hz} Hz: ${rendered.length} frames`)
    if (hz === 75) {
      const intervals = rendered.slice(1).map((time, i) => time - rendered[i])
      assert.ok(intervals.every((time) => time >= 26 && time <= 41))
    }
  }
})

test('flame pacing starts immediately and skips missed frames after a long pause', () => {
  assert.equal(advanceFlameFrame(10, -Infinity), 10)
  assert.equal(advanceFlameFrame(20, 10), null)
  const resumed = advanceFlameFrame(60010, 10)
  assert.ok(resumed >= 60010 - 1000 / 30 && resumed <= 60010)
  assert.equal(advanceFlameFrame(60010, resumed), null)
})

test('GPU timing releases completed queries and forgets lost-context queries before restoration', () => {
  let lost = false,
    id = 0,
    extensions = 0
  const deleted = [],
    polled = []
  const ext = { TIME_ELAPSED_EXT: 1, GPU_DISJOINT_EXT: 2 }
  const gl = {
    QUERY_RESULT_AVAILABLE: 3,
    QUERY_RESULT: 4,
    getExtension() {
      extensions++
      return ext
    },
    isContextLost: () => lost,
    getParameter: () => false,
    createQuery: () => ({ id: ++id }),
    beginQuery() {},
    endQuery() {},
    getQueryParameter(query, parameter) {
      polled.push(query.id)
      return parameter === this.QUERY_RESULT_AVAILABLE ? true : 8e6
    },
    deleteQuery(query) {
      assert(!lost)
      deleted.push(query.id)
    },
  }
  const timer = createEffectsTiming({ getContext: () => gl })
  assert(timer.supported)
  const first = timer.begin()
  timer.end(first)
  const second = timer.begin()
  timer.end(second)
  assert.equal(timer.gpuMs, 8)
  assert.deepEqual(deleted, [first.id])
  lost = true
  timer.reset()
  assert.equal(timer.gpuMs, null)
  assert(!deleted.includes(second.id), 'Do not call deleteQuery on a lost context')
  lost = false
  timer.reset()
  const third = timer.begin()
  timer.end(third)
  assert(!polled.includes(second.id), 'Never poll a query belonging to the old context')
  assert.equal(extensions, 2, 'Reactivate the timing extension after restoration')
  timer.dispose()
  assert(deleted.includes(third.id))
})

test('unsupported GPU timing reports unavailable without polling or allocating queries', () => {
  const timer = createEffectsTiming({
    getContext: () => ({
      getExtension: () => null,
      isContextLost: () => false,
      createQuery() {
        assert.fail('Unsupported timing must not allocate queries')
      },
    }),
  })
  assert.equal(timer.supported, false)
  assert.equal(timer.begin(), null)
  assert.equal(timer.gpuMs, null)
  timer.end(null)
  timer.reset()
  timer.dispose()
})
