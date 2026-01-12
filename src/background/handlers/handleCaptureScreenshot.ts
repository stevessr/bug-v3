import { getChromeAPI } from '../utils/main'

export async function handleCaptureScreenshot(
  format: 'png' | 'jpeg' | undefined,
  sendResponse: any,
  tabId?: number
) {
  const chromeAPI = getChromeAPI()
  if (!chromeAPI?.tabs?.captureVisibleTab) {
    sendResponse({ success: false, error: 'captureVisibleTab 不可用' })
    return
  }
  let windowId: number | undefined
  if (typeof tabId === 'number' && chromeAPI.tabs?.get) {
    try {
      const tab = await chromeAPI.tabs.get(tabId)
      windowId = tab?.windowId
    } catch {
      windowId = undefined
    }
  }

  chromeAPI.tabs.captureVisibleTab(windowId, { format: format || 'png' }, (dataUrl: string) => {
    if (chromeAPI.runtime.lastError) {
      sendResponse({ success: false, error: chromeAPI.runtime.lastError.message })
      return
    }
    sendResponse({ success: true, data: dataUrl })
  })
}
