<script setup lang="ts">
import { ref, watch } from 'vue'

interface Props {
  modelValue: boolean
  label: string
  description: string
  visible?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  visible: true
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const localValue = ref(props.modelValue)

watch(
  () => props.modelValue,
  newValue => {
    localValue.value = newValue
  }
)

watch(localValue, newValue => {
  emit('update:modelValue', newValue)
})
</script>

<template>
  <div v-if="visible" class="setting-switch flex items-center justify-between">
    <div>
      <label class="text-sm font-medium text-gray-900 dark:text-white">{{ label }}</label>
      <p class="text-sm text-gray-500 dark:text-white">{{ description }}</p>
    </div>
    <a-switch v-model:checked="localValue" />
  </div>
</template>

<style scoped>
.setting-switch {
  gap: 16px;
  color: var(--md3-on-surface, #202124);
}
.setting-switch > div {
  min-width: 0;
  flex: 1;
}
.setting-switch label {
  display: block;
  color: var(--md3-on-surface, #202124);
  overflow-wrap: anywhere;
}
.setting-switch p {
  color: var(--md3-on-surface-variant, #5f6368);
}
.setting-switch :deep(.ant-switch) {
  flex-shrink: 0;
}
</style>
