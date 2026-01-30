import type { MessageHandler } from './types'

import type { MessageResponse } from '@/types/messages'

export const pageFetchHandler: MessageHandler = (message, _sender, sendResponse) => {
  if (message.type !== 'PAGE_FETCH') return false

  const opts = message.options || {}
  const url = opts.url
  if (!url) {
    const errorResponse: MessageResponse = { success: false, error: 'Missing url' }
    sendResponse(errorResponse)
    return true
  }

  const responseType = opts.responseType === 'text' ? 'text' : 'json'
  fetch(url, {
    method: opts.method || 'GET',
    headers: opts.headers || {},
    body: opts.body,
    credentials: 'include'
  })
    .then(async res => {
      const data = responseType === 'text' ? await res.text() : await res.json().catch(() => null)
      const response: MessageResponse = {
        success: true,
        data: { status: res.status, ok: res.ok, data }
      }
      sendResponse(response)
    })
    .catch((error: any) => {
      const errorResponse: MessageResponse = {
        success: false,
        error: error?.message || 'Page fetch failed'
      }
      sendResponse(errorResponse)
    })
  return true
}
