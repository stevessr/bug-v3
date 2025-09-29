import { getChromeAPI } from './utils/main.ts'

import { loadDefaultEmojiGroups } from '@/types/defaultEmojiGroups.loader'

export async function initializeDefaultData() {
  const chromeAPI = getChromeAPI()
  if (!chromeAPI || !chromeAPI.storage) {
    console.error('Chrome storage API not available')
    return
  }

  try {
    const existingData = await chromeAPI.storage.local.get(['emojiGroups', 'appSettings'])

    if (!existingData.emojiGroups) {
      try {
        const runtime = await loadDefaultEmojiGroups()
        await chromeAPI.storage.local.set({ emojiGroups: runtime && runtime.length ? runtime : [] })
      } catch {
        await chromeAPI.storage.local.set({ emojiGroups: [] })
      }
      console.log('Default emoji groups initialized')
    }

    if (!existingData.appSettings) {
      const defaultSettings = {
        imageScale: 100,
        defaultGroup: 'nachoneko',
        showSearchBar: true,
        gridColumns: 4
      }

      await chromeAPI.storage.local.set({ appSettings: defaultSettings })
      console.log('Default app settings initialized')
    }
  } catch (error) {
    console.error('Failed to initialize default data:', error)
  }
}

export function setupOnInstalledListener() {
  const chromeAPI = getChromeAPI()
  if (chromeAPI && chromeAPI.runtime && chromeAPI.runtime.onInstalled) {
    chromeAPI.runtime.onInstalled.addListener(async (details: any) => {
      console.log('Emoji extension installed/updated:', details.reason)
      if (details.reason === 'install') {
        await initializeDefaultData()
      }
    })
  }
}
