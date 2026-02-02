<script setup lang="ts">
import { computed } from 'vue'

import { getTagVisual, hexToRgba, stripHtml } from '../tagVisuals'

const props = withDefaults(
  defineProps<{
    name: string
    text?: string
    description?: string | null
    clickable?: boolean
    compact?: boolean
  }>(),
  {
    text: '',
    description: null,
    clickable: false,
    compact: false
  }
)

const visual = computed(() => getTagVisual(props.name, props.text))

const titleText = computed(() => {
  const cleaned = stripHtml(props.description)
  return cleaned || undefined
})

const labelStyle = computed(() => {
  if (!visual.value) return undefined
  return {
    color: visual.value.color,
    borderColor: hexToRgba(visual.value.color, 0.35),
    backgroundColor: hexToRgba(visual.value.color, 0.12)
  }
})
</script>

<template>
  <span
    class="tag-pill inline-flex items-center rounded border"
    :class="[
      compact ? 'text-xs px-2 py-0.5' : 'px-2 py-1',
      clickable ? 'cursor-pointer' : '',
      !visual
        ? 'bg-gray-100 text-gray-700 border-transparent dark:bg-gray-700 dark:text-gray-200'
        : ''
    ]"
    :style="labelStyle"
    :title="titleText"
  >
    <svg v-if="visual" class="w-3.5 h-3.5 mr-1" viewBox="0 0 512 512" fill="currentColor">
      <use :href="`#${visual.icon}`" />
    </svg>
    <span class="truncate">{{ text || name }}</span>
  </span>
</template>
