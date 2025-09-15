<script setup lang="ts">
import { computed } from 'vue'

import { useEmojiStore } from '../../stores/emojiStore'

const emojiStore = useEmojiStore()

const groupCount = computed(() => emojiStore.sortedGroups.length)
const totalEmojis = computed(() =>
  emojiStore.sortedGroups.reduce((sum, g) => sum + (g.emojis?.length || 0), 0)
)
const favoritesCount = computed(() => {
  const fav = emojiStore.sortedGroups.find(g => g.id === 'favorites')
  return fav?.emojis?.length || 0
})
</script>

<template>
  <div class="bg-white rounded-lg shadow-sm border dark:border-gray-700 dark:bg-gray-800">
    <div class="px-6 py-4 border-b border-gray-200">
      <h2 class="text-lg font-semibold text-gray-900 dark:text-white">使用统计</h2>
    </div>
    <div class="p-6">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div class="bg-blue-50 rounded-lg p-4">
          <div class="text-2xl font-bold text-blue-600">{{ groupCount }}</div>
          <div class="text-sm text-blue-800 dark:text-blue-400">表情分组</div>
        </div>
        <div class="bg-green-50 rounded-lg p-4">
          <div class="text-2xl font-bold text-green-600">{{ totalEmojis }}</div>
          <div class="text-sm text-green-800 dark:text-green-400">总表情数</div>
        </div>
        <div class="bg-purple-50 rounded-lg p-4">
          <div class="text-2xl font-bold text-purple-600">{{ favoritesCount }}</div>
          <div class="text-sm text-purple-800 dark:text-purple-400">收藏表情</div>
        </div>
      </div>
    </div>
  </div>
</template>
