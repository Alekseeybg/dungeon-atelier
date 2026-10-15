export const SCHEMA_VERSION = 1 as const
export const GENERATOR_VERSION = '1.0.0'

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
}

/** Origin is top-left. x increases right; y increases down. */
export interface Position {
  x: number
  y: number
}
export type Terrain = 'wall' | 'floor' | 'door'
export interface Room extends Position {
  id: string
  width: number
  height: number
}
export interface Door {
  id: string
  position: Position
  type: 'regular'
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
export interface GenerationDiagnostics {
  requestedRoomCount: number
  actualRoomCount: number
  walkableTileCount: number
  doorCount: number
  connectedRoomCount: number
  ordinaryConnected: boolean
  placementAttempts: number
  warnings: string[]
}
/** Floor definition only: exploration and runtime state belong to their consumers. */
export interface DungeonFloor {
  schemaVersion: typeof SCHEMA_VERSION
  generatorVersion: string
  seed: string
  config: GenerationConfig
  floorNumber: number
  width: number
  height: number
  /** Row-major grid: tiles[y][x]. */
  tiles: Terrain[][]
  rooms: Room[]
  doors: Door[]
  stairs: Staircase[]
  diagnostics: GenerationDiagnostics
}
export interface ValidationResult {
  valid: boolean
  errors: string[]
}
export type FloorResult = { ok: true; floor: DungeonFloor } | { ok: false; errors: string[] }
