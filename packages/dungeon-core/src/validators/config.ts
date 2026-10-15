import { CONFIG_LIMITS as limits } from '../models/dungeon.js'
import type { GenerationConfig, ValidationResult } from '../models/dungeon.js'

export function validateConfig(config: GenerationConfig): ValidationResult {
  const errors: string[] = []
  if (!config || typeof config !== 'object')
    return { valid: false, errors: ['Configuration must be an object.'] }
  const integer = (label: string, value: number, min: number, max: number) => {
    if (!Number.isInteger(value) || value < min || value > max) {
      errors.push(`${label} must be an integer between ${min} and ${max}.`)
    }
  }
  integer('Map width', config.width, limits.minDimension, limits.maxDimension)
  integer('Map height', config.height, limits.minDimension, limits.maxDimension)
  integer('Floor number', config.floorNumber, 1, limits.maxFloorNumber)
  integer('Target room count', config.targetRoomCount, limits.minRoomCount, limits.maxRoomCount)
  integer('Minimum room size', config.minRoomSize, limits.minRoomSize, limits.maxRoomSize)
  integer('Maximum room size', config.maxRoomSize, limits.minRoomSize, limits.maxRoomSize)
  if (config.minRoomSize > config.maxRoomSize)
    errors.push('Minimum room size cannot exceed maximum room size.')
  if (config.maxRoomSize > Math.min(config.width, config.height) - 6) {
    errors.push('Maximum room size must leave a three-tile margin on each side of the map.')
  }
  if (
    typeof config.seed !== 'string' ||
    !config.seed.trim() ||
    config.seed.length > limits.maxSeedLength
  ) {
    errors.push(
      `Seed must contain 1–${limits.maxSeedLength} characters and cannot be only whitespace.`,
    )
  }
  if (
    !Number.isFinite(config.extraConnectionChance) ||
    config.extraConnectionChance < 0 ||
    config.extraConnectionChance > 1
  ) {
    errors.push('Extra connection chance must be between 0 and 1.')
  }
  return { valid: errors.length === 0, errors }
}
