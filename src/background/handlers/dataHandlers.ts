import { newStorageHelpers } from '../../utils/newStorage'
import { getChromeAPI } from '../utils'

export async function handleGetEmojiData(sendResponse: (_resp: any) => void) {
  void sendResponse
  try {
    const groups = await newStorageHelpers.getAllEmojiGroups()
    const settings = await newStorageHelpers.getSettings()
    const favorites = await newStorageHelpers.getFavorites()

    sendResponse({
      success: true,
      data: {
        groups: groups || [],
        settings: settings || {},
        favorites: favorites || []
      }
    })
  } catch (error: any) {
    console.error('Failed to get emoji data via newStorageHelpers:', error)
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

export async function handleSaveEmojiData(data: any, sendResponse: (_resp: any) => void) {
  void sendResponse
  const chromeAPI = getChromeAPI()
  if (!chromeAPI || !chromeAPI.storage) {
    sendResponse({ success: false, error: 'Chrome storage API not available' })
    return
  }

  try {
    await chromeAPI.storage.local.set(data)
    sendResponse({ success: true })
  } catch (error: any) {
    console.error('Failed to save emoji data:', error)
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

export async function handleSyncSettings(settings: any, sendResponse: (_resp: any) => void) {
  void sendResponse
  const chromeAPI = getChromeAPI()
  if (!chromeAPI || !chromeAPI.storage || !chromeAPI.tabs) {
    sendResponse({ success: false, error: 'Chrome API not available' })
    return
  }

  try {
    const timestamp = Date.now()
    const appSettingsData = {
      data: { ...settings, lastModified: timestamp },
      timestamp: timestamp
    }

    await chromeAPI.storage.local.set({ appSettings: appSettingsData })

    const tabs = await chromeAPI.tabs.query({})
    for (const tab of tabs) {
      if (tab.id) {
        chromeAPI.tabs
          .sendMessage(tab.id, {
            type: 'SETTINGS_UPDATED',
            settings: settings
          })
          .catch(() => {
            // Ignore errors for tabs that don't have content script
          })
      }
    }

    sendResponse({ success: true })
  } catch (error: any) {
    console.error('Failed to sync settings:', error)
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
