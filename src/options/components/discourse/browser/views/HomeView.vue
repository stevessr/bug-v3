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
      <nav class="home-nav" aria-label="话题列表导航">
        <div class="home-nav-links" role="list">
          <button
            v-for="item in homeNavItems"
            :key="item.key"
            class="home-nav-link"
            :class="{ active: isHomeNavActive(item) }"
            :aria-current="isHomeNavActive(item) ? 'page' : undefined"
            @click="$emit('homeNavClick', item)"
          >
            {{ item.label }}
          </button>
        </div>
        <div class="home-nav-actions">
          <a-button class="home-nav-action" @click="$emit('openChat')">聊天</a-button>
          <a-button v-if="currentUsername" class="home-nav-action" @click="$emit('openMyProfile')">
            我的主页
          </a-button>
          <a-button type="primary" class="home-nav-action" @click="$emit('toggleComposer')">
            {{ composerMode === 'topic' ? '收起' : '新建话题' }}
          </a-button>
        </div>
      </nav>

      <div v-if="activeTab.pendingTopicsCount" class="pending-topics">
        <a-button
          type="primary"
          class="pending-topics__button"
          @click="$emit('applyPendingTopics')"
        >
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
  gap: 20px;
}

.discourse-list-view__main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.discourse-list-view__list {
  display: flex;
  flex-direction: column;
  gap: 16px;
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
  min-height: 64px;
  padding: 12px;
  border-radius: var(--d-shape-lg, 16px);
  background: var(--d-surface-1, var(--theme-surface-container-low));
}

.discourse-list-view__end {
  padding: 18px;
  border-radius: var(--d-shape-lg, 16px);
  background: var(--d-surface-1, var(--theme-surface-container-low));
}

.discourse-list-view__empty {
  min-height: 200px;
  padding: 64px 24px;
  border-radius: var(--d-shape-xl, 28px);
  background: var(--d-surface-1, var(--theme-surface-container-low));
  text-align: center;
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
  gap: 16px;
  padding: 8px;
  border-radius: var(--d-shape-xl, 28px);
  background: var(--d-surface-2, var(--theme-surface-container));
}

.home-nav-links {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  gap: 4px;
}

.home-nav-link {
  min-height: 40px;
  padding: 0 16px;
  border: 0;
  border-radius: var(--d-shape-full, 999px);
  background: transparent;
  color: var(--d-text-muted, var(--theme-on-surface-variant));
  font-size: 13px;
  font-weight: 580;
  cursor: pointer;
  transition:
    color var(--d-motion-fast, 120ms) var(--d-motion-standard, ease),
    background-color var(--d-motion-fast, 120ms) var(--d-motion-standard, ease),
    transform var(--d-motion-fast, 120ms) var(--d-motion-standard, ease);
}

.home-nav-link:hover {
  background: var(--d-state-hover, rgba(0, 0, 0, 0.08));
}

.home-nav-link.active {
  background: var(--secondary-container, var(--theme-secondary-container));
  color: var(--on-secondary-container, var(--theme-on-secondary-container));
  font-weight: 680;
}

.home-nav-link:active {
  transform: scale(0.97);
}

.home-nav-actions {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  gap: 6px;
}

.home-nav-action,
.pending-topics__button {
  min-height: 40px;
  border-radius: var(--d-shape-full, 999px) !important;
  font-weight: 620;
}

.pending-topics {
  display: flex;
  justify-content: center;
}

.pending-topics__button {
  box-shadow: var(--d-elevation-1);
}

@media (max-width: 860px) {
  .home-nav {
    align-items: stretch;
    flex-direction: column;
    border-radius: var(--d-shape-lg, 16px);
  }

  .home-nav-links {
    flex-wrap: nowrap;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .home-nav-links::-webkit-scrollbar {
    display: none;
  }

  .home-nav-link {
    flex: 0 0 auto;
  }

  .home-nav-actions {
    justify-content: flex-end;
  }
}

@media (max-width: 520px) {
  .home-nav-actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .home-nav-action:last-child {
    grid-column: 1 / -1;
  }
}

@media (min-width: 1024px) {
  .discourse-list-view__side {
    display: block;
  }
}
</style>
