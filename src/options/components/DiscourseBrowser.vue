<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { message, Modal } from 'ant-design-vue'
import {
  CloseOutlined,
  WarningOutlined,
  MessageOutlined,
  MinusOutlined,
  ExpandOutlined
} from '@ant-design/icons-vue'

import { useDiscourseBrowser } from './discourse/useDiscourseBrowser'
import type {
  ChatChannelEditableStatus,
  ChatChannelUpdatePayload,
  ChatCreateChannelPayload,
  ChatMembershipUpdatePayload,
  ChatMessage,
  ChatThread,
  DiscourseCategory,
  DiscourseTag,
  DiscourseTopic,
  SuggestedTopic,
  ActivityTabType,
  MessagesTabType,
  DiscoursePost,
  DiscourseNotification,
  DiscourseNotificationFilter,
  DiscourseSearchFilters,
  TopicListType,
  DiscourseUserPreferences,
  MessageBusTopicPayload,
  MessageBusTopicListPayload,
  MessageBusNotificationPayload,
  MessageBusChatPayload,
  ReviewStatus,
  DiscourseUser
} from './discourse/types'
import { resolveDiscourseHttpUrl } from './discourse/navigation'
import type { QuickSidebarItem, QuickSidebarSection } from './discourse/layout/QuickSidebarPanel'
import type { UserMainTab } from './discourse/user/UserTabs'
import type { UserCardAnchor } from './discourse/user/UserCard'
import Icon from './discourse/layout/Icon'
import NotificationsDropdown from './discourse/notifications/NotificationsDropdown'
import QuickSidebarPanel from './discourse/layout/QuickSidebarPanel'
import BrowserToolbar from './discourse/browser/BrowserToolbar'
import BrowserTabs from './discourse/browser/BrowserTabs'
import DiscourseContextMenu from './discourse/browser/DiscourseContextMenu'
import HomeView from './discourse/browser/views/HomeView.vue'
import {
  pageFetch,
  extractData,
  getPageFetchActivity,
  subscribePageFetchActivity,
  type PageFetchActivity
} from './discourse/utils'
import { normalizeCategoriesFromResponse } from './discourse/routes/categories'
import {
  createDiscourseMessageBusClient,
  type MessageBusCallback,
  type MessageBusSubscriptionSpec
} from './discourse/messageBusClient'
import './discourse/css/DiscourseMd3.css'

// Route-only views stay out of the forum shell. This especially avoids parsing
// the ProseMirror/Markdown stack until a topic, chat, or composer is opened.
const TopicView = defineAsyncComponent(() => import('./discourse/topic/TopicView'))
const UserView = defineAsyncComponent(() => import('./discourse/user/UserView'))
const UserExtrasView = defineAsyncComponent(() => import('./discourse/user/UserExtrasView'))
const UserGroupsView = defineAsyncComponent(() => import('./discourse/user/UserGroupsView'))
const GroupDetailView = defineAsyncComponent(() => import('./discourse/group/GroupDetailView'))
const UserSettingsView = defineAsyncComponent(() => import('./discourse/user/UserSettingsView'))
const UserCard = defineAsyncComponent(() => import('./discourse/user/UserCard'))
const ActivityView = defineAsyncComponent(() => import('./discourse/user/ActivityView'))
const MessagesView = defineAsyncComponent(() => import('./discourse/user/MessagesView'))
const FloatingComposer = defineAsyncComponent(
  () => import('./discourse/browser/FloatingComposer.vue')
)
const PrivateMessageComposer = defineAsyncComponent(() => import('./discourse/composer/Composer'))
const CategoriesView = defineAsyncComponent(
  () => import('./discourse/browser/views/CategoriesView.vue')
)
const TagsView = defineAsyncComponent(() => import('./discourse/browser/views/TagsView.vue'))
const NotificationsPanel = defineAsyncComponent(
  () => import('./discourse/browser/views/NotificationsPanel.vue')
)
const TagTopicsView = defineAsyncComponent(
  () => import('./discourse/browser/views/TagTopicsView.vue')
)
const CategoryTopicsView = defineAsyncComponent(
  () => import('./discourse/browser/views/CategoryTopicsView.vue')
)
const ChatView = defineAsyncComponent(() => import('./discourse/chat/ChatView'))
const AiBotConversationsView = defineAsyncComponent(
  () => import('./discourse/ai/AiBotConversationsView')
)
const SearchView = defineAsyncComponent(() => import('./discourse/search/SearchView'))
const ReviewView = defineAsyncComponent(() => import('./discourse/review/ReviewView'))
const InvitesView = defineAsyncComponent(() => import('./discourse/invites/InvitesView'))

const {
  baseUrl,
  urlInput,
  tabs,
  activeTabId,
  activeTab,
  users,
  isLoadingMore,
  currentUsername,
  currentUserStaff,
  unreadNotificationsCount,
  ensureSessionUser,
  createTab,
  closeTab,
  switchTab,
  goBack,
  goForward,
  refresh,
  goHome,
  updateBaseUrl,
  navigateTo,
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
  openUserGroups,
  openUserPreferences,
  openChat,
  openChatChannel,
  ensureChatLoaded,
  loadMyThreads,
  loadMoreMyThreads,
  loadThreadsForChatChannel,
  loadMoreThreadsForChatChannel,
  searchChatMessages,
  openQuote,
  loadMorePosts,
  ensurePostNumberLoaded,
  loadMoreTopics,
  switchActivityTab,
  loadMoreActivity,
  switchMessagesTab,
  loadMoreMessages,
  loadMoreFollowFeed,
  loadMoreChatMessagesForChannel,
  openChatMessageThread,
  openChatThreadFromList,
  closeActiveChatThread,
  loadMoreChatThreadMessagesForActive,
  updateActiveChatThreadNotificationLevel,
  updateActiveChatThreadTitle,
  sendChat,
  sendChatThread,
  reactToChatMessage,
  updateChatChannel,
  replyChatInteraction,
  changeTopicListType,
  loadNotifications,
  checkTopicListUpdates,
  applyPendingTopics,
  pollTopicUpdates,
  patchTopicFromMessageBus,
  patchTopicListFromMessageBus,
  patchNotificationsFromMessageBus,
  patchChatFromMessageBus,
  markNotificationReadOptimistic,
  searchDiscourse,
  loadMoreSearchResults,
  replyToChatMessage,
  replyToChatThreadMessage,
  cancelChatReply,
  cancelChatThreadReply,
  editChatMessageAction,
  editChatThreadMessageAction,
  cancelChatEdit,
  cancelChatThreadEdit,
  deleteChatMessageAction,
  flagChatMessageAction,
  searchMessages,
  loadReview,
  loadMoreReviewables,
  performReviewAction,
  updateReviewableItem,
  deleteReviewableItem,
  loadInvites,
  loadMoreInvites,
  createInvite,
  deleteInvite,
  resendInvite,
  archivePrivateMessage,
  movePrivateMessageToInbox,
  markPrivateMessagesRead,
  createChatChannel,
  createDirectMessageChannel,
  loadChatMembers,
  loadMoreChatMembers,
  addChatMembers,
  removeChatMember,
  followChatChannel,
  unfollowChatChannel,
  deleteChatChannel,
  leaveChatChannel,
  updateChatStatus,
  updateChatMembership,
  searchChatables,
  loadDiscoverableChannels,
  joinChatChannel,
  addUsersToDirectMessageChannel
} = useDiscourseBrowser()

const contentAreaRef = ref<HTMLElement | null>(null)
const userExtrasTab = computed(
  () =>
    (activeTab.value?.viewType as
      'badges' | 'followFeed' | 'following' | 'followers' | undefined) || 'followFeed'
)
const isViewingSelf = computed(
  () =>
    !!activeTab.value?.currentUser?.username &&
    !!currentUsername.value &&
    activeTab.value?.currentUser?.username === currentUsername.value
)
const composerMode = ref<'reply' | 'topic' | 'edit' | null>(null)
const replyTarget = ref<{ postNumber: number; username: string } | null>(null)
const editTarget = ref<DiscoursePost | null>(null)
const editInitialRaw = ref('')
const editOriginalRaw = ref('')
const proxiedBlobUrls = new Set<string>()
const proxiedImageBlobUrls = new WeakMap<HTMLImageElement, string>()
const proxyingImages = new WeakMap<HTMLImageElement, string>()
const attemptedImageSources = new WeakMap<HTMLImageElement, string>()
const proxyImageRequests = new Map<string, Promise<Blob | null>>()
const messageBusUserId = ref<number | null>(null)
let messageBusUserIdFor = ''
let messageBusUserIdPromise: Promise<void> | null = null
const quickSidebarOpen = ref(false)
const quickSidebarLoading = ref(false)
const quickSidebarSections = ref<QuickSidebarSection[]>([])
const quickSidebarError = ref<string | null>(null)
const quickSidebarFetchedAt = ref(0)
const initialPageFetchActivity = getPageFetchActivity()
const pageFetchActivity = ref<PageFetchActivity>(initialPageFetchActivity)
// useDiscourseBrowser can start the first navigation before this component's
// watchers are registered. Count any requests that are already active/queued
// while excluding requests completed by an earlier browser mount.
const pageFetchBaseline = ref({
  total: Math.max(
    0,
    initialPageFetchActivity.total -
      initialPageFetchActivity.active -
      initialPageFetchActivity.queued
  ),
  completed: initialPageFetchActivity.completed
})
let unsubscribePageFetchActivity: (() => void) | null = null
const contextMenu = ref({
  open: false,
  x: 0,
  y: 0,
  url: '',
  selectedText: '',
  targetType: 'link' as 'link' | 'image' | 'text'
})
const userCard = ref<{
  open: boolean
  username: string
  anchor: UserCardAnchor | null
}>({ open: false, username: '', anchor: null })
const MESSAGE_BUS_USER_ID_CACHE_TTL_MS = 5 * 60 * 1000
const MESSAGE_BUS_USER_ID_ERROR_CACHE_TTL_MS = 60 * 1000
const MESSAGE_BUS_TOPIC_REFRESH_COOLDOWN_MS = 1200
const MESSAGE_BUS_LIST_REFRESH_COOLDOWN_MS = 1500
const MESSAGE_BUS_NOTIFICATIONS_REFRESH_COOLDOWN_MS = 1500
const messageBusUserIdCache = new Map<string, { expiresAt: number; userId: number | null }>()
let messageBusRefreshChain = Promise.resolve()
const messageBus = createDiscourseMessageBusClient({
  getBaseUrl: () => baseUrl.value,
  callbackInterval: 15000,
  backgroundCallbackInterval: 60000,
  minPollInterval: 100,
  maxPollInterval: 3 * 60 * 1000,
  minHiddenPollInterval: 1500,
  retryAfter429Ms: 15000
})
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
// Floating chat window keeps its own geometry so it can be dragged and
// resized independently from the floating composer. Defaults to the
// bottom-right corner (left/top null) and to the CSS width/height until
// the user actually drags or resizes the window.
const floatingChatState = ref({
  left: null as number | null,
  top: null as number | null,
  width: 820,
  height: 680,
  resized: false,
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
const messageBusCategory = (
  channel: string
): 'topic' | 'list' | 'notifications' | 'chat' | 'unknown' => {
  if (!channel) return 'unknown'
  if (channel.startsWith('/topic/')) return 'topic'
  if (channel.startsWith('/notification/') || channel.startsWith('/unread/')) {
    return 'notifications'
  }
  if (channel.startsWith('/chat/')) {
    return 'chat'
  }
  if (channel === '/latest' || channel === '/new' || channel === '/unread') {
    return 'list'
  }
  return 'unknown'
}

const extractTopicIdFromChannel = (channel: string): number | null => {
  const match = channel.match(/^\/topic\/(\d+)/)
  if (!match) return null
  const topicId = Number(match[1])
  return Number.isFinite(topicId) && topicId > 0 ? topicId : null
}

const extractChatChannelIdFromChannel = (channel: string): number | null => {
  const directMatch = channel.match(/^\/chat\/(\d+)/)
  if (directMatch) {
    const channelId = Number(directMatch[1])
    if (Number.isFinite(channelId) && channelId > 0) return channelId
  }

  const slashMatch = channel.match(/\/chat\/(\d+)(?:\/|$)/)
  if (slashMatch) {
    const channelId = Number(slashMatch[1])
    if (Number.isFinite(channelId) && channelId > 0) return channelId
  }

  return null
}

const shouldSubscribeListChannel = (channel: '/latest' | '/new' | '/unread') => {
  const tab = activeTab.value
  if (!tab || tab.loading) return false
  if (!['home', 'category', 'tag'].includes(tab.viewType)) return false

  if (channel === '/latest') return true
  if (channel === '/new') {
    return tab.viewType === 'home' ? tab.topicListType === 'new' : true
  }
  return tab.viewType === 'home' ? tab.topicListType === 'unread' : true
}
const notificationsOpen = ref(false)
const notificationsLoading = ref(false)
const notificationSnapshots = new Map<
  string,
  { notifications: DiscourseNotification[]; unreadCount: number }
>()
const notificationFiltersFetchedThisOpen = new Set<string>()

type NotificationLevel = 0 | 1 | 2 | 3 | 4

const categoryNotificationLevel = ref<NotificationLevel>(1)
const tagNotificationLevel = ref<NotificationLevel>(1)
const categoryNotificationSaving = ref(false)
const tagNotificationSaving = ref(false)
const notificationPreferences = ref<DiscourseUserPreferences | null>(null)
const notificationPreferencesKey = ref('')

// Chat group creation & member management state
const createGroupSearching = ref(false)
const createGroupResults = ref<DiscourseUser[]>([])
const chatDirectCreating = ref(false)
const chatPublicCreating = ref(false)
const manageSearching = ref(false)
const manageSearchResults = ref<DiscourseUser[]>([])
const chatChannelSaving = ref(false)
const chatMembershipSaving = ref(false)
const chatStatusSaving = ref(false)
const chatFollowSaving = ref(false)
const chatLeavingChannel = ref(false)
const chatDeletingChannel = ref(false)
const floatingChatOpen = ref(false)
const floatingChatMinimized = ref(false)
const floatingChatLoading = ref(false)

const floatingChatUnreadCount = computed(() =>
  (activeTab.value?.chatState?.channels || []).reduce(
    (total, channel) =>
      total + Math.max(0, Number(channel.current_user_membership?.unread_count || 0)),
    0
  )
)

const floatingChatTitle = computed(() => {
  const state = activeTab.value?.chatState
  const channel = state?.channels.find(item => item.id === state.activeChannelId)
  return channel?.title || channel?.unicode_title || channel?.chatable?.name || '聊天'
})

// Private message composer state
const pmComposerOpen = ref(false)
const pmComposerTargets = ref<string[]>([])

const pageRequestProgress = computed(() => {
  const activity = pageFetchActivity.value
  const requested = Math.max(0, activity.total - pageFetchBaseline.value.total)
  const completed = Math.max(0, activity.completed - pageFetchBaseline.value.completed)
  const total = Math.max(requested, completed)
  const pending = Math.max(0, total - completed)
  return {
    total,
    pending,
    active: Math.min(activity.active, pending),
    queued: Math.min(activity.queued, Math.max(0, pending - activity.active)),
    completed: Math.min(completed, total),
    percent: total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0
  }
})

const composerTopicId = computed(() => {
  if (composerMode.value === 'edit') {
    return editTarget.value?.topic_id || activeTab.value?.currentTopic?.id
  }
  return activeTab.value?.currentTopic?.id
})

const composerPostId = computed(() =>
  composerMode.value === 'edit' ? editTarget.value?.id : undefined
)

const composerInitialRaw = computed(() =>
  composerMode.value === 'edit' ? editInitialRaw.value : null
)

const composerOriginalRaw = computed(() =>
  composerMode.value === 'edit' ? editOriginalRaw.value : null
)

const composerReplyPostNumber = computed(() =>
  composerMode.value === 'reply' ? (replyTarget.value?.postNumber ?? null) : null
)

const composerReplyUsername = computed(() =>
  composerMode.value === 'reply' ? (replyTarget.value?.username ?? null) : null
)

const composerCategories = computed(() =>
  composerMode.value === 'topic' ? activeTab.value?.categories || [] : []
)

const composerDefaultCategoryId = computed(() =>
  composerMode.value === 'topic' ? activeTab.value?.currentCategoryId || null : null
)

const composerCurrentCategory = computed(() =>
  composerMode.value === 'topic' ? currentCategoryOption.value : null
)

const homeNavItems: Array<{ key: string; label: string; type: 'path' | 'list'; value: string }> = [
  { key: 'categories', label: '类别', type: 'path', value: '/categories' },
  { key: 'tags', label: '标签', type: 'path', value: '/tags' },
  { key: 'latest', label: '最新', type: 'list', value: 'latest' },
  { key: 'new', label: '新', type: 'list', value: 'new' },
  { key: 'unread', label: '未读', type: 'list', value: 'unread' },
  { key: 'top', label: '排行', type: 'list', value: 'top' },
  { key: 'hot', label: '热门', type: 'list', value: 'hot' },
  { key: 'posted', label: '我的帖子', type: 'list', value: 'posted' },
  { key: 'bookmarks', label: '书签', type: 'list', value: 'bookmarks' },
  { key: 'review', label: '审核', type: 'path', value: '/review' },
  { key: 'invites', label: '邀请', type: 'path', value: '/invites' }
]

const topicSortKey = ref<'replies' | 'views' | 'activity' | null>(null)
const topicSortOrder = ref<'asc' | 'desc'>('desc')

const getTopicActivityTime = (topic: DiscourseTopic | SuggestedTopic) => {
  const value =
    (topic as DiscourseTopic).last_posted_at ||
    (topic as DiscourseTopic).bumped_at ||
    (topic as DiscourseTopic).created_at
  return value ? new Date(value).getTime() : 0
}

const getTopicReplies = (topic: DiscourseTopic | SuggestedTopic) => {
  const count = (topic as DiscourseTopic).posts_count ?? 0
  return Math.max(count - 1, 0)
}

const sortedTopics = computed(() => {
  const topics = activeTab.value?.topics || []
  if (!topicSortKey.value) return topics
  const order = topicSortOrder.value === 'asc' ? 1 : -1
  const keyed = topics.map((topic, index) => ({ topic, index }))
  const getValue = (topic: DiscourseTopic | SuggestedTopic) => {
    if (topicSortKey.value === 'replies') return getTopicReplies(topic)
    if (topicSortKey.value === 'views') return topic.views || 0
    return getTopicActivityTime(topic)
  }
  keyed.sort((a, b) => {
    const diff = getValue(a.topic) - getValue(b.topic)
    if (diff === 0) return a.index - b.index
    return diff * order
  })
  return keyed.map(item => item.topic)
})

const isHomeNavActive = (item: (typeof homeNavItems)[number]) => {
  const tab = activeTab.value
  if (!tab) return false
  if (item.type === 'path') {
    if (item.value === '/categories') return tab.viewType === 'categories'
    if (item.value === '/tags') return tab.viewType === 'tags'
    if (item.value === '/review') return tab.viewType === 'review'
    if (item.value === '/invites') return tab.viewType === 'invites'
    return false
  }
  return tab.viewType === 'home' && tab.topicListType === item.value
}

const handleHomeNavClick = (item: (typeof homeNavItems)[number]) => {
  if (item.type === 'path') {
    handleNavigate(item.value)
    return
  }
  handleChangeTopicListType(item.value as TopicListType)
}

const handleTopicSort = (key: 'replies' | 'views' | 'activity') => {
  if (topicSortKey.value === key) {
    topicSortOrder.value = topicSortOrder.value === 'asc' ? 'desc' : 'asc'
    return
  }
  topicSortKey.value = key
  topicSortOrder.value = 'desc'
}

let scrollRafId: number | null = null
let suppressScrollPersistence = false
let renderedHistoryEntry: { tabId: string; historyIndex: number } | null = null

const persistCurrentScrollPosition = () => {
  const tab = activeTab.value
  const container = contentAreaRef.value
  if (!tab || !container) return
  const historyIndex =
    renderedHistoryEntry?.tabId === tab.id ? renderedHistoryEntry.historyIndex : tab.historyIndex
  if (!tab.historyScrollPositions) tab.historyScrollPositions = []
  tab.historyScrollPositions[historyIndex] = container.scrollTop
  if (historyIndex === tab.historyIndex) {
    tab.scrollTop = container.scrollTop
  }
}

const handleScrollRaf = () => {
  if (scrollRafId !== null) return
  const scheduledTab = activeTab.value
  const scheduledContainer = contentAreaRef.value
  const scheduledTabId = scheduledTab?.id
  const scheduledUrl = scheduledTab?.url
  const scheduledHistoryIndex = scheduledTab?.historyIndex
  const shouldIgnore = suppressScrollPersistence || !!scheduledTab?.loading
  scrollRafId = requestAnimationFrame(() => {
    scrollRafId = null
    const currentTab = activeTab.value
    if (
      shouldIgnore ||
      !currentTab ||
      currentTab.id !== scheduledTabId ||
      currentTab.url !== scheduledUrl ||
      currentTab.historyIndex !== scheduledHistoryIndex ||
      contentAreaRef.value !== scheduledContainer
    ) {
      return
    }
    void handleScroll()
  })
}

// Scroll event handler (infinite loading for all view types)
const handleScroll = async () => {
  if (!activeTab.value || !contentAreaRef.value) return
  if (suppressScrollPersistence || activeTab.value.loading) return
  const el = contentAreaRef.value
  persistCurrentScrollPosition()
  if (isLoadingMore.value) return

  const scrollBottom = el.scrollHeight - el.scrollTop - el.clientHeight
  const viewType = activeTab.value.viewType

  if (viewType === 'topic' && el.scrollTop < 200) {
    const previousHeight = el.scrollHeight
    const previousTop = el.scrollTop
    await loadMorePosts('up')
    await nextTick()
    const nextHeight = el.scrollHeight
    el.scrollTop = previousTop + (nextHeight - previousHeight)
    return
  }

  // Trigger load when 200px from bottom
  if (scrollBottom < 200) {
    if (viewType === 'topic') {
      loadMorePosts('down')
    } else if (viewType === 'home' || viewType === 'category' || viewType === 'tag') {
      loadMoreTopics()
    } else if (viewType === 'activity') {
      loadMoreActivity()
    } else if (viewType === 'messages') {
      loadMoreMessages()
    } else if (viewType === 'followFeed') {
      loadMoreFollowFeed()
    } else if (viewType === 'review') {
      loadMoreReviewables()
    } else if (viewType === 'invites') {
      loadMoreInvites()
    } else if (viewType === 'chat') {
      // chat list handles its own pagination
    }
  }
}

let scrollRestoreRafId: number | null = null
watch(
  () => activeTab.value?.loading,
  loading => {
    if (!loading) return
    persistCurrentScrollPosition()
    suppressScrollPersistence = true
    if (scrollRafId !== null) {
      cancelAnimationFrame(scrollRafId)
      scrollRafId = null
    }
    if (scrollRestoreRafId !== null) {
      cancelAnimationFrame(scrollRestoreRafId)
      scrollRestoreRafId = null
    }
    const activity = getPageFetchActivity()
    pageFetchBaseline.value = {
      total: activity.total,
      completed: activity.completed
    }
  },
  { flush: 'sync' }
)

watch(
  () => isLoadingMore.value,
  loading => {
    if (!loading) return
    const activity = getPageFetchActivity()
    pageFetchBaseline.value = {
      total: activity.total,
      completed: activity.completed
    }
  },
  { flush: 'sync' }
)

watch(
  () => [activeTabId.value, activeTab.value?.url, activeTab.value?.loading] as const,
  async ([tabId, url, loading]) => {
    if (!tabId || !url || loading) return
    suppressScrollPersistence = true
    renderedHistoryEntry = {
      tabId,
      historyIndex: activeTab.value?.historyIndex ?? 0
    }
    await nextTick()
    if (scrollRestoreRafId !== null) cancelAnimationFrame(scrollRestoreRafId)
    scrollRestoreRafId = requestAnimationFrame(() => {
      scrollRestoreRafId = null
      const tab = activeTab.value
      const container = contentAreaRef.value
      if (!tab || tab.id !== tabId || tab.url !== url || !container) {
        suppressScrollPersistence = false
        return
      }
      const saved = tab.historyScrollPositions?.[tab.historyIndex] ?? tab.scrollTop ?? 0
      container.scrollTop = Math.max(0, saved)
      renderedHistoryEntry = { tabId: tab.id, historyIndex: tab.historyIndex }
      suppressScrollPersistence = false
    })
  },
  { immediate: true }
)

// Handle topic click
const handleTopicClick = (topic: DiscourseTopic | SuggestedTopic) => {
  openTopic(topic as DiscourseTopic)
}

// Handle category click
const handleCategoryClick = (category: DiscourseCategory) => {
  openCategory(category)
}

const handleTagClick = (tag: DiscourseTag) => {
  const encoded = encodeURIComponent(tag.name)
  navigateTo(`${baseUrl.value}/tag/${encoded}`)
}

const handleOpenTopicTag = (tagName: string) => {
  const encoded = encodeURIComponent(tagName)
  navigateTo(`${baseUrl.value}/tag/${encoded}`)
}

const handleOpenNotification = (path: string) => {
  if (!path) return
  const tab = activeTab.value
  if (tab) {
    markNotificationReadOptimistic(tab, path)
  }
  notificationsOpen.value = false
  navigateTo(path)
}

const handleOpenNotifications = () => {
  notificationsOpen.value = false
  const username = currentUsername.value
  if (username) {
    navigateTo(`/u/${encodeURIComponent(username)}/notifications`)
    return
  }
  navigateTo('/my/notifications')
}

const handleOpenMyProfile = () => {
  const username = currentUsername.value
  if (!username) return
  openUser(username)
}

const handleNotificationsOpenChange = async (open: boolean) => {
  notificationsOpen.value = open
  if (!open) {
    notificationFiltersFetchedThisOpen.clear()
    return
  }
  const tab = activeTab.value
  if (!tab) return
  notificationsLoading.value = true
  try {
    await loadNotifications(tab, tab.notificationsFilter, true)
    const key = `${tab.id}:${tab.notificationsFilter}`
    notificationSnapshots.set(key, {
      notifications: [...tab.notifications],
      unreadCount: tab.unreadNotificationsCount
    })
    notificationFiltersFetchedThisOpen.add(key)
  } catch (error) {
    console.warn('[DiscourseBrowser] notifications load failed:', error)
  } finally {
    notificationsLoading.value = false
  }
}

const handleRefreshNotifications = async () => {
  const tab = activeTab.value
  if (!tab) return
  notificationsLoading.value = true
  try {
    await loadNotifications(tab, tab.notificationsFilter, true)
    const key = `${tab.id}:${tab.notificationsFilter}`
    notificationSnapshots.set(key, {
      notifications: [...tab.notifications],
      unreadCount: tab.unreadNotificationsCount
    })
    if (notificationsOpen.value) notificationFiltersFetchedThisOpen.add(key)
  } catch (error) {
    console.warn('[DiscourseBrowser] notifications refresh failed:', error)
  } finally {
    notificationsLoading.value = false
  }
}

const handleNotificationFilterChange = async (filter: DiscourseNotificationFilter) => {
  const tab = activeTab.value
  if (!tab) return
  if (tab.viewType === 'notifications') {
    const target = new URL(tab.url, baseUrl.value)
    target.pathname = target.pathname.replace(/(\/notifications)(?:\/[^/]+)?\/?$/i, '$1')
    if (filter === 'all') {
      target.searchParams.delete('filter')
    } else {
      target.searchParams.set('filter', filter)
    }
    await navigateTo(target.toString())
    return
  }
  tab.notificationsFilter = filter
  const key = `${tab.id}:${filter}`
  if (notificationsOpen.value && notificationFiltersFetchedThisOpen.has(key)) {
    const snapshot = notificationSnapshots.get(key)
    if (snapshot) {
      tab.notifications = [...snapshot.notifications]
      tab.unreadNotificationsCount = snapshot.unreadCount
      return
    }
  }
  notificationsLoading.value = true
  try {
    await loadNotifications(tab, filter, true)
    notificationSnapshots.set(key, {
      notifications: [...tab.notifications],
      unreadCount: tab.unreadNotificationsCount
    })
    if (notificationsOpen.value) notificationFiltersFetchedThisOpen.add(key)
  } catch (error) {
    console.warn('[DiscourseBrowser] notifications load failed:', error)
  } finally {
    notificationsLoading.value = false
  }
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
  userCard.value.open = false
  openUser(username)
}

const closeUserCard = () => {
  userCard.value = { open: false, username: '', anchor: null }
}

const handleUserCardClick = (event: MouseEvent) => {
  if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
  const target = event.target
  if (!(target instanceof Element)) return
  const trigger = target.closest<HTMLElement>('[data-user-card]')
  const username = trigger?.dataset.userCard?.trim()
  if (!trigger || !username) return

  event.preventDefault()
  event.stopPropagation()
  const rect = trigger.getBoundingClientRect()
  userCard.value = {
    open: true,
    username,
    anchor: {
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height
    }
  }
}

// Handle quote click
const handleQuoteClick = (payload: { topicId: number; postNumber: number }) => {
  openQuote(payload)
}

// Handle content navigation (links in posts)
const handleContentNavigation = (url: string) => {
  const target = resolveDiscourseHttpUrl(url, baseUrl.value)
  if (!target) return

  const targetUrl = new URL(target)
  const forumUrl = new URL(baseUrl.value)
  if (targetUrl.origin === forumUrl.origin) {
    navigateTo(targetUrl.toString())
    return
  }

  const opened = window.open(targetUrl.toString(), '_blank', 'noopener,noreferrer')
  if (opened) opened.opener = null
}

const closeContextMenu = () => {
  contextMenu.value.open = false
}

const handleBrowserContextMenu = (event: MouseEvent) => {
  const target = event.target
  if (!(target instanceof Element)) return

  const image = target.closest<HTMLImageElement>('img')
  const imageContainer = image?.closest<HTMLElement>('[data-image-url]')
  const anchor = target.closest<HTMLAnchorElement>('a[href]')
  const dataLink = target.closest<HTMLElement>('[data-discourse-url]')
  const selection = window.getSelection()?.toString().trim() || ''
  const imageRawUrl =
    image?.dataset.imageUrl ||
    image?.dataset.discourseUrl ||
    imageContainer?.dataset.imageUrl ||
    image?.getAttribute('src') ||
    ''
  const rawUrl =
    imageRawUrl ||
    // A selected paragraph can live inside a post/article or link that carries
    // a navigation data attribute.  Prefer the text menu whenever the user
    // selected text; only an actual image keeps the image action menu.
    (!selection && (anchor?.getAttribute('href') || dataLink?.dataset.discourseUrl)) ||
    ''
  const resolved = rawUrl ? resolveDiscourseHttpUrl(rawUrl, baseUrl.value) : null
  const isTextTarget = !resolved && selection.length > 0
  // Do not replace the native editing-menu on inputs/textareas unless the
  // selected text is part of a rendered forum message.
  if (!resolved && !isTextTarget) return
  if (!resolved && (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) {
    return
  }

  event.preventDefault()
  event.stopPropagation()
  contextMenu.value = {
    open: true,
    x: event.clientX,
    y: event.clientY,
    url: resolved || '',
    selectedText: selection,
    targetType: imageRawUrl && resolved ? 'image' : resolved ? 'link' : 'text'
  }
}

const openContextUrlInBrowserTab = () => {
  const target = contextMenu.value.url
  if (!target) return
  const opened = window.open(target, '_blank', 'noopener,noreferrer')
  if (opened) opened.opener = null
}

const copyContextUrl = async () => {
  const target = contextMenu.value.url
  if (!target) return
  try {
    await navigator.clipboard.writeText(target)
  } catch {
    const input = document.createElement('textarea')
    input.value = target
    input.style.position = 'fixed'
    input.style.opacity = '0'
    document.body.appendChild(input)
    input.select()
    document.execCommand('copy')
    input.remove()
  }
  message.success('链接已复制')
}

const copyContextSelection = async () => {
  const target = contextMenu.value.selectedText
  if (!target) return
  try {
    await navigator.clipboard.writeText(target)
  } catch {
    const input = document.createElement('textarea')
    input.value = target
    input.style.position = 'fixed'
    input.style.opacity = '0'
    document.body.appendChild(input)
    input.select()
    document.execCommand('copy')
    input.remove()
  }
  message.success('选中文字已复制')
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

// 分组详情页返回：导航到论坛首页
const handleGroupBack = () => {
  navigateTo(`${baseUrl.value}/`)
}

// 分组详情页快捷邀请：复用邀请创建流程（先确保 invitesState 存在）
const handleGroupInviteCreate = async (payload: Record<string, any>) => {
  const tab = activeTab.value
  if (!tab) return
  if (!tab.invitesState) {
    tab.invitesState = {
      filter: 'pending',
      invites: [],
      offset: 0,
      hasMore: true,
      loading: false,
      creating: false,
      errorMessage: '',
      counts: { pending: 0, redeemed: 0, expired: 0 },
      canSeeInviteDetails: false
    }
  }
  await handleInvitesCreate(payload)
}

// Handle open user activity
const handleOpenUserActivity = (username: string) => {
  openUserActivity(username)
}

// Handle open user messages
const handleOpenUserMessages = (username: string) => {
  openUserMessages(username)
}

const handleOpenChat = () => {
  openChat()
}

const openFloatingChat = async () => {
  const wasOpen = floatingChatOpen.value
  floatingChatOpen.value = true
  if (!wasOpen) floatingChatMinimized.value = false
  if (floatingChatLoading.value) return
  floatingChatLoading.value = true
  try {
    const loaded = await ensureChatLoaded()
    if (!loaded) message.error('无法加载聊天')
  } finally {
    floatingChatLoading.value = false
  }
}

const toggleFloatingChat = () => {
  if (floatingChatOpen.value) {
    floatingChatOpen.value = false
    return
  }
  void openFloatingChat()
}

const closeFloatingChat = () => {
  floatingChatOpen.value = false
  floatingChatMinimized.value = false
}

const expandFloatingChatToPage = () => {
  closeFloatingChat()
  openChat()
}

const toggleQuickSidebar = () => {
  quickSidebarOpen.value = !quickSidebarOpen.value
}

const closeQuickSidebar = () => {
  quickSidebarOpen.value = false
}

const navigateQuickSidebar = (path: string) => {
  closeQuickSidebar()
  navigateTo(path)
}

const buildCategoryItems = (
  ids: unknown,
  map: Map<number, DiscourseCategory>,
  muted = false
): QuickSidebarItem[] => {
  if (!Array.isArray(ids)) return []
  return ids
    .map(id => {
      const numericId = typeof id === 'number' ? id : Number(id)
      if (!Number.isFinite(numericId)) return null
      const category = map.get(numericId)
      if (!category) return null
      return {
        id: `category-${numericId}`,
        label: category.name,
        path: `/c/${category.slug}/${category.id}`,
        color: category.color,
        muted
      }
    })
    .filter(Boolean) as QuickSidebarItem[]
}

const buildTagItems = (tags: unknown, muted = false): QuickSidebarItem[] => {
  if (!Array.isArray(tags)) return []
  return tags
    .map(tag => (typeof tag === 'string' ? tag.trim() : ''))
    .filter(tag => tag.length > 0)
    .map(tag => ({
      id: `tag-${tag}`,
      label: tag,
      path: `/tag/${encodeURIComponent(tag)}`,
      muted
    }))
}

const sanitizeNumberArray = (value: unknown): number[] => {
  if (!Array.isArray(value)) return []
  return value
    .map(item => (typeof item === 'number' ? item : Number(item)))
    .filter(item => Number.isFinite(item) && item >= 0)
}

const sanitizeStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return []
  return value.map(item => (typeof item === 'string' ? item.trim() : '')).filter(Boolean)
}

const uniqueNumbers = (...values: Array<number[] | undefined>) =>
  Array.from(new Set(values.flatMap(value => value || [])))

const uniqueStrings = (...values: Array<string[] | undefined>) => {
  const seen = new Set<string>()
  return values
    .flatMap(value => value || [])
    .filter(item => {
      const key = item.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}

const uniqueSidebarItems = (items: QuickSidebarItem[]) => {
  const seen = new Set<string>()
  return items.filter(item => {
    if (seen.has(item.id)) return false
    seen.add(item.id)
    return true
  })
}

const normalizeNotificationPreferences = (raw: any): DiscourseUserPreferences => {
  const input = raw || {}
  return {
    watched_category_ids: sanitizeNumberArray(input.watched_category_ids),
    tracked_category_ids: sanitizeNumberArray(input.tracked_category_ids),
    watched_first_post_category_ids: sanitizeNumberArray(input.watched_first_post_category_ids),
    muted_category_ids: sanitizeNumberArray(input.muted_category_ids),
    regular_category_ids: sanitizeNumberArray(input.regular_category_ids),
    default_categories_watching: sanitizeNumberArray(input.default_categories_watching),
    default_categories_tracking: sanitizeNumberArray(input.default_categories_tracking),
    default_categories_watching_first_post: sanitizeNumberArray(
      input.default_categories_watching_first_post
    ),
    default_categories_muted: sanitizeNumberArray(input.default_categories_muted),
    watched_tags: sanitizeStringArray(input.watched_tags),
    tracked_tags: sanitizeStringArray(input.tracked_tags),
    watching_first_post_tags: sanitizeStringArray(input.watching_first_post_tags),
    muted_tags: sanitizeStringArray(input.muted_tags),
    default_tags_watching: sanitizeStringArray(input.default_tags_watching),
    default_tags_tracking: sanitizeStringArray(input.default_tags_tracking),
    default_tags_muted: sanitizeStringArray(input.default_tags_muted)
  }
}

const buildNotificationPreferencesKey = () => `${baseUrl.value}::${currentUsername.value || ''}`

const ensureNotificationPreferences = async (
  forceReload = false
): Promise<DiscourseUserPreferences | null> => {
  const username = currentUsername.value
  if (!username) return null
  const cacheKey = buildNotificationPreferencesKey()
  if (
    !forceReload &&
    notificationPreferences.value &&
    notificationPreferencesKey.value === cacheKey
  ) {
    return notificationPreferences.value
  }

  const result = await pageFetch<any>(`${baseUrl.value}/u/${encodeURIComponent(username)}.json`)
  const data = extractData(result)
  if (result.ok === false) {
    const msg = data?.errors?.join(', ') || data?.error || '加载通知设置失败'
    throw new Error(msg)
  }

  const normalized = normalizeNotificationPreferences(data?.user?.user_option || {})
  notificationPreferences.value = normalized
  notificationPreferencesKey.value = cacheKey
  return normalized
}

const determineCategoryNotificationLevel = (
  categoryId: number | null,
  preferences: DiscourseUserPreferences | null
): NotificationLevel => {
  if (!categoryId || !preferences) return 1
  const id = Number(categoryId)
  if ((preferences.muted_category_ids || []).includes(id)) return 0
  if ((preferences.watched_first_post_category_ids || []).includes(id)) return 4
  if ((preferences.watched_category_ids || []).includes(id)) return 3
  if ((preferences.tracked_category_ids || []).includes(id)) return 2
  return 1
}

const determineTagNotificationLevel = (
  tagName: string,
  preferences: DiscourseUserPreferences | null
): NotificationLevel => {
  const normalizedTag = tagName.trim().toLowerCase()
  if (!normalizedTag || !preferences) return 1
  const hasTag = (tags?: string[]) =>
    (tags || []).some(tag => tag.trim().toLowerCase() === normalizedTag)
  if (hasTag(preferences.muted_tags)) return 0
  if (hasTag(preferences.watching_first_post_tags)) return 4
  if (hasTag(preferences.watched_tags)) return 3
  if (hasTag(preferences.tracked_tags)) return 2
  return 1
}

const toCategoryNotificationLists = (
  level: NotificationLevel,
  categoryId: number,
  source: DiscourseUserPreferences
) => {
  const watched = new Set(
    sanitizeNumberArray(source.watched_category_ids).filter(id => id !== categoryId)
  )
  const tracked = new Set(
    sanitizeNumberArray(source.tracked_category_ids).filter(id => id !== categoryId)
  )
  const watchedFirst = new Set(
    sanitizeNumberArray(source.watched_first_post_category_ids).filter(id => id !== categoryId)
  )
  const muted = new Set(
    sanitizeNumberArray(source.muted_category_ids).filter(id => id !== categoryId)
  )

  if (level === 3) watched.add(categoryId)
  else if (level === 2) tracked.add(categoryId)
  else if (level === 4) watchedFirst.add(categoryId)
  else if (level === 0) muted.add(categoryId)

  return {
    watched_category_ids: Array.from(watched),
    tracked_category_ids: Array.from(tracked),
    watched_first_post_category_ids: Array.from(watchedFirst),
    muted_category_ids: Array.from(muted)
  }
}

const toTagNotificationLists = (
  level: NotificationLevel,
  tagName: string,
  source: DiscourseUserPreferences
) => {
  const normalizedTag = tagName.trim()
  const lower = normalizedTag.toLowerCase()
  const removeTag = (tags: string[] = []) => tags.filter(tag => tag.trim().toLowerCase() !== lower)

  const watched = new Set(removeTag(sanitizeStringArray(source.watched_tags)))
  const tracked = new Set(removeTag(sanitizeStringArray(source.tracked_tags)))
  const watchedFirst = new Set(removeTag(sanitizeStringArray(source.watching_first_post_tags)))
  const muted = new Set(removeTag(sanitizeStringArray(source.muted_tags)))

  if (level === 3) watched.add(normalizedTag)
  else if (level === 2) tracked.add(normalizedTag)
  else if (level === 4) watchedFirst.add(normalizedTag)
  else if (level === 0) muted.add(normalizedTag)

  return {
    watched_tags: Array.from(watched),
    tracked_tags: Array.from(tracked),
    watching_first_post_tags: Array.from(watchedFirst),
    muted_tags: Array.from(muted)
  }
}

const encodeCategoryIds = (ids: number[]) => (ids.length ? ids : [-1])

const encodeDelimited = (values: string[]) =>
  values
    .map(value => value.trim())
    .filter(Boolean)
    .join(',')

const syncCategoryNotificationLevel = async () => {
  const tab = activeTab.value
  if (!tab || tab.viewType !== 'category') {
    categoryNotificationLevel.value = 1
    return
  }

  if (!tab.currentCategoryId) {
    categoryNotificationLevel.value = 1
    return
  }

  try {
    const prefs = await ensureNotificationPreferences()
    categoryNotificationLevel.value = determineCategoryNotificationLevel(
      tab.currentCategoryId,
      prefs
    )
  } catch {
    categoryNotificationLevel.value = 1
  }
}

const syncTagNotificationLevel = async () => {
  const tab = activeTab.value
  if (!tab || tab.viewType !== 'tag') {
    tagNotificationLevel.value = 1
    return
  }

  if (!tab.currentTagName) {
    tagNotificationLevel.value = 1
    return
  }

  try {
    const prefs = await ensureNotificationPreferences()
    tagNotificationLevel.value = determineTagNotificationLevel(tab.currentTagName, prefs)
  } catch {
    tagNotificationLevel.value = 1
  }
}

const handleCategoryNotificationLevelChange = async (level: number) => {
  const tab = activeTab.value
  const username = currentUsername.value
  if (!tab || tab.viewType !== 'category' || !tab.currentCategoryId || !username) return
  const nextLevel = Number(level) as NotificationLevel
  if (![0, 1, 2, 3, 4].includes(nextLevel)) return

  const prevLevel = categoryNotificationLevel.value
  categoryNotificationLevel.value = nextLevel
  categoryNotificationSaving.value = true

  try {
    const basePrefs =
      (await ensureNotificationPreferences()) || normalizeNotificationPreferences({})
    const categoryLists = toCategoryNotificationLists(nextLevel, tab.currentCategoryId, basePrefs)
    const nextPrefs: DiscourseUserPreferences = {
      ...basePrefs,
      ...categoryLists
    }

    const payload = {
      watched_category_ids: encodeCategoryIds(categoryLists.watched_category_ids || []),
      tracked_category_ids: encodeCategoryIds(categoryLists.tracked_category_ids || []),
      watched_first_post_category_ids: encodeCategoryIds(
        categoryLists.watched_first_post_category_ids || []
      ),
      muted_category_ids: encodeCategoryIds(categoryLists.muted_category_ids || []),
      watched_tags: encodeDelimited(sanitizeStringArray(basePrefs.watched_tags)),
      tracked_tags: encodeDelimited(sanitizeStringArray(basePrefs.tracked_tags)),
      watching_first_post_tags: encodeDelimited(
        sanitizeStringArray(basePrefs.watching_first_post_tags)
      ),
      muted_tags: encodeDelimited(sanitizeStringArray(basePrefs.muted_tags))
    }

    const result = await pageFetch<any>(`${baseUrl.value}/u/${encodeURIComponent(username)}.json`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: JSON.stringify(payload)
    })
    const data = extractData(result)
    if (result.ok === false) {
      const msg = data?.errors?.join(', ') || data?.error || '设置通知级别失败'
      throw new Error(msg)
    }

    notificationPreferences.value = nextPrefs
    notificationPreferencesKey.value = buildNotificationPreferencesKey()
    message.success('分类通知等级已更新')
    if (quickSidebarOpen.value) {
      void loadQuickSidebar(true)
    }
  } catch (error: any) {
    categoryNotificationLevel.value = prevLevel
    message.error(error?.message || '更新分类通知等级失败')
  } finally {
    categoryNotificationSaving.value = false
  }
}

const handleTagNotificationLevelChange = async (level: number) => {
  const tab = activeTab.value
  const username = currentUsername.value
  const tagName = tab?.currentTagName?.trim() || ''
  if (!tab || tab.viewType !== 'tag' || !tagName || !username) return
  const nextLevel = Number(level) as NotificationLevel
  if (![0, 1, 2, 3, 4].includes(nextLevel)) return

  const prevLevel = tagNotificationLevel.value
  tagNotificationLevel.value = nextLevel
  tagNotificationSaving.value = true

  try {
    const basePrefs =
      (await ensureNotificationPreferences()) || normalizeNotificationPreferences({})
    const tagLists = toTagNotificationLists(nextLevel, tagName, basePrefs)
    const nextPrefs: DiscourseUserPreferences = {
      ...basePrefs,
      ...tagLists
    }

    const payload = {
      watched_category_ids: encodeCategoryIds(sanitizeNumberArray(basePrefs.watched_category_ids)),
      tracked_category_ids: encodeCategoryIds(sanitizeNumberArray(basePrefs.tracked_category_ids)),
      watched_first_post_category_ids: encodeCategoryIds(
        sanitizeNumberArray(basePrefs.watched_first_post_category_ids)
      ),
      muted_category_ids: encodeCategoryIds(sanitizeNumberArray(basePrefs.muted_category_ids)),
      watched_tags: encodeDelimited(tagLists.watched_tags || []),
      tracked_tags: encodeDelimited(tagLists.tracked_tags || []),
      watching_first_post_tags: encodeDelimited(tagLists.watching_first_post_tags || []),
      muted_tags: encodeDelimited(tagLists.muted_tags || [])
    }

    const result = await pageFetch<any>(`${baseUrl.value}/u/${encodeURIComponent(username)}.json`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: JSON.stringify(payload)
    })
    const data = extractData(result)
    if (result.ok === false) {
      const msg = data?.errors?.join(', ') || data?.error || '设置通知级别失败'
      throw new Error(msg)
    }

    notificationPreferences.value = nextPrefs
    notificationPreferencesKey.value = buildNotificationPreferencesKey()
    message.success('标签通知等级已更新')
    if (quickSidebarOpen.value) {
      void loadQuickSidebar(true)
    }
  } catch (error: any) {
    tagNotificationLevel.value = prevLevel
    message.error(error?.message || '更新标签通知等级失败')
  } finally {
    tagNotificationSaving.value = false
  }
}

const loadQuickSidebar = async (force = false) => {
  const now = Date.now()
  if (!force && now - quickSidebarFetchedAt.value < 60000) return
  if (quickSidebarLoading.value) return

  const username = currentUsername.value
  const shortcutSection: QuickSidebarSection = {
    title: '快捷入口',
    items: [
      { id: 'home', label: '主页', path: '/', icon: 'list' },
      { id: 'latest', label: '最新', path: '/latest', icon: 'clock' },
      { id: 'new', label: '新话题', path: '/new', icon: 'plus' },
      { id: 'unread', label: '未读', path: '/unread', icon: 'circle' },
      { id: 'categories', label: '分类', path: '/categories', icon: 'list' },
      { id: 'tags', label: '标签', path: '/tags', icon: 'tags' },
      { id: 'chat', label: '聊天', path: '/chat', icon: 'comment' },
      {
        id: 'notifications',
        label: '通知',
        path: username ? `/u/${encodeURIComponent(username)}/notifications` : '/my/notifications',
        icon: 'bell'
      },
      {
        id: 'private-messages',
        label: '私信',
        path: username
          ? `/u/${encodeURIComponent(username)}/user-menu-private-messages`
          : '/my/messages',
        icon: 'envelope'
      },
      {
        id: 'bookmarks',
        label: '书签',
        path: username ? `/u/${encodeURIComponent(username)}/user-menu-bookmarks` : '/bookmarks',
        icon: 'bookmark'
      },
      { id: 'posted', label: '我的帖子', path: '/posted', icon: 'pencil' }
    ]
  }

  quickSidebarSections.value = [shortcutSection]
  if (!username) {
    quickSidebarFetchedAt.value = now
    quickSidebarError.value = null
    return
  }

  quickSidebarLoading.value = true
  quickSidebarError.value = null

  try {
    const [userResult, categoriesResult] = await Promise.all([
      pageFetch<any>(`${baseUrl.value}/u/${encodeURIComponent(username)}.json`),
      pageFetch<any>(`${baseUrl.value}/categories.json`)
    ])

    const userData = userResult.data || {}
    const categoriesData = categoriesResult.data || {}
    const categories = normalizeCategoriesFromResponse(categoriesData)
    const categoryMap = new Map<number, DiscourseCategory>(
      categories.map(category => [category.id, category])
    )

    const user = userData.user || {}
    const normalizedPrefs = normalizeNotificationPreferences(user.user_option || {})
    notificationPreferences.value = normalizedPrefs
    notificationPreferencesKey.value = buildNotificationPreferencesKey()
    const sections: QuickSidebarSection[] = [shortcutSection]

    const watchedCategoryItems = buildCategoryItems(
      uniqueNumbers(
        normalizedPrefs.watched_category_ids,
        normalizedPrefs.default_categories_watching
      ),
      categoryMap
    )
    const trackedCategoryItems = buildCategoryItems(
      uniqueNumbers(
        normalizedPrefs.tracked_category_ids,
        normalizedPrefs.default_categories_tracking
      ),
      categoryMap
    )
    const watchedFirstPostCategoryItems = buildCategoryItems(
      uniqueNumbers(
        normalizedPrefs.watched_first_post_category_ids,
        normalizedPrefs.default_categories_watching_first_post
      ),
      categoryMap
    )
    const mutedCategoryItems = buildCategoryItems(
      uniqueNumbers(normalizedPrefs.muted_category_ids, normalizedPrefs.default_categories_muted),
      categoryMap,
      true
    )
    const regularCategoryItems = buildCategoryItems(
      normalizedPrefs.regular_category_ids,
      categoryMap
    )

    const categoryNotificationItems = uniqueSidebarItems([
      ...mutedCategoryItems,
      ...watchedCategoryItems,
      ...trackedCategoryItems,
      ...watchedFirstPostCategoryItems,
      ...regularCategoryItems
    ])
    if (categoryNotificationItems.length) {
      sections.push({ title: '我的分类设置', items: categoryNotificationItems })
    }

    const watchedTags = buildTagItems(
      uniqueStrings(normalizedPrefs.watched_tags, normalizedPrefs.default_tags_watching)
    )
    const trackedTags = buildTagItems(
      uniqueStrings(normalizedPrefs.tracked_tags, normalizedPrefs.default_tags_tracking)
    )
    const watchingFirstPostTags = buildTagItems(normalizedPrefs.watching_first_post_tags)
    const mutedTags = buildTagItems(
      uniqueStrings(normalizedPrefs.muted_tags, normalizedPrefs.default_tags_muted),
      true
    )

    const tagNotificationItems = uniqueSidebarItems([
      ...mutedTags,
      ...watchedTags,
      ...trackedTags,
      ...watchingFirstPostTags
    ])
    if (tagNotificationItems.length) {
      sections.push({ title: '我的标签设置', items: tagNotificationItems })
    }

    quickSidebarSections.value = sections
    quickSidebarFetchedAt.value = now
  } catch (error) {
    quickSidebarError.value = error instanceof Error ? error.message : '加载失败'
  } finally {
    quickSidebarLoading.value = false
  }
}

const handleSelectChatChannel = (channel: { id: number; slug?: string }, syncLocation = true) => {
  openChatChannel(channel, syncLocation)
}

const handleLoadMoreChatMessages = (channelId: number) => {
  loadMoreChatMessagesForChannel(channelId)
}

const handleSearchChatMessages = (payload: {
  query: string
  channelId: number | null
  sort: 'relevance' | 'latest'
}) => {
  void searchChatMessages(payload.query, payload.channelId, payload.sort, true)
}

const handleLoadMoreChatSearch = () => {
  const search = activeTab.value?.chatState?.searchState
  if (!search) return
  void searchChatMessages(search.query, search.channelId, search.sort, false)
}

const handleOpenChatThread = async (chatMessage: ChatMessage, syncLocation = true) => {
  const thread = await openChatMessageThread(chatMessage, syncLocation)
  if (!thread) {
    message.error(activeTab.value?.chatState?.threadErrorMessage || '无法打开消息串')
  }
}

const handleLoadMyChatThreads = () => {
  void loadMyThreads(true)
}

const handleLoadMoreMyChatThreads = () => {
  void loadMoreMyThreads()
}

const handleLoadChatChannelThreads = (channelId: number) => {
  void loadThreadsForChatChannel(channelId, true)
}

const handleLoadMoreChatChannelThreads = (channelId: number) => {
  void loadMoreThreadsForChatChannel(channelId)
}

const handleSelectChatThread = async (thread: ChatThread, syncLocation = true) => {
  const opened = await openChatThreadFromList(thread, syncLocation)
  if (!opened) {
    message.error(activeTab.value?.chatState?.threadErrorMessage || '无法打开消息串')
  }
}

const handleCloseChatThread = (syncLocation = true) => {
  closeActiveChatThread(syncLocation)
}

const handleLoadMoreChatThreadMessages = (threadId: number) => {
  loadMoreChatThreadMessagesForActive(threadId)
}

const handleUpdateChatThreadNotification = async (payload: {
  threadId?: number
  level: number
}) => {
  if (!payload.threadId) return
  const membership = await updateActiveChatThreadNotificationLevel(payload.threadId, payload.level)
  if (!membership) {
    message.error(activeTab.value?.chatState?.threadErrorMessage || '消息串通知设置更新失败')
  }
}

const handleUpdateChatThreadTitle = async (payload: { threadId?: number; title: string }) => {
  if (!payload.threadId) return
  const updated = await updateActiveChatThreadTitle(payload.threadId, payload.title)
  if (!updated) {
    message.error(activeTab.value?.chatState?.threadErrorMessage || '消息串标题更新失败')
  }
}

const handleSendChatMessage = (payload: { channelId: number; message: string }) => {
  sendChat(payload.channelId, payload.message)
}

const handleSendChatThreadMessage = (payload: {
  channelId?: number
  threadId?: number
  message: string
}) => {
  if (!payload.channelId || !payload.threadId) return
  sendChatThread(payload.channelId, payload.threadId, payload.message)
}

const handleReactChatMessage = async (payload: {
  channelId: number
  messageId: number
  emoji: string
  reacted?: boolean
}) => {
  const ok = await reactToChatMessage(
    payload.channelId,
    payload.messageId,
    payload.emoji,
    payload.reacted
  )
  if (!ok) {
    message.error(activeTab.value?.chatState?.errorMessage || '聊天反应操作失败')
  }
}

const handleEditChatChannel = async (
  payload: {
    channelId: number
    updates: ChatChannelUpdatePayload
  },
  syncLocation = true
) => {
  if (chatChannelSaving.value) return
  chatChannelSaving.value = true
  try {
    const channel = await updateChatChannel(payload.channelId, payload.updates, syncLocation)
    if (channel) {
      message.success('频道设置已保存')
    } else {
      message.error(activeTab.value?.chatState?.errorMessage || '频道更新失败')
    }
  } finally {
    chatChannelSaving.value = false
  }
}

const handleUpdateChatMembership = async (payload: {
  channelId: number
  updates: ChatMembershipUpdatePayload
}) => {
  if (chatMembershipSaving.value) return
  chatMembershipSaving.value = true
  try {
    const ok = await updateChatMembership(payload.channelId, payload.updates)
    if (ok) {
      message.success('个人频道设置已更新')
    } else {
      message.error(activeTab.value?.chatState?.errorMessage || '个人频道设置更新失败')
    }
  } finally {
    chatMembershipSaving.value = false
  }
}

const handleUpdateChatStatus = async (payload: {
  channelId: number
  status: ChatChannelEditableStatus
}) => {
  if (chatStatusSaving.value) return
  chatStatusSaving.value = true
  try {
    const ok = await updateChatStatus(payload.channelId, payload.status)
    if (ok) {
      message.success(payload.status === 'open' ? '频道已开放' : '频道已关闭')
    } else {
      message.error(activeTab.value?.chatState?.errorMessage || '频道状态更新失败')
    }
  } finally {
    chatStatusSaving.value = false
  }
}

const handleChatMessageInteraction = async (payload: {
  channelId: number
  messageId: number
  actionId: string
}) => {
  const result = await replyChatInteraction(payload.channelId, payload.messageId, payload.actionId)
  if (result) {
    message.success('邀请回复已发送')
  } else {
    message.error(activeTab.value?.chatState?.errorMessage || '邀请回复失败')
  }
}

const handleReplyToMessage = (message: ChatMessage) => {
  replyToChatMessage(message)
}

const handleReplyToThreadMessage = (message: ChatMessage) => {
  replyToChatThreadMessage(message)
}

const handleEditMessage = (message: ChatMessage) => {
  editChatMessageAction(message)
}

const handleEditThreadMessage = (message: ChatMessage) => {
  editChatThreadMessageAction(message)
}

const handleDeleteMessage = async (payload: { channelId?: number; messageId: number }) => {
  const channelId = payload.channelId || activeTab.value?.chatState?.activeChannelId
  if (!channelId) return
  Modal.confirm({
    title: '删除消息',
    content: '确定要删除这条消息吗？',
    okText: '删除',
    cancelText: '取消',
    okButtonProps: { danger: true },
    onOk: async () => {
      const ok = await deleteChatMessageAction(channelId, payload.messageId)
      if (ok) {
        message.success('消息已删除')
      } else {
        message.error(activeTab.value?.chatState?.errorMessage || '删除消息失败')
      }
    }
  })
}

const handleFlagMessage = async (payload: { channelId?: number; messageId: number }) => {
  const channelId = payload.channelId || activeTab.value?.chatState?.activeChannelId
  if (!channelId) return
  const result = await flagChatMessageAction(channelId, payload.messageId)
  if (result) {
    message.success('举报已发送，感谢你的反馈')
  } else {
    message.error(activeTab.value?.chatState?.errorMessage || '举报失败')
  }
}

const handleChatSearch = async (
  query: string,
  resultsRef: { value: DiscourseUser[] },
  searchingRef: { value: boolean }
) => {
  const trimmed = query.trim()
  if (!trimmed) {
    resultsRef.value = []
    return
  }
  searchingRef.value = true
  try {
    const result = await searchChatables(trimmed)
    resultsRef.value = result?.users || []
  } catch (e) {
    message.error(e instanceof Error ? e.message : '搜索用户失败')
    resultsRef.value = []
  } finally {
    searchingRef.value = false
  }
}

const handleCreateGroupSearch = (query: string) => {
  void handleChatSearch(query, createGroupResults, createGroupSearching)
}

const handleManageSearch = (query: string) => {
  void handleChatSearch(query, manageSearchResults, manageSearching)
}

const handleDiscoverChatChannels = () => {
  void loadDiscoverableChannels()
}

const handleChatSidebarTabChange = (tab: 'threads' | 'starred' | 'public' | 'direct') => {
  if (activeTab.value?.chatState) {
    activeTab.value.chatState.chatSidebarTab = tab
  }
}

const handleJoinChatChannel = async (channelId: number, syncLocation = true) => {
  const joined = await joinChatChannel(channelId)
  if (joined) {
    openChatChannel(joined, syncLocation)
    message.success(`已加入「${joined.title || joined.chatable?.name || channelId}」`)
  } else {
    message.error(activeTab.value?.chatState?.errorMessage || '加入频道失败')
  }
}

const handleAddChatDirectUsers = async (payload: { channelId: number; usernames: string[] }) => {
  const ok = await addUsersToDirectMessageChannel(payload.channelId, payload.usernames)
  if (ok) {
    message.success('用户已添加到私聊')
  } else {
    message.error(activeTab.value?.chatState?.errorMessage || '添加用户失败')
  }
}

const handleCreateGroup = async (
  payload: { targetUsernames: string[]; name?: string },
  syncLocation = true
) => {
  if (chatDirectCreating.value) return
  chatDirectCreating.value = true
  try {
    const channel = await createDirectMessageChannel({
      targetUsernames: payload.targetUsernames,
      name: payload.name,
      upsert: true
    })
    if (channel) {
      message.success(payload.targetUsernames.length > 1 ? '群聊已创建' : '聊天已创建')
      openChatChannel(channel, syncLocation)
    } else {
      message.error(activeTab.value?.chatState?.errorMessage || '创建聊天频道失败')
    }
  } finally {
    chatDirectCreating.value = false
  }
}

const handleCreateChatChannel = async (payload: ChatCreateChannelPayload, syncLocation = true) => {
  if (chatPublicCreating.value) return
  chatPublicCreating.value = true
  try {
    const channel = await createChatChannel(payload)
    if (channel) {
      message.success('公开频道已创建')
      openChatChannel(channel, syncLocation)
    } else {
      message.error(activeTab.value?.chatState?.errorMessage || '创建公开频道失败')
    }
  } finally {
    chatPublicCreating.value = false
  }
}

const handleLoadChatMembers = async (channelId: number) => {
  await loadChatMembers(channelId, true)
}

const handleLoadMoreChatMembers = async (channelId: number) => {
  await loadMoreChatMembers(channelId)
}

const handleAddChatMembers = async (payload: { channelId: number; usernames: string[] }) => {
  const ok = await addChatMembers(payload.channelId, payload.usernames)
  if (ok) {
    message.success('成员已添加')
  } else {
    message.error(activeTab.value?.chatState?.errorMessage || '添加成员失败')
  }
}

const handleRemoveChatMember = async (payload: { channelId: number; userId: number }) => {
  Modal.confirm({
    title: '移除成员',
    content: '确定要移除该成员吗？',
    okText: '移除',
    cancelText: '取消',
    okButtonProps: { danger: true },
    onOk: async () => {
      const ok = await removeChatMember(payload.channelId, payload.userId)
      if (ok) {
        message.success('成员已移除')
      } else {
        message.error(activeTab.value?.chatState?.errorMessage || '移除成员失败')
      }
    }
  })
}

const handleFollowChatChannel = async (channelId: number) => {
  if (chatFollowSaving.value) return
  chatFollowSaving.value = true
  try {
    const ok = await followChatChannel(channelId)
    if (ok) {
      message.success('已关注频道')
    } else {
      message.error(activeTab.value?.chatState?.errorMessage || '关注频道失败')
    }
  } finally {
    chatFollowSaving.value = false
  }
}

const handleUnfollowChatChannel = async (channelId: number) => {
  if (chatFollowSaving.value) return
  chatFollowSaving.value = true
  try {
    const ok = await unfollowChatChannel(channelId)
    if (ok) {
      message.success('已取消关注频道')
    } else {
      message.error(activeTab.value?.chatState?.errorMessage || '取消关注失败')
    }
  } finally {
    chatFollowSaving.value = false
  }
}

const handleLeaveChatChannel = (channelId: number) => {
  const channel = activeTab.value?.chatState?.channels.find(c => c.id === channelId)
  Modal.confirm({
    title: '退出频道',
    content: `确定要退出「${channel?.title || channel?.chatable?.name || channelId}」吗？群组私信会将你从成员列表中移除。`,
    okText: '退出',
    cancelText: '取消',
    okButtonProps: { danger: true },
    onOk: async () => {
      if (chatLeavingChannel.value) return
      chatLeavingChannel.value = true
      try {
        const ok = await leaveChatChannel(channelId)
        if (ok) {
          message.success('已退出频道')
        } else {
          message.error(activeTab.value?.chatState?.errorMessage || '退出频道失败')
          throw new Error(activeTab.value?.chatState?.errorMessage || '退出频道失败')
        }
      } finally {
        chatLeavingChannel.value = false
      }
    }
  })
}

const handleDeleteChatChannel = async (channelId: number) => {
  const channel = activeTab.value?.chatState?.channels.find(c => c.id === channelId)
  Modal.confirm({
    title: '删除频道',
    content: `确定要删除频道「${channel?.title || channelId}」吗？此操作不可恢复。`,
    okText: '删除',
    cancelText: '取消',
    okButtonProps: { danger: true },
    onOk: async () => {
      if (chatDeletingChannel.value) return
      chatDeletingChannel.value = true
      try {
        const ok = await deleteChatChannel(channelId)
        if (ok) {
          message.success('频道已删除')
        } else {
          message.error(activeTab.value?.chatState?.errorMessage || '删除频道失败')
          throw new Error(activeTab.value?.chatState?.errorMessage || '删除频道失败')
        }
      } finally {
        chatDeletingChannel.value = false
      }
    }
  })
}

// Review queue handlers
const handleReviewSwitchStatus = async (status: ReviewStatus) => {
  const tab = activeTab.value
  if (!tab) return
  await loadReview(tab, status)
}

const handleReviewPerform = async (payload: {
  reviewableId: number
  version: number
  serverAction: string
  extra: Record<string, any>
}) => {
  const result = await performReviewAction(
    payload.reviewableId,
    payload.version,
    payload.serverAction,
    payload.extra
  )
  if (result?.success) {
    message.success('审核操作已完成')
  } else {
    message.error(activeTab.value?.reviewState?.errorMessage || '审核操作失败')
  }
}

const handleReviewUpdate = async (payload: {
  reviewableId: number
  version: number
  updates: Record<string, any>
}) => {
  const updated = await updateReviewableItem(payload.reviewableId, payload.version, payload.updates)
  if (updated) {
    message.success('审核项已更新')
  } else {
    message.error(activeTab.value?.reviewState?.errorMessage || '更新失败')
  }
}

const handleReviewDelete = async (payload: { reviewableId: number; version: number }) => {
  Modal.confirm({
    title: '删除审核项',
    content: '确定要删除该审核项吗？',
    okText: '删除',
    cancelText: '取消',
    okButtonProps: { danger: true },
    onOk: async () => {
      const ok = await deleteReviewableItem(payload.reviewableId, payload.version)
      if (ok) {
        message.success('审核项已删除')
      } else {
        message.error(activeTab.value?.reviewState?.errorMessage || '删除失败')
      }
    }
  })
}

const handleReviewLoadMore = () => {
  loadMoreReviewables()
}

// Invites handlers
const handleInvitesSwitchFilter = async (filter: 'pending' | 'redeemed' | 'expired') => {
  const tab = activeTab.value
  if (!tab) return
  await loadInvites(tab, filter)
}

const handleInvitesCreate = async (payload: Record<string, any>) => {
  const invite = await createInvite(payload)
  if (invite) {
    message.success('邀请已创建')
    if (invite.link) {
      try {
        await navigator.clipboard.writeText(invite.link)
        message.success('邀请链接已复制到剪贴板')
      } catch {
        // clipboard unavailable, ignore
      }
    }
  } else {
    message.error(activeTab.value?.invitesState?.errorMessage || '创建邀请失败')
  }
}

const handleInvitesDelete = async (inviteId: number) => {
  Modal.confirm({
    title: '删除邀请',
    content: '确定要删除该邀请吗？已生成的链接将失效。',
    okText: '删除',
    cancelText: '取消',
    okButtonProps: { danger: true },
    onOk: async () => {
      const ok = await deleteInvite(inviteId)
      if (ok) {
        message.success('邀请已删除')
      } else {
        message.error(activeTab.value?.invitesState?.errorMessage || '删除邀请失败')
      }
    }
  })
}

const handleInvitesResend = async (email: string) => {
  const ok = await resendInvite(email)
  if (ok) {
    message.success('邀请邮件已重发')
  } else {
    message.error(activeTab.value?.invitesState?.errorMessage || '重发邀请失败')
  }
}

const handleInvitesLoadMore = () => {
  loadMoreInvites()
}

// Private message management handlers
const handleMessagesCompose = (targetUsername = '') => {
  pmComposerOpen.value = true
  pmComposerTargets.value = targetUsername ? [targetUsername] : []
}

const handleMessagesMarkAllRead = async (topicIds: number[]) => {
  const ok = await markPrivateMessagesRead(topicIds)
  if (ok) {
    message.success('已全部标记为已读')
  } else {
    message.error('标记已读失败')
  }
}

const handleMessagesArchive = async (topicId: number) => {
  const ok = await archivePrivateMessage(topicId)
  if (ok) {
    message.success('已归档')
  } else {
    message.error('归档失败')
  }
}

const handleMessagesMoveToInbox = async (topicId: number) => {
  const ok = await movePrivateMessageToInbox(topicId)
  if (ok) {
    message.success('已移回收件箱')
  } else {
    message.error('移回收件箱失败')
  }
}

const handlePrivateMessagePosted = (data: any) => {
  pmComposerOpen.value = false
  message.success('私信已发送')
  const topicId = Number(data?.topic_id || data?.id || data?.topic?.id)
  if (!Number.isFinite(topicId) || topicId <= 0) return
  const slug = String(data?.topic_slug || data?.slug || data?.topic?.slug || 'private-message')
  const postNumber = Number(data?.post_number || data?.topic?.post_number || 0)
  navigateTo(`/t/${encodeURIComponent(slug)}/${topicId}${postNumber > 0 ? `/${postNumber}` : ''}`)
}

const handleChangeTopicListType = (type: TopicListType) => {
  changeTopicListType(type)
}

const handleNavigate = (path: string) => {
  navigateTo(path)
}

const handleUserMainTabSwitch = (tab: UserMainTab) => {
  if (!activeTab.value?.currentUser) return
  const username = activeTab.value.currentUser.username
  if (tab === 'summary') {
    openUser(username, true)
  } else if (tab === 'activity') {
    openUserActivity(username, true)
  } else if (tab === 'notifications') {
    navigateTo(`/u/${encodeURIComponent(username)}/notifications`, true, { silent: true })
  } else if (tab === 'messages') {
    openUserMessages(username, true)
  } else if (tab === 'invites') {
    navigateTo(`/u/${encodeURIComponent(username)}/invited`, true, { silent: true })
  } else if (tab === 'badges') {
    openUserBadges(username)
  } else if (tab === 'portfolio') {
    navigateTo(`/u/${encodeURIComponent(username)}/activity/portfolio`, true, { silent: true })
  } else if (tab === 'solved') {
    navigateTo(`/u/${encodeURIComponent(username)}/activity/solved`, true, { silent: true })
  } else if (tab === 'groups') {
    openUserGroups(username, true)
  } else if (tab === 'settings') {
    openUserPreferences(username, true)
  } else {
    openUserFollowFeed(username)
  }
}

const handleUserCardProfile = (username?: string) => {
  if (!username) return
  closeUserCard()
  openUser(username)
}

const handleUserCardMessage = (username?: string) => {
  if (!username) return
  closeUserCard()
  handleMessagesCompose(username)
}

const handleStartUserChat = async (username?: string) => {
  if (!username) return
  closeUserCard()
  await openFloatingChat()
  const channel = await createDirectMessageChannel({
    targetUsernames: [username],
    upsert: true
  })
  if (!channel) {
    message.error(activeTab.value?.chatState?.errorMessage || '无法创建私聊')
    return
  }
  // This entry point opens the floating chat from a user card. Keep the
  // currently viewed browser tab and its history untouched.
  openChatChannel(channel, false)
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

const handleApplyPendingTopics = () => {
  const tab = activeTab.value
  if (!tab) return
  applyPendingTopics(tab)
}

const handleOpenSearchResult = (path: string) => {
  if (!path) return
  navigateTo(path)
}

const handleSearch = (query: string, filters: DiscourseSearchFilters) => {
  searchDiscourse(query, filters)
}

const handleLoadMoreSearch = () => {
  loadMoreSearchResults()
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
  composerMode.value = composerMode.value === 'topic' ? null : 'topic'
}

const handleTopicPosted = (payload: any) => {
  composerMode.value = null
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
  composerMode.value = 'reply'
}

const handleToggleTopicSummaryMode = (isSummary: boolean) => {
  if (!activeTab.value) return
  activeTab.value.topicSummaryMode = isSummary
}

const handleReplyPosted = () => {
  composerMode.value = null
  replyTarget.value = null
  refresh()
}

const handleClearReply = () => {
  replyTarget.value = null
  if (composerMode.value === 'reply') {
    composerMode.value = null
  }
}

const handleEditPost = async (post: DiscoursePost) => {
  editTarget.value = post
  const existingRaw = (post as DiscoursePost & { raw?: string }).raw
  editInitialRaw.value = existingRaw || ''
  editOriginalRaw.value = existingRaw || ''
  composerMode.value = 'edit'

  if (existingRaw) return

  try {
    const result = await pageFetch<any>(`${baseUrl.value}/posts/${post.id}.json`)
    const data = extractData(result)
    const raw = data?.raw || data?.post?.raw || ''
    editInitialRaw.value = raw
    editOriginalRaw.value = raw
  } catch (error) {
    console.warn('[DiscourseBrowser] load edit raw failed:', error)
    message.error('获取原始内容失败')
  }
}

const handleEditPosted = (payload: any) => {
  const postPayload = payload?.post || payload
  if (editTarget.value && postPayload && typeof postPayload === 'object') {
    Object.assign(editTarget.value, postPayload)
  }
  editTarget.value = null
  editInitialRaw.value = ''
  editOriginalRaw.value = ''
  composerMode.value = null
}

const handleComposerClose = () => {
  if (composerMode.value === 'reply') {
    replyTarget.value = null
  }
  if (composerMode.value === 'edit') {
    editTarget.value = null
    editInitialRaw.value = ''
    editOriginalRaw.value = ''
  }
  composerMode.value = null
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

const floatingChatStyle = computed(() => {
  const state = floatingChatState.value
  const style: Record<string, string> = {}
  const positioned = state.left !== null && state.top !== null
  if (positioned) {
    style.left = `${state.left}px`
    style.top = `${state.top}px`
    style.right = 'auto'
    style.bottom = 'auto'
  }
  // Only pin width/height once the user moved or resized the window, and
  // never while minimized (the .is-minimized styles must keep control).
  if (!floatingChatMinimized.value && (positioned || state.resized)) {
    style.width = `${state.width}px`
    style.height = `${state.height}px`
  }
  return style
})

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

const normalizeImageUrl = (img: HTMLImageElement) => {
  const rawSrc = img.getAttribute('src') || ''
  if (rawSrc.startsWith('data:') || rawSrc.startsWith('blob:')) return rawSrc
  if (rawSrc) {
    return resolveDiscourseHttpUrl(rawSrc, baseUrl.value || window.location.href) || rawSrc
  }

  return img.currentSrc || img.src || ''
}

const isProxyableImageUrl = (url: string) => {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

const blobFromProxyImageResponse = (response: any): Blob | null => {
  if (!response?.success) return null
  const bytes = Array.isArray(response.data)
    ? response.data
    : Array.isArray(response.data?.arrayData)
      ? response.data.arrayData
      : null
  if (!bytes?.length) return null
  return new Blob([Uint8Array.from(bytes)], {
    type: response.mimeType || response.data?.mimeType || 'application/octet-stream'
  })
}

const requestDedicatedImageProxy = async (
  url: string
): Promise<{ supported: boolean; blob: Blob | null }> => {
  const chromeAPI = (globalThis as any).chrome
  if (!chromeAPI?.runtime?.sendMessage) return { supported: false, blob: null }

  return await new Promise(resolve => {
    let settled = false
    const finish = (value: { supported: boolean; blob: Blob | null }) => {
      if (settled) return
      settled = true
      globalThis.clearTimeout(timeoutId)
      resolve(value)
    }
    const timeoutId = globalThis.setTimeout(() => finish({ supported: false, blob: null }), 12_000)

    try {
      chromeAPI.runtime.sendMessage({ type: 'PROXY_IMAGE', url }, (response: any) => {
        if (chromeAPI.runtime.lastError || !response) {
          finish({ supported: false, blob: null })
          return
        }
        finish({ supported: true, blob: blobFromProxyImageResponse(response) })
      })
    } catch {
      finish({ supported: false, blob: null })
    }
  })
}

const requestImageFallback = (url: string): Promise<Blob | null> => {
  const existing = proxyImageRequests.get(url)
  if (existing) return existing

  const request = (async () => {
    const dedicated = await requestDedicatedImageProxy(url)
    if (dedicated.supported) return dedicated.blob

    // Compatibility fallback for an older background worker which does not
    // yet understand PROXY_IMAGE. This still runs only after native loading
    // has failed.
    try {
      const result = await pageFetch<Blob>(url, undefined, 'blob')
      return result.ok ? result.data : null
    } catch {
      return null
    }
  })().finally(() => proxyImageRequests.delete(url))

  proxyImageRequests.set(url, request)
  return request
}

const handleGlobalImageLoad = (event: Event) => {
  const target = event.target
  if (!(target instanceof HTMLImageElement)) return
  attemptedImageSources.delete(target)

  const previousBlobUrl = proxiedImageBlobUrls.get(target)
  if (previousBlobUrl && target.src !== previousBlobUrl) {
    URL.revokeObjectURL(previousBlobUrl)
    proxiedBlobUrls.delete(previousBlobUrl)
    proxiedImageBlobUrls.delete(target)
  }
  if (!previousBlobUrl || target.src !== previousBlobUrl) {
    target.removeAttribute('data-discourse-image-source')
  }
}

const handleGlobalImageError = (event: Event) => {
  const target = event.target
  if (!(target instanceof HTMLImageElement)) return

  const imageUrl = normalizeImageUrl(target)
  if (!imageUrl || !isProxyableImageUrl(imageUrl)) return
  if (attemptedImageSources.get(target) === imageUrl) return
  if (proxyingImages.get(target) === imageUrl) return

  // Delay component-level broken-image placeholders until the authenticated
  // fallback has had a chance to recover the original resource.
  event.stopImmediatePropagation()
  attemptedImageSources.set(target, imageUrl)
  proxyingImages.set(target, imageUrl)
  target.dataset.discourseImageSource = 'proxy-loading'

  void (async () => {
    try {
      const blob = await requestImageFallback(imageUrl)
      if (!target.isConnected || normalizeImageUrl(target) !== imageUrl) return
      if (!blob) {
        target.dataset.discourseImageSource = 'failed'
        target.dispatchEvent(new Event('error'))
        return
      }

      const previousBlobUrl = proxiedImageBlobUrls.get(target)
      if (previousBlobUrl) {
        URL.revokeObjectURL(previousBlobUrl)
        proxiedBlobUrls.delete(previousBlobUrl)
      }
      const blobUrl = URL.createObjectURL(blob)
      proxiedBlobUrls.add(blobUrl)
      proxiedImageBlobUrls.set(target, blobUrl)
      target.dataset.discourseImageSource = 'proxy'
      target.src = blobUrl
    } finally {
      if (proxyingImages.get(target) === imageUrl) {
        proxyingImages.delete(target)
      }
    }
  })()
}

const startDrag = (event: MouseEvent | TouchEvent) => {
  const point = 'touches' in event ? event.touches[0] : event
  if (!point) return
  const state = floatingState.value
  state.dragging = true
  state.startX = point.clientX
  state.startY = point.clientY
  const rect = (event.currentTarget as HTMLElement | null)
    ?.closest('.floating-composer')
    ?.getBoundingClientRect()
  if (rect) {
    state.startLeft = rect.left
    state.startTop = rect.top
  } else {
    state.startLeft = state.left ?? window.innerWidth - state.width - 20
    state.startTop = state.top ?? window.innerHeight - state.height - 24
  }
}

const startChatDrag = (event: MouseEvent | TouchEvent) => {
  // Window action buttons (minimize / expand / close) must keep working.
  if ((event.target as HTMLElement | null)?.closest('.floating-chat__window-actions')) return
  const point = 'touches' in event ? event.touches[0] : event
  if (!point) return
  const state = floatingChatState.value
  const rect = (event.currentTarget as HTMLElement | null)
    ?.closest('.floating-chat')
    ?.getBoundingClientRect()
  if (!rect) return
  state.dragging = true
  state.startX = point.clientX
  state.startY = point.clientY
  state.startLeft = rect.left
  state.startTop = rect.top
  // Clamp against the rect actually being dragged, and only remember the
  // size when expanded so a minimized drag never shrinks the window.
  state.startWidth = Math.round(rect.width)
  state.startHeight = Math.round(rect.height)
  if (!floatingChatMinimized.value) {
    state.width = Math.round(rect.width)
    state.height = Math.round(rect.height)
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

const startChatResize = (event: MouseEvent | TouchEvent) => {
  const point = 'touches' in event ? event.touches[0] : event
  if (!point) return
  const state = floatingChatState.value
  state.resizing = true
  state.resized = true
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
  const chatState = floatingChatState.value
  if (chatState.dragging) {
    const dx = point.clientX - chatState.startX
    const dy = point.clientY - chatState.startY
    const nextLeft = chatState.startLeft + dx
    const nextTop = chatState.startTop + dy
    const maxLeft = window.innerWidth - chatState.startWidth - 8
    const maxTop = window.innerHeight - chatState.startHeight - 8
    chatState.left = clamp(nextLeft, 8, Math.max(8, maxLeft))
    chatState.top = clamp(nextTop, 8, Math.max(8, maxTop))
  }
  if (chatState.resizing) {
    const dw = point.clientX - chatState.startX
    const dh = point.clientY - chatState.startY
    chatState.width = clamp(chatState.startWidth + dw, 360, window.innerWidth - 24)
    chatState.height = clamp(chatState.startHeight + dh, 420, window.innerHeight - 24)
  }
}

const stopPointer = () => {
  const state = floatingState.value
  state.dragging = false
  state.resizing = false
  const chatState = floatingChatState.value
  chatState.dragging = false
  chatState.resizing = false
}

// Handle messages tab switch
const handleMessagesTabSwitch = (tab: MessagesTabType) => {
  switchMessagesTab(tab)
}

const handleSearchMessages = (query: string) => {
  searchMessages(query)
}

const waitFor = (ms: number) =>
  new Promise<void>(resolve => {
    window.setTimeout(resolve, ms)
  })

function runSerialMessageBusRefresh(task: () => Promise<void>, label: string) {
  const next = messageBusRefreshChain.then(async () => {
    try {
      await task()
    } catch (error) {
      console.warn(`[DiscourseBrowser] ${label} refresh via message_bus failed:`, error)
    }
  })

  messageBusRefreshChain = next.then(
    () => undefined,
    () => undefined
  )

  return next
}

function createCoalescedMessageBusRefresh(
  cooldownMs: number,
  task: () => Promise<void>,
  label: string
) {
  let running = false
  let queued = false
  let lastRunAt = 0

  return () => {
    queued = true
    if (running) return
    running = true

    void (async () => {
      try {
        while (queued) {
          queued = false
          const waitMs = cooldownMs - (Date.now() - lastRunAt)
          if (waitMs > 0) {
            await waitFor(waitMs)
          }
          await runSerialMessageBusRefresh(task, label)
          lastRunAt = Date.now()
        }
      } finally {
        running = false
      }
    })()
  }
}

const triggerTopicRefresh = createCoalescedMessageBusRefresh(
  MESSAGE_BUS_TOPIC_REFRESH_COOLDOWN_MS,
  async () => {
    const tab = activeTab.value
    if (!tab || tab.loading || tab.viewType !== 'topic' || !tab.currentTopic) return
    await pollTopicUpdates(tab)
  },
  'topic'
)

const triggerListRefresh = createCoalescedMessageBusRefresh(
  MESSAGE_BUS_LIST_REFRESH_COOLDOWN_MS,
  async () => {
    const tab = activeTab.value
    if (!tab || tab.loading) return
    if (!['home', 'category', 'tag'].includes(tab.viewType)) return
    await checkTopicListUpdates(tab)
  },
  'topic list'
)

const triggerNotificationsRefresh = createCoalescedMessageBusRefresh(
  MESSAGE_BUS_NOTIFICATIONS_REFRESH_COOLDOWN_MS,
  async () => {
    const tab = activeTab.value
    if (!tab || tab.loading) return
    await loadNotifications(tab, tab.notificationsFilter)
  },
  'notifications'
)

const handleTopicChannelMessage: MessageBusCallback = dispatchMessageBusMessage

const handleListChannelMessage: MessageBusCallback = dispatchMessageBusMessage

const handleNotificationChannelMessage: MessageBusCallback = dispatchMessageBusMessage

const handleUnreadNotificationChannelMessage: MessageBusCallback = dispatchMessageBusMessage

function dispatchMessageBusMessage(payload: unknown, channel: string, _messageId: number | null) {
  const tab = activeTab.value
  if (!tab || tab.loading) return

  const category = messageBusCategory(channel)

  if (category === 'topic') {
    const topicId = extractTopicIdFromChannel(channel)
    const topicPayload = (payload || {}) as MessageBusTopicPayload

    // Handle boost real-time updates (boost_added / boost_removed)
    if (
      tab.currentTopic &&
      topicId &&
      tab.currentTopic.id === topicId &&
      typeof topicPayload.type === 'string' &&
      topicPayload.type.startsWith('boost_')
    ) {
      const postId = Number(topicPayload.id)
      const post = tab.currentTopic.post_stream.posts.find(p => p.id === postId)
      if (post) {
        const postAny = post as any
        const boosts = Array.isArray(postAny.boosts) ? [...postAny.boosts] : []
        if (topicPayload.type === 'boost_added' && topicPayload.boost) {
          boosts.push(topicPayload.boost)
          postAny.boosts = boosts
          postAny.can_boost = false
        } else if (topicPayload.type === 'boost_removed' && topicPayload.boost_id) {
          const removedId = Number(topicPayload.boost_id)
          postAny.boosts = boosts.filter((b: any) => b.id !== removedId)
          postAny.can_boost = true
        }
      }
      return
    }

    if (
      tab.viewType === 'topic' &&
      tab.currentTopic &&
      topicId &&
      tab.currentTopic.id === topicId
    ) {
      void runSerialMessageBusRefresh(async () => {
        const patched = await patchTopicFromMessageBus(tab, topicId, topicPayload.post_number)
        if (!patched) {
          await pollTopicUpdates(tab)
        }
      }, 'topic patch')
      return
    }
    triggerTopicRefresh()
    return
  }

  if (category === 'list') {
    const listPayload = (payload || {}) as MessageBusTopicListPayload
    const patched = patchTopicListFromMessageBus(tab, listPayload)
    if (!patched) {
      triggerListRefresh()
    }
    return
  }

  if (category === 'notifications') {
    const notificationPayload = (payload || {}) as MessageBusNotificationPayload
    const patched = patchNotificationsFromMessageBus(tab, notificationPayload)
    if (!patched) {
      triggerNotificationsRefresh()
    }
    return
  }

  if (category === 'chat') {
    const chatPayload = (payload || {}) as MessageBusChatPayload
    const channelId = Number(
      chatPayload.chat_channel_id ||
        chatPayload.channel_id ||
        extractChatChannelIdFromChannel(channel)
    )

    if (!Number.isFinite(channelId) || channelId <= 0) {
      return
    }

    if ((tab.viewType === 'chat' || floatingChatOpen.value) && tab.chatState) {
      void runSerialMessageBusRefresh(async () => {
        const patched = await patchChatFromMessageBus(tab, channelId, chatPayload, channel)
        if (!patched) {
          await loadMoreChatMessagesForChannel(channelId)
        }
      }, 'chat patch')
    }
    return
  }

  if (channel.startsWith('/notification/') || channel.startsWith('/unread/')) {
    triggerNotificationsRefresh()
  }
}

const messageBusDesiredSubscriptions = computed(() => {
  const subscriptions = new Map<string, MessageBusSubscriptionSpec>()
  const tab = activeTab.value

  if (tab?.viewType === 'topic' && tab.currentTopic?.id) {
    subscriptions.set(`/topic/${tab.currentTopic.id}`, {
      channel: `/topic/${tab.currentTopic.id}`,
      callback: handleTopicChannelMessage
    })
  }

  if (shouldSubscribeListChannel('/latest')) {
    subscriptions.set('/latest', {
      channel: '/latest',
      callback: handleListChannelMessage
    })
  }

  if (shouldSubscribeListChannel('/new')) {
    subscriptions.set('/new', {
      channel: '/new',
      callback: handleListChannelMessage
    })
  }

  if (shouldSubscribeListChannel('/unread')) {
    subscriptions.set('/unread', {
      channel: '/unread',
      callback: handleListChannelMessage
    })
  }

  if (messageBusUserId.value) {
    subscriptions.set(`/notification/${messageBusUserId.value}`, {
      channel: `/notification/${messageBusUserId.value}`,
      callback: handleNotificationChannelMessage
    })
    subscriptions.set(`/unread/${messageBusUserId.value}`, {
      channel: `/unread/${messageBusUserId.value}`,
      callback: handleUnreadNotificationChannelMessage
    })
  }

  if ((tab?.viewType === 'chat' || floatingChatOpen.value) && tab?.chatState?.activeChannelId) {
    const channelId = tab.chatState.activeChannelId
    subscriptions.set(`/chat/${channelId}`, {
      channel: `/chat/${channelId}`,
      callback: dispatchMessageBusMessage
    })
    subscriptions.set(`/chat/${channelId}/new-messages`, {
      channel: `/chat/${channelId}/new-messages`,
      callback: dispatchMessageBusMessage
    })
  }

  return Array.from(subscriptions.values())
})

const messageBusDesiredSubscriptionsKey = computed(() =>
  messageBusDesiredSubscriptions.value
    .map(subscription => subscription.channel)
    .sort()
    .join('|')
)

function syncMessageBusSubscriptions() {
  messageBus.replaceSubscriptions(messageBusDesiredSubscriptions.value, -1)
}

function clearMessageBusSubscriptions() {
  messageBus.clearSubscriptions()
}

const handleDocumentVisibilityChange = () => {
  if (typeof document === 'undefined') return

  if (document.hidden) {
    messageBus.pause()
    return
  }

  messageBus.resume()
  syncMessageBusSubscriptions()
}

async function ensureMessageBusUserId() {
  const username = currentUsername.value?.trim() || ''
  if (!username) {
    messageBusUserId.value = null
    messageBusUserIdFor = ''
    return
  }

  const cacheKey = `${baseUrl.value}|${username}`
  const now = Date.now()
  const cached = messageBusUserIdCache.get(cacheKey)
  if (cached && cached.expiresAt > now) {
    messageBusUserId.value = cached.userId
    messageBusUserIdFor = cached.userId ? username : ''
    return
  }

  if (messageBusUserId.value && messageBusUserIdFor === username) {
    return
  }

  if (messageBusUserIdPromise) {
    return messageBusUserIdPromise
  }

  const requestUsername = username
  const requestBaseUrl = baseUrl.value
  const requestCacheKey = cacheKey
  messageBusUserIdPromise = (async () => {
    let resolvedUserId: number | null = null
    let cacheTtlMs = MESSAGE_BUS_USER_ID_CACHE_TTL_MS
    try {
      const result = await pageFetch<any>(
        `${requestBaseUrl}/u/${encodeURIComponent(requestUsername)}.json`
      )
      const data = extractData(result)
      const userId = Number(data?.user?.id)
      if (Number.isFinite(userId) && userId > 0) {
        resolvedUserId = userId
      }
    } catch (error) {
      console.warn('[DiscourseBrowser] resolve message_bus user id failed:', error)
      cacheTtlMs = MESSAGE_BUS_USER_ID_ERROR_CACHE_TTL_MS
    } finally {
      messageBusUserIdCache.set(requestCacheKey, {
        expiresAt: Date.now() + cacheTtlMs,
        userId: resolvedUserId
      })

      if (currentUsername.value?.trim() === requestUsername && baseUrl.value === requestBaseUrl) {
        messageBusUserId.value = resolvedUserId
        messageBusUserIdFor = resolvedUserId ? requestUsername : ''
      }

      messageBusUserIdPromise = null
    }
  })()

  return messageBusUserIdPromise
}

watch(
  () => messageBusDesiredSubscriptionsKey.value,
  () => {
    syncMessageBusSubscriptions()
  },
  { immediate: true }
)

watch(
  () => [
    activeTab.value?.id,
    activeTab.value?.viewType,
    activeTab.value?.chatState?.activeChannelId,
    floatingChatOpen.value
  ],
  () => {
    syncMessageBusSubscriptions()
  }
)

watch(
  () => [floatingChatOpen.value, activeTab.value?.id, baseUrl.value] as const,
  ([open]) => {
    if (open) void openFloatingChat()
  }
)

watch(
  () => quickSidebarOpen.value,
  open => {
    if (open) {
      void loadQuickSidebar()
    }
  }
)

watch(
  () => [baseUrl.value, currentUsername.value],
  () => {
    quickSidebarFetchedAt.value = 0
    notificationPreferences.value = null
    notificationPreferencesKey.value = ''
    if (quickSidebarOpen.value) {
      void loadQuickSidebar(true)
    }
    void syncCategoryNotificationLevel()
    void syncTagNotificationLevel()

    messageBusUserId.value = null
    messageBusUserIdFor = ''
    messageBus.reset()
    void ensureMessageBusUserId().finally(() => {
      syncMessageBusSubscriptions()
    })
  }
)

watch(
  () => [activeTab.value?.viewType, activeTab.value?.currentCategoryId],
  () => {
    void syncCategoryNotificationLevel()
  }
)

watch(
  () => [activeTab.value?.viewType, activeTab.value?.currentTagName],
  () => {
    void syncTagNotificationLevel()
  }
)

// Initialize
onMounted(() => {
  unsubscribePageFetchActivity = subscribePageFetchActivity(activity => {
    pageFetchActivity.value = activity
  })
  ensureSessionUser()
  createTab()
  nextTick(() => {
    if (contentAreaRef.value) {
      contentAreaRef.value.addEventListener('scroll', handleScrollRaf, { passive: true })
    }
  })
  window.addEventListener('mousemove', handlePointerMove)
  window.addEventListener('mouseup', stopPointer)
  window.addEventListener('touchmove', handlePointerMove, { passive: true })
  window.addEventListener('touchend', stopPointer)
  window.addEventListener('error', handleGlobalImageError, true)
  window.addEventListener('load', handleGlobalImageLoad, true)
  window.addEventListener('click', handleUserCardClick, true)
  document.addEventListener('visibilitychange', handleDocumentVisibilityChange)
  messageBus.start()
  handleDocumentVisibilityChange()
  void ensureMessageBusUserId().finally(() => {
    syncMessageBusSubscriptions()
  })
})

onUnmounted(() => {
  unsubscribePageFetchActivity?.()
  unsubscribePageFetchActivity = null
  clearMessageBusSubscriptions()
  messageBus.stop()
  if (contentAreaRef.value) {
    contentAreaRef.value.removeEventListener('scroll', handleScrollRaf)
  }
  if (scrollRafId !== null) {
    cancelAnimationFrame(scrollRafId)
    scrollRafId = null
  }
  if (scrollRestoreRafId !== null) {
    cancelAnimationFrame(scrollRestoreRafId)
    scrollRestoreRafId = null
  }
  window.removeEventListener('mousemove', handlePointerMove)
  window.removeEventListener('mouseup', stopPointer)
  window.removeEventListener('touchmove', handlePointerMove)
  window.removeEventListener('touchend', stopPointer)
  window.removeEventListener('error', handleGlobalImageError, true)
  window.removeEventListener('load', handleGlobalImageLoad, true)
  window.removeEventListener('click', handleUserCardClick, true)
  document.removeEventListener('visibilitychange', handleDocumentVisibilityChange)
  proxiedBlobUrls.forEach(url => URL.revokeObjectURL(url))
  proxiedBlobUrls.clear()
})
</script>

<template>
  <Icon :baseUrl="baseUrl" />
  <div
    class="discourse-browser flex flex-col h-full min-h-0 overflow-hidden"
    @contextmenu="handleBrowserContextMenu"
  >
    <!-- Toolbar -->
    <BrowserToolbar
      v-model="urlInput"
      :activeTab="activeTab || null"
      @goBack="goBack"
      @goForward="goForward"
      @refresh="refresh"
      @goHome="goHome"
      @updateBaseUrl="updateBaseUrl"
      @toggleQuickSidebar="toggleQuickSidebar"
    >
      <template #right>
        <button
          type="button"
          class="toolbar-icon-button floating-chat-trigger"
          :class="{ 'is-active': floatingChatOpen }"
          :aria-pressed="floatingChatOpen"
          aria-label="打开聊天悬浮窗"
          title="聊天悬浮窗"
          @click="toggleFloatingChat"
        >
          <MessageOutlined />
          <span v-if="floatingChatUnreadCount > 0" class="floating-chat-trigger__badge">
            {{ floatingChatUnreadCount > 99 ? '99+' : floatingChatUnreadCount }}
          </span>
        </button>
        <NotificationsDropdown
          :notifications="activeTab?.notifications || []"
          :filter="activeTab?.notificationsFilter || 'all'"
          :unreadCount="unreadNotificationsCount"
          :open="notificationsOpen"
          :loading="notificationsLoading"
          :baseUrl="baseUrl"
          :currentUsername="currentUsername || ''"
          @openChange="handleNotificationsOpenChange"
          @refresh="handleRefreshNotifications"
          @openAll="handleOpenNotifications"
          @open="handleOpenNotification"
          @changeFilter="handleNotificationFilterChange"
        />
      </template>
    </BrowserToolbar>

    <!-- Tab bar -->
    <BrowserTabs
      :tabs="tabs"
      :activeTabId="activeTabId"
      @switchTab="switchTab"
      @closeTab="closeTab"
      @createTab="createTab"
    />

    <QuickSidebarPanel
      :open="quickSidebarOpen"
      :loading="quickSidebarLoading"
      :sections="quickSidebarSections"
      :error="quickSidebarError ?? undefined"
      @close="closeQuickSidebar"
      @navigate="navigateQuickSidebar"
      @refresh="() => loadQuickSidebar(true)"
    />

    <!-- Content area -->
    <div
      ref="contentAreaRef"
      class="content-area discourse-main flex-1 overflow-y-auto discourse-body"
      :aria-busy="activeTab?.loading || activeTab?.userSectionLoading || isLoadingMore || undefined"
    >
      <div
        v-if="isLoadingMore && !activeTab?.loading"
        class="browser-load-more-progress"
        role="status"
        aria-live="polite"
      >
        <a-spin size="small" />
        <div class="browser-load-more-progress__copy">
          <span>正在加载更多内容</span>
          <small v-if="pageRequestProgress.total > 0">
            请求 {{ pageRequestProgress.completed }} / {{ pageRequestProgress.total }} · 处理
            {{ pageRequestProgress.active }} · 排队 {{ pageRequestProgress.queued }}
          </small>
          <small v-else>正在准备请求…</small>
        </div>
        <div class="browser-load-more-progress__track" aria-hidden="true">
          <span :style="{ width: `${pageRequestProgress.percent}%` }" />
        </div>
      </div>

      <!-- Profile sub-tabs retain the surrounding shell and refresh only their content. -->
      <div
        v-if="activeTab?.userSectionLoading && !activeTab?.loading"
        class="user-section-refresh"
        role="status"
        aria-live="polite"
      >
        <a-spin size="small" />
        <span>正在刷新此栏目…</span>
      </div>

      <!-- Loading -->
      <div v-if="activeTab?.loading" class="browser-state browser-state--loading" role="status">
        <div class="browser-state__indicator"><a-spin size="large" /></div>
        <div class="browser-state__copy">
          <div class="browser-state__title">正在打开页面</div>
          <div class="browser-state__description">正在从论坛同步最新内容…</div>
          <div class="browser-state__progress" aria-live="polite">
            <div class="browser-state__progress-track" aria-hidden="true">
              <span :style="{ width: `${pageRequestProgress.percent}%` }" />
            </div>
            <span v-if="pageRequestProgress.total > 0">
              请求 {{ pageRequestProgress.completed }} / {{ pageRequestProgress.total }}，正在处理
              {{ pageRequestProgress.active }} 个，排队 {{ pageRequestProgress.queued }} 个
            </span>
            <span v-else>正在准备请求…</span>
          </div>
        </div>
      </div>

      <!-- Error page -->
      <div
        v-else-if="activeTab?.viewType === 'error'"
        class="browser-state browser-state--error"
        role="alert"
      >
        <div class="browser-state__icon" aria-hidden="true"><WarningOutlined /></div>
        <div class="browser-state__copy">
          <div class="browser-state__title">页面暂时无法打开</div>
          <div class="browser-state__description">{{ activeTab.errorMessage }}</div>
        </div>
        <button type="button" class="browser-state__action" @click="refresh">重新加载</button>
      </div>

      <HomeView
        v-else-if="activeTab?.viewType === 'home' && activeTab"
        :activeTab="activeTab"
        :baseUrl="baseUrl"
        :sortedTopics="sortedTopics"
        :homeNavItems="homeNavItems"
        :isHomeNavActive="isHomeNavActive"
        :topicSortKey="topicSortKey"
        :topicSortOrder="topicSortOrder"
        :isLoadingMore="isLoadingMore"
        :currentUsername="currentUsername ?? null"
        :composerMode="composerMode"
        @homeNavClick="handleHomeNavClick"
        @openChat="handleOpenChat"
        @openMyProfile="handleOpenMyProfile"
        @toggleComposer="toggleTopicComposer"
        @applyPendingTopics="handleApplyPendingTopics"
        @topicSort="handleTopicSort"
        @topicClick="handleTopicClick"
        @topicMiddleClick="handleMiddleClick"
        @openUser="handleUserClick"
        @openTag="handleOpenTopicTag"
        @categoryClick="handleCategoryClick"
        @changeTopicListType="handleChangeTopicListType"
        @navigate="handleNavigate"
      />

      <CategoriesView
        v-else-if="activeTab?.viewType === 'categories' && activeTab"
        :activeTab="activeTab"
        :baseUrl="baseUrl"
        @categoryClick="handleCategoryClick"
        @topicClick="handleTopicClick"
        @openUser="handleUserClick"
        @changeTopicListType="handleChangeTopicListType"
        @navigate="handleNavigate"
      />

      <TagsView
        v-else-if="activeTab?.viewType === 'tags' && activeTab"
        :activeTab="activeTab"
        :baseUrl="baseUrl"
        @tagClick="handleTagClick"
        @categoryClick="handleCategoryClick"
        @openUser="handleUserClick"
        @changeTopicListType="handleChangeTopicListType"
        @navigate="handleNavigate"
      />

      <NotificationsPanel
        v-else-if="activeTab?.viewType === 'notifications' && activeTab"
        :activeTab="activeTab"
        :baseUrl="baseUrl"
        :currentUsername="currentUsername || ''"
        @changeFilter="handleNotificationFilterChange"
        @openNotification="handleOpenNotification"
        @categoryClick="handleCategoryClick"
        @openUser="handleUserClick"
        @changeTopicListType="handleChangeTopicListType"
        @navigate="handleNavigate"
      />

      <TagTopicsView
        v-else-if="activeTab?.viewType === 'tag' && activeTab"
        :activeTab="activeTab"
        :baseUrl="baseUrl"
        :sortedTopics="sortedTopics"
        :topicSortKey="topicSortKey"
        :topicSortOrder="topicSortOrder"
        :isLoadingMore="isLoadingMore"
        :notificationLevel="tagNotificationLevel"
        :notificationSaving="tagNotificationSaving"
        @changeNotificationLevel="handleTagNotificationLevelChange"
        @applyPendingTopics="handleApplyPendingTopics"
        @topicSort="handleTopicSort"
        @topicClick="handleTopicClick"
        @topicMiddleClick="handleMiddleClick"
        @openUser="handleUserClick"
        @openTag="handleOpenTopicTag"
        @categoryClick="handleCategoryClick"
        @changeTopicListType="handleChangeTopicListType"
        @navigate="handleNavigate"
      />

      <CategoryTopicsView
        v-else-if="activeTab?.viewType === 'category' && activeTab"
        :activeTab="activeTab"
        :baseUrl="baseUrl"
        :sortedTopics="sortedTopics"
        :topicSortKey="topicSortKey"
        :topicSortOrder="topicSortOrder"
        :isLoadingMore="isLoadingMore"
        :composerMode="composerMode"
        :notificationLevel="categoryNotificationLevel"
        :notificationSaving="categoryNotificationSaving"
        @toggleComposer="toggleTopicComposer"
        @changeNotificationLevel="handleCategoryNotificationLevelChange"
        @applyPendingTopics="handleApplyPendingTopics"
        @topicSort="handleTopicSort"
        @topicClick="handleTopicClick"
        @topicMiddleClick="handleMiddleClick"
        @openUser="handleUserClick"
        @openTag="handleOpenTopicTag"
        @categoryClick="handleCategoryClick"
        @changeTopicListType="handleChangeTopicListType"
        @navigate="handleNavigate"
      />

      <!-- Discourse AI Bot conversations -->
      <AiBotConversationsView
        v-else-if="activeTab?.viewType === 'ai-bot' && activeTab"
        :baseUrl="baseUrl"
        @navigate="handleNavigate"
      />

      <!-- Chat view -->
      <ChatView
        v-else-if="activeTab?.viewType === 'chat' && activeTab.chatState"
        :chatState="activeTab.chatState"
        :baseUrl="baseUrl"
        :currentUsername="currentUsername ?? undefined"
        :currentUserStaff="currentUserStaff"
        :users="users"
        :categories="activeTab.categories"
        :createGroupSearching="createGroupSearching"
        :createGroupResults="createGroupResults"
        :creatingGroup="chatDirectCreating"
        :creatingChannel="chatPublicCreating"
        :manageSearching="manageSearching"
        :manageSearchResults="manageSearchResults"
        :savingChannel="chatChannelSaving"
        :savingMembership="chatMembershipSaving"
        :savingStatus="chatStatusSaving"
        :savingFollow="chatFollowSaving"
        :leavingChannel="chatLeavingChannel"
        :deletingChannel="chatDeletingChannel"
        @selectChannel="handleSelectChatChannel"
        @loadMore="handleLoadMoreChatMessages"
        @openThread="handleOpenChatThread"
        @selectThread="handleSelectChatThread"
        @closeThread="handleCloseChatThread"
        @loadMoreThread="handleLoadMoreChatThreadMessages"
        @loadMyThreads="handleLoadMyChatThreads"
        @loadMoreMyThreads="handleLoadMoreMyChatThreads"
        @loadChannelThreads="handleLoadChatChannelThreads"
        @loadMoreChannelThreads="handleLoadMoreChatChannelThreads"
        @searchMessages="handleSearchChatMessages"
        @loadMoreSearch="handleLoadMoreChatSearch"
        @updateThreadNotification="handleUpdateChatThreadNotification"
        @updateThreadTitle="handleUpdateChatThreadTitle"
        @sendMessage="handleSendChatMessage"
        @sendThreadMessage="handleSendChatThreadMessage"
        @react="handleReactChatMessage"
        @editChannel="handleEditChatChannel"
        @interact="handleChatMessageInteraction"
        @navigate="handleContentNavigation"
        @replyToMessage="handleReplyToMessage"
        @replyToThreadMessage="handleReplyToThreadMessage"
        @cancelReply="cancelChatReply"
        @cancelThreadReply="cancelChatThreadReply"
        @editMessage="handleEditMessage"
        @editThreadMessage="handleEditThreadMessage"
        @cancelEdit="cancelChatEdit"
        @cancelThreadEdit="cancelChatThreadEdit"
        @deleteMessage="handleDeleteMessage"
        @flagMessage="handleFlagMessage"
        @createGroup="handleCreateGroup"
        @createChannel="handleCreateChatChannel"
        @createGroupSearch="handleCreateGroupSearch"
        @loadMembers="handleLoadChatMembers"
        @loadMoreMembers="handleLoadMoreChatMembers"
        @addMembers="handleAddChatMembers"
        @removeMember="handleRemoveChatMember"
        @followChannel="handleFollowChatChannel"
        @unfollowChannel="handleUnfollowChatChannel"
        @updateMembership="handleUpdateChatMembership"
        @updateStatus="handleUpdateChatStatus"
        @leaveChannel="handleLeaveChatChannel"
        @deleteChannel="handleDeleteChatChannel"
        @manageSearch="handleManageSearch"
        :discoverChannels="activeTab.chatState.discoverableChannels"
        :discoverLoading="activeTab.chatState.discoverLoading"
        :discoverErrorMessage="activeTab.chatState.discoverErrorMessage"
        :joiningChannelIds="activeTab.chatState.joiningChannelIds"
        @discoverChannels="handleDiscoverChatChannels"
        @joinChannel="handleJoinChatChannel"
        @addDirectUsers="handleAddChatDirectUsers"
        @sidebarTab="handleChatSidebarTabChange"
      />

      <!-- Topic detail view -->
      <TopicView
        v-else-if="activeTab?.viewType === 'topic' && activeTab.currentTopic"
        :topic="activeTab.currentTopic"
        :baseUrl="baseUrl"
        :isLoadingMore="isLoadingMore"
        :hasMorePosts="activeTab.hasMorePosts"
        :targetPostNumber="activeTab.targetPostNumber"
        :currentUser="activeTab.currentUser"
        :currentUsername="currentUsername ?? undefined"
        :ensurePostLoaded="ensurePostNumberLoaded"
        @openSuggestedTopic="handleSuggestedTopicClick"
        @openUser="handleUserClick"
        @refresh="refresh"
        @replyTo="handleReplyTo"
        @openQuote="handleQuoteClick"
        @navigate="handleContentNavigation"
        @editPost="handleEditPost"
        @toggleSummaryMode="handleToggleTopicSummaryMode"
      />

      <!-- User profile view -->
      <UserView
        v-else-if="activeTab?.viewType === 'user' && activeTab.currentUser"
        :user="activeTab.currentUser"
        :baseUrl="baseUrl"
        :showSettings="isViewingSelf"
        showGroups
        @openTopic="handleUserTopicClick"
        @openActivity="handleOpenUserActivity"
        @openMessages="handleOpenUserMessages"
        @openUser="handleUserClick"
        @openBadges="handleOpenUserBadges"
        @openFollowFeed="handleOpenUserFollowFeed"
        @openFollowing="handleOpenUserFollowing"
        @openFollowers="handleOpenUserFollowers"
        @composeMessage="handleMessagesCompose"
        @startChat="handleStartUserChat"
        @openCategory="handleCategoryClick"
        @switchMainTab="handleUserMainTabSwitch"
      />

      <UserExtrasView
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
        :loading="activeTab.userExtrasLoading"
        :showSettings="isViewingSelf"
        showGroups
        @switchTab="handleUserExtrasTabSwitch"
        @openUser="handleUserClick"
        @openTopic="handleUserTopicClick"
        @goToProfile="handleGoToProfile"
        @switchMainTab="handleUserMainTabSwitch"
      />

      <!-- User activity view -->
      <ActivityView
        v-else-if="
          activeTab?.viewType === 'activity' && activeTab.currentUser && activeTab.activityState
        "
        :user="activeTab.currentUser"
        :activityState="activeTab.activityState"
        :baseUrl="baseUrl"
        :isLoadingMore="isLoadingMore"
        :showReadTab="isViewingSelf"
        :showSettings="isViewingSelf"
        showGroups
        @switchTab="handleActivityTabSwitch"
        @openTopic="handleUserTopicClick"
        @openUser="handleUserClick"
        @goToProfile="handleGoToProfile"
        @switchMainTab="handleUserMainTabSwitch"
      />

      <!-- User messages view -->
      <MessagesView
        v-else-if="
          activeTab?.viewType === 'messages' && activeTab.currentUser && activeTab.messagesState
        "
        :user="activeTab.currentUser"
        :messagesState="activeTab.messagesState"
        :baseUrl="baseUrl"
        :users="users"
        :isLoadingMore="isLoadingMore"
        :showSettings="isViewingSelf"
        showGroups
        @switchTab="handleMessagesTabSwitch"
        @openTopic="handleUserTopicClick"
        @openUser="handleUserClick"
        @goToProfile="handleGoToProfile"
        @switchMainTab="handleUserMainTabSwitch"
        @searchMessages="handleSearchMessages"
        @compose="handleMessagesCompose"
        @markAllRead="handleMessagesMarkAllRead"
        @archive="handleMessagesArchive"
        @moveToInbox="handleMessagesMoveToInbox"
      />

      <!-- Review queue view -->
      <ReviewView
        v-else-if="activeTab?.viewType === 'review' && activeTab.reviewState"
        :reviewState="activeTab.reviewState"
        :baseUrl="baseUrl"
        :currentUsername="currentUsername ?? undefined"
        :currentUserStaff="currentUserStaff"
        :users="users"
        @switchStatus="handleReviewSwitchStatus"
        @perform="handleReviewPerform"
        @update="handleReviewUpdate"
        @delete="handleReviewDelete"
        @loadMore="handleReviewLoadMore"
        @openTopic="handleUserTopicClick"
        @openUser="handleUserClick"
        @navigate="handleContentNavigation"
      />

      <!-- Invites view -->
      <InvitesView
        v-else-if="activeTab?.viewType === 'invites' && activeTab.invitesState"
        :user="activeTab.currentUser || undefined"
        :invitesState="activeTab.invitesState"
        :baseUrl="baseUrl"
        @switchFilter="handleInvitesSwitchFilter"
        @create="handleInvitesCreate"
        @delete="handleInvitesDelete"
        @resend="handleInvitesResend"
        @loadMore="handleInvitesLoadMore"
        @goToProfile="handleGoToProfile"
      />

      <UserGroupsView
        v-else-if="activeTab?.viewType === 'groups' && activeTab.currentUser"
        :user="activeTab.currentUser"
        :baseUrl="baseUrl"
        :showSettings="isViewingSelf"
        @goToProfile="handleGoToProfile"
        @switchMainTab="handleUserMainTabSwitch"
      />

      <GroupDetailView
        v-else-if="activeTab?.viewType === 'group' && activeTab.groupName"
        :groupName="activeTab.groupName"
        :baseUrl="baseUrl"
        @goToProfile="handleGroupBack"
        @openUser="handleUserClick"
        @createInvite="handleGroupInviteCreate"
      />

      <UserSettingsView
        v-else-if="activeTab?.viewType === 'preferences' && activeTab.currentUser"
        :user="activeTab.currentUser"
        :baseUrl="baseUrl"
        :categories="activeTab.categories"
        @goToProfile="handleGoToProfile"
        @switchMainTab="handleUserMainTabSwitch"
      />

      <SearchView
        v-else-if="activeTab?.viewType === 'search' && activeTab.searchState"
        :state="activeTab.searchState"
        :baseUrl="baseUrl"
        :categories="activeTab?.categories || []"
        :currentCategory="currentCategoryOption"
        @search="handleSearch"
        @loadMore="handleLoadMoreSearch"
        @open="handleOpenSearchResult"
      />
    </div>
  </div>

  <DiscourseContextMenu
    :open="contextMenu.open"
    :x="contextMenu.x"
    :y="contextMenu.y"
    :url="contextMenu.url"
    :selectedText="contextMenu.selectedText"
    :targetType="contextMenu.targetType"
    @close="closeContextMenu"
    @openCurrent="handleContentNavigation(contextMenu.url)"
    @openForumTab="openInNewTab(contextMenu.url)"
    @openBrowserTab="openContextUrlInBrowserTab"
    @copy="copyContextUrl"
    @copyImage="copyContextUrl"
    @copyText="copyContextSelection"
  />

  <UserCard
    :open="userCard.open"
    :username="userCard.username"
    :baseUrl="baseUrl"
    :currentUsername="currentUsername || ''"
    :anchor="userCard.anchor"
    @close="closeUserCard"
    @openProfile="handleUserCardProfile"
    @composeMessage="handleUserCardMessage"
    @startChat="handleStartUserChat"
  />

  <section
    v-if="floatingChatOpen"
    class="floating-chat"
    :class="{
      'is-minimized': floatingChatMinimized,
      'is-dragging': floatingChatState.dragging || floatingChatState.resizing
    }"
    :style="floatingChatStyle"
    aria-label="Discourse 聊天悬浮窗"
    @contextmenu="handleBrowserContextMenu"
  >
    <header
      class="floating-chat__header"
      @mousedown="startChatDrag"
      @touchstart.prevent="startChatDrag"
    >
      <div class="floating-chat__identity">
        <span class="floating-chat__logo" aria-hidden="true"><MessageOutlined /></span>
        <span>
          <strong>{{ floatingChatTitle }}</strong>
          <small>Discourse Chat</small>
        </span>
      </div>
      <div class="floating-chat__window-actions">
        <button
          type="button"
          :aria-label="floatingChatMinimized ? '展开聊天' : '最小化聊天'"
          :title="floatingChatMinimized ? '展开' : '最小化'"
          @click="floatingChatMinimized = !floatingChatMinimized"
        >
          <MessageOutlined v-if="floatingChatMinimized" />
          <MinusOutlined v-else />
        </button>
        <button
          type="button"
          aria-label="在聊天页打开"
          title="在聊天页打开"
          @click="expandFloatingChatToPage"
        >
          <ExpandOutlined />
        </button>
        <button type="button" aria-label="关闭聊天悬浮窗" title="关闭" @click="closeFloatingChat">
          <CloseOutlined />
        </button>
      </div>
    </header>

    <div v-show="!floatingChatMinimized" class="floating-chat__body">
      <div v-if="floatingChatLoading && !activeTab?.chatState" class="floating-chat__loading">
        <a-spin />
        <span>正在加载聊天…</span>
      </div>
      <ChatView
        v-else-if="activeTab?.chatState"
        :chatState="activeTab.chatState"
        :baseUrl="baseUrl"
        :currentUsername="currentUsername ?? undefined"
        :currentUserStaff="currentUserStaff"
        :users="users"
        :categories="activeTab.categories"
        :createGroupSearching="createGroupSearching"
        :createGroupResults="createGroupResults"
        :creatingGroup="chatDirectCreating"
        :creatingChannel="chatPublicCreating"
        :manageSearching="manageSearching"
        :manageSearchResults="manageSearchResults"
        :savingChannel="chatChannelSaving"
        :savingMembership="chatMembershipSaving"
        :savingStatus="chatStatusSaving"
        :savingFollow="chatFollowSaving"
        :leavingChannel="chatLeavingChannel"
        :deletingChannel="chatDeletingChannel"
        @selectChannel="channel => handleSelectChatChannel(channel, false)"
        @loadMore="handleLoadMoreChatMessages"
        @openThread="chatMessage => handleOpenChatThread(chatMessage, false)"
        @selectThread="thread => handleSelectChatThread(thread, false)"
        @closeThread="() => handleCloseChatThread(false)"
        @loadMoreThread="handleLoadMoreChatThreadMessages"
        @loadMyThreads="handleLoadMyChatThreads"
        @loadMoreMyThreads="handleLoadMoreMyChatThreads"
        @loadChannelThreads="handleLoadChatChannelThreads"
        @loadMoreChannelThreads="handleLoadMoreChatChannelThreads"
        @searchMessages="handleSearchChatMessages"
        @loadMoreSearch="handleLoadMoreChatSearch"
        @updateThreadNotification="handleUpdateChatThreadNotification"
        @updateThreadTitle="handleUpdateChatThreadTitle"
        @sendMessage="handleSendChatMessage"
        @sendThreadMessage="handleSendChatThreadMessage"
        @react="handleReactChatMessage"
        @editChannel="payload => handleEditChatChannel(payload, false)"
        @interact="handleChatMessageInteraction"
        @navigate="handleContentNavigation"
        @replyToMessage="handleReplyToMessage"
        @replyToThreadMessage="handleReplyToThreadMessage"
        @cancelReply="cancelChatReply"
        @cancelThreadReply="cancelChatThreadReply"
        @editMessage="handleEditMessage"
        @editThreadMessage="handleEditThreadMessage"
        @cancelEdit="cancelChatEdit"
        @cancelThreadEdit="cancelChatThreadEdit"
        @deleteMessage="handleDeleteMessage"
        @flagMessage="handleFlagMessage"
        @createGroup="payload => handleCreateGroup(payload, false)"
        @createChannel="payload => handleCreateChatChannel(payload, false)"
        @createGroupSearch="handleCreateGroupSearch"
        @loadMembers="handleLoadChatMembers"
        @loadMoreMembers="handleLoadMoreChatMembers"
        @addMembers="handleAddChatMembers"
        @removeMember="handleRemoveChatMember"
        @followChannel="handleFollowChatChannel"
        @unfollowChannel="handleUnfollowChatChannel"
        @updateMembership="handleUpdateChatMembership"
        @updateStatus="handleUpdateChatStatus"
        @leaveChannel="handleLeaveChatChannel"
        @deleteChannel="handleDeleteChatChannel"
        @manageSearch="handleManageSearch"
        :discoverChannels="activeTab.chatState.discoverableChannels"
        :discoverLoading="activeTab.chatState.discoverLoading"
        :discoverErrorMessage="activeTab.chatState.discoverErrorMessage"
        :joiningChannelIds="activeTab.chatState.joiningChannelIds"
        @discoverChannels="handleDiscoverChatChannels"
        @joinChannel="channelId => handleJoinChatChannel(channelId, false)"
        @addDirectUsers="handleAddChatDirectUsers"
        @sidebarTab="handleChatSidebarTabChange"
      />
      <div v-else class="floating-chat__loading">
        <span>聊天暂时不可用</span>
        <button type="button" @click="openFloatingChat">重试</button>
      </div>
    </div>
    <div
      v-show="!floatingChatMinimized"
      class="floating-chat__resize"
      aria-hidden="true"
      @mousedown="startChatResize"
      @touchstart.prevent="startChatResize"
    />
  </section>

  <FloatingComposer
    v-if="composerMode"
    :composerMode="composerMode!"
    :baseUrl="baseUrl"
    :floatingStyle="floatingStyle"
    :topicId="composerTopicId"
    :postId="composerPostId"
    :initialRaw="composerInitialRaw"
    :originalRaw="composerOriginalRaw"
    :replyToPostNumber="composerReplyPostNumber"
    :replyToUsername="composerReplyUsername"
    :categories="composerCategories"
    :defaultCategoryId="composerDefaultCategoryId"
    :currentCategory="composerCurrentCategory"
    @close="handleComposerClose"
    @startDrag="startDrag"
    @startResize="startResize"
    @topicPosted="handleTopicPosted"
    @editPosted="handleEditPosted"
    @replyPosted="handleReplyPosted"
    @clearReply="handleClearReply"
  />

  <!-- Private message composer -->
  <div v-if="pmComposerOpen" class="pm-composer-mask">
    <div class="pm-composer">
      <PrivateMessageComposer
        mode="privateMessage"
        :baseUrl="baseUrl"
        :initialTargetUsernames="pmComposerTargets"
        showClose
        @posted="handlePrivateMessagePosted"
        @close="pmComposerOpen = false"
      />
    </div>
  </div>
</template>

<style scoped>
.discourse-browser {
  position: relative;
  min-width: 0;
  border-radius: inherit;
}

.discourse-main {
  background: var(--d-background, var(--theme-background));
}

.discourse-body {
  position: relative;
  background:
    radial-gradient(
      circle at 100% 0,
      color-mix(in oklab, var(--primary, var(--theme-primary)) 5%, transparent),
      transparent 32rem
    ),
    var(--d-background, var(--theme-background));
  padding: 16px 20px 24px;
}

.user-section-refresh {
  position: absolute;
  top: 24px;
  right: 28px;
  z-index: 20;
  display: inline-flex;
  min-height: 34px;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  border: 1px solid color-mix(in oklab, var(--primary, var(--theme-primary)) 28%, transparent);
  border-radius: var(--d-shape-full, 999px);
  background: var(--secondary-container, var(--theme-secondary-container));
  box-shadow: var(--d-elevation-1, 0 2px 7px rgba(0, 0, 0, 0.14));
  color: var(--on-secondary-container, var(--theme-on-secondary-container));
  font-size: 12px;
  font-weight: 650;
  pointer-events: none;
}

.tab-item {
  transition: background-color 0.15s;
}

.browser-state {
  display: flex;
  min-height: 100%;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 18px;
  padding: 48px 24px;
  color: var(--d-text, var(--theme-on-surface));
  text-align: center;
}

.browser-state__indicator,
.browser-state__icon {
  display: grid;
  width: 72px;
  height: 72px;
  place-items: center;
  border-radius: var(--d-shape-xl, 28px);
  background: var(--primary-container, var(--theme-primary-container));
  color: var(--on-primary-container, var(--theme-on-primary-container));
}

.browser-state__icon {
  background: var(--danger-container, var(--theme-error-container));
  color: var(--on-danger-container, var(--theme-on-error-container));
  font-size: 30px;
}

.browser-state__copy {
  display: flex;
  max-width: 560px;
  flex-direction: column;
  gap: 6px;
}

.browser-state__title {
  font-size: 22px;
  font-weight: 540;
  letter-spacing: -0.01em;
}

.browser-state__description {
  color: var(--d-text-muted, var(--theme-on-surface-variant));
  font-size: 14px;
  overflow-wrap: anywhere;
}

.browser-state__progress {
  display: grid;
  width: min(420px, calc(100vw - 64px));
  gap: 7px;
  margin-top: 10px;
  color: var(--d-text-muted, var(--theme-on-surface-variant));
  font-size: 12px;
}

.browser-state__progress-track {
  height: 5px;
  overflow: hidden;
  border-radius: var(--d-shape-full, 999px);
  background: color-mix(in oklab, var(--primary, var(--theme-primary)) 16%, transparent);
}

.browser-state__progress-track > span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--primary, var(--theme-primary));
  transition: width var(--d-motion-medium, 220ms) var(--d-motion-standard, ease);
}

.browser-state--error .browser-state__description {
  color: var(--on-danger-container, var(--theme-on-error-container));
}

.browser-state__action {
  min-height: 40px;
  padding: 0 24px;
  border: 0;
  border-radius: var(--d-shape-full, 999px);
  background: var(--primary, var(--theme-primary));
  box-shadow: var(--d-elevation-1);
  color: var(--on-primary, var(--theme-on-primary));
  cursor: pointer;
  font-size: 14px;
  font-weight: 650;
  transition:
    box-shadow var(--d-motion-fast, 120ms) var(--d-motion-standard, ease),
    transform var(--d-motion-fast, 120ms) var(--d-motion-standard, ease);
}

.browser-state__action:hover {
  box-shadow: var(--d-elevation-2);
}

.browser-state__action:active {
  transform: scale(0.97);
}

.floating-chat-trigger {
  position: relative;
}

.floating-chat-trigger.is-active {
  background: var(--secondary-container, var(--theme-secondary-container));
  color: var(--on-secondary-container, var(--theme-on-secondary-container));
}

.floating-chat-trigger__badge {
  position: absolute;
  top: 1px;
  right: 0;
  display: inline-flex;
  min-width: 17px;
  height: 17px;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
  border: 2px solid var(--d-surface, var(--theme-surface));
  border-radius: 999px;
  background: var(--danger, var(--theme-error));
  color: var(--on-danger, var(--theme-on-error));
  font-size: 8px;
  font-weight: 750;
}

.floating-chat {
  position: fixed;
  right: 20px;
  bottom: 20px;
  z-index: 2147482000;
  display: flex;
  width: min(820px, calc(100vw - 40px));
  height: min(680px, calc(100vh - 40px));
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--d-border, var(--theme-outline-variant));
  border-radius: var(--d-shape-xl, 28px);
  background: var(--d-surface-3, var(--theme-surface-container-high));
  box-shadow: var(--d-elevation-3, 0 18px 52px rgba(0, 0, 0, 0.28));
  color: var(--d-text, var(--theme-on-surface));
}

.floating-chat.is-minimized {
  width: min(360px, calc(100vw - 40px));
  height: 68px;
  border-radius: var(--d-shape-xl, 28px);
}

.floating-chat__header {
  display: flex;
  min-height: 68px;
  flex: 0 0 68px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 10px 8px 16px;
  background: var(--primary-container, var(--theme-primary-container));
  color: var(--on-primary-container, var(--theme-on-primary-container));
  cursor: move;
  touch-action: none;
  user-select: none;
}

.floating-chat__identity {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
}

.floating-chat__identity > span:last-child {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.floating-chat__identity strong,
.floating-chat__identity small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.floating-chat__identity small {
  opacity: 0.72;
  font-size: 10px;
}

.floating-chat__logo {
  display: grid;
  width: 40px;
  height: 40px;
  flex: 0 0 40px;
  place-items: center;
  border-radius: var(--d-shape-full, 999px);
  background: color-mix(in oklab, currentColor 12%, transparent);
  font-size: 18px;
}

.floating-chat__header.is-dragging,
.floating-chat.is-dragging .floating-chat__body {
  cursor: grabbing;
}

.floating-chat__window-actions {
  display: flex;
  flex: 0 0 auto;
  gap: 2px;
  cursor: default;
}

.floating-chat__window-actions button {
  display: grid;
  width: 40px;
  height: 40px;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: var(--d-shape-full, 999px);
  background: transparent;
  color: inherit;
  cursor: pointer;
}

.floating-chat__window-actions button:hover {
  background: color-mix(in oklab, currentColor 12%, transparent);
}

.floating-chat__resize {
  position: absolute;
  right: 0;
  bottom: 0;
  z-index: 2;
  width: 18px;
  height: 18px;
  cursor: se-resize;
  touch-action: none;
  background: linear-gradient(
    135deg,
    transparent 50%,
    color-mix(in srgb, var(--d-outline, var(--theme-outline)) 75%, transparent) 50%
  );
  border-bottom-right-radius: inherit;
}

.floating-chat__body {
  min-height: 0;
  flex: 1;
  padding: 12px;
  background: var(--d-background, var(--theme-background));
}

.floating-chat__body :deep(.chat-view) {
  min-height: 0;
  height: 100%;
  grid-template-columns: minmax(210px, 240px) minmax(0, 1fr);
  gap: 12px;
}

.floating-chat__body :deep(.chat-main-header) {
  min-height: 52px;
}

.floating-chat__body :deep(.chat-sidebar-header) {
  min-height: 48px;
}

.floating-chat__loading {
  display: flex;
  height: 100%;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 12px;
  color: var(--d-text-muted, var(--theme-on-surface-variant));
}

.floating-chat__loading button {
  min-height: 40px;
  padding: 0 18px;
  border: 0;
  border-radius: var(--d-shape-full, 999px);
  background: var(--primary, var(--theme-primary));
  color: var(--on-primary, var(--theme-on-primary));
  cursor: pointer;
}

.pm-composer-mask {
  position: fixed;
  inset: 0;
  z-index: 3000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: color-mix(in oklab, var(--md3-scrim, #000) 40%, transparent);
  backdrop-filter: blur(2px);
}

.pm-composer {
  position: relative;
  width: min(600px, 100%);
  max-height: min(760px, calc(100vh - 40px));
  display: flex;
  flex-direction: column;
  background: var(--d-surface-3, var(--theme-surface-container-high));
  border-radius: var(--d-shape-xl, 28px);
  box-shadow: var(--d-elevation-3);
  overflow: hidden;
}

.pm-composer :deep(.composer) {
  max-height: min(760px, calc(100vh - 40px));
  border: 0;
  border-radius: inherit;
  background: transparent;
}

.pm-composer__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 72px;
  padding: 12px 16px 12px 24px;
  background: var(--d-surface-2, var(--theme-surface-container));
}

.pm-composer__title {
  font-size: 20px;
  font-weight: 560;
  display: flex;
  align-items: center;
  gap: 8px;
}

.pm-composer__body {
  padding: 20px 24px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.pm-composer__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.pm-composer__field label {
  padding-left: 2px;
  font-size: 12px;
  font-weight: 620;
  color: var(--d-text-muted, var(--theme-on-surface-variant));
}

.pm-composer__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  min-height: 72px;
  padding: 12px 20px;
  background: var(--d-surface-2, var(--theme-surface-container));
}

.pm-composer__button {
  min-height: 40px;
  padding-inline: 20px;
  border-radius: var(--d-shape-full, 999px);
  font-weight: 620;
}

@media (max-width: 720px) {
  .discourse-body {
    padding: 12px 10px 20px;
  }

  .floating-chat {
    right: 8px;
    bottom: 8px;
    width: calc(100vw - 16px);
    height: calc(100vh - 16px);
    border-radius: var(--d-shape-lg, 16px);
  }

  .floating-chat__body :deep(.chat-view) {
    grid-template-columns: minmax(0, 1fr);
  }

  .floating-chat__body :deep(.chat-sidebar) {
    max-height: 180px;
  }
}
</style>
