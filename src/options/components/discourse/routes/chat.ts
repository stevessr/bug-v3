import type { Ref } from 'vue'

import type { BrowserTab, ChatChannel, ChatMessage, DiscourseUser } from '../types'
import { pageFetch, extractData } from '../utils'

const CHAT_CHANNEL_ENDPOINTS = ['/chat/api/chat_channels.json', '/chat/api/chat_channels']

const CHAT_MESSAGE_ENDPOINTS = (channelId: number) => [
  `/chat/api/chat_channels/${channelId}/messages.json`,
  `/chat/api/chat_channels/${channelId}/messages`
]

const CHAT_SEND_ENDPOINTS = ['/chat/api/chat_messages.json', '/chat/api/chat_messages']

const buildChatMessageUrl = (baseUrl: string, channelId: number, params?: URLSearchParams) => {
  const query = params && params.toString() ? `?${params.toString()}` : ''
  return CHAT_MESSAGE_ENDPOINTS(channelId).map(path => `${baseUrl}${path}${query}`)
}

const normalizeChatChannels = (data: any): ChatChannel[] => {
  if (!data) return []
  const direct = Array.isArray(data.direct_message_channels) ? data.direct_message_channels : []
  const publicChannels = Array.isArray(data.public_channels)
    ? data.public_channels
    : Array.isArray(data.channels)
      ? data.channels
      : Array.isArray(data.chat_channels)
        ? data.chat_channels
        : []
  return [...publicChannels, ...direct]
}

const extractChatMessages = (data: any): { messages: ChatMessage[]; hasMore: boolean } => {
  if (!data) return { messages: [], hasMore: false }
  const messages = Array.isArray(data.messages)
    ? data.messages
    : Array.isArray(data.chat_messages)
      ? data.chat_messages
      : Array.isArray(data)
        ? data
        : []
  const meta = data.meta || data
  const hasMore = !!(meta?.can_load_more || meta?.has_more || meta?.more)
  return { messages, hasMore }
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

const fetchChatChannels = async (baseUrl: string) => {
  for (const path of CHAT_CHANNEL_ENDPOINTS) {
    try {
      const result = await pageFetch<any>(`${baseUrl}${path}`)
      const data = extractData(result)
      const channels = normalizeChatChannels(data)
      if (channels.length > 0 || result.ok) {
        return channels
      }
    } catch {
      // try next endpoint
    }
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
  if (beforeMessageId) {
    params.set('before_message_id', String(beforeMessageId))
  }
  const urls = buildChatMessageUrl(baseUrl, channelId, params)
  for (const url of urls) {
    try {
      const result = await pageFetch<any>(url)
      const data = extractData(result)
      return extractChatMessages(data)
    } catch {
      // try next endpoint
    }
  }
  return { messages: [], hasMore: false }
}

const postChatMessage = async (baseUrl: string, channelId: number, message: string) => {
  const payload = JSON.stringify({
    chat_channel_id: channelId,
    message
  })
  for (const path of CHAT_SEND_ENDPOINTS) {
    try {
      const result = await pageFetch<any>(`${baseUrl}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: payload
      })
      const data = extractData(result)
      if (data?.chat_message) return data.chat_message as ChatMessage
      if (data?.message) return data as ChatMessage
      if (data?.id) return data as ChatMessage
    } catch {
      // try next endpoint
    }
  }
  return null
}

export async function loadChat(
  tab: BrowserTab,
  baseUrl: Ref<string>,
  users: Ref<Map<number, DiscourseUser>>,
  targetChannelId?: number | null
) {
  ensureChatState(tab)
  const state = tab.chatState!
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
  const state = tab.chatState!
  state.loadingMessages = true
  state.errorMessage = ''

  if (reset) {
    state.messagesByChannel[channelId] = []
    state.beforeMessageIdByChannel[channelId] = null
    state.hasMoreByChannel[channelId] = true
  }

  const beforeId = reset ? null : state.beforeMessageIdByChannel[channelId]
  const { messages, hasMore } = await fetchChatMessages(baseUrl.value, channelId, beforeId)

  if (messages.length > 0) {
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
    })
  }

  const existing = state.messagesByChannel[channelId] || []
  const merged = reset ? messages : [...messages, ...existing]
  state.messagesByChannel[channelId] = merged
  state.hasMoreByChannel[channelId] = hasMore

  if (merged.length > 0) {
    const minId = merged.reduce((min, item) => (item.id < min ? item.id : min), merged[0].id)
    state.beforeMessageIdByChannel[channelId] = minId
  }

  state.loadingMessages = false
}

export async function sendChatMessage(
  tab: BrowserTab,
  baseUrl: Ref<string>,
  channelId: number,
  message: string
) {
  ensureChatState(tab)
  const state = tab.chatState!
  state.sendingMessage = true
  state.errorMessage = ''

  try {
    const sent = await postChatMessage(baseUrl.value, channelId, message)
    if (sent) {
      const existing = state.messagesByChannel[channelId] || []
      state.messagesByChannel[channelId] = [...existing, sent]
      return sent
    }
  } catch (error) {
    state.errorMessage = error instanceof Error ? error.message : String(error)
  } finally {
    state.sendingMessage = false
  }

  return null
}
