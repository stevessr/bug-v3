// Discourse Browser Composable

import { ref, computed, watch } from 'vue'

import type {
  BrowserTab,
  ViewType,
  DiscourseCategory,
  DiscourseTopic,
  DiscourseTopicDetail,
  DiscourseUser,
  DiscoursePost,
  DiscourseUserProfileData,
  ActivityTabType,
  DiscourseUserAction,
  DiscourseReaction,
  DiscourseSolvedPost,
  UserActivityState
} from './types'
import { pageFetch, extractData, generateId } from './utils'

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
      activityState: null
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
        const parts = pathname.replace('/t/', '').split('/')
        const topicId = parseInt(parts[parts.length - 1]) || parseInt(parts[0])
        await loadTopic(tab, topicId)
        tab.viewType = 'topic'
      } else if (pathname.startsWith('/u/')) {
        const pathParts = pathname.replace('/u/', '').split('/').filter(Boolean)
        const username = pathParts[0]
        if (pathParts[1] === 'activity' || pathParts[1] === 'summary') {
          // Activity page
          await loadUserActivity(tab, username, 'all')
          tab.title = `${username} - 动态`
          tab.viewType = 'activity'
        } else {
          await loadUser(tab, username)
          tab.viewType = 'user'
        }
      } else {
        await loadHome(tab)
        tab.title = urlObj.hostname
        tab.viewType = 'home'
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
    const [catResult, topicResult] = await Promise.all([
      pageFetch<any>(`${baseUrl.value}/categories.json`),
      pageFetch<any>(`${baseUrl.value}/latest.json`)
    ])

    const catData = extractData(catResult)
    const topicData = extractData(topicResult)

    if (catData?.category_list?.categories) {
      tab.categories = catData.category_list.categories
    } else if (catData?.categories) {
      tab.categories = catData.categories
    } else {
      tab.categories = []
    }

    if (topicData?.topic_list?.topics) {
      tab.topics = topicData.topic_list.topics
      // Check if there are more topics
      tab.hasMoreTopics = topicData.topic_list.more_topics_url ? true : false
    } else {
      tab.topics = []
      tab.hasMoreTopics = false
    }

    // Reset pagination state
    tab.topicsPage = 0
    tab.currentCategorySlug = ''
    tab.currentCategoryId = null

    // Store active users for sidebar
    if (topicData?.users) {
      tab.activeUsers = topicData.users
      topicData.users.forEach((u: DiscourseUser) => users.value.set(u.id, u))
    } else {
      tab.activeUsers = []
    }
  }

  // Load category
  async function loadCategory(tab: BrowserTab, slug: string, categoryId: number | null = null) {
    const url = categoryId
      ? `${baseUrl.value}/c/${slug}/${categoryId}.json`
      : `${baseUrl.value}/c/${slug}.json`

    const result = await pageFetch<any>(url)
    const data = extractData(result)

    if (data?.topic_list?.topics) {
      tab.topics = data.topic_list.topics
      tab.hasMoreTopics = data.topic_list.more_topics_url ? true : false
    } else {
      tab.topics = []
      tab.hasMoreTopics = false
    }

    // Save category info for pagination
    tab.topicsPage = 0
    tab.currentCategorySlug = slug
    tab.currentCategoryId = categoryId

    // Store active users for sidebar
    if (data?.users) {
      tab.activeUsers = data.users
      data.users.forEach((u: DiscourseUser) => users.value.set(u.id, u))
    } else {
      tab.activeUsers = []
    }
  }

  // Load topic detail
  async function loadTopic(tab: BrowserTab, topicId: number) {
    const result = await pageFetch<any>(`${baseUrl.value}/t/${topicId}.json`)
    const data = extractData(result)

    if (data) {
      tab.currentTopic = data
      tab.loadedPostIds = new Set(data.post_stream?.posts?.map((p: DiscoursePost) => p.id) || [])
      tab.hasMorePosts =
        (data.post_stream?.stream?.length || 0) > (data.post_stream?.posts?.length || 0)
      if (data.title) {
        tab.title = data.title
      }
    } else {
      tab.currentTopic = null
      tab.loadedPostIds = new Set()
      tab.hasMorePosts = false
    }
  }

  // Load user profile
  async function loadUser(tab: BrowserTab, username: string) {
    // Fetch user info and summary in parallel
    const [userResult, summaryResult] = await Promise.all([
      pageFetch<any>(`${baseUrl.value}/u/${username}.json`),
      pageFetch<any>(`${baseUrl.value}/u/${username}/summary.json`).catch(() => null)
    ])

    const userData = extractData(userResult)
    const summaryData = summaryResult ? extractData(summaryResult) : null

    if (userData?.user) {
      const profileData: DiscourseUserProfileData = {
        user: userData.user,
        user_summary: summaryData?.user_summary,
        topics: summaryData?.topics
      }
      tab.currentUser = profileData.user
      // Store summary in user object for access
      ;(tab.currentUser as any)._summary = summaryData?.user_summary
      ;(tab.currentUser as any)._topics = summaryData?.topics
      tab.title = `${userData.user.username} - 用户主页`
    } else {
      tab.currentUser = null
      throw new Error('用户不存在')
    }
  }

  // Load user activity
  async function loadUserActivity(
    tab: BrowserTab,
    username: string,
    activityTab: ActivityTabType = 'all'
  ) {
    // First load user profile if not already loaded
    if (!tab.currentUser || tab.currentUser.username !== username) {
      const userResult = await pageFetch<any>(`${baseUrl.value}/u/${username}.json`)
      const userData = extractData(userResult)
      if (userData?.user) {
        tab.currentUser = userData.user
      }
    }

    // Initialize activity state
    tab.activityState = {
      activeTab: activityTab,
      actions: [],
      topics: [],
      reactions: [],
      solvedPosts: [],
      offset: 0,
      hasMore: true
    }

    // Load activity data based on tab type
    await loadActivityData(tab, username, activityTab, true)
  }

  // Load activity data for specific tab
  async function loadActivityData(
    tab: BrowserTab,
    username: string,
    activityTab: ActivityTabType,
    reset = false
  ) {
    if (!tab.activityState) return

    if (reset) {
      tab.activityState.offset = 0
      tab.activityState.hasMore = true
      if (activityTab === 'topics' || activityTab === 'assigned' || activityTab === 'votes') {
        tab.activityState.topics = []
      } else if (activityTab === 'reactions') {
        tab.activityState.reactions = []
      } else if (activityTab === 'solved') {
        tab.activityState.solvedPosts = []
      } else {
        tab.activityState.actions = []
      }
    }

    const offset = tab.activityState.offset

    try {
      let url: string
      let filterParam = ''

      switch (activityTab) {
        case 'all':
          filterParam = '4,5'
          url = `${baseUrl.value}/user_actions.json?offset=${offset}&username=${username}&filter=${filterParam}`
          break
        case 'replies':
          filterParam = '5'
          url = `${baseUrl.value}/user_actions.json?offset=${offset}&username=${username}&filter=${filterParam}`
          break
        case 'likes':
          filterParam = '1'
          url = `${baseUrl.value}/user_actions.json?offset=${offset}&username=${username}&filter=${filterParam}`
          break
        case 'topics': {
          const page = Math.floor(offset / 30)
          url = `${baseUrl.value}/topics/created-by/${username}.json${page > 0 ? `?page=${page}` : ''}`
          break
        }
        case 'reactions':
          url = `${baseUrl.value}/discourse-reactions/posts/reactions.json?username=${username}&offset=${offset}`
          break
        case 'solved':
          url = `${baseUrl.value}/solution/by_user.json?username=${username}&offset=${offset}&limit=20`
          break
        case 'assigned': {
          const assignedPage = Math.floor(offset / 30)
          url = `${baseUrl.value}/topics/messages-assigned/${username}.json?exclude_category_ids%5B%5D=-1&order=&ascending=false${assignedPage > 0 ? `&page=${assignedPage}` : ''}`
          break
        }
        case 'votes': {
          const votesPage = Math.floor(offset / 30)
          url = `${baseUrl.value}/topics/voted-by/${username}.json${votesPage > 0 ? `?page=${votesPage}` : ''}`
          break
        }
        default:
          return
      }

      const result = await pageFetch<any>(url)
      const data = extractData(result)

      if (activityTab === 'topics' || activityTab === 'assigned' || activityTab === 'votes') {
        const topics = data?.topic_list?.topics || []
        if (reset) {
          tab.activityState.topics = topics
        } else {
          const existingIds = new Set(tab.activityState.topics.map((t: DiscourseTopic) => t.id))
          const newTopics = topics.filter((t: DiscourseTopic) => !existingIds.has(t.id))
          tab.activityState.topics = [...tab.activityState.topics, ...newTopics]
        }
        tab.activityState.hasMore = !!data?.topic_list?.more_topics_url
        tab.activityState.offset += 30
      } else if (activityTab === 'reactions') {
        const reactions = data || []
        if (reset) {
          tab.activityState.reactions = reactions
        } else {
          tab.activityState.reactions = [...tab.activityState.reactions, ...reactions]
        }
        tab.activityState.hasMore = reactions.length >= 20
        tab.activityState.offset += reactions.length
      } else if (activityTab === 'solved') {
        const solvedPosts = data?.user_solved_posts || []
        if (reset) {
          tab.activityState.solvedPosts = solvedPosts
        } else {
          tab.activityState.solvedPosts = [...tab.activityState.solvedPosts, ...solvedPosts]
        }
        tab.activityState.hasMore = solvedPosts.length >= 20
        tab.activityState.offset += solvedPosts.length
      } else {
        // user_actions for all, replies, likes
        const actions = data?.user_actions || []
        if (reset) {
          tab.activityState.actions = actions
        } else {
          tab.activityState.actions = [...tab.activityState.actions, ...actions]
        }
        tab.activityState.hasMore = actions.length >= 30
        tab.activityState.offset += actions.length
      }
    } catch (e) {
      console.error('[DiscourseBrowser] loadActivityData error:', e)
      tab.activityState.hasMore = false
    }
  }

  // Switch activity tab
  async function switchActivityTab(activityTab: ActivityTabType) {
    const tab = activeTab.value
    if (!tab || !tab.currentUser || !tab.activityState) return

    tab.activityState.activeTab = activityTab
    isLoadingMore.value = true

    try {
      await loadActivityData(tab, tab.currentUser.username, activityTab, true)
    } finally {
      isLoadingMore.value = false
    }
  }

  // Load more activity items
  async function loadMoreActivity() {
    const tab = activeTab.value
    if (!tab || !tab.currentUser || !tab.activityState || isLoadingMore.value) return
    if (!tab.activityState.hasMore) return

    isLoadingMore.value = true

    try {
      await loadActivityData(tab, tab.currentUser.username, tab.activityState.activeTab, false)
    } finally {
      isLoadingMore.value = false
    }
  }

  // Load more posts (pagination)
  async function loadMorePosts() {
    const tab = activeTab.value
    if (!tab || !tab.currentTopic || isLoadingMore.value || !tab.hasMorePosts) return

    const stream = tab.currentTopic.post_stream?.stream || []
    const unloadedIds = stream.filter((id: number) => !tab.loadedPostIds.has(id))

    if (unloadedIds.length === 0) {
      tab.hasMorePosts = false
      return
    }

    const nextBatch = unloadedIds.slice(0, 20)
    isLoadingMore.value = true

    try {
      const topicId = tab.currentTopic.id
      const idsParam = nextBatch.map((id: number) => `post_ids[]=${id}`).join('&')
      const url = `${baseUrl.value}/t/${topicId}/posts.json?${idsParam}`

      const result = await pageFetch<any>(url)
      const data = extractData(result)

      if (data?.post_stream?.posts && tab.currentTopic) {
        const newPosts = data.post_stream.posts as DiscoursePost[]
        tab.currentTopic.post_stream.posts = [...tab.currentTopic.post_stream.posts, ...newPosts]
        newPosts.forEach((p: DiscoursePost) => tab.loadedPostIds.add(p.id))
        tab.hasMorePosts = stream.some((id: number) => !tab.loadedPostIds.has(id))
      }
    } catch (e) {
      console.error('[DiscourseBrowser] loadMorePosts error:', e)
    } finally {
      isLoadingMore.value = false
    }
  }

  // Load more topics (pagination for home/category)
  async function loadMoreTopics() {
    const tab = activeTab.value
    if (!tab || isLoadingMore.value || !tab.hasMoreTopics) return
    if (tab.viewType !== 'home' && tab.viewType !== 'category') return

    isLoadingMore.value = true
    tab.topicsPage++

    try {
      let url: string
      if (tab.viewType === 'home') {
        url = `${baseUrl.value}/latest.json?page=${tab.topicsPage}`
      } else {
        // Category view
        if (tab.currentCategoryId) {
          url = `${baseUrl.value}/c/${tab.currentCategorySlug}/${tab.currentCategoryId}.json?page=${tab.topicsPage}`
        } else {
          url = `${baseUrl.value}/c/${tab.currentCategorySlug}.json?page=${tab.topicsPage}`
        }
      }

      const result = await pageFetch<any>(url)
      const data = extractData(result)

      if (data?.topic_list?.topics && data.topic_list.topics.length > 0) {
        // Filter out duplicates
        const existingIds = new Set(tab.topics.map(t => t.id))
        const newTopics = data.topic_list.topics.filter(
          (t: DiscourseTopic) => !existingIds.has(t.id)
        )
        tab.topics = [...tab.topics, ...newTopics]
        tab.hasMoreTopics = data.topic_list.more_topics_url ? true : false
      } else {
        tab.hasMoreTopics = false
      }

      if (data?.users) {
        data.users.forEach((u: DiscourseUser) => users.value.set(u.id, u))
      }
    } catch (e) {
      console.error('[DiscourseBrowser] loadMoreTopics error:', e)
      tab.hasMoreTopics = false
    } finally {
      isLoadingMore.value = false
    }
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
    navigateTo(`${baseUrl.value}/u/${username}`)
  }

  // Open user activity
  function openUserActivity(username: string) {
    navigateTo(`${baseUrl.value}/u/${username}/activity`)
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
    loadMorePosts,
    loadMoreTopics,
    switchActivityTab,
    loadMoreActivity
  }
}
