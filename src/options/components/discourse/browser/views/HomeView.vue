<script setup lang="ts">
import type { BrowserTab, DiscourseTopic, SuggestedTopic, TopicListType } from '../../types'
import TopicList from '../../topic/TopicList'
import Sidebar from '../../layout/Sidebar'

type HomeNavItem = { key: string; label: string; type: 'path' | 'list'; value: string }

type TopicSortKey = 'replies' | 'views' | 'activity' | null

type TopicSortOrder = 'asc' | 'desc'

type Props = {
  activeTab: BrowserTab
  baseUrl: string
  sortedTopics: Array<DiscourseTopic | SuggestedTopic>
  homeNavItems: HomeNavItem[]
  isHomeNavActive: (item: HomeNavItem) => boolean
  topicSortKey: TopicSortKey
  topicSortOrder: TopicSortOrder
  isLoadingMore: boolean
  currentUsername: string | null
  composerMode: 'reply' | 'topic' | 'edit' | null
}

defineProps<Props>()

defineEmits([
  'homeNavClick',
  'openChat',
  'openMyProfile',
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
  <div class="discourse-list-view">
    <div class="discourse-list-view__main">
      <div class="home-nav">
        <div class="home-nav-links">
          <button
            v-for="item in homeNavItems"
            :key="item.key"
            class="home-nav-link"
            :class="{ active: isHomeNavActive(item) }"
            @click="$emit('homeNavClick', item)"
          >
            {{ item.label }}
          </button>
        </div>
        <div class="home-nav-actions">
          <a-button size="small" @click="$emit('openChat')">聊天</a-button>
          <a-button v-if="currentUsername" size="small" @click="$emit('openMyProfile')">
            我的主页
          </a-button>
          <a-button type="primary" size="small" @click="$emit('toggleComposer')">
            {{ composerMode === 'topic' ? '收起' : '新建话题' }}
          </a-button>
        </div>
      </div>

      <div v-if="activeTab.pendingTopicsCount" class="pending-topics">
        <a-button type="primary" size="small" @click="$emit('applyPendingTopics')">
          发现 {{ activeTab.pendingTopicsCount }} 条新话题，点击刷新
        </a-button>
      </div>

      <div v-if="activeTab.topics.length > 0" class="discourse-list-view__list">
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
          v-if="!activeTab.hasMoreTopics && !isLoadingMore"
          class="discourse-list-view__end text-center text-sm"
        >
          已加载全部话题
        </div>
      </div>
      <div v-else class="discourse-list-view__empty">暂无话题</div>
    </div>

    <div class="discourse-list-view__side">
      <Sidebar
        :categories="[]"
        :users="activeTab.activeUsers"
        :baseUrl="baseUrl"
        :topicListType="activeTab.topicListType"
        @clickCategory="$emit('categoryClick', $event)"
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

.discourse-list-view__list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.discourse-list-view__loading,
.discourse-list-view__end,
.discourse-list-view__empty {
  color: var(--d-text-muted, var(--theme-on-surface-variant));
}

.discourse-list-view__loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px 0;
}

.discourse-list-view__end {
  padding: 12px 0;
}

.discourse-list-view__empty {
  text-align: center;
  padding: 40px 0;
}

.discourse-list-view__side {
  width: 256px;
  flex-shrink: 0;
  display: none;
}

.home-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 8px 12px;
  background: var(--d-surface-1, var(--theme-surface-container-low));
  border: 1px solid var(--d-border, var(--theme-outline-variant));
  border-radius: 8px;
}

.home-nav-links {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.home-nav-link {
  border: 1px solid transparent;
  background: transparent;
  color: var(--d-text-muted, var(--theme-on-surface-variant));
  font-size: 13px;
  line-height: 1.2;
  padding: 5px 10px;
  border-radius: 9999px;
  cursor: pointer;
  transition: all 0.15s;
}

.home-nav-link:hover {
  background: var(--primary-low, color-mix(in oklab, var(--theme-primary) 12%, transparent));
}

.home-nav-link.active {
  background: var(--primary-low, color-mix(in oklab, var(--theme-primary) 16%, transparent));
  border-color: var(--primary, var(--theme-primary));
  color: var(--primary, var(--theme-primary));
  font-weight: 600;
}

.home-nav-actions {
  display: flex;
  align-items: center;
  gap: 8px;
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
