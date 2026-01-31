<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import {
  PlusOutlined,
  CloseOutlined,
  ReloadOutlined,
  HomeOutlined,
  LeftOutlined,
  RightOutlined,
  LoadingOutlined
} from '@ant-design/icons-vue'

import { useDiscourseBrowser } from './discourse/useDiscourseBrowser'
import type {
  DiscourseCategory,
  DiscourseTopic,
  SuggestedTopic,
  ActivityTabType,
  MessagesTabType
} from './discourse/types'
import DiscourseCategoryGrid from './discourse/DiscourseCategoryGrid.vue'
import DiscourseTopicList from './discourse/DiscourseTopicList.vue'
import DiscourseTopicView from './discourse/DiscourseTopicView.vue'
import DiscourseUserView from './discourse/DiscourseUserView.vue'
import DiscourseSidebar from './discourse/DiscourseSidebar.vue'
import DiscourseActivityView from './discourse/DiscourseActivityView.vue'
import DiscourseMessagesView from './discourse/DiscourseMessagesView.vue'

const {
  baseUrl,
  urlInput,
  tabs,
  activeTabId,
  activeTab,
  users,
  isLoadingMore,
  createTab,
  closeTab,
  switchTab,
  goBack,
  goForward,
  refresh,
  goHome,
  updateBaseUrl,
  openTopic,
  openCategory,
  openInNewTab,
  openSuggestedTopic,
  openUser,
  openUserActivity,
  openUserMessages,
  loadMorePosts,
  loadMoreTopics,
  switchActivityTab,
  loadMoreActivity,
  switchMessagesTab,
  loadMoreMessages
} = useDiscourseBrowser()

const contentAreaRef = ref<HTMLElement | null>(null)

// Scroll event handler (infinite loading for all view types)
const handleScroll = () => {
  if (!activeTab.value || !contentAreaRef.value) return

  const el = contentAreaRef.value
  const scrollBottom = el.scrollHeight - el.scrollTop - el.clientHeight

  // Trigger load when 200px from bottom
  if (scrollBottom < 200) {
    const viewType = activeTab.value.viewType
    if (viewType === 'topic') {
      loadMorePosts()
    } else if (viewType === 'home' || viewType === 'category') {
      loadMoreTopics()
    } else if (viewType === 'activity') {
      loadMoreActivity()
    } else if (viewType === 'messages') {
      loadMoreMessages()
    }
  }
}

// Handle topic click
const handleTopicClick = (topic: DiscourseTopic | SuggestedTopic) => {
  openTopic(topic as DiscourseTopic)
}

// Handle category click
const handleCategoryClick = (category: DiscourseCategory) => {
  openCategory(category)
}

// Handle middle click (open in new tab)
const handleMiddleClick = (url: string) => {
  openInNewTab(url)
}

// Handle suggested topic click
const handleSuggestedTopicClick = (topic: SuggestedTopic) => {
  openSuggestedTopic(topic)
}

// Handle user click
const handleUserClick = (username: string) => {
  openUser(username)
}

// Handle topic click from user view
const handleUserTopicClick = (topic: { id: number; slug: string }) => {
  openSuggestedTopic(topic)
}

// Handle activity tab switch
const handleActivityTabSwitch = (tab: ActivityTabType) => {
  switchActivityTab(tab)
}

// Handle go to user profile from activity view
const handleGoToProfile = () => {
  if (activeTab.value?.currentUser) {
    openUser(activeTab.value.currentUser.username)
  }
}

// Handle open user activity
const handleOpenUserActivity = (username: string) => {
  openUserActivity(username)
}

// Handle open user messages
const handleOpenUserMessages = (username: string) => {
  openUserMessages(username)
}

// Handle messages tab switch
const handleMessagesTabSwitch = (tab: MessagesTabType) => {
  switchMessagesTab(tab)
}

// Initialize
onMounted(() => {
  createTab()
  nextTick(() => {
    if (contentAreaRef.value) {
      contentAreaRef.value.addEventListener('scroll', handleScroll)
    }
  })
})

onUnmounted(() => {
  if (contentAreaRef.value) {
    contentAreaRef.value.removeEventListener('scroll', handleScroll)
  }
})
</script>

<template>
  <div
    class="discourse-browser flex flex-col h-[700px] border dark:border-gray-700 rounded-lg overflow-hidden"
  >
    <!-- Toolbar -->
    <div
      class="toolbar bg-gray-100 dark:bg-gray-800 border-b dark:border-gray-700 p-2 flex items-center gap-2"
    >
      <!-- Navigation buttons -->
      <div class="flex items-center gap-1">
        <a-button
          size="small"
          :disabled="!activeTab || activeTab.historyIndex <= 0"
          @click="goBack"
        >
          <template #icon><LeftOutlined /></template>
        </a-button>
        <a-button
          size="small"
          :disabled="!activeTab || activeTab.historyIndex >= activeTab.history.length - 1"
          @click="goForward"
        >
          <template #icon><RightOutlined /></template>
        </a-button>
        <a-button size="small" @click="refresh" :loading="activeTab?.loading">
          <template #icon><ReloadOutlined /></template>
        </a-button>
        <a-button size="small" @click="goHome">
          <template #icon><HomeOutlined /></template>
        </a-button>
      </div>

      <!-- Address bar -->
      <div class="flex-1 flex items-center gap-2">
        <a-input
          v-model:value="urlInput"
          placeholder="输入 Discourse 论坛地址"
          size="small"
          class="flex-1"
          @press-enter="updateBaseUrl"
        />
        <a-button type="primary" size="small" @click="updateBaseUrl">访问</a-button>
      </div>
    </div>

    <!-- Tab bar -->
    <div
      class="tab-bar bg-gray-50 dark:bg-gray-900 border-b dark:border-gray-700 flex items-center overflow-x-auto"
    >
      <div
        v-for="tab in tabs"
        :key="tab.id"
        class="tab-item flex items-center gap-2 px-3 py-2 border-r dark:border-gray-700 cursor-pointer min-w-[120px] max-w-[200px] hover:bg-gray-100 dark:hover:bg-gray-800"
        :class="{
          'bg-white dark:bg-gray-800': tab.id === activeTabId,
          'bg-gray-50 dark:bg-gray-900': tab.id !== activeTabId
        }"
        @click="switchTab(tab.id)"
      >
        <LoadingOutlined v-if="tab.loading" class="text-blue-500" />
        <span class="flex-1 truncate text-sm dark:text-white">{{ tab.title }}</span>
        <CloseOutlined
          class="text-gray-400 hover:text-red-500 text-xs"
          @click.stop="closeTab(tab.id)"
        />
      </div>
      <a-button type="text" size="small" class="ml-1" @click="createTab()">
        <template #icon><PlusOutlined /></template>
      </a-button>
    </div>

    <!-- Content area -->
    <div
      ref="contentAreaRef"
      class="content-area flex-1 overflow-y-auto bg-white dark:bg-gray-900 p-4"
    >
      <!-- Loading -->
      <div v-if="activeTab?.loading" class="flex items-center justify-center h-full">
        <a-spin size="large" />
      </div>

      <!-- Error page -->
      <div
        v-else-if="activeTab?.viewType === 'error'"
        class="flex flex-col items-center justify-center h-full text-gray-500"
      >
        <div class="text-6xl mb-4">:(</div>
        <div class="text-lg mb-2">加载失败</div>
        <div class="text-sm text-red-500">{{ activeTab.errorMessage }}</div>
        <a-button type="primary" class="mt-4" @click="refresh">重试</a-button>
      </div>

      <!-- Home view -->
      <div v-else-if="activeTab?.viewType === 'home'" class="flex gap-4">
        <!-- Main content -->
        <div class="flex-1 min-w-0 space-y-6">
          <!-- Categories -->
          <DiscourseCategoryGrid :categories="activeTab.categories" @click="handleCategoryClick" />

          <!-- Latest topics -->
          <div v-if="activeTab.topics.length > 0">
            <h3 class="text-lg font-semibold mb-3 dark:text-white">最新话题</h3>
            <DiscourseTopicList
              :topics="activeTab.topics"
              :baseUrl="baseUrl"
              @click="handleTopicClick"
              @middleClick="handleMiddleClick"
            />

            <!-- Loading more indicator -->
            <div v-if="isLoadingMore" class="flex items-center justify-center py-4">
              <a-spin />
              <span class="ml-2 text-gray-500">加载更多话题...</span>
            </div>

            <!-- End indicator -->
            <div
              v-if="!activeTab.hasMoreTopics && !isLoadingMore"
              class="text-center text-gray-400 py-4 text-sm"
            >
              已加载全部话题
            </div>
          </div>
        </div>

        <!-- Sidebar -->
        <div class="w-64 flex-shrink-0 hidden lg:block">
          <DiscourseSidebar
            :categories="activeTab.categories"
            :users="activeTab.activeUsers"
            :baseUrl="baseUrl"
            @clickCategory="handleCategoryClick"
            @clickUser="handleUserClick"
          />
        </div>
      </div>

      <!-- Category view -->
      <div v-else-if="activeTab?.viewType === 'category'" class="flex gap-4">
        <!-- Main content -->
        <div class="flex-1 min-w-0 space-y-2">
          <DiscourseTopicList
            :topics="activeTab.topics"
            :baseUrl="baseUrl"
            @click="handleTopicClick"
            @middleClick="handleMiddleClick"
          />

          <!-- Loading more indicator -->
          <div v-if="isLoadingMore" class="flex items-center justify-center py-4">
            <a-spin />
            <span class="ml-2 text-gray-500">加载更多话题...</span>
          </div>

          <!-- End indicator -->
          <div
            v-if="!activeTab.hasMoreTopics && !isLoadingMore && activeTab.topics.length > 0"
            class="text-center text-gray-400 py-4 text-sm"
          >
            已加载全部话题
          </div>
        </div>

        <!-- Sidebar -->
        <div class="w-64 flex-shrink-0 hidden lg:block">
          <DiscourseSidebar
            :categories="activeTab.categories"
            :users="activeTab.activeUsers"
            :baseUrl="baseUrl"
            @clickCategory="handleCategoryClick"
            @clickUser="handleUserClick"
          />
        </div>
      </div>

      <!-- Topic detail view -->
      <DiscourseTopicView
        v-else-if="activeTab?.viewType === 'topic' && activeTab.currentTopic"
        :topic="activeTab.currentTopic"
        :baseUrl="baseUrl"
        :isLoadingMore="isLoadingMore"
        :hasMorePosts="activeTab.hasMorePosts"
        @openSuggestedTopic="handleSuggestedTopicClick"
        @openUser="handleUserClick"
      />

      <!-- User profile view -->
      <DiscourseUserView
        v-else-if="activeTab?.viewType === 'user' && activeTab.currentUser"
        :user="activeTab.currentUser"
        :baseUrl="baseUrl"
        @openTopic="handleUserTopicClick"
        @openActivity="handleOpenUserActivity"
        @openMessages="handleOpenUserMessages"
      />

      <!-- User activity view -->
      <DiscourseActivityView
        v-else-if="
          activeTab?.viewType === 'activity' && activeTab.currentUser && activeTab.activityState
        "
        :user="activeTab.currentUser"
        :activityState="activeTab.activityState"
        :baseUrl="baseUrl"
        :isLoadingMore="isLoadingMore"
        @switchTab="handleActivityTabSwitch"
        @openTopic="handleUserTopicClick"
        @openUser="handleUserClick"
        @goToProfile="handleGoToProfile"
      />

      <!-- User messages view -->
      <DiscourseMessagesView
        v-else-if="
          activeTab?.viewType === 'messages' && activeTab.currentUser && activeTab.messagesState
        "
        :user="activeTab.currentUser"
        :messagesState="activeTab.messagesState"
        :baseUrl="baseUrl"
        :users="users"
        :isLoadingMore="isLoadingMore"
        @switchTab="handleMessagesTabSwitch"
        @openTopic="handleUserTopicClick"
        @openUser="handleUserClick"
        @goToProfile="handleGoToProfile"
      />
    </div>
  </div>
</template>

<style scoped>
.discourse-browser {
  font-family:
    system-ui,
    -apple-system,
    sans-serif;
}

.tab-item {
  transition: background-color 0.15s;
}
</style>
