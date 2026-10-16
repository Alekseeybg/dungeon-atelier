import { DEFAULT_CONFIG } from '../../packages/dungeon-core/dist/index.js'

/** Deliberately isolated renderer fixture: one room, four dead-end approaches, no generator calls.
 * It is not an importable dungeon: production floors require at least two rooms. */
export function fourDoorRoom(secret = false) {
  const width = 21,
    height = 21
  const tiles = Array.from({ length: height }, () => Array(width).fill('wall'))
  const room = { id: 'central', x: 7, y: 7, width: 7, height: 7, shape: 'rectangle' }
  for (let y = 7; y <= 13; y++) for (let x = 7; x <= 13; x++) tiles[y][x] = 'floor'
  for (let p = 2; p <= 18; p++) {
    tiles[10][p] = 'floor'
    tiles[p][10] = 'floor'
  }
  const doors = [
    ['north', 10, 6, 'north-south'],
    ['south', 10, 14, 'north-south'],
    ['east', 14, 10, 'east-west'],
    ['west', 6, 10, 'east-west'],
  ].map(([id, x, y, orientation]) => ({
    id,
    position: { x, y },
    orientation,
    type: secret && id === 'north' ? 'secret' : 'regular',
    roomId: room.id,
  }))
  for (const door of doors) tiles[door.position.y][door.position.x] = 'door'
  return {
    schemaVersion: 2,
    generatorVersion: '3.1.0',
    seed: 'four-direction-door-study',
    floorNumber: 1,
    width,
    height,
    config: { ...DEFAULT_CONFIG, width, height, seed: 'four-direction-door-study' },
    tiles,
    rooms: [room],
    doors,
    stairs: [],
    roomGroups: [],
    shortcuts: secret
      ? [{ id: 'hidden-north', path: Array.from({ length: 5 }, (_, i) => ({ x: 10, y: 2 + i })) }]
      : [],
    diagnostics: { warnings: [] },
  }
}
