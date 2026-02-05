<script setup lang="ts">
import type {
  BrowserTab,
  DiscourseCategory,
  DiscourseTopic,
  SuggestedTopic,
  TopicListType
} from '../../types'
import CategoryGrid from '../../layout/CategoryGrid'
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
  composerMode: 'reply' | 'topic' | 'edit' | null
}

defineProps<Props>()

defineEmits([
  'toggleComposer',
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
    <div class="flex-1 min-w-0 space-y-4">
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-semibold dark:text-white">在当前分类发帖</h3>
        <a-button size="small" @click="$emit('toggleComposer')">
          {{ composerMode === 'topic' ? '收起' : '发帖' }}
        </a-button>
      </div>

      <CategoryGrid
        v-if="activeTab.categories.length > 0"
        :categories="activeTab.categories"
        :baseUrl="baseUrl"
        title="子分类"
        @click="$emit('categoryClick', $event as DiscourseCategory)"
      />

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

      <div v-if="isLoadingMore" class="flex items-center justify-center py-4">
        <a-spin />
        <span class="ml-2 text-gray-500">加载更多话题...</span>
      </div>

      <div
        v-if="!activeTab.hasMoreTopics && !isLoadingMore && activeTab.topics.length > 0"
        class="text-center text-gray-400 py-4 text-sm"
      >
        已加载全部话题
      </div>
    </div>

    <div class="w-64 flex-shrink-0 hidden lg:block">
      <Sidebar
        :categories="activeTab.categories"
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
