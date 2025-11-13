<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  selectedCount: number
}>()

const emit = defineEmits(['selectAll', 'deselectAll', 'batchRename', 'cancel'])

const hasSelection = computed(() => props.selectedCount > 0)
</script>

<template>
  <div
    class="sticky bottom-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4 shadow-lg z-10"
  >
    <div class="flex justify-between items-center">
      <div class="text-sm text-gray-600 dark:text-gray-300">
        已选择 {{ selectedCount }} 个表情
      </div>
      <div class="flex items-center gap-2">
        <a-button @click="$emit('selectAll')">全选</a-button>
        <a-button @click="$emit('deselectAll')">全不选</a-button>
        <a-button type="primary" @click="$emit('batchRename')" :disabled="!hasSelection">
          AI 批量重命名
        </a-button>
        <a-button danger @click="$emit('cancel')">取消</a-button>
      </div>
    </div>
  </div>
</template>
