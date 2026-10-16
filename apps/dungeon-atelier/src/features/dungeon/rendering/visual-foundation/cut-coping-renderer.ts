import type { CopingArt } from './coping-art'
import type { CopingBlock, CopingNode } from './coping-model'
import { cutCopingBlocks } from './cut-coping-model'
import { assignCutMaterials } from './cut-material-model'

/** Existing authored stone interiors on squared blocks; no noise, cracks or new artwork. */
export function buildCutCopingSurface(
  nodes: CopingNode[],
  blocks: CopingBlock[],
  art: CopingArt,
  seed: string,
) {
  const padding = 8,
    width = (Math.max(...nodes.map((n) => n.x)) + 1) * 32 + padding * 2,
    height = (Math.max(...nodes.map((n) => n.y)) + 1) * 32 + padding * 2,
    top = document.createElement('canvas'),
    joints = document.createElement('canvas')
  top.width = joints.width = width * 2
  top.height = joints.height = height * 2
  const c = top.getContext('2d')!,
    j = joints.getContext('2d')!
  for (const context of [c, j]) {
    context.fillStyle = '#181b19'
    context.fillRect(0, 0, top.width, top.height)
    context.scale(2, 2)
    context.translate(padding, padding)
  }
  const stones = cutCopingBlocks(nodes, blocks),
    materials = assignCutMaterials(stones, seed, art.stones.length)
  for (let i = 0; i < stones.length; i++) {
    const b = stones[i]!,
      material = materials[i]!
    c.save()
    c.beginPath()
    c.rect(b.x, b.y, b.width, b.height)
    c.clip()
    // Discard the rounded source alpha perimeter; the block's cut geometry owns the edge.
    const stone = art.stones[material.image]!,
      crop = material.crop
    c.fillStyle = '#696960'
    c.fillRect(b.x, b.y, b.width, b.height)
    c.save()
    c.translate(b.x + b.width / 2, b.y + b.height / 2)
    c.rotate((material.quarterTurn * Math.PI) / 2)
    const width = material.quarterTurn % 2 ? b.height : b.width,
      height = material.quarterTurn % 2 ? b.width : b.height
    c.drawImage(
      stone,
      stone.width * crop.x,
      stone.height * crop.y,
      stone.width * crop.width,
      stone.height * crop.height,
      -width / 2,
      -height / 2,
      width,
      height,
    )
    c.restore()
    // Narrow arrises belong to each block, so joints interrupt them naturally.
    c.lineWidth = 0.5
    c.lineJoin = 'miter'
    c.strokeStyle = '#d3cab52e'
    c.beginPath()
    c.moveTo(b.x, b.y + b.height)
    c.lineTo(b.x, b.y)
    c.lineTo(b.x + b.width, b.y)
    c.stroke()
    c.strokeStyle = '#0e121280'
    c.beginPath()
    c.moveTo(b.x, b.y + b.height)
    c.lineTo(b.x + b.width, b.y + b.height)
    c.lineTo(b.x + b.width, b.y)
    c.stroke()
    c.restore()
    j.clearRect(b.x, b.y, b.width, b.height)
  }
  return { top, joints, padding }
}
