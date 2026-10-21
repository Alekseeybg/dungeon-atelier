import type * as THREE from 'three'

/** Preserve fractional refresh time without rendering catch-up frames after a pause. */
export function advanceFlameFrame(time: number, previous: number): number | null {
  const interval = 1000 / 30,
    elapsed = time - previous
  if (elapsed < interval) return null
  return Number.isFinite(previous) ? time - (elapsed % interval) : time
}

/** Nonblocking GPU queries when supported; CPU submission is never presented as GPU time. */
export function createEffectsTiming(renderer: THREE.WebGLRenderer) {
  const gl = renderer.getContext() as WebGL2RenderingContext,
    pending: WebGLQuery[] = []
  let ext = gl.getExtension('EXT_disjoint_timer_query_webgl2') as {
    TIME_ELAPSED_EXT: number
    GPU_DISJOINT_EXT: number
  } | null
  let gpuMs: number | null = null
  function reset() {
    if (!gl.isContextLost()) pending.forEach((q) => gl.deleteQuery(q))
    pending.length = 0
    gpuMs = null
    if (!gl.isContextLost()) ext = gl.getExtension('EXT_disjoint_timer_query_webgl2') as typeof ext
  }
  return {
    reset,
    begin() {
      if (!ext || gl.isContextLost()) return null
      if (gl.getParameter(ext.GPU_DISJOINT_EXT)) {
        pending.forEach((q) => gl.deleteQuery(q))
        pending.length = 0
        gpuMs = null
      }
      while (pending.length && gl.getQueryParameter(pending[0]!, gl.QUERY_RESULT_AVAILABLE)) {
        const q = pending.shift()!
        gpuMs = Number(gl.getQueryParameter(q, gl.QUERY_RESULT)) / 1e6
        gl.deleteQuery(q)
      }
      if (pending.length >= 3) return null
      const query = gl.createQuery()
      if (query) gl.beginQuery(ext.TIME_ELAPSED_EXT, query)
      return query
    },
    end(query: WebGLQuery | null) {
      if (ext && query && !gl.isContextLost()) {
        gl.endQuery(ext.TIME_ELAPSED_EXT)
        pending.push(query)
      }
    },
    get gpuMs() {
      return gpuMs
    },
    get supported() {
      return !!ext
    },
    dispose() {
      reset()
    },
  }
}
