import { getChromeAPI } from '../utils'
import { injectContentForTab, injectImageScriptIntoTab } from '../scripting'

export async function handleRequestInject(message: any, _sender: any, sendResponse: any) {
  try {
    const senderTabId = _sender && _sender.tab && _sender.tab.id ? _sender.tab.id : undefined
    let tabId = senderTabId
    const chromeAPI = getChromeAPI()
    if (!tabId && chromeAPI && chromeAPI.tabs) {
      try {
        const tabs = await chromeAPI.tabs.query({ active: true, currentWindow: true })
        if (tabs && tabs[0] && tabs[0].id) tabId = tabs[0].id
      } catch (_e) {
        void _e
      }
    }

    if (!tabId) {
      sendResponse({ success: false, error: 'No tabId available' })
      return
    }

    const result = await injectContentForTab(tabId, message.pageType || 'generic')
    sendResponse(result)
  } catch (e) {
    sendResponse({ success: false, error: String(e) })
  }
}

export async function handleInjectImageScript(_message: any, _sender: any, sendResponse: any) {
  try {
    const senderTabId = _sender && _sender.tab && _sender.tab.id ? _sender.tab.id : undefined
    let tabId = senderTabId
    const chromeAPI = getChromeAPI()
    if (!tabId && chromeAPI && chromeAPI.tabs) {
      try {
        const tabs = await chromeAPI.tabs.query({ active: true, currentWindow: true })
        if (tabs && tabs[0] && tabs[0].id) tabId = tabs[0].id
      } catch (_e) {
        void _e
      }
    }

    if (!tabId) {
      sendResponse({ success: false, error: 'No tabId available' })
      return
    }

    const result = await injectImageScriptIntoTab(tabId)
    sendResponse(result)
  } catch (e) {
    sendResponse({ success: false, error: String(e) })
  }
}
