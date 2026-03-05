// Discourse Browser Composable

import { ref, computed, watch } from 'vue'

import type {
  BrowserTab,
  ChatMessage,
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
  ChatChannelUpdatePayload
} from './types'
import { generateId, pageFetch, extractData } from './utils'
import {
  loadHome as loadHomeRoute,
  changeTopicListType as changeTopicListTypeRoute,
  loadCategories as loadCategoriesRoute,
  loadTags as loadTagsRoute,
  loadTag as loadTagRoute,
  loadPosted as loadPostedRoute,
  loadBookmarks as loadBookmarksRoute
} from './routes/root'
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
  loadMessagesData as loadMessagesDataRoute,
  loadMoreMessages as loadMoreMessagesRoute,
  loadMoreFollowFeed as loadMoreFollowFeedRoute,
  loadUserPreferences as loadUserPreferencesRoute
} from './routes/user'
import { loadUsernameFromExtension } from './routes/session'
import {
  loadChat as loadChatRoute,
  loadChatMessages,
  sendChatMessage,
  toggleChatMessageReaction,
  updateChatChannel as updateChatChannelRoute,
  interactChatMessage,
  dedupeMessagesById,
  normalizeSingleMessage,
  updateChannelLastMessage
} from './routes/chat'
import { sendReadTimings } from './utils/readTimings'

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
  let sessionUserPromise: Promise<string | null> | null = null

  // Sync URL input with active tab's URL
  watch(
    activeTab,
    tab => {
      if (tab) {
        urlInput.value = tab.url
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

    sessionUserPromise = loadUsernameFromExtension()
      .then(username => {
        currentUsername.value = username
        return username
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
    const targetUrl = url || baseUrl.value
    const newTab: BrowserTab = {
      id,
      title: '新标签页',
      url: targetUrl,
      loading: false,
      history: [targetUrl],
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
    navigateTo(targetUrl)
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
  async function navigateTo(url: string, addToHistory = true) {
    const tab = activeTab.value
    if (!tab) return

    const rawUrl = (url || '').trim()
    const base = baseUrl.value.replace(/\/+$/, '')
    const normalizedUrl = (() => {
      if (!rawUrl) return base
      if (rawUrl.startsWith('/')) return `${base}${rawUrl}`
      if (rawUrl.startsWith('//')) return `https:${rawUrl}`
      try {
        return new URL(rawUrl).toString()
      } catch {
        return new URL(rawUrl, `${base}/`).toString()
      }
    })()

    tab.loading = true
    tab.url = normalizedUrl
    urlInput.value = normalizedUrl
    tab.errorMessage = ''
    tab.tags = []
    tab.tagGroups = []
    tab.currentTagName = ''
    let isTopicNavigation = false

    try {
      const urlObj = new URL(normalizedUrl)
      const pathname = urlObj.pathname

      if (pathname === '/' || pathname === '') {
        await loadHome(tab)
        tab.title = '首页 - ' + urlObj.hostname
        tab.viewType = 'home'
      } else if (pathname.startsWith('/my/notifications')) {
        const filterParam = urlObj.searchParams.get('filter')
        const notificationFilter: DiscourseNotificationFilter =
          filterParam === 'unread' ? 'unread' : 'all'
        await loadNotifications(tab, notificationFilter)
        tab.title = '通知'
        tab.viewType = 'notifications'
      } else if (pathname.startsWith('/c/')) {
        const parts = pathname.replace('/c/', '').split('/').filter(Boolean)
        const categorySlug = parts[0]
        const categoryId = parts[1] ? parseInt(parts[1]) : null
        await loadCategory(tab, categorySlug, categoryId)
        tab.title = `分类：${categorySlug}`
        tab.viewType = 'category'
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
        tab.targetPostNumber = postNumber
        await loadTopic(tab, topicId, postNumber)
        tab.viewType = 'topic'
      } else if (pathname.startsWith('/chat')) {
        await ensureSessionUser()
        const parts = pathname.split('/').filter(Boolean)
        const lastPart = parts[parts.length - 1]
        const channelId = lastPart ? parseInt(lastPart) : NaN
        const targetChannelId = Number.isNaN(channelId) ? null : channelId
        await loadChat(tab, targetChannelId)
        tab.title = '聊天'
        tab.viewType = 'chat'
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
        } else if (pathParts[1] === 'messages') {
          // Messages page
          await loadMessages(tab, username, 'all')
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
        } else if (pathParts[1] === 'notifications') {
          const filterParam = urlObj.searchParams.get('filter')
          const notificationFilter: DiscourseNotificationFilter =
            filterParam === 'unread' ? 'unread' : 'all'
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
        const filterParam = urlObj.searchParams.get('filter')
        const notificationFilter: DiscourseNotificationFilter =
          filterParam === 'unread' ? 'unread' : 'all'
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
      } else if (pathname === '/posted') {
        await loadPosted(tab)
        tab.title = '我的帖子'
        tab.viewType = 'home'
        tab.topicListType = 'posted'
      } else if (pathname === '/bookmarks') {
        await loadBookmarks(tab)
        tab.title = '书签'
        tab.viewType = 'home'
        tab.topicListType = 'bookmarks'
      } else {
        await loadHome(tab)
        tab.title = urlObj.hostname
        tab.viewType = 'home'
      }

      if (tab.viewType !== 'topic') {
        tab.targetPostNumber = null
      }

      if (addToHistory) {
        tab.history = tab.history.slice(0, tab.historyIndex + 1)
        tab.history.push(normalizedUrl)
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

  async function loadNotifications(tab: BrowserTab, filter: DiscourseNotificationFilter) {
    const cacheKey = `${baseUrl.value}|${filter}`
    const now = Date.now()
    const cached = notificationsSnapshotCache.get(cacheKey)
    if (cached && cached.expiresAt > now) {
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
    const data = payload && typeof payload === 'object' ? (payload as Record<string, any>) : null
    if (!data) return false

    const notificationId = Number(data.notification_id ?? data.id)
    if (!Number.isFinite(notificationId) || notificationId <= 0) {
      return false
    }

    const existing = tab.notifications.find(item => item.id === notificationId)
    if (existing) {
      const wasRead = Boolean(existing.read)
      existing.read = false
      if (wasRead) {
        tab.unreadNotificationsCount = Math.max(0, Number(tab.unreadNotificationsCount || 0) + 1)
      }
      syncUnreadStateFromNotifications(tab)
      return true
    }

    const normalized = normalizeNotificationsFromResponse({ notifications: [data] })
    const candidate = normalized[0]
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
        url = `${baseUrl.value}/${tab.topicListType || 'latest'}.json`
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
      const streamUrl = `${baseUrl.value}/t/${topicId}.json`
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

  // Load posted topics
  async function loadPosted(tab: BrowserTab) {
    await loadPostedRoute(tab, baseUrl, users)
  }

  // Load bookmarks
  async function loadBookmarks(tab: BrowserTab) {
    await loadBookmarksRoute(tab, baseUrl, users)
  }

  // Load topic detail
  async function loadTopic(tab: BrowserTab, topicId: number, postNumber?: number | null) {
    await loadTopicRoute(tab, topicId, baseUrl, postNumber)
  }

  async function loadChat(tab: BrowserTab, targetChannelId?: number | null) {
    await loadChatRoute(tab, baseUrl, users, targetChannelId)
  }

  function applyChatMessagePatch(tab: BrowserTab, channelId: number, payload: unknown) {
    const state = tab.chatState
    if (!state || !Number.isFinite(channelId) || channelId <= 0) return false

    const data = payload && typeof payload === 'object' ? (payload as Record<string, any>) : null
    if (!data) return false

    const rawMessage = data.chat_message || data.message || data
    if (!rawMessage || typeof rawMessage !== 'object') return false

    const normalized = normalizeSingleMessage(rawMessage)
    if (!normalized || typeof normalized.id !== 'number') return false

    normalized.chat_channel_id =
      normalized.chat_channel_id || Number(data.chat_channel_id || data.channel_id || channelId)

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

    const normalizedUserId = Number(normalized.user?.id ?? normalized.user_id)
    if (Number.isFinite(normalizedUserId) && normalizedUserId > 0) {
      const username = normalized.user?.username || normalized.username
      if (username) {
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
    }

    return true
  }

  async function patchChatFromMessageBus(tab: BrowserTab, channelId: number, payload: unknown) {
    if (!tab.chatState || !Number.isFinite(channelId) || channelId <= 0) return false

    const extractMessageId = (value: unknown): number | null => {
      if (!value || typeof value !== 'object') return null
      const data = value as Record<string, any>
      const candidates = [
        data.message_id,
        data.id,
        data.chat_message?.id,
        data.message?.id,
        data.payload?.id
      ]
      for (const candidate of candidates) {
        const parsed = Number(candidate)
        if (Number.isFinite(parsed) && parsed > 0) return parsed
      }
      return null
    }

    const patched = applyChatMessagePatch(tab, channelId, payload)
    if (patched) return true

    const messageId = extractMessageId(payload)

    await runTabScopedUpdate(tab.id, `chat-channel:${channelId}`, async () => {
      if (tab.chatState?.activeChannelId === channelId) {
        await loadChatMessages(tab, baseUrl, users, channelId, false)
        return
      }

      const channel = tab.chatState?.channels?.find(item => item.id === channelId)
      if (!channel) return

      if (messageId) {
        const lastMessage = channel.last_message
        const lastMessageId = Number(channel.last_message_id || lastMessage?.id || 0)
        if (!Number.isFinite(lastMessageId) || messageId > lastMessageId) {
          const fallbackMessage: ChatMessage = {
            id: messageId,
            created_at: new Date().toISOString(),
            chat_channel_id: channelId
          }
          updateChannelLastMessage(tab.chatState.channels, channelId, fallbackMessage)
        }
      }

      if (!channel.current_user_membership) {
        channel.current_user_membership = {
          chat_channel_id: channelId
        }
      }

      const currentUnread = Number(channel.current_user_membership.unread_count || 0)
      if (Number.isFinite(currentUnread)) {
        channel.current_user_membership.unread_count = currentUnread + 1
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
    navigateTo(target)
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

  // Load messages data for specific tab
  async function loadMessagesData(
    tab: BrowserTab,
    username: string,
    messagesTab: MessagesTabType,
    reset = false
  ) {
    await loadMessagesDataRoute(tab, username, messagesTab, baseUrl, users, reset)
  }

  async function loadMoreFollowFeed() {
    await loadMoreFollowFeedRoute(activeTab, baseUrl, isLoadingMore)
  }

  // Switch messages tab
  async function switchMessagesTab(messagesTab: MessagesTabType) {
    const tab = activeTab.value
    if (!tab || !tab.currentUser || !tab.messagesState) return

    tab.messagesState.activeTab = messagesTab
    isLoadingMore.value = true

    try {
      await loadMessagesData(tab, tab.currentUser.username, messagesTab, true)
    } finally {
      isLoadingMore.value = false
    }
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

    const data = payload && typeof payload === 'object' ? (payload as Record<string, any>) : null
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

    const data = payload && typeof payload === 'object' ? (payload as Record<string, any>) : null
    if (data) {
      applyUnreadNotificationState(tab, {
        unreadNotifications: Number(data.unread_notifications),
        unreadHighPriorityNotifications: Number(data.unread_high_priority_notifications),
        unreadPrivateMessages: Number(data.unread_private_messages)
      })
      upsertNotificationsSnapshotCache(
        tab.notifications || [],
        computeUnreadNotificationState(tab.notifications || [])
      )
    }

    return applyNotificationPatch(tab, payload)
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
    const slug = channel.slug ? `/${channel.slug}` : ''
    navigateTo(`${baseUrl.value}/chat/channel${slug}/${channel.id}`)
  }

  async function selectChatChannel(channelId: number) {
    const tab = activeTab.value
    if (!tab?.chatState) return
    tab.chatState.activeChannelId = channelId
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
    await sendChatMessage(tab, baseUrl, users, channelId, message)
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
      const url = new URL(urlInput.value)
      baseUrl.value = url.origin
      navigateTo(urlInput.value)
    } catch {
      const tab = activeTab.value
      if (tab) {
        tab.errorMessage = '无效的 URL'
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
    navigateTo(`${baseUrl.value}/u/${username}/badges`)
  }

  function openUserFollowFeed(username: string) {
    navigateTo(`${baseUrl.value}/u/${username}/follow/feed`)
  }

  function openUserFollowing(username: string) {
    navigateTo(`${baseUrl.value}/u/${username}/follow/following`)
  }

  function openUserFollowers(username: string) {
    navigateTo(`${baseUrl.value}/u/${username}/follow/followers`)
  }

  // Change topic list type (latest, new, unread, etc.)
  async function changeTopicListType(type: TopicListType) {
    const tab = activeTab.value
    if (!tab || tab.viewType !== 'home') return

    tab.loading = true
    try {
      await changeTopicListTypeRoute(tab, type, baseUrl, users)
    } catch (err) {
      console.error('[DiscourseBrowser] changeTopicListType error:', err)
      tab.errorMessage = '切换话题列表类型失败'
    } finally {
      tab.loading = false
    }
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
    loadMoreSearchResults
  }
}
