<script setup lang="ts">
defineEmits([
  'openImport',
  'openImportEmojis',
  'resetSettings',
  'syncToChrome',
  'exportConfiguration'
])
</script>

<template>
  <div class="flex gap-3 flex-wrap">
    <button
      @click="$emit('openImport')"
      class="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
    >
      导入配置
    </button>
    <button
      @click="$emit('openImportEmojis')"
      class="px-4 py-2 text-sm bg-purple-100 text-purple-700 rounded-md hover:bg-purple-200 transition-colors"
    >
      导入表情
    </button>
    <!-- Tenor and Waline have been moved to standalone pages; links removed to avoid duplication -->
    <button
      @click="$emit('resetSettings')"
      class="px-4 py-2 text-sm bg-orange-100 text-orange-700 rounded-md hover:bg-orange-200 transition-colors"
    >
      重置设置
    </button>
    <button
      @click="$emit('syncToChrome')"
      class="px-4 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
    >
      上传到Chrome同步
    </button>
    <button
      @click="$emit('exportConfiguration')"
      class="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
    >
      导出配置
    </button>
  </div>
</template>
