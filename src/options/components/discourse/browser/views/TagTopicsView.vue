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
  notificationLevel: number
  notificationSaving: boolean
}

defineProps<Props>()

defineEmits([
  'changeNotificationLevel',
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
      <div class="flex items-center justify-between gap-3 mb-3">
        <h3 class="text-lg font-semibold mb-0 dark:text-white">
          标签：{{ activeTab.currentTagName }}
        </h3>
        <div class="flex items-center gap-2">
          <span class="text-xs text-gray-500 dark:text-gray-400">通知等级</span>
          <a-select
            size="small"
            style="width: 128px"
            :value="notificationLevel"
            :loading="notificationSaving"
            :disabled="notificationSaving"
            @change="$emit('changeNotificationLevel', Number($event))"
          >
            <a-select-option :value="0">忽略</a-select-option>
            <a-select-option :value="1">常规</a-select-option>
            <a-select-option :value="2">追踪</a-select-option>
            <a-select-option :value="3">关注</a-select-option>
            <a-select-option :value="4">仅关注首帖</a-select-option>
          </a-select>
        </div>
      </div>
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
