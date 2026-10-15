export const SCHEMA_VERSION = 2 as const
export const GENERATOR_VERSION = '3.1.0'

export const CONFIG_LIMITS = {
  minDimension: 16,
  maxDimension: 96,
  minRoomSize: 3,
  maxRoomSize: 16,
  minRoomCount: 2,
  maxRoomCount: 80,
  maxFloorNumber: 999,
  maxSeedLength: 128,
  placementAttemptsPerRoom: 100,
} as const

export interface GenerationConfig {
  width: number
  height: number
  floorNumber: number
  seed: string
  targetRoomCount: number
  minRoomSize: number
  maxRoomSize: number
  extraConnectionChance: number
  /** Optional extensions retain compatibility with stored version-1 floors. */
  layoutStyle?: 'classic' | 'compact'
  roomSpacing?: number
  roomShapeChance?: number
  shortcutChance?: number
  roomDesigns?: RoomDesign[]
  chamberBlockChance?: number
}

export const DEFAULT_CONFIG: GenerationConfig = {
  width: 32,
  height: 32,
  floorNumber: 1,
  seed: 'atelier-001',
  targetRoomCount: 8,
  minRoomSize: 3,
  maxRoomSize: 7,
  extraConnectionChance: 0.2,
  layoutStyle: 'classic',
  roomSpacing: 3,
  roomShapeChance: 0.25,
  shortcutChance: 0.15,
  roomDesigns: ['l-shaped', 't-shaped', 'cross-shaped', 'alcoved', 'u-shaped', 'chamfered'],
  chamberBlockChance: 0.2,
}

/** Origin is top-left. x increases right; y increases down. */
export interface Position {
  x: number
  y: number
}
export type Terrain = 'wall' | 'floor' | 'door'
export const ROOM_DESIGNS = [
  { value: 'l-shaped', label: 'L-shaped rooms', minSide: 3, minLength: 3 },
  { value: 't-shaped', label: 'T-shaped rooms', minSide: 3, minLength: 3 },
  { value: 'cross-shaped', label: 'Cross-shaped halls', minSide: 5, minLength: 5 },
  { value: 'alcoved', label: 'Alcoved halls', minSide: 5, minLength: 7 },
  { value: 'u-shaped', label: 'U-shaped galleries', minSide: 5, minLength: 5 },
  { value: 'chamfered', label: 'Chamfered chambers', minSide: 5, minLength: 5 },
] as const
export type RoomDesign = (typeof ROOM_DESIGNS)[number]['value']
export type RoomShape = 'rectangle' | RoomDesign
export const LAYOUT_PRESETS = {
  classic: { roomSpacing: 3, roomShapeChance: 0.25 },
  compact: { roomSpacing: 1, roomShapeChance: 0.45 },
} as const

export interface Room extends Position {
  id: string
  width: number
  height: number
  groupId?: string
  shape?: RoomShape
  /** Relative floor coordinates; omitted for rectangular rooms and legacy floors. */
  floorCells?: Position[]
}
export interface RoomGroup extends Position {
  id: string
  kind: 'chamber-block'
  width: number
  height: number
  orientation: 'north-south' | 'east-west'
  roomIds: string[]
  /** Shared corridor floor, in absolute map coordinates; never room-owned. */
  corridorCells: Position[]
}
export interface Door {
  id: string
  position: Position
  type: 'regular' | 'secret'
  /** Direction of travel through the doorway. */
  orientation: 'north-south' | 'east-west'
  roomId: string
}
export interface Staircase {
  id: string
  position: Position
  direction: 'up' | 'down'
  roomId: string
}
export interface Shortcut {
  /** This route has a sealed, unbranched interior; omitted by older generators. */
  isolated?: true
  id: string
  fromRoomId: string
  toRoomId: string
  /** Ordered route, including its entrance and exit door tiles. */
  path: Position[]
  distanceBefore: number
  distanceAfter: number
  tilesSaved: number
}
export interface GenerationDiagnostics {
  generationAttempts?: number
  retryReasons?: string[]
  requestedRoomCount: number
  actualRoomCount: number
  walkableTileCount: number
  doorCount: number
  connectedRoomCount: number
  ordinaryConnected: boolean
  placementAttempts: number
  warnings: string[]
  corridorTileCount?: number
  corridorCoverage?: number
  deadEndCount?: number
  stairDistance?: number
  loopCount?: number
  sharedDoorCount?: number
  shortcutCount?: number
  shortcutTilesSaved?: number
}
/** Floor definition only: exploration and runtime state belong to their consumers. */
export interface DungeonFloor {
  schemaVersion: 1 | typeof SCHEMA_VERSION
  generatorVersion: string
  seed: string
  config: GenerationConfig
  floorNumber: number
  width: number
  height: number
  /** Row-major grid: tiles[y][x]. */
  tiles: Terrain[][]
  rooms: Room[]
  roomGroups?: RoomGroup[]
  doors: Door[]
  stairs: Staircase[]
  /** Omitted by older schema-2 files that did not record shortcut provenance. */
  shortcuts?: Shortcut[]
  diagnostics: GenerationDiagnostics
}
export interface ValidationResult {
  valid: boolean
  errors: string[]
}
export type FloorResult = { ok: true; floor: DungeonFloor } | { ok: false; errors: string[] }
