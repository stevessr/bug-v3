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
    // Diagnostic: log sender info to help debug missing tabId cases
    try {
      console.log('[后台] handleInjectImageScript sender:', _sender)
    } catch (e) {
      // ignore logging errors
    }

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
      console.warn('[后台] handleInjectImageScript: no tabId could be determined')
      sendResponse({ success: false, error: 'No tabId available' })
      return
    }

    console.log('[后台] handleInjectImageScript: injecting into tabId', tabId)
    const result = await injectImageScriptIntoTab(tabId)
    console.log('[后台] handleInjectImageScript: inject result', { tabId, result })
    // include tabId in the response to make diagnosis easier from content side
    sendResponse({ ...result, tabId })
  } catch (e) {
    sendResponse({ success: false, error: String(e) })
  }
}
