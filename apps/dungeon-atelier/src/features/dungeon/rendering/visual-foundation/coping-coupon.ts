import { createFoundationScene } from './model'
/** Separate connection coupon; never changes the approved four-door room. */
export function createCopingCoupon() {
  const scene = createFoundationScene(),
    floor = scene.floor
  floor.seed = 'coping-connections-review'
  floor.tiles = Array.from({ length: 23 }, (_, y) =>
    Array.from({ length: 23 }, (_, x) =>
      x === 0 || y === 0 || x === 22 || y === 22 ? ('wall' as const) : ('floor' as const),
    ),
  )
  const wall = (x: number, y: number) => {
    floor.tiles[y]![x] = 'wall'
  }
  for (let x = 2; x <= 8; x++) wall(x, 4)
  for (let y = 2; y <= 7; y++) wall(5, y)
  for (let x = 13; x <= 19; x++) wall(x, 3)
  for (let y = 3; y <= 7; y++) wall(13, y)
  for (let x = 13; x <= 19; x++) wall(x, 12)
  for (let y = 10; y <= 16; y++) wall(16, y)
  for (let x = 3; x <= 8; x++) {
    wall(x, 11)
    wall(x, 16)
  }
  for (let y = 11; y <= 16; y++) {
    wall(3, y)
    wall(8, y)
  }
  floor.doors = []
  floor.shortcuts = []
  scene.facings = {}
  scene.torches = []
  return scene
}
