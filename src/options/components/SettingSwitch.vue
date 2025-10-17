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
  <div v-if="visible" class="flex items-center justify-between">
    <div>
      <label class="text-sm font-medium text-gray-900 dark:text-white">{{ label }}</label>
      <p class="text-sm text-gray-500 dark:text-white">{{ description }}</p>
    </div>
    <a-switch v-model:checked="localValue" />
  </div>
</template>
