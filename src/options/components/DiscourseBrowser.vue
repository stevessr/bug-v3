<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, computed, watch } from 'vue'
import { message } from 'ant-design-vue'

import { useDiscourseBrowser } from './discourse/useDiscourseBrowser'
import type {
  DiscourseCategory,
  DiscourseTag,
  DiscourseTopic,
  SuggestedTopic,
  ActivityTabType,
  MessagesTabType,
  DiscoursePost,
  DiscourseSearchFilters
} from './discourse/types'
import type { QuickSidebarItem, QuickSidebarSection } from './discourse/layout/QuickSidebarPanel'
import CategoryGrid from './discourse/layout/CategoryGrid'
import TagGrid from './discourse/layout/TagGrid'
import Icon from './discourse/layout/Icon'
import TopicList from './discourse/topic/TopicList'
import TopicView from './discourse/topic/TopicView'
import Composer from './discourse/composer/Composer'
import UserView from './discourse/user/UserView'
import UserExtrasView from './discourse/user/UserExtrasView'
import UserGroupsView from './discourse/user/UserGroupsView'
import UserSettingsView from './discourse/user/UserSettingsView'
import NotificationsDropdown from './discourse/notifications/NotificationsDropdown'
import Sidebar from './discourse/layout/Sidebar'
import QuickSidebarPanel from './discourse/layout/QuickSidebarPanel'
import ActivityView from './discourse/user/ActivityView'
import MessagesView from './discourse/user/MessagesView'
import BrowserToolbar from './discourse/browser/BrowserToolbar'
import BrowserTabs from './discourse/browser/BrowserTabs'
import ChatView from './discourse/chat/ChatView'
import SearchView from './discourse/search/SearchView'
import { pageFetch, extractData } from './discourse/utils'
import { normalizeCategoriesFromResponse } from './discourse/routes/categories'

const {
  baseUrl,
  urlInput,
  tabs,
  activeTabId,
  activeTab,
  users,
  isLoadingMore,
  currentUsername,
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
  loadMoreTopics,
  switchActivityTab,
  loadMoreActivity,
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
  pollTopicUpdates,
  searchDiscourse,
  loadMoreSearchResults
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
const composerMode = ref<'reply' | 'topic' | 'edit' | null>(null)
const replyTarget = ref<{ postNumber: number; username: string } | null>(null)
const editTarget = ref<DiscoursePost | null>(null)
const editInitialRaw = ref('')
const editOriginalRaw = ref('')
const proxiedBlobUrls = new Set<string>()
const proxyingImages = new WeakSet<HTMLImageElement>()
const pollingBusy = ref(false)
const lastTopicPollAt = ref(0)
const lastListPollAt = ref(0)
const lastNotificationsPollAt = ref(0)
const pollTimer = ref<number | null>(null)
const quickSidebarOpen = ref(false)
const quickSidebarLoading = ref(false)
const quickSidebarSections = ref<QuickSidebarSection[]>([])
const quickSidebarError = ref<string | null>(null)
const quickSidebarFetchedAt = ref(0)
const POLL_TICK_MS = 5000
const TOPIC_POLL_INTERVAL_MS = 15000
const LIST_POLL_INTERVAL_MS = 60000
const NOTIFICATIONS_POLL_INTERVAL_MS = 60000
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
const unreadNotificationsCount = computed(
  () => activeTab.value?.notifications?.filter(item => !item.read).length || 0
)
const notificationsOpen = ref(false)

// Scroll event handler (infinite loading for all view types)
const handleScroll = async () => {
  if (!activeTab.value || !contentAreaRef.value) return

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
    } else if (viewType === 'home' || viewType === 'category') {
      loadMoreTopics()
    } else if (viewType === 'activity') {
      loadMoreActivity()
    } else if (viewType === 'messages') {
      loadMoreMessages()
    } else if (viewType === 'followFeed') {
      loadMoreFollowFeed()
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

const buildTagItems = (tags: unknown): QuickSidebarItem[] => {
  if (!Array.isArray(tags)) return []
  return tags
    .map(tag => (typeof tag === 'string' ? tag.trim() : ''))
    .filter(tag => tag.length > 0)
    .map(tag => ({
      id: `tag-${tag}`,
      label: tag,
      path: `/tag/${encodeURIComponent(tag)}`
    }))
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
        { id: 'bookmarks', label: '书签', path: '/bookmarks', icon: 'bookmark' },
        { id: 'posted', label: '我的帖子', path: '/posted', icon: 'pencil' }
      ]
    })

    const regularItems = buildCategoryItems(user.regular_category_ids, categoryMap)
    if (regularItems.length) {
      sections.push({ title: '常用分类', items: regularItems })
    }

    const watchedItems = buildCategoryItems(user.watched_category_ids, categoryMap)
    if (watchedItems.length) {
      sections.push({ title: '关注分类', items: watchedItems })
    }

    const trackedItems = buildCategoryItems(user.tracked_category_ids, categoryMap)
    if (trackedItems.length) {
      sections.push({ title: '追踪分类', items: trackedItems })
    }

    const mutedItems = buildCategoryItems(user.muted_category_ids, categoryMap, true)
    if (mutedItems.length) {
      sections.push({ title: '静音分类', items: mutedItems })
    }

    const watchedTags = buildTagItems(user.watched_tags)
    if (watchedTags.length) {
      sections.push({ title: '关注标签', items: watchedTags })
    }

    const trackedTags = buildTagItems(user.tracked_tags)
    if (trackedTags.length) {
      sections.push({ title: '追踪标签', items: trackedTags })
    }

    const mutedTags = buildTagItems(user.muted_tags)
    if (mutedTags.length) {
      sections.push({ title: '静音标签', items: mutedTags.map(item => ({ ...item, muted: true })) })
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

const handleChangeTopicListType = (
  type: 'latest' | 'new' | 'unread' | 'unseen' | 'top' | 'hot' | 'posted' | 'bookmarks'
) => {
  changeTopicListType(type)
}

const handleNavigate = (path: string) => {
  navigateTo(path)
}

const getTopicListTitle = (type?: string) => {
  const titles: Record<string, string> = {
    latest: '最新话题',
    new: '新话题',
    unread: '未读话题',
    unseen: '未见话题',
    top: '顶流话题',
    hot: '火热话题',
    posted: '我的帖子',
    bookmarks: '我的书签'
  }
  return type ? titles[type] || '话题列表' : '话题列表'
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

watch(
  () => activeTab.value?.viewType,
  () => {
    lastTopicPollAt.value = 0
    lastListPollAt.value = 0
    lastNotificationsPollAt.value = 0
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
    if (quickSidebarOpen.value) {
      void loadQuickSidebar(true)
    }
  }
)

const pollUpdates = async () => {
  const tab = activeTab.value
  if (!tab || tab.loading || pollingBusy.value) return
  const now = Date.now()

  pollingBusy.value = true
  try {
    if (tab.viewType === 'topic' && tab.currentTopic) {
      if (now - lastTopicPollAt.value >= TOPIC_POLL_INTERVAL_MS) {
        lastTopicPollAt.value = now
        await pollTopicUpdates(tab)
      }
    }

    if (now - lastNotificationsPollAt.value >= NOTIFICATIONS_POLL_INTERVAL_MS) {
      lastNotificationsPollAt.value = now
      await loadNotifications(tab, tab.notificationsFilter)
    }

    if (tab.viewType === 'home' || tab.viewType === 'category' || tab.viewType === 'tag') {
      if (now - lastListPollAt.value >= LIST_POLL_INTERVAL_MS) {
        lastListPollAt.value = now
        await checkTopicListUpdates(tab)
      }
    }
  } catch (error) {
    console.warn('[DiscourseBrowser] pollUpdates failed:', error)
  } finally {
    pollingBusy.value = false
  }
}

// Initialize
onMounted(() => {
  ensureSessionUser()
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
  window.addEventListener('error', handleGlobalImageError, true)
  window.addEventListener('load', handleGlobalImageLoad, true)
  pollTimer.value = window.setInterval(pollUpdates, POLL_TICK_MS)
})

onUnmounted(() => {
  if (contentAreaRef.value) {
    contentAreaRef.value.removeEventListener('scroll', handleScroll)
  }
  window.removeEventListener('mousemove', handlePointerMove)
  window.removeEventListener('mouseup', stopPointer)
  window.removeEventListener('touchmove', handlePointerMove)
  window.removeEventListener('touchend', stopPointer)
  window.removeEventListener('error', handleGlobalImageError, true)
  window.removeEventListener('load', handleGlobalImageLoad, true)
  proxiedBlobUrls.forEach(url => URL.revokeObjectURL(url))
  proxiedBlobUrls.clear()
  if (pollTimer.value !== null) {
    window.clearInterval(pollTimer.value)
    pollTimer.value = null
  }
})
</script>

<template>
  <Icon />
  <div
    class="discourse-browser flex flex-col h-full min-h-0 border dark:border-gray-700 rounded-lg overflow-hidden"
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
    >
      <template #right>
        <a-button size="small" class="toolbar-sidebar-btn" @click="toggleQuickSidebar">
          <template #icon><MenuOutlined /></template>
        </a-button>
        <NotificationsDropdown
          :notifications="activeTab?.notifications || []"
          :filter="activeTab?.notificationsFilter || 'all'"
          :unreadCount="unreadNotificationsCount"
          :open="notificationsOpen"
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
      :error="quickSidebarError"
      @close="closeQuickSidebar"
      @navigate="navigateQuickSidebar"
      @refresh="() => loadQuickSidebar(true)"
    />

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
            <div class="flex items-center gap-2">
              <a-button size="small" @click="() => handleNavigate('/search')">搜索</a-button>
              <a-button size="small" @click="toggleTopicComposer">
                {{ composerMode === 'topic' ? '收起' : '发帖' }}
              </a-button>
              <a-button size="small" @click="handleOpenChat">聊天</a-button>
            </div>
          </div>

          <!-- Latest topics -->
          <div v-if="activeTab.topics.length > 0">
            <h3 class="text-lg font-semibold mb-3 dark:text-white">
              {{ getTopicListTitle(activeTab.topicListType) }}
            </h3>
            <div v-if="activeTab.pendingTopicsCount" class="mb-3">
              <a-button type="primary" size="small" @click="handleApplyPendingTopics">
                发现 {{ activeTab.pendingTopicsCount }} 条新话题，点击刷新
              </a-button>
            </div>
            <TopicList
              :topics="activeTab.topics"
              :baseUrl="baseUrl"
              :categories="activeTab.categories"
              :users="activeTab.activeUsers"
              @click="handleTopicClick"
              @middleClick="handleMiddleClick"
              @openUser="handleUserClick"
              @openTag="handleOpenTopicTag"
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
          <Sidebar
            :categories="[]"
            :users="activeTab.activeUsers"
            :baseUrl="baseUrl"
            :topicListType="activeTab.topicListType"
            @clickCategory="handleCategoryClick"
            @clickUser="handleUserClick"
            @changeTopicListType="handleChangeTopicListType"
            @navigateTo="handleNavigate"
          />
        </div>
      </div>

      <!-- Categories view -->
      <div v-else-if="activeTab?.viewType === 'categories'" class="flex gap-4">
        <div class="flex-1 min-w-0">
          <h3 class="text-lg font-semibold mb-6 dark:text-white">分类目录</h3>
          <CategoryGrid
            :categories="activeTab.categories"
            :baseUrl="baseUrl"
            layout="directory"
            @click="handleCategoryClick"
            @topicClick="handleTopicClick"
          />
        </div>
        <div class="w-64 flex-shrink-0 hidden lg:block">
          <Sidebar
            :categories="activeTab.categories"
            :users="activeTab.activeUsers"
            :baseUrl="baseUrl"
            :topicListType="activeTab.topicListType"
            @clickCategory="handleCategoryClick"
            @clickUser="handleUserClick"
            @changeTopicListType="handleChangeTopicListType"
            @navigateTo="handleNavigate"
          />
        </div>
      </div>

      <!-- Tags view -->
      <div v-else-if="activeTab?.viewType === 'tags'" class="flex gap-4">
        <div class="flex-1 min-w-0">
          <TagGrid :tags="activeTab.tags" :groups="activeTab.tagGroups" @click="handleTagClick" />
        </div>
        <div class="w-64 flex-shrink-0 hidden lg:block">
          <Sidebar
            :categories="activeTab.categories"
            :users="activeTab.activeUsers"
            :baseUrl="baseUrl"
            :topicListType="activeTab.topicListType"
            @clickCategory="handleCategoryClick"
            @clickUser="handleUserClick"
            @changeTopicListType="handleChangeTopicListType"
            @navigateTo="handleNavigate"
          />
        </div>
      </div>

      <!-- Notifications view -->
      <div v-else-if="activeTab?.viewType === 'notifications'" class="flex gap-4">
        <div class="flex-1 min-w-0">
          <h3 class="text-lg font-semibold mb-3 dark:text-white">通知</h3>
          <NotificationsView
            :notifications="activeTab.notifications"
            :filter="activeTab.notificationsFilter"
            @changeFilter="handleNotificationFilterChange"
            @open="handleOpenNotification"
          />
        </div>
        <div class="w-64 flex-shrink-0 hidden lg:block">
          <Sidebar
            :categories="[]"
            :users="activeTab.activeUsers"
            :baseUrl="baseUrl"
            :topicListType="activeTab.topicListType"
            @clickCategory="handleCategoryClick"
            @clickUser="handleUserClick"
            @changeTopicListType="handleChangeTopicListType"
            @navigateTo="handleNavigate"
          />
        </div>
      </div>

      <!-- Tag topics view -->
      <div v-else-if="activeTab?.viewType === 'tag'" class="flex gap-4">
        <div class="flex-1 min-w-0">
          <h3 class="text-lg font-semibold mb-3 dark:text-white">
            标签：{{ activeTab.currentTagName }}
          </h3>
          <div v-if="activeTab.pendingTopicsCount" class="mb-3">
            <a-button type="primary" size="small" @click="handleApplyPendingTopics">
              发现 {{ activeTab.pendingTopicsCount }} 条新话题，点击刷新
            </a-button>
          </div>
          <TopicList
            :topics="activeTab.topics"
            :baseUrl="baseUrl"
            :categories="activeTab.categories"
            :users="activeTab.activeUsers"
            @click="handleTopicClick"
            @middleClick="handleMiddleClick"
            @openUser="handleUserClick"
            @openTag="handleOpenTopicTag"
          />
        </div>
        <div class="w-64 flex-shrink-0 hidden lg:block">
          <Sidebar
            :categories="[]"
            :users="activeTab.activeUsers"
            :baseUrl="baseUrl"
            :topicListType="activeTab.topicListType"
            @clickCategory="handleCategoryClick"
            @clickUser="handleUserClick"
            @changeTopicListType="handleChangeTopicListType"
            @navigateTo="handleNavigate"
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
              {{ composerMode === 'topic' ? '收起' : '发帖' }}
            </a-button>
          </div>

          <CategoryGrid
            v-if="activeTab.categories.length > 0"
            :categories="activeTab.categories"
            :baseUrl="baseUrl"
            title="子分类"
            @click="handleCategoryClick"
          />

          <div v-if="activeTab.pendingTopicsCount" class="mb-3">
            <a-button type="primary" size="small" @click="handleApplyPendingTopics">
              发现 {{ activeTab.pendingTopicsCount }} 条新话题，点击刷新
            </a-button>
          </div>

          <TopicList
            :topics="activeTab.topics"
            :baseUrl="baseUrl"
            :categories="activeTab.categories"
            :users="activeTab.activeUsers"
            @click="handleTopicClick"
            @middleClick="handleMiddleClick"
            @openUser="handleUserClick"
            @openTag="handleOpenTopicTag"
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
          <Sidebar
            :categories="activeTab.categories"
            :users="activeTab.activeUsers"
            :baseUrl="baseUrl"
            :topicListType="activeTab.topicListType"
            @clickCategory="handleCategoryClick"
            @clickUser="handleUserClick"
            @changeTopicListType="handleChangeTopicListType"
            @navigateTo="handleNavigate"
          />
        </div>
      </div>

      <!-- Chat view -->
      <ChatView
        v-else-if="activeTab?.viewType === 'chat' && activeTab.chatState"
        :chatState="activeTab.chatState"
        :baseUrl="baseUrl"
        :currentUsername="currentUsername"
        @selectChannel="handleSelectChatChannel"
        @loadMore="handleLoadMoreChatMessages"
        @sendMessage="handleSendChatMessage"
        @navigate="handleContentNavigation"
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
        :currentUsername="currentUsername"
        @openSuggestedTopic="handleSuggestedTopicClick"
        @openUser="handleUserClick"
        @refresh="refresh"
        @replyTo="handleReplyTo"
        @openQuote="handleQuoteClick"
        @navigate="handleContentNavigation"
        @editPost="handleEditPost"
      />

      <!-- User profile view -->
      <UserView
        v-else-if="activeTab?.viewType === 'user' && activeTab.currentUser"
        :user="activeTab.currentUser"
        :baseUrl="baseUrl"
        :showSettings="isViewingSelf"
        :showGroups="true"
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
        :showGroups="true"
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
        :showGroups="true"
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
        :showGroups="true"
        @switchTab="handleMessagesTabSwitch"
        @openTopic="handleUserTopicClick"
        @openUser="handleUserClick"
        @goToProfile="handleGoToProfile"
        @switchMainTab="handleUserMainTabSwitch"
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
        @goToProfile="handleGoToProfile"
        @switchMainTab="handleUserMainTabSwitch"
      />

      <SearchView
        v-else-if="activeTab?.viewType === 'search' && activeTab.searchState"
        :state="activeTab.searchState"
        :baseUrl="baseUrl"
        @search="handleSearch"
        @loadMore="handleLoadMoreSearch"
        @open="handleOpenSearchResult"
      />
    </div>
  </div>

  <div v-if="composerMode" class="floating-composer" :style="floatingStyle">
    <div class="floating-shell">
      <div class="floating-bar" @mousedown="startDrag" @touchstart.prevent="startDrag">
        <span>
          {{
            composerMode === 'topic'
              ? '发帖编辑器'
              : composerMode === 'edit'
                ? '编辑帖子'
                : '回复编辑器'
          }}
        </span>
        <button class="floating-close" @click="handleComposerClose">×</button>
      </div>
      <div class="floating-body">
        <Composer
          :mode="composerMode"
          :baseUrl="baseUrl"
          :topicId="
            composerMode === 'edit'
              ? editTarget?.topic_id || activeTab?.currentTopic?.id
              : activeTab?.currentTopic?.id
          "
          :postId="composerMode === 'edit' ? editTarget?.id : undefined"
          :initialRaw="composerMode === 'edit' ? editInitialRaw : undefined"
          :originalRaw="composerMode === 'edit' ? editOriginalRaw : undefined"
          :replyToPostNumber="composerMode === 'reply' ? replyTarget?.postNumber || null : null"
          :replyToUsername="composerMode === 'reply' ? replyTarget?.username || null : null"
          :categories="composerMode === 'topic' ? activeTab?.categories || [] : []"
          :defaultCategoryId="
            composerMode === 'topic' ? activeTab?.currentCategoryId || null : null
          "
          :currentCategory="composerMode === 'topic' ? currentCategoryOption : null"
          @posted="
            composerMode === 'topic'
              ? handleTopicPosted
              : composerMode === 'edit'
                ? handleEditPosted
                : handleReplyPosted
          "
          @clearReply="handleClearReply"
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
  position: relative;
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
