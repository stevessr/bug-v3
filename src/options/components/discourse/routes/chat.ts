import type { Ref } from 'vue'

import type {
  BrowserTab,
  ChatChannel,
  ChatChannelUpdatePayload,
  ChatMessage,
  DiscourseUser
} from '../types'
import { pageFetch, extractData } from '../utils'

type ChatReactionAction = 'add' | 'remove'

const CHAT_CHANNEL_ENDPOINTS = ['/chat/api/me/channels']

const CHAT_MESSAGE_ENDPOINTS = (channelId: number) => [`/chat/api/channels/${channelId}/messages`]

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

const CHAT_CHANNEL_UPDATE_ENDPOINTS = (channelId: number) => [`/chat/api/channels/${channelId}`]

const buildUrlWithQuery = (baseUrl: string, path: string, params?: URLSearchParams) => {
  const query = params && params.toString() ? `?${params.toString()}` : ''
  return `${baseUrl}${path}${query}`
}

const parseErrorMessage = (data: any, fallback: string) => {
  if (Array.isArray(data?.errors) && data.errors.length > 0) {
    return String(data.errors[0])
  }
  if (typeof data?.error === 'string' && data.error.trim()) return data.error
  if (typeof data?.message === 'string' && data.message.trim()) return data.message
  return fallback
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
  })

  return channels
}

const normalizeSingleMessage = (value: any): ChatMessage => {
  const message = { ...(value as ChatMessage) }
  if (!Array.isArray(message.reactions)) {
    message.reactions = []
  }
  if (!Array.isArray(message.blocks)) {
    message.blocks = []
  }
  return message
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

const dedupeMessagesById = (messages: ChatMessage[]): ChatMessage[] => {
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
      loadingChannels: false,
      loadingMessages: false,
      sendingMessage: false,
      errorMessage: ''
    }
  }
}

const registerMessageUsers = (users: Ref<Map<number, DiscourseUser>>, messages: ChatMessage[]) => {
  messages.forEach(message => {
    if (message.user) {
      users.value.set(message.user.id, message.user)
      return
    }
    if (message.user_id && message.username) {
      users.value.set(message.user_id, {
        id: message.user_id,
        username: message.username,
        name: message.name,
        avatar_template: message.avatar_template || ''
      })
    }
  })
}

const updateChannelLastMessage = (
  channels: ChatChannel[],
  channelId: number,
  message: ChatMessage | null | undefined
) => {
  if (!message) return
  const channel = channels.find(item => item.id === channelId)
  if (!channel) return
  channel.last_message_id = message.id
  channel.last_message_sent_at = message.created_at
  channel.last_message = {
    id: message.id,
    cooked: message.cooked,
    message: message.message,
    created_at: message.created_at
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

const fetchChatMessages = async (
  baseUrl: string,
  channelId: number,
  beforeMessageId?: number | null
) => {
  const params = new URLSearchParams()
  params.set('page_size', '50')
  params.set('direction', 'past')
  if (beforeMessageId) {
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

const postChatMessage = async (baseUrl: string, channelId: number, message: string) => {
  const jsonPayload = JSON.stringify({
    chat_channel_id: channelId,
    message
  })
  const formPayload = new URLSearchParams({
    chat_channel_id: String(channelId),
    message
  }).toString()

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

const fetchChatMessageById = async (baseUrl: string, channelId: number, messageId: number) => {
  const aroundTargetParams = new URLSearchParams({
    target_message_id: String(messageId)
  })
  for (const path of CHAT_MESSAGE_ENDPOINTS(channelId)) {
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
  const formPayload = new URLSearchParams({
    react_action: reactAction,
    emoji
  }).toString()
  const jsonPayload = JSON.stringify({
    react_action: reactAction,
    emoji
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
  const reactions = Array.isArray(message.reactions) ? [...message.reactions] : []
  const targetIndex = reactions.findIndex(item => item.emoji === emoji)

  if (reactAction === 'add') {
    if (targetIndex === -1) {
      reactions.push({ emoji, count: 1, reacted: true, users: [] })
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
  const target = message?.reactions?.find(item => item.emoji === emoji)
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
  targetChannelId?: number | null
) {
  ensureChatState(tab)
  const state = tab.chatState
  if (!state) return
  state.loadingChannels = true
  state.errorMessage = ''

  try {
    const channels = await fetchChatChannels(baseUrl.value)
    state.channels = channels
    if (channels.length === 0) {
      state.errorMessage = '暂无可用聊天频道，请确认已登录。'
      return
    }

    const nextChannelId =
      (targetChannelId && channels.find(channel => channel.id === targetChannelId)?.id) ||
      state.activeChannelId ||
      channels[0]?.id ||
      null

    state.activeChannelId = nextChannelId

    if (nextChannelId) {
      await loadChatMessages(tab, baseUrl, users, nextChannelId, true)
    }
  } catch (error) {
    state.errorMessage = error instanceof Error ? error.message : String(error)
  } finally {
    state.loadingChannels = false
  }
}

export async function loadChatMessages(
  tab: BrowserTab,
  baseUrl: Ref<string>,
  users: Ref<Map<number, DiscourseUser>>,
  channelId: number,
  reset = false
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
  }

  try {
    const beforeId = reset ? null : state.beforeMessageIdByChannel[channelId]
    const { messages, hasMore } = await fetchChatMessages(baseUrl.value, channelId, beforeId)

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

const channelsFromState = (state: NonNullable<BrowserTab['chatState']>) => state.channels

export async function sendChatMessage(
  tab: BrowserTab,
  baseUrl: Ref<string>,
  users: Ref<Map<number, DiscourseUser>>,
  channelId: number,
  message: string
) {
  ensureChatState(tab)
  const state = tab.chatState
  if (!state) return null
  state.sendingMessage = true
  state.errorMessage = ''

  try {
    const created = await postChatMessage(baseUrl.value, channelId, message)
    let sentMessage = created.message

    if (!sentMessage && created.messageId) {
      sentMessage = await fetchChatMessageById(baseUrl.value, channelId, created.messageId)
    }

    if (!sentMessage && created.messageId) {
      sentMessage = normalizeSingleMessage({
        id: created.messageId,
        message,
        created_at: new Date().toISOString(),
        chat_channel_id: channelId
      })
    }

    if (!sentMessage) {
      throw new Error('消息已发送，但未能同步到本地列表')
    }

    registerMessageUsers(users, [sentMessage])

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
  } finally {
    state.sendingMessage = false
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

  const normalizedEmoji = emoji.trim().replace(/^:/, '').replace(/:$/, '')
  if (!normalizedEmoji) return false

  const channelMessages = state.messagesByChannel[channelId] || []
  const targetIndex = channelMessages.findIndex(message => message.id === messageId)
  if (targetIndex === -1) return false

  const targetMessage = channelMessages[targetIndex]
  const reactAction = resolveReactionAction(targetMessage, normalizedEmoji, reacted)

  try {
    await publishChatReaction(baseUrl.value, channelId, messageId, normalizedEmoji, reactAction)
    const updated = applyLocalReaction(targetMessage, normalizedEmoji, reactAction)
    channelMessages[targetIndex] = updated
    state.messagesByChannel[channelId] = [...channelMessages]
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

    Object.assign(channel, normalizeChannelUpdatePayload(payload))
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
