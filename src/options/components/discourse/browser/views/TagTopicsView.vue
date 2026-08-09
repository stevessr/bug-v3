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
import '../../css/BrowserTopicListView.css'

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
  <div class="discourse-list-view topic-collection-view">
    <div class="discourse-list-view__main">
      <header class="list-topbar list-topbar--tag">
        <div class="list-topbar__copy">
          <span class="list-topbar__eyebrow">标签</span>
          <h2 class="list-topbar__title">{{ activeTab.currentTagName }}</h2>
          <p class="list-topbar__description">查看聚合话题并设置这个标签的通知方式。</p>
        </div>
        <div class="list-topbar__actions">
          <label class="notification-field">
            <span class="list-topbar__label">通知</span>
            <a-select
              class="notification-select"
              :value="notificationLevel"
              :loading="notificationSaving"
              :disabled="notificationSaving"
              aria-label="标签通知等级"
              @change="$emit('changeNotificationLevel', Number($event))"
            >
              <a-select-option :value="0">忽略</a-select-option>
              <a-select-option :value="1">常规</a-select-option>
              <a-select-option :value="2">追踪</a-select-option>
              <a-select-option :value="3">关注</a-select-option>
              <a-select-option :value="4">仅关注首帖</a-select-option>
            </a-select>
          </label>
        </div>
      </header>

      <div v-if="activeTab.pendingTopicsCount" class="pending-topics">
        <a-button
          type="primary"
          class="pending-topics__button"
          @click="$emit('applyPendingTopics')"
        >
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

      <div v-if="isLoadingMore" class="discourse-list-view__loading">
        <a-spin />
        <span>加载更多话题...</span>
      </div>

      <div
        v-if="!activeTab.hasMoreTopics && !isLoadingMore && activeTab.topics.length > 0"
        class="discourse-list-view__end"
      >
        已加载全部话题
      </div>
    </div>

    <div class="discourse-list-view__side">
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
