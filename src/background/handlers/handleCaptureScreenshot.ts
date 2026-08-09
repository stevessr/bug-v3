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
  let previousActiveTabId: number | undefined
  let activatedTarget = false
  if (typeof tabId === 'number' && chromeAPI.tabs?.get) {
    try {
      const tab = await chromeAPI.tabs.get(tabId)
      windowId = tab?.windowId
      if (!tab.active && typeof windowId === 'number' && chromeAPI.tabs?.query) {
        const activeTabs = await chromeAPI.tabs.query({ active: true, windowId })
        previousActiveTabId = activeTabs[0]?.id
        await chromeAPI.tabs.update(tabId, { active: true })
        activatedTarget = true
        // captureVisibleTab can otherwise capture the previous compositor frame.
        await new Promise(resolve => setTimeout(resolve, 120))
      }
    } catch (error: any) {
      sendResponse({ success: false, error: error?.message || '无法访问目标标签页' })
      return
    }
  }

  let response: { success: boolean; data?: string; error?: string }
  try {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      chromeAPI.tabs.captureVisibleTab(windowId, { format: format || 'png' }, (value: string) => {
        if (chromeAPI.runtime.lastError) {
          reject(new Error(chromeAPI.runtime.lastError.message))
          return
        }
        resolve(value)
      })
    })
    response = { success: true, data: dataUrl }
  } catch (error: any) {
    response = { success: false, error: error?.message || '截图失败' }
  } finally {
    if (
      activatedTarget &&
      typeof previousActiveTabId === 'number' &&
      previousActiveTabId !== tabId
    ) {
      try {
        await chromeAPI.tabs.update(previousActiveTabId, { active: true })
      } catch {
        // The previous tab may have been closed while capture was running.
      }
    }
  }
  sendResponse(response)
}
