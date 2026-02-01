<script setup lang="ts">
import { PlusOutlined, CloseOutlined, LoadingOutlined } from '@ant-design/icons-vue'

import type { BrowserTab } from '../types'

const props = defineProps<{
  tabs: BrowserTab[]
  activeTabId: string | null
}>()

const emit = defineEmits<{
  (e: 'switchTab', id: string): void
  (e: 'closeTab', id: string): void
  (e: 'createTab'): void
}>()
</script>

<template>
  <div
    class="tab-bar bg-gray-50 dark:bg-gray-900 border-b dark:border-gray-700 flex items-center overflow-x-auto"
  >
    <div
      v-for="tab in props.tabs"
      :key="tab.id"
      class="tab-item flex items-center gap-2 px-3 py-2 border-r dark:border-gray-700 cursor-pointer min-w-[120px] max-w-[200px] hover:bg-gray-100 dark:hover:bg-gray-800"
      :class="{
        'bg-white dark:bg-gray-800': tab.id === props.activeTabId,
        'bg-gray-50 dark:bg-gray-900': tab.id !== props.activeTabId
      }"
      @click="emit('switchTab', tab.id)"
    >
      <LoadingOutlined v-if="tab.loading" class="text-blue-500" />
      <span class="flex-1 truncate text-sm dark:text-white">{{ tab.title }}</span>
      <CloseOutlined class="text-gray-400 hover:text-red-500 text-xs" @click.stop="emit('closeTab', tab.id)" />
    </div>
    <a-button type="text" size="small" class="ml-1" @click="emit('createTab')">
      <template #icon><PlusOutlined /></template>
    </a-button>
  </div>
</template>
