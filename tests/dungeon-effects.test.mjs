import { test } from 'node:test'
import assert from 'node:assert/strict'
import { heightNormals } from '../apps/dungeon-atelier/src/experiments/dungeon-3d/normal-map.ts'
import {
  BASELINE_EFFECTS,
  EFFECT_PRESETS,
  effectsStudy,
} from '../apps/dungeon-atelier/src/experiments/dungeon-3d/effects-settings.ts'

test('derived normals preserve source pixels and follow actual height slopes', () => {
  const width = 5,
    height = 3,
    flat = new Uint8ClampedArray(width * height * 4).fill(128),
    before = flat.slice()
  const normal = heightNormals(flat, width, height)
  assert.deepEqual(flat, before)
  for (let i = 0; i < normal.length; i += 4)
    assert.deepEqual([...normal.slice(i, i + 4)], [128, 128, 255, 255])
  const slope = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      slope[i] = slope[i + 1] = slope[i + 2] = x * 50
      slope[i + 3] = 255
    }
  const n = heightNormals(slope, width, height),
    i = (width + 2) * 4
  assert(n[i] < 128, 'A rising X height gradient tilts normals toward negative X')
  assert.equal(n[i + 1], 128)
  assert(n[i + 2] > 128)
  assert.deepEqual(n, heightNormals(slope, width, height))
})
test('effect study settings are reproducible and never mutate the baseline', () => {
  const snapshot = JSON.stringify(BASELINE_EFFECTS),
    a = effectsStudy('normal', 'normal'),
    b = effectsStudy('normal', 'normal')
  assert.deepEqual(a, b)
  a.normalStrength = 99
  assert.equal(JSON.stringify(BASELINE_EFFECTS), snapshot)
  assert.deepEqual(effectsStudy('normal', 'off'), BASELINE_EFFECTS)
  assert(effectsStudy('normal', 'diagnostic').normalStrength > b.normalStrength)
})

test('presets can be edited independently without changing the approved baseline', () => {
  const baseline = JSON.stringify(BASELINE_EFFECTS)
  for (const preset of Object.values(EFFECT_PRESETS)) {
    assert(Object.isFrozen(preset))
    assert.deepEqual(Object.keys(preset).sort(), Object.keys(BASELINE_EFFECTS).sort())
    const editable = { ...preset }
    editable.aoIntensity = 0
    editable.torchBudget = 1
    assert.notEqual(editable.torchBudget, preset.torchBudget)
    for (const value of Object.values(preset)) {
      if (typeof value === 'number') assert(Number.isFinite(value))
    }
  }
  assert.equal(JSON.stringify(BASELINE_EFFECTS), baseline)
  assert.deepEqual(EFFECT_PRESETS.baseline, BASELINE_EFFECTS)
  assert(EFFECT_PRESETS.combined.torchBudget <= 3)
})
