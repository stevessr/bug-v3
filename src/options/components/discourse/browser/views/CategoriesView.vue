<script setup lang="ts">
import type { BrowserTab, DiscourseCategory } from '../../types'
import CategoryGrid from '../../layout/CategoryGrid'
import Sidebar from '../../layout/Sidebar'

type Props = {
  activeTab: BrowserTab
  baseUrl: string
}

defineProps<Props>()

defineEmits(['categoryClick', 'topicClick', 'openUser', 'changeTopicListType', 'navigate'])
</script>

<template>
  <div class="flex gap-4">
    <div class="flex-1 min-w-0">
      <h3 class="text-lg font-semibold mb-6 dark:text-white">分类目录</h3>
      <CategoryGrid
        :categories="activeTab.categories"
        :baseUrl="baseUrl"
        layout="directory"
        @click="$emit('categoryClick', $event as DiscourseCategory)"
        @topicClick="$emit('topicClick', $event)"
      />
    </div>
    <div class="w-64 flex-shrink-0 hidden lg:block">
      <Sidebar
        :categories="activeTab.categories"
        :users="activeTab.activeUsers"
        :baseUrl="baseUrl"
        :topicListType="activeTab.topicListType"
        @clickCategory="$emit('categoryClick', $event)"
        @clickUser="$emit('openUser', $event)"
        @changeTopicListType="$emit('changeTopicListType', $event)"
        @navigateTo="$emit('navigate', $event)"
      />
    </div>
  </div>
</template>
