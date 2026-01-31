// Discourse Browser Composable

import { ref, computed, watch } from 'vue'

import type {
  BrowserTab,
  DiscourseCategory,
  DiscourseTopic,
  DiscourseUser,
  ActivityTabType,
  MessagesTabType
} from './types'
import { generateId } from './utils'
import { loadHome as loadHomeRoute } from './routes/root'
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
import { loadSessionUsername } from './routes/session'

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
    currentUsername.value = await loadSessionUsername(baseUrl)
  }

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
      errorMessage: '',
      loadedPostIds: new Set(),
      hasMorePosts: false,
      // Topics pagination
      topicsPage: 0,
      hasMoreTopics: true,
      currentCategorySlug: '',
      currentCategoryId: null,
      activityState: null,
      messagesState: null,
      followFeedPage: 0,
      followFeedHasMore: false,
      targetPostNumber: null,
      topicExtras: null
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

    tab.loading = true
    tab.url = url
    urlInput.value = url
    tab.errorMessage = ''

    try {
      const urlObj = new URL(url)
      const pathname = urlObj.pathname

      if (pathname === '/' || pathname === '') {
        await loadHome(tab)
        tab.title = '首页 - ' + urlObj.hostname
        tab.viewType = 'home'
      } else if (pathname.startsWith('/c/')) {
        const parts = pathname.replace('/c/', '').split('/').filter(Boolean)
        const categorySlug = parts[0]
        const categoryId = parts[1] ? parseInt(parts[1]) : null
        await loadCategory(tab, categorySlug, categoryId)
        tab.title = `分类：${categorySlug}`
        tab.viewType = 'category'
      } else if (pathname.startsWith('/t/')) {
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
        tab.history.push(url)
        tab.historyIndex = tab.history.length - 1
      }
    } catch (e) {
      tab.errorMessage = e instanceof Error ? e.message : String(e)
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

  // Load topic detail
  async function loadTopic(tab: BrowserTab, topicId: number, postNumber?: number | null) {
    await loadTopicRoute(tab, topicId, baseUrl, postNumber)
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

  // Load more posts (pagination)
  async function loadMorePosts() {
    await loadMorePostsRoute(activeTab, baseUrl, isLoadingMore)
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
    navigateTo(`${baseUrl.value}/t/${topic.slug}/${topic.id}`)
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
  function openSuggestedTopic(topic: { id: number; slug: string }) {
    navigateTo(`${baseUrl.value}/t/${topic.slug}/${topic.id}`)
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
    loadMorePosts,
    loadMoreTopics,
    switchActivityTab,
    loadMoreActivity,
    switchMessagesTab,
    loadMoreMessages,
    loadMoreFollowFeed
  }
}
