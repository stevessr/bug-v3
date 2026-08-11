// Discourse Browser Composable

import { ref, computed, watch } from 'vue'

import type {
  BrowserTab,
  ChatMessage,
  ChatSearchSort,
  ChatThread,
  ChatChannelEditableStatus,
  ChatChannelUpdatePayload,
  ChatCreateChannelPayload,
  ChatCreateDirectMessagePayload,
  ChatMembershipUpdatePayload,
  DiscourseCategory,
  DiscourseTopic,
  DiscourseUser,
  DiscoursePost,
  DiscourseNotification,
  ActivityTabType,
  MessagesTabType,
  TopicListType,
  DiscourseNotificationFilter,
  DiscourseSearchFilters,
  ReviewStatus,
  ReviewPerformResult
} from './types'
import { generateId, pageFetch, extractData, setPageFetchMaxConcurrency } from './utils'
import {
  loadHome as loadHomeRoute,
  loadCategories as loadCategoriesRoute,
  loadTags as loadTagsRoute,
  loadTag as loadTagRoute,
  loadBookmarks as loadBookmarksRoute
} from './routes/root'
import {
  buildTopicListApiUrl,
  categoryRouteFromPath,
  messagesTabFromPath,
  normalizeNotificationFilter,
  normalizeTopicListPeriod,
  resolveDiscourseAddressInput,
  topicListRouteFromPath
} from './navigation'
import {
  loadNotifications as loadNotificationsRoute,
  normalizeNotificationsFromResponse
} from './routes/notifications'
import { loadSearch as loadSearchRoute } from './routes/search'
import {
  loadCategory as loadCategoryRoute,
  loadMoreTopics as loadMoreTopicsRoute
} from './routes/category'
import {
  loadTopic as loadTopicRoute,
  loadMorePosts as loadMorePostsRoute,
  ensurePostsAroundNumber as ensurePostsAroundNumberRoute
} from './routes/topic'
import {
  loadUser as loadUserRoute,
  loadUserActivity as loadUserActivityRoute,
  loadActivityData as loadActivityDataRoute,
  loadMoreActivity as loadMoreActivityRoute,
  loadMessages as loadMessagesRoute,
  loadMoreMessages as loadMoreMessagesRoute,
  loadMoreFollowFeed as loadMoreFollowFeedRoute,
  loadUserPreferences as loadUserPreferencesRoute,
  archivePrivateMessage as archivePrivateMessageRoute,
  movePrivateMessageToInbox as movePrivateMessageToInboxRoute,
  markPrivateMessagesRead as markPrivateMessagesReadRoute
} from './routes/user'
import {
  loadReview as loadReviewRoute,
  loadMoreReviewables as loadMoreReviewablesRoute,
  performReviewableAction as performReviewableActionRoute,
  updateReviewable as updateReviewableRoute,
  deleteReviewable as deleteReviewableRoute
} from './routes/review'
import {
  loadInvites as loadInvitesRoute,
  loadMoreInvites as loadMoreInvitesRoute,
  createInvite as createInviteRoute,
  deleteInvite as deleteInviteRoute,
  resendInvite as resendInviteRoute
} from './routes/invites'
import { loadSessionUserFromExtension } from './routes/session'
import {
  loadChat as loadChatRoute,
  loadChatMessages,
  loadMyChatThreads,
  loadChatChannelThreads,
  loadChatThreadMessages,
  searchChatMessages as searchChatMessagesRoute,
  openChatThread as openChatThreadRoute,
  openChatThreadById as openChatThreadByIdRoute,
  closeChatThread as closeChatThreadRoute,
  updateChatThreadNotificationLevel as updateChatThreadNotificationLevelRoute,
  updateChatThreadTitle as updateChatThreadTitleRoute,
  sendChatMessage,
  toggleChatMessageReaction,
  updateChatChannel as updateChatChannelRoute,
  interactChatMessage,
  editChatMessage,
  deleteChatMessage,
  flagChatMessage,
  dedupeMessagesById,
  normalizeSingleMessage,
  syncThreadSummaryFromMessage,
  resetChatChannelUnreadCount,
  updateChannelLastMessage,
  createChatChannel as createChatChannelRoute,
  createDirectMessageChannel as createDirectMessageChannelRoute,
  getDmChannelForUsernames as getDmChannelForUsernamesRoute,
  loadChannelMembers as loadChannelMembersRoute,
  addMembersToChannel as addMembersToChannelRoute,
  removeMemberFromChannel as removeMemberFromChannelRoute,
  followChatChannel as followChatChannelRoute,
  unfollowChatChannel as unfollowChatChannelRoute,
  deleteChatChannel as deleteChatChannelRoute,
  leaveChatChannel as leaveChatChannelRoute,
  updateChatChannelStatus as updateChatChannelStatusRoute,
  updateMembershipSettings as updateMembershipSettingsRoute,
  searchChatables as searchChatablesRoute,
  loadDiscoverableChannels as loadDiscoverableChannelsRoute,
  joinChatChannel as joinChatChannelRoute,
  addUsersToDirectMessageChannel as addUsersToDirectMessageChannelRoute
} from './routes/chat'
import { sendReadTimings } from './utils/readTimings'

import type { DiscourseSessionUser } from '@/types/messages'

type MessageBusListPatchOptions = {
  applyToPending?: boolean
}

type NotificationUnreadState = {
  unreadNotifications: number
  unreadHighPriorityNotifications: number
  unreadPrivateMessages: number
}

type ShortLivedCacheEntry = {
  expiresAt: number
  data: unknown
}

export function useDiscourseBrowser() {
  // 启动时恢复设置页保存的单论坛页面抓取并发数
  try {
    const stored = window.localStorage.getItem('discourse-browser:page-fetch-concurrency')
    const parsed = stored ? Number(stored) : NaN
    if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 8) {
      setPageFetchMaxConcurrency(Math.floor(parsed))
    }
  } catch {
    // 存储不可用时使用默认并发数
  }

  const UPDATE_CACHE_MAX_ENTRIES = 80
  const TOPIC_LIST_UPDATE_CACHE_TTL_MS = 2500
  const TOPIC_STREAM_UPDATE_CACHE_TTL_MS = 1200
  const TOPIC_POSTS_UPDATE_CACHE_TTL_MS = 1200
  const NOTIFICATIONS_CACHE_TTL_MS = 3000

  const updateResponseCache = new Map<string, ShortLivedCacheEntry>()
  const updateInFlight = new Map<string, Promise<unknown>>()
  const tabScopedUpdatesInFlight = new Map<string, Promise<void>>()
  const notificationsSnapshotCache = new Map<
    string,
    {
      expiresAt: number
      notifications: DiscourseNotification[]
      unreadState: NotificationUnreadState
    }
  >()
  const notificationsInFlight = new Map<string, Promise<void>>()

  const cloneNotifications = (notifications: DiscourseNotification[]): DiscourseNotification[] =>
    notifications.map(item => ({
      ...item,
      data:
        item.data && typeof item.data === 'object'
          ? ({ ...(item.data as Record<string, unknown>) } as Record<string, any>)
          : item.data
    }))

  const upsertNotificationsSnapshotCache = (
    notifications: DiscourseNotification[],
    unreadState: NotificationUnreadState
  ) => {
    const now = Date.now()
    for (const [key, entry] of notificationsSnapshotCache) {
      const separatorIndex = key.indexOf('|')
      const cacheBaseUrl = separatorIndex >= 0 ? key.slice(0, separatorIndex) : ''
      if (cacheBaseUrl !== baseUrl.value) continue

      notificationsSnapshotCache.set(key, {
        expiresAt: Math.max(entry.expiresAt, now + NOTIFICATIONS_CACHE_TTL_MS),
        notifications: cloneNotifications(notifications),
        unreadState
      })
    }
  }

  const MESSAGE_BUS_PAYLOAD_MAX_DEPTH = 4

  const isRecordObject = (value: unknown): value is Record<string, any> =>
    Boolean(value) && typeof value === 'object' && !Array.isArray(value)

  const normalizeMessageBusPayloadObject = (value: unknown): Record<string, any> | null => {
    const visited = new WeakSet<object>()

    const normalize = (current: unknown, depth: number): Record<string, any> | null => {
      if (!current || depth > MESSAGE_BUS_PAYLOAD_MAX_DEPTH) return null

      if (typeof current === 'string') {
        const trimmed = current.trim()
        if (!trimmed) return null
        if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null

        try {
          const parsed = JSON.parse(trimmed)
          return normalize(parsed, depth + 1)
        } catch {
          return null
        }
      }

      if (!isRecordObject(current)) return null
      if (visited.has(current)) return current
      visited.add(current)

      const data = current
      if (!('payload' in data)) return data

      const nested = normalize(data.payload, depth + 1)
      if (!nested) return data

      return {
        ...data,
        ...nested
      }
    }

    return normalize(value, 0)
  }

  const syncUnreadStateFromNotifications = (tab: BrowserTab) => {
    const unreadState = computeUnreadNotificationState(tab.notifications || [])
    applyUnreadNotificationState(tab, unreadState)
    upsertNotificationsSnapshotCache(tab.notifications || [], unreadState)
  }

  const computeUnreadNotificationState = (
    notifications: DiscourseNotification[]
  ): NotificationUnreadState => {
    const unreadNotifications = notifications.filter(item => !item.read).length
    return {
      unreadNotifications,
      unreadHighPriorityNotifications: unreadNotifications,
      unreadPrivateMessages: notifications.filter(
        item => !item.read && [6, 7, 16].includes(item.notification_type)
      ).length
    }
  }

  const applyUnreadNotificationState = (
    tab: BrowserTab,
    state: Partial<NotificationUnreadState>
  ) => {
    const currentUnread = Number(tab.unreadNotificationsCount || 0)
    const nextUnread = Number(state.unreadNotifications)
    if (Number.isFinite(nextUnread) && nextUnread >= 0) {
      tab.unreadNotificationsCount = nextUnread
      return
    }

    const nextHighPriority = Number(state.unreadHighPriorityNotifications)
    const nextPrivateMessages = Number(state.unreadPrivateMessages)

    if (Number.isFinite(nextHighPriority) && Number.isFinite(nextPrivateMessages)) {
      tab.unreadNotificationsCount = Math.max(0, nextHighPriority + nextPrivateMessages)
      return
    }

    tab.unreadNotificationsCount = Math.max(0, currentUnread)
  }

  const compactUpdateCache = () => {
    const now = Date.now()

    for (const [key, entry] of updateResponseCache) {
      if (entry.expiresAt <= now) {
        updateResponseCache.delete(key)
      }
    }

    if (updateResponseCache.size <= UPDATE_CACHE_MAX_ENTRIES) return

    const sorted = Array.from(updateResponseCache.entries()).sort(
      (a, b) => a[1].expiresAt - b[1].expiresAt
    )

    while (updateResponseCache.size > UPDATE_CACHE_MAX_ENTRIES && sorted.length > 0) {
      const candidate = sorted.shift()
      if (!candidate) break
      updateResponseCache.delete(candidate[0])
    }
  }

  const clearTransientCaches = () => {
    updateResponseCache.clear()
    updateInFlight.clear()
    tabScopedUpdatesInFlight.clear()
    notificationsSnapshotCache.clear()
    notificationsInFlight.clear()
  }

  async function runTabScopedUpdate(
    tabId: string,
    updateKey: string,
    task: () => Promise<void>
  ): Promise<void> {
    const scopedKey = `${tabId}|${updateKey}`
    const existing = tabScopedUpdatesInFlight.get(scopedKey)
    if (existing) {
      await existing
      return
    }

    const running = task().finally(() => {
      tabScopedUpdatesInFlight.delete(scopedKey)
    })
    tabScopedUpdatesInFlight.set(scopedKey, running)
    await running
  }

  async function fetchUpdateDataWithCache<T>(cacheKey: string, url: string, ttlMs: number) {
    const now = Date.now()
    const cached = updateResponseCache.get(cacheKey)
    if (cached && cached.expiresAt > now) {
      return cached.data as T | null
    }

    const inFlight = updateInFlight.get(cacheKey)
    if (inFlight) {
      return (await inFlight) as T | null
    }

    const requestPromise = pageFetch<any>(url)
      .then(result => {
        const data = extractData(result) as T | null
        updateResponseCache.set(cacheKey, {
          expiresAt: Date.now() + ttlMs,
          data
        })
        compactUpdateCache()
        return data
      })
      .finally(() => {
        updateInFlight.delete(cacheKey)
      })

    updateInFlight.set(cacheKey, requestPromise)
    return (await requestPromise) as T | null
  }

  // Base URL
  const baseUrl = ref('https://linux.do')
  const urlInput = ref('https://linux.do')

  // Tab management
  const tabs = ref<BrowserTab[]>([])
  const activeTabId = ref<string>('')

  // Current active tab
  const activeTab = computed(() => tabs.value.find(t => t.id === activeTabId.value))

  // User cache (shared across tabs)
  const users = ref<Map<number, DiscourseUser>>(new Map())

  // Loading more posts state
  const isLoadingMore = ref(false)

  const currentUsername = ref<string | null>(null)
  const currentSessionUser = ref<DiscourseSessionUser | null>(null)
  const currentUserStaff = computed(() => currentSessionUser.value?.staff === true)
  let sessionUserPromise: Promise<string | null> | null = null

  // Sync URL input with active tab's URL
  watch(
    activeTab,
    tab => {
      if (tab) {
        urlInput.value = tab.url
        const origin = new URL(tab.url).origin
        if (origin !== baseUrl.value) baseUrl.value = origin
      }
    },
    { immediate: true }
  )

  async function ensureSessionUser(forceReload = false): Promise<string | null> {
    if (!forceReload && currentUsername.value !== null) {
      return currentUsername.value
    }

    if (sessionUserPromise) {
      return sessionUserPromise
    }

    sessionUserPromise = loadSessionUserFromExtension(baseUrl.value)
      .then(user => {
        currentSessionUser.value = user
        currentUsername.value = user?.username || null
        return currentUsername.value
      })
      .finally(() => {
        sessionUserPromise = null
      })

    return sessionUserPromise
  }

  watch(
    baseUrl,
    () => {
      clearTransientCaches()
      void ensureSessionUser(true)
    },
    { immediate: true }
  )

  // Create a new tab
  function createTab(url?: string) {
    const id = generateId()
    const targetUrl = resolveDiscourseAddressInput(url || baseUrl.value, baseUrl.value).url
    const newTab: BrowserTab = {
      id,
      title: '新标签页',
      url: targetUrl,
      loading: false,
      history: [targetUrl],
      historyScrollPositions: [0],
      historyIndex: 0,
      scrollTop: 0,
      // Per-tab state
      viewType: 'home',
      categories: [],
      topics: [],
      currentTopic: null,
      currentUser: null,
      activeUsers: [],
      tags: [],
      tagGroups: [],
      errorMessage: '',
      notifications: [],
      notificationsFilter: 'all',
      unreadNotificationsCount: 0,
      loadedPostIds: new Set(),
      hasMorePosts: false,
      // Topics pagination
      topicsPage: 0,
      hasMoreTopics: true,
      currentCategorySlug: '',
      currentCategoryId: null,
      currentCategoryName: '',
      currentTagName: '',
      topicListType: 'latest',
      topicListPeriod: null,
      activityState: null,
      messagesState: null,
      followFeedPage: 0,
      followFeedHasMore: false,
      targetPostNumber: null,
      topicSummaryMode: false,
      topicExtras: null,
      lastTimingSentAt: undefined,
      lastTimingTopicId: undefined,
      chatState: null,
      pendingTopics: null,
      pendingTopicsCount: 0,
      reviewState: null,
      invitesState: null,
      searchState: {
        query: '',
        filters: {
          inTitle: false,
          inFirst: false,
          inPinned: false,
          inWiki: false,
          inBookmarks: false,
          inLikes: false,
          inPosted: false,
          inSeen: false,
          inUnseen: false,
          inWatching: false,
          inTracking: false,
          inMessages: false,
          status: '',
          order: '',
          category: '',
          tags: '',
          postedBy: '',
          assignedTo: '',
          group: '',
          before: '',
          after: '',
          minPosts: '',
          maxPosts: '',
          minViews: '',
          maxViews: ''
        },
        posts: [],
        topics: [],
        users: [],
        page: 0,
        hasMore: false,
        loading: false,
        errorMessage: ''
      }
    }
    tabs.value.push(newTab)
    activeTabId.value = id
    void navigateTo(targetUrl, false)
  }

  // Close a tab
  function closeTab(id: string) {
    const index = tabs.value.findIndex(t => t.id === id)
    if (index === -1) return

    tabs.value.splice(index, 1)

    if (tabs.value.length === 0) {
      createTab()
    } else if (activeTabId.value === id) {
      activeTabId.value = tabs.value[Math.min(index, tabs.value.length - 1)].id
    }
  }

  // Switch tab
  function switchTab(id: string) {
    activeTabId.value = id
    // Sync URL input with the new active tab
    const tab = tabs.value.find(t => t.id === id)
    if (tab) {
      urlInput.value = tab.url
    }
  }

  // Navigate to URL
  async function navigateTo(url: string, addToHistory = true, options: { silent?: boolean } = {}) {
    const tab = activeTab.value
    if (!tab) return

    const rawUrl = (url || '').trim()
    const base = baseUrl.value.replace(/\/+$/, '')
    const normalizedUrl = resolveDiscourseAddressInput(rawUrl || base, base).url
    const targetOrigin = new URL(normalizedUrl).origin
    if (targetOrigin !== baseUrl.value) baseUrl.value = targetOrigin

    // silent：子 tab 切换时不清空整个视图，只让局部区域显示加载动画
    if (!options.silent) {
      tab.loading = true
    }
    tab.url = normalizedUrl
    tab.scrollTop = addToHistory
      ? 0
      : (tab.historyScrollPositions?.[tab.historyIndex] ?? tab.scrollTop ?? 0)
    urlInput.value = normalizedUrl
    tab.errorMessage = ''
    tab.tags = []
    tab.tagGroups = []
    tab.currentTagName = ''
    let isTopicNavigation = false

    try {
      const urlObj = new URL(normalizedUrl)
      const pathname = urlObj.pathname
      const topicListRoute = topicListRouteFromPath(pathname)

      if (pathname === '/' || pathname === '') {
        tab.topicListType = 'latest'
        tab.topicListPeriod = null
        await loadHome(tab)
        tab.title = '首页 - ' + urlObj.hostname
        tab.viewType = 'home'
      } else if (topicListRoute) {
        tab.topicListType = topicListRoute.type
        tab.topicListPeriod =
          topicListRoute.type === 'top'
            ? (topicListRoute.period ?? normalizeTopicListPeriod(urlObj.searchParams.get('period')))
            : null
        await loadHome(tab)
        const labels: Record<TopicListType, string> = {
          latest: '最新',
          new: '新话题',
          unread: '未读',
          unseen: '未见',
          top: '排行',
          hot: '热门',
          posted: '我的帖子',
          bookmarks: '书签'
        }
        tab.title = labels[topicListRoute.type]
        tab.viewType = 'home'
      } else if (pathname.startsWith('/my/messages')) {
        const username = await ensureSessionUser()
        if (!username) throw new Error('无法确定当前登录用户')
        const suffix = pathname.slice('/my/messages'.length).replace(/^\/+/, '')
        const canonicalPath = `/u/${encodeURIComponent(username)}/messages${suffix ? `/${suffix}` : ''}`
        await navigateTo(`${baseUrl.value}${canonicalPath}${urlObj.search}`, addToHistory)
        return
      } else if (pathname.startsWith('/my/notifications')) {
        const notificationFilter = normalizeNotificationFilter(urlObj.searchParams.get('filter'))
        await loadNotifications(tab, notificationFilter)
        tab.title = '通知'
        tab.viewType = 'notifications'
      } else if (pathname.startsWith('/c/')) {
        const categoryRoute = categoryRouteFromPath(pathname)
        if (!categoryRoute) throw new Error('无效的分类地址')
        await loadCategory(tab, categoryRoute.slug, categoryRoute.categoryId)
        tab.title = `分类：${tab.currentCategoryName || categoryRoute.slug}`
        tab.viewType = 'category'
      } else if (
        pathname === '/discourse-ai/ai-bot/conversations' ||
        pathname === '/discourse-ai/ai-bot/conversations/'
      ) {
        await ensureSessionUser()
        tab.title = 'AI Bot 对话'
        tab.viewType = 'ai-bot'
      } else if (pathname.startsWith('/t/')) {
        isTopicNavigation = true
        const parts = pathname.replace('/t/', '').split('/').filter(Boolean)
        const lastPart = parts[parts.length - 1]
        const prevPart = parts[parts.length - 2]
        const lastNum = lastPart ? parseInt(lastPart) : NaN
        const prevNum = prevPart ? parseInt(prevPart) : NaN
        const lastIsNum = !Number.isNaN(lastNum)
        const prevIsNum = !Number.isNaN(prevNum)
        let topicId: number | null = null
        let postNumber: number | null = null

        if (parts.length === 1 && lastIsNum) {
          topicId = lastNum
        } else if (lastIsNum && prevIsNum) {
          topicId = prevNum
          postNumber = lastNum
        } else if (lastIsNum) {
          topicId = lastNum
        } else if (prevIsNum) {
          topicId = prevNum
        } else if (parts[0]) {
          const fallback = parseInt(parts[0])
          topicId = Number.isNaN(fallback) ? null : fallback
        }

        if (!topicId) {
          throw new Error('Invalid topic URL')
        }
        // AI Bot links commonly use `/0` to denote the first post.  Treat it
        // as the topic root instead of trying to load an impossible post 0.
        const normalizedPostNumber = postNumber && postNumber > 0 ? postNumber : null
        tab.targetPostNumber = normalizedPostNumber
        await loadTopic(tab, topicId, normalizedPostNumber)
        tab.viewType = 'topic'
      } else if (pathname.startsWith('/chat')) {
        await ensureSessionUser()
        const parts = pathname.split('/').filter(Boolean)
        const toPositiveId = (value?: string) => {
          const parsed = value ? Number.parseInt(value, 10) : NaN
          return Number.isFinite(parsed) && parsed > 0 ? parsed : null
        }
        const threadSegmentIndex = parts.indexOf('t')
        const targetThreadId =
          threadSegmentIndex >= 0 ? toPositiveId(parts[threadSegmentIndex + 1]) : null
        const targetMessageId =
          threadSegmentIndex >= 0
            ? toPositiveId(parts[threadSegmentIndex + 2])
            : parts[1] === 'c'
              ? toPositiveId(parts[4])
              : parts[1] === 'channel'
                ? null
                : toPositiveId(parts[2])
        let targetChannelId: number | null = null

        if (parts[1] === 'c') {
          targetChannelId = toPositiveId(parts[3])
        } else if (parts[1] === 'channel') {
          // Support both Discourse's /chat/channel/:id/:title legacy route and
          // this browser's older /chat/channel/:slug/:id route.
          targetChannelId = toPositiveId(parts[3]) || toPositiveId(parts[2])
        } else {
          targetChannelId = toPositiveId(parts[1])
        }

        await loadChat(tab, targetChannelId, targetThreadId ? null : targetMessageId)
        tab.viewType = 'chat'
        // /chat/threads → 我的消息串子 tab；其余聊天 URL 回到频道列表
        if (tab.chatState) {
          tab.chatState.chatSidebarTab = parts[1] === 'threads' ? 'threads' : 'public'
        }
        if (targetChannelId && targetThreadId) {
          const thread = await openChatThreadByIdRoute(
            tab,
            baseUrl,
            users,
            targetChannelId,
            targetThreadId,
            targetMessageId
          )
          tab.title = thread?.title?.trim() || '消息串'
        } else {
          closeChatThreadRoute(tab)
          if (tab.chatState) tab.chatState.activeTargetMessageId = targetMessageId
          tab.title = '聊天'
        }
      } else if (pathname.startsWith('/u/')) {
        await ensureSessionUser()
        const pathParts = pathname.replace('/u/', '').split('/').filter(Boolean)
        const username = pathParts[0]
        if (!pathParts[1]) {
          await navigateTo(`${baseUrl.value}/u/${username}/summary`, addToHistory)
          return
        }
        if (pathParts[1] === 'summary') {
          await loadUser(tab, username)
          tab.viewType = 'user'
          tab.title = `${username} - 概览`
        } else if (pathParts[1] === 'activity') {
          const activityKey = pathParts[2] || 'all'
          const activityMap: Record<string, ActivityTabType> = {
            topics: 'topics',
            replies: 'replies',
            'likes-given': 'likes',
            reactions: 'reactions',
            solved: 'solved',
            votes: 'votes',
            portfolio: 'portfolio',
            read: 'read',
            all: 'all'
          }
          const activityTab = activityMap[activityKey] || 'all'
          await loadUserActivity(tab, username, activityTab)
          tab.title = `${username} - 动态`
          tab.viewType = 'activity'
        } else if (pathParts[1] === 'messages' || pathParts[1] === 'private-messages') {
          const messagesTab = messagesTabFromPath(pathname)
          await loadMessages(tab, username, messagesTab)
          tab.title = `${username} - 私信`
          tab.viewType = 'messages'
        } else if (pathParts[1] === 'user-menu-private-messages') {
          await loadMessages(tab, username, 'all')
          tab.title = `${username} - 私信`
          tab.viewType = 'messages'
        } else if (pathParts[1] === 'user-menu-bookmarks') {
          await loadBookmarks(tab)
          tab.title = `${username} - 书签`
          tab.viewType = 'home'
          tab.topicListType = 'bookmarks'
          tab.topicListPeriod = null
        } else if (pathParts[1] === 'notifications') {
          const notificationFilter = normalizeNotificationFilter(
            pathParts[2] || urlObj.searchParams.get('filter')
          )
          await loadNotifications(tab, notificationFilter)
          tab.title = `${username} - 通知`
          tab.viewType = 'notifications'
        } else if (pathParts[1] === 'preferences') {
          await loadUserPreferences(tab, username)
          tab.title = `${username} - 设置`
          tab.viewType = 'preferences'
        } else if (pathParts[1] === 'groups') {
          await loadUser(tab, username)
          tab.title = `${username} - 用户组`
          tab.viewType = 'groups'
        } else if (pathParts[1] === 'invited') {
          await ensureSessionUser()
          await loadUser(tab, username)
          const filterParam = urlObj.searchParams.get('filter')
          const filter: 'pending' | 'redeemed' | 'expired' =
            filterParam === 'redeemed' || filterParam === 'expired' ? filterParam : 'pending'
          await loadInvites(tab, filter)
          tab.title = `${username} - 邀请`
          tab.viewType = 'invites'
        } else if (pathParts[1] === 'badges') {
          await loadUser(tab, username)
          tab.title = `${username} - 徽章`
          tab.viewType = 'badges'
        } else if (pathParts[1] === 'follow') {
          await loadUser(tab, username)
          if (pathParts[2] === 'feed') {
            tab.title = `${username} - 关注动态`
            tab.viewType = 'followFeed'
          } else if (pathParts[2] === 'following') {
            tab.title = `${username} - 正在关注`
            tab.viewType = 'following'
          } else if (pathParts[2] === 'followers') {
            tab.title = `${username} - 关注者`
            tab.viewType = 'followers'
          } else {
            tab.viewType = 'user'
          }
        } else {
          await loadUser(tab, username)
          tab.viewType = 'user'
        }
      } else if (pathname === '/categories') {
        await loadCategories(tab)
        tab.title = '分类'
        tab.viewType = 'categories'
      } else if (pathname === '/tags' || pathname === '/tags.json') {
        await loadTags(tab)
        tab.title = '标签'
        tab.viewType = 'tags'
      } else if (pathname === '/notifications' || pathname === '/notifications.json') {
        const notificationFilter = normalizeNotificationFilter(urlObj.searchParams.get('filter'))
        await loadNotifications(tab, notificationFilter)
        tab.title = '通知'
        tab.viewType = 'notifications'
      } else if (pathname.startsWith('/tag/')) {
        const tagPath = pathname.replace('/tag/', '').replace(/\.json$/i, '')
        const tagName = decodeURIComponent(tagPath || '').trim()
        if (!tagName) {
          throw new Error('Invalid tag URL')
        }
        await loadTag(tab, tagName)
        tab.title = `标签：${tagName}`
        tab.viewType = 'tag'
      } else if (pathname === '/search' || pathname === '/search.json') {
        const query = urlObj.searchParams.get('q') || ''
        await loadSearch(tab, query)
        tab.title = '搜索'
        tab.viewType = 'search'
      } else if (pathname === '/review' || pathname === '/review.json') {
        const statusParam = urlObj.searchParams.get('status')
        const status: ReviewStatus =
          statusParam === 'approved' ||
          statusParam === 'rejected' ||
          statusParam === 'ignored' ||
          statusParam === 'deleted'
            ? statusParam
            : 'pending'
        await loadReview(tab, status)
        tab.title = '审核队列'
        tab.viewType = 'review'
      } else if (pathname === '/invites' || pathname === '/invited') {
        await ensureSessionUser()
        const filterParam = urlObj.searchParams.get('filter')
        const filter: 'pending' | 'redeemed' | 'expired' =
          filterParam === 'redeemed' || filterParam === 'expired' ? filterParam : 'pending'
        await loadInvites(tab, filter)
        tab.title = '邀请'
        tab.viewType = 'invites'
      } else if (pathname.startsWith('/badges/')) {
        // /badges/{id}/-?username=stevessr —— 带 username 查询参数时定位到该用户的徽章页
        const badgeUsername = urlObj.searchParams.get('username')
        await ensureSessionUser()
        const targetUser = badgeUsername || currentUsername.value
        if (!targetUser) throw new Error('无法确定徽章页所属用户')
        await loadUser(tab, targetUser)
        tab.title = `${targetUser} - 徽章`
        tab.viewType = 'badges'
      } else if (pathname.startsWith('/g/') || pathname.startsWith('/groups/')) {
        // 分组兼容：https://linux.do/g/{name} 与 /groups/{name} 都打开分组详情页
        await ensureSessionUser()
        const prefix = pathname.startsWith('/g/') ? '/g/' : '/groups/'
        const groupName = decodeURIComponent(pathname.slice(prefix.length).replace(/\.json$/i, ''))
        if (!groupName) throw new Error('无效的分组地址')
        tab.title = `分组：${groupName}`
        tab.groupName = groupName
        tab.viewType = 'group'
      } else {
        tab.topicListType = 'latest'
        tab.topicListPeriod = null
        await loadHome(tab)
        tab.title = urlObj.hostname
        tab.viewType = 'home'
      }

      if (tab.viewType !== 'topic') {
        tab.targetPostNumber = null
      }

      if (addToHistory && tab.history[tab.historyIndex] !== normalizedUrl) {
        tab.history = tab.history.slice(0, tab.historyIndex + 1)
        tab.historyScrollPositions = (tab.historyScrollPositions || []).slice(
          0,
          tab.historyIndex + 1
        )
        tab.history.push(normalizedUrl)
        tab.historyScrollPositions.push(0)
        tab.historyIndex = tab.history.length - 1
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      if (isTopicNavigation && message.includes('TOPIC_NOT_FOUND_404')) {
        const previousUrl = tab.history[tab.historyIndex]
        if (previousUrl && previousUrl !== normalizedUrl) {
          await navigateTo(previousUrl, false)
          return
        }
      }
      tab.errorMessage = message
      tab.viewType = 'error'
      tab.title = '加载失败'
    } finally {
      tab.loading = false
    }
  }

  // Load home page
  async function loadHome(tab: BrowserTab) {
    await loadHomeRoute(tab, baseUrl, users)
  }

  // Load category
  async function loadCategory(tab: BrowserTab, slug: string, categoryId: number | null = null) {
    await loadCategoryRoute(tab, slug, categoryId, baseUrl, users)
  }

  // Load categories page
  async function loadCategories(tab: BrowserTab) {
    await loadCategoriesRoute(tab, baseUrl, users)
  }

  // Load tags page
  async function loadTags(tab: BrowserTab) {
    await loadTagsRoute(tab, baseUrl)
  }

  async function loadNotifications(
    tab: BrowserTab,
    filter: DiscourseNotificationFilter,
    force = false
  ) {
    const cacheKey = `${baseUrl.value}|${filter}`
    const now = Date.now()
    const cached = notificationsSnapshotCache.get(cacheKey)
    if (!force && cached && cached.expiresAt > now) {
      tab.notifications = cloneNotifications(cached.notifications)
      tab.notificationsFilter = filter
      applyUnreadNotificationState(tab, cached.unreadState)
      return
    }

    const existingRequest = notificationsInFlight.get(cacheKey)
    if (existingRequest) {
      await existingRequest
      const refreshed = notificationsSnapshotCache.get(cacheKey)
      if (refreshed) {
        tab.notifications = cloneNotifications(refreshed.notifications)
        tab.notificationsFilter = filter
        applyUnreadNotificationState(tab, refreshed.unreadState)
      }
      return
    }

    const request = (async () => {
      const unreadStateFromApi = await loadNotificationsRoute(tab, baseUrl, filter)
      const fallbackUnreadState = computeUnreadNotificationState(tab.notifications || [])
      const unreadState = {
        unreadNotifications:
          Number.isFinite(Number(unreadStateFromApi?.unreadNotifications)) &&
          Number(unreadStateFromApi?.unreadNotifications) >= 0
            ? Number(unreadStateFromApi?.unreadNotifications)
            : fallbackUnreadState.unreadNotifications,
        unreadHighPriorityNotifications:
          Number.isFinite(Number(unreadStateFromApi?.unreadHighPriorityNotifications)) &&
          Number(unreadStateFromApi?.unreadHighPriorityNotifications) >= 0
            ? Number(unreadStateFromApi?.unreadHighPriorityNotifications)
            : fallbackUnreadState.unreadHighPriorityNotifications,
        unreadPrivateMessages:
          Number.isFinite(Number(unreadStateFromApi?.unreadPrivateMessages)) &&
          Number(unreadStateFromApi?.unreadPrivateMessages) >= 0
            ? Number(unreadStateFromApi?.unreadPrivateMessages)
            : fallbackUnreadState.unreadPrivateMessages
      }

      applyUnreadNotificationState(tab, unreadState)
      notificationsSnapshotCache.set(cacheKey, {
        expiresAt: Date.now() + NOTIFICATIONS_CACHE_TTL_MS,
        notifications: cloneNotifications(tab.notifications || []),
        unreadState
      })
    })()

    notificationsInFlight.set(cacheKey, request)
    try {
      await request
    } finally {
      notificationsInFlight.delete(cacheKey)
    }
  }

  async function loadSearch(tab: BrowserTab, query: string) {
    if (!tab.searchState) return
    await loadSearchRoute(tab, baseUrl, users, query, tab.searchState.filters, 0)
  }

  function applyNotificationPatch(tab: BrowserTab, payload: unknown) {
    if (!tab) return false

    const data = normalizeMessageBusPayloadObject(payload)
    if (!data) return false

    const notificationId = Number(data.notification_id ?? data.id)
    if (!Number.isFinite(notificationId) || notificationId <= 0) {
      return false
    }

    const normalized = normalizeNotificationsFromResponse({ notifications: [data] })
    const candidate = normalized[0]

    const existing = tab.notifications.find(item => item.id === notificationId)
    if (existing) {
      const wasRead = Boolean(existing.read)
      const mergedData =
        candidate?.data && typeof candidate.data === 'object'
          ? {
              ...(existing.data && typeof existing.data === 'object'
                ? (existing.data as Record<string, any>)
                : {}),
              ...(candidate.data as Record<string, any>)
            }
          : existing.data

      existing.notification_type = candidate?.notification_type || existing.notification_type
      existing.created_at = candidate?.created_at || existing.created_at
      existing.slug = candidate?.slug || existing.slug
      existing.topic_id = candidate?.topic_id ?? existing.topic_id
      existing.post_number = candidate?.post_number ?? existing.post_number
      existing.fancy_title = candidate?.fancy_title || existing.fancy_title
      existing.acting_user_avatar_template =
        candidate?.acting_user_avatar_template || existing.acting_user_avatar_template
      existing.acting_user_name = candidate?.acting_user_name || existing.acting_user_name
      existing.data = mergedData
      existing.read = false

      if (wasRead) {
        tab.unreadNotificationsCount = Math.max(0, Number(tab.unreadNotificationsCount || 0) + 1)
      }
      syncUnreadStateFromNotifications(tab)
      return true
    }

    if (!candidate) return false

    candidate.read = false
    tab.notifications = [candidate, ...(tab.notifications || [])]
    tab.unreadNotificationsCount = Math.max(0, Number(tab.unreadNotificationsCount || 0) + 1)
    syncUnreadStateFromNotifications(tab)
    return true
  }

  function markNotificationReadOptimistic(tab: BrowserTab, path: string) {
    if (!tab || !path) return

    const normalized = path.replace(/^https?:\/\/[^/]+/i, '')

    const markAndSyncUnread = (
      matcher: (notification: DiscourseNotification) => boolean
    ): DiscourseNotification[] => {
      let changed = false
      const updated = (tab.notifications || []).map(notification => {
        if (!matcher(notification) || notification.read) return notification
        changed = true
        return {
          ...notification,
          read: true
        }
      })

      if (changed) {
        const nextUnread = updated.filter(item => !item.read).length
        tab.unreadNotificationsCount = Math.max(0, nextUnread)
        upsertNotificationsSnapshotCache(updated, computeUnreadNotificationState(updated))
      }

      return updated
    }

    if (normalized.startsWith('/t/')) {
      const parts = normalized.split('/').filter(Boolean)
      const topicId = Number(parts[2])
      const postNumber = Number(parts[3])

      tab.notifications = markAndSyncUnread(notification => {
        const notificationTopicId = Number(notification.topic_id || notification.data?.topic_id)
        const notificationPostNumber = Number(
          notification.post_number || notification.data?.post_number
        )

        if (!Number.isFinite(topicId) || notificationTopicId !== topicId) return false
        if (
          Number.isFinite(postNumber) &&
          notificationPostNumber &&
          notificationPostNumber !== postNumber
        ) {
          return false
        }

        return true
      })
      return
    }

    if (normalized.includes('/user-menu-private-messages')) {
      tab.notifications = markAndSyncUnread(notification =>
        [6, 7, 16].includes(notification.notification_type)
      )
      return
    }

    if (normalized.includes('/user-menu-bookmarks')) {
      tab.notifications = markAndSyncUnread(notification => notification.notification_type === 24)
    }
  }

  function mergePendingTopicsIntoTab(
    tab: BrowserTab,
    incomingTopics: DiscourseTopic[],
    mode: 'prepend' | 'replace' = 'prepend'
  ) {
    const currentPending = tab.pendingTopics || []
    const existingIds = new Set(tab.topics.map(topic => topic.id))
    const pendingMap = new Map<number, DiscourseTopic>()

    currentPending.forEach(topic => {
      if (!topic || typeof topic.id !== 'number') return
      if (existingIds.has(topic.id)) return
      pendingMap.set(topic.id, topic)
    })

    incomingTopics.forEach(topic => {
      if (!topic || typeof topic.id !== 'number') return
      if (existingIds.has(topic.id)) return
      if (mode === 'replace' || !pendingMap.has(topic.id)) {
        pendingMap.set(topic.id, topic)
      }
    })

    const sortedPending = Array.from(pendingMap.values()).sort(
      (a, b) =>
        new Date(b.bumped_at || b.last_posted_at || b.created_at).getTime() -
        new Date(a.bumped_at || a.last_posted_at || a.created_at).getTime()
    )

    tab.pendingTopics = sortedPending.length > 0 ? sortedPending : null
    tab.pendingTopicsCount = sortedPending.length
  }

  function mergePendingTopicsByIds(tab: BrowserTab, topicIds: number[]) {
    if (!Array.isArray(topicIds) || topicIds.length === 0) return false
    const normalizedIds = topicIds.map(id => Number(id)).filter(id => Number.isFinite(id) && id > 0)
    if (normalizedIds.length === 0) return false

    const known = new Map<number, DiscourseTopic>()
    ;[...(tab.pendingTopics || []), ...tab.topics].forEach(topic => {
      if (topic && typeof topic.id === 'number') {
        known.set(topic.id, topic)
      }
    })

    const incoming = normalizedIds.map(id => known.get(id)).filter(Boolean) as DiscourseTopic[]
    if (incoming.length === 0) return false

    mergePendingTopicsIntoTab(tab, incoming)
    return true
  }

  async function checkTopicListUpdates(tab: BrowserTab) {
    if (!tab || !['home', 'category', 'tag'].includes(tab.viewType)) return

    await runTabScopedUpdate(tab.id, 'topic-list', async () => {
      let url = ''
      if (tab.viewType === 'home') {
        url = buildTopicListApiUrl(
          baseUrl.value,
          tab.topicListType || 'latest',
          tab.topicListPeriod
        )
      } else if (tab.viewType === 'category') {
        url = tab.currentCategoryId
          ? `${baseUrl.value}/c/${tab.currentCategorySlug}/${tab.currentCategoryId}.json`
          : `${baseUrl.value}/c/${tab.currentCategorySlug}.json`
      } else if (tab.viewType === 'tag') {
        const encoded = encodeURIComponent(tab.currentTagName || '')
        if (!encoded) return
        url = `${baseUrl.value}/tag/${encoded}.json`
      }

      if (!url) return

      const data = await fetchUpdateDataWithCache<any>(
        `topic-list|${url}`,
        url,
        TOPIC_LIST_UPDATE_CACHE_TTL_MS
      )
      const topics = data?.topic_list?.topics || []
      if (!Array.isArray(topics)) return

      mergePendingTopicsIntoTab(tab, topics)

      if (Array.isArray(data?.users)) {
        data.users.forEach((u: DiscourseUser) => users.value.set(u.id, u))
      }
    })
  }

  function applyPendingTopics(tab: BrowserTab) {
    const pending = tab.pendingTopics || []
    if (!pending.length) return
    const existingIds = new Set(tab.topics.map(topic => topic.id))
    const merged = [...pending.filter(topic => !existingIds.has(topic.id)), ...tab.topics]
    tab.topics = merged
    tab.pendingTopics = null
    tab.pendingTopicsCount = 0
  }

  function mergeTopicPosts(tab: BrowserTab, topicId: number, incomingPosts: DiscoursePost[]) {
    if (!tab.currentTopic || tab.currentTopic.id !== topicId) return
    if (!Array.isArray(incomingPosts) || incomingPosts.length === 0) return

    const byId = new Map<number, DiscoursePost>()
    tab.currentTopic.post_stream.posts.forEach(post => {
      if (!post || typeof post.id !== 'number') return
      byId.set(post.id, post)
    })
    incomingPosts.forEach(post => {
      if (!post || typeof post.id !== 'number') return
      const previous = byId.get(post.id)
      byId.set(post.id, previous ? { ...previous, ...post } : post)
    })

    const merged = Array.from(byId.values()).sort(
      (a, b) => (a.post_number || 0) - (b.post_number || 0)
    )
    tab.currentTopic.post_stream.posts = merged
    incomingPosts.forEach(post => {
      if (post && typeof post.id === 'number') {
        tab.loadedPostIds.add(post.id)
      }
    })

    const stream = tab.currentTopic.post_stream?.stream || []
    if (Array.isArray(stream) && stream.length > 0) {
      tab.hasMorePosts = stream.some(id => !tab.loadedPostIds.has(id))
    }

    void sendReadTimings(tab, topicId, baseUrl.value, incomingPosts)
  }

  async function patchTopicFromMessageBus(
    tab: BrowserTab,
    topicId: number,
    postNumber?: number | null
  ) {
    if (!tab.currentTopic || tab.currentTopic.id !== topicId) return false

    await runTabScopedUpdate(tab.id, `topic-patch:${topicId}`, async () => {
      if (typeof postNumber === 'number' && postNumber > 0) {
        await ensurePostsAroundNumberRoute(tab, topicId, postNumber, baseUrl)
      } else {
        const highest = tab.currentTopic?.highest_post_number || tab.currentTopic?.posts_count
        if (typeof highest === 'number' && highest > 0) {
          await ensurePostsAroundNumberRoute(tab, topicId, highest, baseUrl)
        }
      }
    })

    return true
  }

  async function pollTopicUpdates(tab: BrowserTab) {
    if (!tab?.currentTopic) return
    const topicId = tab.currentTopic.id

    await runTabScopedUpdate(tab.id, `topic-stream:${topicId}`, async () => {
      const streamUrl = `${baseUrl.value}/t/${topicId}.json?track_visit=true`
      const data = await fetchUpdateDataWithCache<any>(
        `topic-stream|${streamUrl}`,
        streamUrl,
        TOPIC_STREAM_UPDATE_CACHE_TTL_MS
      )
      if (!data?.post_stream?.stream || !tab.currentTopic) return
      if (tab.currentTopic.id !== topicId) return

      const stream = data.post_stream.stream as number[]
      const newIds = stream.filter(id => !tab.loadedPostIds.has(id))
      if (newIds.length === 0) {
        tab.currentTopic.post_stream.stream = stream
        tab.hasMorePosts = stream.some(id => !tab.loadedPostIds.has(id))
        return
      }

      const requestIds = newIds.slice(-30)
      const idsParam = requestIds.map(id => `post_ids[]=${id}`).join('&')
      const postsUrl = `${baseUrl.value}/t/${topicId}/posts.json?${idsParam}&include_suggested=false`
      const postData = await fetchUpdateDataWithCache<any>(
        `topic-posts|${postsUrl}`,
        postsUrl,
        TOPIC_POSTS_UPDATE_CACHE_TTL_MS
      )
      const newPosts = postData?.post_stream?.posts || []
      if (!Array.isArray(newPosts) || newPosts.length === 0) {
        tab.currentTopic.post_stream.stream = stream
        tab.currentTopic.posts_count = data.posts_count ?? tab.currentTopic.posts_count
        tab.currentTopic.highest_post_number =
          data.highest_post_number ?? tab.currentTopic.highest_post_number
        tab.currentTopic.last_posted_at = data.last_posted_at ?? tab.currentTopic.last_posted_at
        tab.hasMorePosts = stream.some(id => !tab.loadedPostIds.has(id))
        return
      }

      mergeTopicPosts(tab, topicId, newPosts as DiscoursePost[])
      if (!tab.currentTopic || tab.currentTopic.id !== topicId) return
      tab.currentTopic.post_stream.stream = stream
      tab.currentTopic.posts_count = data.posts_count ?? tab.currentTopic.posts_count
      tab.currentTopic.highest_post_number =
        data.highest_post_number ?? tab.currentTopic.highest_post_number
      tab.currentTopic.last_posted_at = data.last_posted_at ?? tab.currentTopic.last_posted_at
      tab.hasMorePosts = stream.some(id => !tab.loadedPostIds.has(id))
    })
  }

  // Load single tag topic list
  async function loadTag(tab: BrowserTab, tagName: string) {
    await loadTagRoute(tab, baseUrl, users, tagName)
  }

  // Load bookmarks
  async function loadBookmarks(tab: BrowserTab) {
    await loadBookmarksRoute(tab, baseUrl, users)
  }

  // Load topic detail
  async function loadTopic(tab: BrowserTab, topicId: number, postNumber?: number | null) {
    await loadTopicRoute(tab, topicId, baseUrl, postNumber)
  }

  async function loadChat(
    tab: BrowserTab,
    targetChannelId?: number | null,
    targetMessageId?: number | null
  ) {
    await loadChatRoute(tab, baseUrl, users, targetChannelId, targetMessageId)
  }

  async function ensureChatLoaded(targetChannelId?: number | null) {
    const tab = activeTab.value
    if (!tab) return false
    if (!tab.chatState || tab.chatState.channels.length === 0) {
      await loadChat(tab, targetChannelId)
    } else if (targetChannelId && tab.chatState.activeChannelId !== targetChannelId) {
      await selectChatChannel(targetChannelId)
    }
    return Boolean(tab.chatState)
  }

  async function loadMyThreads(reset = false) {
    const tab = activeTab.value
    if (!tab?.chatState) return []
    if (!reset && tab.chatState.myThreadsLoaded) return tab.chatState.myThreads
    return await loadMyChatThreads(tab, baseUrl, users, true)
  }

  async function loadMoreMyThreads() {
    const tab = activeTab.value
    if (!tab?.chatState || !tab.chatState.myThreadsLoaded) return []
    if (!tab.chatState.myThreadsLoadMoreUrl) return tab.chatState.myThreads
    return await loadMyChatThreads(tab, baseUrl, users, false)
  }

  async function loadThreadsForChatChannel(channelId: number, reset = false) {
    const tab = activeTab.value
    if (!tab?.chatState) return []
    if (!reset && tab.chatState.channelThreadsLoadedByChannel[channelId]) {
      return tab.chatState.channelThreadsByChannel[channelId] || []
    }
    return await loadChatChannelThreads(tab, baseUrl, users, channelId, true)
  }

  async function loadMoreThreadsForChatChannel(channelId: number) {
    const tab = activeTab.value
    if (!tab?.chatState || !tab.chatState.channelThreadsLoadedByChannel[channelId]) return []
    if (!tab.chatState.channelThreadsLoadMoreUrlByChannel[channelId]) {
      return tab.chatState.channelThreadsByChannel[channelId] || []
    }
    return await loadChatChannelThreads(tab, baseUrl, users, channelId, false)
  }

  async function searchChatMessages(
    query: string,
    channelId: number | null,
    sort: ChatSearchSort,
    reset = true
  ) {
    const tab = activeTab.value
    if (!tab?.chatState) return []
    return await searchChatMessagesRoute(tab, baseUrl, users, query, channelId, sort, reset)
  }

  function applyChatMessagePatch(tab: BrowserTab, channelId: number, payload: unknown) {
    const state = tab.chatState
    if (!state || !Number.isFinite(channelId) || channelId <= 0) return false

    const data = normalizeMessageBusPayloadObject(payload)
    if (!data) return false

    const rawMessage = data.chat_message || data.message || data
    if (!rawMessage || typeof rawMessage !== 'object') return false

    const normalized = normalizeSingleMessage(rawMessage)
    if (!normalized || typeof normalized.id !== 'number') return false

    normalized.chat_channel_id =
      normalized.chat_channel_id || Number(data.chat_channel_id || data.channel_id || channelId)

    const registerNormalizedUser = () => {
      const normalizedUserId = Number(normalized.user?.id ?? normalized.user_id)
      if (!Number.isFinite(normalizedUserId) || normalizedUserId <= 0) return
      const username = normalized.user?.username || normalized.username
      if (!username) return
      const existingUser = users.value.get(normalizedUserId)
      users.value.set(normalizedUserId, {
        id: normalizedUserId,
        username,
        name: normalized.user?.name || normalized.name || existingUser?.name,
        avatar_template:
          normalized.user?.avatar_template ||
          normalized.avatar_template ||
          existingUser?.avatar_template ||
          ''
      })
    }

    const threadId = Number(normalized.thread_id || 0)
    const isThreadReply = Number.isFinite(threadId) && threadId > 0 && !normalized.thread
    if (isThreadReply) {
      const existingThreadMessages = state.threadMessagesById[threadId] || []
      const alreadyExists = existingThreadMessages.some(message => message.id === normalized.id)
      if (state.activeThread?.id === threadId || existingThreadMessages.length > 0) {
        const merged = dedupeMessagesById([...existingThreadMessages, normalized])
        state.threadMessagesById[threadId] = merged
        state.beforeMessageIdByThread[threadId] ??= merged[0]?.id || null
      }
      const messageUserId = Number(normalized.user?.id ?? normalized.user_id ?? 0)
      const currentUserId = Number(tab.currentUser?.id || 0)
      const messageUsername = normalized.user?.username || normalized.username
      const isCurrentUserMessage =
        (messageUserId > 0 && currentUserId > 0 && messageUserId === currentUserId) ||
        Boolean(messageUsername && messageUsername === tab.currentUser?.username)
      syncThreadSummaryFromMessage(
        state,
        threadId,
        normalized,
        !alreadyExists,
        !alreadyExists && state.activeThread?.id !== threadId && !isCurrentUserMessage
      )
      updateChannelLastMessage(state.channels, channelId, normalized)
      registerNormalizedUser()
      return true
    }

    const existing = state.messagesByChannel[channelId] || []
    const alreadyExists = existing.some(message => message?.id === normalized.id)
    const merged = dedupeMessagesById([...existing, normalized])
    state.messagesByChannel[channelId] = merged

    if (merged.length > 0) {
      state.beforeMessageIdByChannel[channelId] = merged[0].id
      updateChannelLastMessage(state.channels, channelId, merged[merged.length - 1])
    }

    const activeChannelId = state.activeChannelId
    if (activeChannelId !== channelId && !alreadyExists) {
      const channel = state.channels.find(item => item.id === channelId)
      if (channel) {
        if (!channel.current_user_membership) {
          channel.current_user_membership = {
            chat_channel_id: channelId
          }
        }
        const currentUnread = Number(channel.current_user_membership.unread_count || 0)
        const nextUnread = currentUnread + 1
        if (Number.isFinite(nextUnread) && nextUnread > currentUnread) {
          channel.current_user_membership.unread_count = nextUnread
        }
      }
    }

    registerNormalizedUser()

    return true
  }

  function applyChatChannelPatch(
    tab: BrowserTab,
    channelId: number,
    payload: unknown | Record<string, any> | null
  ) {
    const state = tab.chatState
    if (!state || !Number.isFinite(channelId) || channelId <= 0) return false

    const data = normalizeMessageBusPayloadObject(payload)
    if (!data) return false

    const channel = state.channels.find(item => item.id === channelId)
    if (!channel) return false

    const channelPayload = isRecordObject(data.chat_channel)
      ? data.chat_channel
      : isRecordObject(data.channel)
        ? data.channel
        : data

    const hasChannelMeta =
      typeof channelPayload.title === 'string' ||
      typeof channelPayload.unicode_title === 'string' ||
      typeof channelPayload.name === 'string' ||
      typeof channelPayload.slug === 'string' ||
      typeof channelPayload.description === 'string' ||
      typeof channelPayload.status === 'string' ||
      isRecordObject(channelPayload.meta) ||
      typeof channelPayload.last_message_id === 'number' ||
      isRecordObject(channelPayload.last_message) ||
      typeof channelPayload.unread_count === 'number' ||
      isRecordObject(channelPayload.current_user_membership) ||
      isRecordObject(channelPayload.chatable) ||
      Array.isArray(channelPayload.direct_message_users)

    if (!hasChannelMeta) return false

    let changed = false
    const incomingLastMessage = isRecordObject(channelPayload.last_message)
      ? (channelPayload.last_message as Record<string, any>)
      : null
    const currentLastMessage = channel.last_message as Record<string, any> | undefined
    const currentLastCreatedAt = String(
      currentLastMessage?.created_at || channel.last_message_sent_at || ''
    )
    const incomingLastCreatedAt = String(
      incomingLastMessage?.created_at || channelPayload.last_message_sent_at || ''
    )
    const currentLastMs = currentLastCreatedAt ? new Date(currentLastCreatedAt).getTime() : 0
    const incomingLastMs = incomingLastCreatedAt ? new Date(incomingLastCreatedAt).getTime() : 0
    const currentLastId = Number(channel.last_message_id || currentLastMessage?.id || 0)
    const incomingLastId = Number(channelPayload.last_message_id || incomingLastMessage?.id || 0)
    const hasCurrentLastMs = Number.isFinite(currentLastMs) && currentLastMs > 0
    const hasIncomingLastMs = Number.isFinite(incomingLastMs) && incomingLastMs > 0
    const applyIncomingLastMessage = hasCurrentLastMs
      ? hasIncomingLastMs
        ? incomingLastMs > currentLastMs ||
          (incomingLastMs === currentLastMs && incomingLastId >= currentLastId)
        : incomingLastId > currentLastId
      : hasIncomingLastMs || incomingLastId >= currentLastId

    const nextTitle =
      typeof channelPayload.title === 'string' && channelPayload.title.trim()
        ? channelPayload.title.trim()
        : typeof channelPayload.name === 'string' && channelPayload.name.trim()
          ? channelPayload.name.trim()
          : ''
    if (nextTitle && channel.title !== nextTitle) {
      channel.title = nextTitle
      changed = true
    }

    if (typeof channelPayload.unicode_title === 'string' && channelPayload.unicode_title.trim()) {
      const nextUnicodeTitle = channelPayload.unicode_title.trim()
      if (channel.unicode_title !== nextUnicodeTitle) {
        channel.unicode_title = nextUnicodeTitle
        changed = true
      }
    }

    if (typeof channelPayload.slug === 'string' && channelPayload.slug.trim()) {
      const nextSlug = channelPayload.slug.trim()
      if (channel.slug !== nextSlug) {
        channel.slug = nextSlug
        changed = true
      }
    }

    if (typeof channelPayload.description === 'string') {
      const nextDescription = channelPayload.description.trim()
      if (channel.description !== nextDescription) {
        channel.description = nextDescription
        changed = true
      }
    }

    if (typeof channelPayload.status === 'string' && channel.status !== channelPayload.status) {
      channel.status = channelPayload.status
      changed = true
    }

    if (isRecordObject(channelPayload.meta)) {
      channel.meta = {
        ...(channel.meta || {}),
        ...(channelPayload.meta as Record<string, any>)
      }
      changed = true
    }

    if (typeof channelPayload.chatable_type === 'string') {
      channel.chatable_type = channelPayload.chatable_type
      changed = true
    }

    if (typeof channelPayload.chatable_id === 'number') {
      channel.chatable_id = channelPayload.chatable_id
      changed = true
    }

    if (applyIncomingLastMessage && typeof channelPayload.last_message_id === 'number') {
      channel.last_message_id = channelPayload.last_message_id
      changed = true
    }

    if (applyIncomingLastMessage && incomingLastMessage) {
      channel.last_message = {
        ...(channel.last_message || {}),
        ...incomingLastMessage
      }
      changed = true
    }

    if (applyIncomingLastMessage && typeof channelPayload.last_message_sent_at === 'string') {
      channel.last_message_sent_at = channelPayload.last_message_sent_at
      changed = true
    }

    if (isRecordObject(channelPayload.chatable)) {
      channel.chatable = {
        ...(channel.chatable || {}),
        ...(channelPayload.chatable as Record<string, any>)
      }
      changed = true
      if (!channel.direct_message_users && Array.isArray(channel.chatable?.users)) {
        channel.direct_message_users = channel.chatable.users
      }
    }

    if (Array.isArray(channelPayload.direct_message_users)) {
      channel.direct_message_users = channelPayload.direct_message_users as DiscourseUser[]
      changed = true
    }

    const unreadCount = Number(
      channelPayload.current_user_membership?.unread_count ?? channelPayload.unread_count
    )
    if (Number.isFinite(unreadCount) && unreadCount >= 0) {
      if (!channel.current_user_membership) {
        channel.current_user_membership = {
          chat_channel_id: channelId
        }
      }
      if (channel.current_user_membership.unread_count !== unreadCount) {
        channel.current_user_membership.unread_count = unreadCount
        changed = true
      }
    }

    return changed
  }

  async function patchChatFromMessageBus(
    tab: BrowserTab,
    channelId: number,
    payload: unknown,
    sourceChannel?: string
  ) {
    if (!tab.chatState || !Number.isFinite(channelId) || channelId <= 0) return false

    const extractMessageId = (data: Record<string, any> | null): number | null => {
      if (!data) return null
      const candidates = [
        data.message_id,
        data.chat_message_id,
        data.chat_message?.id,
        data.message?.id,
        data.last_message_id,
        data.last_message?.id,
        data.id
      ]
      for (const candidate of candidates) {
        const parsed = Number(candidate)
        if (Number.isFinite(parsed) && parsed > 0) return parsed
      }
      return null
    }

    const hasUnreadCountInPayload = (data: Record<string, any> | null): boolean => {
      if (!data) return false
      const unreadCandidates = [
        data.current_user_membership?.unread_count,
        data.unread_count,
        data.channel?.current_user_membership?.unread_count,
        data.channel?.unread_count,
        data.chat_channel?.current_user_membership?.unread_count,
        data.chat_channel?.unread_count
      ]

      return unreadCandidates.some(candidate => {
        const parsed = Number(candidate)
        return Number.isFinite(parsed) && parsed >= 0
      })
    }

    const messagePatched = applyChatMessagePatch(tab, channelId, payload)
    if (messagePatched) return true

    const payloadData = normalizeMessageBusPayloadObject(payload)
    const channelPatched = applyChatChannelPatch(tab, channelId, payloadData)
    const messageId = extractMessageId(payloadData)
    const explicitUnreadCountInPayload = hasUnreadCountInPayload(payloadData)
    const isMessageChannelEvent =
      typeof sourceChannel === 'string' && sourceChannel.includes('/new-messages')
    const shouldFallbackForMessage = isMessageChannelEvent || messageId !== null

    if (!shouldFallbackForMessage) {
      return channelPatched
    }

    await runTabScopedUpdate(tab.id, `chat-channel:${channelId}`, async () => {
      if (tab.chatState?.activeChannelId === channelId) {
        await loadChatMessages(tab, baseUrl, users, channelId, false)
        return
      }

      const chatState = tab.chatState
      if (!chatState) return

      const channel = chatState.channels.find(item => item.id === channelId)
      if (!channel) return

      let shouldIncrementUnread = false
      if (messageId) {
        const lastMessage = channel.last_message
        const lastMessageId = Number(channel.last_message_id || lastMessage?.id || 0)
        const isNewerMessage = !Number.isFinite(lastMessageId) || messageId > lastMessageId
        shouldIncrementUnread = isNewerMessage

        if (isNewerMessage) {
          const fallbackMessage: ChatMessage = {
            id: messageId,
            created_at: new Date().toISOString(),
            chat_channel_id: channelId
          }
          updateChannelLastMessage(chatState.channels, channelId, fallbackMessage)
        }
      }

      if (!channel.current_user_membership) {
        channel.current_user_membership = {
          chat_channel_id: channelId
        }
      }

      if (shouldIncrementUnread && !explicitUnreadCountInPayload) {
        const currentUnread = Number(channel.current_user_membership.unread_count || 0)
        if (Number.isFinite(currentUnread)) {
          channel.current_user_membership.unread_count = currentUnread + 1
        }
      }
    })

    return true
  }

  // Load user profile
  async function loadUser(tab: BrowserTab, username: string) {
    await loadUserRoute(tab, username, baseUrl, users)
  }

  async function loadUserPreferences(tab: BrowserTab, username: string) {
    await loadUserPreferencesRoute(tab, username, baseUrl)
  }

  // Load user activity
  async function loadUserActivity(
    tab: BrowserTab,
    username: string,
    activityTab: ActivityTabType = 'all'
  ) {
    await loadUserActivityRoute(tab, username, activityTab, baseUrl)
  }

  // Load activity data for specific tab
  async function loadActivityData(
    tab: BrowserTab,
    username: string,
    activityTab: ActivityTabType,
    reset = false
  ) {
    await loadActivityDataRoute(tab, username, activityTab, baseUrl, reset)
  }

  // Switch activity tab
  async function switchActivityTab(activityTab: ActivityTabType) {
    const tab = activeTab.value
    if (!tab || !tab.currentUser || !tab.activityState) return
    const username = tab.currentUser.username
    const subPath = activityTab === 'all' ? '' : activityTab
    const pathSegment = activityTab === 'likes' ? 'likes-given' : subPath
    const target = subPath
      ? `${baseUrl.value}/u/${username}/activity/${pathSegment}`
      : `${baseUrl.value}/u/${username}/activity`
    // silent：切子 tab 只重渲染列表区域，避免整页载入动画
    navigateTo(target, true, { silent: true })
  }

  // Load more activity items
  async function loadMoreActivity() {
    await loadMoreActivityRoute(activeTab, baseUrl, isLoadingMore)
  }

  // Load messages
  async function loadMessages(
    tab: BrowserTab,
    username: string,
    messagesTab: MessagesTabType = 'all'
  ) {
    await loadMessagesRoute(tab, username, messagesTab, baseUrl, users)
  }

  async function loadMoreFollowFeed() {
    await loadMoreFollowFeedRoute(activeTab, baseUrl, isLoadingMore)
  }

  // Switch messages tab
  async function switchMessagesTab(messagesTab: MessagesTabType) {
    const tab = activeTab.value
    if (!tab || !tab.currentUser || !tab.messagesState) return
    const suffix = messagesTab === 'all' ? '' : `/${messagesTab}`
    await navigateTo(
      `${baseUrl.value}/u/${encodeURIComponent(tab.currentUser.username)}/messages${suffix}`
    )
  }

  // Load more messages
  async function loadMoreMessages() {
    await loadMoreMessagesRoute(activeTab, baseUrl, users, isLoadingMore)
  }

  async function searchDiscourse(query: string, filters: DiscourseSearchFilters) {
    const tab = activeTab.value
    if (!tab || !tab.searchState) return
    tab.searchState.filters = { ...filters }
    await loadSearchRoute(tab, baseUrl, users, query, filters, 0)
    tab.viewType = 'search'
  }

  async function loadMoreSearchResults() {
    const tab = activeTab.value
    if (!tab || !tab.searchState || tab.searchState.loading || !tab.searchState.hasMore) return
    const nextPage = tab.searchState.page + 1
    await loadSearchRoute(
      tab,
      baseUrl,
      users,
      tab.searchState.query,
      tab.searchState.filters,
      nextPage
    )
  }

  function applyMessageBusListPatch(
    tab: BrowserTab,
    payload: unknown,
    options: MessageBusListPatchOptions = {}
  ) {
    if (!tab || !['home', 'category', 'tag'].includes(tab.viewType)) return false

    const data = normalizeMessageBusPayloadObject(payload)
    if (!data) return false

    const topicBelongsToCurrentList = (topic: DiscourseTopic) => {
      if (tab.viewType === 'home') return true

      if (tab.viewType === 'category') {
        if (!tab.currentCategoryId) return false
        const categoryId = Number(topic.category_id)
        return Number.isFinite(categoryId) && categoryId === tab.currentCategoryId
      }

      if (tab.viewType === 'tag') {
        const normalizedTag = tab.currentTagName.trim().toLowerCase()
        if (!normalizedTag) return false
        const topicTags = Array.isArray(topic.tags)
          ? topic.tags
              .map(tag => {
                if (typeof tag === 'string') return tag
                if (tag && typeof tag === 'object') {
                  return String(tag.name || tag.text || '')
                }
                return ''
              })
              .map(tag => tag.trim().toLowerCase())
              .filter(Boolean)
          : []

        return topicTags.includes(normalizedTag)
      }

      return true
    }

    if (tab.viewType === 'category' && tab.currentCategoryId) {
      const payloadCategoryId = Number(data.category_id)
      if (
        Number.isFinite(payloadCategoryId) &&
        payloadCategoryId > 0 &&
        payloadCategoryId !== tab.currentCategoryId
      ) {
        return true
      }
    }

    if (tab.viewType === 'tag' && tab.currentTagName) {
      const payloadTag = typeof data.tag === 'string' ? data.tag.trim().toLowerCase() : ''
      if (payloadTag && payloadTag !== tab.currentTagName.trim().toLowerCase()) {
        return true
      }
    }

    const topicCandidates = [
      data.topic,
      data.topic_data,
      data.latest_topic,
      data.new_topic,
      data.unread_topic
    ].filter(Boolean)

    const normalizedTopics = topicCandidates
      .filter(item => item && typeof item === 'object')
      .map(item => item as DiscourseTopic)
      .filter(item => typeof item.id === 'number')
      .filter(topicBelongsToCurrentList)

    const idCandidates = [
      data.topic_id,
      data.id,
      ...(Array.isArray(data.topic_ids) ? data.topic_ids : []),
      ...(Array.isArray(data.new_topic_ids) ? data.new_topic_ids : [])
    ]

    const topicIds = idCandidates.map(id => Number(id)).filter(id => Number.isFinite(id) && id > 0)

    let changed = false

    if (normalizedTopics.length > 0) {
      mergePendingTopicsIntoTab(tab, normalizedTopics)
      changed = true
    }

    if (topicIds.length > 0) {
      changed = mergePendingTopicsByIds(tab, topicIds) || changed
    }

    if (options.applyToPending && changed) {
      applyPendingTopics(tab)
    }

    return changed
  }

  function patchTopicListFromMessageBus(tab: BrowserTab, payload: unknown) {
    return applyMessageBusListPatch(tab, payload)
  }

  function patchNotificationsFromMessageBus(tab: BrowserTab, payload: unknown) {
    if (!tab) return false

    const data = normalizeMessageBusPayloadObject(payload)
    if (!data) {
      return applyNotificationPatch(tab, payload)
    }

    applyUnreadNotificationState(tab, {
      unreadNotifications: Number(data.unread_notifications),
      unreadHighPriorityNotifications: Number(data.unread_high_priority_notifications),
      unreadPrivateMessages: Number(data.unread_private_messages)
    })

    const notificationId = Number(data.notification_id ?? data.id)
    const shouldRemoveNotification =
      Boolean(data.dismissed) ||
      Boolean(data.deleted) ||
      data.action === 'dismiss' ||
      data.action === 'delete' ||
      data.type === 'dismiss' ||
      data.type === 'delete'

    const shouldMarkRead =
      Boolean(data.mark_read) ||
      data.read === true ||
      data.action === 'mark_read' ||
      data.type === 'mark_read'

    if (Number.isFinite(notificationId) && notificationId > 0 && shouldRemoveNotification) {
      const previousLength = tab.notifications.length
      tab.notifications = tab.notifications.filter(item => item.id !== notificationId)
      if (tab.notifications.length !== previousLength) {
        syncUnreadStateFromNotifications(tab)
      } else {
        upsertNotificationsSnapshotCache(
          tab.notifications || [],
          computeUnreadNotificationState(tab.notifications || [])
        )
      }
      return true
    }

    if (Number.isFinite(notificationId) && notificationId > 0 && shouldMarkRead) {
      let changed = false
      tab.notifications = tab.notifications.map(item => {
        if (item.id !== notificationId || item.read) return item
        changed = true
        return {
          ...item,
          read: true
        }
      })
      if (changed) {
        syncUnreadStateFromNotifications(tab)
      } else {
        upsertNotificationsSnapshotCache(
          tab.notifications || [],
          computeUnreadNotificationState(tab.notifications || [])
        )
      }
      return true
    }

    const patched = applyNotificationPatch(tab, payload)
    if (!patched) {
      upsertNotificationsSnapshotCache(
        tab.notifications || [],
        computeUnreadNotificationState(tab.notifications || [])
      )
    }

    return patched
  }

  // Open user messages
  function openUserMessages(username: string) {
    navigateTo(`${baseUrl.value}/u/${username}/messages`)
  }

  function openUserGroups(username: string) {
    navigateTo(`${baseUrl.value}/u/${username}/groups`)
  }

  function openUserPreferences(username: string) {
    navigateTo(`${baseUrl.value}/u/${username}/preferences`)
  }

  function openChat() {
    navigateTo(`${baseUrl.value}/chat`)
  }

  function openChatChannel(channel: { id: number; slug?: string }) {
    const slug = channel.slug ? encodeURIComponent(channel.slug) : '-'
    navigateTo(`${baseUrl.value}/chat/c/${slug}/${channel.id}`)
  }

  async function selectChatChannel(channelId: number) {
    const tab = activeTab.value
    if (!tab?.chatState) return
    closeChatThreadRoute(tab)
    tab.chatState.activeChannelId = channelId
    resetChatChannelUnreadCount(tab.chatState.channels, channelId)
    if (!tab.chatState.messagesByChannel[channelId]) {
      await loadChatMessages(tab, baseUrl, users, channelId, true)
    }
  }

  async function loadMoreChatMessagesForChannel(channelId: number) {
    const tab = activeTab.value
    if (!tab?.chatState) return
    if (tab.chatState.loadingMessages) return
    const hasMore = tab.chatState.hasMoreByChannel[channelId]
    if (hasMore === false) return
    await loadChatMessages(tab, baseUrl, users, channelId, false)
  }

  async function sendChat(channelId: number, message: string) {
    const tab = activeTab.value
    if (!tab?.chatState) return

    // If editing an existing message, call edit API
    if (tab.chatState.editingMessage) {
      const editing = tab.chatState.editingMessage
      const updated = await editChatMessage(tab, baseUrl, channelId, editing.id, message)
      if (updated && updated.id) {
        updateChatMessageEverywhere(tab.chatState, updated.id, { ...updated, edited: true })
      }
      tab.chatState.editingMessage = null
      return
    }

    const inReplyToId = tab.chatState.replyToMessage?.id || null
    await sendChatMessage(tab, baseUrl, users, channelId, message, { inReplyToId })
    tab.chatState.replyToMessage = null
  }

  async function openChatMessageThread(message: ChatMessage) {
    const tab = activeTab.value
    const channelId = tab?.chatState?.activeChannelId || message.chat_channel_id
    if (!tab?.chatState || !channelId) return null
    return await openChatThreadRoute(tab, baseUrl, users, channelId, message)
  }

  async function openChatThreadFromList(thread: ChatThread) {
    const tab = activeTab.value
    const channelId = Number(thread.channel_id || thread.channel?.id || 0)
    if (!tab?.chatState || !Number.isFinite(channelId) || channelId <= 0) return null

    if (!tab.chatState.channels.some(channel => channel.id === channelId) && thread.channel) {
      tab.chatState.channels.push(thread.channel)
    }
    if (tab.chatState.activeChannelId !== channelId) {
      await selectChatChannel(channelId)
    }
    const opened = await openChatThreadByIdRoute(tab, baseUrl, users, channelId, thread.id)
    if (opened) {
      // 同步地址栏到消息串 URL：/chat/c/{slug}/{channelId}/t/{threadId}
      const slug = thread.channel?.slug ? encodeURIComponent(thread.channel.slug) : '-'
      const url = `${baseUrl.value.replace(/\/+$/, '')}/chat/c/${slug}/${channelId}/t/${thread.id}`
      tab.url = url
      urlInput.value = url
    }
    return opened
  }

  function closeActiveChatThread() {
    const tab = activeTab.value
    if (!tab?.chatState) return
    closeChatThreadRoute(tab)
  }

  async function loadMoreChatThreadMessagesForActive(threadId: number) {
    const tab = activeTab.value
    const channelId = tab?.chatState?.activeChannelId
    if (!tab?.chatState || !channelId || tab.chatState.loadingThread) return
    if (tab.chatState.threadHasMoreById[threadId] === false) return
    await loadChatThreadMessages(tab, baseUrl, users, channelId, threadId, false)
  }

  async function updateActiveChatThreadNotificationLevel(threadId: number, level: number) {
    const tab = activeTab.value
    if (!tab?.chatState) return null
    const thread =
      (tab.chatState.activeThread?.id === threadId ? tab.chatState.activeThread : null) ||
      tab.chatState.myThreads.find(item => item.id === threadId)
    const channelId = Number(
      thread?.channel_id || thread?.channel?.id || tab.chatState.activeChannelId || 0
    )
    if (!thread || !Number.isFinite(channelId) || channelId <= 0) return null
    return await updateChatThreadNotificationLevelRoute(tab, baseUrl, channelId, threadId, level)
  }

  const updateChatMessageEverywhere = (
    state: NonNullable<BrowserTab['chatState']>,
    messageId: number,
    updates: Partial<ChatMessage>
  ) => {
    for (const [channelId, messages] of Object.entries(state.messagesByChannel)) {
      if (!messages.some(message => message.id === messageId)) continue
      state.messagesByChannel[Number(channelId)] = messages.map(message =>
        message.id === messageId ? { ...message, ...updates } : message
      )
    }
    for (const [threadId, messages] of Object.entries(state.threadMessagesById)) {
      if (!messages.some(message => message.id === messageId)) continue
      state.threadMessagesById[Number(threadId)] = messages.map(message =>
        message.id === messageId ? { ...message, ...updates } : message
      )
    }
  }

  async function sendChatThread(channelId: number, threadId: number, message: string) {
    const tab = activeTab.value
    if (!tab?.chatState || tab.chatState.activeThread?.id !== threadId) return null

    if (tab.chatState.threadEditingMessage) {
      const editing = tab.chatState.threadEditingMessage
      const updated = await editChatMessage(tab, baseUrl, channelId, editing.id, message)
      if (updated?.id) {
        updateChatMessageEverywhere(tab.chatState, updated.id, {
          ...updated,
          edited: true
        })
      }
      tab.chatState.threadEditingMessage = null
      return updated
    }

    const inReplyToId = tab.chatState.threadReplyToMessage?.id || null
    const sent = await sendChatMessage(tab, baseUrl, users, channelId, message, {
      threadId,
      inReplyToId
    })
    if (sent) tab.chatState.threadReplyToMessage = null
    return sent
  }

  async function reactToChatMessage(
    channelId: number,
    messageId: number,
    emoji: string,
    reacted?: boolean
  ) {
    const tab = activeTab.value
    if (!tab?.chatState) return false
    return await toggleChatMessageReaction(tab, baseUrl, channelId, messageId, emoji, reacted)
  }

  async function updateChatChannel(channelId: number, payload: ChatChannelUpdatePayload) {
    const tab = activeTab.value
    if (!tab?.chatState) return null
    return await updateChatChannelRoute(tab, baseUrl, channelId, payload)
  }

  async function replyChatInteraction(channelId: number, messageId: number, actionId: string) {
    const tab = activeTab.value
    if (!tab?.chatState) return null
    return await interactChatMessage(tab, baseUrl, channelId, messageId, actionId)
  }

  function replyToChatMessage(message: ChatMessage) {
    const tab = activeTab.value
    if (!tab?.chatState) return
    tab.chatState.replyToMessage = message
    tab.chatState.editingMessage = null
  }

  function replyToChatThreadMessage(message: ChatMessage) {
    const tab = activeTab.value
    if (!tab?.chatState) return
    tab.chatState.threadReplyToMessage = message
    tab.chatState.threadEditingMessage = null
  }

  function cancelChatReply() {
    const tab = activeTab.value
    if (!tab?.chatState) return
    tab.chatState.replyToMessage = null
  }

  function cancelChatThreadReply() {
    const tab = activeTab.value
    if (!tab?.chatState) return
    tab.chatState.threadReplyToMessage = null
  }

  function editChatMessageAction(message: ChatMessage) {
    const tab = activeTab.value
    if (!tab?.chatState) return
    tab.chatState.editingMessage = message
    tab.chatState.replyToMessage = null
  }

  function editChatThreadMessageAction(message: ChatMessage) {
    const tab = activeTab.value
    if (!tab?.chatState) return
    tab.chatState.threadEditingMessage = message
    tab.chatState.threadReplyToMessage = null
  }

  function cancelChatEdit() {
    const tab = activeTab.value
    if (!tab?.chatState) return
    tab.chatState.editingMessage = null
  }

  function cancelChatThreadEdit() {
    const tab = activeTab.value
    if (!tab?.chatState) return
    tab.chatState.threadEditingMessage = null
  }

  async function deleteChatMessageAction(channelId: number, messageId: number) {
    const tab = activeTab.value
    if (!tab?.chatState) return false
    return await deleteChatMessage(tab, baseUrl, channelId, messageId)
  }

  async function flagChatMessageAction(channelId: number, messageId: number) {
    const tab = activeTab.value
    if (!tab?.chatState) return null
    return await flagChatMessage(tab, baseUrl, channelId, messageId, 4)
  }

  async function searchMessages(query: string) {
    const tab = activeTab.value
    if (!tab?.messagesState) return
    tab.messagesState.searchQuery = query
    tab.messagesState.searching = !!query
    if (!query) {
      tab.messagesState.searchResults = undefined
      tab.messagesState.searching = false
      return
    }
    try {
      const result = await pageFetch<any>(
        `${baseUrl.value}/u/${tab.currentUser?.username}/messages.json?search=${encodeURIComponent(query)}`
      )
      const data = extractData(result)
      if (result.ok && data?.private_messages) {
        tab.messagesState.searchResults = data.private_messages
      }
    } catch {
      tab.messagesState.searchResults = []
    } finally {
      tab.messagesState.searching = false
    }
  }

  // Load more posts (pagination)
  async function loadMorePosts(direction: 'up' | 'down' = 'down') {
    await loadMorePostsRoute(activeTab, baseUrl, isLoadingMore, direction)
  }

  async function ensurePostNumberLoaded(postNumber: number) {
    const tab = activeTab.value
    if (!tab?.currentTopic) return
    await ensurePostsAroundNumberRoute(tab, tab.currentTopic.id, postNumber, baseUrl)
  }

  // Load more topics (pagination for home/category)
  async function loadMoreTopics() {
    await loadMoreTopicsRoute(activeTab, baseUrl, users, isLoadingMore)
  }

  // Navigation functions
  function goBack() {
    const tab = activeTab.value
    if (!tab || tab.historyIndex <= 0) return
    tab.historyIndex--
    navigateTo(tab.history[tab.historyIndex], false)
  }

  function goForward() {
    const tab = activeTab.value
    if (!tab || tab.historyIndex >= tab.history.length - 1) return
    tab.historyIndex++
    navigateTo(tab.history[tab.historyIndex], false)
  }

  function refresh() {
    const tab = activeTab.value
    if (tab) {
      navigateTo(tab.url, false)
    }
  }

  function goHome() {
    navigateTo(baseUrl.value)
  }

  function updateBaseUrl() {
    try {
      const resolved = resolveDiscourseAddressInput(urlInput.value, baseUrl.value)
      if (resolved.origin !== baseUrl.value) {
        baseUrl.value = resolved.origin
      }
      void navigateTo(resolved.url)
    } catch (error) {
      const tab = activeTab.value
      if (tab) {
        tab.errorMessage = error instanceof Error ? error.message : '无效的 URL'
        urlInput.value = tab.url
      }
    }
  }

  // Open topic
  function openTopic(topic: DiscourseTopic) {
    const unread = topic.unread_posts ?? topic.new_posts ?? topic.unread ?? 0
    const lastRead = topic.last_read_post_number
    const target = typeof lastRead === 'number' && lastRead >= 0 && unread > 0 ? lastRead + 1 : null
    const url = target
      ? `${baseUrl.value}/t/${topic.slug}/${topic.id}/${target}`
      : `${baseUrl.value}/t/${topic.slug}/${topic.id}`
    navigateTo(url)
  }

  // Open category
  function openCategory(category: DiscourseCategory) {
    navigateTo(`${baseUrl.value}/c/${category.slug}/${category.id}`)
  }

  // Open in new tab
  function openInNewTab(url: string) {
    createTab(url)
  }

  // Open suggested topic
  function openSuggestedTopic(topic: {
    id: number
    slug: string
    last_read_post_number?: number
    unread_posts?: number
    new_posts?: number
    unread?: number
  }) {
    const unread = topic.unread_posts ?? topic.new_posts ?? topic.unread ?? 0
    const lastRead = topic.last_read_post_number
    const target = typeof lastRead === 'number' && lastRead >= 0 && unread > 0 ? lastRead + 1 : null
    const url = target
      ? `${baseUrl.value}/t/${topic.slug}/${topic.id}/${target}`
      : `${baseUrl.value}/t/${topic.slug}/${topic.id}`
    navigateTo(url)
  }

  // Open quote (navigate to quoted post)
  function openQuote(params: { topicId: number; postNumber: number }) {
    navigateTo(`${baseUrl.value}/t/${params.topicId}/${params.postNumber}`)
  }

  // Open user profile
  function openUser(username: string) {
    navigateTo(`${baseUrl.value}/u/${username}/summary`)
  }

  // Open user activity
  function openUserActivity(username: string) {
    navigateTo(`${baseUrl.value}/u/${username}/activity`)
  }

  function openUserBadges(username: string) {
    navigateTo(`${baseUrl.value}/u/${username}/badges`, true, { silent: true })
  }

  function openUserFollowFeed(username: string) {
    navigateTo(`${baseUrl.value}/u/${username}/follow/feed`, true, { silent: true })
  }

  function openUserFollowing(username: string) {
    navigateTo(`${baseUrl.value}/u/${username}/follow/following`, true, { silent: true })
  }

  function openUserFollowers(username: string) {
    navigateTo(`${baseUrl.value}/u/${username}/follow/followers`, true, { silent: true })
  }

  // Change topic list type (latest, new, unread, etc.)
  async function changeTopicListType(type: TopicListType) {
    await navigateTo(`${baseUrl.value}/${type}`)
  }

  const unreadNotificationsCount = computed(() => {
    const tab = activeTab.value
    if (!tab) return 0

    const tabCount = Number(tab.unreadNotificationsCount)
    if (Number.isFinite(tabCount) && tabCount >= 0) {
      return tabCount
    }

    return tab.notifications?.filter(item => !item.read).length || 0
  })

  // ==================== Review queue ====================

  async function loadReview(tab: BrowserTab, status: ReviewStatus = 'pending') {
    await loadReviewRoute(tab, status, baseUrl, users)
  }

  async function loadMoreReviewables() {
    await loadMoreReviewablesRoute(activeTab, baseUrl, users, isLoadingMore)
  }

  async function performReviewAction(
    reviewableId: number,
    version: number,
    serverAction: string,
    extra: Record<string, any> = {}
  ): Promise<ReviewPerformResult | null> {
    const tab = activeTab.value
    if (!tab?.reviewState) return null
    return await performReviewableActionRoute(
      tab,
      baseUrl,
      reviewableId,
      version,
      serverAction,
      extra
    )
  }

  async function updateActiveChatThreadTitle(threadId: number, title: string) {
    const tab = activeTab.value
    if (!tab?.chatState) return false
    const thread =
      (tab.chatState.activeThread?.id === threadId ? tab.chatState.activeThread : null) ||
      tab.chatState.myThreads.find(item => item.id === threadId) ||
      Object.values(tab.chatState.channelThreadsByChannel)
        .flat()
        .find(item => item.id === threadId)
    const channelId = Number(
      thread?.channel_id || thread?.channel?.id || tab.chatState.activeChannelId || 0
    )
    if (!thread || !Number.isFinite(channelId) || channelId <= 0) return false
    return await updateChatThreadTitleRoute(tab, baseUrl, channelId, threadId, title)
  }

  async function updateReviewableItem(
    reviewableId: number,
    version: number,
    updates: Record<string, any>
  ) {
    const tab = activeTab.value
    if (!tab?.reviewState) return null
    return await updateReviewableRoute(tab, baseUrl, reviewableId, version, updates)
  }

  async function deleteReviewableItem(reviewableId: number, version: number) {
    const tab = activeTab.value
    if (!tab?.reviewState) return false
    return await deleteReviewableRoute(tab, baseUrl, reviewableId, version)
  }

  function openReview(status: ReviewStatus = 'pending') {
    navigateTo(`${baseUrl.value}/review?status=${status}`)
  }

  // ==================== Invites ====================

  async function loadInvites(
    tab: BrowserTab,
    filter: 'pending' | 'redeemed' | 'expired' = 'pending'
  ) {
    const username = tab.currentUser?.username || (await ensureSessionUser()) || ''
    if (!username) {
      if (!tab.invitesState) {
        tab.invitesState = {
          filter,
          invites: [],
          offset: 0,
          hasMore: false,
          loading: false,
          creating: false,
          errorMessage: '未登录，无法加载邀请列表',
          counts: {},
          canSeeInviteDetails: false
        }
      }
      return
    }
    await loadInvitesRoute(tab, username, filter, baseUrl)
  }

  async function loadMoreInvites() {
    await loadMoreInvitesRoute(activeTab, baseUrl, isLoadingMore)
  }

  async function createInvite(payload: {
    email?: string
    groupNames?: string[]
    maxRedemptionsAllowed?: number | null
    expiresAt?: string | null
    customMessage?: string
    description?: string
    skipEmail?: boolean
  }) {
    const tab = activeTab.value
    if (!tab?.invitesState) return null
    return await createInviteRoute(tab, baseUrl, payload)
  }

  async function deleteInvite(inviteId: number) {
    const tab = activeTab.value
    if (!tab?.invitesState) return false
    return await deleteInviteRoute(tab, baseUrl, inviteId)
  }

  async function resendInvite(email: string) {
    const tab = activeTab.value
    if (!tab?.invitesState) return false
    return await resendInviteRoute(tab, baseUrl, email)
  }

  function openInvites() {
    navigateTo(`${baseUrl.value}/invites`)
  }

  // ==================== Private message management ====================

  async function archivePrivateMessage(topicId: number) {
    const tab = activeTab.value
    if (!tab) return false
    return await archivePrivateMessageRoute(tab, topicId, baseUrl)
  }

  async function movePrivateMessageToInbox(topicId: number) {
    const tab = activeTab.value
    if (!tab) return false
    return await movePrivateMessageToInboxRoute(tab, topicId, baseUrl)
  }

  async function markPrivateMessagesRead(topicIds: number[] = []) {
    const tab = activeTab.value
    if (!tab) return false
    return await markPrivateMessagesReadRoute(tab, topicIds, baseUrl)
  }

  // ==================== Chat group & member management ====================

  async function createChatChannel(payload: ChatCreateChannelPayload) {
    const tab = activeTab.value
    if (!tab?.chatState) return null
    return await createChatChannelRoute(tab, baseUrl, payload)
  }

  async function createDirectMessageChannel(payload: ChatCreateDirectMessagePayload) {
    const tab = activeTab.value
    if (!tab?.chatState) return null
    return await createDirectMessageChannelRoute(tab, baseUrl, payload)
  }

  async function getDmChannelForUsernames(usernames: string[]) {
    return await getDmChannelForUsernamesRoute(baseUrl, usernames)
  }

  async function loadChatMembers(channelId: number, reset = true) {
    const tab = activeTab.value
    if (!tab?.chatState) return []
    return await loadChannelMembersRoute(tab, baseUrl, channelId, reset)
  }

  async function addChatMembers(channelId: number, usernames: string[], groups: string[] = []) {
    const tab = activeTab.value
    if (!tab?.chatState) return false
    return await addMembersToChannelRoute(tab, baseUrl, channelId, usernames, groups)
  }

  async function removeChatMember(channelId: number, userId: number) {
    const tab = activeTab.value
    if (!tab?.chatState) return false
    return await removeMemberFromChannelRoute(tab, baseUrl, channelId, userId)
  }

  async function loadDiscoverableChannels() {
    const tab = activeTab.value
    if (!tab?.chatState) return []
    return await loadDiscoverableChannelsRoute(tab, baseUrl)
  }

  async function joinChatChannel(channelId: number) {
    const tab = activeTab.value
    if (!tab?.chatState) return null
    const joined = await joinChatChannelRoute(tab, baseUrl, channelId)
    if (joined) {
      await selectChatChannel(channelId)
      if (!tab.chatState.messagesByChannel[channelId]) {
        await loadChatMessages(tab, baseUrl, users, channelId, true)
      }
    }
    return joined
  }

  async function addUsersToDirectMessageChannel(channelId: number, usernames: string[]) {
    const tab = activeTab.value
    if (!tab?.chatState) return false
    return await addUsersToDirectMessageChannelRoute(tab, baseUrl, channelId, usernames)
  }

  async function followChatChannel(channelId: number) {
    const tab = activeTab.value
    if (!tab?.chatState) return false
    return await followChatChannelRoute(tab, baseUrl, channelId)
  }

  async function unfollowChatChannel(channelId: number) {
    const tab = activeTab.value
    if (!tab?.chatState) return false
    return await unfollowChatChannelRoute(tab, baseUrl, channelId)
  }

  async function deleteChatChannel(channelId: number) {
    const tab = activeTab.value
    if (!tab?.chatState) return false
    return await deleteChatChannelRoute(tab, baseUrl, channelId)
  }

  async function leaveChatChannel(channelId: number) {
    const tab = activeTab.value
    if (!tab?.chatState) return false
    return await leaveChatChannelRoute(tab, baseUrl, channelId)
  }

  async function updateChatStatus(channelId: number, status: ChatChannelEditableStatus) {
    const tab = activeTab.value
    if (!tab?.chatState) return false
    return await updateChatChannelStatusRoute(tab, baseUrl, channelId, status)
  }

  async function updateChatMembership(channelId: number, payload: ChatMembershipUpdatePayload) {
    const tab = activeTab.value
    if (!tab?.chatState) return false
    return await updateMembershipSettingsRoute(tab, baseUrl, channelId, payload)
  }

  async function searchChatables(filter: string, limit = 20) {
    return await searchChatablesRoute(baseUrl, filter, limit)
  }

  return {
    // State
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

    // Tab management
    createTab,
    closeTab,
    switchTab,

    // Navigation
    navigateTo,
    goBack,
    goForward,
    refresh,
    goHome,
    updateBaseUrl,

    // Actions
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
    loadActivityData,
    switchMessagesTab,
    loadMoreMessages,
    loadMoreFollowFeed,
    selectChatChannel,
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
    // Review queue
    loadReview,
    loadMoreReviewables,
    performReviewAction,
    updateReviewableItem,
    deleteReviewableItem,
    openReview,
    // Invites
    loadInvites,
    loadMoreInvites,
    createInvite,
    deleteInvite,
    resendInvite,
    openInvites,
    // Private message management
    archivePrivateMessage,
    movePrivateMessageToInbox,
    markPrivateMessagesRead,
    // Chat group & member management
    createChatChannel,
    createDirectMessageChannel,
    getDmChannelForUsernames,
    loadChatMembers,
    addChatMembers,
    removeChatMember,
    followChatChannel,
    unfollowChatChannel,
    loadDiscoverableChannels,
    joinChatChannel,
    addUsersToDirectMessageChannel,
    deleteChatChannel,
    leaveChatChannel,
    updateChatStatus,
    updateChatMembership,
    searchChatables
  }
}
