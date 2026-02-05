<script setup lang="ts">
import type {
  BrowserTab,
  DiscourseCategory,
  DiscourseTopic,
  SuggestedTopic,
  TopicListType
} from '../../types'
import TopicList from '../../topic/TopicList'
import Sidebar from '../../layout/Sidebar'

type TopicSortKey = 'replies' | 'views' | 'activity' | null

type TopicSortOrder = 'asc' | 'desc'

type Props = {
  activeTab: BrowserTab
  baseUrl: string
  sortedTopics: Array<DiscourseTopic | SuggestedTopic>
  topicSortKey: TopicSortKey
  topicSortOrder: TopicSortOrder
  isLoadingMore: boolean
}

defineProps<Props>()

defineEmits([
  'applyPendingTopics',
  'topicSort',
  'topicClick',
  'topicMiddleClick',
  'openUser',
  'openTag',
  'categoryClick',
  'changeTopicListType',
  'navigate'
])
</script>

<template>
  <div class="flex gap-4">
    <div class="flex-1 min-w-0">
      <h3 class="text-lg font-semibold mb-3 dark:text-white">标签：{{ activeTab.currentTagName }}</h3>
      <div v-if="activeTab.pendingTopicsCount" class="mb-3">
        <a-button type="primary" size="small" @click="$emit('applyPendingTopics')">
          发现 {{ activeTab.pendingTopicsCount }} 条新话题，点击刷新
        </a-button>
      </div>
      <TopicList
        :topics="sortedTopics"
        :baseUrl="baseUrl"
        :categories="activeTab.categories"
        :users="activeTab.activeUsers"
        :sortKey="topicSortKey"
        :sortOrder="topicSortOrder"
        @sort="$emit('topicSort', $event)"
        @click="$emit('topicClick', $event)"
        @middleClick="$emit('topicMiddleClick', $event)"
        @openUser="$emit('openUser', $event)"
        @openTag="$emit('openTag', $event)"
      />
    </div>
    <div class="w-64 flex-shrink-0 hidden lg:block">
      <Sidebar
        :categories="[]"
        :users="activeTab.activeUsers"
        :baseUrl="baseUrl"
        :topicListType="activeTab.topicListType"
        @clickCategory="$emit('categoryClick', $event as DiscourseCategory)"
        @clickUser="$emit('openUser', $event)"
        @changeTopicListType="$emit('changeTopicListType', $event as TopicListType)"
        @navigateTo="$emit('navigate', $event)"
      />
    </div>
  </div>
</template>
