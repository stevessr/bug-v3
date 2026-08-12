import { getDiscoursePreloadedData, getDiscoursePreloadedValue } from '../discourse/preloaded'

import type { MessageHandler } from './types'

import type { MessageResponse } from '@/types/messages'

export { getDiscoursePreloadedData, getDiscoursePreloadedValue } from '../discourse/preloaded'

// Get CSRF token from meta tag
function getCsrfToken(): string | null {
  const meta = document.querySelector('meta[name="csrf-token"]')
  return meta?.getAttribute('content') || null
}

function isMessageBusPath(pathname: string): boolean {
  return pathname === '/message-bus' || pathname.startsWith('/message-bus/')
}

const PRELOADED_JSON_ROUTE_KEYS: Record<string, string[]> = {
  '/site.json': ['site'],
  '/site/settings.json': ['siteSettings', 'site_settings'],
  '/site/emoji.json': ['customEmoji', 'custom_emoji'],
  '/site/custom_html.json': ['customHTML', 'custom_html'],
  '/site/banner.json': ['banner']
}

/**
 * Discourse's application shell serializes these endpoint responses in
 * `data-preloaded`. Reuse the exact, already authenticated page snapshot when
 * possible, but only for same-origin GET JSON requests. All other paths still
 * go through fetch so request semantics stay unchanged.
 */
function getPreloadedJsonRouteData(
  inputUrl: string,
  method: string | undefined,
  responseType: 'json' | 'text' | 'blob'
): { found: boolean; data?: unknown } {
  if (responseType !== 'json' || (method || 'GET').toUpperCase() !== 'GET') {
    return { found: false }
  }

  try {
    const target = new URL(inputUrl, window.location.href)
    if (target.origin !== window.location.origin) return { found: false }

    const keys = PRELOADED_JSON_ROUTE_KEYS[target.pathname]
    if (!keys) return { found: false }

    const data = getDiscoursePreloadedValue(...keys)
    return data === undefined ? { found: false } : { found: true, data }
  } catch {
    return { found: false }
  }
}

function resolveMessageBusRequestUrl(inputUrl: string): string {
  try {
    const targetUrl = new URL(inputUrl, window.location.href)
    if (!isMessageBusPath(targetUrl.pathname)) {
      return targetUrl.toString()
    }

    const data = getDiscoursePreloadedData()
    const siteData =
      data?.site && typeof data.site === 'object' && !Array.isArray(data.site)
        ? (data.site as Record<string, unknown>)
        : null
    const messageBusBaseUrl = [
      data?.messageBusBaseUrl,
      data?.['message_bus_base_url'],
      siteData?.messageBusBaseUrl,
      siteData?.['message_bus_base_url']
    ].find(value => typeof value === 'string' && value.trim()) as string | undefined
    if (!messageBusBaseUrl?.trim()) {
      return targetUrl.toString()
    }

    const busBase = new URL(messageBusBaseUrl, window.location.origin)
    const basePath = busBase.pathname.replace(/\/+$/, '')
    const targetPath = targetUrl.pathname.replace(/^\/+/, '')
    const normalizedBasePath = basePath && basePath !== '/' ? basePath.replace(/^\/+/, '') : ''
    // Current Discourse preloads `messageBusBaseUrl` as either the origin or
    // the `/message-bus` mount itself. Avoid producing the invalid
    // `/message-bus/message-bus/...` path when the requested URL already
    // contains that mount (the old code made the browser silently miss every
    // upstream update with a 404).
    const alreadyMounted =
      normalizedBasePath.length > 0 &&
      (targetPath === normalizedBasePath || targetPath.startsWith(`${normalizedBasePath}/`))
    const mountName = normalizedBasePath.split('/').pop() || ''
    const targetIncludesMountName =
      mountName.length > 0 && (targetPath === mountName || targetPath.startsWith(`${mountName}/`))
    const targetSuffix = targetIncludesMountName
      ? targetPath.slice(mountName.length).replace(/^\/+/, '')
      : targetPath
    const mergedPath = alreadyMounted
      ? `/${targetPath}`
      : normalizedBasePath
        ? `/${normalizedBasePath}${targetIncludesMountName ? (targetSuffix ? `/${targetSuffix}` : '') : `/${targetPath}`}`
        : `/${targetPath}`

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

  const preloadedRouteData = getPreloadedJsonRouteData(url, opts.method, responseType)
  if (preloadedRouteData.found) {
    const response: MessageResponse = {
      success: true,
      data: { status: 200, ok: true, data: preloadedRouteData.data }
    }
    sendResponse(response)
    return true
  }

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
