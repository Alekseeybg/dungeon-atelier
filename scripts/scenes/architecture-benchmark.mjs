import {
  DEFAULT_CONFIG,
  calculateRouteMetrics,
  validateFloor,
} from '../../packages/dungeon-core/dist/index.js'
import { flood } from '../../tests/helpers/verify-floor.mjs'

/** Real, validated floor geometry; a stable architecture benchmark, not a generated screenshot. */
export function architectureBenchmark() {
  const width = 32,
    height = 24,
    tiles = Array.from({ length: height }, () => Array(width).fill('wall'))
  const rooms = [
    { id: 'room-a', x: 3, y: 3, width: 7, height: 7, shape: 'rectangle' },
    {
      id: 'room-b',
      x: 13,
      y: 14,
      width: 7,
      height: 7,
      shape: 'l-shaped',
      floorCells: Array.from({ length: 49 }, (_, i) => ({ x: i % 7, y: Math.floor(i / 7) })).filter(
        (p) => p.x < 5 || p.y < 5,
      ),
    },
    { id: 'room-c', x: 23, y: 14, width: 7, height: 7, shape: 'rectangle' },
    { id: 'room-d', x: 3, y: 14, width: 7, height: 7, shape: 'rectangle' },
  ]
  for (const room of rooms)
    for (const p of room.floorCells ??
      Array.from({ length: 49 }, (_, i) => ({ x: i % 7, y: Math.floor(i / 7) })))
      tiles[room.y + p.y][room.x + p.x] = 'floor'
  for (let x = 11; x <= 26; x++) tiles[6][x] = 'floor'
  for (let y = 7; y <= 12; y++) tiles[y][26] = 'floor'
  tiles[17][21] = 'floor'
  for (let y = 6; y <= 22; y++) tiles[y][1] = 'floor'
  for (let x = 2; x <= 6; x++) tiles[22][x] = 'floor'
  tiles[17][11] = 'floor'
  const path = [
    { x: 6, y: 10 },
    { x: 6, y: 11 },
    ...Array.from({ length: 11 }, (_, i) => ({ x: 6 + i, y: 12 })),
    { x: 16, y: 13 },
  ]
  for (const p of path) tiles[p.y][p.x] = 'floor'
  const doors = [
    {
      id: 'door-a-west',
      position: { x: 2, y: 6 },
      orientation: 'east-west',
      type: 'regular',
      roomId: 'room-a',
    },
    {
      id: 'door-d-south',
      position: { x: 6, y: 21 },
      orientation: 'north-south',
      type: 'regular',
      roomId: 'room-d',
    },
    {
      id: 'door-d-east',
      position: { x: 10, y: 17 },
      orientation: 'east-west',
      type: 'regular',
      roomId: 'room-d',
    },
    {
      id: 'door-b-west',
      position: { x: 12, y: 17 },
      orientation: 'east-west',
      type: 'regular',
      roomId: 'room-b',
    },
    {
      id: 'door-a',
      position: { x: 10, y: 6 },
      orientation: 'east-west',
      type: 'regular',
      roomId: 'room-a',
    },
    {
      id: 'door-c-north',
      position: { x: 26, y: 13 },
      orientation: 'north-south',
      type: 'regular',
      roomId: 'room-c',
    },
    {
      id: 'door-c-west',
      position: { x: 22, y: 17 },
      orientation: 'east-west',
      type: 'regular',
      roomId: 'room-c',
    },
    {
      id: 'door-b-east',
      position: { x: 20, y: 17 },
      orientation: 'east-west',
      type: 'regular',
      roomId: 'room-b',
    },
    {
      id: 'secret-a',
      position: path[0],
      orientation: 'north-south',
      type: 'secret',
      roomId: 'room-a',
    },
    {
      id: 'secret-b',
      position: path.at(-1),
      orientation: 'north-south',
      type: 'secret',
      roomId: 'room-b',
    },
  ]
  for (const door of doors) tiles[door.position.y][door.position.x] = 'door'
  const stairs = [
    { id: 'up', position: { x: 6, y: 6 }, direction: 'up', roomId: 'room-a' },
    { id: 'down', position: { x: 16, y: 17 }, direction: 'down', roomId: 'room-b' },
  ]
  const floor = {
    schemaVersion: 2,
    generatorVersion: '3.1.0',
    seed: 'dimensional-architecture-benchmark-v1',
    floorNumber: 1,
    width,
    height,
    config: {
      ...DEFAULT_CONFIG,
      width,
      height,
      targetRoomCount: 4,
      minRoomSize: 7,
      maxRoomSize: 7,
      shortcutChance: 1,
      chamberBlockChance: 0,
    },
    tiles,
    rooms,
    doors,
    stairs,
    roomGroups: [],
    shortcuts: [],
  }
  const sealed = new Set(path.map((p) => p.y * width + p.x)),
    target = 17 * width + 16
  const distanceBefore = flood(floor, stairs[0].position, sealed)[target],
    distanceAfter = flood(floor, stairs[0].position)[target]
  floor.shortcuts.push({
    id: 'secret-route',
    isolated: true,
    fromRoomId: 'room-a',
    toRoomId: 'room-b',
    path,
    distanceBefore,
    distanceAfter,
    tilesSaved: distanceBefore - distanceAfter,
  })
  floor.config.seed = floor.seed
  floor.diagnostics = {
    requestedRoomCount: 4,
    actualRoomCount: 4,
    walkableTileCount: tiles.flat().filter((t) => t !== 'wall').length,
    doorCount: doors.length,
    connectedRoomCount: 4,
    ordinaryConnected: true,
    placementAttempts: 4,
    warnings: [],
    ...calculateRouteMetrics(floor),
    shortcutCount: 1,
    shortcutTilesSaved: distanceBefore - distanceAfter,
  }
  const check = validateFloor(floor)
  if (!check.valid) throw new Error(check.errors.join('; '))
  return floor
}
