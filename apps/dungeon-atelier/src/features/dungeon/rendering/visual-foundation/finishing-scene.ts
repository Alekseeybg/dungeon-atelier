import { createFoundationScene } from './model'
/** Adds review features without moving any floor cell, wall, door or existing torch. */
export function createFinishingScene(secretNorth = false) {
  const scene = createFoundationScene(secretNorth)
  scene.floor.stairs = [
    { id: 'review-up', position: { x: 8, y: 8 }, direction: 'up', roomId: 'foundation-room' },
    { id: 'review-down', position: { x: 14, y: 8 }, direction: 'down', roomId: 'foundation-room' },
  ]
  scene.torches.push({ x: 6, y: 9 })
  scene.torchFacings = { '6,9': 'east' }
  return scene
}
