import { logger } from '../config/buildFlags'

import { getChromeAPI } from './utils'

import { defaultEmojiGroups } from '@/types/defaultEmojiGroups'

export async function initializeDefaultData() {
  const chromeAPI = getChromeAPI()
  if (!chromeAPI || !chromeAPI.storage) {
    logger.error('Chrome storage API not available')
    return
  }

  try {
    const existingData = await chromeAPI.storage.local.get(['emojiGroups', 'appSettings'])

    if (!existingData.emojiGroups) {
      await chromeAPI.storage.local.set({ emojiGroups: defaultEmojiGroups })
      logger.log('Default emoji groups initialized')
    }

    if (!existingData.appSettings) {
      const defaultSettings = {
        imageScale: 100,
        defaultGroup: 'nachoneko',
        showSearchBar: true,
        gridColumns: 4
      }

      await chromeAPI.storage.local.set({ appSettings: defaultSettings })
      logger.log('Default app settings initialized')
    }
  } catch (error) {
    logger.error('Failed to initialize default data:', error)
  }
}

export function setupOnInstalledListener() {
  const chromeAPI = getChromeAPI()
  if (chromeAPI && chromeAPI.runtime && chromeAPI.runtime.onInstalled) {
    chromeAPI.runtime.onInstalled.addListener(async (details: any) => {
      logger.log('Emoji extension installed/updated:', details.reason)
      if (details.reason === 'install') {
        await initializeDefaultData()
      }
    })
  }
}
