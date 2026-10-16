/** Review-only coping assemblies; no logical terrain, collision or wall-face changes. */
export const COPING_STUDIES = [
  { value: 'current', label: 'Current fitted cap' },
  { value: 'hewn', label: 'Heavy hewn coping' },
  { value: 'broken', label: 'Broken ancient slabs' },
] as const
export type CopingStudy = (typeof COPING_STUDIES)[number]['value']
export interface CopingNode {
  x: number
  y: number
  mask: number
  corner: number
  door?: boolean
}
export interface CopingBlock {
  x: number
  y: number
  width: number
  height: number
  image: number
  junction?: boolean
}
export function stoneHash(x: number, y: number, salt = 0) {
  let h =
    Math.imul(x + 193, 73856093) ^ Math.imul(y + 379, 19349663) ^ Math.imul(salt + 71, 83492791)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return (h ^ (h >>> 16)) >>> 0
}
/** Run-wide stones cross logical cell boundaries; junctions reserve their own bonding blocks. */
export function copingBlocks(nodes: CopingNode[], study: Exclude<CopingStudy, 'current'>) {
  const lookup = new Map(nodes.map((n) => [`${n.x},${n.y}`, n])),
    visited = new Set<string>(),
    blocks: CopingBlock[] = []
  const straight = (n: CopingNode | undefined, mask: number) =>
    n?.mask === mask && !n.corner && !n.door
  for (const node of nodes) {
    const key = `${node.x},${node.y}`
    if (visited.has(key)) continue
    const horizontal = node.mask === 10,
      mask = horizontal ? 10 : 5
    if (!straight(node, mask)) {
      blocks.push({
        x: node.x * 32,
        y: node.y * 32,
        width: 32,
        height: 32,
        image: stoneHash(node.x, node.y) % 12,
        junction: true,
      })
      visited.add(key)
      continue
    }
    const dx = horizontal ? 1 : 0,
      dy = horizontal ? 0 : 1
    let first = node,
      last = node
    while (straight(lookup.get(`${first.x - dx},${first.y - dy}`), mask))
      first = lookup.get(`${first.x - dx},${first.y - dy}`)!
    while (straight(lookup.get(`${last.x + dx},${last.y + dy}`), mask))
      last = lookup.get(`${last.x + dx},${last.y + dy}`)!
    for (let x = first.x, y = first.y; x <= last.x && y <= last.y; x += dx, y += dy)
      visited.add(`${x},${y}`)
    const start = (horizontal ? first.x : first.y) * 32,
      end = ((horizontal ? last.x : last.y) + 1) * 32,
      lengths = study === 'hewn' ? [26, 32, 35, 29] : [42, 51, 38, 46],
      phase = stoneHash(first.x, first.y, horizontal ? 1 : 2)
    let p = start,
      index = 0
    while (p < end) {
      let length = lengths[(phase + index) % lengths.length]!
      if (end - p - length < 16) length = end - p
      const hash = stoneHash(first.x, first.y, index),
        width = study === 'hewn' ? 23 + (hash % 3) * 0.5 : 25 + (hash % 5) * 0.55,
        offset =
          study === 'hewn' ? (((hash >>> 4) % 3) - 1) * 0.35 : (((hash >>> 4) % 5) - 2) * 0.65,
        joint = study === 'hewn' ? 0.65 : 1.1
      blocks.push({
        x: horizontal ? p + joint / 2 : first.x * 32 + 16 - width / 2 + offset,
        y: horizontal ? first.y * 32 + 16 - width / 2 + offset : p + joint / 2,
        width: horizontal ? length - joint : width,
        height: horizontal ? width : length - joint,
        image: hash % 12,
      })
      p += length
      index++
    }
  }
  return blocks
}
