import type { DungeonFloor } from '@dungeon-atelier/core'
import { concealSecretArchitecture, doorFacing } from '../dimensional-model'
import { mountedTorchPlacements } from '../mounted-placement'
import type { FoundationScene } from './model'

/** Presentation adapter only. The generator, terrain, collision and coordinates stay intact. */
export function generatedFoundationScene(
  source: DungeonFloor,
  revealSecrets = true,
): FoundationScene {
  const floor = revealSecrets ? source : concealSecretArchitecture(source),
    mounts = mountedTorchPlacements(floor)
  return {
    floor,
    facings: Object.fromEntries(floor.doors.map((door) => [door.id, doorFacing(floor, door)])),
    torches: mounts.torches,
    torchFacings: mounts.facings,
    weathered: { x: 0, y: 0, width: 0, height: 0 },
  }
}
