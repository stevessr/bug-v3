<script setup lang="ts">
import type { BrowserTab } from '../types'

const props = defineProps<{
  modelValue: string
  activeTab: BrowserTab | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'goBack'): void
  (e: 'goForward'): void
  (e: 'refresh'): void
  (e: 'goHome'): void
  (e: 'updateBaseUrl'): void
}>()

const handleInput = (value: string) => {
  emit('update:modelValue', value)
}
</script>

<template>
  <div
    class="toolbar bg-gray-100 dark:bg-gray-800 border-b dark:border-gray-700 p-2 flex items-center gap-2"
  >
    <div class="flex items-center gap-1">
      <a-button size="small" :disabled="!props.activeTab || props.activeTab.historyIndex <= 0" @click="emit('goBack')">
        <template #icon><LeftOutlined /></template>
      </a-button>
      <a-button
        size="small"
        :disabled="!props.activeTab || props.activeTab.historyIndex >= props.activeTab.history.length - 1"
        @click="emit('goForward')"
      >
        <template #icon><RightOutlined /></template>
      </a-button>
      <a-button size="small" @click="emit('refresh')" :loading="props.activeTab?.loading">
        <template #icon><ReloadOutlined /></template>
      </a-button>
      <a-button size="small" @click="emit('goHome')">
        <template #icon><HomeOutlined /></template>
      </a-button>
    </div>

    <div class="flex-1 flex items-center gap-2">
      <a-input
        :value="props.modelValue"
        placeholder="输入 Discourse 论坛地址"
        size="small"
        class="flex-1"
        @update:value="handleInput"
        @press-enter="emit('updateBaseUrl')"
      />
      <a-button type="primary" size="small" @click="emit('updateBaseUrl')">访问</a-button>
    </div>
  </div>
</template>
