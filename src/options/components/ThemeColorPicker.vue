<script setup lang="ts">
import { computed } from 'vue'

import { colorSchemes } from '../../styles/md3Theme'

const props = defineProps<{
  md3ColorScheme?: string
}>()

const emit = defineEmits<{
  (e: 'update:md3ColorScheme', v: string): void
}>()

function getColorLabel(key: string): string {
  const labels: Record<string, string> = {
    default: '默认蓝',
    blue: '科技蓝',
    green: '自然绿',
    purple: '优雅紫',
    orange: '活力橙',
    red: '警示红',
    macaron: '马卡龙',
    dopamine: '多巴胺',
    morandi: '莫兰迪',
    matcha: '抹茶绿'
  }
  return labels[key] || key
}

const presetColors = Object.entries(colorSchemes).map(([key, value]) => ({
  name: key,
  value,
  label: getColorLabel(key)
}))

const selectedColorType = computed<string>({
  get() {
    return props.md3ColorScheme || 'default'
  },
  set(value: string) {
    emit('update:md3ColorScheme', value)
  }
})

const selectPreset = (name: string) => {
  selectedColorType.value = name
}
</script>

<template>
  <div class="space-y-4">
    <div class="grid grid-cols-3 gap-3">
      <div
        v-for="color in presetColors"
        :key="color.name"
        class="relative cursor-pointer group"
        @click="selectPreset(color.name)"
      >
        <div
          class="flex items-center p-3 border-2 rounded-lg transition-all duration-200"
          :class="[
            selectedColorType === color.name
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
              : 'border-gray-200 hover:border-gray-300 dark:border-gray-600 dark:hover:border-gray-500'
          ]"
        >
          <div
            class="w-5 h-5 rounded-full mr-3 border border-gray-200 dark:border-gray-600"
            :style="{ backgroundColor: color.value }"
          ></div>
          <span class="text-sm font-medium text-gray-700 dark:text-white">{{ color.label }}</span>
        </div>
        <div
          v-if="selectedColorType === color.name"
          class="absolute top-1 right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center"
        >
          <svg class="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path
              fill-rule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clip-rule="evenodd"
            />
          </svg>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.theme-color-picker input {
  outline: none;
}
</style>
