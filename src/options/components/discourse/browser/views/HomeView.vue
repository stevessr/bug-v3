<script setup lang="ts">
import type {
  BrowserTab,
  DiscourseTopic,
  SuggestedTopic,
  TopicListType
} from '../../types'
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
  <div class="flex gap-4">
    <div class="flex-1 min-w-0 space-y-4">
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

      <div v-if="activeTab.topics.length > 0" class="space-y-4">
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

        <div v-if="!activeTab.hasMoreTopics && !isLoadingMore" class="text-center text-gray-400 py-4 text-sm">
          已加载全部话题
        </div>
      </div>
      <div v-else class="text-center text-gray-400 py-12">暂无话题</div>
    </div>

    <div class="w-64 flex-shrink-0 hidden lg:block">
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
.home-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 12px;
  background: var(--theme-surface);
  border: 1px solid var(--theme-outline-variant);
  border-radius: 10px;
}

.dark .home-nav {
  background: var(--theme-surface);
  border-color: var(--theme-outline-variant);
}

.home-nav-links {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.home-nav-link {
  border: 1px solid transparent;
  background: transparent;
  color: var(--theme-on-surface-variant);
  font-size: 13px;
  padding: 6px 12px;
  border-radius: 9999px;
  cursor: pointer;
  transition: all 0.15s;
}

.home-nav-link:hover {
  background: var(--theme-surface-variant);
}

.home-nav-link.active {
  background: var(--theme-primary-container);
  border-color: var(--theme-primary);
  color: var(--theme-on-primary-container);
  font-weight: 600;
}

.dark .home-nav-link {
  color: var(--theme-on-surface-variant);
}

.dark .home-nav-link:hover {
  background: var(--theme-surface-variant);
}

.dark .home-nav-link.active {
  background: var(--theme-primary-container);
  border-color: var(--theme-primary);
  color: var(--theme-on-primary-container);
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
</style>
