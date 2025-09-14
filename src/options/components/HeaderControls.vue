<script setup lang="ts">
defineEmits([
  'openImport',
  'openImportEmojis',
  'resetSettings',
  'syncToChrome',
  'forceLocalToExtension',
  'exportConfiguration'
])
</script>

<template>
  <div class="flex gap-3 flex-wrap">
    <button
      @click="$emit('openImport')"
      class="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
    >
      导入配置
    </button>
    <button
      @click="$emit('openImportEmojis')"
      class="px-4 py-2 text-sm bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-md hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
    >
      导入表情
    </button>
    <a
      href="/tenor.html"
      target="_blank"
      class="px-4 py-2 text-sm bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300 rounded-md hover:bg-pink-200 dark:hover:bg-pink-900/50 transition-colors inline-block"
    >
      🎬 Tenor GIF
    </a>
    <a
      href="/waline.html"
      target="_blank"
      class="px-4 py-2 text-sm bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 rounded-md hover:bg-cyan-200 dark:hover:bg-cyan-900/50 transition-colors inline-block"
    >
      📦 Waline 导入
    </a>
    <button
      @click="$emit('resetSettings')"
      class="px-4 py-2 text-sm bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded-md hover:bg-orange-200 dark:hover:bg-orange-900/50 transition-colors"
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
      @click="$emit('forceLocalToExtension')"
      class="px-4 py-2 text-sm bg-yellow-500 text-white rounded-md hover:bg-yellow-600 transition-colors"
    >
      强制本地同步到扩展存储
    </button>
    <button
      @click="$emit('exportConfiguration')"
      class="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
    >
      导出配置
    </button>
  </div>
</template>
