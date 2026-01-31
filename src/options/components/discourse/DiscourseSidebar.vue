<script setup lang="ts">
import type { DiscourseCategory, DiscourseUser } from './types'
import { getAvatarUrl } from './utils'

defineProps<{
  categories: DiscourseCategory[]
  users: DiscourseUser[]
  baseUrl: string
}>()

const emit = defineEmits<{
  (e: 'clickCategory', category: DiscourseCategory): void
  (e: 'clickUser', username: string): void
}>()
</script>

<template>
  <div class="sidebar space-y-4">
    <!-- Categories section -->
    <div
      v-if="categories.length > 0"
      class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border dark:border-gray-700"
    >
      <h3 class="text-sm font-semibold mb-3 dark:text-white">分类</h3>
      <div class="space-y-1">
        <div
          v-for="cat in categories.slice(0, 12)"
          :key="cat.id"
          class="flex items-center gap-2 p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors"
          @click="emit('clickCategory', cat)"
        >
          <div
            class="w-3 h-3 rounded-sm flex-shrink-0"
            :style="{ backgroundColor: `#${cat.color}` }"
          />
          <span class="text-sm dark:text-gray-300 truncate flex-1">{{ cat.name }}</span>
          <span class="text-xs text-gray-400">{{ cat.topic_count }}</span>
        </div>
      </div>
    </div>

    <!-- Active users section -->
    <div
      v-if="users.length > 0"
      class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border dark:border-gray-700"
    >
      <h3 class="text-sm font-semibold mb-3 dark:text-white">活跃用户</h3>
      <div class="flex flex-wrap gap-2">
        <img
          v-for="user in users.slice(0, 20)"
          :key="user.id"
          :src="getAvatarUrl(user.avatar_template, baseUrl, 32)"
          :alt="user.username"
          :title="user.username"
          class="w-8 h-8 rounded-full cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all"
          @click="emit('clickUser', user.username)"
        />
      </div>
      <div v-if="users.length > 20" class="text-xs text-gray-400 mt-2">
        还有 {{ users.length - 20 }} 位用户...
      </div>
    </div>

    <!-- Stats section -->
    <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border dark:border-gray-700">
      <h3 class="text-sm font-semibold mb-3 dark:text-white">统计</h3>
      <div class="space-y-2 text-sm">
        <div class="flex justify-between">
          <span class="text-gray-500">分类数</span>
          <span class="dark:text-gray-300">{{ categories.length }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-gray-500">活跃用户</span>
          <span class="dark:text-gray-300">{{ users.length }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
