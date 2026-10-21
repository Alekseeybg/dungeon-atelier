<template>
  <q-card
    flat
    bordered
    class="q-pa-md effects-panel"
    id="dungeon-effects"
    aria-label="Effects Playground"
  >
    <div class="effects-header q-mb-md">
      <div class="col">
        <div class="row items-center">
          <div class="text-h6 col">Effects Playground</div>
          <q-btn
            flat
            round
            dense
            icon="close"
            aria-label="Close Effects Playground"
            @click="$emit('close')"
          />
        </div>
        <div class="text-caption text-grey-5">
          Session-only experiments. The approved rendering is the baseline.
        </div>
      </div>
      <q-select
        :model-value="preset"
        :options="presetOptions"
        emit-value
        map-options
        outlined
        dense
        label="Comparison preset"
        aria-label="Effects preset"
        class="q-my-sm"
        @update:model-value="$emit('preset', $event)"
      />
      <q-btn outline no-caps label="Reset to Baseline" @click="$emit('reset')" />
    </div>
    <div class="effects-grid">
      <q-expansion-item dense default-opened label="Depth &amp; AO" class="effect-section">
        <q-select
          :model-value="modelValue.aoMode"
          :options="['baseline', 'on', 'off']"
          label="Contact AO"
          aria-label="Effects AO mode"
          outlined
          dense
          @update:model-value="patch({ aoMode: $event })"
        />
        <div class="text-caption q-mt-md">
          AO intensity · {{ modelValue.aoIntensity.toFixed(2) }}
        </div>
        <q-slider
          :model-value="modelValue.aoIntensity"
          :min="0"
          :max="1"
          :step="0.05"
          label
          aria-label="Effects AO intensity"
          @update:model-value="patch({ aoIntensity: Number($event) })"
        />
        <div class="text-caption">AO radius · {{ modelValue.aoRadius.toFixed(2) }} tiles</div>
        <q-slider
          :model-value="modelValue.aoRadius"
          :min="0.1"
          :max="2"
          :step="0.05"
          label
          aria-label="Effects AO radius"
          @update:model-value="patch({ aoRadius: Number($event) })"
        />
        <q-toggle
          :model-value="modelValue.aoOnly"
          label="AO-only diagnostic"
          aria-label="Effects AO diagnostic"
          @update:model-value="patch({ aoOnly: !!$event })"
        />

        <div class="text-caption">Recessed mortar · {{ modelValue.cavity.toFixed(2) }}</div>
        <q-slider
          :model-value="modelValue.cavity"
          :min="0"
          :max="1"
          :step="0.05"
          label
          aria-label="Effects cavity"
          @update:model-value="patch({ cavity: Number($event) })"
        />
        <div class="text-caption">
          Bevel light response · {{ modelValue.edgeResponse.toFixed(2) }}
        </div>
        <q-slider
          :model-value="modelValue.edgeResponse"
          :min="0.5"
          :max="2.2"
          :step="0.05"
          label
          aria-label="Effects edge response"
          @update:model-value="patch({ edgeResponse: Number($event) })"
        />
      </q-expansion-item>
      <q-expansion-item dense label="Shadows &amp; Lighting" class="effect-section">
        <template v-for="control in [...shadowControls, ...torchControls]" :key="control.key">
          <div class="text-caption">
            {{ control.label }} · {{ modelValue[control.key].toFixed(2) }}
          </div>
          <q-slider
            :model-value="modelValue[control.key]"
            :min="control.min"
            :max="control.max"
            :step="0.05"
            label
            :aria-label="'Effects ' + control.key"
            @update:model-value="patch({ [control.key]: Number($event) })"
          />
        </template>
        <q-toggle
          :model-value="modelValue.torchShadows"
          label="Local torch shadows"
          aria-label="Effects torch shadows"
          @update:model-value="
            patch({
              torchShadows: !!$event,
              torchBudget: $event ? Math.min(2, modelValue.torchBudget) : modelValue.torchBudget,
            })
          "
        />
        <div class="text-caption">Active torch budget · {{ modelValue.torchBudget }}</div>
        <q-slider
          :model-value="modelValue.torchBudget"
          :min="1"
          :max="modelValue.torchShadows ? 3 : 8"
          :step="1"
          label
          aria-label="Effects torch budget"
          @update:model-value="patch({ torchBudget: Number($event) })"
        />
        <p class="text-caption text-grey-5">
          Shadowed torches are limited to the nearest active lights. The main light/shadow switches
          also apply.
        </p>
        <q-select
          :model-value="modelValue.torchTint"
          :options="['baseline', 'amber', 'orange', 'pale']"
          label="Torch color"
          aria-label="Effects torch tint"
          outlined
          dense
          @update:model-value="patch({ torchTint: $event })"
        />
      </q-expansion-item>

      <q-expansion-item dense label="Materials" class="effect-section">
        <q-toggle
          :model-value="modelValue.normals"
          label="Derived normal maps"
          aria-label="Effects normal maps"
          @update:model-value="patch({ normals: !!$event })"
        />
        <div class="text-caption">Normal strength · {{ modelValue.normalStrength.toFixed(2) }}</div>
        <q-slider
          :model-value="modelValue.normalStrength"
          :min="0"
          :max="3"
          :step="0.05"
          label
          aria-label="Effects normal strength"
          @update:model-value="patch({ normalStrength: Number($event) })"
        />
        <q-toggle
          :model-value="modelValue.roughness"
          label="Roughness study"
          aria-label="Effects roughness"
          @update:model-value="patch({ roughness: !!$event })"
        />
        <template
          v-for="field in ['stoneRoughness', 'woodRoughness', 'ironRoughness'] as const"
          :key="field"
        >
          <div class="text-caption">{{ field }} · {{ modelValue[field].toFixed(2) }}</div>
          <q-slider
            :model-value="modelValue[field]"
            :min="0.05"
            :max="1"
            :step="0.05"
            label
            :aria-label="'Effects ' + field"
            @update:model-value="patch({ [field]: Number($event) })"
          />
        </template>
        <p class="text-caption text-grey-5">
          Derived from existing height maps. No new noise or replacement albedo.
        </p>
      </q-expansion-item>
      <q-expansion-item dense label="Atmosphere" class="effect-section">
        <q-select
          :model-value="modelValue.toneMapping"
          :options="['baseline', 'neutral', 'linear']"
          label="Tone mapping"
          aria-label="Effects tone mapping"
          outlined
          dense
          @update:model-value="patch({ toneMapping: $event })"
        />
        <q-toggle
          :model-value="modelValue.grade"
          label="Restrained color grading"
          aria-label="Effects color grading"
          @update:model-value="patch({ grade: !!$event })"
        />
        <q-toggle
          :model-value="modelValue.bloom"
          label="Selective flame bloom"
          aria-label="Effects bloom"
          @update:model-value="patch({ bloom: !!$event })"
        />
        <template v-for="control in [...bloomControls, ...gradeControls]" :key="control.key">
          <div class="text-caption">
            {{ control.label }} · {{ modelValue[control.key].toFixed(2) }}
          </div>
          <q-slider
            :model-value="modelValue[control.key]"
            :min="control.min"
            :max="control.max"
            :step="0.05"
            label
            :aria-label="'Effects ' + control.key"
            @update:model-value="patch({ [control.key]: Number($event) })"
          />
        </template>
      </q-expansion-item>
      <q-expansion-item dense label="Diagnostics" class="effect-section">
        <p class="text-caption">
          Current geometry and generation stay fixed while comparing effects.
        </p>
        <dl v-if="metrics">
          <dt>Draw calls</dt>
          <dd>{{ metrics.calls }}</dd>
          <dt>Triangles</dt>
          <dd>{{ metrics.triangles.toLocaleString() }}</dd>
          <dt>Resident textures / geometries</dt>
          <dd>{{ metrics.textures }} / {{ metrics.geometries }}</dd>
          <dt>CPU submission</dt>
          <dd>{{ metrics.renderMs.toFixed(2) }} ms</dd>
          <dt>GPU render time</dt>
          <dd>
            {{ metrics.gpuMs === null ? 'Timer unavailable' : metrics.gpuMs.toFixed(2) + ' ms' }}
          </dd>
          <dt>Rendered cadence</dt>
          <dd>
            {{
              !animating
                ? 'Static / on demand'
                : metrics.renderedFps === null
                  ? 'Measuring…'
                  : metrics.renderedFps.toFixed(1) + ' FPS'
            }}
          </dd>
        </dl>
        <q-btn
          outline
          no-caps
          label="Measure 30 frames"
          :loading="measuring"
          aria-label="Measure effects performance"
          @click="$emit('measure')"
        />
        <dl v-if="measurement" class="q-mt-md">
          <dt>Measured cadence</dt>
          <dd>{{ measurement.renderedFps?.toFixed(1) }} FPS</dd>
          <dt>Median frame interval</dt>
          <dd>{{ measurement.frameIntervalMs?.toFixed(2) }} ms</dd>
          <dt>CPU / GPU</dt>
          <dd>
            {{ measurement.cpuSubmissionMs?.toFixed(2) }} /
            {{ measurement.gpuMs?.toFixed(2) ?? 'unavailable' }} ms
          </dd>
        </dl>
        <p class="text-caption text-grey-5">
          Cadence includes vsync and scheduling. CPU submission is not GPU frame time. Derived maps
          are reused; bloom is half resolution.
        </p>
        <p class="text-caption text-grey-5">
          Localized haze is deferred pending a separate depth/occlusion study.
        </p>
      </q-expansion-item>
    </div>
  </q-card>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import {
  EFFECT_PRESETS,
  EFFECT_PRESET_OPTIONS,
  type EffectPreset,
  type DungeonEffects,
} from './effects-settings'
import type { PrototypeMetrics, Dungeon3DViewport } from './viewport'
const gradeControls = [
  { key: 'exposure', label: 'Exposure multiplier', min: 0.5, max: 1.8 },
  { key: 'saturation', label: 'Saturation', min: 0, max: 1.5 },
  { key: 'contrast', label: 'Contrast', min: 0.8, max: 1.3 },
  { key: 'temperature', label: 'Warm / cool balance', min: -0.3, max: 0.3 },
] as const
const bloomControls = [
  { key: 'bloomStrength', label: 'Bloom intensity', min: 0, max: 2 },
  { key: 'bloomRadius', label: 'Bloom spread', min: 0, max: 1 },
  { key: 'bloomThreshold', label: 'Emissive threshold', min: 0, max: 1 },
] as const
const torchControls = [
  { key: 'torchIntensity', label: 'Torch intensity', min: 0, max: 4 },
  { key: 'torchRange', label: 'Torch reach', min: 0.3, max: 2 },
  { key: 'torchDecay', label: 'Torch falloff', min: 1, max: 3 },
] as const
const shadowControls = [
  { key: 'shadowIntensity', label: 'Shadow intensity', min: 0, max: 1 },
  { key: 'shadowSoftness', label: 'Shadow softness', min: 0.25, max: 6 },
  { key: 'keyLight', label: 'Directional light', min: 0, max: 2 },
  { key: 'ambientLight', label: 'Ambient light', min: 0, max: 2 },
] as const
const props = defineProps<{
  modelValue: DungeonEffects
  metrics?: PrototypeMetrics | undefined
  measurement?: Awaited<ReturnType<Dungeon3DViewport['measurePerformance']>> | undefined
  measuring?: boolean
  animating?: boolean
}>()
const presetOptions = [
  ...EFFECT_PRESET_OPTIONS,
  { label: 'Custom', value: 'custom', disable: true },
]
const preset = computed(
  () =>
    Object.entries(EFFECT_PRESETS).find(([, settings]) =>
      (Object.keys(settings) as (keyof DungeonEffects)[]).every(
        (k) => props.modelValue[k] === settings[k],
      ),
    )?.[0] ?? 'custom',
)
const emit = defineEmits<{
  'update:modelValue': [value: DungeonEffects]
  reset: []
  close: []
  preset: [value: EffectPreset]
  measure: []
}>()
function patch(value: Partial<DungeonEffects>) {
  emit('update:modelValue', { ...props.modelValue, ...value })
}
</script>
<style scoped>
.effects-panel {
  width: 410px;
  max-width: 94vw;
  max-height: calc(100vh - 24px);
  overflow: auto;
}
.effects-header {
  position: sticky;
  top: -16px;
  background: #1d2329;
  z-index: 2;
  padding: 8px 0 12px;
}
dl {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 6px;
  font-size: 12px;
}
dd {
  margin: 0;
  text-align: right;
}
.effect-section {
  border-top: 1px solid #ffffff18;
  padding-top: 8px;
}
.effects-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
  gap: 24px;
}
h3 {
  font-size: 15px;
  line-height: 1.4;
  margin: 0 0 12px;
}
section {
  min-width: 0;
}
</style>
