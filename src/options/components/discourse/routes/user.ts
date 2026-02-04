import type { ComputedRef, Ref } from 'vue'

import type {
  BrowserTab,
  DiscourseTopic,
  DiscourseUser,
  DiscourseUserProfileData,
  ActivityTabType,
  MessagesTabType
} from '../types'
import { pageFetch, extractData } from '../utils'

export async function loadUser(
  tab: BrowserTab,
  username: string,
  baseUrl: Ref<string>,
  users: Ref<Map<number, DiscourseUser>>
) {
  const [
    userResult,
    summaryResult,
    badgesResult,
    followFeedResult,
    followingResult,
    followersResult,
    groupsResult
  ] = await Promise.all([
    pageFetch<any>(`${baseUrl.value}/u/${username}.json`),
    pageFetch<any>(`${baseUrl.value}/u/${username}/summary.json`).catch(() => null),
    pageFetch<any>(`${baseUrl.value}/user-badges/${username}.json?grouped=true`).catch(() => null),
    pageFetch<any>(`${baseUrl.value}/follow/posts/${username}.json`).catch(() => null),
    pageFetch<any>(`${baseUrl.value}/u/${username}/follow/following.json`).catch(() => null),
    pageFetch<any>(`${baseUrl.value}/u/${username}/follow/followers.json`).catch(() => null),
    pageFetch<any>(`${baseUrl.value}/u/${username}/groups.json`).catch(() => null)
  ])

  const userData = extractData(userResult)
  const summaryData = summaryResult ? extractData(summaryResult) : null
  const badgesData = badgesResult ? extractData(badgesResult) : null
  const followFeedData = followFeedResult ? extractData(followFeedResult) : null
  const followingData = followingResult ? extractData(followingResult) : null
  const followersData = followersResult ? extractData(followersResult) : null
  const groupsData = groupsResult ? extractData(groupsResult) : null

  if (userData?.user) {
    const profileData: DiscourseUserProfileData = {
      user: userData.user,
      user_summary: summaryData?.user_summary,
      topics: summaryData?.topics,
      badges: badgesData?.badges || badgesData?.user_badges || [],
      follow_feed: followFeedData?.posts || [],
      following: Array.isArray(followingData) ? followingData : followingData?.users || [],
      followers: Array.isArray(followersData) ? followersData : followersData?.users || [],
      groups: groupsData?.groups || []
    }
    tab.currentUser = profileData.user
    users.value.set(profileData.user.id, profileData.user)
    ;(tab.currentUser as any)._summary = summaryData?.user_summary
    ;(tab.currentUser as any)._topics = summaryData?.topics
    ;(tab.currentUser as any)._badges = profileData.badges
    ;(tab.currentUser as any)._follow_feed = profileData.follow_feed
    ;(tab.currentUser as any)._following = profileData.following
    ;(tab.currentUser as any)._followers = profileData.followers
    ;(tab.currentUser as any)._groups = profileData.groups
    tab.followFeedPage = 0
    tab.followFeedHasMore = !!followFeedData?.extras?.has_more
    tab.title = `${userData.user.username} - 用户主页`
  } else {
    tab.currentUser = null
    throw new Error('用户不存在')
  }
}

export async function loadUserActivity(
  tab: BrowserTab,
  username: string,
  activityTab: ActivityTabType,
  baseUrl: Ref<string>
) {
  if (!tab.currentUser || tab.currentUser.username !== username) {
    const userResult = await pageFetch<any>(`${baseUrl.value}/u/${username}.json`)
    const userData = extractData(userResult)
    if (userData?.user) {
      tab.currentUser = userData.user
    }
  }

  tab.activityState = {
    activeTab: activityTab,
    actions: [],
    topics: [],
    reactions: [],
    solvedPosts: [],
    offset: 0,
    hasMore: true
  }

  await loadActivityData(tab, username, activityTab, baseUrl, true)
}

export async function loadActivityData(
  tab: BrowserTab,
  username: string,
  activityTab: ActivityTabType,
  baseUrl: Ref<string>,
  reset = false
) {
  if (!tab.activityState) return

  if (reset) {
    tab.activityState.offset = 0
    tab.activityState.hasMore = true
    if (
      activityTab === 'topics' ||
      activityTab === 'assigned' ||
      activityTab === 'votes' ||
      activityTab === 'portfolio' ||
      activityTab === 'read'
    ) {
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
      case 'portfolio': {
        const page = Math.floor(offset / 30)
        const params = new URLSearchParams()
        params.append('tags[]', '作品集')
        params.append('order', 'created')
        if (page > 0) {
          params.append('page', String(page))
        }
        url = `${baseUrl.value}/topics/created-by/${username}.json?${params.toString()}`
        break
      }
      case 'read': {
        const page = Math.floor(offset / 30)
        url = `${baseUrl.value}/read.json${page > 0 ? `?page=${page}` : ''}`
        break
      }
      default:
        return
    }

    const result = await pageFetch<any>(url)
    const data = extractData(result)

    if (
      activityTab === 'topics' ||
      activityTab === 'assigned' ||
      activityTab === 'votes' ||
      activityTab === 'portfolio' ||
      activityTab === 'read'
    ) {
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

export async function loadMoreActivity(
  activeTab: ComputedRef<BrowserTab | undefined>,
  baseUrl: Ref<string>,
  isLoadingMore: Ref<boolean>
) {
  const tab = activeTab.value
  if (!tab || !tab.currentUser || !tab.activityState || isLoadingMore.value) return
  if (!tab.activityState.hasMore) return

  isLoadingMore.value = true
  try {
    await loadActivityData(
      tab,
      tab.currentUser.username,
      tab.activityState.activeTab,
      baseUrl,
      false
    )
  } finally {
    isLoadingMore.value = false
  }
}

export async function loadMessages(
  tab: BrowserTab,
  username: string,
  messagesTab: MessagesTabType,
  baseUrl: Ref<string>,
  users: Ref<Map<number, DiscourseUser>>
) {
  if (!tab.currentUser || tab.currentUser.username !== username) {
    const userResult = await pageFetch<any>(`${baseUrl.value}/u/${username}.json`)
    const userData = extractData(userResult)
    if (userData?.user) {
      tab.currentUser = userData.user
    }
  }

  tab.messagesState = {
    activeTab: messagesTab,
    topics: [],
    page: 0,
    hasMore: true
  }

  await loadMessagesData(tab, username, messagesTab, baseUrl, users, true)
}

export async function loadMessagesData(
  tab: BrowserTab,
  username: string,
  messagesTab: MessagesTabType,
  baseUrl: Ref<string>,
  users: Ref<Map<number, DiscourseUser>>,
  reset = false
) {
  if (!tab.messagesState) return

  if (reset) {
    tab.messagesState.page = 0
    tab.messagesState.hasMore = true
    tab.messagesState.topics = []
  }

  const page = tab.messagesState.page

  try {
    let endpoint: string

    switch (messagesTab) {
      case 'all':
        endpoint = `${baseUrl.value}/topics/messages/${username}.json`
        break
      case 'sent':
        endpoint = `${baseUrl.value}/topics/messages-sent/${username}.json`
        break
      case 'new':
        endpoint = `${baseUrl.value}/topics/messages-group/${username}.json`
        break
      case 'unread':
        endpoint = `${baseUrl.value}/topics/messages-unread/${username}.json`
        break
      case 'archive':
        endpoint = `${baseUrl.value}/topics/messages-archive/${username}.json`
        break
      default:
        return
    }

    const url = page > 0 ? `${endpoint}?page=${page}` : endpoint
    const result = await pageFetch<any>(url)
    const data = extractData(result)

    const topics = data?.topic_list?.topics || []
    if (reset) {
      tab.messagesState.topics = topics
    } else {
      const existingIds = new Set(tab.messagesState.topics.map((t: DiscourseTopic) => t.id))
      const newTopics = topics.filter((t: DiscourseTopic) => !existingIds.has(t.id))
      tab.messagesState.topics = [...tab.messagesState.topics, ...newTopics]
    }
    tab.messagesState.hasMore = !!data?.topic_list?.more_topics_url
    tab.messagesState.page += 1

    if (data?.users) {
      data.users.forEach((u: DiscourseUser) => users.value.set(u.id, u))
    }
  } catch (e) {
    console.error('[DiscourseBrowser] loadMessagesData error:', e)
    tab.messagesState.hasMore = false
  }
}

export async function loadMoreMessages(
  activeTab: ComputedRef<BrowserTab | undefined>,
  baseUrl: Ref<string>,
  users: Ref<Map<number, DiscourseUser>>,
  isLoadingMore: Ref<boolean>
) {
  const tab = activeTab.value
  if (!tab || !tab.currentUser || !tab.messagesState || isLoadingMore.value) return
  if (!tab.messagesState.hasMore) return

  isLoadingMore.value = true

  try {
    await loadMessagesData(
      tab,
      tab.currentUser.username,
      tab.messagesState.activeTab,
      baseUrl,
      users,
      false
    )
  } finally {
    isLoadingMore.value = false
  }
}

export async function loadMoreFollowFeed(
  activeTab: ComputedRef<BrowserTab | undefined>,
  baseUrl: Ref<string>,
  isLoadingMore: Ref<boolean>
) {
  const tab = activeTab.value
  if (!tab || isLoadingMore.value || !tab.followFeedHasMore) return
  if (tab.viewType !== 'followFeed' || !tab.currentUser) return

  isLoadingMore.value = true
  tab.followFeedPage += 1

  try {
    const pageParam = tab.followFeedPage > 0 ? `?page=${tab.followFeedPage}` : ''
    const result = await pageFetch<any>(
      `${baseUrl.value}/follow/posts/${tab.currentUser.username}.json${pageParam}`
    )
    const data = extractData(result)
    const posts = data?.posts || []
    const existing = new Set(
      ((tab.currentUser as any)._follow_feed || []).map((p: { id: number }) => p.id)
    )
    const newPosts = posts.filter((p: { id: number }) => !existing.has(p.id))
    ;(tab.currentUser as any)._follow_feed = [
      ...((tab.currentUser as any)._follow_feed || []),
      ...newPosts
    ]
    tab.followFeedHasMore = !!data?.extras?.has_more
  } catch (e) {
    console.error('[DiscourseBrowser] loadMoreFollowFeed error:', e)
    tab.followFeedHasMore = false
  } finally {
    isLoadingMore.value = false
  }
}

export async function loadUserPreferences(tab: BrowserTab, username: string, baseUrl: Ref<string>) {
  if (!tab.currentUser || tab.currentUser.username !== username) {
    const userResult = await pageFetch<any>(`${baseUrl.value}/u/${username}.json`)
    const userData = extractData(userResult)
    if (userData?.user) {
      tab.currentUser = userData.user
    }
  }

  try {
    const result = await pageFetch<any>(`${baseUrl.value}/u/${username}/preferences.json`)
    const data = extractData(result)
    if (data?.user) {
      const userOption = data.user_option || data.user?.user_option
      ;(tab.currentUser as any)._preferences = {
        ...data.user,
        ...(userOption || {})
      }
    }
  } catch (e) {
    console.error('[DiscourseBrowser] loadUserPreferences error:', e)
    ;(tab.currentUser as any)._preferences = null
  }
}
