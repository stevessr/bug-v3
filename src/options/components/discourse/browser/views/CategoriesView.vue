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
  <div class="discourse-list-view">
    <div class="discourse-list-view__main">
      <h3 class="categories-title">分类目录</h3>
      <CategoryGrid
        :categories="activeTab.categories"
        :baseUrl="baseUrl"
        layout="directory"
        @click="$emit('categoryClick', $event as DiscourseCategory)"
        @topicClick="$emit('topicClick', $event)"
      />
    </div>
    <div class="discourse-list-view__side">
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

<style scoped>
.discourse-list-view {
  display: flex;
  gap: 16px;
}

.discourse-list-view__main {
  flex: 1;
  min-width: 0;
}

.categories-title {
  margin: 0 0 14px;
  font-size: 16px;
  font-weight: 700;
  color: var(--d-text, var(--theme-on-background));
}

.discourse-list-view__side {
  width: 256px;
  flex-shrink: 0;
  display: none;
}

@media (min-width: 1024px) {
  .discourse-list-view__side {
    display: block;
  }
}
</style>
