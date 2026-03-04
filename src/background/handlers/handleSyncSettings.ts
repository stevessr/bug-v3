import { getChromeAPI } from '../utils/main.ts'

import type { AppSettings } from '@/types/type'

const CONTENT_TAB_URL_PATTERNS = ['http://*/*', 'https://*/*']
const CONTENT_SYNC_SETTING_KEYS: Array<keyof AppSettings> = [
  'imageScale',
  'outputFormat',
  'forceMobileMode',
  'enableHoverPreview',
  'uploadMenuItems',
  'customCssBlocks'
]

function shouldBroadcastToContent(updates?: unknown): boolean {
  if (!updates || typeof updates !== 'object') return true

  const keys = Object.keys(updates as Record<string, unknown>)
  if (keys.length === 0) return false

  return keys.some(key => CONTENT_SYNC_SETTING_KEYS.includes(key as keyof AppSettings))
}

export const handleSyncSettings = async (
  settings: any,
  _sendResponse: (_response: any) => void,
  updates?: any
) => {
  // mark callback as referenced
  void _sendResponse
  // no additional args expected here
  const chromeAPI = getChromeAPI()
  if (!chromeAPI || !chromeAPI.storage || !chromeAPI.tabs) {
    _sendResponse({ success: false, error: 'Chrome API not available' })
    return
  }

  try {
    // 保存为新的存储格式：{ data: {...}, timestamp: ... }
    const timestamp = Date.now()
    const appSettingsData = {
      data: { ...settings, lastModified: timestamp },
      timestamp: timestamp
    }

    await chromeAPI.storage.local.set({ appSettings: appSettingsData })

    // 仅当与 content script 相关的配置变更时才广播，减少无效消息循环
    if (shouldBroadcastToContent(updates)) {
      // 广播给可能注入 content script 的标签页，避免遍历所有标签页
      const tabs = await chromeAPI.tabs.query({ url: CONTENT_TAB_URL_PATTERNS })
      const tabIds = tabs
        .map((tab: chrome.tabs.Tab) => tab.id)
        .filter((id: number | undefined): id is number => typeof id === 'number')

      if (tabIds.length > 0) {
        const payload: any = { type: 'SETTINGS_UPDATED' }
        if (updates) {
          payload.updates = updates
        }

        // 不阻塞响应，异步发送并吞掉单个 tab 的错误
        void Promise.allSettled(
          tabIds.map((tabId: number) => chromeAPI.tabs.sendMessage(tabId, payload))
        )
      }
    }

    _sendResponse({ success: true })
  } catch (error: any) {
    console.error('Failed to sync settings:', error)
    _sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
