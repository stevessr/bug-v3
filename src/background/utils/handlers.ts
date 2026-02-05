import { handleAddEmojiFromWeb } from '../handlers/addEmojiFromWeb.ts'
import { handleUploadAndAddEmoji } from '../handlers/uploadAndAddEmoji.ts'
import {
  handleAddToFavorites,
  handleGetEmojiData,
  handleSaveEmojiData,
  handleSyncSettings,
  handleLinuxDoAuthRequest,
  handleLinuxDoUserRequest,
  handlePageFetchRequest,
  handleLinuxDoPageFetchRequest,
  handleLinuxDoUploadRequest,
  handleDownloadImage,
  handleCaptureScreenshot,
  setupStorageChangeListener,
  setupContextMenu,
  setupPeriodicCleanup,
  handleGetEmojiSetting,
  handleProxyFetchRequest,
  handleProxyImageRequest,
  setupScheduledLikes
} from '../handlers/main.ts'
import {
  setMcpBridgeDisabled,
  setupMcpBridge,
  testMcpBridge,
  testMcpServer
} from '../handlers/mcpBridge.ts'

import { getChromeAPI } from './main.ts'

import type {
  BackgroundMessage,
  TypedMessage,
  ActionMessage,
  MessageResponse
} from '@/types/messages'

// Re-export setup functions so background entry can import them from ./handlers
export { setupStorageChangeListener, setupContextMenu, setupPeriodicCleanup, setupMcpBridge, setupScheduledLikes }

export function setupMessageListener() {
  const chromeAPI = getChromeAPI()
  if (chromeAPI && chromeAPI.runtime && chromeAPI.runtime.onMessage) {
    chromeAPI.runtime.onMessage.addListener(
      (
        message: BackgroundMessage,
        _sender: chrome.runtime.MessageSender,
        sendResponse: (resp: MessageResponse) => void
      ) => {
        console.log('Background received message:', message)

        // 首先检查 message.type
        if (typeof message === 'object' && message !== null && 'type' in message) {
          const typedMsg = message as TypedMessage
          switch (typedMsg.type) {
            case 'GET_EMOJI_DATA':
              handleGetEmojiData(typedMsg as any, sendResponse)
              return true

            case 'GET_EMOJI_SETTING':
              if ('key' in typedMsg && typedMsg.key) {
                handleGetEmojiSetting(typedMsg.key as any, sendResponse)
                return true
              } else {
                sendResponse({ success: false, error: 'Missing key for GET_EMOJI_SETTING' })
                return false
              }

            case 'SAVE_EMOJI_DATA':
              if ('data' in typedMsg) {
                handleSaveEmojiData((typedMsg as any).data, sendResponse)
                return true
              } else {
                sendResponse({ success: false, error: 'Missing data for SAVE_EMOJI_DATA' })
                return false
              }

            case 'SYNC_SETTINGS':
              if ('settings' in typedMsg) {
                handleSyncSettings(
                  (typedMsg as any).settings,
                  sendResponse as any,
                  (typedMsg as any).updates
                )
                return true
              } else {
                sendResponse({ success: false, error: 'Missing settings for SYNC_SETTINGS' })
                return false
              }

            case 'REQUEST_LINUX_DO_AUTH':
              handleLinuxDoAuthRequest(sendResponse as any)
              return true
            case 'GET_LINUX_DO_USER':
              handleLinuxDoUserRequest(sendResponse as any)
              return true
            case 'LINUX_DO_PAGE_FETCH':
              if ('options' in typedMsg) {
                handleLinuxDoPageFetchRequest((typedMsg as any).options, sendResponse)
                return true
              } else {
                sendResponse({ success: false, error: 'Missing options for LINUX_DO_PAGE_FETCH' })
                return false
              }
            case 'PAGE_FETCH':
              if ('options' in typedMsg) {
                handlePageFetchRequest((typedMsg as any).options, sendResponse)
                return true
              } else {
                sendResponse({ success: false, error: 'Missing options for PAGE_FETCH' })
                return false
              }

            case 'LINUX_DO_UPLOAD':
              if ('options' in typedMsg) {
                handleLinuxDoUploadRequest((typedMsg as any).options, sendResponse)
                return true
              } else {
                sendResponse({ success: false, error: 'Missing options for LINUX_DO_UPLOAD' })
                return false
              }

            case 'downloadImage':
            case 'DOWNLOAD_IMAGE':
              if ('url' in typedMsg) {
                handleDownloadImage(typedMsg as any, sendResponse as any)
                return true
              } else {
                sendResponse({ success: false, error: 'Missing url for DOWNLOAD_IMAGE' })
                return false
              }

            case 'CAPTURE_SCREENSHOT':
              handleCaptureScreenshot(
                (typedMsg as any).format,
                sendResponse as any,
                (typedMsg as any).tabId
              )
              return true
            case 'PROXY_FETCH':
              if ('options' in typedMsg) {
                handleProxyFetchRequest((typedMsg as any).options, sendResponse as any)
                return true
              } else {
                sendResponse({ success: false, error: 'Missing options for PROXY_FETCH' })
                return false
              }
            case 'PROXY_IMAGE':
              if ('url' in typedMsg) {
                handleProxyImageRequest({ url: (typedMsg as any).url }, sendResponse as any)
                return true
              } else {
                sendResponse({ success: false, error: 'Missing url for PROXY_IMAGE' })
                return false
              }
            case 'MCP_BRIDGE_SET_DISABLED':
              setMcpBridgeDisabled(Boolean((typedMsg as any).disabled))
              sendResponse({ success: true })
              return true
            case 'MCP_BRIDGE_TEST':
              testMcpBridge()
                .then(result => sendResponse({ success: true, data: result }))
                .catch((error: any) =>
                  sendResponse({ success: false, error: error?.message || 'MCP 测试失败' })
                )
              return true
            case 'MCP_SERVER_TEST':
              testMcpServer((typedMsg as any).options || {})
                .then(result => sendResponse({ success: true, data: result }))
                .catch((error: any) =>
                  sendResponse({ success: false, error: error?.message || 'MCP 服务测试失败' })
                )
              return true

            default:
              console.log('Unknown message type:', (typedMsg as any).type)
              sendResponse({ success: false, error: 'Unknown message type' })
              return false
          }
        }

        // 然后检查 message.action
        if (typeof message === 'object' && message !== null && 'action' in message) {
          const actionMsg = message as ActionMessage
          switch (actionMsg.action) {
            case 'addToFavorites':
              if ('emoji' in actionMsg) {
                handleAddToFavorites((actionMsg as any).emoji, sendResponse)
                return true
              } else {
                sendResponse({ success: false, error: 'Missing emoji for addToFavorites' })
                return false
              }

            case 'addEmojiFromWeb':
              if ('emojiData' in actionMsg) {
                handleAddEmojiFromWeb((actionMsg as any).emojiData, sendResponse)
                return true
              } else {
                sendResponse({ success: false, error: 'Missing emojiData for addEmojiFromWeb' })
                return false
              }

            case 'uploadAndAddEmoji':
              handleUploadAndAddEmoji(actionMsg as any, sendResponse)
              return true

            default:
              console.log('Unknown action:', (actionMsg as any).action)
              sendResponse({ success: false, error: 'Unknown action' })
              return false
          }
        }

        // 如果既没有 type 也没有 action
        console.log('Message has no type or action:', message)
        sendResponse({ success: false, error: 'Message has no type or action' })
        return false
      }
    )
  }
}
