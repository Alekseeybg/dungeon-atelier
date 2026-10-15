import type { Door } from '@dungeon-atelier/core'
import { stoneTile } from './stone-tiles'

/** A closed door in plan view. Only its footprint turns; lighting stays at the upper left. */
export function drawStoneDoor(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  orientation: Door['orientation'],
  secret = false,
) {
  const vertical = orientation === 'east-west'
  context.save()
  context.translate(x + 16, y + 16)
  if (vertical) context.rotate(Math.PI / 2)
  const lightY = vertical ? 1 : -1

  // Worn stone threshold beneath a slender oak leaf, with a soft contact shadow.
  const threshold = context.createLinearGradient(0, -7, 0, 8)
  threshold.addColorStop(0, '#353a3055')
  threshold.addColorStop(0.4, '#85816b60')
  threshold.addColorStop(1, '#1c251f60')
  context.fillStyle = threshold
  context.fillRect(-11, -7, 22, 15)
  context.fillStyle = '#b5aa8250'
  context.fillRect(-10, -7, 20, 0.7)
  context.fillStyle = '#151d1766'
  context.fillRect(-3, 5, 0.6, 3)
  context.fillRect(5, -6, 0.6, 2)
  const shadow = context.createLinearGradient(0, 1, 0, 8)
  shadow.addColorStop(0, '#020605c9')
  shadow.addColorStop(1, '#02060500')
  context.fillStyle = shadow
  context.fillRect(-11, 1, 23, 7)

  if (secret) {
    // A fitted sliding wall panel, with an explicit editor symbol for its hidden entrance.
    context.fillStyle = '#101b17'
    context.fillRect(-11, -5, 22, 10)
    context.drawImage(stoneTile('wall-dressed', (x + y) % 16), 5, 10, 22, 12, -11, -5, 22, 10)
    context.strokeStyle = '#c4c7ad99'
    context.lineWidth = 0.7
    context.strokeRect(-10.5, -4.5, 21, 9)
    context.strokeStyle = '#6edbdad9'
    context.setLineDash([2, 2])
    context.strokeRect(-11.5, -5.5, 23, 11)
    context.setLineDash([])
    context.save()
    if (vertical) context.rotate(-Math.PI / 2)
    context.fillStyle = '#10221fed'
    context.fillRect(-5, -7, 10, 14)
    context.font = 'bold 12px monospace'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillStyle = '#a4f4eb'
    context.fillText('S', 0, 0.5)
    context.restore()
  } else {
    // End-grain and long grain remain visible at close zoom without heavy outlines.
    context.fillStyle = '#211b12'
    context.fillRect(-11, -4, 22, 8)
    const oak = context.createLinearGradient(-7, -4 * lightY, 8, 4 * lightY)
    oak.addColorStop(0, '#674725')
    oak.addColorStop(0.3, '#b18b50')
    oak.addColorStop(0.65, '#926a39')
    oak.addColorStop(1, '#49331e')
    context.fillStyle = oak
    context.fillRect(-10, -3, 20, 6)
    context.strokeStyle = '#3e2c198c'
    context.lineWidth = 0.55
    for (const grain of [-1.6, 0.2, 1.6]) {
      context.beginPath()
      context.moveTo(-9, grain)
      context.bezierCurveTo(-4, grain - 0.8, 1, grain + 0.8, 9, grain - 0.1)
      context.stroke()
    }
    context.strokeStyle = '#e4bc7760'
    context.beginPath()
    context.moveTo(-8, -1.3)
    context.quadraticCurveTo(-3, -2.1, 2, -1.1)
    context.stroke()
    context.fillStyle = '#d5ad6c'
    context.fillRect(-10, lightY < 0 ? -3 : 2.4, 20, 0.6)
    context.fillStyle = '#31251b'
    context.fillRect(-10, lightY < 0 ? 2.4 : -3, 20, 0.6)

    // Forged iron bindings wrap across the door's top edge, with tiny rivet heads.
    for (const band of [-7, 6]) {
      context.fillStyle = '#17221e'
      context.fillRect(band, -3.8, 1.8, 7.6)
      context.fillStyle = '#7d8a7b'
      context.fillRect(band, -3.2, 0.55, 6.4)
      context.fillStyle = '#a39a77'
      context.fillRect(band + 0.5, -2, 0.75, 0.75)
      context.fillRect(band + 0.5, 1.5, 0.75, 0.75)
    }
    context.fillStyle = '#29332b'
    context.fillRect(2, 1.5, 3, 2.8)
    context.strokeStyle = '#b6a87d'
    context.lineWidth = 0.7
    context.beginPath()
    context.ellipse(3.5, 4.2, 1.1, 0.7, 0, 0, Math.PI * 2)
    context.stroke()
  }

  // Each jamb has a chipped, beveled cap and a darker exposed stone face.
  for (const side of [-1, 1]) {
    const left = side < 0 ? -16 : 10
    const cap = new Path2D()
    cap.moveTo(left + 1, -8)
    cap.lineTo(left + 5, -8)
    cap.lineTo(left + 6, -6.5)
    cap.lineTo(left + 6, 6.5)
    cap.lineTo(left + 4.8, 8)
    cap.lineTo(left + 0.8, 8)
    cap.lineTo(left, 6)
    cap.lineTo(left, -6.5)
    cap.closePath()
    context.fillStyle = '#080e0ad9'
    context.fillRect(left, -7, 6.5, 17)
    const stone = context.createLinearGradient(left, 8 * lightY, left + 6, -8 * lightY)
    stone.addColorStop(0, '#a09d87')
    stone.addColorStop(0.45, '#7c8170')
    stone.addColorStop(1, '#4a574a')
    context.fillStyle = stone
    context.fill(cap)
    context.save()
    context.clip(cap)
    for (let n = 0; n < 34; n++) {
      const sx = left + ((n * 17 + side * 3 + 7) % 59) / 10
      const sy = -7 + ((n * 29 + 17) % 141) / 10
      context.fillStyle = n % 3 ? '#26362a45' : '#d5cbb440'
      context.fillRect(sx, sy, 0.7, 0.65)
    }
    context.strokeStyle = '#364233c0'
    context.lineWidth = 0.65
    context.beginPath()
    context.moveTo(left, -1.5)
    context.lineTo(left + 6, -1.5)
    context.moveTo(left + 1, 5)
    context.lineTo(left + 2, 3)
    context.lineTo(left + 1.5, 1)
    context.stroke()
    context.restore()
    context.strokeStyle = '#c5bfa16b'
    context.lineWidth = 0.7
    context.beginPath()
    context.moveTo(left + 0.7, -6)
    context.lineTo(left + 0.7, -7)
    context.lineTo(left + 5, -7)
    context.stroke()
  }
  context.restore()
}
