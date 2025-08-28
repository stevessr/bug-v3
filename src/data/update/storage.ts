import type { Settings } from '../type/settings/settings'
declare const chrome: any
import type { EmojiGroup } from '../type/emoji/emoji'

import { v4 as uuidv4 } from 'uuid'

const STORAGE_KEY = 'bugcopilot_settings_v1'
const KEY_SETTINGS = 'Settings'
const KEY_UNGROUPED = 'ungrouped'
const KEY_EMOJI_PREFIX = 'emojiGroups-'
const KEY_EMOJI_INDEX = 'emojiGroups-index'
const KEY_COMMON_EMOJIS = 'emojiGroups-common' // 常用表情专用键值
const KEY_CHAT_HISTORY = 'openrouter-chat-history' // OpenRouter对话历史
const KEY_CHAT_SETTINGS = 'openrouter-chat-settings' // OpenRouter聊天设置
const KEY_CONTAINER_SIZE = 'openrouter-container-size' // 容器大小设置

// in-memory cache mirroring chrome.storage.local for synchronous reads
let extCache: Record<string, any> = {}

// Sync management
let lastSyncTime = 0
const SYNC_INTERVAL = 5000 // 5 seconds minimum
let syncTimer: number | null = null
let pendingSync = false

// Message broadcasting for real-time updates
const messageListeners: Set<(data: any) => void> = new Set()

// Export message listener management for external use
export function addMessageListener(listener: (data: any) => void) {
  messageListeners.add(listener)
  return () => messageListeners.delete(listener)
}

function broadcastMessage(type: string, data: any) {
  const message = { type, data, timestamp: Date.now() }
  messageListeners.forEach((listener) => {
    try {
      listener(message)
    } catch (error) {
      console.warn('[Storage] Message listener error:', error)
    }
  })

  // Also dispatch as custom event for backward compatibility
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent('storage-update', { detail: message }))
    } catch (_) {}
  }
}

// 创建常用表情分组（硬编码）
function createCommonEmojiGroup(): EmojiGroup {
  return {
    UUID: 'common-emoji-group',
    displayName: '常用表情',
    icon: '⭐',
    order: 0,
    emojis: [], // 初始为空，由用户添加
  }
}

// 确保常用表情分组存在 - 同步版本，优先使用localStorage
function ensureCommonEmojiGroup() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const existing = window.localStorage.getItem(KEY_COMMON_EMOJIS)
      if (!existing) {
        const commonGroup = createCommonEmojiGroup()
        window.localStorage.setItem(KEY_COMMON_EMOJIS, JSON.stringify(commonGroup))
        console.log('[Storage] Created common emoji group in localStorage')
        // 标记需要同步到扩展存储
        scheduleSyncToExtension()
      }
    }
  } catch (error) {
    console.warn('[Storage] Failed to ensure common emoji group:', error)
  }
}

// Schedule sync to extension storage
function scheduleSyncToExtension() {
  const now = Date.now()
  if (now - lastSyncTime < SYNC_INTERVAL && syncTimer) {
    return // Already scheduled and within interval
  }

  if (syncTimer) {
    clearTimeout(syncTimer)
  }

  const delay = Math.max(0, SYNC_INTERVAL - (now - lastSyncTime))
  syncTimer = window.setTimeout(() => {
    syncToExtensionStorage().finally(() => {
      syncTimer = null
    })
  }, delay)
}

// Sync localStorage to extension storage
async function syncToExtensionStorage(): Promise<void> {
  if (pendingSync) return

  try {
    pendingSync = true
    lastSyncTime = Date.now()

    if (typeof window === 'undefined' || !window.localStorage) {
      return
    }

    // Get all data from localStorage
    const storeObj: any = {}

    // Copy settings
    try {
      const settingsRaw = window.localStorage.getItem(KEY_SETTINGS)
      if (settingsRaw) {
        storeObj[KEY_SETTINGS] = JSON.parse(settingsRaw)
      }
    } catch (_) {}

    // Copy ungrouped
    try {
      const ungroupedRaw = window.localStorage.getItem(KEY_UNGROUPED)
      if (ungroupedRaw) {
        storeObj[KEY_UNGROUPED] = JSON.parse(ungroupedRaw)
      }
    } catch (_) {}

    // Copy common emoji group
    try {
      const commonRaw = window.localStorage.getItem(KEY_COMMON_EMOJIS)
      if (commonRaw) {
        storeObj[KEY_COMMON_EMOJIS] = JSON.parse(commonRaw)
      }
    } catch (_) {}

    // Copy emoji groups and build index
    const index: string[] = []
    try {
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i)
        if (key && key.startsWith(KEY_EMOJI_PREFIX) && key !== KEY_COMMON_EMOJIS) {
          try {
            const groupRaw = window.localStorage.getItem(key)
            if (groupRaw) {
              const group = JSON.parse(groupRaw)
              storeObj[key] = group
              if (group.UUID) {
                index.push(group.UUID)
              }
            }
          } catch (_) {}
        }
      }
      storeObj[KEY_EMOJI_INDEX] = index
    } catch (_) {}

    // Copy chat history and container size
    try {
      const chatRaw = window.localStorage.getItem(KEY_CHAT_HISTORY)
      if (chatRaw) {
        storeObj[KEY_CHAT_HISTORY] = JSON.parse(chatRaw)
      }
    } catch (_) {}

    try {
      const containerRaw = window.localStorage.getItem(KEY_CONTAINER_SIZE)
      if (containerRaw) {
        storeObj[KEY_CONTAINER_SIZE] = JSON.parse(containerRaw)
      }
    } catch (_) {}

    // Sync to extension storage
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      await new Promise<void>((resolve) => {
        chrome.storage.local.set(storeObj, () => {
          if (chrome.runtime && chrome.runtime.lastError) {
            console.warn('[Storage] Extension sync error:', chrome.runtime.lastError)
          } else {
            console.log(
              '[Storage] Synced to extension storage, keys:',
              Object.keys(storeObj).length,
            )
            // Update in-memory cache
            Object.assign(extCache, storeObj)
          }
          resolve()
        })
      })
    }
  } catch (error) {
    console.warn('[Storage] Sync to extension failed:', error)
  } finally {
    pendingSync = false
  }
}

export type PersistPayload = {
  Settings: Settings
  emojiGroups: EmojiGroup[]
  // newly added: ungrouped emojis that are not inside any group
  ungrouped?: any[]
}

export function loadPayload(): PersistPayload | null {
  if (typeof window === 'undefined' || !window.localStorage) {
    // Fallback to extension storage for non-browser environments
    return loadFromExtensionStorageSync()
  }

  try {
    // Primary: Load from localStorage (fast, synchronous)
    const payload = loadFromLocalStorage()
    if (payload) {
      return payload
    }

    // Fallback: Load from extension storage if localStorage is empty
    return loadFromExtensionStorageSync()
  } catch (error) {
    console.warn('[Storage] Failed to load payload:', error)
    return null
  }
}

// Load from localStorage (synchronous, fast)
function loadFromLocalStorage(): PersistPayload | null {
  try {
    // Check for monolithic payload (backward compatibility)
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw) {
      try {
        return JSON.parse(raw) as PersistPayload
      } catch (_) {
        // Continue to split keys
      }
    }

    // Load from split keys
    const settingsRaw = window.localStorage.getItem(KEY_SETTINGS)
    const ungroupedRaw = window.localStorage.getItem(KEY_UNGROUPED)

    const Settings = settingsRaw ? JSON.parse(settingsRaw) : null
    const ungrouped = ungroupedRaw ? JSON.parse(ungroupedRaw) : []

    // Load emoji groups using index
    const emojiGroups: any[] = []

    // First load common emoji group
    try {
      const commonGroupRaw = window.localStorage.getItem(KEY_COMMON_EMOJIS)
      if (commonGroupRaw) {
        const commonGroup = JSON.parse(commonGroupRaw)
        emojiGroups.push(commonGroup)
      }
    } catch (_) {}

    // Load other groups using index
    try {
      const indexRaw = window.localStorage.getItem(KEY_EMOJI_INDEX)
      if (indexRaw) {
        const uuids: string[] = JSON.parse(indexRaw) || []
        for (const uuid of uuids) {
          const k = `${KEY_EMOJI_PREFIX}${uuid}`
          const rawG = window.localStorage.getItem(k)
          if (rawG) {
            const g = JSON.parse(rawG)
            emojiGroups.push(g)
          }
        }
      } else {
        // Fallback: scan all keys
        for (let i = 0; i < window.localStorage.length; i++) {
          const k = window.localStorage.key(i)
          if (k && k.startsWith(KEY_EMOJI_PREFIX) && k !== KEY_COMMON_EMOJIS) {
            try {
              const g = JSON.parse(window.localStorage.getItem(k) as string)
              emojiGroups.push(g)
            } catch (_) {}
          }
        }
      }
    } catch (_) {}

    if (!Settings && emojiGroups.length === 0 && (!ungrouped || ungrouped.length === 0)) {
      return null
    }

    return { Settings: Settings || ({} as any), emojiGroups, ungrouped }
  } catch (error) {
    console.warn('[Storage] Failed to load from localStorage:', error)
    return null
  }
}

// Load from extension storage (synchronous fallback using cached data)
function loadFromExtensionStorageSync(): PersistPayload | null {
  try {
    if (!extCache || Object.keys(extCache).length === 0) {
      return null
    }

    const Settings = extCache[KEY_SETTINGS] || null
    const ungrouped = extCache[KEY_UNGROUPED] || []

    const emojiGroups: any[] = []

    // Load common emoji group
    if (extCache[KEY_COMMON_EMOJIS]) {
      emojiGroups.push(extCache[KEY_COMMON_EMOJIS])
    }

    // Load other groups using index
    const indexList = extCache[KEY_EMOJI_INDEX] || []
    if (Array.isArray(indexList)) {
      for (const uuid of indexList) {
        const groupKey = `${KEY_EMOJI_PREFIX}${uuid}`
        const group = extCache[groupKey]
        if (group) {
          emojiGroups.push(group)
        }
      }
    }

    if (!Settings && emojiGroups.length === 0) {
      return null
    }

    return { Settings: Settings || ({} as any), emojiGroups, ungrouped }
  } catch (error) {
    console.warn('[Storage] Failed to load from extension cache:', error)
    return null
  }
}

export function savePayload(payload: PersistPayload) {
  if (typeof window === 'undefined' || !window.localStorage) {
    console.warn('[Storage] localStorage not available, cannot save payload')
    return
  }

  try {
    // Immediate save to localStorage (fast, synchronous)
    saveToLocalStorage(payload)

    // Broadcast change message immediately for real-time updates
    broadcastMessage('payload-updated', payload)

    // Schedule background sync to extension storage
    scheduleSyncToExtension()

    console.log('[Storage] Payload saved to localStorage, sync scheduled')
  } catch (error) {
    console.warn('[Storage] Failed to save payload:', error)
  }
}

// Save to localStorage (immediate, synchronous)
function saveToLocalStorage(payload: PersistPayload) {
  try {
    // Save settings
    window.localStorage.setItem(KEY_SETTINGS, JSON.stringify(payload.Settings || {}))

    // Save ungrouped
    window.localStorage.setItem(KEY_UNGROUPED, JSON.stringify(payload.ungrouped || []))

    // Handle emoji groups
    const index: string[] = []

    // Clear old group keys first
    const keysToRemove: string[] = []
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i)
      if (key && key.startsWith(KEY_EMOJI_PREFIX) && key !== KEY_COMMON_EMOJIS) {
        keysToRemove.push(key)
      }
    }
    keysToRemove.forEach((key) => {
      try {
        window.localStorage.removeItem(key)
      } catch (_) {}
    })

    // Save emoji groups
    ;(payload.emojiGroups || []).forEach((group: any) => {
      if (!group || !group.UUID) return

      try {
        // Special handling for common emoji group
        if (group.UUID === 'common-emoji-group' || group.displayName?.includes('常用')) {
          window.localStorage.setItem(KEY_COMMON_EMOJIS, JSON.stringify(group))
        } else {
          const groupKey = `${KEY_EMOJI_PREFIX}${group.UUID}`
          window.localStorage.setItem(groupKey, JSON.stringify(group))
          index.push(group.UUID)
        }
      } catch (error) {
        console.warn('[Storage] Failed to save group:', group.UUID, error)
      }
    })

    // Save index
    window.localStorage.setItem(KEY_EMOJI_INDEX, JSON.stringify(index))

    // Remove monolithic key if present (cleanup)
    try {
      window.localStorage.removeItem(STORAGE_KEY)
    } catch (_) {}
  } catch (error) {
    console.warn('[Storage] Failed to save to localStorage:', error)
    throw error
  }
}

// Generic helpers to read/write arbitrary keys - localStorage priority
export function setItem(key: string, value: any) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      // Immediate save to localStorage
      window.localStorage.setItem(key, JSON.stringify(value))

      // Broadcast change message
      broadcastMessage('item-updated', { key, value })

      // Schedule background sync to extension storage
      scheduleSyncToExtension()

      console.log(`[Storage] Saved ${key} to localStorage, sync scheduled`)
    } else {
      console.warn('[Storage] localStorage not available for setItem:', key)
    }
  } catch (error) {
    console.warn('[Storage] Failed to setItem:', key, error)
  }
}

export function getItem(key: string): any | null {
  try {
    // Primary: Read from localStorage (fast)
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(key)
      if (raw) {
        try {
          return JSON.parse(raw)
        } catch (_) {
          return null
        }
      }
    }

    // Fallback: Read from extension cache
    if (extCache && Object.prototype.hasOwnProperty.call(extCache, key)) {
      return extCache[key]
    }

    return null
  } catch (error) {
    console.warn('[Storage] Failed to getItem:', key, error)
    return null
  }
}

// 获取常用表情分组
export function getCommonEmojiGroup(): EmojiGroup | null {
  try {
    // Primary: Read from localStorage
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(KEY_COMMON_EMOJIS)
      if (raw) {
        return JSON.parse(raw)
      }
    }

    // Fallback: Read from extension cache
    if (extCache && extCache[KEY_COMMON_EMOJIS]) {
      return extCache[KEY_COMMON_EMOJIS]
    }

    // Create default if not found
    return createCommonEmojiGroup()
  } catch (error) {
    console.warn('[Storage] Failed to get common emoji group:', error)
    return createCommonEmojiGroup()
  }
}

// 保存常用表惁分组
export function saveCommonEmojiGroup(group: EmojiGroup) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      // Immediate save to localStorage
      window.localStorage.setItem(KEY_COMMON_EMOJIS, JSON.stringify(group))

      // Broadcast change message
      broadcastMessage('common-emoji-updated', group)

      // Schedule background sync
      scheduleSyncToExtension()

      console.log('[Storage] Saved common emoji group to localStorage, sync scheduled')
    }
  } catch (error) {
    console.warn('[Storage] Failed to save common emoji group:', error)
  }
}

// 对话历史和容器大小的数据类型
export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  images?: {
    type: 'image_url'
    image_url: {
      url: string
    }
  }[]
}

export interface ChatHistoryData {
  sessionId: string
  lastModified: Date
  selectedModel: string
  messages: ChatMessage[]
  metadata: {
    totalMessages: number
    createdAt: Date
  }
}

export interface ContainerSizeSettings {
  height: number
  isUserModified: boolean
  lastModified: Date
}

// 保存对话历史
export function saveChatHistory(historyData: ChatHistoryData) {
  setItem(KEY_CHAT_HISTORY, historyData)
}

// 加载对话历史
export function loadChatHistory(): ChatHistoryData | null {
  return getItem(KEY_CHAT_HISTORY)
}

// 保存容器大小设置
export function saveContainerSize(sizeSettings: ContainerSizeSettings) {
  setItem(KEY_CONTAINER_SIZE, sizeSettings)
}

// 加载容器大小设置
export function loadContainerSize(): ContainerSizeSettings | null {
  return getItem(KEY_CONTAINER_SIZE)
}

// 清除对话历史
export function clearChatHistory() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(KEY_CHAT_HISTORY)

      // Broadcast change message
      broadcastMessage('chat-history-cleared', null)

      // Schedule sync to remove from extension storage too
      scheduleSyncToExtension()

      console.log('[Storage] Cleared chat history from localStorage')
    }
  } catch (error) {
    console.warn('[Storage] Failed to clear chat history:', error)
  }
}

// Initialize extension storage cache and sync mechanism
function initializeStorageSystem() {
  // Load extension storage into cache (for fallback)
  try {
    if (
      typeof chrome !== 'undefined' &&
      chrome.storage &&
      chrome.storage.local &&
      typeof chrome.storage.local.get === 'function'
    ) {
      chrome.storage.local.get(null, (items: any) => {
        try {
          if (!chrome.runtime.lastError) {
            extCache = items || {}
            console.log(
              '[Storage] Extension cache loaded with',
              Object.keys(extCache).length,
              'keys',
            )
          }
        } catch (_) {}
      })
    }
  } catch (_) {}

  // Ensure common emoji group exists
  ensureCommonEmojiGroup()

  // Start periodic sync timer (every 30 seconds to ensure data consistency)
  if (typeof window !== 'undefined') {
    setInterval(() => {
      if (Date.now() - lastSyncTime > 30000) {
        // 30 seconds
        syncToExtensionStorage()
      }
    }, 30000)
  }
}

export default {
  loadPayload,
  savePayload,
  setItem,
  getItem,
  getCommonEmojiGroup,
  saveCommonEmojiGroup,
  createCommonEmojiGroup,
  ensureCommonEmojiGroup,
  saveChatHistory,
  loadChatHistory,
  saveContainerSize,
  loadContainerSize,
  clearChatHistory,
  addMessageListener,
  scheduleSyncToExtension,
  syncToExtensionStorage,
}

// Initialize the storage system
initializeStorageSystem()
