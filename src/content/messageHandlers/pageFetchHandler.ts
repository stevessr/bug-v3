import type { MessageHandler } from './types'

export const pageFetchHandler: MessageHandler = (message, _sender, sendResponse) => {
  if (message.type !== 'PAGE_FETCH') return false

  const opts = message.options || {}
  const url = opts.url
  if (!url) {
    sendResponse({ success: false, error: 'Missing url' })
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
      sendResponse({ success: true, status: res.status, ok: res.ok, data })
    })
    .catch((error: any) => {
      sendResponse({ success: false, error: error?.message || 'Page fetch failed' })
    })
  return true
}
