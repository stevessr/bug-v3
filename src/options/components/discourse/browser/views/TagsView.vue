<script setup lang="ts">
import type { BrowserTab } from '../../types'
import TagGrid from '../../layout/TagGrid'
import Sidebar from '../../layout/Sidebar'

type Props = {
  activeTab: BrowserTab
  baseUrl: string
}

defineProps<Props>()

defineEmits(['tagClick', 'categoryClick', 'openUser', 'changeTopicListType', 'navigate'])
</script>

<template>
  <div class="discourse-list-view">
    <div class="discourse-list-view__main">
      <TagGrid
        :tags="activeTab.tags"
        :groups="activeTab.tagGroups"
        @click="$emit('tagClick', $event)"
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
