import { parentPort, workerData } from 'node:worker_threads'
import { verifyCase } from '../tests/helpers/verify-floor.mjs'
import { stressCase } from '../tests/helpers/cases.mjs'
for (let index = workerData.worker; index < workerData.count; index += workerData.workers) {
  const config = stressCase(index)
  try {
    parentPort.postMessage({ index, config, result: verifyCase(config) })
  } catch (error) {
    parentPort.postMessage({
      index,
      config,
      failure: { name: error.name, message: error.message, stack: error.stack },
    })
  }
}
