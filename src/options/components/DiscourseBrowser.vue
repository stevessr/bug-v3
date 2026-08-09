<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { message, Modal } from 'ant-design-vue'
import { EditOutlined, CloseOutlined, WarningOutlined } from '@ant-design/icons-vue'

import { useDiscourseBrowser } from './discourse/useDiscourseBrowser'
import type {
  ChatMessage,
  DiscourseCategory,
  DiscourseTag,
  DiscourseTopic,
  SuggestedTopic,
  ActivityTabType,
  MessagesTabType,
  DiscoursePost,
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
import type { QuickSidebarItem, QuickSidebarSection } from './discourse/layout/QuickSidebarPanel'
import Icon from './discourse/layout/Icon'
import NotificationsDropdown from './discourse/notifications/NotificationsDropdown'
import QuickSidebarPanel from './discourse/layout/QuickSidebarPanel'
import BrowserToolbar from './discourse/browser/BrowserToolbar'
import BrowserTabs from './discourse/browser/BrowserTabs'
import HomeView from './discourse/browser/views/HomeView.vue'
import { pageFetch, extractData } from './discourse/utils'
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
const UserSettingsView = defineAsyncComponent(() => import('./discourse/user/UserSettingsView'))
const ActivityView = defineAsyncComponent(() => import('./discourse/user/ActivityView'))
const MessagesView = defineAsyncComponent(() => import('./discourse/user/MessagesView'))
const FloatingComposer = defineAsyncComponent(
  () => import('./discourse/browser/FloatingComposer.vue')
)
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
  openQuote,
  loadMorePosts,
  ensurePostNumberLoaded,
  loadMoreTopics,
  switchActivityTab,
  loadMoreActivity,
  switchMessagesTab,
  loadMoreMessages,
  loadMoreFollowFeed,
  selectChatChannel,
  loadMoreChatMessagesForChannel,
  sendChat,
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
  cancelChatReply,
  editChatMessageAction,
  cancelChatEdit,
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
  createDirectMessageChannel,
  loadChatMembers,
  addChatMembers,
  removeChatMember,
  followChatChannel,
  unfollowChatChannel,
  deleteChatChannel,
  searchChatables
} = useDiscourseBrowser()

const contentAreaRef = ref<HTMLElement | null>(null)
const userExtrasTab = computed(
  () =>
    (activeTab.value?.viewType as
      'badges' | 'followFeed' | 'following' | 'followers' | undefined) || 'badges'
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
const proxyingImages = new WeakSet<HTMLImageElement>()
const messageBusUserId = ref<number | null>(null)
let messageBusUserIdFor = ''
let messageBusUserIdPromise: Promise<void> | null = null
const quickSidebarOpen = ref(false)
const quickSidebarLoading = ref(false)
const quickSidebarSections = ref<QuickSidebarSection[]>([])
const quickSidebarError = ref<string | null>(null)
const quickSidebarFetchedAt = ref(0)
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
const manageSearching = ref(false)
const manageSearchResults = ref<DiscourseUser[]>([])

// Private message composer state
const pmComposerOpen = ref(false)
const pmComposerTargets = ref('')
const pmComposerTitle = ref('')
const pmComposerRaw = ref('')
const pmComposerSending = ref(false)

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
const handleScrollRaf = () => {
  if (scrollRafId !== null) return
  scrollRafId = requestAnimationFrame(() => {
    scrollRafId = null
    void handleScroll()
  })
}

// Scroll event handler (infinite loading for all view types)
const handleScroll = async () => {
  if (!activeTab.value || !contentAreaRef.value) return
  if (activeTab.value.loading || isLoadingMore.value) return

  const el = contentAreaRef.value
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
  if (!open) return
  const tab = activeTab.value
  if (!tab) return
  try {
    await loadNotifications(tab, tab.notificationsFilter)
  } catch (error) {
    console.warn('[DiscourseBrowser] notifications load failed:', error)
  }
}

const handleRefreshNotifications = async () => {
  const tab = activeTab.value
  if (!tab) return
  try {
    await loadNotifications(tab, tab.notificationsFilter)
  } catch (error) {
    console.warn('[DiscourseBrowser] notifications refresh failed:', error)
  }
}

const handleNotificationFilterChange = async (filter: any) => {
  const tab = activeTab.value
  if (!tab) return
  tab.notificationsFilter = filter
  try {
    await loadNotifications(tab, filter)
  } catch (error) {
    console.warn('[DiscourseBrowser] notifications load failed:', error)
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
  openUser(username)
}

// Handle quote click
const handleQuoteClick = (payload: { topicId: number; postNumber: number }) => {
  openQuote(payload)
}

// Handle content navigation (links in posts)
const handleContentNavigation = (url: string) => {
  if (url.startsWith('/')) {
    // Internal path
    navigateTo(url)
  } else {
    // External URL, open in new tab
    window.open(url, '_blank')
  }
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

const handleOpenChat = () => {
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

const normalizeNotificationPreferences = (raw: any): DiscourseUserPreferences => {
  const input = raw || {}
  return {
    watched_category_ids: sanitizeNumberArray(input.watched_category_ids),
    tracked_category_ids: sanitizeNumberArray(input.tracked_category_ids),
    watched_first_post_category_ids: sanitizeNumberArray(input.watched_first_post_category_ids),
    muted_category_ids: sanitizeNumberArray(input.muted_category_ids),
    watched_tags: sanitizeStringArray(input.watched_tags),
    tracked_tags: sanitizeStringArray(input.tracked_tags),
    watching_first_post_tags: sanitizeStringArray(input.watching_first_post_tags),
    muted_tags: sanitizeStringArray(input.muted_tags)
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
  if (!currentUsername.value) return
  if (!force && now - quickSidebarFetchedAt.value < 60000) return
  if (quickSidebarLoading.value) return

  quickSidebarLoading.value = true
  quickSidebarError.value = null

  try {
    const [userResult, categoriesResult] = await Promise.all([
      pageFetch<any>(`${baseUrl.value}/u/${encodeURIComponent(currentUsername.value)}.json`),
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
    const sections: QuickSidebarSection[] = []

    sections.push({
      title: '快捷入口',
      items: [
        { id: 'home', label: '主页', path: '/', icon: 'list' },
        { id: 'categories', label: '分类', path: '/categories', icon: 'list' },
        { id: 'tags', label: '标签', path: '/tags', icon: 'tags' },
        {
          id: 'notifications',
          label: '通知',
          path: currentUsername.value
            ? `/u/${encodeURIComponent(currentUsername.value)}/notifications`
            : '/my/notifications',
          icon: 'bell'
        },
        {
          id: 'private-messages',
          label: '私信',
          path: currentUsername.value
            ? `/u/${encodeURIComponent(currentUsername.value)}/user-menu-private-messages`
            : '/my/messages',
          icon: 'envelope'
        },
        {
          id: 'bookmarks',
          label: '书签',
          path: currentUsername.value
            ? `/u/${encodeURIComponent(currentUsername.value)}/user-menu-bookmarks`
            : '/bookmarks',
          icon: 'bookmark'
        },
        { id: 'posted', label: '我的帖子', path: '/posted', icon: 'pencil' }
      ]
    })

    const watchedCategoryItems = buildCategoryItems(
      normalizedPrefs.watched_category_ids,
      categoryMap
    )
    const trackedCategoryItems = buildCategoryItems(
      normalizedPrefs.tracked_category_ids,
      categoryMap
    )
    const watchedFirstPostCategoryItems = buildCategoryItems(
      normalizedPrefs.watched_first_post_category_ids,
      categoryMap
    )
    const mutedCategoryItems = buildCategoryItems(
      normalizedPrefs.muted_category_ids,
      categoryMap,
      true
    )

    const categoryNotificationItems: QuickSidebarItem[] = [
      ...watchedCategoryItems,
      ...trackedCategoryItems,
      ...watchedFirstPostCategoryItems,
      ...mutedCategoryItems
    ]
    if (categoryNotificationItems.length) {
      sections.push({ title: '分类通知', items: categoryNotificationItems })
    }

    const watchedTags = buildTagItems(normalizedPrefs.watched_tags)
    const trackedTags = buildTagItems(normalizedPrefs.tracked_tags)
    const watchingFirstPostTags = buildTagItems(normalizedPrefs.watching_first_post_tags)
    const mutedTags = buildTagItems(normalizedPrefs.muted_tags, true)

    const tagNotificationItems: QuickSidebarItem[] = [
      ...watchedTags,
      ...trackedTags,
      ...watchingFirstPostTags,
      ...mutedTags
    ]
    if (tagNotificationItems.length) {
      sections.push({ title: '标签通知', items: tagNotificationItems })
    }

    quickSidebarSections.value = sections
    quickSidebarFetchedAt.value = now
  } catch (error) {
    quickSidebarError.value = error instanceof Error ? error.message : '加载失败'
  } finally {
    quickSidebarLoading.value = false
  }
}

const handleSelectChatChannel = (channel: { id: number; slug?: string }) => {
  selectChatChannel(channel.id)
}

const handleLoadMoreChatMessages = (channelId: number) => {
  loadMoreChatMessagesForChannel(channelId)
}

const handleSendChatMessage = (payload: { channelId: number; message: string }) => {
  sendChat(payload.channelId, payload.message)
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

const handleEditChatChannel = async (payload: {
  channelId: number
  updates: {
    name?: string
    description?: string
    slug?: string
    emoji?: string
    threading_enabled?: boolean
  }
}) => {
  const channel = await updateChatChannel(payload.channelId, payload.updates)
  if (channel) {
    message.success('频道已更新')
  } else {
    message.error(activeTab.value?.chatState?.errorMessage || '频道更新失败')
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

const handleEditMessage = (message: ChatMessage) => {
  editChatMessageAction(message)
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

const handleCreateGroup = async (payload: { targetUsernames: string[]; name?: string }) => {
  const channel = await createDirectMessageChannel({
    targetUsernames: payload.targetUsernames,
    name: payload.name,
    upsert: true
  })
  if (channel) {
    message.success('群聊已创建')
    selectChatChannel(channel.id)
  } else {
    message.error(activeTab.value?.chatState?.errorMessage || '创建群聊失败')
  }
}

const handleLoadChatMembers = async (channelId: number) => {
  await loadChatMembers(channelId, true)
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
  const ok = await followChatChannel(channelId)
  if (ok) {
    message.success('已恢复关注')
  } else {
    message.error(activeTab.value?.chatState?.errorMessage || '操作失败')
  }
}

const handleUnfollowChatChannel = async (channelId: number) => {
  const ok = await unfollowChatChannel(channelId)
  if (ok) {
    message.success('频道已静音')
  } else {
    message.error(activeTab.value?.chatState?.errorMessage || '操作失败')
  }
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
      const ok = await deleteChatChannel(channelId)
      if (ok) {
        message.success('频道已删除')
      } else {
        message.error(activeTab.value?.chatState?.errorMessage || '删除频道失败')
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
const handleMessagesCompose = () => {
  pmComposerOpen.value = true
  pmComposerTargets.value = ''
  pmComposerTitle.value = ''
  pmComposerRaw.value = ''
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

const handlePmComposerSend = async () => {
  const targets = pmComposerTargets.value
    .split(/[,，\s]+/)
    .map(t => t.trim())
    .filter(Boolean)
  const title = pmComposerTitle.value.trim()
  const raw = pmComposerRaw.value.trim()
  if (targets.length === 0) {
    message.warning('请输入至少一个收件人用户名')
    return
  }
  if (!raw) {
    message.warning('请输入私信内容')
    return
  }
  pmComposerSending.value = true
  try {
    const { createTopic } = await import('./discourse/actions/topic')
    const data = await createTopic(baseUrl.value, {
      title: title || `私信给 ${targets.join(', ')}`,
      raw,
      targetUsernames: targets
    })
    pmComposerOpen.value = false
    message.success('私信已发送')
    const topicId = Number(data?.topic_id || data?.id)
    if (Number.isFinite(topicId) && topicId > 0) {
      navigateTo(`/t/${topicId}`)
    }
  } catch (e) {
    message.error(e instanceof Error ? e.message : '发送私信失败')
  } finally {
    pmComposerSending.value = false
  }
}

const handleChangeTopicListType = (type: TopicListType) => {
  changeTopicListType(type)
}

const handleNavigate = (path: string) => {
  navigateTo(path)
}

const handleUserMainTabSwitch = (
  tab: 'summary' | 'activity' | 'messages' | 'badges' | 'follow' | 'groups' | 'settings'
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
  } else if (tab === 'groups') {
    openUserGroups(username)
  } else if (tab === 'settings') {
    openUserPreferences(username)
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

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

const normalizeImageUrl = (img: HTMLImageElement) => {
  const rawSrc = img.getAttribute('src') || ''
  if (rawSrc.startsWith('http://') || rawSrc.startsWith('https://')) return rawSrc
  if (rawSrc.startsWith('//')) return `https:${rawSrc}`
  if (rawSrc.startsWith('data:') || rawSrc.startsWith('blob:')) return rawSrc

  if (rawSrc.startsWith('/')) {
    const base = baseUrl.value?.replace(/\/+$/, '')
    return base ? `${base}${rawSrc}` : rawSrc
  }

  if (rawSrc) {
    try {
      return new URL(rawSrc, baseUrl.value || window.location.href).toString()
    } catch {
      return rawSrc
    }
  }

  return img.currentSrc || img.src || ''
}

const handleGlobalImageLoad = (event: Event) => {
  const target = event.target
  if (!(target instanceof HTMLImageElement)) return
  target.removeAttribute('data-page-fetch-proxy-tried')
}

const handleGlobalImageError = (event: Event) => {
  const target = event.target
  if (!(target instanceof HTMLImageElement)) return
  if (target.dataset.pageFetchProxyTried === '1') return
  if (proxyingImages.has(target)) return

  const imageUrl = normalizeImageUrl(target)
  if (!imageUrl || imageUrl.startsWith('blob:') || imageUrl.startsWith('data:')) return

  target.dataset.pageFetchProxyTried = '1'
  proxyingImages.add(target)

  void (async () => {
    try {
      const result = await pageFetch<Blob>(imageUrl, undefined, 'blob')
      if (!result.ok || !result.data) return

      const blobUrl = URL.createObjectURL(result.data)
      proxiedBlobUrls.add(blobUrl)
      target.src = blobUrl
    } catch {
      // Keep original failed image if proxy fetch also fails.
    } finally {
      proxyingImages.delete(target)
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

    if (tab.viewType === 'chat' && tab.chatState) {
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

  if (tab?.viewType === 'chat' && tab.chatState?.activeChannelId) {
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
    activeTab.value?.chatState?.activeChannelId
  ],
  () => {
    syncMessageBusSubscriptions()
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
  document.addEventListener('visibilitychange', handleDocumentVisibilityChange)
  messageBus.start()
  handleDocumentVisibilityChange()
  void ensureMessageBusUserId().finally(() => {
    syncMessageBusSubscriptions()
  })
})

onUnmounted(() => {
  clearMessageBusSubscriptions()
  messageBus.stop()
  if (contentAreaRef.value) {
    contentAreaRef.value.removeEventListener('scroll', handleScrollRaf)
  }
  if (scrollRafId !== null) {
    cancelAnimationFrame(scrollRafId)
    scrollRafId = null
  }
  window.removeEventListener('mousemove', handlePointerMove)
  window.removeEventListener('mouseup', stopPointer)
  window.removeEventListener('touchmove', handlePointerMove)
  window.removeEventListener('touchend', stopPointer)
  window.removeEventListener('error', handleGlobalImageError, true)
  window.removeEventListener('load', handleGlobalImageLoad, true)
  document.removeEventListener('visibilitychange', handleDocumentVisibilityChange)
  proxiedBlobUrls.forEach(url => URL.revokeObjectURL(url))
  proxiedBlobUrls.clear()
})
</script>

<template>
  <Icon :baseUrl="baseUrl" />
  <div class="discourse-browser flex flex-col h-full min-h-0 overflow-hidden">
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
        <NotificationsDropdown
          :notifications="activeTab?.notifications || []"
          :filter="activeTab?.notificationsFilter || 'all'"
          :unreadCount="unreadNotificationsCount"
          :open="notificationsOpen"
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
      :aria-busy="activeTab?.loading || undefined"
    >
      <!-- Loading -->
      <div v-if="activeTab?.loading" class="browser-state browser-state--loading" role="status">
        <div class="browser-state__indicator"><a-spin size="large" /></div>
        <div class="browser-state__copy">
          <div class="browser-state__title">正在打开页面</div>
          <div class="browser-state__description">正在从论坛同步最新内容…</div>
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

      <!-- Chat view -->
      <ChatView
        v-else-if="activeTab?.viewType === 'chat' && activeTab.chatState"
        :chatState="activeTab.chatState"
        :baseUrl="baseUrl"
        :currentUsername="currentUsername ?? undefined"
        :users="users"
        :createGroupSearching="createGroupSearching"
        :createGroupResults="createGroupResults"
        :manageSearching="manageSearching"
        :manageSearchResults="manageSearchResults"
        @selectChannel="handleSelectChatChannel"
        @loadMore="handleLoadMoreChatMessages"
        @sendMessage="handleSendChatMessage"
        @react="handleReactChatMessage"
        @editChannel="handleEditChatChannel"
        @interact="handleChatMessageInteraction"
        @navigate="handleContentNavigation"
        @replyToMessage="handleReplyToMessage"
        @cancelReply="cancelChatReply"
        @editMessage="handleEditMessage"
        @cancelEdit="cancelChatEdit"
        @deleteMessage="handleDeleteMessage"
        @flagMessage="handleFlagMessage"
        @createGroup="handleCreateGroup"
        @createGroupSearch="handleCreateGroupSearch"
        @loadMembers="handleLoadChatMembers"
        @addMembers="handleAddChatMembers"
        @removeMember="handleRemoveChatMember"
        @followChannel="handleFollowChatChannel"
        @unfollowChannel="handleUnfollowChatChannel"
        @deleteChannel="handleDeleteChatChannel"
        @manageSearch="handleManageSearch"
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
      <div class="pm-composer__header">
        <div class="pm-composer__title">
          <EditOutlined />
          新建私信
        </div>
        <a-button type="text" size="small" @click="pmComposerOpen = false" aria-label="关闭">
          <CloseOutlined />
        </a-button>
      </div>
      <div class="pm-composer__body">
        <div class="pm-composer__field">
          <label>收件人（用户名，逗号分隔）</label>
          <a-input
            v-model:value="pmComposerTargets"
            placeholder="例如：user1, user2"
            :disabled="pmComposerSending"
          />
        </div>
        <div class="pm-composer__field">
          <label>标题</label>
          <a-input
            v-model:value="pmComposerTitle"
            placeholder="私信标题（可选）"
            :disabled="pmComposerSending"
          />
        </div>
        <div class="pm-composer__field">
          <label>内容</label>
          <a-textarea
            v-model:value="pmComposerRaw"
            :rows="8"
            placeholder="输入私信内容..."
            :disabled="pmComposerSending"
          />
        </div>
      </div>
      <div class="pm-composer__footer">
        <a-button
          class="pm-composer__button"
          @click="pmComposerOpen = false"
          :disabled="pmComposerSending"
        >
          取消
        </a-button>
        <a-button
          type="primary"
          class="pm-composer__button"
          :loading="pmComposerSending"
          @click="handlePmComposerSend"
        >
          发送
        </a-button>
      </div>
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
  background:
    radial-gradient(
      circle at 100% 0,
      color-mix(in oklab, var(--primary, var(--theme-primary)) 5%, transparent),
      transparent 32rem
    ),
    var(--d-background, var(--theme-background));
  padding: 16px 20px 24px;
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
  width: min(600px, 100%);
  max-height: min(760px, calc(100vh - 40px));
  display: flex;
  flex-direction: column;
  background: var(--d-surface-3, var(--theme-surface-container-high));
  border-radius: var(--d-shape-xl, 28px);
  box-shadow: var(--d-elevation-3);
  overflow: hidden;
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
}
</style>
