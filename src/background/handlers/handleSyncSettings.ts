import { getChromeAPI } from '../utils/main.ts'
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

    const tabs = await chromeAPI.tabs.query({})
    for (const tab of tabs) {
      if (tab.id) {
        // 如果有 updates，优先发送 updates，否则发送全量 settings
        const payload: any = {
          type: 'SETTINGS_UPDATED',
          settings: settings
        }

        if (updates) {
          payload.updates = updates
        }

        chromeAPI.tabs.sendMessage(tab.id, payload).catch(() => {
          // Ignore errors for tabs that don't have content script
        })
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
