import { getChromeAPI } from '../utils/main.ts'

import { newStorageHelpers } from '@/utils/newStorage'
import type { EmojiGroup, AppSettings } from '@/types/type'

// 缓存机制：减少重复存储读取
let cachedGroups: EmojiGroup[] | null = null
let cachedSettings: AppSettings | null = null
let cachedFavorites: string[] | null = null
let cacheTimestamp = 0
const CACHE_TTL = 5000 // 5 秒缓存有效期

async function getCachedData() {
  const now = Date.now()
  if (cachedGroups && cachedSettings && now - cacheTimestamp < CACHE_TTL) {
    return { groups: cachedGroups, settings: cachedSettings, favorites: cachedFavorites }
  }

  // 并行加载数据
  const [groups, settings, favorites] = await Promise.all([
    newStorageHelpers.getAllEmojiGroups(),
    newStorageHelpers.getSettings(),
    newStorageHelpers.getFavorites()
  ])

  cachedGroups = groups || []
  cachedSettings = settings || {}
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
        let entry = await newStorageHelpers.getDiscourseDomain(src)
        if (!entry) {
          try {
            entry = await newStorageHelpers.ensureDiscourseDomainExists(src)
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
        settings,
        favorites
      }
    })
  } catch (error) {
    console.error('Failed to get emoji data via newStorageHelpers:', error)
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
    const settings = await newStorageHelpers.getSettings()
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
        // Placeholder for cloud sync or other reactions
      }
    )
  }
}

export function setupPeriodicCleanup() {
  setInterval(
    async () => {
      const chromeAPI = getChromeAPI()
      if (!chromeAPI || !chromeAPI.storage) return

      try {
        const data = await chromeAPI.storage.local.get(['emojiGroups'])
        if (data.emojiGroups) {
          console.log('Storage cleanup check completed')
        }
      } catch (error) {
        console.error('Storage cleanup error:', error)
      }
    },
    24 * 60 * 60 * 1000
  )
}
