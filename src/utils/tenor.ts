/**
 * Tenor v2 API client
 *
 * 通过 background 的 PROXY_FETCH 调用 tenor.googleapis.com 接口，
 * 内置 LRU 缓存、AbortController 取消、防抖辅助，避免每次输入都发请求。
 *
 * https://developers.google.com/tenor/guides/endpoints
 */

export interface TenorMediaFormat {
  url: string
  dims?: [number, number]
  size?: number
  duration?: number
  preview?: string
}

export interface TenorResult {
  id: string
  title?: string
  content_description?: string
  itemurl?: string
  url?: string
  tags?: string[]
  media_formats?: Record<string, TenorMediaFormat>
}

export interface TenorSearchResponse {
  results: TenorResult[]
  next?: string
}

export interface TenorSearchOptions {
  query: string
  apiKey: string
  clientKey?: string
  limit?: number
  pos?: string
  locale?: string
  contentFilter?: 'off' | 'low' | 'medium' | 'high'
  mediaFilter?: string
  signal?: AbortSignal
}

export interface TenorFeaturedOptions {
  apiKey: string
  clientKey?: string
  limit?: number
  pos?: string
  locale?: string
  contentFilter?: 'off' | 'low' | 'medium' | 'high'
  mediaFilter?: string
  signal?: AbortSignal
}

const TENOR_ENDPOINT = 'https://tenor.googleapis.com/v2'
const DEFAULT_MEDIA_FILTER = 'tinygif,gif,mediumgif,nanogif'
const DEFAULT_LIMIT = 24
const CACHE_LIMIT = 64
const CACHE_TTL_MS = 5 * 60 * 1000

interface CacheEntry {
  expiresAt: number
  data: TenorSearchResponse
}

const responseCache = new Map<string, CacheEntry>()

function cacheKey(prefix: string, params: Record<string, string | number | undefined>): string {
  const ordered = Object.keys(params)
    .filter(k => params[k] !== undefined && params[k] !== '')
    .sort()
    .map(k => `${k}=${params[k]}`)
    .join('&')
  return `${prefix}:${ordered}`
}

function readCache(key: string): TenorSearchResponse | null {
  const entry = responseCache.get(key)
  if (!entry) return null
  if (entry.expiresAt < Date.now()) {
    responseCache.delete(key)
    return null
  }
  // refresh LRU position
  responseCache.delete(key)
  responseCache.set(key, entry)
  return entry.data
}

function writeCache(key: string, data: TenorSearchResponse) {
  if (responseCache.size >= CACHE_LIMIT) {
    const oldest = responseCache.keys().next().value
    if (oldest) responseCache.delete(oldest)
  }
  responseCache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, data })
}

export function clearTenorCache() {
  responseCache.clear()
}

interface ProxyFetchResponse {
  success: boolean
  status?: number
  ok?: boolean
  data?: any
  error?: string
}

function sendProxyFetch(url: string, signal?: AbortSignal): Promise<ProxyFetchResponse> {
  const chromeAPI: any = (globalThis as any).chrome
  if (!chromeAPI?.runtime?.sendMessage) {
    return Promise.reject(new Error('chrome.runtime.sendMessage 不可用'))
  }

  return new Promise<ProxyFetchResponse>((resolve, reject) => {
    let settled = false

    const finish = (value: ProxyFetchResponse) => {
      if (settled) return
      settled = true
      resolve(value)
    }
    const fail = (err: Error) => {
      if (settled) return
      settled = true
      reject(err)
    }

    const onAbort = () => fail(new DOMException('Aborted', 'AbortError'))
    if (signal) {
      if (signal.aborted) return fail(new DOMException('Aborted', 'AbortError'))
      signal.addEventListener('abort', onAbort, { once: true })
    }

    try {
      chromeAPI.runtime.sendMessage(
        {
          type: 'PROXY_FETCH',
          options: {
            url,
            method: 'GET',
            responseType: 'json'
          }
        },
        (resp: ProxyFetchResponse) => {
          if (signal) signal.removeEventListener('abort', onAbort)
          if (chromeAPI.runtime?.lastError) {
            return fail(new Error(chromeAPI.runtime.lastError.message || 'PROXY_FETCH 失败'))
          }
          finish(resp || { success: false, error: 'empty response' })
        }
      )
    } catch (e: any) {
      fail(new Error(e?.message || 'PROXY_FETCH 发送失败'))
    }
  })
}

function buildSearchUrl(opts: TenorSearchOptions): string {
  const params = new URLSearchParams()
  params.set('key', opts.apiKey)
  params.set('q', opts.query)
  params.set('limit', String(opts.limit ?? DEFAULT_LIMIT))
  params.set('media_filter', opts.mediaFilter || DEFAULT_MEDIA_FILTER)
  params.set('contentfilter', opts.contentFilter || 'high')
  if (opts.locale) params.set('locale', opts.locale)
  if (opts.pos) params.set('pos', opts.pos)
  if (opts.clientKey) params.set('client_key', opts.clientKey)
  return `${TENOR_ENDPOINT}/search?${params.toString()}`
}

function buildFeaturedUrl(opts: TenorFeaturedOptions): string {
  const params = new URLSearchParams()
  params.set('key', opts.apiKey)
  params.set('limit', String(opts.limit ?? DEFAULT_LIMIT))
  params.set('media_filter', opts.mediaFilter || DEFAULT_MEDIA_FILTER)
  params.set('contentfilter', opts.contentFilter || 'high')
  if (opts.locale) params.set('locale', opts.locale)
  if (opts.pos) params.set('pos', opts.pos)
  if (opts.clientKey) params.set('client_key', opts.clientKey)
  return `${TENOR_ENDPOINT}/featured?${params.toString()}`
}

async function executeAndCache(
  cacheId: string,
  url: string,
  signal?: AbortSignal
): Promise<TenorSearchResponse> {
  const cached = readCache(cacheId)
  if (cached) return cached

  const resp = await sendProxyFetch(url, signal)
  if (!resp.success || resp.ok === false) {
    const detail = resp?.data?.error?.message || resp?.error || `HTTP ${resp.status || 'error'}`
    throw new Error(`Tenor 请求失败: ${detail}`)
  }
  const payload: TenorSearchResponse = {
    results: Array.isArray(resp.data?.results) ? resp.data.results : [],
    next: typeof resp.data?.next === 'string' ? resp.data.next : undefined
  }
  writeCache(cacheId, payload)
  return payload
}

export function tenorSearch(opts: TenorSearchOptions): Promise<TenorSearchResponse> {
  if (!opts.apiKey) return Promise.reject(new Error('缺少 Tenor API Key'))
  const trimmed = opts.query.trim()
  if (!trimmed) return Promise.resolve({ results: [] })
  const url = buildSearchUrl({ ...opts, query: trimmed })
  const id = cacheKey('search', {
    q: trimmed,
    limit: opts.limit,
    pos: opts.pos,
    locale: opts.locale,
    contentFilter: opts.contentFilter,
    mediaFilter: opts.mediaFilter
  })
  return executeAndCache(id, url, opts.signal)
}

export function tenorFeatured(opts: TenorFeaturedOptions): Promise<TenorSearchResponse> {
  if (!opts.apiKey) return Promise.reject(new Error('缺少 Tenor API Key'))
  const url = buildFeaturedUrl(opts)
  const id = cacheKey('featured', {
    limit: opts.limit,
    pos: opts.pos,
    locale: opts.locale,
    contentFilter: opts.contentFilter,
    mediaFilter: opts.mediaFilter
  })
  return executeAndCache(id, url, opts.signal)
}

/**
 * 从 Tenor 媒体格式中挑出最合适的缩略图 / 全尺寸 URL。
 */
export function pickTenorPreview(result: TenorResult): { thumb: string; full: string } | null {
  const formats = result.media_formats || {}
  const thumb =
    formats.tinygif?.url ||
    formats.nanogif?.url ||
    formats.gifpreview?.url ||
    formats.mediumgif?.url ||
    formats.gif?.url ||
    ''
  const full =
    formats.gif?.url || formats.mediumgif?.url || formats.tinygif?.url || formats.nanogif?.url || ''
  if (!thumb || !full) return null
  return { thumb, full }
}

/**
 * 简易 debounce，仅保留最后一次调用。
 */
export function debounceAsync<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  ms: number
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
  let timer: number | null = null
  let pending: { resolve: (v: any) => void; reject: (e: any) => void } | null = null

  return (...args: Parameters<T>) => {
    if (timer !== null) window.clearTimeout(timer)
    return new Promise<ReturnType<T>>((resolve, reject) => {
      if (pending) {
        pending.reject(new DOMException('Aborted', 'AbortError'))
      }
      pending = { resolve, reject }
      timer = window.setTimeout(async () => {
        timer = null
        const current = pending
        pending = null
        try {
          const value = await fn(...args)
          current?.resolve(value)
        } catch (e) {
          current?.reject(e)
        }
      }, ms)
    })
  }
}

/**
 * 通过 background 代理把 Tenor 媒体下载为 Blob，规避 content-script CORS / referer 限制。
 */
export async function fetchTenorMediaAsBlob(
  url: string,
  signal?: AbortSignal
): Promise<{ blob: Blob; contentType: string; filename: string }> {
  const chromeAPI: any = (globalThis as any).chrome
  if (!chromeAPI?.runtime?.sendMessage) {
    throw new Error('chrome.runtime.sendMessage 不可用')
  }

  return new Promise((resolve, reject) => {
    let settled = false

    const onAbort = () => {
      if (settled) return
      settled = true
      reject(new DOMException('Aborted', 'AbortError'))
    }
    if (signal) {
      if (signal.aborted) return onAbort()
      signal.addEventListener('abort', onAbort, { once: true })
    }

    try {
      chromeAPI.runtime.sendMessage({ type: 'PROXY_IMAGE', url }, (resp: any) => {
        if (signal) signal.removeEventListener('abort', onAbort)
        if (settled) return
        settled = true
        if (chromeAPI.runtime?.lastError) {
          return reject(new Error(chromeAPI.runtime.lastError.message || 'PROXY_IMAGE 失败'))
        }
        if (!resp?.success) {
          return reject(new Error(resp?.error || 'PROXY_IMAGE 返回失败'))
        }
        try {
          const bytes = Array.isArray(resp.data) ? new Uint8Array(resp.data) : null
          if (!bytes || bytes.length === 0) {
            return reject(new Error('PROXY_IMAGE 没有返回数据'))
          }
          const contentType: string = resp.mimeType || 'image/gif'
          const blob = new Blob([bytes], { type: contentType })
          const filename = inferFilenameFromUrl(url, contentType)
          resolve({ blob, contentType, filename })
        } catch (e: any) {
          reject(new Error(e?.message || '解析 PROXY_IMAGE 数据失败'))
        }
      })
    } catch (e: any) {
      reject(new Error(e?.message || 'PROXY_IMAGE 发送失败'))
    }
  })
}

function inferFilenameFromUrl(url: string, mime: string): string {
  let base = 'tenor'
  try {
    const u = new URL(url)
    const last = u.pathname.split('/').filter(Boolean).pop()
    if (last) base = last
  } catch {
    /* ignore */
  }
  if (/\.(gif|webp|mp4|png|jpe?g)$/i.test(base)) return base
  const ext = mime.includes('webp')
    ? 'webp'
    : mime.includes('png')
      ? 'png'
      : mime.includes('jpeg')
        ? 'jpg'
        : mime.includes('mp4')
          ? 'mp4'
          : 'gif'
  return `${base}.${ext}`
}
