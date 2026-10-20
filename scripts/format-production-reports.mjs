import fs from 'node:fs'
import path from 'node:path'
import { format, resolveConfig } from 'prettier'

/** Keep generated evidence readable and compatible with the repository format check. */
export async function formatProductionReports() {
  const directory = path.resolve('reports/production'),
    options = await resolveConfig('package.json')
  for (const name of fs.readdirSync(directory, { recursive: true })) {
    if (!/\.(json|html)$/.test(name)) continue
    const file = path.join(directory, name)
    fs.writeFileSync(
      file,
      await format(fs.readFileSync(file, 'utf8'), { ...options, filepath: file }),
    )
  }
}
