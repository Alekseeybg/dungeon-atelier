import type { Position } from '@dungeon-atelier/core'
import { TILE_SIZE } from './tile-size'

/** Wall sconce in the same overhead perspective as the masonry. */
export function drawWallTorch(context: CanvasRenderingContext2D, position: Position) {
  const x = position.x * TILE_SIZE + 16
  const y = position.y * TILE_SIZE + 25
  const lean = ((position.x + position.y) % 3) - 1
  context.save()
  context.translate(x, y)

  const halo = context.createRadialGradient(0, -6, 1, 0, -6, 13)
  halo.addColorStop(0, '#ffc77636')
  halo.addColorStop(0.5, '#d477241c')
  halo.addColorStop(1, '#c45a1500')
  context.fillStyle = halo
  context.fillRect(-13, -19, 26, 26)
  context.fillStyle = '#030907a0'
  context.beginPath()
  context.ellipse(1.5, 4, 5, 2.2, 0, 0, Math.PI * 2)
  context.fill()

  // Riveted iron backplate and a short support arm; highlights pick up nearby flame.
  const iron = context.createLinearGradient(-3, -2, 3, 7)
  iron.addColorStop(0, '#7b7c62')
  iron.addColorStop(0.35, '#414c40')
  iron.addColorStop(1, '#17251f')
  context.fillStyle = iron
  context.beginPath()
  context.moveTo(0, -3)
  context.lineTo(3, 0)
  context.lineTo(2.5, 6)
  context.lineTo(0, 8)
  context.lineTo(-2.5, 6)
  context.lineTo(-3, 0)
  context.closePath()
  context.fill()
  context.fillStyle = '#b5a67b'
  context.fillRect(-0.5, 5, 1, 1)
  context.strokeStyle = '#222f25'
  context.lineWidth = 2
  context.beginPath()
  context.moveTo(0, 5)
  context.quadraticCurveTo(-1, 2, 0, -1)
  context.stroke()
  context.strokeStyle = '#8e826155'
  context.lineWidth = 0.6
  context.stroke()

  // A small basket cups the coals below the flame, rather than a bright pole.
  const bowl = context.createLinearGradient(0, -3, 0, 2)
  bowl.addColorStop(0, '#b28a4d')
  bowl.addColorStop(0.3, '#665438')
  bowl.addColorStop(1, '#1c2a20')
  context.fillStyle = bowl
  context.beginPath()
  context.moveTo(-4, -3)
  context.lineTo(4, -3)
  context.quadraticCurveTo(3, 2, 0, 2)
  context.quadraticCurveTo(-3, 2, -4, -3)
  context.fill()
  context.fillStyle = '#f4a143'
  context.beginPath()
  context.ellipse(0, -3, 3.3, 1, 0, 0, Math.PI * 2)
  context.fill()

  // Transparent amber edges, a bright inner flame, and a small ivory core.
  const flame = context.createLinearGradient(0, -14, 0, -2)
  flame.addColorStop(0, '#f5b85400')
  flame.addColorStop(0.2, '#e99a32c0')
  flame.addColorStop(0.65, '#f6bc5ef2')
  flame.addColorStop(1, '#e46c22')
  context.fillStyle = flame
  context.beginPath()
  context.moveTo(0, -2.5)
  context.bezierCurveTo(-5, -4, -3, -7, -1, -10)
  context.quadraticCurveTo(0, -12, lean + 1.5, -14)
  context.bezierCurveTo(lean - 0.5, -9, 5, -7, 3, -4)
  context.quadraticCurveTo(2, -2.5, 0, -2.5)
  context.fill()
  context.fillStyle = '#ffe3a0'
  context.beginPath()
  context.moveTo(-1.7, -3.5)
  context.quadraticCurveTo(-2.5, -6, lean + 0.5, -9)
  context.quadraticCurveTo(0.5, -6.5, 2, -4)
  context.quadraticCurveTo(0.5, -2.8, -1.7, -3.5)
  context.fill()
  context.fillStyle = '#fff4cc'
  context.beginPath()
  context.ellipse(0, -4.2, 0.9, 1.8, 0.1, 0, Math.PI * 2)
  context.fill()
  context.strokeStyle = '#212d23'
  context.lineWidth = 0.75
  for (const side of [-1, 1]) {
    context.beginPath()
    context.moveTo(side * 2.5, -0.5)
    context.lineTo(side * 3.7, -4)
    context.stroke()
  }
  context.restore()
}
