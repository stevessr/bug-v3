import type { MessageHandler } from './types'

import type { MessageResponse } from '@/types/messages'

// Get CSRF token from meta tag
function getCsrfToken(): string | null {
  const meta = document.querySelector('meta[name="csrf-token"]')
  return meta?.getAttribute('content') || null
}

export const pageFetchHandler: MessageHandler = (message, _sender, sendResponse) => {
  if (message.type !== 'PAGE_FETCH') return false

  const opts = message.options || {}
  const url = opts.url
  if (!url) {
    const errorResponse: MessageResponse = { success: false, error: 'Missing url' }
    sendResponse(errorResponse)
    return true
  }

  const responseType =
    opts.responseType === 'text' ? 'text' : opts.responseType === 'blob' ? 'blob' : 'json'

  // Build headers with Discourse-specific ones for authenticated requests
  const defaultAccept =
    responseType === 'blob' ? 'image/*,*/*;q=0.8' : 'application/json, text/javascript, */*; q=0.01'
  const headers: Record<string, string> = {
    accept: defaultAccept,
    'x-requested-with': 'XMLHttpRequest',
    'discourse-logged-in': 'true',
    'discourse-present': 'true',
    ...(opts.headers || {})
  }

  // Add CSRF token if available
  const csrfToken = getCsrfToken()
  if (csrfToken) {
    headers['x-csrf-token'] = csrfToken
  }

  fetch(url, {
    method: opts.method || 'GET',
    headers,
    body: opts.body,
    credentials: 'include'
  })
    .then(async res => {
      let data: any
      if (responseType === 'text') {
        data = await res.text()
      } else if (responseType === 'blob') {
        const arrayBuffer = await res.arrayBuffer()
        const mimeType = res.headers.get('content-type') || 'application/octet-stream'
        data = {
          arrayData: Array.from(new Uint8Array(arrayBuffer)),
          mimeType
        }
      } else {
        data = await res.json().catch(() => null)
      }
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
