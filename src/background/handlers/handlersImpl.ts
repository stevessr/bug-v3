import { newStorageHelpers } from '../../utils/newStorage'
import { getChromeAPI } from '../utils/main.ts'

export async function handleGetEmojiData(message: any, _sendResponse: (_resp: any) => void) {
  // mark callback as referenced
  void _sendResponse

  try {
    // Use newStorageHelpers which understands the migrated storage layout
    const groups = (await newStorageHelpers.getAllEmojiGroups()) || []
    const settings = (await newStorageHelpers.getSettings()) || {}
    const favorites = (await newStorageHelpers.getFavorites()) || []

    let finalGroups = groups

    try {
      const src = message && message.sourceDomain ? String(message.sourceDomain).trim() : ''
      console.log('[Background] handleGetEmojiData received sourceDomain:', src)
      if (src) {
        // lookup domain config; if missing, create default entry that enables all current groups
        let entry = await newStorageHelpers.getDiscourseDomain(src)
        console.log('[Background] existing discourse entry for', src, 'is', entry)
        if (!entry) {
          try {
            entry = await newStorageHelpers.ensureDiscourseDomainExists(src)
            console.log('[Background] Created default discourse domain entry for', src, '->', entry)
          } catch (e) {
            console.warn('[Background] ensureDiscourseDomainExists failed for', src, e)
          }
        }

        if (entry && Array.isArray(entry.enabledGroups)) {
          console.log('[Background] Filtering groups using enabledGroups for', src, entry.enabledGroups.length)
          const allowed = new Set(entry.enabledGroups.map((k: any) => String(k)))
          finalGroups = groups.filter(g => g && allowed.has(String(g.id)))
          console.log('[Background] finalGroups count after filter:', finalGroups.length)
        } else {
          console.log('[Background] No enabledGroups config for', src, ', returning all groups')
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
  } catch (error: any) {
    console.error('Failed to get emoji data via newStorageHelpers:', error)
    _sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

export async function handleGetEmojiSetting(key: string, _sendResponse: (_resp: any) => void) {
  void _sendResponse
  try {
    const settings = await newStorageHelpers.getSettings()
    if (settings && Object.prototype.hasOwnProperty.call(settings, key)) {
      _sendResponse({ success: true, data: { value: (settings as any)[key] } })
    } else {
      _sendResponse({ success: true, data: { value: null } })
    }
  } catch (error: any) {
    console.error('Failed to get emoji setting:', key, error)
    _sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

export async function handleSaveEmojiData(data: any, _sendResponse: (_resp: any) => void) {
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
    _sendResponse({ success: true })
  } catch (error: any) {
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
    chromeAPI.storage.onChanged.addListener((changes: any, namespace: any) => {
      console.log('Storage changed:', changes, namespace)
      // Placeholder for cloud sync or other reactions
    })
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
