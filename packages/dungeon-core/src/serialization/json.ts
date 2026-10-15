import type { DungeonFloor, FloorResult } from '../models/dungeon.js'
import { validateFloor } from '../validators/floor.js'

/** A full 96×96 floor is well below this bound; reject oversized input before parsing. */
export const MAX_IMPORT_CHARACTERS = 5 * 1024 * 1024

export function importFloorJson(json: string): FloorResult {
  if (json.length > MAX_IMPORT_CHARACTERS)
    return { ok: false, errors: ['The JSON file exceeds the 5 MiB text limit.'] }
  let value: unknown
  try {
    value = JSON.parse(json)
  } catch {
    return { ok: false, errors: ['The selected file is not valid JSON.'] }
  }
  const validation = validateFloor(value)
  if (!validation.valid) return { ok: false, errors: validation.errors }
  // validateFloor checks the external schema and structural invariants before this cast.
  return { ok: true, floor: value as DungeonFloor }
}

export function exportFloorJson(floor: DungeonFloor): string {
  const validation = validateFloor(floor)
  if (!validation.valid)
    throw new Error(`Cannot export an invalid floor: ${validation.errors.join(' ')}`)
  return JSON.stringify(floor, null, 2)
}
