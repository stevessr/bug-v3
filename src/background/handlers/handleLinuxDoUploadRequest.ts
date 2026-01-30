import { getChromeAPI } from '../utils/main.ts'

import type { LinuxDoUploadMessage, MessageResponse } from '@/types/messages'

export async function handleLinuxDoUploadRequest(
  opts: LinuxDoUploadMessage['options'],
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
          type: 'PAGE_UPLOAD',
          options: {
            url: opts.url,
            fileData: opts.fileData,
            fileName: opts.fileName,
            mimeType: opts.mimeType,
            sha1: opts.sha1
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

    _sendResponse({ success: false, error: 'Page upload failed on all linux.do tabs' })
  } catch (error) {
    console.error('Failed to run page upload', error)
    _sendResponse({ success: false, error: 'Unknown error' })
  }
}
