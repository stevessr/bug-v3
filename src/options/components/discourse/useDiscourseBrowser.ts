// Discourse Browser Composable

import { ref, computed, watch } from 'vue'

import type {
  BrowserTab,
  DiscourseCategory,
  DiscourseTopic,
  DiscourseUser,
  DiscoursePost,
  ActivityTabType,
  MessagesTabType,
  TopicListType,
  DiscourseNotificationFilter
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
import { loadNotifications as loadNotificationsRoute } from './routes/notifications'
import {
  loadCategory as loadCategoryRoute,
  loadMoreTopics as loadMoreTopicsRoute
} from './routes/category'
import { loadTopic as loadTopicRoute, loadMorePosts as loadMorePostsRoute } from './routes/topic'
import {
  loadUser as loadUserRoute,
  loadUserActivity as loadUserActivityRoute,
  loadActivityData as loadActivityDataRoute,
  loadMoreActivity as loadMoreActivityRoute,
  loadMessages as loadMessagesRoute,
  loadMessagesData as loadMessagesDataRoute,
  loadMoreMessages as loadMoreMessagesRoute,
  loadMoreFollowFeed as loadMoreFollowFeedRoute
} from './routes/user'
import { loadUsernameFromExtension } from './routes/session'
import { loadChat as loadChatRoute, loadChatMessages, sendChatMessage } from './routes/chat'
import { sendReadTimings } from './utils/readTimings'

export function useDiscourseBrowser() {
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

  async function ensureSessionUser() {
    if (currentUsername.value !== null) return
    currentUsername.value = await loadUsernameFromExtension()
  }

  watch(
    baseUrl,
    async () => {
      currentUsername.value = await loadUsernameFromExtension()
    },
    { immediate: true }
  )

  void ensureSessionUser()

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
      topicExtras: null,
      lastTimingSentAt: undefined,
      lastTimingTopicId: undefined,
      chatState: null,
      pendingTopics: null,
      pendingTopicsCount: 0
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
        } else if (pathParts[1] === 'notifications') {
          const filterParam = urlObj.searchParams.get('filter')
          const notificationFilter: DiscourseNotificationFilter =
            filterParam === 'unread' ? 'unread' : 'all'
          await loadNotifications(tab, notificationFilter)
          tab.title = `${username} - 通知`
          tab.viewType = 'notifications'
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
    await loadNotificationsRoute(tab, baseUrl, filter)
  }

  async function checkTopicListUpdates(tab: BrowserTab) {
    if (!tab || !['home', 'category', 'tag'].includes(tab.viewType)) return

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

    const result = await pageFetch<any>(url)
    const data = extractData(result)
    const topics = data?.topic_list?.topics || []
    if (!Array.isArray(topics)) return

    const existingIds = new Set(tab.topics.map(topic => topic.id))
    const pending = topics.filter(topic => !existingIds.has(topic.id))
    tab.pendingTopics = pending.length > 0 ? pending : null
    tab.pendingTopicsCount = pending.length

    if (Array.isArray(data?.users)) {
      data.users.forEach((u: DiscourseUser) => users.value.set(u.id, u))
    }
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

  async function pollTopicUpdates(tab: BrowserTab) {
    if (!tab?.currentTopic) return
    const topicId = tab.currentTopic.id
    const result = await pageFetch<any>(`${baseUrl.value}/t/${topicId}.json`)
    const data = extractData(result)
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
    const postsResult = await pageFetch<any>(
      `${baseUrl.value}/t/${topicId}/posts.json?${idsParam}&include_suggested=false`
    )
    const postData = extractData(postsResult)
    const newPosts = postData?.post_stream?.posts || []
    if (!Array.isArray(newPosts) || newPosts.length === 0) return

    tab.currentTopic.post_stream.posts = [...tab.currentTopic.post_stream.posts, ...newPosts].sort(
      (a: DiscoursePost, b: DiscoursePost) => a.post_number - b.post_number
    )
    newPosts.forEach((p: DiscoursePost) => tab.loadedPostIds.add(p.id))
    tab.currentTopic.post_stream.stream = stream
    tab.currentTopic.posts_count = data.posts_count ?? tab.currentTopic.posts_count
    tab.currentTopic.highest_post_number =
      data.highest_post_number ?? tab.currentTopic.highest_post_number
    tab.currentTopic.last_posted_at = data.last_posted_at ?? tab.currentTopic.last_posted_at
    tab.hasMorePosts = stream.some(id => !tab.loadedPostIds.has(id))

    void sendReadTimings(tab, topicId, baseUrl.value, newPosts)
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

  // Load user profile
  async function loadUser(tab: BrowserTab, username: string) {
    await loadUserRoute(tab, username, baseUrl, users)
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

  // Open user messages
  function openUserMessages(username: string) {
    navigateTo(`${baseUrl.value}/u/${username}/messages`)
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
    await sendChatMessage(tab, baseUrl, channelId, message)
  }

  // Load more posts (pagination)
  async function loadMorePosts(direction: 'up' | 'down' = 'down') {
    await loadMorePostsRoute(activeTab, baseUrl, isLoadingMore, direction)
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
    openChat,
    openChatChannel,
    openQuote,
    loadMorePosts,
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
    changeTopicListType,
    loadNotifications,
    checkTopicListUpdates,
    applyPendingTopics,
    pollTopicUpdates
  }
}
