import type { FoundationOptions } from './renderer'
/** Approved visual reference; production translates its appearance presets into these same options. */
export const FINAL_FOUNDATION: Readonly<FoundationOptions> = Object.freeze({
  treatment: 'ruins',
  floor: 'refined',
  separation: true,
  coping: 'hewn',
  capProfile: 'chamfered',
  capFinish: 'cut',
  capPolish: false,
  stairs: 'recessed',
  stairArrow: 'brass',
  stairProfile: 'ascending',
  depthSortedStairs: true,
  torches: 'mounted',
  northTorchMount: 'projecting',
})
