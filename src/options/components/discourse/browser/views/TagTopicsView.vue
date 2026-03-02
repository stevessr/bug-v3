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
  <div class="discourse-list-view">
    <div class="discourse-list-view__main">
      <div class="list-topbar">
        <h3 class="list-topbar__title">标签：{{ activeTab.currentTagName }}</h3>
        <div class="list-topbar__actions">
          <span class="list-topbar__label">通知等级</span>
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

      <div v-if="activeTab.pendingTopicsCount" class="pending-topics">
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

      <div v-if="isLoadingMore" class="discourse-list-view__loading">
        <a-spin />
        <span class="ml-2">加载更多话题...</span>
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

<style scoped>
.discourse-list-view {
  display: flex;
  gap: 16px;
}

.discourse-list-view__main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.discourse-list-view__loading,
.discourse-list-view__end {
  color: var(--d-text-muted, var(--theme-on-surface-variant));
}

.discourse-list-view__loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px 0;
}

.discourse-list-view__end {
  text-align: center;
  padding: 12px 0;
  font-size: 13px;
}

.discourse-list-view__side {
  width: 256px;
  flex-shrink: 0;
  display: none;
}

.list-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 12px;
  border: 1px solid var(--d-border, var(--theme-outline-variant));
  border-radius: 8px;
  background: var(--d-surface-1, var(--theme-surface-container-low));
}

.list-topbar__title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--d-text, var(--theme-on-background));
}

.list-topbar__actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.list-topbar__label {
  font-size: 12px;
  color: var(--d-text-muted, var(--theme-on-surface-variant));
}

.pending-topics {
  display: flex;
  justify-content: center;
}

@media (min-width: 1024px) {
  .discourse-list-view__side {
    display: block;
  }
}
</style>
