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
  <div class="flex gap-4">
    <div class="flex-1 min-w-0">
      <TagGrid
        :tags="activeTab.tags"
        :groups="activeTab.tagGroups"
        @click="$emit('tagClick', $event)"
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
