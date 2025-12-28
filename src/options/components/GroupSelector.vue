<script setup lang="ts">
import { computed } from 'vue'

import type { EmojiGroup } from '@/types/type'
import CachedImage from '@/components/CachedImage.vue'

interface Props {
  modelValue: string
  groups: EmojiGroup[]
  placeholder?: string
  disabled?: boolean
  showEmojiCount?: boolean
}

interface Emits {
  (e: 'update:modelValue', value: string): void
  (e: 'change', value: string): void
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: '搜索并选择分组',
  disabled: false,
  showEmojiCount: true
})

const emit = defineEmits<Emits>()

const filterOption = (input: string, option: any) => {
  return option.label.toLowerCase().includes(input.toLowerCase())
}

const handleChange = (value: string) => {
  emit('update:modelValue', value)
  emit('change', value)
}

// Computed value kept for potential future use in template
// @ts-expect-error kept for API compatibility
const _displayValue = computed(() => {
  if (!props.modelValue) return props.placeholder
  const group = props.groups.find(g => g.id === props.modelValue)
  return group ? group.name : props.placeholder
})
</script>

<template>
  <a-select
    :model-value="modelValue"
    showSearch
    :placeholder="placeholder"
    class="w-full"
    :filter-option="filterOption"
    :disabled="disabled"
    @change="(value: any) => handleChange(String(value || ''))"
  >
    <a-select-option v-for="g in groups" :key="g.id" :value="g.id" :label="g.name">
      <div class="flex items-center">
        <CachedImage
          v-if="g.icon && (g.icon.startsWith('http') || g.icon.startsWith('data:'))"
          :src="g.icon"
          class="w-4 h-4 inline-block mr-2"
        />
        <span v-else class="inline-block mr-2">{{ g.icon || '📁' }}</span>
        {{ g.name }}
        <span v-if="showEmojiCount" class="ml-2 text-xs text-gray-500">
          ({{ g.emojis.length }} 个表情)
        </span>
      </div>
    </a-select-option>
  </a-select>
</template>
