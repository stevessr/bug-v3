import { getChromeAPI } from '../utils/main'

export function handleCaptureScreenshot(format: 'png' | 'jpeg' | undefined, sendResponse: any) {
  const chromeAPI = getChromeAPI()
  if (!chromeAPI?.tabs?.captureVisibleTab) {
    sendResponse({ success: false, error: 'captureVisibleTab 不可用' })
    return
  }

  chromeAPI.tabs.captureVisibleTab(undefined, { format: format || 'png' }, (dataUrl: string) => {
    if (chromeAPI.runtime.lastError) {
      sendResponse({ success: false, error: chromeAPI.runtime.lastError.message })
      return
    }
    sendResponse({ success: true, data: dataUrl })
  })
}
