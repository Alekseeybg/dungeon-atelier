import type { DungeonFloor, Position } from '@dungeon-atelier/core'
import type { MapRenderOptions } from './map-style'
import type { WalkState } from '../exploration/useDungeonWalk'
import { normalizeAncient, ancientOptions, ancientFloorAssignments } from './ancient-settings'
import { generatedFoundationScene } from './visual-foundation/generated-scene'
import { composeFoundation } from './visual-foundation/renderer'
import { ownMapCanvas } from './map-resources'

type Scene = Awaited<ReturnType<typeof composeFoundation>>
const scenes = new WeakMap<HTMLCanvasElement, { scene: Scene; floor: DungeonFloor }>()
/** No global generated-floor cache: one committed viewport and transient export are caller-owned. */
export async function renderAncient(
  floor: DungeonFloor,
  grid: boolean,
  options: MapRenderOptions = {},
) {
  const appearance = normalizeAncient(options.ancient),
    source = generatedFoundationScene(floor, !!options.revealSecrets)
  if (!appearance.torches) source.torches = []
  const scene = await composeFoundation(
    source,
    {
      ...ancientOptions(appearance),
      grid,
      secret: 'revealed',
      ...(options.openDoorIds ? { openDoorIds: options.openDoorIds } : {}),
    },
    ancientFloorAssignments(source.floor, appearance),
  )
  scenes.set(scene.image, { scene, floor: source.floor })
  ownMapCanvas(scene.image, () => {
    scene.dispose()
    scenes.delete(scene.image)
  })
  return scene.image
}
export function pickAncient(canvas: HTMLCanvasElement, point: Position) {
  return scenes.get(canvas)?.scene.pick(point) ?? null
}
/** Remove unknown foreground masonry from explored ground without allocating another full map. */
export function drawAncientWalkCutaway(
  c: CanvasRenderingContext2D,
  map: HTMLCanvasElement,
  walk: WalkState,
) {
  const data = scenes.get(map)
  if (!data || !walk.active) return
  const { floor, scene } = data
  for (const key of walk.explored) {
    const x = key % floor.width,
      y = Math.floor(key / floor.width)
    if (!['floor', 'door'].includes(floor.tiles[y]?.[x] ?? '')) continue
    const underfoot = walk.position?.x === x && walk.position.y === y,
      hiddenFront = [
        [0, 1],
        [1, 0],
        [1, 1],
      ].some(([dx, dy]) => {
        const nx = x + dx!,
          ny = y + dy!,
          other = ny * floor.width + nx
        return floor.tiles[ny]?.[nx] === 'wall' && (!walk.explored.has(other) || underfoot)
      })
    if (hiddenFront || underfoot) scene.groundCell(c, x, y)
  }
}
