import { DEFAULT_CONFIG } from '@dungeon-atelier/core'
import type { Door, DungeonFloor, Position, Terrain } from '@dungeon-atelier/core'

/** Shared approved projection for architecture, editor interactions and export. */
export const FOUNDATION = Object.freeze({
  tile: 32,
  depth: 26 / 32,
  rise: 24,
  side: 6,
  density: 2,
  padding: 32,
})
export type Facing = 'north' | 'south' | 'east' | 'west'
export interface FoundationScene {
  floor: DungeonFloor
  facings: Record<string, Facing>
  torches: Position[]
  torchFacings?: Record<string, 'south' | 'east'>
  weathered: { x: number; y: number; width: number; height: number }
}
export function project(x: number, y: number, elevation = 0): Position {
  return {
    x: x - FOUNDATION.side * elevation,
    y: y * FOUNDATION.depth - FOUNDATION.rise * elevation,
  }
}
export function unprojectGround(x: number, y: number): Position {
  return { x, y: y / FOUNDATION.depth }
}
export function spriteOrigin(x: number, y: number) {
  return project(x * 32, y * 32)
}
export function viewBounds(floor: DungeonFloor) {
  return {
    width: floor.width * FOUNDATION.tile + FOUNDATION.padding * 2,
    height: floor.height * FOUNDATION.tile * FOUNDATION.depth + FOUNDATION.padding * 2,
    origin: { x: FOUNDATION.padding, y: FOUNDATION.padding },
  }
}
export function doorSurface(position: Position, facing: Facing) {
  const x = position.x * 32,
    y = position.y * 32
  const horizontal = facing === 'north' || facing === 'south'
  // Visible surfaces are fixed by the camera: south face of horizontal walls,
  // east face of vertical walls, independently of which room owns the door.
  // Six-pixel jambs sit in the surrounding masonry rather than consuming the
  // entire walkable cell's opening. The 44px assembly spans a 32px doorway.
  const a = horizontal ? { x: x - 6, y: y + 26 } : { x: x + 26, y: y - 6 }
  const b = horizontal ? { x: x + 38, y: y + 26 } : { x: x + 26, y: y + 38 }
  return {
    a,
    b,
    horizontal,
    topLeft: project(a.x, a.y, 1),
    topRight: project(b.x, b.y, 1),
    bottomLeft: project(a.x, a.y),
  }
}
/** One-room art fixture, not a serialized/generated floor. No generator calls. */
export function createFoundationScene(secretNorth = false): FoundationScene {
  const width = 23,
    height = 23
  const tiles: DungeonFloor['tiles'] = Array.from({ length: height }, () =>
    Array.from({ length: width }, (): Terrain => 'wall'),
  )
  const room = {
    id: 'foundation-room',
    x: 7,
    y: 7,
    width: 9,
    height: 9,
    shape: 'rectangle' as const,
  }
  for (let y = 7; y <= 15; y++) for (let x = 7; x <= 15; x++) tiles[y]![x] = 'floor'
  for (let p = 2; p <= 20; p++) {
    tiles[11]![p] = 'floor'
    tiles[p]![11] = 'floor'
  }
  for (let x = 11; x <= 17; x++) tiles[3]![x] = 'floor'
  tiles[2]![17] = 'floor'
  for (let y = 8; y <= 14; y++) tiles[y]![3] = 'floor'
  for (let x = 11; x <= 16; x++) tiles[20]![x] = 'floor'
  for (let y = 9; y <= 13; y++) tiles[y]![19] = 'floor'
  const doors: Door[] = [
    {
      id: 'north',
      position: { x: 11, y: 6 },
      orientation: 'north-south',
      type: secretNorth ? 'secret' : 'regular',
      roomId: room.id,
    },
    {
      id: 'south',
      position: { x: 11, y: 16 },
      orientation: 'north-south',
      type: 'regular',
      roomId: room.id,
    },
    {
      id: 'east',
      position: { x: 16, y: 11 },
      orientation: 'east-west',
      type: 'regular',
      roomId: room.id,
    },
    {
      id: 'west',
      position: { x: 6, y: 11 },
      orientation: 'east-west',
      type: 'regular',
      roomId: room.id,
    },
  ]
  for (const door of doors) tiles[door.position.y]![door.position.x] = 'door'
  const floor: DungeonFloor = {
    schemaVersion: 2,
    generatorVersion: '3.1.0',
    seed: 'visual-foundation-v1',
    floorNumber: 1,
    width,
    height,
    config: { ...DEFAULT_CONFIG, width, height, seed: 'visual-foundation-v1' },
    tiles,
    rooms: [room],
    doors,
    stairs: [],
    roomGroups: [],
    shortcuts: [],
    diagnostics: {
      requestedRoomCount: 1,
      actualRoomCount: 1,
      walkableTileCount: tiles.flat().filter((t) => t !== 'wall').length,
      doorCount: 4,
      connectedRoomCount: 1,
      ordinaryConnected: true,
      placementAttempts: 1,
      warnings: [],
    },
  }
  if (secretNorth)
    floor.shortcuts = [
      {
        id: 'hidden-north-approach',
        fromRoomId: room.id,
        toRoomId: room.id,
        isolated: true,
        path: [
          ...Array.from({ length: 5 }, (_, i) => ({ x: 11, y: i + 2 })),
          ...Array.from({ length: 6 }, (_, i) => ({ x: i + 12, y: 3 })),
          { x: 17, y: 2 },
        ],
        distanceBefore: 0,
        distanceAfter: 0,
        tilesSaved: 0,
      },
    ]
  return {
    floor,
    facings: { north: 'north', south: 'south', east: 'east', west: 'west' },
    torches: [
      { x: 9, y: 6 },
      { x: 13, y: 6 },
    ],
    weathered: { x: 12, y: 12, width: 3, height: 3 },
  }
}
