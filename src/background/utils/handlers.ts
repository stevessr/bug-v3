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
  handleDiscourseIconSpriteRequest,
  handleLinuxDoUploadRequest,
  handleLinuxDoChallengeRequest,
  handleDownloadImage,
  handleCaptureScreenshot,
  handleAgentDebugRequest,
  handleAgentWorkflowRequest,
  setupAgentWorkflows,
  setupStorageChangeListener,
  setupContextMenu,
  setupPeriodicCleanup,
  handleGetEmojiSetting,
  handleGetEmojiSettingsBatch,
  handleProxyFetchRequest,
  handleProxyImageRequest
} from '../handlers/main.ts'
import * as mcpBridgeModule from '../handlers/mcpBridge.ts'

import { getChromeAPI } from './main.ts'

import type { BackgroundMessage, TypedMessage, MessageResponse } from '@/types/messages'

// Re-export 给 background 入口使用的同步 setup
export { setupStorageChangeListener, setupContextMenu, setupPeriodicCleanup, setupAgentWorkflows }

function loadMcpBridge() {
  return Promise.resolve(mcpBridgeModule)
}

function respondWithMcpBridge<T>(
  operation: (bridge: typeof mcpBridgeModule) => Promise<T> | T,
  sendResponse: (resp: MessageResponse) => void,
  fallbackError: string
) {
  void (async () => {
    try {
      const bridge = await loadMcpBridge()
      const data = await operation(bridge)
      sendResponse({ success: true, data })
    } catch (error: any) {
      sendResponse({ success: false, error: error?.message || fallbackError })
    }
  })()
}

export async function setupMcpBridge() {
  const mod = await loadMcpBridge()
  return mod.setupMcpBridge()
}

export function setupMessageListener() {
  const chromeAPI = getChromeAPI()
  if (chromeAPI && chromeAPI.runtime && chromeAPI.runtime.onMessage) {
    chromeAPI.runtime.onMessage.addListener(
      (
        message: BackgroundMessage,
        sender: chrome.runtime.MessageSender,
        sendResponse: (resp: MessageResponse) => void
      ) => {
        console.log('Background received message:', message)

        const typedMsg = message as TypedMessage

        switch (typedMsg.type) {
          case 'GET_EMOJI_DATA':
            handleGetEmojiData(typedMsg as any, sendResponse as any)
            return true

          case 'GET_EMOJI_SETTING':
            if ('key' in typedMsg && typedMsg.key) {
              handleGetEmojiSetting(typedMsg.key as any, sendResponse as any)
              return true
            } else {
              sendResponse({ success: false, error: 'Missing key for GET_EMOJI_SETTING' })
              return false
            }

          case 'GET_EMOJI_SETTINGS_BATCH':
            if ('keys' in typedMsg && Array.isArray((typedMsg as any).keys)) {
              handleGetEmojiSettingsBatch((typedMsg as any).keys, sendResponse as any)
              return true
            } else {
              sendResponse({ success: false, error: 'Missing keys for GET_EMOJI_SETTINGS_BATCH' })
              return false
            }

          case 'SAVE_EMOJI_DATA':
            if ('data' in typedMsg) {
              handleSaveEmojiData((typedMsg as any).data, sendResponse as any)
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
          case 'PAGE_FETCH':
            if ('options' in typedMsg) {
              handlePageFetchRequest((typedMsg as any).options, sendResponse)
              return true
            } else {
              sendResponse({ success: false, error: 'Missing options for PAGE_FETCH' })
              return false
            }

          case 'GET_DISCOURSE_ICON_SPRITE':
            if ('url' in typedMsg && typedMsg.url) {
              void handleDiscourseIconSpriteRequest(typedMsg.url, sendResponse)
              return true
            }
            sendResponse({ success: false, error: 'Missing url for GET_DISCOURSE_ICON_SPRITE' })
            return false

          case 'LINUX_DO_UPLOAD':
            if ('options' in typedMsg) {
              handleLinuxDoUploadRequest((typedMsg as any).options, sendResponse)
              return true
            } else {
              sendResponse({ success: false, error: 'Missing options for LINUX_DO_UPLOAD' })
              return false
            }

          case 'LINUX_DO_RECOVER_CHALLENGE':
            handleLinuxDoChallengeRequest((typedMsg as any).options, sendResponse as any)
            return true

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
          case 'AGENT_DEBUG_START':
          case 'AGENT_DEBUG_READ_CONSOLE':
          case 'AGENT_DEBUG_READ_NETWORK':
          case 'AGENT_DEBUG_STOP':
            void handleAgentDebugRequest(typedMsg as any, sendResponse as any)
            return true
          case 'AGENT_RECORDING_START':
          case 'AGENT_RECORDING_STOP':
          case 'AGENT_RECORDING_STATUS':
          case 'AGENT_RECORDING_CONTENT_READY':
          case 'AGENT_RECORDING_EVENT':
          case 'AGENT_WORKFLOW_RUN_SCHEDULE':
            void handleAgentWorkflowRequest(typedMsg as any, sender, sendResponse as any)
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
            void loadMcpBridge().then(mod => {
              mod.setMcpBridgeDisabled(Boolean((typedMsg as any).disabled))
              sendResponse({ success: true })
            })
            return true
          case 'MCP_BRIDGE_TEST':
            respondWithMcpBridge(mod => mod.testMcpBridge(), sendResponse, 'MCP 测试失败')
            return true
          case 'MCP_SERVER_TEST':
            respondWithMcpBridge(
              mod => mod.testMcpServer((typedMsg as any).options || {}),
              sendResponse,
              'MCP 服务测试失败'
            )
            return true
          case 'MCP_BRIDGE_RECONNECT':
            void loadMcpBridge().then(mod => {
              mod.reconnectMcpBridge()
              sendResponse({ success: true })
            })
            return true
          case 'MCP_GET_STATUS':
            void loadMcpBridge().then(mod =>
              sendResponse({ success: true, data: mod.getMcpBridgeStatus() })
            )
            return true
          case 'MCP_GET_BRIDGE_SETTINGS':
            respondWithMcpBridge(mod => mod.loadMcpBridgeSettings(), sendResponse, '获取设置失败')
            return true
          case 'MCP_SET_BRIDGE_SETTINGS':
            respondWithMcpBridge(
              async mod => {
                await mod.saveMcpBridgeSettings((typedMsg as any).data || {})
                return undefined
              },
              sendResponse,
              '保存设置失败'
            )
            return true
          case 'MCP_DISCOVER_LOCAL':
            respondWithMcpBridge(mod => mod.discoverLocalMcpServers(), sendResponse, '本地发现失败')
            return true

          case 'ADD_TO_FAVORITES':
            if ('payload' in typedMsg && (typedMsg as any).payload?.emoji) {
              handleAddToFavorites((typedMsg as any).payload.emoji, sendResponse as any)
              return true
            } else {
              sendResponse({ success: false, error: 'Missing emoji for ADD_TO_FAVORITES' })
              return false
            }

          case 'ADD_EMOJI_FROM_WEB':
            if ('payload' in typedMsg && (typedMsg as any).payload?.emojiData) {
              handleAddEmojiFromWeb((typedMsg as any).payload.emojiData, sendResponse)
              return true
            } else {
              sendResponse({ success: false, error: 'Missing emojiData for ADD_EMOJI_FROM_WEB' })
              return false
            }

          case 'UPLOAD_AND_ADD_EMOJI':
            if ('payload' in typedMsg) {
              handleUploadAndAddEmoji(typedMsg as any, sendResponse)
              return true
            } else {
              sendResponse({ success: false, error: 'Missing payload for UPLOAD_AND_ADD_EMOJI' })
              return false
            }

          default:
            console.log('Unknown message type:', (typedMsg as any).type)
            sendResponse({ success: false, error: 'Unknown message type' })
            return false
        }
      }
    )
  }
}
