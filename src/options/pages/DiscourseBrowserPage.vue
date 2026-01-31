<script setup lang="ts">
import DiscourseBrowser from '../components/DiscourseBrowser.vue'
</script>

<template>
  <div class="space-y-4">
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 p-4">
      <h2 class="text-xl font-bold mb-2 dark:text-white">论坛浏览器</h2>
      <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
        通过 API 代理访问 Discourse 论坛，支持多标签页浏览
      </p>
      <DiscourseBrowser />
    </div>
  </div>
</template>
