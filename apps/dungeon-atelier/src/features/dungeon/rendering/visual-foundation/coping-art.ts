import ruinsUrl from '../../../../assets/visual-foundation/coping-ruins-blocks-v1.png'
import fortressUrl from '../../../../assets/visual-foundation/coping-fortress-blocks-v1.png'
import type { FoundationTreatment } from './art'

export interface CopingArt {
  stones: HTMLCanvasElement[]
  width: number
  height: number
  url: string
}
const loading = new Map<string, Promise<CopingArt>>()
/** Source alpha supplies the chipped silhouette. No colour-key extraction or painted noise. */
export function loadCopingArt(treatment: FoundationTreatment): Promise<CopingArt> {
  const url = treatment === 'fortress' ? fortressUrl : ruinsUrl
  let result = loading.get(url)
  if (result) return result
  result = (async () => {
    const image = new Image()
    image.src = url
    await image.decode()
    const atlas = document.createElement('canvas')
    atlas.width = image.naturalWidth
    atlas.height = image.naturalHeight
    const c = atlas.getContext('2d')!
    c.drawImage(image, 0, 0)
    const pixels = c.getImageData(0, 0, atlas.width, atlas.height).data
    if (pixels[3] !== 0) throw Error('Coping atlas must have a transparent background')
    const rows: { start: number; end: number }[] = []
    let start = -1
    for (let y = 0; y <= atlas.height; y++) {
      let count = 0
      if (y < atlas.height)
        for (let x = 0; x < atlas.width; x++)
          if (pixels[(y * atlas.width + x) * 4 + 3]! > 32) count++
      if (count > atlas.width * 0.02) {
        if (start < 0) start = y
      } else if (start >= 0) {
        if (y - start > atlas.height * 0.1) rows.push({ start, end: y })
        start = -1
      }
    }
    if (rows.length !== 3) throw Error('Expected three separated rows of coping stone tops')
    const stones: HTMLCanvasElement[] = []
    for (const row of rows)
      for (let col = 0; col < 4; col++) {
        let left = atlas.width,
          right = -1,
          top = atlas.height,
          bottom = -1
        for (let y = row.start; y < row.end; y++)
          for (
            let x = Math.floor((col * atlas.width) / 4);
            x < Math.floor(((col + 1) * atlas.width) / 4);
            x++
          )
            if (pixels[(y * atlas.width + x) * 4 + 3]! > 16) {
              left = Math.min(left, x)
              right = Math.max(right, x)
              top = Math.min(top, y)
              bottom = Math.max(bottom, y)
            }
        if (right < left) throw Error('Empty coping stone cell')
        const stone = document.createElement('canvas')
        stone.width = right - left + 1
        stone.height = bottom - top + 1
        const s = stone.getContext('2d')!
        s.drawImage(atlas, left, top, stone.width, stone.height, 0, 0, stone.width, stone.height)
        const data = s.getImageData(0, 0, stone.width, stone.height),
          exposure = treatment === 'fortress' ? 0.95 : 0.88
        for (let i = 0; i < data.data.length; i += 4) {
          data.data[i] = data.data[i]! * exposure
          data.data[i + 1] = data.data[i + 1]! * exposure
          data.data[i + 2] = data.data[i + 2]! * exposure
        }
        s.putImageData(data, 0, 0)
        stones.push(stone)
      }
    return { stones, width: atlas.width, height: atlas.height, url }
  })().catch((error) => {
    loading.delete(url)
    throw error
  })
  loading.set(url, result)
  return result
}
