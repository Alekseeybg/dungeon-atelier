import type { CopingBlock } from './coping-model'

export interface CutMaterial {
  image: number
  quarterTurn: number
  crop: { x: number; y: number; width: number; height: number }
}
function hash(value: string) {
  let h = 2166136261
  for (const c of value) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d)
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b)
  return (h ^ (h >>> 16)) >>> 0
}
function neighbors(a: CopingBlock, b: CopingBlock) {
  const dx = Math.max(a.x - b.x - b.width, b.x - a.x - a.width, 0),
    dy = Math.max(a.y - b.y - b.height, b.y - a.y - a.height, 0)
  return dx <= 1.21 && dy <= 1.21
}
/** Stable graph-based material choice crosses run ends, corners and doorway bonding stones. */
export function assignCutMaterials(
  blocks: CopingBlock[],
  seed: string,
  imageCount = 12,
): CutMaterial[] {
  const graph = blocks.map((a, i) =>
      blocks.flatMap((b, j) => (i !== j && neighbors(a, b) ? [j] : [])),
    ),
    order = blocks
      .map((_, i) => i)
      .sort((a, b) => blocks[a]!.y - blocks[b]!.y || blocks[a]!.x - blocks[b]!.x),
    result: CutMaterial[] = []
  for (const i of order) {
    const b = blocks[i]!,
      key = `${seed}:${b.x},${b.y},${b.width},${b.height}`,
      distance = new Map<number, number>([[i, 0]]),
      queue = [i]
    for (let k = 0; k < queue.length; k++) {
      const current = queue[k]!,
        depth = distance.get(current)!
      if (depth === 3) continue
      for (const n of graph[current]!)
        if (!distance.has(n)) {
          distance.set(n, depth + 1)
          queue.push(n)
        }
    }
    // The first constraint prevents adjacent duplicates. Wider cooldowns suppress
    // repeated motifs on short runs, including repeats separated by a corner.
    const score = (image: number) => {
      let penalty = 0
      for (const [n, d] of distance)
        if (d && result[n]?.image === image) penalty += d === 1 ? 1000 : d === 2 ? 40 : 10
      return penalty
    }
    const adjacent = new Set(graph[i]!.flatMap((n) => (result[n] ? [result[n].image] : []))),
      images = Array.from({ length: imageCount }, (_, image) => image),
      available = images.filter((image) => !adjacent.has(image)),
      candidates = (available.length ? available : images).sort(
        (a, b) => score(a) - score(b) || hash(`${key}:image:${a}`) - hash(`${key}:image:${b}`),
      ),
      image = candidates[0]!,
      turnScore = (turn: number) => graph[i]!.filter((n) => result[n]?.quarterTurn === turn).length,
      turns = [0, 1, 2, 3].sort(
        (a, b) =>
          turnScore(a) - turnScore(b) || hash(`${key}:turn:${a}`) - hash(`${key}:turn:${b}`),
      ),
      unit = (salt: string) => hash(`${key}:${salt}`) / 4294967295
    result[i] = {
      image,
      quarterTurn: turns[0]!,
      crop: {
        x: 0.15 + unit('crop-x') * 0.12,
        y: 0.15 + unit('crop-y') * 0.12,
        width: 0.58,
        height: 0.58,
      },
    }
  }
  return result
}
