/** Session-only experiments. Zero/neutral controls recover the approved renderer exactly. */
export interface DungeonEffects {
  toneMapping: 'baseline' | 'neutral' | 'linear'
  exposure: number
  grade: boolean
  saturation: number
  contrast: number
  temperature: number
  bloom: boolean
  bloomStrength: number
  bloomRadius: number
  bloomThreshold: number
  torchShadows: boolean
  torchBudget: number
  torchIntensity: number
  torchRange: number
  torchDecay: number
  torchTint: 'baseline' | 'amber' | 'orange' | 'pale'
  shadowIntensity: number
  shadowSoftness: number
  keyLight: number
  ambientLight: number
  cavity: number
  edgeResponse: number
  aoMode: 'baseline' | 'on' | 'off'
  aoIntensity: number
  aoRadius: number
  aoOnly: boolean
  normals: boolean
  normalStrength: number
  roughness: boolean
  stoneRoughness: number
  woodRoughness: number
  ironRoughness: number
}
export const BASELINE_EFFECTS: Readonly<DungeonEffects> = Object.freeze({
  toneMapping: 'baseline',
  exposure: 1,
  grade: false,
  saturation: 1,
  contrast: 1,
  temperature: 0,
  bloom: false,
  bloomStrength: 0.3,
  bloomRadius: 0.25,
  bloomThreshold: 0.08,
  torchShadows: false,
  torchBudget: 8,
  torchIntensity: 1,
  torchRange: 1,
  torchDecay: 2,
  torchTint: 'baseline',
  shadowIntensity: 1,
  shadowSoftness: 1,
  keyLight: 1,
  ambientLight: 1,
  cavity: 0,
  edgeResponse: 1,
  aoMode: 'baseline',
  aoIntensity: 0.8,
  aoRadius: 0.65,
  aoOnly: false,
  normals: false,
  normalStrength: 0.55,
  roughness: false,
  stoneRoughness: 0.9,
  woodRoughness: 0.8,
  ironRoughness: 0.55,
})
export function effectsStudy(stage: string, variant: string): DungeonEffects {
  const baseline = { ...BASELINE_EFFECTS }
  if (stage === 'torch-shadows' && variant === 'off') return { ...baseline, torchBudget: 2 }
  if (variant === 'off')
    return stage === 'ao'
      ? { ...baseline, aoMode: 'off' }
      : stage === 'torch'
        ? { ...baseline, torchIntensity: 0 }
        : baseline
  if (stage === 'normal')
    return { ...baseline, normals: true, normalStrength: variant === 'diagnostic' ? 2.5 : 0.55 }
  if (stage === 'roughness')
    return {
      ...baseline,
      roughness: true,
      stoneRoughness: variant === 'diagnostic' ? 0.12 : 0.9,
      woodRoughness: variant === 'diagnostic' ? 0.1 : 0.8,
      ironRoughness: variant === 'diagnostic' ? 0.08 : 0.55,
    }
  if (stage === 'ao')
    return {
      ...baseline,
      aoMode: 'on',
      aoIntensity: variant === 'diagnostic' ? 1 : 0.8,
      aoRadius: variant === 'diagnostic' ? 1.5 : 0.65,
    }
  if (stage === 'cavity')
    return {
      ...baseline,
      cavity: variant === 'diagnostic' ? 0.95 : 0.35,
      edgeResponse: variant === 'diagnostic' ? 2.2 : 1.25,
    }
  if (stage === 'shadows')
    return {
      ...baseline,
      shadowIntensity: variant === 'diagnostic' ? 0.2 : 0.8,
      shadowSoftness: variant === 'diagnostic' ? 6 : 2.5,
    }
  if (stage === 'torch')
    return {
      ...baseline,
      torchIntensity: variant === 'diagnostic' ? 4 : 1.3,
      torchRange: variant === 'diagnostic' ? 1.5 : 1.15,
      torchTint: variant === 'diagnostic' ? 'orange' : 'baseline',
    }
  if (stage === 'torch-shadows')
    return {
      ...baseline,
      torchShadows: true,
      torchBudget: 2,
      torchIntensity: variant === 'diagnostic' ? 2 : 1,
      shadowIntensity: variant === 'diagnostic' ? 1 : 0.85,
    }
  if (stage === 'bloom')
    return {
      ...baseline,
      bloom: true,
      bloomStrength: variant === 'diagnostic' ? 2 : 0.3,
      bloomRadius: variant === 'diagnostic' ? 0.8 : 0.25,
    }
  if (stage === 'tone')
    return {
      ...baseline,
      toneMapping: variant === 'diagnostic' ? 'linear' : 'neutral',
      exposure: variant === 'diagnostic' ? 1.3 : 1,
    }
  if (stage === 'grade')
    return {
      ...baseline,
      grade: true,
      saturation: variant === 'diagnostic' ? 0.35 : 0.95,
      contrast: variant === 'diagnostic' ? 1.3 : 1.04,
      temperature: variant === 'diagnostic' ? 0.3 : -0.04,
    }
  if (stage === 'combined')
    return variant === 'diagnostic'
      ? {
          ...EFFECT_PRESETS.combined,
          normalStrength: 1.2,
          bloomStrength: 1,
          aoRadius: 1.2,
          torchIntensity: 2,
        }
      : { ...EFFECT_PRESETS.combined }
  return baseline
}

const depth: DungeonEffects = {
  ...BASELINE_EFFECTS,
  aoMode: 'on',
  cavity: 0.25,
  edgeResponse: 1.25,
  shadowIntensity: 0.9,
  shadowSoftness: 2,
  torchShadows: true,
  torchBudget: 2,
}
const materials: DungeonEffects = {
  ...BASELINE_EFFECTS,
  normals: true,
  normalStrength: 0.25,
  roughness: true,
  stoneRoughness: 0.92,
  woodRoughness: 0.82,
  ironRoughness: 0.6,
}
const atmosphere: DungeonEffects = {
  ...BASELINE_EFFECTS,
  torchShadows: true,
  torchBudget: 2,
  torchIntensity: 1.15,
  torchRange: 1.1,
  bloom: true,
  bloomStrength: 0.22,
  bloomRadius: 0.2,
  grade: true,
  saturation: 0.95,
  contrast: 1.02,
  temperature: -0.03,
  exposure: 1.02,
}
export const EFFECT_PRESETS = {
  baseline: Object.freeze({ ...BASELINE_EFFECTS }),
  depth: Object.freeze(depth),
  materials: Object.freeze(materials),
  atmosphere: Object.freeze(atmosphere),
  combined: Object.freeze({
    ...depth,
    normals: true,
    normalStrength: 0.25,
    roughness: true,
    stoneRoughness: 0.92,
    woodRoughness: 0.82,
    ironRoughness: 0.6,
    torchIntensity: 1.15,
    torchRange: 1.1,
    bloom: true,
    bloomStrength: 0.2,
    bloomRadius: 0.2,
    grade: true,
    saturation: 0.96,
    contrast: 1.02,
    temperature: -0.02,
  }),
} as const
export type EffectPreset = keyof typeof EFFECT_PRESETS
export const EFFECT_PRESET_OPTIONS = [
  { label: 'Baseline', value: 'baseline' },
  { label: 'Depth Study', value: 'depth' },
  { label: 'Material Study', value: 'materials' },
  { label: 'Atmosphere Study', value: 'atmosphere' },
  { label: 'Combined', value: 'combined' },
] as const
