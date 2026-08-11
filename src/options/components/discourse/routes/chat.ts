import type { Ref } from 'vue'

import type {
  BrowserTab,
  ChatChannel,
  ChatChannelEditableStatus,
  ChatChannelUpdatePayload,
  ChatCreateChannelPayload,
  ChatCreateDirectMessagePayload,
  ChatMember,
  ChatMembershipUpdatePayload,
  ChatMessage,
  ChatPinnedMessage,
  ChatSearchSort,
  ChatThread,
  ChatThreadTracking,
  DiscourseUser
} from '../types'
import { pageFetch, extractData } from '../utils'
import { fetchDiscourseChatCapabilities } from '../siteCapabilities'

import { normalizeCategoriesFromResponse } from './categories'

type ChatReactionAction = 'add' | 'remove'

type PostChatMessageOptions = {
  threadId?: number | null
  inReplyToId?: number | null
}

const normalizeReactionEmoji = (emoji: string) =>
  String(emoji || '')
    .trim()
    .replace(/^:([^:]+):$/, '$1')

const CHAT_CHANNEL_ENDPOINTS = ['/chat/api/me/channels']

const CHAT_CHANNEL_SHOW_ENDPOINTS = (channelId: number) => [`/chat/api/channels/${channelId}`]

const CHAT_SEARCH_ENDPOINTS = ['/chat/api/search']

const CHAT_MESSAGE_ENDPOINTS = (channelId: number) => [`/chat/api/channels/${channelId}/messages`]

const CHAT_THREAD_ENDPOINTS = (channelId: number, threadId: number) => [
  `/chat/api/channels/${channelId}/threads/${threadId}`
]

const CHAT_THREAD_CREATE_ENDPOINTS = (channelId: number) => [
  `/chat/api/channels/${channelId}/threads`
]

const CHAT_THREAD_MESSAGE_ENDPOINTS = (channelId: number, threadId: number) => [
  `/chat/api/channels/${channelId}/threads/${threadId}/messages`
]

const CHAT_THREAD_READ_ENDPOINTS = (channelId: number, threadId: number) => [
  `/chat/api/channels/${channelId}/threads/${threadId}/read`
]

const CHAT_CURRENT_USER_THREADS_ENDPOINTS = ['/chat/api/me/threads']

const CHAT_THREAD_NOTIFICATION_SETTINGS_ENDPOINTS = (channelId: number, threadId: number) => [
  `/chat/api/channels/${channelId}/threads/${threadId}/notifications-settings/me`
]

const CHAT_SEND_ENDPOINTS = (channelId: number) => [
  `/chat/${channelId}.json`,
  `/chat/${channelId}`,
  `/chat/api/channels/${channelId}/messages`,
  '/chat/api/chat_messages.json',
  '/chat/api/chat_messages'
]

const CHAT_REACTION_ENDPOINTS = (channelId: number, messageId: number) => [
  `/chat/${channelId}/react/${messageId}.json`,
  `/chat/${channelId}/react/${messageId}`
]

const CHAT_INTERACTION_ENDPOINTS = (channelId: number, messageId: number) => [
  `/chat/api/channels/${channelId}/messages/${messageId}/interactions`
]

const CHAT_CHANNEL_UPDATE_ENDPOINTS = (channelId: number) => [
  `/chat/api/channels/${channelId}`,
  `/chat/api/direct-message-channels/${channelId}`
]

const CHAT_CHANNEL_CREATE_ENDPOINTS = ['/chat/api/channels']

const CHAT_DIRECT_MESSAGE_CREATE_ENDPOINTS = [
  '/chat/api/direct-message-channels',
  '/chat/api/direct-message-channels.json',
  '/chat/api/direct_messages'
]

const CHAT_DIRECT_MESSAGE_LOOKUP_ENDPOINTS = ['/chat/direct_messages.json', '/chat/direct_messages']

const CHAT_DIRECT_MESSAGE_UPDATE_ENDPOINTS = (channelId: number) => [
  `/chat/api/direct-message-channels/${channelId}`,
  `/chat/direct-message-channels/${channelId}.json`,
  `/chat/direct-message-channels/${channelId}`
]

const CHAT_MEMBERSHIPS_ENDPOINTS = (channelId: number) => [
  `/chat/api/channels/${channelId}/memberships`
]

const CHAT_MEMBERSHIP_ME_ENDPOINTS = (channelId: number) => [
  `/chat/api/channels/${channelId}/memberships/me`
]

const CHAT_MEMBERSHIP_FOLLOWS_ENDPOINTS = (channelId: number) => [
  `/chat/api/channels/${channelId}/memberships/me/follows`
]

const CHAT_NOTIFICATIONS_SETTINGS_ENDPOINTS = (channelId: number) => [
  `/chat/api/channels/${channelId}/notifications-settings/me`
]

const CHAT_CHANNEL_STATUS_ENDPOINTS = (channelId: number) => [
  `/chat/api/channels/${channelId}/status`
]

const CHAT_CHATABLES_ENDPOINTS = ['/chat/api/chatables']

const CHAT_MEMBER_REMOVE_ENDPOINTS = (channelId: number, userId: number) => [
  `/chat/api/channels/${channelId}/memberships/${userId}`
]

const CHAT_CHANNEL_DELETE_ENDPOINTS = (channelId: number) => [`/chat/api/channels/${channelId}`]

const CHAT_MESSAGE_EDIT_ENDPOINTS = (channelId: number, messageId: number) => [
  `/chat/api/channels/${channelId}/messages/${messageId}`
]

const CHAT_MESSAGE_DELETE_ENDPOINTS = (channelId: number, messageId: number) => [
  `/chat/api/channels/${channelId}/messages/${messageId}`
]

const CHAT_MESSAGE_FLAG_ENDPOINTS = () => [`/chat/api/chat_messages/flags`]

const CHAT_CHANNEL_PINS_ENDPOINTS = (channelId: number) => [`/chat/api/channels/${channelId}/pins`]

const CHAT_CHANNEL_PINS_READ_ENDPOINTS = (channelId: number) => [
  `/chat/api/channels/${channelId}/pins/read`
]

const CHAT_MESSAGE_PIN_ENDPOINTS = (channelId: number, messageId: number) => [
  `/chat/api/channels/${channelId}/messages/${messageId}/pin`
]

const buildUrlWithQuery = (baseUrl: string, path: string, params?: URLSearchParams) => {
  const query = params && params.toString() ? `?${params.toString()}` : ''
  return `${baseUrl}${path}${query}`
}

const resolveSameOriginChatUrl = (baseUrl: string, path: string) => {
  try {
    const origin = new URL(baseUrl).origin
    const resolved = new URL(path, `${origin}/`)
    return resolved.origin === origin ? resolved.toString() : null
  } catch {
    return null
  }
}

const parseErrorMessage = (data: any, fallback: string) => {
  if (Array.isArray(data?.errors) && data.errors.length > 0) {
    return String(data.errors[0])
  }
  if (typeof data?.error === 'string' && data.error.trim()) return data.error
  if (typeof data?.message === 'string' && data.message.trim()) return data.message
  return fallback
}

const extractMembershipPayload = (data: any): Record<string, any> => {
  const candidate = data?.membership || data
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return {}
  const membershipKeys = [
    'id',
    'chat_channel_id',
    'following',
    'muted',
    'notification_level',
    'starred',
    'unread_count',
    'mention_count',
    'watched_threads_unread_count',
    'last_read_message_id',
    'last_viewed_at',
    'last_viewed_pins_at',
    'has_unseen_pins'
  ]
  return membershipKeys.some(key => key in candidate) ? candidate : {}
}

const normalizeSingleChannel = (
  value: any,
  channelType?: ChatChannel['channelType']
): ChatChannel => {
  const channel = { ...(value as ChatChannel) }
  if (channelType) {
    channel.channelType = channelType
  }
  if (!channel.direct_message_users && channel.chatable?.users?.length) {
    channel.direct_message_users = channel.chatable.users
  }
  return channel
}

const normalizeChatChannels = (data: any): ChatChannel[] => {
  if (!data) return []

  const directRaw = Array.isArray(data.direct_message_channels) ? data.direct_message_channels : []
  const publicRaw = Array.isArray(data.public_channels)
    ? data.public_channels
    : Array.isArray(data.channels)
      ? data.channels
      : Array.isArray(data.chat_channels)
        ? data.chat_channels
        : []

  const direct = directRaw.map((channel: any) => normalizeSingleChannel(channel, 'direct'))
  const publicChannels = publicRaw.map((channel: any) => normalizeSingleChannel(channel, 'public'))
  const channels: ChatChannel[] = [...publicChannels, ...direct]

  const tracking = data.tracking?.channel_tracking || {}
  channels.forEach(channel => {
    const tracked = tracking?.[channel.id]
    if (!tracked) return
    if (!channel.current_user_membership) {
      channel.current_user_membership = { chat_channel_id: channel.id }
    }
    if (typeof tracked.unread_count === 'number') {
      channel.current_user_membership.unread_count = tracked.unread_count
    }
    if (typeof tracked.mention_count === 'number') {
      channel.current_user_membership.mention_count = tracked.mention_count
    }
    if (typeof tracked.watched_threads_unread_count === 'number') {
      channel.current_user_membership.watched_threads_unread_count =
        tracked.watched_threads_unread_count
    }
  })

  return channels
}

export const normalizeSingleMessage = (value: any): ChatMessage => {
  const message = { ...(value as ChatMessage) }
  if (message.channel && typeof message.channel.id === 'number') {
    message.channel = normalizeSingleChannel(message.channel)
    message.chat_channel_id ||= message.channel.id
  }
  if (!Array.isArray(message.reactions)) {
    message.reactions = []
  }
  if (!Array.isArray(message.blocks)) {
    message.blocks = []
  }
  if (message.thread && typeof message.thread.id === 'number') {
    message.thread = normalizeChatThread(message.thread)
  }
  if (message.in_reply_to && typeof message.in_reply_to.id === 'number') {
    message.in_reply_to = normalizeSingleMessage({
      ...message.in_reply_to,
      thread: undefined,
      in_reply_to: undefined
    })
  }
  return message
}

export const normalizeChatThread = (value: any): ChatThread => {
  const source = value?.thread || value || {}
  const thread = { ...(source as ChatThread) }
  if (source.channel && typeof source.channel.id === 'number') {
    thread.channel = normalizeSingleChannel(source.channel)
    thread.channel_id ||= thread.channel.id
  }
  if (source.original_message && typeof source.original_message.id === 'number') {
    thread.original_message = normalizeSingleMessage({
      ...source.original_message,
      thread: undefined
    })
  }
  if (source.preview && typeof source.preview === 'object') {
    thread.preview = {
      ...source.preview,
      participant_users: Array.isArray(source.preview.participant_users)
        ? source.preview.participant_users
        : []
    }
  }
  return thread
}

const normalizeChatThreadTracking = (value: any): ChatThreadTracking => {
  const source = value && typeof value === 'object' ? value : {}
  const toOptionalNumber = (candidate: unknown) => {
    const parsed = Number(candidate)
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined
  }

  return {
    channel_id: toOptionalNumber(source.channel_id),
    unread_count: toOptionalNumber(source.unread_count) ?? 0,
    mention_count: toOptionalNumber(source.mention_count) ?? 0,
    watched_threads_unread_count: toOptionalNumber(source.watched_threads_unread_count) ?? 0,
    last_reply_created_at:
      typeof source.last_reply_created_at === 'string' ? source.last_reply_created_at : null
  }
}

const extractChatThreadList = (data: any) => {
  const rawThreads = Array.isArray(data?.threads) ? data.threads : []
  const rawTracking = data?.tracking?.thread_tracking || data?.tracking || {}
  const threads = rawThreads.map((item: any) => {
    const thread = normalizeChatThread(item)
    thread.tracking = normalizeChatThreadTracking(rawTracking?.[thread.id])
    return thread
  })
  const loadMoreUrl =
    typeof data?.meta?.load_more_url === 'string' && data.meta.load_more_url.trim()
      ? data.meta.load_more_url.trim()
      : null

  return { threads, loadMoreUrl }
}

const extractChatMessages = (data: any): { messages: ChatMessage[]; hasMore: boolean } => {
  if (!data) return { messages: [], hasMore: false }

  const rawMessages = Array.isArray(data.messages)
    ? data.messages
    : Array.isArray(data.chat_messages)
      ? data.chat_messages
      : Array.isArray(data)
        ? data
        : []
  const messages = rawMessages.map((item: any) => normalizeSingleMessage(item))

  const meta = data.meta || data
  const hasMore = !!(
    meta?.can_load_more_past ||
    meta?.can_load_more ||
    meta?.has_more ||
    meta?.more
  )
  return { messages, hasMore }
}

const extractChatPinnedMessages = (
  data: any
): { pins: ChatPinnedMessage[]; membership: Record<string, any> } => {
  const rawPins: any[] = Array.isArray(data?.pinned_messages)
    ? data.pinned_messages
    : Array.isArray(data?.pins)
      ? data.pins
      : []
  const seen = new Set<number>()
  const pins = rawPins.reduce((result: ChatPinnedMessage[], value: any) => {
    const messagePayload = value?.message || value?.chat_message || null
    const message =
      messagePayload && typeof messagePayload.id === 'number'
        ? normalizeSingleMessage(messagePayload)
        : undefined
    const messageId = Number(value?.chat_message_id || message?.id || 0)
    if (!Number.isFinite(messageId) || messageId <= 0 || seen.has(messageId)) return result
    seen.add(messageId)
    result.push({
      id: Number(value?.id || messageId),
      chat_message_id: messageId,
      pinned_at: typeof value?.pinned_at === 'string' ? value.pinned_at : undefined,
      excerpt: typeof value?.excerpt === 'string' ? value.excerpt : undefined,
      pinned_by:
        value?.pinned_by && typeof value.pinned_by === 'object' ? value.pinned_by : undefined,
      message
    })
    return result
  }, [] as ChatPinnedMessage[])
  return { pins, membership: extractMembershipPayload(data) }
}

export const dedupeMessagesById = (messages: ChatMessage[]): ChatMessage[] => {
  const byId = new Map<number, ChatMessage>()
  messages.forEach(message => {
    if (!message || typeof message.id !== 'number') return
    const previous = byId.get(message.id)
    if (!previous) {
      byId.set(message.id, message)
      return
    }
    byId.set(message.id, {
      ...previous,
      ...message,
      reactions: message.reactions || previous.reactions || [],
      blocks: message.blocks || previous.blocks || []
    })
  })
  return [...byId.values()].sort((a, b) => a.id - b.id)
}

const ensureChatState = (tab: BrowserTab) => {
  if (!tab.chatState) {
    tab.chatState = {
      channels: [],
      activeChannelId: null,
      messagesByChannel: {},
      hasMoreByChannel: {},
      beforeMessageIdByChannel: {},
      activeTargetMessageId: null,
      activeThread: null,
      threadMessagesById: {},
      threadHasMoreById: {},
      beforeMessageIdByThread: {},
      myThreads: [],
      myThreadsLoadMoreUrl: null,
      myThreadsLoaded: false,
      loadingMyThreads: false,
      loadingMoreMyThreads: false,
      myThreadsErrorMessage: '',
      threadNotificationSavingById: {},
      threadTitleSavingById: {},
      searchState: {
        query: '',
        channelId: null,
        sort: 'relevance',
        results: [],
        offset: 0,
        hasMore: false,
        loading: false,
        loadingMore: false,
        errorMessage: ''
      },
      channelThreadsByChannel: {},
      channelThreadsLoadMoreUrlByChannel: {},
      channelThreadsLoadedByChannel: {},
      channelThreadsLoadingByChannel: {},
      channelThreadsLoadingMoreByChannel: {},
      channelThreadsErrorByChannel: {},
      pinnedMessagesByChannel: {},
      pinsLoadingByChannel: {},
      pinsErrorByChannel: {},
      pinSavingByMessageId: {},
      loadingChannels: false,
      loadingMessages: false,
      loadingThread: false,
      sendingMessage: false,
      sendingThreadMessage: false,
      errorMessage: '',
      threadErrorMessage: '',
      replyToMessage: null,
      threadReplyToMessage: null,
      editingMessage: null,
      threadEditingMessage: null,
      typingUsers: {},
      membersByChannel: {},
      membersTotalByChannel: {},
      membersLoadingByChannel: {},
      membersOffsetByChannel: {},
      membersHasMoreByChannel: {},
      discoverableChannels: [],
      discoverLoading: false,
      discoverErrorMessage: '',
      joiningChannelIds: {},
      capabilities: {
        loaded: false,
        chatEnabled: false,
        currentUserChatEnabled: false,
        canDirectMessage: false,
        publicChannelsEnabled: false,
        canCreatePublicChannel: false,
        maxAutoJoinedUsers: 0,
        source: 'unavailable'
      }
    }
  }
  if (!tab.chatState.capabilities) {
    tab.chatState.capabilities = {
      loaded: false,
      chatEnabled: false,
      currentUserChatEnabled: false,
      canDirectMessage: false,
      publicChannelsEnabled: false,
      canCreatePublicChannel: false,
      maxAutoJoinedUsers: 0,
      source: 'unavailable'
    }
  }
  tab.chatState.activeThread ??= null
  tab.chatState.activeTargetMessageId ??= null
  tab.chatState.threadMessagesById ??= {}
  tab.chatState.threadHasMoreById ??= {}
  tab.chatState.beforeMessageIdByThread ??= {}
  tab.chatState.myThreads ??= []
  tab.chatState.myThreadsLoadMoreUrl ??= null
  tab.chatState.myThreadsLoaded ??= false
  tab.chatState.loadingMyThreads ??= false
  tab.chatState.loadingMoreMyThreads ??= false
  tab.chatState.myThreadsErrorMessage ??= ''
  tab.chatState.threadNotificationSavingById ??= {}
  tab.chatState.threadTitleSavingById ??= {}
  tab.chatState.searchState ??= {
    query: '',
    channelId: null,
    sort: 'relevance',
    results: [],
    offset: 0,
    hasMore: false,
    loading: false,
    loadingMore: false,
    errorMessage: ''
  }
  tab.chatState.channelThreadsByChannel ??= {}
  tab.chatState.channelThreadsLoadMoreUrlByChannel ??= {}
  tab.chatState.channelThreadsLoadedByChannel ??= {}
  tab.chatState.channelThreadsLoadingByChannel ??= {}
  tab.chatState.channelThreadsLoadingMoreByChannel ??= {}
  tab.chatState.channelThreadsErrorByChannel ??= {}
  tab.chatState.pinnedMessagesByChannel ??= {}
  tab.chatState.pinsLoadingByChannel ??= {}
  tab.chatState.pinsErrorByChannel ??= {}
  tab.chatState.pinSavingByMessageId ??= {}
  tab.chatState.loadingThread ??= false
  tab.chatState.sendingThreadMessage ??= false
  tab.chatState.threadErrorMessage ??= ''
  tab.chatState.threadReplyToMessage ??= null
  tab.chatState.threadEditingMessage ??= null
  tab.chatState.membersByChannel ??= {}
  tab.chatState.membersTotalByChannel ??= {}
  tab.chatState.membersLoadingByChannel ??= {}
  tab.chatState.membersOffsetByChannel ??= {}
  tab.chatState.membersHasMoreByChannel ??= {}
  tab.chatState.discoverableChannels ??= []
  tab.chatState.discoverLoading ??= false
  tab.chatState.discoverErrorMessage ??= ''
  tab.chatState.joiningChannelIds ??= {}
}

const registerMessageUsers = (users: Ref<Map<number, DiscourseUser>>, messages: ChatMessage[]) => {
  messages.forEach(message => {
    if (message.user) {
      users.value.set(message.user.id, message.user)
    } else if (message.user_id && message.username) {
      users.value.set(message.user_id, {
        id: message.user_id,
        username: message.username,
        name: message.name,
        avatar_template: message.avatar_template || ''
      })
    }
    const threadUsers = [
      message.thread?.original_message?.user,
      message.thread?.preview?.last_reply_user,
      ...(message.thread?.preview?.participant_users || [])
    ].filter((user): user is DiscourseUser => Boolean(user?.id && user?.username))
    threadUsers.forEach(user => users.value.set(user.id, user))
  })
}

const registerChatThreadUsers = (users: Ref<Map<number, DiscourseUser>>, threads: ChatThread[]) => {
  threads.forEach(thread => {
    const threadUsers = [
      thread.original_message?.user,
      thread.preview?.last_reply_user,
      ...(thread.preview?.participant_users || []),
      ...(thread.channel?.direct_message_users || []),
      ...(thread.channel?.chatable?.users || [])
    ].filter((user): user is DiscourseUser => Boolean(user?.id && user?.username))
    threadUsers.forEach(user => users.value.set(user.id, user))
  })
}

export const updateChannelLastMessage = (
  channels: ChatChannel[],
  channelId: number,
  message: ChatMessage | null | undefined
) => {
  if (!message) return
  const channel = channels.find(item => item.id === channelId)
  if (!channel) return

  // Loading an older page or receiving a delayed thread event must not make a
  // channel look newer than its real latest message.  Compare timestamps first
  // and use the message id only as a stable tie breaker.
  const currentTime = channel.last_message?.created_at || channel.last_message_sent_at || ''
  const currentMs = currentTime ? new Date(currentTime).getTime() : 0
  const nextMs = message.created_at ? new Date(message.created_at).getTime() : 0
  const currentId = Number(channel.last_message_id || channel.last_message?.id || 0)
  const nextId = Number(message.id || 0)
  if (
    currentTime &&
    Number.isFinite(currentMs) &&
    Number.isFinite(nextMs) &&
    (nextMs < currentMs || (nextMs === currentMs && nextId <= currentId))
  ) {
    return
  }
  channel.last_message_id = message.id
  channel.last_message_sent_at = message.created_at
  channel.last_message = {
    id: message.id,
    cooked: message.cooked,
    message: message.message,
    created_at: message.created_at
  }
}

export const resetChatChannelUnreadCount = (channels: ChatChannel[], channelId: number) => {
  const channel = channels.find(item => item.id === channelId)
  if (!channel) return

  if (!channel.current_user_membership) {
    channel.current_user_membership = {
      chat_channel_id: channelId
    }
  }

  channel.current_user_membership.unread_count = 0

  const lastMessageId = Number(channel.last_message_id || channel.last_message?.id || 0)
  if (Number.isFinite(lastMessageId) && lastMessageId > 0) {
    channel.current_user_membership.last_read_message_id = lastMessageId
  }
}

const fetchChatChannels = async (baseUrl: string) => {
  let lastError: string | null = null

  for (const path of CHAT_CHANNEL_ENDPOINTS) {
    try {
      const result = await pageFetch<any>(`${baseUrl}${path}`)
      const data = extractData(result)
      if (result.ok) {
        return normalizeChatChannels(data)
      }
      lastError = parseErrorMessage(data, '加载聊天频道失败')
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
    }
  }

  if (lastError) {
    throw new Error(lastError)
  }
  return []
}

const fetchChatChannel = async (baseUrl: string, channelId: number) => {
  let lastError: string | null = null
  for (const path of CHAT_CHANNEL_SHOW_ENDPOINTS(channelId)) {
    try {
      const result = await pageFetch<any>(`${baseUrl}${path}`)
      const data = extractData(result)
      if (result.ok) {
        const channel = data?.channel || data
        if (channel && typeof channel.id === 'number') return normalizeSingleChannel(channel)
        lastError = '站点未返回聊天频道数据'
      } else {
        lastError = parseErrorMessage(data, '加载聊天频道失败')
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
    }
  }
  throw new Error(lastError || '加载聊天频道失败')
}

const fetchChatMessages = async (
  baseUrl: string,
  channelId: number,
  beforeMessageId?: number | null,
  aroundMessageId?: number | null
) => {
  const params = new URLSearchParams()
  params.set('page_size', '50')
  if (aroundMessageId) {
    params.set('target_message_id', String(aroundMessageId))
  } else {
    params.set('direction', 'past')
  }
  if (!aroundMessageId && beforeMessageId) {
    params.set('target_message_id', String(beforeMessageId))
  }

  let lastError: string | null = null

  for (const path of CHAT_MESSAGE_ENDPOINTS(channelId)) {
    const url = buildUrlWithQuery(baseUrl, path, params)
    try {
      const result = await pageFetch<any>(url)
      const data = extractData(result)
      if (result.ok) {
        return extractChatMessages(data)
      }
      lastError = parseErrorMessage(data, '加载聊天消息失败')
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
    }
  }

  throw new Error(lastError || '加载聊天消息失败')
}

const fetchChatChannelPins = async (baseUrl: string, channelId: number) => {
  let lastError: string | null = null
  for (const path of CHAT_CHANNEL_PINS_ENDPOINTS(channelId)) {
    try {
      const result = await pageFetch<any>(`${baseUrl}${path}`)
      const data = extractData(result)
      if (result.ok) return extractChatPinnedMessages(data)
      lastError = parseErrorMessage(data, '加载置顶消息失败')
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
    }
  }
  throw new Error(lastError || '加载置顶消息失败')
}

const markChatChannelPinsRead = async (baseUrl: string, channelId: number) => {
  let lastError: string | null = null
  for (const path of CHAT_CHANNEL_PINS_READ_ENDPOINTS(channelId)) {
    try {
      const result = await pageFetch<any>(`${baseUrl}${path}`, { method: 'PUT' })
      const data = extractData(result)
      if (result.ok) return true
      lastError = parseErrorMessage(data, '标记置顶消息已读失败')
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
    }
  }
  throw new Error(lastError || '标记置顶消息已读失败')
}

const updateChatMessagePin = async (
  baseUrl: string,
  channelId: number,
  messageId: number,
  pinned: boolean
) => {
  let lastError: string | null = null
  for (const path of CHAT_MESSAGE_PIN_ENDPOINTS(channelId, messageId)) {
    try {
      const result = await pageFetch<any>(`${baseUrl}${path}`, {
        method: pinned ? 'POST' : 'DELETE'
      })
      const data = extractData(result)
      if (result.ok) return true
      lastError = parseErrorMessage(data, pinned ? '置顶消息失败' : '取消置顶消息失败')
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
    }
  }
  throw new Error(lastError || (pinned ? '置顶消息失败' : '取消置顶消息失败'))
}

const fetchChatThread = async (baseUrl: string, channelId: number, threadId: number) => {
  let lastError: string | null = null
  for (const path of CHAT_THREAD_ENDPOINTS(channelId, threadId)) {
    try {
      const result = await pageFetch<any>(`${baseUrl}${path}`)
      const data = extractData(result)
      if (result.ok) {
        const thread = data?.thread || data
        if (thread && typeof thread.id === 'number') return normalizeChatThread(thread)
        lastError = '站点未返回消息串数据'
      } else {
        lastError = parseErrorMessage(data, '加载消息串失败')
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
    }
  }
  throw new Error(lastError || '加载消息串失败')
}

const fetchCurrentUserChatThreads = async (baseUrl: string, loadMoreUrl?: string | null) => {
  const urls = loadMoreUrl
    ? [resolveSameOriginChatUrl(baseUrl, loadMoreUrl)].filter((url): url is string => Boolean(url))
    : CHAT_CURRENT_USER_THREADS_ENDPOINTS.map(path => `${baseUrl}${path}`)

  if (urls.length === 0) {
    throw new Error('站点返回了无效的消息串分页地址')
  }

  let lastError: string | null = null
  for (const url of urls) {
    try {
      const result = await pageFetch<any>(url)
      const data = extractData(result)
      if (result.ok) return extractChatThreadList(data)
      lastError = parseErrorMessage(data, '加载消息串失败')
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
    }
  }

  throw new Error(lastError || '加载消息串失败')
}

const fetchChannelChatThreads = async (
  baseUrl: string,
  channelId: number,
  loadMoreUrl?: string | null
) => {
  const urls = loadMoreUrl
    ? [resolveSameOriginChatUrl(baseUrl, loadMoreUrl)].filter((url): url is string => Boolean(url))
    : CHAT_THREAD_CREATE_ENDPOINTS(channelId).map(path => `${baseUrl}${path}`)

  if (urls.length === 0) {
    throw new Error('站点返回了无效的频道消息串分页地址')
  }

  let lastError: string | null = null
  for (const url of urls) {
    try {
      const result = await pageFetch<any>(url)
      const data = extractData(result)
      if (result.ok) return extractChatThreadList(data)
      lastError = parseErrorMessage(data, '加载频道消息串失败')
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
    }
  }

  throw new Error(lastError || '加载频道消息串失败')
}

const createChatThreadRequest = async (
  baseUrl: string,
  channelId: number,
  originalMessageId: number
) => {
  const payload = {
    original_message_id: originalMessageId
  }
  const requests = [
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
      body: new URLSearchParams({ original_message_id: String(originalMessageId) }).toString()
    },
    {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }
  ]
  let lastError: string | null = null

  for (const path of CHAT_THREAD_CREATE_ENDPOINTS(channelId)) {
    for (const request of requests) {
      try {
        const result = await pageFetch<any>(`${baseUrl}${path}`, {
          method: 'POST',
          headers: request.headers,
          body: request.body
        })
        const data = extractData(result)
        if (result.ok) {
          const thread = data?.thread || data
          if (thread && typeof thread.id === 'number') return normalizeChatThread(thread)
          lastError = '消息串已创建，但站点未返回消息串数据'
        } else {
          lastError = parseErrorMessage(data, '创建消息串失败')
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error)
      }
    }
  }

  throw new Error(lastError || '创建消息串失败')
}

const fetchChatThreadMessages = async (
  baseUrl: string,
  channelId: number,
  threadId: number,
  beforeMessageId?: number | null,
  aroundMessageId?: number | null
) => {
  const params = new URLSearchParams({ page_size: '50' })
  if (aroundMessageId) {
    params.set('target_message_id', String(aroundMessageId))
  } else {
    params.set('direction', 'past')
  }
  if (!aroundMessageId && beforeMessageId) {
    params.set('target_message_id', String(beforeMessageId))
  } else if (!aroundMessageId) {
    params.set('fetch_from_last_message', 'true')
  }

  let lastError: string | null = null
  for (const path of CHAT_THREAD_MESSAGE_ENDPOINTS(channelId, threadId)) {
    try {
      const result = await pageFetch<any>(buildUrlWithQuery(baseUrl, path, params))
      const data = extractData(result)
      if (result.ok) return extractChatMessages(data)
      lastError = parseErrorMessage(data, '加载消息串回复失败')
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
    }
  }

  throw new Error(lastError || '加载消息串回复失败')
}

const markChatThreadReadRequest = async (
  baseUrl: string,
  channelId: number,
  threadId: number,
  messageId: number
) => {
  const params = new URLSearchParams({ message_id: String(messageId) })
  for (const path of CHAT_THREAD_READ_ENDPOINTS(channelId, threadId)) {
    try {
      const result = await pageFetch<any>(buildUrlWithQuery(baseUrl, path, params), {
        method: 'PUT'
      })
      if (result.ok) return true
    } catch {
      // Read tracking must never make the loaded thread unusable.
    }
  }
  return false
}

const extractChatMessageId = (data: any): number | null => {
  const idCandidates = [
    data?.message_id,
    data?.messageId,
    data?.chat_message?.id,
    data?.message?.id,
    data?.id
  ]
  for (const candidate of idCandidates) {
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return candidate
    }
    if (typeof candidate === 'string' && candidate.trim()) {
      const parsed = Number(candidate)
      if (!Number.isNaN(parsed)) return parsed
    }
  }
  return null
}

const extractChatMessage = (data: any): ChatMessage | null => {
  const direct = data?.chat_message || data?.message
  if (direct && typeof direct?.id === 'number') {
    return normalizeSingleMessage(direct)
  }
  if (typeof data?.id === 'number' && (data?.message || data?.cooked)) {
    return normalizeSingleMessage(data)
  }
  return null
}

const postChatMessage = async (
  baseUrl: string,
  channelId: number,
  message: string,
  options: PostChatMessageOptions = {}
) => {
  const payload = {
    chat_channel_id: channelId,
    message,
    ...(options.threadId ? { thread_id: options.threadId } : {}),
    ...(options.inReplyToId ? { in_reply_to_id: options.inReplyToId } : {})
  }
  const jsonPayload = JSON.stringify(payload)
  const formParams = new URLSearchParams()
  Object.entries(payload).forEach(([key, value]) => formParams.set(key, String(value)))
  const formPayload = formParams.toString()

  let lastError: string | null = null

  for (const path of CHAT_SEND_ENDPOINTS(channelId)) {
    for (const request of [
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
        },
        body: formPayload
      },
      {
        headers: {
          'Content-Type': 'application/json'
        },
        body: jsonPayload
      }
    ]) {
      try {
        const result = await pageFetch<any>(`${baseUrl}${path}`, {
          method: 'POST',
          headers: request.headers,
          body: request.body
        })
        const data = extractData(result)
        if (!result.ok) {
          lastError = parseErrorMessage(data, '发送消息失败')
          continue
        }

        const directMessage = extractChatMessage(data)
        const messageId = extractChatMessageId(data)
        if (directMessage || messageId) {
          return { messageId, message: directMessage }
        }

        lastError = '消息已发送，但未返回消息 ID'
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error)
      }
    }
  }

  throw new Error(lastError || '发送消息失败')
}

const fetchChatMessageById = async (
  baseUrl: string,
  channelId: number,
  messageId: number,
  threadId?: number | null
) => {
  const aroundTargetParams = new URLSearchParams({
    target_message_id: String(messageId)
  })
  const endpoints = threadId
    ? CHAT_THREAD_MESSAGE_ENDPOINTS(channelId, threadId)
    : CHAT_MESSAGE_ENDPOINTS(channelId)
  for (const path of endpoints) {
    const url = buildUrlWithQuery(baseUrl, path, aroundTargetParams)
    try {
      const result = await pageFetch<any>(url)
      const data = extractData(result)
      if (!result.ok) continue
      const { messages } = extractChatMessages(data)
      const matched = messages.find(message => message.id === messageId)
      if (matched) return matched
    } catch {
      // continue to next endpoint
    }
  }
  return null
}

const publishChatReaction = async (
  baseUrl: string,
  channelId: number,
  messageId: number,
  emoji: string,
  reactAction: ChatReactionAction
) => {
  const normalizedEmoji = normalizeReactionEmoji(emoji)
  const formPayload = new URLSearchParams({
    react_action: reactAction,
    emoji: normalizedEmoji
  }).toString()
  const jsonPayload = JSON.stringify({
    react_action: reactAction,
    emoji: normalizedEmoji
  })

  let lastError: string | null = null

  for (const path of CHAT_REACTION_ENDPOINTS(channelId, messageId)) {
    for (const request of [
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
        },
        body: formPayload
      },
      {
        headers: {
          'Content-Type': 'application/json'
        },
        body: jsonPayload
      }
    ]) {
      try {
        const result = await pageFetch<any>(`${baseUrl}${path}`, {
          method: 'PUT',
          headers: request.headers,
          body: request.body
        })
        const data = extractData(result)
        if (result.ok) {
          return true
        }
        lastError = parseErrorMessage(data, '更新聊天反应失败')
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error)
      }
    }
  }

  throw new Error(lastError || '更新聊天反应失败')
}

const applyLocalReaction = (
  message: ChatMessage,
  emoji: string,
  reactAction: ChatReactionAction
): ChatMessage => {
  const normalizedEmoji = normalizeReactionEmoji(emoji)
  const reactions = Array.isArray(message.reactions) ? [...message.reactions] : []
  const targetIndex = reactions.findIndex(
    item => normalizeReactionEmoji(item.emoji) === normalizedEmoji
  )

  if (reactAction === 'add') {
    if (targetIndex === -1) {
      reactions.push({ emoji: normalizedEmoji, count: 1, reacted: true, users: [] })
      return { ...message, reactions }
    }
    const target = reactions[targetIndex]
    if (target.reacted) {
      return { ...message, reactions }
    }
    reactions[targetIndex] = {
      ...target,
      reacted: true,
      count: Math.max(1, (target.count || 0) + 1)
    }
    return { ...message, reactions }
  }

  if (targetIndex === -1) {
    return { ...message, reactions }
  }

  const target = reactions[targetIndex]
  if (!target.reacted) {
    return { ...message, reactions }
  }

  const nextCount = Math.max(0, (target.count || 0) - 1)
  if (nextCount <= 0) {
    reactions.splice(targetIndex, 1)
  } else {
    reactions[targetIndex] = {
      ...target,
      reacted: false,
      count: nextCount
    }
  }
  return { ...message, reactions }
}

const resolveReactionAction = (
  message: ChatMessage | undefined,
  emoji: string,
  reacted?: boolean
): ChatReactionAction => {
  if (typeof reacted === 'boolean') {
    return reacted ? 'remove' : 'add'
  }
  const normalizedEmoji = normalizeReactionEmoji(emoji)
  const target = message?.reactions?.find(
    item => normalizeReactionEmoji(item.emoji) === normalizedEmoji
  )
  return target?.reacted ? 'remove' : 'add'
}

const createChatMessageInteractionRequest = async (
  baseUrl: string,
  channelId: number,
  messageId: number,
  actionId: string
) => {
  const formPayload = new URLSearchParams({ action_id: actionId }).toString()
  const jsonPayload = JSON.stringify({ action_id: actionId })
  let lastError: string | null = null

  for (const path of CHAT_INTERACTION_ENDPOINTS(channelId, messageId)) {
    for (const request of [
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
        },
        body: formPayload
      },
      {
        headers: {
          'Content-Type': 'application/json'
        },
        body: jsonPayload
      }
    ]) {
      try {
        const result = await pageFetch<any>(`${baseUrl}${path}`, {
          method: 'POST',
          headers: request.headers,
          body: request.body
        })
        const data = extractData(result)
        if (result.ok) {
          return data?.interaction || data || null
        }
        lastError = parseErrorMessage(data, '处理邀请回复失败')
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error)
      }
    }
  }

  throw new Error(lastError || '处理邀请回复失败')
}

const normalizeChannelUpdatePayload = (
  payload: ChatChannelUpdatePayload
): ChatChannelUpdatePayload => {
  const normalized: ChatChannelUpdatePayload = {}
  if (typeof payload.name === 'string' && payload.name.trim()) {
    normalized.name = payload.name.trim()
  }
  if (typeof payload.description === 'string') {
    normalized.description = payload.description.trim()
  }
  if (typeof payload.slug === 'string') {
    normalized.slug = payload.slug.trim()
  }
  if (typeof payload.emoji === 'string') {
    normalized.emoji = payload.emoji.trim()
  }
  if (typeof payload.threading_enabled === 'boolean') {
    normalized.threading_enabled = payload.threading_enabled
  }
  if (typeof payload.auto_join_users === 'boolean') {
    normalized.auto_join_users = payload.auto_join_users
  }
  if (typeof payload.allow_channel_wide_mentions === 'boolean') {
    normalized.allow_channel_wide_mentions = payload.allow_channel_wide_mentions
  }
  return normalized
}

const updateChatChannelRequest = async (
  baseUrl: string,
  channelId: number,
  payload: ChatChannelUpdatePayload
) => {
  const normalizedPayload = normalizeChannelUpdatePayload(payload)
  if (Object.keys(normalizedPayload).length === 0) {
    return null
  }

  const formParams = new URLSearchParams()
  Object.entries(normalizedPayload).forEach(([key, value]) => {
    if (value === undefined || value === null) return
    formParams.set(`channel[${key}]`, String(value))
  })

  const jsonPayload = JSON.stringify({ channel: normalizedPayload })
  const formPayload = formParams.toString()
  let lastError: string | null = null

  for (const path of CHAT_CHANNEL_UPDATE_ENDPOINTS(channelId)) {
    for (const request of [
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
        },
        body: formPayload
      },
      {
        headers: {
          'Content-Type': 'application/json'
        },
        body: jsonPayload
      }
    ]) {
      try {
        const result = await pageFetch<any>(`${baseUrl}${path}`, {
          method: 'PUT',
          headers: request.headers,
          body: request.body
        })
        const data = extractData(result)
        if (result.ok) {
          const channelPayload = data?.channel || data
          if (channelPayload && typeof channelPayload === 'object') {
            return normalizeSingleChannel(channelPayload)
          }
          return null
        }
        lastError = parseErrorMessage(data, '更新频道失败')
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error)
      }
    }
  }

  throw new Error(lastError || '更新频道失败')
}

export async function loadChat(
  tab: BrowserTab,
  baseUrl: Ref<string>,
  users: Ref<Map<number, DiscourseUser>>,
  targetChannelId?: number | null,
  targetMessageId?: number | null
) {
  ensureChatState(tab)
  const state = tab.chatState
  if (!state) return
  state.loadingChannels = true
  state.errorMessage = ''

  try {
    const [loadedChannels, capabilities] = await Promise.all([
      fetchChatChannels(baseUrl.value),
      fetchDiscourseChatCapabilities(baseUrl.value)
    ])
    let channels = loadedChannels
    if (targetChannelId && !channels.some(channel => channel.id === targetChannelId)) {
      try {
        const targetChannel = await fetchChatChannel(baseUrl.value, targetChannelId)
        channels = [targetChannel, ...channels]
      } catch (error) {
        // A deep link must never fall back to an unrelated first channel. Keep
        // the requested URL visible and surface the server's access/not-found
        // response instead.
        throw new Error(
          error instanceof Error && error.message ? error.message : '无法访问指定聊天频道'
        )
      }
    }
    state.channels = channels
    state.capabilities = capabilities

    if (capabilities.canCreatePublicChannel && tab.categories.length === 0) {
      try {
        const categoryResult = await pageFetch<any>(`${baseUrl.value}/categories.json`)
        if (categoryResult.ok) {
          tab.categories = normalizeCategoriesFromResponse(extractData(categoryResult))
        }
      } catch {
        // Existing chat remains usable when the category chooser cannot load.
      }
    }

    if (channels.length === 0) {
      state.activeChannelId = null
      state.errorMessage =
        capabilities.canDirectMessage || capabilities.canCreatePublicChannel
          ? '暂无聊天频道，可以创建一个新频道。'
          : '暂无可用聊天频道，请确认已登录且站点已开放聊天。'
      return
    }

    const nextChannelId =
      (targetChannelId && channels.find(channel => channel.id === targetChannelId)?.id) ||
      state.activeChannelId ||
      channels[0]?.id ||
      null

    state.activeChannelId = nextChannelId
    state.activeTargetMessageId = targetMessageId || null

    if (nextChannelId) {
      await loadChatMessages(tab, baseUrl, users, nextChannelId, true, targetMessageId)
    }
  } catch (error) {
    state.errorMessage = error instanceof Error ? error.message : String(error)
  } finally {
    state.loadingChannels = false
  }
}

const chatSearchRequestVersions = new WeakMap<BrowserTab, number>()

const mergeChatSearchResults = (existing: ChatMessage[], incoming: ChatMessage[]) => {
  const merged = [...existing]
  const positions = new Map<number, number>()
  merged.forEach((message, index) => positions.set(message.id, index))
  incoming.forEach(message => {
    const index = positions.get(message.id)
    if (index === undefined) {
      positions.set(message.id, merged.length)
      merged.push(message)
    } else {
      merged[index] = { ...merged[index], ...message }
    }
  })
  return merged
}

export async function searchChatMessages(
  tab: BrowserTab,
  baseUrl: Ref<string>,
  users: Ref<Map<number, DiscourseUser>>,
  query: string,
  channelId: number | null,
  sort: ChatSearchSort,
  reset = true
) {
  ensureChatState(tab)
  const state = tab.chatState
  if (!state) return []
  const search = state.searchState
  const normalizedQuery = query.trim()
  const normalizedChannelId = channelId && channelId > 0 ? channelId : null
  const normalizedSort: ChatSearchSort = sort === 'latest' ? 'latest' : 'relevance'

  if (!normalizedQuery) {
    chatSearchRequestVersions.set(tab, (chatSearchRequestVersions.get(tab) || 0) + 1)
    Object.assign(search, {
      query: '',
      channelId: normalizedChannelId,
      sort: normalizedSort,
      results: [],
      offset: 0,
      hasMore: false,
      loading: false,
      loadingMore: false,
      errorMessage: ''
    })
    return []
  }

  const sameSearch =
    search.query === normalizedQuery &&
    search.channelId === normalizedChannelId &&
    search.sort === normalizedSort
  if (!reset && (!sameSearch || !search.hasMore || search.loading || search.loadingMore)) {
    return search.results
  }

  const offset = reset ? 0 : search.offset
  const requestVersion = (chatSearchRequestVersions.get(tab) || 0) + 1
  chatSearchRequestVersions.set(tab, requestVersion)
  Object.assign(search, {
    query: normalizedQuery,
    channelId: normalizedChannelId,
    sort: normalizedSort,
    ...(reset ? { results: [], offset: 0, hasMore: false } : {}),
    loading: reset,
    loadingMore: !reset,
    errorMessage: ''
  })

  const params = new URLSearchParams({
    query: normalizedQuery,
    sort: normalizedSort,
    offset: String(offset),
    limit: '20'
  })
  if (normalizedChannelId) params.set('channel_id', String(normalizedChannelId))

  let lastError: string | null = null
  try {
    for (const path of CHAT_SEARCH_ENDPOINTS) {
      try {
        const result = await pageFetch<any>(buildUrlWithQuery(baseUrl.value, path, params))
        const data = extractData(result)
        if (!result.ok) {
          lastError = parseErrorMessage(data, '搜索聊天消息失败')
          continue
        }

        const messages = (Array.isArray(data?.messages) ? data.messages : []).map((item: any) =>
          normalizeSingleMessage(item)
        )
        if (chatSearchRequestVersions.get(tab) !== requestVersion) return search.results
        registerMessageUsers(users, messages)
        search.results = reset ? messages : mergeChatSearchResults(search.results, messages)
        search.offset = offset + messages.length
        search.hasMore = Boolean(data?.meta?.has_more)
        return search.results
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error)
      }
    }

    if (chatSearchRequestVersions.get(tab) === requestVersion) {
      search.errorMessage = lastError || '搜索聊天消息失败'
    }
    return search.results
  } finally {
    if (chatSearchRequestVersions.get(tab) === requestVersion) {
      search.loading = false
      search.loadingMore = false
    }
  }
}

const mergeChatThreadsById = (existing: ChatThread[], incoming: ChatThread[]) => {
  const merged = new Map<number, ChatThread>()
  existing.forEach(thread => merged.set(thread.id, thread))
  incoming.forEach(thread => {
    const previous = merged.get(thread.id)
    merged.set(thread.id, previous ? { ...previous, ...thread } : thread)
  })
  return [...merged.values()]
}

const mergeThreadChannelsIntoState = (
  state: NonNullable<BrowserTab['chatState']>,
  threads: ChatThread[]
) => {
  threads.forEach(thread => {
    const incoming = thread.channel
    if (!incoming) return
    const index = state.channels.findIndex(channel => channel.id === incoming.id)
    if (index === -1) {
      state.channels.push(incoming)
      return
    }
    state.channels[index] = {
      ...state.channels[index],
      ...incoming,
      current_user_membership:
        incoming.current_user_membership || state.channels[index].current_user_membership
    }
  })
}

export async function loadMyChatThreads(
  tab: BrowserTab,
  baseUrl: Ref<string>,
  users: Ref<Map<number, DiscourseUser>>,
  reset = false
) {
  ensureChatState(tab)
  const state = tab.chatState
  if (!state) return []
  if (state.loadingMyThreads || state.loadingMoreMyThreads) return state.myThreads
  if (!reset && state.myThreadsLoaded && !state.myThreadsLoadMoreUrl) return state.myThreads

  const loadMoreUrl = reset ? null : state.myThreadsLoadMoreUrl
  if (!reset && state.myThreadsLoaded && !loadMoreUrl) return state.myThreads

  state.loadingMyThreads = reset || !state.myThreadsLoaded
  state.loadingMoreMyThreads = !state.loadingMyThreads
  state.myThreadsErrorMessage = ''

  try {
    const page = await fetchCurrentUserChatThreads(baseUrl.value, loadMoreUrl)
    registerChatThreadUsers(users, page.threads)
    mergeThreadChannelsIntoState(state, page.threads)
    state.myThreads = reset ? page.threads : mergeChatThreadsById(state.myThreads, page.threads)
    state.myThreadsLoadMoreUrl = page.threads.length === 0 ? null : page.loadMoreUrl
    state.myThreadsLoaded = true
    return state.myThreads
  } catch (error) {
    state.myThreadsErrorMessage = error instanceof Error ? error.message : String(error)
    return state.myThreads
  } finally {
    state.loadingMyThreads = false
    state.loadingMoreMyThreads = false
  }
}

export async function loadChatChannelThreads(
  tab: BrowserTab,
  baseUrl: Ref<string>,
  users: Ref<Map<number, DiscourseUser>>,
  channelId: number,
  reset = false
) {
  ensureChatState(tab)
  const state = tab.chatState
  if (!state) return []
  const channel = state.channels.find(item => item.id === channelId)
  if (!channel?.threading_enabled) {
    state.channelThreadsErrorByChannel[channelId] = '当前频道未开放消息串'
    return state.channelThreadsByChannel[channelId] || []
  }
  if (
    state.channelThreadsLoadingByChannel[channelId] ||
    state.channelThreadsLoadingMoreByChannel[channelId]
  ) {
    return state.channelThreadsByChannel[channelId] || []
  }

  const loaded = Boolean(state.channelThreadsLoadedByChannel[channelId])
  const loadMoreUrl = reset ? null : state.channelThreadsLoadMoreUrlByChannel[channelId]
  if (!reset && loaded && !loadMoreUrl) return state.channelThreadsByChannel[channelId] || []

  state.channelThreadsLoadingByChannel[channelId] = reset || !loaded
  state.channelThreadsLoadingMoreByChannel[channelId] =
    !state.channelThreadsLoadingByChannel[channelId]
  state.channelThreadsErrorByChannel[channelId] = ''

  try {
    const page = await fetchChannelChatThreads(baseUrl.value, channelId, loadMoreUrl)
    const threads = page.threads.map((thread: ChatThread): ChatThread => ({
      ...thread,
      channel_id: thread.channel_id || channelId,
      channel: thread.channel || channel
    }))
    registerChatThreadUsers(users, threads)
    mergeThreadChannelsIntoState(state, threads)
    state.channelThreadsByChannel[channelId] = reset
      ? threads
      : mergeChatThreadsById(state.channelThreadsByChannel[channelId] || [], threads)
    state.channelThreadsLoadMoreUrlByChannel[channelId] =
      threads.length === 0 ? null : page.loadMoreUrl
    state.channelThreadsLoadedByChannel[channelId] = true
    return state.channelThreadsByChannel[channelId]
  } catch (error) {
    state.channelThreadsErrorByChannel[channelId] =
      error instanceof Error ? error.message : String(error)
    return state.channelThreadsByChannel[channelId] || []
  } finally {
    state.channelThreadsLoadingByChannel[channelId] = false
    state.channelThreadsLoadingMoreByChannel[channelId] = false
  }
}

export async function loadChatMessages(
  tab: BrowserTab,
  baseUrl: Ref<string>,
  users: Ref<Map<number, DiscourseUser>>,
  channelId: number,
  reset = false,
  targetMessageId?: number | null
) {
  ensureChatState(tab)
  const state = tab.chatState
  if (!state) return
  state.loadingMessages = true
  state.errorMessage = ''

  if (reset) {
    state.messagesByChannel[channelId] = []
    state.beforeMessageIdByChannel[channelId] = null
    state.hasMoreByChannel[channelId] = true
    state.activeTargetMessageId = targetMessageId || null
  }

  try {
    const beforeId = reset ? null : state.beforeMessageIdByChannel[channelId]
    const { messages, hasMore } = await fetchChatMessages(
      baseUrl.value,
      channelId,
      beforeId,
      reset ? targetMessageId : null
    )

    registerMessageUsers(users, messages)

    const existing = state.messagesByChannel[channelId] || []
    const merged = dedupeMessagesById(reset ? messages : [...messages, ...existing])

    state.messagesByChannel[channelId] = merged
    state.hasMoreByChannel[channelId] = hasMore

    if (merged.length > 0) {
      state.beforeMessageIdByChannel[channelId] = merged[0].id
      updateChannelLastMessage(channelsFromState(state), channelId, merged[merged.length - 1])
    }
  } catch (error) {
    state.errorMessage = error instanceof Error ? error.message : String(error)
  } finally {
    state.loadingMessages = false
  }
}

export async function loadChatChannelPins(
  tab: BrowserTab,
  baseUrl: Ref<string>,
  users: Ref<Map<number, DiscourseUser>>,
  channelId: number,
  markRead = true
) {
  ensureChatState(tab)
  const state = tab.chatState
  if (!state) return []
  if (state.pinsLoadingByChannel[channelId]) return state.pinnedMessagesByChannel[channelId] || []

  state.pinsLoadingByChannel[channelId] = true
  state.pinsErrorByChannel[channelId] = ''
  try {
    const { pins, membership } = await fetchChatChannelPins(baseUrl.value, channelId)
    state.pinnedMessagesByChannel[channelId] = pins
    registerMessageUsers(
      users,
      pins.flatMap(pin => (pin.message ? [pin.message] : []))
    )
    pins.forEach(pin => {
      if (pin.pinned_by?.id && pin.pinned_by.username) {
        users.value.set(pin.pinned_by.id, pin.pinned_by)
      }
    })

    const channel = state.channels.find(item => item.id === channelId)
    if (channel) {
      channel.pinned_messages_count = pins.length
      if (Object.keys(membership).length > 0) {
        channel.current_user_membership = {
          ...(channel.current_user_membership || { chat_channel_id: channelId }),
          ...membership
        }
      }
    }

    if (markRead) {
      try {
        await markChatChannelPinsRead(baseUrl.value, channelId)
        if (channel?.current_user_membership) {
          channel.current_user_membership.has_unseen_pins = false
          channel.current_user_membership.last_viewed_pins_at = new Date().toISOString()
        }
      } catch (error) {
        // The pins themselves remain usable when a legacy server lacks the
        // optional read endpoint; do not turn a successful list into an error.
        console.warn('[DiscourseBrowser] mark chat pins read failed:', error)
      }
    }
    return pins
  } catch (error) {
    state.pinsErrorByChannel[channelId] = error instanceof Error ? error.message : String(error)
    return state.pinnedMessagesByChannel[channelId] || []
  } finally {
    state.pinsLoadingByChannel[channelId] = false
  }
}

export async function toggleChatMessagePin(
  tab: BrowserTab,
  baseUrl: Ref<string>,
  users: Ref<Map<number, DiscourseUser>>,
  channelId: number,
  messageId: number,
  pinned: boolean
) {
  ensureChatState(tab)
  const state = tab.chatState
  if (!state) return false
  const savingKey = `${channelId}:${messageId}`
  if (state.pinSavingByMessageId[savingKey]) return false

  state.pinSavingByMessageId[savingKey] = true
  state.errorMessage = ''
  try {
    await updateChatMessagePin(baseUrl.value, channelId, messageId, pinned)
    const current = state.pinnedMessagesByChannel[channelId] || []
    const targetMessage = [
      ...(state.messagesByChannel[channelId] || []),
      ...Object.values(state.threadMessagesById).flat()
    ].find(message => message.id === messageId)
    state.pinnedMessagesByChannel[channelId] = pinned
      ? current.some(pin => pin.chat_message_id === messageId)
        ? current
        : [
            ...current,
            {
              id: -messageId,
              chat_message_id: messageId,
              pinned_at: new Date().toISOString(),
              message: targetMessage
            }
          ]
      : current.filter(pin => pin.chat_message_id !== messageId)

    const channel = state.channels.find(item => item.id === channelId)
    if (channel) channel.pinned_messages_count = state.pinnedMessagesByChannel[channelId].length

    // Refresh the optimistic entry so its authoritative pin id, actor and
    // excerpt match the server response.
    await loadChatChannelPins(tab, baseUrl, users, channelId, false)
    return true
  } catch (error) {
    state.errorMessage = error instanceof Error ? error.message : String(error)
    return false
  } finally {
    state.pinSavingByMessageId[savingKey] = false
  }
}

const attachThreadToChannelMessage = (
  state: NonNullable<BrowserTab['chatState']>,
  channelId: number,
  originalMessageId: number,
  thread: ChatThread
) => {
  const messages = state.messagesByChannel[channelId] || []
  const index = messages.findIndex(message => message.id === originalMessageId)
  if (index === -1) return
  messages[index] = {
    ...messages[index],
    thread_id: thread.id,
    thread: normalizeChatThread(thread)
  }
  state.messagesByChannel[channelId] = [...messages]
}

const patchChatThreadEverywhere = (
  state: NonNullable<BrowserTab['chatState']>,
  threadId: number,
  updater: (thread: ChatThread) => ChatThread
) => {
  if (state.activeThread?.id === threadId) {
    state.activeThread = updater(state.activeThread)
  }

  state.myThreads = state.myThreads.map(thread =>
    thread.id === threadId ? updater(thread) : thread
  )

  for (const [channelId, threads] of Object.entries(state.channelThreadsByChannel)) {
    if (!threads.some(thread => thread.id === threadId)) continue
    state.channelThreadsByChannel[Number(channelId)] = threads.map(thread =>
      thread.id === threadId ? updater(thread) : thread
    )
  }

  for (const [channelId, messages] of Object.entries(state.messagesByChannel)) {
    if (!messages.some(message => message.thread?.id === threadId)) continue
    state.messagesByChannel[Number(channelId)] = messages.map(message =>
      message.thread?.id === threadId ? { ...message, thread: updater(message.thread) } : message
    )
  }
}

const markChatThreadReadInState = (
  state: NonNullable<BrowserTab['chatState']>,
  threadId: number,
  messageId: number
) => {
  const knownThreads = [
    state.activeThread,
    state.myThreads.find(thread => thread.id === threadId),
    ...Object.values(state.channelThreadsByChannel).map(threads =>
      threads.find(thread => thread.id === threadId)
    )
  ].filter((thread): thread is ChatThread => Boolean(thread))
  const watchedUnreadCount = Math.max(
    0,
    ...knownThreads.map(thread => Number(thread.tracking?.watched_threads_unread_count || 0))
  )
  const channelId = Number(
    knownThreads.find(thread => thread.channel_id || thread.channel?.id)?.channel_id ||
      knownThreads.find(thread => thread.channel?.id)?.channel?.id ||
      0
  )
  const channel = state.channels.find(item => item.id === channelId)
  if (channel?.current_user_membership && watchedUnreadCount > 0) {
    channel.current_user_membership.watched_threads_unread_count = Math.max(
      0,
      Number(channel.current_user_membership.watched_threads_unread_count || 0) - watchedUnreadCount
    )
  }

  patchChatThreadEverywhere(state, threadId, thread => ({
    ...thread,
    current_user_membership: {
      ...(thread.current_user_membership || {}),
      last_read_message_id: messageId,
      unread_count: 0
    },
    tracking: {
      ...(thread.tracking || {}),
      unread_count: 0,
      mention_count: 0,
      watched_threads_unread_count: 0
    }
  }))
}

export const syncThreadSummaryFromMessage = (
  state: NonNullable<BrowserTab['chatState']>,
  threadId: number,
  message: ChatMessage,
  incrementReplyCount: boolean,
  markUnread = false
) => {
  const activeThread = state.activeThread?.id === threadId ? state.activeThread : null
  const channelMessages = Object.values(state.messagesByChannel).flat()
  const original = channelMessages.find(item => item.thread?.id === threadId)
  const listedThread = state.myThreads.find(item => item.id === threadId)
  const thread = activeThread || original?.thread || listedThread
  if (!thread) return

  const currentCount = Number(thread.reply_count || thread.preview?.reply_count || 0)
  const isAlreadyLatest = thread.preview?.last_reply_id === message.id
  const nextCount = incrementReplyCount && !isAlreadyLatest ? currentCount + 1 : currentCount
  const participantUsers = [...(thread.preview?.participant_users || [])]
  if (message.user && !participantUsers.some(user => user.id === message.user?.id)) {
    participantUsers.push(message.user)
  }
  const preview = {
    ...(thread.preview || {}),
    last_reply_created_at: message.created_at,
    last_reply_excerpt: message.message || message.cooked || '',
    last_reply_id: message.id,
    last_reply_user: message.user,
    participant_count: Math.max(
      Number(thread.preview?.participant_count || 0),
      participantUsers.length
    ),
    participant_users: participantUsers,
    reply_count: nextCount
  }
  const updatedThread: ChatThread = {
    ...thread,
    reply_count: nextCount,
    last_message_id: message.id,
    preview
  }
  if (markUnread) {
    const notificationLevel = Number(updatedThread.current_user_membership?.notification_level || 1)
    const tracking = { ...(updatedThread.tracking || {}) }
    if (notificationLevel === 3) {
      tracking.watched_threads_unread_count = Number(tracking.watched_threads_unread_count || 0) + 1
    } else if (notificationLevel === 2) {
      tracking.unread_count = Number(tracking.unread_count || 0) + 1
    }
    updatedThread.tracking = tracking
  }

  patchChatThreadEverywhere(state, threadId, existing => ({
    ...existing,
    ...updatedThread,
    current_user_membership:
      existing.current_user_membership || updatedThread.current_user_membership,
    tracking: updatedThread.tracking || existing.tracking
  }))

  const channelId = Number(updatedThread.channel_id || updatedThread.channel?.id || 0)
  if (
    channelId > 0 &&
    nextCount > 0 &&
    state.channelThreadsLoadedByChannel[channelId] &&
    !state.channelThreadsByChannel[channelId]?.some(item => item.id === threadId)
  ) {
    state.channelThreadsByChannel[channelId] = [
      updatedThread,
      ...(state.channelThreadsByChannel[channelId] || [])
    ]
  }
}

export async function loadChatThreadMessages(
  tab: BrowserTab,
  baseUrl: Ref<string>,
  users: Ref<Map<number, DiscourseUser>>,
  channelId: number,
  threadId: number,
  reset = false,
  targetMessageId?: number | null
) {
  ensureChatState(tab)
  const state = tab.chatState
  if (!state) return []
  state.loadingThread = true
  state.threadErrorMessage = ''

  if (reset) {
    state.threadMessagesById[threadId] = []
    state.beforeMessageIdByThread[threadId] = null
    state.threadHasMoreById[threadId] = true
    state.activeTargetMessageId = targetMessageId || null
  }

  try {
    const beforeId = reset ? null : state.beforeMessageIdByThread[threadId]
    const { messages, hasMore } = await fetchChatThreadMessages(
      baseUrl.value,
      channelId,
      threadId,
      beforeId,
      reset ? targetMessageId : null
    )
    registerMessageUsers(users, messages)

    const originalMessage =
      state.activeThread?.id === threadId ? state.activeThread.original_message : undefined
    const incoming =
      reset && originalMessage && !messages.some(message => message.id === originalMessage.id)
        ? [originalMessage, ...messages]
        : messages
    const existing = state.threadMessagesById[threadId] || []
    const merged = dedupeMessagesById(reset ? incoming : [...incoming, ...existing])
    state.threadMessagesById[threadId] = merged
    state.threadHasMoreById[threadId] = hasMore

    if (merged.length > 0) {
      state.beforeMessageIdByThread[threadId] = messages[0]?.id || merged[0].id
      const lastMessage = merged[merged.length - 1]
      const readMessageId = targetMessageId || lastMessage.id
      void markChatThreadReadRequest(baseUrl.value, channelId, threadId, readMessageId)
      markChatThreadReadInState(state, threadId, readMessageId)
    }
    return merged
  } catch (error) {
    state.threadErrorMessage = error instanceof Error ? error.message : String(error)
    return state.threadMessagesById[threadId] || []
  } finally {
    state.loadingThread = false
  }
}

const activateChatThread = async (
  tab: BrowserTab,
  state: NonNullable<BrowserTab['chatState']>,
  baseUrl: Ref<string>,
  users: Ref<Map<number, DiscourseUser>>,
  channelId: number,
  thread: ChatThread,
  fallbackOriginalMessage?: ChatMessage,
  targetMessageId?: number | null
) => {
  if (!thread.original_message && fallbackOriginalMessage) {
    thread.original_message = normalizeSingleMessage(fallbackOriginalMessage)
  }
  if (!thread.original_message) {
    throw new Error('站点未返回消息串的原始消息')
  }
  const listedThread = state.myThreads.find(item => item.id === thread.id)
  const activeThread: ChatThread = {
    ...(listedThread || {}),
    ...thread,
    channel_id: thread.channel_id || listedThread?.channel_id || channelId,
    channel:
      thread.channel ||
      listedThread?.channel ||
      state.channels.find(channel => channel.id === channelId),
    tracking: thread.tracking || listedThread?.tracking
  }
  state.activeThread = activeThread
  const activeOriginalMessage = activeThread.original_message
  if (!activeOriginalMessage) {
    throw new Error('站点未返回消息串的原始消息')
  }
  attachThreadToChannelMessage(state, channelId, activeOriginalMessage.id, activeThread)
  await loadChatThreadMessages(
    tab,
    baseUrl,
    users,
    channelId,
    activeThread.id,
    true,
    targetMessageId
  )
  return state.activeThread
}

export async function openChatThread(
  tab: BrowserTab,
  baseUrl: Ref<string>,
  users: Ref<Map<number, DiscourseUser>>,
  channelId: number,
  originalMessage: ChatMessage,
  targetMessageId?: number | null
) {
  ensureChatState(tab)
  const state = tab.chatState
  if (!state) return null
  const channel = state.channels.find(item => item.id === channelId)
  if (!channel) return null

  state.loadingThread = true
  state.threadErrorMessage = ''
  state.threadReplyToMessage = null
  state.threadEditingMessage = null

  try {
    let thread: ChatThread
    const serializedThread = originalMessage.thread
    const existingThreadId = serializedThread?.id || originalMessage.thread_id

    if (existingThreadId) {
      try {
        thread = await fetchChatThread(baseUrl.value, channelId, existingThreadId)
      } catch (error) {
        if (!serializedThread) throw error
        thread = normalizeChatThread(serializedThread)
      }
    } else {
      if (!channel.threading_enabled) {
        throw new Error('当前频道未开放消息串')
      }
      thread = await createChatThreadRequest(baseUrl.value, channelId, originalMessage.id)
    }

    return await activateChatThread(
      tab,
      state,
      baseUrl,
      users,
      channelId,
      thread,
      originalMessage,
      targetMessageId
    )
  } catch (error) {
    state.activeThread = null
    state.threadErrorMessage = error instanceof Error ? error.message : String(error)
    return null
  } finally {
    state.loadingThread = false
  }
}

export async function openChatThreadById(
  tab: BrowserTab,
  baseUrl: Ref<string>,
  users: Ref<Map<number, DiscourseUser>>,
  channelId: number,
  threadId: number,
  targetMessageId?: number | null
) {
  ensureChatState(tab)
  const state = tab.chatState
  if (!state) return null
  if (!state.channels.some(channel => channel.id === channelId)) return null

  state.loadingThread = true
  state.threadErrorMessage = ''
  state.threadReplyToMessage = null
  state.threadEditingMessage = null

  try {
    const thread = await fetchChatThread(baseUrl.value, channelId, threadId)
    return await activateChatThread(
      tab,
      state,
      baseUrl,
      users,
      channelId,
      thread,
      undefined,
      targetMessageId
    )
  } catch (error) {
    state.activeThread = null
    state.threadErrorMessage = error instanceof Error ? error.message : String(error)
    return null
  } finally {
    state.loadingThread = false
  }
}

export function closeChatThread(tab: BrowserTab) {
  ensureChatState(tab)
  const state = tab.chatState
  if (!state) return
  state.activeThread = null
  state.activeTargetMessageId = null
  state.threadReplyToMessage = null
  state.threadEditingMessage = null
  state.threadErrorMessage = ''
}

export async function updateChatThreadNotificationLevel(
  tab: BrowserTab,
  baseUrl: Ref<string>,
  channelId: number,
  threadId: number,
  notificationLevel: number
) {
  ensureChatState(tab)
  const state = tab.chatState
  if (!state) return null
  if (![1, 2, 3].includes(notificationLevel)) {
    state.threadErrorMessage = '站点不支持该消息串通知级别'
    return null
  }

  state.threadNotificationSavingById[threadId] = true
  state.threadErrorMessage = ''
  let lastError: string | null = null
  const formPayload = new URLSearchParams({
    notification_level: String(notificationLevel)
  }).toString()
  const jsonPayload = JSON.stringify({ notification_level: notificationLevel })

  try {
    for (const path of CHAT_THREAD_NOTIFICATION_SETTINGS_ENDPOINTS(channelId, threadId)) {
      for (const request of [
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
          body: formPayload
        },
        {
          headers: { 'Content-Type': 'application/json' },
          body: jsonPayload
        }
      ]) {
        try {
          const result = await pageFetch<any>(`${baseUrl.value}${path}`, {
            method: 'PUT',
            headers: request.headers,
            body: request.body
          })
          const data = extractData(result)
          if (!result.ok) {
            lastError = parseErrorMessage(data, '更新消息串通知设置失败')
            continue
          }

          const returnedMembership = extractMembershipPayload(data)
          const returnedLevel = Number(returnedMembership.notification_level)
          const membership = {
            ...returnedMembership,
            notification_level: Number.isFinite(returnedLevel) ? returnedLevel : notificationLevel
          }
          patchChatThreadEverywhere(state, threadId, thread => ({
            ...thread,
            current_user_membership: {
              ...(thread.current_user_membership || {}),
              ...membership
            }
          }))
          return membership
        } catch (error) {
          lastError = error instanceof Error ? error.message : String(error)
        }
      }
    }

    state.threadErrorMessage = lastError || '更新消息串通知设置失败'
    return null
  } finally {
    state.threadNotificationSavingById[threadId] = false
  }
}

export async function updateChatThreadTitle(
  tab: BrowserTab,
  baseUrl: Ref<string>,
  channelId: number,
  threadId: number,
  title: string
) {
  ensureChatState(tab)
  const state = tab.chatState
  if (!state) return false
  const normalizedTitle = title.trim()
  if (normalizedTitle.length > 100) {
    state.threadErrorMessage = '消息串标题不能超过 100 个字符'
    return false
  }

  state.threadTitleSavingById[threadId] = true
  state.threadErrorMessage = ''
  let lastError: string | null = null
  const formPayload = new URLSearchParams({ title: normalizedTitle }).toString()
  const jsonPayload = JSON.stringify({ title: normalizedTitle })

  try {
    for (const path of CHAT_THREAD_ENDPOINTS(channelId, threadId)) {
      for (const request of [
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
          body: formPayload
        },
        {
          headers: { 'Content-Type': 'application/json' },
          body: jsonPayload
        }
      ]) {
        try {
          const result = await pageFetch<any>(`${baseUrl.value}${path}`, {
            method: 'PUT',
            headers: request.headers,
            body: request.body
          })
          const data = extractData(result)
          if (!result.ok) {
            lastError = parseErrorMessage(data, '更新消息串标题失败')
            continue
          }

          patchChatThreadEverywhere(state, threadId, thread => ({
            ...thread,
            title: normalizedTitle
          }))
          const messages = state.threadMessagesById[threadId] || []
          state.threadMessagesById[threadId] = messages.map(message => ({
            ...message,
            thread_title: normalizedTitle
          }))
          return true
        } catch (error) {
          lastError = error instanceof Error ? error.message : String(error)
        }
      }
    }

    state.threadErrorMessage = lastError || '更新消息串标题失败'
    return false
  } finally {
    state.threadTitleSavingById[threadId] = false
  }
}

const channelsFromState = (state: NonNullable<BrowserTab['chatState']>) => state.channels

export async function sendChatMessage(
  tab: BrowserTab,
  baseUrl: Ref<string>,
  users: Ref<Map<number, DiscourseUser>>,
  channelId: number,
  message: string,
  options: PostChatMessageOptions = {}
) {
  ensureChatState(tab)
  const state = tab.chatState
  if (!state) return null
  if (options.threadId) {
    state.sendingThreadMessage = true
  } else {
    state.sendingMessage = true
  }
  state.errorMessage = ''
  if (options.threadId) state.threadErrorMessage = ''

  try {
    const created = await postChatMessage(baseUrl.value, channelId, message, options)
    let sentMessage = created.message

    if (!sentMessage && created.messageId) {
      sentMessage = await fetchChatMessageById(
        baseUrl.value,
        channelId,
        created.messageId,
        options.threadId
      )
    }

    if (!sentMessage && created.messageId) {
      sentMessage = normalizeSingleMessage({
        id: created.messageId,
        message,
        created_at: new Date().toISOString(),
        chat_channel_id: channelId,
        thread_id: options.threadId || null,
        in_reply_to: options.inReplyToId
          ? [
              ...(options.threadId ? state.threadMessagesById[options.threadId] || [] : []),
              ...(state.messagesByChannel[channelId] || [])
            ].find(item => item.id === options.inReplyToId)
          : null
      })
    }

    if (!sentMessage) {
      throw new Error('消息已发送，但未能同步到本地列表')
    }

    registerMessageUsers(users, [sentMessage])

    if (options.threadId) {
      const existing = state.threadMessagesById[options.threadId] || []
      const alreadyExists = existing.some(item => item.id === sentMessage?.id)
      const merged = dedupeMessagesById([...existing, sentMessage])
      state.threadMessagesById[options.threadId] = merged
      state.beforeMessageIdByThread[options.threadId] ??= merged[0]?.id || null
      syncThreadSummaryFromMessage(state, options.threadId, sentMessage, !alreadyExists)
      void markChatThreadReadRequest(baseUrl.value, channelId, options.threadId, sentMessage.id)
      return sentMessage
    }

    const existing = state.messagesByChannel[channelId] || []
    const merged = dedupeMessagesById([...existing, sentMessage])
    state.messagesByChannel[channelId] = merged

    if (merged.length > 0) {
      state.beforeMessageIdByChannel[channelId] = merged[0].id
      updateChannelLastMessage(channelsFromState(state), channelId, merged[merged.length - 1])
    }

    return sentMessage
  } catch (error) {
    state.errorMessage = error instanceof Error ? error.message : String(error)
    if (options.threadId) state.threadErrorMessage = state.errorMessage
  } finally {
    if (options.threadId) {
      state.sendingThreadMessage = false
    } else {
      state.sendingMessage = false
    }
  }

  return null
}

export async function toggleChatMessageReaction(
  tab: BrowserTab,
  baseUrl: Ref<string>,
  channelId: number,
  messageId: number,
  emoji: string,
  reacted?: boolean
) {
  ensureChatState(tab)
  const state = tab.chatState
  if (!state) return false
  state.errorMessage = ''

  const normalizedEmoji = normalizeReactionEmoji(emoji)
  if (!normalizedEmoji) return false

  const channelMessages = state.messagesByChannel[channelId] || []
  const threadId = state.activeThread?.id
  const threadMessages = threadId ? state.threadMessagesById[threadId] || [] : []
  const targetMessage =
    channelMessages.find(message => message.id === messageId) ||
    threadMessages.find(message => message.id === messageId)
  if (!targetMessage) return false
  const reactAction = resolveReactionAction(targetMessage, normalizedEmoji, reacted)

  try {
    await publishChatReaction(baseUrl.value, channelId, messageId, normalizedEmoji, reactAction)
    const updated = applyLocalReaction(targetMessage, normalizedEmoji, reactAction)
    const updateCollection = (messages: ChatMessage[]) =>
      messages.map(message => (message.id === messageId ? { ...message, ...updated } : message))
    if (channelMessages.some(message => message.id === messageId)) {
      state.messagesByChannel[channelId] = updateCollection(channelMessages)
    }
    if (threadId && threadMessages.some(message => message.id === messageId)) {
      state.threadMessagesById[threadId] = updateCollection(threadMessages)
    }
    return true
  } catch (error) {
    state.errorMessage = error instanceof Error ? error.message : String(error)
    return false
  }
}

export async function updateChatChannel(
  tab: BrowserTab,
  baseUrl: Ref<string>,
  channelId: number,
  payload: ChatChannelUpdatePayload
) {
  ensureChatState(tab)
  const state = tab.chatState
  if (!state) return null
  state.errorMessage = ''

  try {
    const updated = await updateChatChannelRequest(baseUrl.value, channelId, payload)
    const channel = state.channels.find(item => item.id === channelId)
    if (!channel) return null

    const channelType = channel.channelType
    if (updated) {
      Object.assign(channel, updated, { channelType: channelType || updated.channelType })
      return channel
    }

    const normalized = normalizeChannelUpdatePayload(payload)
    const { name, ...channelFields } = normalized
    Object.assign(channel, channelFields)
    if (name) {
      channel.title = name
      channel.unicode_title = name
    }
    return channel
  } catch (error) {
    state.errorMessage = error instanceof Error ? error.message : String(error)
    return null
  }
}

export async function interactChatMessage(
  tab: BrowserTab,
  baseUrl: Ref<string>,
  channelId: number,
  messageId: number,
  actionId: string
) {
  ensureChatState(tab)
  const state = tab.chatState
  if (!state) return null
  state.errorMessage = ''

  const normalizedActionId = actionId.trim()
  if (!normalizedActionId) return null

  try {
    return await createChatMessageInteractionRequest(
      baseUrl.value,
      channelId,
      messageId,
      normalizedActionId
    )
  } catch (error) {
    state.errorMessage = error instanceof Error ? error.message : String(error)
    return null
  }
}

export async function editChatMessage(
  tab: BrowserTab,
  baseUrl: Ref<string>,
  channelId: number,
  messageId: number,
  newMessage: string
) {
  ensureChatState(tab)
  const state = tab.chatState
  if (!state) return null
  state.errorMessage = ''

  const jsonPayload = JSON.stringify({ message: newMessage })
  const formPayload = new URLSearchParams({ message: newMessage }).toString()

  let lastError: string | null = null

  for (const path of CHAT_MESSAGE_EDIT_ENDPOINTS(channelId, messageId)) {
    for (const request of [
      {
        headers: { 'Content-Type': 'application/json' },
        body: jsonPayload
      },
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
        body: formPayload
      }
    ]) {
      try {
        const result = await pageFetch<any>(`${baseUrl.value}${path}`, {
          method: 'PUT',
          headers: request.headers,
          body: request.body
        })
        const data = extractData(result)
        if (result.ok) {
          const chatMessage = data?.chat_message || data?.message || data
          if (chatMessage && typeof chatMessage.id === 'number') {
            return normalizeSingleMessage(chatMessage)
          }
          return { id: messageId, message: newMessage, edited: true } as ChatMessage
        }
        lastError = parseErrorMessage(data, '编辑消息失败')
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error)
      }
    }
  }

  state.errorMessage = lastError || '编辑消息失败'
  return null
}

export async function deleteChatMessage(
  tab: BrowserTab,
  baseUrl: Ref<string>,
  channelId: number,
  messageId: number
) {
  ensureChatState(tab)
  const state = tab.chatState
  if (!state) return false
  state.errorMessage = ''

  let lastError: string | null = null

  for (const path of CHAT_MESSAGE_DELETE_ENDPOINTS(channelId, messageId)) {
    try {
      const result = await pageFetch<any>(`${baseUrl.value}${path}`, {
        method: 'DELETE'
      })
      const data = extractData(result)
      if (result.ok) {
        const channelMessages = state.messagesByChannel[channelId] || []
        if (channelMessages.some(message => message.id === messageId)) {
          state.messagesByChannel[channelId] = channelMessages.map(message =>
            message.id === messageId ? { ...message, deleted: true } : message
          )
        }
        for (const [threadId, messages] of Object.entries(state.threadMessagesById)) {
          if (!messages.some(message => message.id === messageId)) continue
          state.threadMessagesById[Number(threadId)] = messages.map(message =>
            message.id === messageId ? { ...message, deleted: true } : message
          )
        }
        return true
      }
      lastError = parseErrorMessage(data, '删除消息失败')
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
    }
  }

  state.errorMessage = lastError || '删除消息失败'
  return false
}

export async function flagChatMessage(
  tab: BrowserTab,
  baseUrl: Ref<string>,
  channelId: number,
  messageId: number,
  flagTypeId: number,
  message?: string
) {
  ensureChatState(tab)
  const state = tab.chatState
  if (!state) return null
  state.errorMessage = ''
  void channelId

  const jsonPayload = JSON.stringify({
    chat_message_id: messageId,
    flag_type_id: flagTypeId,
    ...(message ? { message } : {})
  })
  const formPayload = new URLSearchParams({
    chat_message_id: String(messageId),
    flag_type_id: String(flagTypeId),
    ...(message ? { message } : {})
  }).toString()

  let lastError: string | null = null

  for (const path of CHAT_MESSAGE_FLAG_ENDPOINTS()) {
    for (const request of [
      {
        headers: { 'Content-Type': 'application/json' },
        body: jsonPayload
      },
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
        body: formPayload
      }
    ]) {
      try {
        const result = await pageFetch<any>(`${baseUrl.value}${path}`, {
          method: 'POST',
          headers: request.headers,
          body: request.body
        })
        const data = extractData(result)
        if (result.ok) {
          return data || true
        }
        lastError = parseErrorMessage(data, '举报消息失败')
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error)
      }
    }
  }

  state.errorMessage = lastError || '举报消息失败'
  return null
}

// ==================== Chat channel creation & management ====================

export async function createChatChannel(
  tab: BrowserTab,
  baseUrl: Ref<string>,
  payload: ChatCreateChannelPayload
): Promise<ChatChannel | null> {
  ensureChatState(tab)
  const state = tab.chatState
  if (!state) return null
  state.errorMessage = ''

  if (!state.capabilities.canCreatePublicChannel) {
    state.errorMessage = '站点未开放公开频道创建权限'
    return null
  }

  const name = payload.name.trim()
  if (!name) {
    state.errorMessage = '请输入频道名称'
    return null
  }
  if (!Number.isFinite(payload.chatableId) || payload.chatableId <= 0) {
    state.errorMessage = '请选择频道所属分类'
    return null
  }

  const channelBody: Record<string, any> = {
    name,
    chatable_id: payload.chatableId,
    slug: payload.slug || undefined,
    description: payload.description || undefined,
    emoji: payload.emoji || undefined,
    auto_join_users: payload.autoJoinUsers ?? false,
    threading_enabled: payload.threadingEnabled ?? false
  }
  Object.keys(channelBody).forEach(key => {
    if (channelBody[key] === undefined) delete channelBody[key]
  })

  const jsonPayload = JSON.stringify({ channel: channelBody })
  const formParams = new URLSearchParams()
  Object.entries(channelBody).forEach(([key, value]) => {
    formParams.set(`channel[${key}]`, String(value))
  })
  const formPayload = formParams.toString()

  let lastError: string | null = null

  for (const path of CHAT_CHANNEL_CREATE_ENDPOINTS) {
    for (const request of [
      {
        headers: { 'Content-Type': 'application/json' },
        body: jsonPayload
      },
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
        body: formPayload
      }
    ]) {
      try {
        const result = await pageFetch<any>(`${baseUrl.value}${path}`, {
          method: 'POST',
          headers: request.headers,
          body: request.body
        })
        const data = extractData(result)
        if (!result.ok) {
          lastError = parseErrorMessage(data, '创建频道失败')
          continue
        }
        const channel = data?.channel || data
        if (channel && typeof channel.id === 'number') {
          const normalized = normalizeSingleChannel(channel, 'public')
          state.channels = [normalized, ...state.channels]
          return normalized
        }
        lastError = '频道已创建，但未返回频道数据'
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error)
      }
    }
  }

  state.errorMessage = lastError || '创建频道失败'
  return null
}

export async function createDirectMessageChannel(
  tab: BrowserTab,
  baseUrl: Ref<string>,
  payload: ChatCreateDirectMessagePayload
): Promise<ChatChannel | null> {
  ensureChatState(tab)
  const state = tab.chatState
  if (!state) return null
  state.errorMessage = ''

  if (!state.capabilities.canDirectMessage) {
    state.errorMessage = '站点未开放私聊，或你已关闭聊天功能'
    return null
  }

  const usernames = Array.from(new Set(payload.targetUsernames.map(u => u.trim()).filter(Boolean)))
  if (usernames.length === 0) {
    state.errorMessage = '请至少选择一个用户'
    return null
  }

  const body: Record<string, any> = {
    target_usernames: usernames,
    upsert: payload.upsert ?? true,
    name: payload.name?.trim() || undefined
  }
  Object.keys(body).forEach(key => {
    if (body[key] === undefined) delete body[key]
  })

  const jsonPayload = JSON.stringify(body)
  const formParams = new URLSearchParams()
  usernames.forEach(username => formParams.append('target_usernames[]', username))
  formParams.set('upsert', String(body.upsert))
  if (body.name) formParams.set('name', String(body.name))
  const formPayload = formParams.toString()

  let lastError: string | null = null

  for (const path of CHAT_DIRECT_MESSAGE_CREATE_ENDPOINTS) {
    for (const request of [
      {
        headers: { 'Content-Type': 'application/json' },
        body: jsonPayload
      },
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
        body: formPayload
      }
    ]) {
      try {
        const result = await pageFetch<any>(`${baseUrl.value}${path}`, {
          method: 'POST',
          headers: request.headers,
          body: request.body
        })
        const data = extractData(result)
        if (!result.ok) {
          lastError = parseErrorMessage(data, '创建聊天频道失败')
          continue
        }
        const channel = data?.channel || data
        if (channel && typeof channel.id === 'number') {
          const normalized = normalizeSingleChannel(channel, 'direct')
          const existingIndex = state.channels.findIndex(item => item.id === normalized.id)
          if (existingIndex === -1) {
            state.channels = [normalized, ...state.channels]
          } else {
            state.channels[existingIndex] = {
              ...state.channels[existingIndex],
              ...normalized
            }
          }
          return normalized
        }
        lastError = '聊天频道已创建，但未返回频道数据'
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error)
      }
    }
  }

  state.errorMessage = lastError || '创建聊天频道失败'
  return null
}

export async function getDmChannelForUsernames(
  baseUrl: Ref<string>,
  usernames: string[]
): Promise<ChatChannel | null> {
  const unique = Array.from(new Set(usernames.map(u => u.trim()).filter(Boolean)))
  if (unique.length === 0) return null

  let lastError: string | null = null
  for (const path of CHAT_DIRECT_MESSAGE_LOOKUP_ENDPOINTS) {
    try {
      const result = await pageFetch<any>(
        `${baseUrl.value}${path}?usernames=${encodeURIComponent(unique.join(','))}`
      )
      const data = extractData(result)
      if (result.ok) {
        const channel = data?.channel || data
        if (channel && typeof channel.id === 'number') {
          return normalizeSingleChannel(channel, 'direct')
        }
        return null
      }
      lastError = parseErrorMessage(data, '查找私聊频道失败')
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
    }
  }
  if (lastError) {
    throw new Error(lastError)
  }
  return null
}

export async function loadChannelMembers(
  tab: BrowserTab,
  baseUrl: Ref<string>,
  channelId: number,
  reset = true
): Promise<ChatMember[]> {
  ensureChatState(tab)
  const state = tab.chatState
  if (!state) return []
  if (state.membersLoadingByChannel[channelId]) return state.membersByChannel[channelId] || []
  if (!reset && state.membersHasMoreByChannel[channelId] === false) {
    return state.membersByChannel[channelId] || []
  }

  state.membersLoadingByChannel[channelId] = true
  state.errorMessage = ''

  try {
    let lastError: string | null = null
    const pageSize = 50
    const currentMembers = state.membersByChannel[channelId] || []
    const offset = reset ? 0 : (state.membersOffsetByChannel[channelId] ?? currentMembers.length)
    let members: ChatMember[] = []
    let total: number | null = null

    for (const path of CHAT_MEMBERSHIPS_ENDPOINTS(channelId)) {
      try {
        const params = new URLSearchParams({ offset: String(offset), limit: String(pageSize) })
        const result = await pageFetch<any>(`${baseUrl.value}${path}?${params.toString()}`)
        const data = extractData(result)
        if (result.ok) {
          members = (data?.memberships || []).map((item: any) => {
            const user = item.user || (item as any)
            return {
              id: item.id ?? user?.id,
              user: {
                id: user?.id,
                username: user?.username || '',
                name: user?.name,
                avatar_template: user?.avatar_template || ''
              },
              membership: item.membership || item.current_user_membership,
              last_read_message_id: item.last_read_message_id,
              muted: item.muted,
              notification_level: item.notification_level
            }
          })
          const receivedTotal = Number(data?.meta?.total_rows ?? data?.total_rows)
          total = Number.isFinite(receivedTotal) && receivedTotal >= 0 ? receivedTotal : null
          break
        }
        lastError = parseErrorMessage(data, '加载频道成员失败')
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error)
      }
    }

    if (members.length === 0 && lastError) {
      throw new Error(lastError)
    }

    if (reset) {
      state.membersByChannel[channelId] = members
    } else {
      const existingIds = new Set((state.membersByChannel[channelId] || []).map(m => m.id))
      const fresh = members.filter(m => !existingIds.has(m.id))
      state.membersByChannel[channelId] = [...(state.membersByChannel[channelId] || []), ...fresh]
    }
    const mergedMembers = state.membersByChannel[channelId] || []
    state.membersOffsetByChannel[channelId] = mergedMembers.length
    state.membersTotalByChannel[channelId] = total ?? mergedMembers.length
    state.membersHasMoreByChannel[channelId] =
      total !== null ? mergedMembers.length < total : members.length >= pageSize
    return state.membersByChannel[channelId] || []
  } catch (error) {
    state.errorMessage = error instanceof Error ? error.message : String(error)
    return state.membersByChannel[channelId] || []
  } finally {
    state.membersLoadingByChannel[channelId] = false
  }
}

export async function addMembersToChannel(
  tab: BrowserTab,
  baseUrl: Ref<string>,
  channelId: number,
  usernames: string[],
  groups: string[] = []
): Promise<boolean> {
  ensureChatState(tab)
  const state = tab.chatState
  if (!state) return false
  state.errorMessage = ''

  const body: Record<string, any> = {}
  if (usernames.length > 0) body.usernames = usernames
  if (groups.length > 0) body.groups = groups
  if (Object.keys(body).length === 0) return false

  const jsonPayload = JSON.stringify(body)
  const formPayload = new URLSearchParams(
    Object.entries(body).flatMap(([key, value]) => (value as string[]).map(v => [key, v])) as [
      string,
      string
    ][]
  ).toString()

  let lastError: string | null = null

  for (const path of CHAT_MEMBERSHIPS_ENDPOINTS(channelId)) {
    for (const request of [
      {
        headers: { 'Content-Type': 'application/json' },
        body: jsonPayload
      },
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
        body: formPayload
      }
    ]) {
      try {
        const result = await pageFetch<any>(`${baseUrl.value}${path}`, {
          method: 'POST',
          headers: request.headers,
          body: request.body
        })
        const data = extractData(result)
        if (result.ok) {
          await loadChannelMembers(tab, baseUrl, channelId, true)
          return true
        }
        lastError = parseErrorMessage(data, '添加成员失败')
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error)
      }
    }
  }

  state.errorMessage = lastError || '添加成员失败'
  return false
}

export async function removeMemberFromChannel(
  tab: BrowserTab,
  baseUrl: Ref<string>,
  channelId: number,
  userId: number
): Promise<boolean> {
  ensureChatState(tab)
  const state = tab.chatState
  if (!state) return false
  state.errorMessage = ''

  let lastError: string | null = null

  for (const path of CHAT_MEMBER_REMOVE_ENDPOINTS(channelId, userId)) {
    try {
      const result = await pageFetch<any>(`${baseUrl.value}${path}`, {
        method: 'DELETE'
      })
      const data = extractData(result)
      if (result.ok) {
        const members = state.membersByChannel[channelId] || []
        state.membersByChannel[channelId] = members.filter(m => m.user.id !== userId)
        state.membersTotalByChannel[channelId] = Math.max(
          0,
          (state.membersTotalByChannel[channelId] || 0) - 1
        )
        state.membersOffsetByChannel[channelId] = state.membersByChannel[channelId].length
        return true
      }
      lastError = parseErrorMessage(data, '移除成员失败')
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
    }
  }

  state.errorMessage = lastError || '移除成员失败'
  return false
}

export async function followChatChannel(
  tab: BrowserTab,
  baseUrl: Ref<string>,
  channelId: number
): Promise<boolean> {
  ensureChatState(tab)
  const state = tab.chatState
  if (!state) return false
  state.errorMessage = ''

  let lastError: string | null = null

  for (const path of CHAT_MEMBERSHIP_ME_ENDPOINTS(channelId)) {
    try {
      const result = await pageFetch<any>(`${baseUrl.value}${path}`, {
        method: 'POST'
      })
      const data = extractData(result)
      if (result.ok) {
        const channel = state.channels.find(item => item.id === channelId)
        if (channel) {
          const membership = extractMembershipPayload(data)
          channel.current_user_membership = {
            chat_channel_id: channelId,
            ...channel.current_user_membership,
            ...membership,
            following: true
          }
        }
        return true
      }
      lastError = parseErrorMessage(data, '关注频道失败')
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
    }
  }

  state.errorMessage = lastError || '关注频道失败'
  return false
}

export async function unfollowChatChannel(
  tab: BrowserTab,
  baseUrl: Ref<string>,
  channelId: number
): Promise<boolean> {
  ensureChatState(tab)
  const state = tab.chatState
  if (!state) return false
  state.errorMessage = ''

  let lastError: string | null = null

  for (const path of CHAT_MEMBERSHIP_FOLLOWS_ENDPOINTS(channelId)) {
    try {
      const result = await pageFetch<any>(`${baseUrl.value}${path}`, {
        method: 'DELETE'
      })
      const data = extractData(result)
      if (result.ok) {
        const channel = state.channels.find(item => item.id === channelId)
        if (channel) {
          const membership = extractMembershipPayload(data)
          channel.current_user_membership = {
            chat_channel_id: channelId,
            ...channel.current_user_membership,
            ...membership,
            following: false
          }
        }
        return true
      }
      lastError = parseErrorMessage(data, '取消关注频道失败')
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
    }
  }

  state.errorMessage = lastError || '取消关注频道失败'
  return false
}

export async function updateMembershipSettings(
  tab: BrowserTab,
  baseUrl: Ref<string>,
  channelId: number,
  payload: ChatMembershipUpdatePayload
): Promise<boolean> {
  ensureChatState(tab)
  const state = tab.chatState
  if (!state) return false
  state.errorMessage = ''

  const notificationSettings: Record<string, boolean | number | string> = {}
  if (typeof payload.muted === 'boolean') notificationSettings.muted = payload.muted
  if (payload.notification_level !== undefined) {
    notificationSettings.notification_level = payload.notification_level
  }
  const membershipSettings: Record<string, boolean> = {}
  if (typeof payload.starred === 'boolean') membershipSettings.starred = payload.starred
  if (
    Object.keys(notificationSettings).length === 0 &&
    Object.keys(membershipSettings).length === 0
  ) {
    return false
  }

  let lastError: string | null = null

  const applyMembershipResponse = (data: any, fallback: Record<string, any>) => {
    const channel = state.channels.find(item => item.id === channelId)
    if (!channel) return
    const membership = extractMembershipPayload(data)
    channel.current_user_membership = {
      chat_channel_id: channelId,
      ...channel.current_user_membership,
      ...fallback,
      ...membership
    }
  }

  const sendSettings = async (
    paths: string[],
    body: Record<string, boolean | number | string>,
    rootKey?: string
  ) => {
    const jsonBody = rootKey ? { [rootKey]: body } : body
    const formParams = new URLSearchParams()
    Object.entries(body).forEach(([key, value]) => {
      formParams.set(rootKey ? `${rootKey}[${key}]` : key, String(value))
    })

    for (const path of paths) {
      for (const request of [
        {
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(jsonBody)
        },
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
          body: formParams.toString()
        }
      ]) {
        try {
          const result = await pageFetch<any>(`${baseUrl.value}${path}`, {
            method: 'PUT',
            headers: request.headers,
            body: request.body
          })
          const data = extractData(result)
          if (result.ok) {
            applyMembershipResponse(data, body)
            return true
          }
          lastError = parseErrorMessage(data, '更新成员设置失败')
        } catch (error) {
          lastError = error instanceof Error ? error.message : String(error)
        }
      }
    }
    return false
  }

  if (
    Object.keys(notificationSettings).length > 0 &&
    !(await sendSettings(
      CHAT_NOTIFICATIONS_SETTINGS_ENDPOINTS(channelId),
      notificationSettings,
      'notifications_settings'
    ))
  ) {
    state.errorMessage = lastError || '更新通知设置失败'
    return false
  }

  if (
    Object.keys(membershipSettings).length > 0 &&
    !(await sendSettings(CHAT_MEMBERSHIP_ME_ENDPOINTS(channelId), membershipSettings))
  ) {
    state.errorMessage = lastError || '更新收藏设置失败'
    return false
  }

  return true
}

export async function updateChatChannelStatus(
  tab: BrowserTab,
  baseUrl: Ref<string>,
  channelId: number,
  status: ChatChannelEditableStatus
): Promise<boolean> {
  ensureChatState(tab)
  const state = tab.chatState
  if (!state) return false
  state.errorMessage = ''

  let lastError: string | null = null
  const requests = [
    {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    },
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
      body: new URLSearchParams({ status }).toString()
    }
  ]

  for (const path of CHAT_CHANNEL_STATUS_ENDPOINTS(channelId)) {
    for (const request of requests) {
      try {
        const result = await pageFetch<any>(`${baseUrl.value}${path}`, {
          method: 'PUT',
          headers: request.headers,
          body: request.body
        })
        const data = extractData(result)
        if (result.ok) {
          const channel = state.channels.find(item => item.id === channelId)
          const updated = data?.channel || data
          if (channel) {
            Object.assign(
              channel,
              updated && typeof updated === 'object' ? normalizeSingleChannel(updated) : { status }
            )
            channel.status = status
          }
          return true
        }
        lastError = parseErrorMessage(data, '更新频道状态失败')
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error)
      }
    }
  }

  state.errorMessage = lastError || '更新频道状态失败'
  return false
}

export async function leaveChatChannel(
  tab: BrowserTab,
  baseUrl: Ref<string>,
  channelId: number
): Promise<boolean> {
  ensureChatState(tab)
  const state = tab.chatState
  if (!state) return false
  state.errorMessage = ''

  let lastError: string | null = null
  for (const path of CHAT_MEMBERSHIP_ME_ENDPOINTS(channelId)) {
    try {
      const result = await pageFetch<any>(`${baseUrl.value}${path}`, { method: 'DELETE' })
      const data = extractData(result)
      if (result.ok) {
        state.channels = state.channels.filter(item => item.id !== channelId)
        delete state.messagesByChannel[channelId]
        delete state.hasMoreByChannel[channelId]
        delete state.beforeMessageIdByChannel[channelId]
        delete state.membersByChannel[channelId]
        delete state.membersTotalByChannel[channelId]
        delete state.membersLoadingByChannel[channelId]
        delete state.membersOffsetByChannel[channelId]
        delete state.membersHasMoreByChannel[channelId]
        if (state.activeChannelId === channelId) {
          state.activeChannelId = state.channels[0]?.id || null
        }
        return true
      }
      lastError = parseErrorMessage(data, '退出频道失败')
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
    }
  }

  state.errorMessage = lastError || '退出频道失败'
  return false
}

export async function deleteChatChannel(
  tab: BrowserTab,
  baseUrl: Ref<string>,
  channelId: number
): Promise<boolean> {
  ensureChatState(tab)
  const state = tab.chatState
  if (!state) return false
  state.errorMessage = ''

  let lastError: string | null = null

  for (const path of CHAT_CHANNEL_DELETE_ENDPOINTS(channelId)) {
    try {
      const result = await pageFetch<any>(`${baseUrl.value}${path}`, {
        method: 'DELETE'
      })
      const data = extractData(result)
      if (result.ok) {
        state.channels = state.channels.filter(item => item.id !== channelId)
        delete state.messagesByChannel[channelId]
        delete state.hasMoreByChannel[channelId]
        delete state.beforeMessageIdByChannel[channelId]
        delete state.membersByChannel[channelId]
        delete state.membersTotalByChannel[channelId]
        delete state.membersLoadingByChannel[channelId]
        delete state.membersOffsetByChannel[channelId]
        delete state.membersHasMoreByChannel[channelId]
        if (state.activeChannelId === channelId) {
          state.activeChannelId = state.channels[0]?.id || null
        }
        return true
      }
      lastError = parseErrorMessage(data, '删除频道失败')
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
    }
  }

  state.errorMessage = lastError || '删除频道失败'
  return false
}

export interface ChatableSearchResult {
  users: DiscourseUser[]
  groups: Array<{ id: number; name: string; user_count?: number }>
}

const normalizeChatableUser = (entry: any): DiscourseUser | null => {
  const model = entry?.model || entry?.user || entry
  const id = Number(model?.id)
  const username = typeof model?.username === 'string' ? model.username.trim() : ''
  if (!Number.isFinite(id) || !username) return null
  return {
    ...model,
    id,
    username,
    name: typeof model.name === 'string' ? model.name : undefined,
    avatar_template: typeof model.avatar_template === 'string' ? model.avatar_template : '',
    can_chat: typeof model.can_chat === 'boolean' ? model.can_chat : undefined,
    has_chat_enabled:
      typeof model.has_chat_enabled === 'boolean' ? model.has_chat_enabled : undefined,
    can_chat_user: typeof model.can_chat_user === 'boolean' ? model.can_chat_user : undefined
  }
}

const normalizeChatableGroup = (
  entry: any
): { id: number; name: string; user_count?: number } | null => {
  const model = entry?.model || entry?.group || entry
  const id = Number(model?.id)
  const name = typeof model?.name === 'string' ? model.name.trim() : ''
  if (!Number.isFinite(id) || !name) return null
  return {
    id,
    name,
    user_count: typeof model.user_count === 'number' ? model.user_count : undefined
  }
}

export async function searchChatables(
  baseUrl: Ref<string>,
  filter: string,
  limit = 20
): Promise<ChatableSearchResult | null> {
  const trimmed = filter.trim()
  const resultLimit = Math.max(1, Math.floor(limit))
  let lastError: string | null = null

  for (const path of CHAT_CHATABLES_ENDPOINTS) {
    try {
      // Keep this aligned with Chat's official ChatablesLoader contract. The
      // endpoint owns its server-side result limit and expects `term`, not the
      // generic Discourse user-search `filter` parameter.
      const params = new URLSearchParams({
        term: trimmed,
        include_users: 'true',
        include_groups: 'false',
        include_category_channels: 'false',
        include_direct_message_channels: 'false'
      })
      const result = await pageFetch<any>(`${baseUrl.value}${path}?${params.toString()}`)
      const data = extractData(result)
      if (result.ok) {
        const users = (Array.isArray(data?.users) ? data.users : [])
          .map(normalizeChatableUser)
          .filter((user: DiscourseUser | null): user is DiscourseUser => !!user)
          .slice(0, resultLimit)
        const groups = (Array.isArray(data?.groups) ? data.groups : [])
          .map(normalizeChatableGroup)
          .filter(
            (
              group: { id: number; name: string; user_count?: number } | null
            ): group is { id: number; name: string; user_count?: number } => !!group
          )
          .slice(0, resultLimit)
        return {
          users,
          groups
        }
      }
      lastError = parseErrorMessage(data, '搜索用户失败')
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
    }
  }

  if (lastError) {
    throw new Error(lastError)
  }
  return null
}

// ==================== Channel discovery (browse public channels) ====================

/**
 * Fetch public channels the current user can browse & join via the official
 * Chatables contract. The endpoint returns `channels` where every entry is
 * either a bare channel payload or `{ channel, can_join }` — handle both.
 */
export async function fetchDiscoverableChannels(
  baseUrl: Ref<string>,
  limit = 100
): Promise<ChatChannel[]> {
  const resultLimit = Math.max(1, Math.floor(limit))
  let lastError: string | null = null

  for (const path of CHAT_CHATABLES_ENDPOINTS) {
    try {
      const params = new URLSearchParams({
        include_users: 'false',
        include_groups: 'false',
        include_category_channels: 'true',
        include_direct_message_channels: 'false'
      })
      const result = await pageFetch<any>(`${baseUrl.value}${path}?${params.toString()}`)
      const data = extractData(result)
      if (result.ok) {
        const raw = Array.isArray(data?.channels) ? data.channels : []
        const channels: ChatChannel[] = raw
          .map((entry: any) => {
            const payload =
              entry?.channel && typeof entry.channel === 'object' ? entry.channel : entry
            if (!payload || typeof payload.id !== 'number') return null
            const channel = normalizeSingleChannel(payload, 'public')
            if (entry && typeof entry === 'object' && 'can_join' in entry) {
              channel.meta = {
                ...(channel.meta || {}),
                can_join_chat_channel: Boolean(entry.can_join)
              }
            }
            return channel
          })
          .filter((channel: ChatChannel | null): channel is ChatChannel => !!channel)
          .slice(0, resultLimit)
        return channels
      }
      lastError = parseErrorMessage(data, '加载可发现频道失败')
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
    }
  }

  if (lastError) {
    throw new Error(lastError)
  }
  return []
}

export async function loadDiscoverableChannels(
  tab: BrowserTab,
  baseUrl: Ref<string>
): Promise<ChatChannel[]> {
  ensureChatState(tab)
  const state = tab.chatState
  if (!state) return []
  if (state.discoverLoading) return state.discoverableChannels

  state.discoverLoading = true
  state.discoverErrorMessage = ''
  try {
    const channels = await fetchDiscoverableChannels(baseUrl)
    // Keep already-joined channels out of the discovery list.
    const joinedIds = new Set(state.channels.map(channel => channel.id))
    state.discoverableChannels = channels.filter(channel => !joinedIds.has(channel.id))
    return state.discoverableChannels
  } catch (error) {
    state.discoverErrorMessage = error instanceof Error ? error.message : String(error)
    return state.discoverableChannels
  } finally {
    state.discoverLoading = false
  }
}

export async function joinChatChannel(
  tab: BrowserTab,
  baseUrl: Ref<string>,
  channelId: number
): Promise<ChatChannel | null> {
  ensureChatState(tab)
  const state = tab.chatState
  if (!state) return null
  if (!Number.isFinite(channelId) || channelId <= 0) return null
  if (state.joiningChannelIds[channelId]) return null
  state.errorMessage = ''
  state.joiningChannelIds[channelId] = true

  try {
    let joined = false
    let lastError: string | null = null

    // Joining a public channel = creating a membership for the current user.
    for (const path of CHAT_MEMBERSHIP_ME_ENDPOINTS(channelId)) {
      try {
        const result = await pageFetch<any>(`${baseUrl.value}${path}`, { method: 'POST' })
        const data = extractData(result)
        if (result.ok) {
          joined = true
          break
        }
        lastError = parseErrorMessage(data, '加入频道失败')
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error)
      }
    }

    if (!joined) {
      state.errorMessage = lastError || '加入频道失败'
      return null
    }

    let channel: ChatChannel | undefined = state.channels.find(item => item.id === channelId)
    if (!channel) {
      channel = (await fetchChatChannel(baseUrl.value, channelId)) || undefined
    }
    if (!channel) {
      channel = state.discoverableChannels.find(item => item.id === channelId) || undefined
    }
    if (channel) {
      channel = {
        ...channel,
        current_user_membership: {
          ...(channel.current_user_membership || {}),
          chat_channel_id: channelId,
          following: true,
          unread_count: 0
        }
      }
      if (!state.channels.some(item => item.id === channelId)) {
        state.channels = [channel, ...state.channels]
      } else {
        state.channels = state.channels.map(item =>
          item.id === channelId ? { ...item, ...channel } : item
        )
      }
      state.discoverableChannels = state.discoverableChannels.filter(item => item.id !== channelId)
      return channel
    }

    // Server accepted the join but we have no channel payload — refresh the
    // joined channel list so the new channel appears.
    state.channels = await fetchChatChannels(baseUrl.value)
    state.discoverableChannels = state.discoverableChannels.filter(item => item.id !== channelId)
    return state.channels.find(item => item.id === channelId) || null
  } finally {
    state.joiningChannelIds[channelId] = false
  }
}

// ==================== Add users to direct message channels ====================

export async function addUsersToDirectMessageChannel(
  tab: BrowserTab,
  baseUrl: Ref<string>,
  channelId: number,
  usernames: string[]
): Promise<boolean> {
  ensureChatState(tab)
  const state = tab.chatState
  if (!state) return false
  state.errorMessage = ''

  const unique = Array.from(new Set(usernames.map(u => u.trim()).filter(Boolean)))
  if (unique.length === 0) return false

  const body: Record<string, any> = { target_usernames: unique }
  const jsonPayload = JSON.stringify(body)
  const formParams = new URLSearchParams()
  unique.forEach(username => formParams.append('target_usernames[]', username))
  const formPayload = formParams.toString()

  let lastError: string | null = null

  for (const path of CHAT_DIRECT_MESSAGE_UPDATE_ENDPOINTS(channelId)) {
    for (const request of [
      {
        headers: { 'Content-Type': 'application/json' },
        body: jsonPayload
      },
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
        body: formPayload
      }
    ]) {
      try {
        const result = await pageFetch<any>(`${baseUrl.value}${path}`, {
          method: 'PUT',
          headers: request.headers,
          body: request.body
        })
        const data = extractData(result)
        if (result.ok) {
          await loadChannelMembers(tab, baseUrl, channelId, true)
          return true
        }
        lastError = parseErrorMessage(data, '添加用户失败')
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error)
      }
    }
  }

  state.errorMessage = lastError || '添加用户失败'
  return false
}
