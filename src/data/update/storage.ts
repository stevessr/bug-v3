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

// in-memory cache mirroring chrome.storage.local for synchronous reads
let extCache: Record<string, any> = {}

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

// 确保常用表情分组存在
function ensureCommonEmojiGroup() {
  try {
    // 检查 localStorage
    if (typeof window !== 'undefined' && window.localStorage) {
      const existing = window.localStorage.getItem(KEY_COMMON_EMOJIS)
      if (!existing) {
        const commonGroup = createCommonEmojiGroup()
        window.localStorage.setItem(KEY_COMMON_EMOJIS, JSON.stringify(commonGroup))
        console.log('[Storage] Created common emoji group in localStorage')
      }
    }

    // 检查 chrome.storage.local
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get([KEY_COMMON_EMOJIS], (items: any) => {
        if (!items[KEY_COMMON_EMOJIS]) {
          const commonGroup = createCommonEmojiGroup()
          const storeObj: any = {}
          storeObj[KEY_COMMON_EMOJIS] = commonGroup
          chrome.storage.local.set(storeObj, () => {
            console.log('[Storage] Created common emoji group in chrome.storage.local')
          })
        }
      })
    }
  } catch (error) {
    console.warn('[Storage] Failed to ensure common emoji group:', error)
  }
}

// try to populate extCache from chrome.storage.local (async)
try {
  if (
    typeof chrome !== 'undefined' &&
    chrome.storage &&
    chrome.storage.local &&
    typeof chrome.storage.local.get === 'function'
  ) {
    try {
      chrome.storage.local.get(null, (items: any) => {
        try {
          extCache = items || {}
        } catch (_) {}
      })
    } catch (_) {}
  }
} catch (_) {}

export type PersistPayload = {
  Settings: Settings
  emojiGroups: EmojiGroup[]
  // newly added: ungrouped emojis that are not inside any group
  ungrouped?: any[]
}

export function loadPayload(): PersistPayload | null {
  if (typeof window === 'undefined' || !window.localStorage) return null
  try {
    // backward compat: if monolithic payload exists, use it
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw) {
      try {
        return JSON.parse(raw) as PersistPayload
      } catch (_) {
        // fallthrough to try split keys
      }
    }

    // assemble from split keys
    const settingsRaw = window.localStorage.getItem(KEY_SETTINGS)
    const ungroupedRaw = window.localStorage.getItem(KEY_UNGROUPED)

    const Settings = settingsRaw ? JSON.parse(settingsRaw) : null
    const ungrouped = ungroupedRaw ? JSON.parse(ungroupedRaw) : []

    // collect emoji groups by using an index if present (preserve order), otherwise scan keys
    const emojiGroups: any[] = []

    // 首先加载常用表情分组
    try {
      const commonGroupRaw = window.localStorage.getItem(KEY_COMMON_EMOJIS)
      if (commonGroupRaw) {
        const commonGroup = JSON.parse(commonGroupRaw)
        emojiGroups.push(commonGroup)
      } else {
        // 如果不存在，创建默认的常用表情分组
        const commonGroup = createCommonEmojiGroup()
        window.localStorage.setItem(KEY_COMMON_EMOJIS, JSON.stringify(commonGroup))
        emojiGroups.push(commonGroup)
      }
    } catch (error) {
      console.warn('[Storage] Failed to load common emoji group:', error)
      // 如果加载失败，创建默认分组
      emojiGroups.push(createCommonEmojiGroup())
    }

    try {
      const indexRaw = window.localStorage.getItem(KEY_EMOJI_INDEX)
      if (indexRaw) {
        try {
          const uuids: string[] = JSON.parse(indexRaw) || []
          for (const u of uuids) {
            try {
              const k = `${KEY_EMOJI_PREFIX}${u}`
              const rawG = window.localStorage.getItem(k)
              if (!rawG) continue
              const g = JSON.parse(rawG)
              emojiGroups.push(g)
            } catch (_) {}
          }
        } catch (_) {
          // fallthrough to scan
        }
      }

      if (emojiGroups.length === 0) {
        // fallback: scan all keys
        for (let i = 0; i < window.localStorage.length; i++) {
          const k = window.localStorage.key(i)
          if (!k) continue
          if (k.startsWith(KEY_EMOJI_PREFIX)) {
            try {
              const g = JSON.parse(window.localStorage.getItem(k) as string)
              emojiGroups.push(g)
            } catch (_) {}
          }
        }
      }
    } catch (_) {}

    if (!Settings && emojiGroups.length === 0 && (!ungrouped || ungrouped.length === 0)) return null

    return { Settings: Settings || ({} as any), emojiGroups, ungrouped }
  } catch (_) {
    return null
  }
}

export function savePayload(payload: PersistPayload) {
  if (typeof window === 'undefined' || !window.localStorage) return
  try {
    // saved emoji index for use when mirroring to extension storage
    let savedEmojiIndex: string[] | null = null
    // Write Settings
    try {
      window.localStorage.setItem(KEY_SETTINGS, JSON.stringify(payload.Settings || {}))
    } catch (_) {}

    // Write ungrouped
    try {
      window.localStorage.setItem(KEY_UNGROUPED, JSON.stringify(payload.ungrouped || []))
    } catch (_) {}

    // Write each emoji group into its own key: emojiGroups-$ID
    try {
      // Remove any existing emojiGroups-* keys that are not present in the new payload to avoid stale groups
      const existingKeys: string[] = []
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i)
        if (k && k.startsWith(KEY_EMOJI_PREFIX) && k !== KEY_COMMON_EMOJIS) {
          // 保留常用表情分组
          existingKeys.push(k)
        }
      }

      const incomingKeys: string[] = []
      const incomingIndex: string[] = []

      // 处理常用表情分组（特殊处理）
      const commonGroup = (payload.emojiGroups || []).find(
        (g: any) => g.UUID === 'common-emoji-group' || g.displayName?.includes('常用'),
      )
      if (commonGroup) {
        try {
          window.localStorage.setItem(KEY_COMMON_EMOJIS, JSON.stringify(commonGroup))
          console.log('[Storage] Saved common emoji group')
        } catch (error) {
          console.warn('[Storage] Failed to save common emoji group:', error)
        }
      }

      ;(payload.emojiGroups || []).forEach((g: any) => {
        try {
          // 跳过常用表情分组，它已经在上面特殊处理了
          if (g.UUID === 'common-emoji-group' || g.displayName?.includes('常用')) {
            return
          }

          // clone group to avoid mutating caller's object
          const group = g && typeof g === 'object' ? { ...g } : { ...g }
          let uuid =
            group &&
            (typeof group.uuid === 'string'
              ? group.uuid
              : group.uuid != null
                ? String(group.uuid)
                : null)
          if (!uuid) {
            uuid = uuidv4()
            try {
              group.uuid = uuid
            } catch (_) {}
          }
          const k = `${KEY_EMOJI_PREFIX}${uuid}`
          incomingKeys.push(k)
          incomingIndex.push(uuid)
          try {
            window.localStorage.setItem(k, JSON.stringify(group))
          } catch (_) {}
        } catch (_) {
          // skip malformed group
        }
      })

      // remove stale keys
      existingKeys.forEach((k) => {
        if (!incomingKeys.includes(k)) {
          try {
            window.localStorage.removeItem(k)
          } catch (_) {}
        }
      })
      // persist index of groups (order)
      try {
        window.localStorage.setItem(KEY_EMOJI_INDEX, JSON.stringify(incomingIndex))
        savedEmojiIndex = incomingIndex
      } catch (_) {
        savedEmojiIndex = incomingIndex
      }
    } catch (_) {}

    // set a local flag indicating session sync is pending for this tab
    try {
      window.localStorage.setItem('bugcopilot_flag_session_pending', 'true')
    } catch (_) {}

    // notify background that localStorage payload updated (send assembled payload)
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        try {
          chrome.runtime.sendMessage({ type: 'payload-updated', payload }, (_resp: any) => {
            try {
              if (chrome.runtime && chrome.runtime.lastError) {
                // ignore but log
              }
            } catch (_) {}
          })
        } catch (_) {}
      }
    } catch (_) {}

    // also write to extension storage (async) if available
    try {
      if (
        typeof chrome !== 'undefined' &&
        chrome.storage &&
        chrome.storage.local &&
        typeof chrome.storage.local.set === 'function'
      ) {
        const storeObj: any = {}
        storeObj[KEY_SETTINGS] = payload.Settings || {}
        storeObj[KEY_UNGROUPED] = payload.ungrouped || []

        // 特殊处理常用表情分组
        const commonGroup = (payload.emojiGroups || []).find(
          (g: any) => g.UUID === 'common-emoji-group' || g.displayName?.includes('常用'),
        )
        if (commonGroup) {
          storeObj[KEY_COMMON_EMOJIS] = commonGroup
        }

        ;(payload.emojiGroups || []).forEach((g: any) => {
          try {
            // 跳过常用表情分组，它已经在上面特殊处理了
            if (g.UUID === 'common-emoji-group' || g.displayName?.includes('常用')) {
              return
            }

            const group = g && typeof g === 'object' ? { ...g } : { ...g }
            let uuid =
              group &&
              (typeof group.uuid === 'string'
                ? group.uuid
                : group.uuid != null
                  ? String(group.uuid)
                  : null)
            if (!uuid) {
              uuid = uuidv4()
              try {
                group.uuid = uuid
              } catch (_) {}
            }
            storeObj[`${KEY_EMOJI_PREFIX}${uuid}`] = group
            try {
              // track index for storeObj
              if (!Array.isArray(storeObj[KEY_EMOJI_INDEX])) storeObj[KEY_EMOJI_INDEX] = []
              storeObj[KEY_EMOJI_INDEX].push(uuid)
            } catch (_) {}
          } catch (_) {}
        })
        try {
          // also ensure KEY_EMOJI_INDEX present even if empty
          if (!storeObj[KEY_EMOJI_INDEX]) storeObj[KEY_EMOJI_INDEX] = savedEmojiIndex || []
        } catch (_) {}
        try {
          chrome.storage.local.set(storeObj, () => {
            try {
              // ignore errors; no need to block
            } catch (_) {}
          })
        } catch (_) {}
        try {
          // update in-memory mirror
          Object.keys(storeObj).forEach((k) => {
            try {
              extCache[k] = storeObj[k]
            } catch (_) {}
          })
        } catch (_) {}
      }
    } catch (_) {}
  } catch (_) {
    // ignore
  }
}

// Generic helpers to read/write arbitrary keys using the same dual-write strategy
export function setItem(key: string, value: any) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(key, JSON.stringify(value))
      } catch (_) {}
    }
  } catch (_) {}

  try {
    if (
      typeof chrome !== 'undefined' &&
      chrome.storage &&
      chrome.storage.local &&
      typeof chrome.storage.local.set === 'function'
    ) {
      try {
        const obj: any = {}
        obj[key] = value
        chrome.storage.local.set(obj, () => {})
        try {
          // keep in-memory cache in sync for fast reads
          extCache[key] = value
        } catch (_) {}
      } catch (_) {}
    }
  } catch (_) {}
}

export function getItem(key: string): any | null {
  try {
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
  } catch (_) {}
  try {
    // fallback to in-memory mirror of chrome.storage.local
    if (extCache && Object.prototype.hasOwnProperty.call(extCache, key)) {
      return extCache[key]
    }
  } catch (_) {}
  return null
}

// 获取常用表情分组
export function getCommonEmojiGroup(): EmojiGroup | null {
  try {
    // 从 localStorage 获取
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(KEY_COMMON_EMOJIS)
      if (raw) {
        return JSON.parse(raw)
      }
    }

    // 从 chrome.storage.local 获取
    if (extCache && extCache[KEY_COMMON_EMOJIS]) {
      return extCache[KEY_COMMON_EMOJIS]
    }

    // 如果都没有，返回默认分组
    return createCommonEmojiGroup()
  } catch (error) {
    console.warn('[Storage] Failed to get common emoji group:', error)
    return createCommonEmojiGroup()
  }
}

// 保存常用表情分组
export function saveCommonEmojiGroup(group: EmojiGroup) {
  try {
    // 保存到 localStorage
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(KEY_COMMON_EMOJIS, JSON.stringify(group))
    }

    // 保存到 chrome.storage.local
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      const storeObj: any = {}
      storeObj[KEY_COMMON_EMOJIS] = group
      chrome.storage.local.set(storeObj, () => {
        console.log('[Storage] Saved common emoji group to extension storage')
      })

      // 更新内存缓存
      extCache[KEY_COMMON_EMOJIS] = group
    }
  } catch (error) {
    console.warn('[Storage] Failed to save common emoji group:', error)
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
}

// 初始化常用表情分组
ensureCommonEmojiGroup()
