import { newStorageHelpers } from '../../utils/newStorage'
import { getChromeAPI } from '../utils/main.ts'

export async function handleGetEmojiData(_sendResponse: (_resp: any) => void) {
  // mark callback as referenced
  void _sendResponse

  try {
    // Use newStorageHelpers which understands the migrated storage layout
    const groups = await newStorageHelpers.getAllEmojiGroups()
    const settings = await newStorageHelpers.getSettings()
    const favorites = await newStorageHelpers.getFavorites()

    _sendResponse({
      success: true,
      data: {
        groups: groups || [],
        settings: settings || {},
        favorites: favorites || []
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
