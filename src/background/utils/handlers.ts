import { handleAddEmojiFromWeb } from '../handlers/addEmojiFromWeb.ts'
import { handleUploadAndAddEmoji } from '../handlers/uploadAndAddEmoji.ts'
import {
  handleAddToFavorites,
  handleGetEmojiData,
  handleSaveEmojiData,
  handleSyncSettings,
  handleLinuxDoAuthRequest,
  setupStorageChangeListener,
  setupContextMenu,
  setupPeriodicCleanup,
  handleGetEmojiSetting
} from '../handlers/main.ts'
import { handleCalloutInjectionRequest } from '../handlers/calloutInjection.ts'

import { getChromeAPI } from './main.ts'

// Re-export setup functions so background entry can import them from ./handlers
export { setupStorageChangeListener, setupContextMenu, setupPeriodicCleanup }

export function setupMessageListener() {
  const chromeAPI = getChromeAPI()
  if (chromeAPI && chromeAPI.runtime && chromeAPI.runtime.onMessage) {
    chromeAPI.runtime.onMessage.addListener((message: any, sender: any, sendResponse: any) => {
      console.log('Background received message:', message)

      // 首先检查 message.type
      if (message.type) {
        switch (message.type) {
          case 'INJECT_CALLOUT_SUGGESTIONS':
            // Handle callout injection request from content script
            handleCalloutInjectionRequest(sender).then(result => {
              sendResponse(result)
            }).catch(error => {
              sendResponse({ success: false, error: String(error) })
            })
            return true // Keep message channel open for async response

          case 'GET_EMOJI_DATA':
            // pass full message so handler can use message.sourceDomain for per-domain filtering
            handleGetEmojiData(message, sendResponse)
            return true

          case 'GET_EMOJI_SETTING':
            // message.key expected
            if (message.key) {
              handleGetEmojiSetting(message.key, sendResponse)
              return true
            } else {
              sendResponse({ success: false, error: 'Missing key for GET_EMOJI_SETTING' })
              return false
            }

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

          case 'uploadAndAddEmoji':
            handleUploadAndAddEmoji(message, sendResponse)
            return true

          default:
            console.log('Unknown action:', message.action)
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
