import { exportFloorJson, MAX_IMPORT_CHARACTERS } from '@dungeon-atelier/core'
import type { DungeonFloor } from '@dungeon-atelier/core'
import { createMapCanvasAsync, disposeMapCanvas } from './rendering/dungeon-renderer'
import type { MapStyle, MapRenderOptions } from './rendering/map-style'

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const filename = (floor: DungeonFloor) =>
  `dungeon-floor-${floor.floorNumber}-${floor.seed.replace(/[^a-z0-9_-]/gi, '-').slice(0, 60)}`

export function downloadJson(floor: DungeonFloor) {
  download(
    new Blob([exportFloorJson(floor)], { type: 'application/json' }),
    `${filename(floor)}.json`,
  )
}

export async function downloadPng(
  floor: DungeonFloor,
  grid: boolean,
  style: MapStyle = 'stone',
  options: MapRenderOptions = {},
) {
  // Render a separate full-size canvas. Viewport transforms and selection never affect exports.
  const canvas = await createMapCanvasAsync(floor, grid, style, options)
  try {
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (value) => (value ? resolve(value) : reject(new Error('PNG export failed.'))),
        'image/png',
      )
    })
    download(blob, `${filename(floor)}.png`)
  } finally {
    disposeMapCanvas(canvas)
  }
}

export async function readJsonFile(file: File) {
  if (file.size > MAX_IMPORT_CHARACTERS)
    throw new Error('Choose a dungeon JSON file smaller than 5 MiB.')
  return file.text()
}
