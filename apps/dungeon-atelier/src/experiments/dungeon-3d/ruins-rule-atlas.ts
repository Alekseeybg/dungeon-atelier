import { ruinsAtlasCrop } from './ruins-atlas'

/** Legacy cells remain pixel-identical on the left; only rule-tagged wall/cap faces use the right pool. */
export function ruinsRuleAtlas(
  source: HTMLImageElement,
  legacy: HTMLCanvasElement,
  seed: string,
  coping: boolean,
) {
  const out = document.createElement('canvas')
  out.width = 1280
  out.height = 512
  const c = out.getContext('2d')!
  c.drawImage(legacy, 0, 0)
  for (let i = 0; i < 24; i++) {
    const local = i % 8,
      pool = Math.floor(i / 8),
      wear = local < 3 ? 'quiet' : local < 6 ? 'medium' : local === 6 ? 'strong' : 'hero',
      crop = coping ? ruinsAtlasCrop(seed, local % 6, true) : wallStoneCrop(i),
      tile = document.createElement('canvas')
    tile.width = tile.height = 128
    const t = tile.getContext('2d')!
    t.drawImage(
      source,
      crop.x * source.width,
      crop.y * source.height,
      crop.width * source.width,
      crop.height * source.height,
      0,
      0,
      128,
      128,
    )
    const data = t.getImageData(0, 0, 128, 128)
    let mean = 0
    for (let p = 0; p < data.data.length; p += 4)
      mean +=
        (data.data[p]! * 0.2126 + data.data[p + 1]! * 0.7152 + data.data[p + 2]! * 0.0722) / 16384
    const contrast = wear === 'quiet' ? 0.32 : wear === 'medium' ? 0.48 : 0.43,
      target = (coping ? 100 : 96) + ((local % 3) - 1) * 3
    for (let p = 0; p < data.data.length; p += 4) {
      const v = data.data[p]! * 0.2126 + data.data[p + 1]! * 0.7152 + data.data[p + 2]! * 0.0722,
        value = target + Math.max(-24, Math.min(25, (v - mean) * contrast))
      for (let k = 0; k < 3; k++) data.data[p + k] = value + (data.data[p + k]! - v) * 0.18
    }
    t.putImageData(data, 0, 0)
    if (wear === 'strong' || wear === 'hero') {
      // Defects terminate inside their stone: they cannot accidentally pair across joints.
      const points =
        coping && pool === 1
          ? [
              [35, 30],
              [43, 52],
              [65, 60],
              [83, 84],
            ]
          : coping && pool === 2
            ? [
                [24, 26],
                [38, 38],
                [40, 54],
              ]
            : [
                [24, 42],
                [43, 48],
                [55, 63],
                [79, 69],
                [100, 85],
              ]
      t.lineJoin = t.lineCap = 'round'
      for (const [width, color] of [
        [3, '#8d8b79'],
        [wear === 'hero' ? 1.8 : 1.1, '#3e433c'],
      ] as const) {
        t.beginPath()
        points.forEach(([x, y], j) => {
          if (j) t.lineTo(x!, y!)
          else t.moveTo(x!, y!)
        })
        t.strokeStyle = color
        t.lineWidth = width
        t.stroke()
      }
      if (wear === 'hero') {
        t.beginPath()
        t.moveTo(55, 63)
        t.lineTo(61, 83)
        t.lineTo(77, 96)
        t.lineWidth = 0.9
        t.stroke()
      }
    }
    c.drawImage(tile, 512 + (i % 6) * 128, Math.floor(i / 6) * 128)
  }
  return out
}

/** Interior samples from individual photographed stones; no baked mortar lines inside a block. */
function wallStoneCrop(index: number) {
  const interiors = [
      [0.065, 0.085, 0.155, 0.32],
      [0.27, 0.08, 0.06, 0.33],
      [0.365, 0.09, 0.1, 0.3],
      [0.52, 0.09, 0.105, 0.31],
      [0.675, 0.07, 0.065, 0.31],
      [0.79, 0.09, 0.145, 0.3],
      [0.12, 0.58, 0.13, 0.32],
      [0.33, 0.57, 0.09, 0.31],
      [0.465, 0.58, 0.095, 0.31],
      [0.61, 0.58, 0.12, 0.31],
      [0.79, 0.57, 0.13, 0.31],
      [0.37, 0.13, 0.085, 0.26],
    ],
    sample = interiors[(index * 5) % interiors.length]!
  return { x: sample[0]!, y: sample[1]!, width: sample[2]!, height: sample[3]! }
}
