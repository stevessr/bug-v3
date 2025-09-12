import { getChromeAPI } from '../utils'

export function setupStorageChangeListener() {
  const chromeAPI = getChromeAPI()
  if (chromeAPI && chromeAPI.storage && chromeAPI.storage.onChanged) {
    chromeAPI.storage.onChanged.addListener((changes: any, namespace: any) => {
      console.log('Storage changed:', changes, namespace)
      // Placeholder for cloud sync or other reactions
    })
  }
}

export function setupContextMenu() {
  const chromeAPI = getChromeAPI()
  if (chromeAPI && chromeAPI.runtime && chromeAPI.runtime.onInstalled && chromeAPI.contextMenus) {
    chromeAPI.runtime.onInstalled.addListener(() => {
      chrome.storage.local.get('appSettings', result => {
        let forceMobileMode = false
        if (result.appSettings) {
          if (result.appSettings.data && typeof result.appSettings.data === 'object') {
            forceMobileMode = result.appSettings.data.forceMobileMode || false
          } else if (typeof result.appSettings === 'object') {
            forceMobileMode = result.appSettings.forceMobileMode || false
          }
        }

        if (chromeAPI.contextMenus && chromeAPI.contextMenus.create) {
          chromeAPI.contextMenus.create({
            id: 'open-emoji-options',
            title: '表情管理',
            contexts: ['page']
          })
          chromeAPI.contextMenus.create({
            id: 'force-mobile-mode',
            title: '强制使用移动模式',
            type: 'checkbox',
            checked: forceMobileMode,
            contexts: ['page']
          })
        }
      })
    })

    if (chromeAPI.contextMenus.onClicked) {
      chromeAPI.contextMenus.onClicked.addListener((info: any, _tab: any) => {
        if (
          info.menuItemId === 'open-emoji-options' &&
          chromeAPI.runtime &&
          chromeAPI.runtime.openOptionsPage
        ) {
          chromeAPI.runtime.openOptionsPage()
        } else if (info.menuItemId === 'force-mobile-mode') {
          const newCheckedState = info.checked

          chrome.storage.local.get('appSettings', result => {
            let currentSettings = {}
            if (result.appSettings) {
              if (result.appSettings.data && typeof result.appSettings.data === 'object') {
                currentSettings = result.appSettings.data
              } else if (typeof result.appSettings === 'object') {
                currentSettings = result.appSettings
              }
            }

            const timestamp = Date.now()
            const updatedSettings = {
              ...currentSettings,
              forceMobileMode: newCheckedState,
              lastModified: timestamp
            }

            const appSettingsData = { data: updatedSettings, timestamp }

            chrome.storage.local.set({ appSettings: appSettingsData })
          })
        }
      })
    }
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

import { handleRequestInject, handleInjectImageScript } from './injectHandlers'
import { handleGetEmojiData, handleSaveEmojiData, handleSyncSettings } from './dataHandlers'
import { handleLinuxDoAuthRequest, handleSaveLastDiscourse } from './miscHandlers'
import { handleAddEmojiFromWeb } from './addEmojiFromWeb'
import { handleAddToFavorites } from './favorites'
import {
  handleDownloadAndSendToDiscourse,
  handleDownloadForUser,
  handleUploadAndAddEmoji,
  handleDownloadAndUploadEmoji
} from './downloadAndSend'

export function setupMessageListener() {
  const chromeAPI = getChromeAPI()
  if (chromeAPI && chromeAPI.runtime && chromeAPI.runtime.onMessage) {
    chromeAPI.runtime.onMessage.addListener((message: any, _sender: any, sendResponse: any) => {
      console.log('Background received message:', message)
      // mark unused sender as intentionally unused
      void _sender

      // 首先检查 message.type
      if (message.type) {
        switch (message.type) {
          case 'GET_EMOJI_DATA':
            handleGetEmojiData(sendResponse)
            return true

          case 'SAVE_EMOJI_DATA':
            handleSaveEmojiData(message.data, sendResponse)
            return true

          case 'SYNC_SETTINGS':
            handleSyncSettings(message.settings, sendResponse)
            return true

          case 'REQUEST_LINUX_DO_AUTH':
            handleLinuxDoAuthRequest(sendResponse)
            return true

          default:
            console.log('Unknown message type:', message.type)
            // mark message.type as referenced for linters
            void message.type
            sendResponse({ success: false, error: 'Unknown message type' })
            return false
        }
      }

      // 然后检查 message.action
      if (message.action) {
        switch (message.action) {
          case 'addToFavorites':
            handleAddToFavorites(message.emoji, sendResponse)
            return true

          case 'addEmojiFromWeb':
            handleAddEmojiFromWeb(message.emojiData, sendResponse)
            return true

          case 'requestInject': {
            handleRequestInject(message, _sender, sendResponse)
            return true
          }

          case 'injectImageScript': {
            handleInjectImageScript(message, _sender, sendResponse)
            return true
          }

          case 'downloadAndSendToDiscourse':
            handleDownloadAndSendToDiscourse(message.payload, sendResponse)
            return true

          case 'downloadForUser':
            handleDownloadForUser(message.payload, sendResponse)
            return true

          case 'uploadAndAddEmoji':
            handleUploadAndAddEmoji(message.payload, sendResponse)
            return true

          case 'downloadAndUploadEmoji':
            handleDownloadAndUploadEmoji(message.payload, sendResponse)
            return true

          case 'saveLastDiscourse':
            handleSaveLastDiscourse(message.payload, sendResponse)
            return true

          default:
            console.log('Unknown action:', message.action)
            // mark message.action as referenced for linters
            void message.action
            sendResponse({ success: false, error: 'Unknown action' })
            return false
        }
      }

      // 如果既没有 type 也没有 action
      console.log('Message has no type or action:', message)
      sendResponse({ success: false, error: 'Message has no type or action' })
    })
  }
}
