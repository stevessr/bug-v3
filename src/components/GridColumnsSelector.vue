<template>
  <select
    :value="modelValue"
    @change="onChange"
    class="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
  >
    <option v-for="col in options" :key="col" :value="col">{{ col }} 列</option>
  </select>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  modelValue: number
  min?: number
  max?: number
  step?: number
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: number): void
}>()

const options = computed(() => {
  const min = Number(props.min ?? 2)
  const max = Number(props.max ?? 8)
  const step = Number(props.step ?? 1)
  const arr: number[] = []
  for (let i = min; i <= max; i += step) arr.push(i)
  return arr
})

const onChange = (e: Event) => {
  const target = e.target as HTMLSelectElement
  emit('update:modelValue', Number(target.value))
}
</script>

<style scoped>
/* keep style minimal; parent can override */
</style>
