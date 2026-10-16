import type { CopingBlock, CopingNode } from './coping-model'

export const CUT_JOINT = 1.2
/** Squared bonding stones retain the established run lengths and texture choices. */
export function cutCopingBlocks(nodes: CopingNode[], blocks: CopingBlock[]) {
  const lookup = new Map(nodes.map((n) => [`${n.x},${n.y}`, n]))
  return blocks.map((b) => {
    if (b.junction)
      return {
        ...b,
        x: b.x + CUT_JOINT / 2,
        y: b.y + CUT_JOINT / 2,
        width: b.width - CUT_JOINT,
        height: b.height - CUT_JOINT,
      }
    const node = lookup.get(
        `${Math.floor((b.x + b.width / 2) / 32)},${Math.floor((b.y + b.height / 2) / 32)}`,
      )!,
      horizontal = node.mask === 10,
      extra = (CUT_JOINT - 0.65) / 2
    return {
      ...b,
      x: horizontal ? b.x + extra : node.x * 32 + 6,
      y: horizontal ? node.y * 32 + 6 : b.y + extra,
      width: horizontal ? b.width - extra * 2 : 20,
      height: horizontal ? 20 : b.height - extra * 2,
    }
  })
}
