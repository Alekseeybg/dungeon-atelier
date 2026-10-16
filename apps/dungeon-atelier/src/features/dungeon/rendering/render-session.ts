/** One expensive build at a time. Coalesce pending requests and release stale results.
 * The caller retains its committed frame on failure and owns its eventual disposal. */
export function createRenderSession<Request, Result>(handlers: {
  build: (request: Request) => Promise<Result>
  commit: (result: Result, request: Request) => void
  discard: (result: Result) => void
  error: (error: unknown) => void
  busy: (value: boolean) => void
  beforeBuild?: () => Promise<void>
}) {
  let revision = 0,
    pending: { revision: number; request: Request } | undefined,
    disposed = false,
    running: Promise<void> | undefined
  async function drain() {
    if (disposed) return
    handlers.busy(true)
    try {
      await handlers.beforeBuild?.()
      while (pending && !disposed) {
        const job = pending
        pending = undefined
        try {
          const result = await handlers.build(job.request)
          if (disposed || job.revision !== revision) handlers.discard(result)
          else handlers.commit(result, job.request)
        } catch (error) {
          if (!disposed && job.revision === revision) handlers.error(error)
        }
      }
    } finally {
      running = undefined
      if (!disposed) handlers.busy(false)
    }
  }
  return {
    request(request: Request) {
      if (disposed) return Promise.resolve()
      pending = { revision: ++revision, request }
      // Defer drain so even an immediately resolved/no-op builder has one shared promise.
      return (running ??= Promise.resolve().then(drain))
    },
    dispose() {
      disposed = true
      revision++
      pending = undefined
    },
  }
}
