<script setup lang="ts">
// 纯展示组件，无需逻辑
</script>

<template>
  <div class="space-y-8">
    <div class="bg-white rounded-lg shadow-sm border">
      <div class="px-6 py-4 border-b border-gray-200">
        <h2 class="text-lg font-semibold text-gray-900">关于扩展</h2>
      </div>
      <div class="p-6 space-y-4">
        <div>
          <h3 class="font-medium text-gray-900">表情包扩展</h3>
          <p class="text-sm text-gray-600">版本 1.0.0</p>
        </div>
        <div>
          <h3 class="font-medium text-gray-900">功能特色</h3>
          <ul class="text-sm text-gray-600 space-y-1 mt-2">
            <li>• 支持多分组表情管理</li>
            <li>• 拖拽排序和重新组织</li>
            <li>• Chrome 同步支持</li>
            <li>• 响应式设计，触屏优化</li>
            <li>• 实时搜索和过滤</li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 保持样式由父级 Tailwind 提供，如需覆写可在此添加 */
</style>
