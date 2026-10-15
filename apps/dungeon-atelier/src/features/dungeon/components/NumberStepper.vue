<template>
  <div class="number-stepper" :class="{ 'number-stepper--disabled': disable }">
    <label :for="inputId" class="number-stepper__label">{{ label }}</label>
    <q-input
      :id="inputId"
      :model-value="draft"
      type="number"
      inputmode="numeric"
      :min="min"
      :max="max"
      step="1"
      outlined
      dense
      hide-bottom-space
      :disable="disable"
      :aria-label="label"
      input-class="number-stepper__input"
      @update:model-value="updateDraft"
      @blur="commit"
      @keydown.up.prevent="adjust(1)"
      @keydown.down.prevent="adjust(-1)"
      @keydown.enter="commit"
    >
      <template #prepend>
        <q-btn
          flat
          round
          dense
          size="sm"
          icon="remove"
          :aria-label="`Decrease ${label.toLowerCase()}`"
          :disable="disable || modelValue <= min"
          @click="adjust(-1)"
          class="number-stepper__button"
        />
      </template>
      <template #append>
        <q-btn
          flat
          round
          dense
          size="sm"
          icon="add"
          :aria-label="`Increase ${label.toLowerCase()}`"
          :disable="disable || modelValue >= max"
          @click="adjust(1)"
          class="number-stepper__button"
        />
      </template>
    </q-input>
  </div>
</template>

<script setup lang="ts">
import { ref, useId, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue: number
    label: string
    min: number
    max: number
    disable?: boolean
  }>(),
  { disable: false },
)
const emit = defineEmits<{ 'update:modelValue': [value: number] }>()
const inputId = `number-${useId()}`
const draft = ref(String(props.modelValue))
watch(
  () => props.modelValue,
  (value) => {
    draft.value = String(value)
  },
)

function updateDraft(value: string | number | null) {
  draft.value = value === null ? '' : String(value)
  const number = Number(draft.value)
  if (
    draft.value.trim() &&
    Number.isInteger(number) &&
    number >= props.min &&
    number <= props.max
  ) {
    emit('update:modelValue', number)
  }
}
function setValue(value: number) {
  const bounded = Math.max(props.min, Math.min(props.max, Math.trunc(value)))
  draft.value = String(bounded)
  emit('update:modelValue', bounded)
}
function commit() {
  if (props.disable) return
  const number = Number(draft.value)
  setValue(draft.value.trim() && Number.isFinite(number) ? number : props.modelValue)
}
function adjust(amount: number) {
  if (props.disable) return
  const number = Number(draft.value)
  setValue((draft.value.trim() && Number.isFinite(number) ? number : props.modelValue) + amount)
}
</script>

<style scoped lang="scss">
.number-stepper__label {
  display: block;
  margin-bottom: 7px;
  color: #bdc5cf;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.15px;
}
.number-stepper :deep(.q-field__control) {
  height: 44px;
  padding: 0 7px;
  border-radius: 9px;
  background: #12171d;
}
.number-stepper :deep(.q-field__control::before) {
  border-color: #39434e;
}
.number-stepper :deep(.q-field--focused .q-field__control::after) {
  border-width: 1px;
}
.number-stepper :deep(.q-field__prepend),
.number-stepper :deep(.q-field__append) {
  height: 44px;
  padding: 0;
}
.number-stepper :deep(.number-stepper__input) {
  padding: 0 3px;
  text-align: center;
  font-size: 17px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: #e8dcc5;
  appearance: textfield;
  -moz-appearance: textfield;
}
.number-stepper :deep(input::-webkit-inner-spin-button),
.number-stepper :deep(input::-webkit-outer-spin-button) {
  appearance: none;
  margin: 0;
}
.number-stepper__button {
  background: #28313b;
  color: #b8c4d1;
  width: 26px;
  min-width: 26px;
  height: 26px;
  min-height: 26px;
}
.number-stepper__button:not(.disabled):hover {
  background: #4a4030;
  color: #ead0a2;
}
.number-stepper--disabled {
  opacity: 0.6;
}
</style>
