import { getChromeAPI } from '../utils/main.ts'

import type { LinuxDoPageFetchMessage, MessageResponse } from '@/types/messages'

export async function handleLinuxDoPageFetchRequest(
  opts: LinuxDoPageFetchMessage['options'],
  _sendResponse: (resp: MessageResponse) => void
) {
  const chromeAPI = getChromeAPI()
  if (!chromeAPI || !chromeAPI.tabs) {
    _sendResponse({ success: false, error: 'Chrome API not available' })
    return
  }

  if (!opts?.url) {
    _sendResponse({ success: false, error: 'Missing url' })
    return
  }

  try {
    const tabs = await chromeAPI.tabs.query({ url: 'https://linux.do/*' })
    if (!tabs.length) {
      _sendResponse({ success: false, error: 'No linux.do tabs found' })
      return
    }

    for (const tab of tabs) {
      if (!tab.id) continue
      try {
        const resp = await chromeAPI.tabs.sendMessage(tab.id, {
          type: 'PAGE_FETCH',
          options: {
            url: opts.url,
            method: opts.method,
            headers: opts.headers,
            body: opts.body,
            responseType: opts.responseType
          }
        })
        if (resp?.success) {
          _sendResponse(resp)
          return
        }
      } catch {
        continue
      }
    }

    _sendResponse({ success: false, error: 'Page fetch failed on all linux.do tabs' })
  } catch (error) {
    console.error('Failed to run page fetch', error)
    _sendResponse({ success: false, error: 'Unknown error' })
  }
}
