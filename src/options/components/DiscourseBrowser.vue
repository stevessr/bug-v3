<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, computed } from 'vue'
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
import DiscourseComposer from './discourse/DiscourseComposer.vue'
import DiscourseUserView from './discourse/DiscourseUserView.vue'
import DiscourseUserExtrasView from './discourse/DiscourseUserExtrasView.vue'
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
  currentUsername,
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
  openUserBadges,
  openUserFollowFeed,
  openUserFollowing,
  openUserFollowers,
  loadMorePosts,
  loadMoreTopics,
  switchActivityTab,
  loadMoreActivity,
  switchMessagesTab,
  loadMoreMessages,
  loadMoreFollowFeed
} = useDiscourseBrowser()

const contentAreaRef = ref<HTMLElement | null>(null)
const userExtrasTab = computed(
  () =>
    (activeTab.value?.viewType as
      | 'badges'
      | 'followFeed'
      | 'following'
      | 'followers'
      | undefined) || 'badges'
)
const isViewingSelf = computed(
  () =>
    !!activeTab.value?.currentUser?.username &&
    !!currentUsername.value &&
    activeTab.value?.currentUser?.username === currentUsername.value
)
const showTopicComposer = ref(false)
const showReplyComposer = ref(false)
const replyTarget = ref<{ postNumber: number; username: string } | null>(null)
const floatingState = ref({
  left: null as number | null,
  top: null as number | null,
  width: 420,
  height: 520,
  dragging: false,
  resizing: false,
  startX: 0,
  startY: 0,
  startLeft: 0,
  startTop: 0,
  startWidth: 0,
  startHeight: 0
})
const currentCategoryOption = computed(() => {
  const tab = activeTab.value
  if (!tab?.currentCategoryId || !tab.currentCategoryName) return null
  return {
    id: tab.currentCategoryId,
    name: tab.currentCategoryName,
    slug: tab.currentCategorySlug || String(tab.currentCategoryId),
    color: '',
    text_color: '',
    topic_count: 0,
    parent_category_id: null
  }
})

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
    } else if (viewType === 'followFeed') {
      loadMoreFollowFeed()
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

const handleUserMainTabSwitch = (
  tab: 'summary' | 'activity' | 'messages' | 'badges' | 'follow'
) => {
  if (!activeTab.value?.currentUser) return
  const username = activeTab.value.currentUser.username
  if (tab === 'summary') {
    openUser(username)
  } else if (tab === 'activity') {
    openUserActivity(username)
  } else if (tab === 'messages') {
    openUserMessages(username)
  } else if (tab === 'badges') {
    openUserBadges(username)
  } else {
    openUserFollowFeed(username)
  }
}

const handleOpenUserBadges = (username: string) => {
  openUserBadges(username)
}

const handleOpenUserFollowFeed = (username: string) => {
  openUserFollowFeed(username)
}

const handleOpenUserFollowing = (username: string) => {
  openUserFollowing(username)
}

const handleOpenUserFollowers = (username: string) => {
  openUserFollowers(username)
}

const handleUserExtrasTabSwitch = (tab: 'badges' | 'followFeed' | 'following' | 'followers') => {
  if (!activeTab.value?.currentUser) return
  const username = activeTab.value.currentUser.username
  if (tab === 'badges') openUserBadges(username)
  else if (tab === 'followFeed') openUserFollowFeed(username)
  else if (tab === 'following') openUserFollowing(username)
  else openUserFollowers(username)
}

const toggleTopicComposer = () => {
  showTopicComposer.value = !showTopicComposer.value
}

const handleTopicPosted = (payload: any) => {
  showTopicComposer.value = false
  const topicId = payload?.topic_id || payload?.topicId
  const slug = payload?.topic_slug || payload?.slug || 'topic'
  if (topicId) {
    openSuggestedTopic({ id: topicId, slug })
  } else {
    refresh()
  }
}

const handleReplyTo = (payload: { postNumber: number; username: string }) => {
  replyTarget.value = payload
  showReplyComposer.value = true
}

const handleReplyPosted = () => {
  showReplyComposer.value = false
  replyTarget.value = null
  refresh()
}

const handleClearReply = () => {
  replyTarget.value = null
  showReplyComposer.value = false
}

const floatingStyle = computed(() => {
  const state = floatingState.value
  const style: Record<string, string> = {
    width: `${state.width}px`,
    height: `${state.height}px`
  }
  if (state.left !== null && state.top !== null) {
    style.left = `${state.left}px`
    style.top = `${state.top}px`
    style.right = 'auto'
    style.bottom = 'auto'
  }
  return style
})

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

const startDrag = (event: MouseEvent | TouchEvent) => {
  const point = 'touches' in event ? event.touches[0] : event
  if (!point) return
  const state = floatingState.value
  state.dragging = true
  state.startX = point.clientX
  state.startY = point.clientY
  const rect = (event.currentTarget as HTMLElement | null)?.closest('.floating-composer')?.getBoundingClientRect()
  if (rect) {
    state.startLeft = rect.left
    state.startTop = rect.top
  } else {
    state.startLeft = state.left ?? window.innerWidth - state.width - 20
    state.startTop = state.top ?? window.innerHeight - state.height - 24
  }
}

const startResize = (event: MouseEvent | TouchEvent) => {
  const point = 'touches' in event ? event.touches[0] : event
  if (!point) return
  const state = floatingState.value
  state.resizing = true
  state.startX = point.clientX
  state.startY = point.clientY
  state.startWidth = state.width
  state.startHeight = state.height
}

const handlePointerMove = (event: MouseEvent | TouchEvent) => {
  const point = 'touches' in event ? event.touches[0] : event
  if (!point) return
  const state = floatingState.value
  if (state.dragging) {
    const dx = point.clientX - state.startX
    const dy = point.clientY - state.startY
    const nextLeft = state.startLeft + dx
    const nextTop = state.startTop + dy
    const maxLeft = window.innerWidth - state.width - 8
    const maxTop = window.innerHeight - state.height - 8
    state.left = clamp(nextLeft, 8, Math.max(8, maxLeft))
    state.top = clamp(nextTop, 8, Math.max(8, maxTop))
  }
  if (state.resizing) {
    const dw = point.clientX - state.startX
    const dh = point.clientY - state.startY
    state.width = clamp(state.startWidth + dw, 320, window.innerWidth - 24)
    state.height = clamp(state.startHeight + dh, 320, window.innerHeight - 24)
  }
}

const stopPointer = () => {
  const state = floatingState.value
  state.dragging = false
  state.resizing = false
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
  window.addEventListener('mousemove', handlePointerMove)
  window.addEventListener('mouseup', stopPointer)
  window.addEventListener('touchmove', handlePointerMove, { passive: true })
  window.addEventListener('touchend', stopPointer)
})

onUnmounted(() => {
  if (contentAreaRef.value) {
    contentAreaRef.value.removeEventListener('scroll', handleScroll)
  }
  window.removeEventListener('mousemove', handlePointerMove)
  window.removeEventListener('mouseup', stopPointer)
  window.removeEventListener('touchmove', handlePointerMove)
  window.removeEventListener('touchend', stopPointer)
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
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-semibold dark:text-white">发布新话题</h3>
        <a-button size="small" @click="toggleTopicComposer">
          {{ showTopicComposer ? '收起' : '发帖' }}
        </a-button>
      </div>

      <!-- Categories -->
          <DiscourseCategoryGrid
            :categories="activeTab.categories"
            :baseUrl="baseUrl"
            @click="handleCategoryClick"
          />

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
        <div class="flex-1 min-w-0 space-y-4">
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-semibold dark:text-white">在当前分类发帖</h3>
        <a-button size="small" @click="toggleTopicComposer">
          {{ showTopicComposer ? '收起' : '发帖' }}
        </a-button>
      </div>

          <DiscourseCategoryGrid
            v-if="activeTab.categories.length > 0"
            :categories="activeTab.categories"
            :baseUrl="baseUrl"
            title="子分类"
            @click="handleCategoryClick"
          />

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
        :targetPostNumber="activeTab.targetPostNumber"
        @openSuggestedTopic="handleSuggestedTopicClick"
        @openUser="handleUserClick"
        @refresh="refresh"
        @replyTo="handleReplyTo"
      />

      <!-- User profile view -->
      <DiscourseUserView
        v-else-if="activeTab?.viewType === 'user' && activeTab.currentUser"
        :user="activeTab.currentUser"
        :baseUrl="baseUrl"
        @openTopic="handleUserTopicClick"
        @openActivity="handleOpenUserActivity"
        @openMessages="handleOpenUserMessages"
        @openUser="handleUserClick"
        @openBadges="handleOpenUserBadges"
        @openFollowFeed="handleOpenUserFollowFeed"
        @openFollowing="handleOpenUserFollowing"
        @openFollowers="handleOpenUserFollowers"
        @switchMainTab="handleUserMainTabSwitch"
      />

      <DiscourseUserExtrasView
        v-else-if="
          (activeTab?.viewType === 'badges' ||
            activeTab?.viewType === 'followFeed' ||
            activeTab?.viewType === 'following' ||
            activeTab?.viewType === 'followers') &&
          activeTab.currentUser
        "
        :user="activeTab.currentUser"
        :baseUrl="baseUrl"
        :tab="userExtrasTab"
        :isLoadingMore="isLoadingMore"
        :hasMore="activeTab.followFeedHasMore"
        @switchTab="handleUserExtrasTabSwitch"
        @openUser="handleUserClick"
        @openTopic="handleUserTopicClick"
        @goToProfile="handleGoToProfile"
        @switchMainTab="handleUserMainTabSwitch"
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
        :showReadTab="isViewingSelf"
        @switchTab="handleActivityTabSwitch"
        @openTopic="handleUserTopicClick"
        @openUser="handleUserClick"
        @goToProfile="handleGoToProfile"
        @switchMainTab="handleUserMainTabSwitch"
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
        @switchMainTab="handleUserMainTabSwitch"
      />
    </div>
  </div>

  <div
    v-if="activeTab?.viewType === 'topic' && activeTab.currentTopic && showReplyComposer"
    class="floating-composer"
    :style="floatingStyle"
  >
    <div class="floating-shell">
      <div class="floating-bar" @mousedown="startDrag" @touchstart.prevent="startDrag">
        <span>回复编辑器</span>
        <button class="floating-close" @click="handleClearReply">×</button>
      </div>
      <div class="floating-body">
        <DiscourseComposer
          mode="reply"
          :baseUrl="baseUrl"
          :topicId="activeTab.currentTopic.id"
          :replyToPostNumber="replyTarget?.postNumber || null"
          :replyToUsername="replyTarget?.username || null"
          @posted="handleReplyPosted"
          @clearReply="handleClearReply"
        />
      </div>
      <div class="floating-resize" @mousedown="startResize" @touchstart.prevent="startResize" />
    </div>
  </div>

  <div
    v-if="activeTab?.viewType !== 'topic' && showTopicComposer"
    class="floating-composer"
    :style="floatingStyle"
  >
    <div class="floating-shell">
      <div class="floating-bar" @mousedown="startDrag" @touchstart.prevent="startDrag">
        <span>发帖编辑器</span>
        <button class="floating-close" @click="toggleTopicComposer">×</button>
      </div>
      <div class="floating-body">
        <DiscourseComposer
          mode="topic"
          :baseUrl="baseUrl"
          :categories="activeTab?.categories || []"
          :defaultCategoryId="activeTab?.currentCategoryId || null"
          :currentCategory="currentCategoryOption"
          @posted="handleTopicPosted"
        />
      </div>
      <div class="floating-resize" @mousedown="startResize" @touchstart.prevent="startResize" />
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

.floating-composer {
  position: fixed;
  right: 20px;
  bottom: 24px;
  width: min(420px, calc(100vw - 40px));
  z-index: 50;
}

.floating-shell {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  box-shadow: 0 16px 30px rgba(15, 23, 42, 0.2);
  overflow: hidden;
}

.dark .floating-shell {
  background: #111827;
  border-color: #374151;
}

.floating-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  font-size: 12px;
  color: #6b7280;
  background: rgba(148, 163, 184, 0.12);
  cursor: move;
}

.dark .floating-bar {
  color: #cbd5f5;
  background: rgba(30, 41, 59, 0.6);
}

.floating-close {
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
}

.floating-body {
  flex: 1;
  overflow: auto;
}

.floating-resize {
  width: 16px;
  height: 16px;
  align-self: flex-end;
  cursor: se-resize;
  background: linear-gradient(135deg, transparent 50%, rgba(148, 163, 184, 0.8) 50%);
}
</style>
