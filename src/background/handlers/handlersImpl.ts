import { getChromeAPI } from '../utils/main.ts'

import * as storage from '@/utils/simpleStorage'
import type { EmojiGroup, AppSettings } from '@/types/type'
import { defaultSettings } from '@/types/defaultSettings'

// 缓存机制：减少重复存储读取
// 优化：将缓存时间从 5 秒增加到 30 秒，减少后台读取频率
let cachedGroups: EmojiGroup[] | null = null
let cachedSettings: AppSettings | null = null
let cachedFavorites: string[] | null = null
let cacheTimestamp = 0

/** 常量定义 */
const CACHE_TTL_MS = 30000 // 30 秒缓存有效期
const CLEANUP_ALARM_NAME = 'periodic-storage-cleanup'
const CLEANUP_INTERVAL_MINUTES = 24 * 60 // 24 小时（以分钟为单位）

async function getCachedData() {
  const now = Date.now()
  if (cachedGroups && cachedSettings && now - cacheTimestamp < CACHE_TTL_MS) {
    return { groups: cachedGroups, settings: cachedSettings, favorites: cachedFavorites }
  }

  // 并行加载数据
  const [groups, settings, favorites] = await Promise.all([
    storage.getAllEmojiGroups(),
    storage.getSettings(),
    storage.getFavorites()
  ])

  cachedGroups = groups || []
  cachedSettings = settings || defaultSettings
  cachedFavorites = favorites || []
  cacheTimestamp = now

  return { groups: cachedGroups, settings: cachedSettings, favorites: cachedFavorites }
}

// 清除缓存（在数据更新时调用）
export function invalidateCache() {
  cachedGroups = null
  cachedSettings = null
  cachedFavorites = null
  cacheTimestamp = 0
}

interface GetEmojiDataMessage {
  sourceDomain?: string
}

interface ResponsePayload {
  success: boolean
  data?: {
    groups: EmojiGroup[]
    settings: AppSettings
    favorites: string[] | null
    value?: unknown
  }
  error?: string
}

export async function handleGetEmojiData(
  message: GetEmojiDataMessage,
  _sendResponse: (resp: ResponsePayload) => void
) {
  // mark callback as referenced
  void _sendResponse

  try {
    // Use cached data to reduce storage reads
    const { groups, settings, favorites } = await getCachedData()

    let finalGroups = groups

    try {
      const src = message && message.sourceDomain ? String(message.sourceDomain).trim() : ''
      if (src) {
        // lookup domain config; if missing, create default entry that enables all current groups
        let entry = await storage.getDiscourseDomain(src)
        if (!entry) {
          try {
            entry = await storage.ensureDiscourseDomainExists(src)
          } catch (e) {
            console.warn('[Background] ensureDiscourseDomainExists failed for', src, e)
          }
        }

        if (entry && Array.isArray(entry.enabledGroups)) {
          const allowed = new Set(entry.enabledGroups.map((k: string) => String(k)))
          finalGroups = groups.filter(g => g && allowed.has(String(g.id)))
          // Ensure favorites group is always included in returned groups
          const hasFavorites = finalGroups.some((g: EmojiGroup) => String(g.id) === 'favorites')
          if (!hasFavorites) {
            const favFromAll = groups.find((g: EmojiGroup) => String(g.id) === 'favorites')
            if (favFromAll) {
              finalGroups.unshift(favFromAll)
            } else {
              const minimalFav = {
                id: 'favorites',
                name: 'Favorites',
                icon: '⭐',
                order: -1,
                emojis: []
              }
              finalGroups.unshift(minimalFav)
            }
          }
        }
      }
    } catch (e) {
      // if domain filtering fails, log and fall back to full groups
      console.warn('[Background] domain-based group filtering failed', e)
    }

    _sendResponse({
      success: true,
      data: {
        groups: finalGroups,
        settings: settings || defaultSettings,
        favorites
      }
    })
  } catch (error) {
    console.error('Failed to get emoji data via storage:', error)
    _sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

export async function handleGetEmojiSetting(
  key: keyof AppSettings,
  _sendResponse: (resp: { success: boolean; data?: { value: unknown }; error?: string }) => void
) {
  void _sendResponse
  try {
    const settings = await storage.getSettings()
    if (settings && Object.prototype.hasOwnProperty.call(settings, key)) {
      _sendResponse({ success: true, data: { value: settings[key] } })
    } else {
      _sendResponse({ success: true, data: { value: null } })
    }
  } catch (error) {
    console.error('Failed to get emoji setting:', key, error)
    _sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

export async function handleGetEmojiSettingsBatch(
  keys: string[],
  _sendResponse: (resp: {
    success: boolean
    data?: Record<string, unknown>
    error?: string
  }) => void
) {
  void _sendResponse
  try {
    const settings = await storage.getSettings()
    const result: Record<string, unknown> = {}
    for (const key of keys) {
      if (settings && Object.prototype.hasOwnProperty.call(settings, key)) {
        result[key] = settings[key as keyof AppSettings]
      } else {
        result[key] = null
      }
    }
    _sendResponse({ success: true, data: result })
  } catch (error) {
    console.error('Failed to get emoji settings batch:', keys, error)
    _sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

export async function handleSaveEmojiData(
  data: Record<string, unknown>,
  _sendResponse: (resp: { success: boolean; error?: string }) => void
) {
  // mark callback as referenced
  void _sendResponse
  // no additional args expected here
  const chromeAPI = getChromeAPI()
  if (!chromeAPI || !chromeAPI.storage) {
    _sendResponse({ success: false, error: 'Chrome storage API not available' })
    return
  }

  try {
    await chromeAPI.storage.local.set(data)
    // 清除缓存以确保下次读取获取最新数据
    invalidateCache()
    _sendResponse({ success: true })
  } catch (error) {
    console.error('Failed to save emoji data:', error)
    _sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

export function setupStorageChangeListener() {
  const chromeAPI = getChromeAPI()
  if (chromeAPI && chromeAPI.storage && chromeAPI.storage.onChanged) {
    chromeAPI.storage.onChanged.addListener(
      (changes: { [key: string]: chrome.storage.StorageChange }, namespace: string) => {
        console.log('Storage changed:', changes, namespace)

        // 优化：当相关存储键变化时，立即失效缓存确保数据一致性
        if (
          changes['emojiGroups'] ||
          changes['settings'] ||
          changes['favorites'] ||
          Object.keys(changes).some(key => key.startsWith('group_'))
        ) {
          console.log('[Background] Cache invalidated due to storage change')
          invalidateCache()
        }
      }
    )
  }
}

export function setupPeriodicCleanup() {
  const chromeAPI = getChromeAPI()
  if (!chromeAPI || !chromeAPI.alarms) {
    console.warn('[PeriodicCleanup] chrome.alarms API not available')
    return
  }

  // 使用 chrome.alarms API 替代 setInterval
  // 优点：在 MV3 中 Service Worker 休眠后仍能正常触发
  chromeAPI.alarms.create(CLEANUP_ALARM_NAME, {
    delayInMinutes: CLEANUP_INTERVAL_MINUTES,
    periodInMinutes: CLEANUP_INTERVAL_MINUTES
  })

  // 设置 alarm 监听器
  chromeAPI.alarms.onAlarm.addListener(async (alarm: chrome.alarms.Alarm) => {
    if (alarm.name !== CLEANUP_ALARM_NAME) return

    try {
      const data = await chromeAPI.storage.local.get(['emojiGroups'])
      if (data.emojiGroups) {
        console.log('[PeriodicCleanup] Storage cleanup check completed')
      }
    } catch (error) {
      console.error('[PeriodicCleanup] Storage cleanup error:', error)
    }
  })

  console.log('[PeriodicCleanup] Alarm scheduled for every', CLEANUP_INTERVAL_MINUTES, 'minutes')
}

/**
 * 清理函数 - 停止定时清理任务
 */
export function cleanupPeriodicCleanup(): void {
  const chromeAPI = getChromeAPI()
  if (chromeAPI?.alarms) {
    chromeAPI.alarms.clear(CLEANUP_ALARM_NAME)
    console.log('[PeriodicCleanup] Cleanup alarm cleared')
  }
}
