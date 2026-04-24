import type { MessageHandler } from './types'

import type { MessageResponse } from '@/types/messages'

let cachedPreloadedRaw = ''
let cachedPreloadedData: Record<string, unknown> | null = null

// Get CSRF token from meta tag
function getCsrfToken(): string | null {
  const meta = document.querySelector('meta[name="csrf-token"]')
  return meta?.getAttribute('content') || null
}

function getDiscoursePreloadedData(): Record<string, unknown> | null {
  const preloaded = document.getElementById('data-preloaded') as HTMLElement | null
  const raw = preloaded?.dataset?.preloaded || ''

  if (!raw) {
    cachedPreloadedRaw = ''
    cachedPreloadedData = null
    return null
  }

  if (raw === cachedPreloadedRaw) {
    return cachedPreloadedData
  }

  cachedPreloadedRaw = raw
  try {
    const data = JSON.parse(raw)
    cachedPreloadedData =
      data && typeof data === 'object' ? (data as Record<string, unknown>) : null
  } catch {
    cachedPreloadedData = null
  }

  return cachedPreloadedData
}

function isMessageBusPath(pathname: string): boolean {
  return pathname === '/message-bus' || pathname.startsWith('/message-bus/')
}

function resolveMessageBusRequestUrl(inputUrl: string): string {
  try {
    const targetUrl = new URL(inputUrl, window.location.href)
    if (!isMessageBusPath(targetUrl.pathname)) {
      return targetUrl.toString()
    }

    const data = getDiscoursePreloadedData()
    const messageBusBaseUrl =
      typeof data?.messageBusBaseUrl === 'string'
        ? data.messageBusBaseUrl
        : typeof data?.['message_bus_base_url'] === 'string'
          ? data['message_bus_base_url']
          : ''
    if (!messageBusBaseUrl.trim()) {
      return targetUrl.toString()
    }

    const busBase = new URL(messageBusBaseUrl, window.location.origin)
    const basePath = busBase.pathname.replace(/\/+$/, '')
    const targetPath = targetUrl.pathname.replace(/^\/+/, '')
    const mergedPath = basePath && basePath !== '/' ? `${basePath}/${targetPath}` : `/${targetPath}`

    const rewrittenUrl = new URL(busBase.toString())
    rewrittenUrl.pathname = mergedPath.replace(/\/{2,}/g, '/')
    rewrittenUrl.search = targetUrl.search
    rewrittenUrl.hash = targetUrl.hash
    return rewrittenUrl.toString()
  } catch {
    return inputUrl
  }
}

function getPassThroughHeaderValue(name: string): string | null {
  const key = name.trim().toLowerCase()
  if (!key) return null

  if (key === 'x-shared-session-key') {
    const data = getDiscoursePreloadedData()
    const value = data?.sharedSessionKey
    return typeof value === 'string' && value ? value : null
  }

  return null
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

  const passHeaders = Array.isArray(opts.passHeaders) ? opts.passHeaders : []
  for (const rawName of passHeaders) {
    if (typeof rawName !== 'string') continue
    const normalizedName = rawName.trim()
    if (!normalizedName) continue
    const value = getPassThroughHeaderValue(normalizedName)
    if (!value) continue
    headers[normalizedName] = value
  }

  // Add CSRF token if available
  const csrfToken = getCsrfToken()
  if (csrfToken) {
    headers['x-csrf-token'] = csrfToken
  }

  const requestUrl = resolveMessageBusRequestUrl(url)

  fetch(requestUrl, {
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
        try {
          data = await res.json()
        } catch {
          data = null
        }
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
