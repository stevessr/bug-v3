// Discourse Browser Utilities

import { parsePostContent } from './parser/parsePostContent'
export { renderBBCode } from './bbcode'

type BlobPayload = {
  arrayData: number[]
  mimeType?: string
}

type PageFetchResponse<T> = {
  success: boolean
  data?: { status: number; ok: boolean; data: T }
  error?: string
}

const PAGE_FETCH_MAX_CONCURRENCY = 2
const PAGE_FETCH_TIMEOUT_MS = 30000
const pageFetchQueue: Array<() => void> = []
let pageFetchInFlight = 0

function drainPageFetchQueue() {
  while (pageFetchInFlight < PAGE_FETCH_MAX_CONCURRENCY && pageFetchQueue.length > 0) {
    const task = pageFetchQueue.shift()
    if (!task) return
    pageFetchInFlight += 1
    task()
  }
}

function enqueuePageFetch<T>(task: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    pageFetchQueue.push(() => {
      return task()
        .then(resolve)
        .catch(reject)
        .finally(() => {
          pageFetchInFlight = Math.max(0, pageFetchInFlight - 1)
          drainPageFetchQueue()
        })
    })
    drainPageFetchQueue()
  })
}

function toBlobIfNeeded(data: unknown, responseType: 'json' | 'text' | 'blob') {
  if (responseType !== 'blob') return data
  if (!data || typeof data !== 'object') return null
  const payload = data as BlobPayload
  if (!Array.isArray(payload.arrayData)) return null
  return new Blob([new Uint8Array(payload.arrayData)], {
    type: payload.mimeType || 'application/octet-stream'
  })
}

// Page proxy request via Chrome extension
export async function pageFetch<T>(
  url: string,
  options?: { method?: string; headers?: Record<string, string>; body?: string },
  responseType: 'json' | 'text' | 'blob' = 'json'
): Promise<{ status: number; ok: boolean; data: T | null }> {
  const chromeAPI = (globalThis as any).chrome
  if (!chromeAPI?.runtime?.sendMessage) {
    throw new Error('Page fetch unavailable: chrome.runtime is not accessible')
  }

  return await enqueuePageFetch(
    () =>
      new Promise((resolve, reject) => {
        let settled = false
        const timeoutId = globalThis.setTimeout(() => {
          if (settled) return
          settled = true
          reject(new Error(`Page fetch timeout after ${PAGE_FETCH_TIMEOUT_MS}ms`))
        }, PAGE_FETCH_TIMEOUT_MS)

        const finish = (fn: () => void) => {
          if (settled) return
          settled = true
          globalThis.clearTimeout(timeoutId)
          fn()
        }

        try {
          chromeAPI.runtime.sendMessage(
            {
              type: 'PAGE_FETCH',
              options: {
                url,
                method: options?.method || 'GET',
                headers: options?.headers,
                body: options?.body,
                responseType
              }
            },
            (resp: PageFetchResponse<T>) => {
              const runtimeError = chromeAPI.runtime?.lastError
              if (runtimeError) {
                finish(() => reject(new Error(runtimeError.message || 'Page fetch runtime error')))
                return
              }

              if (resp?.success && resp.data) {
                const normalizedData = toBlobIfNeeded(resp.data.data, responseType) as T | null
                finish(() =>
                  resolve({
                    status: resp.data?.status || 200,
                    ok: resp.data?.ok !== false,
                    data: normalizedData ?? resp.data?.data ?? null
                  })
                )
                return
              }

              finish(() =>
                reject(
                  new Error(resp?.error || `Page fetch failed: ${resp?.data?.status || 'unknown'}`)
                )
              )
            }
          )
        } catch (error) {
          finish(() =>
            reject(
              error instanceof Error ? error : new Error(error ? String(error) : 'Unknown error')
            )
          )
        }
      })
  )
}

// Extract data from API response (handles nesting)
export function extractData(result: any): any {
  if (!result) return null
  if (result.data && typeof result.data === 'object') {
    if (result.data.data && typeof result.data.data === 'object') {
      return result.data.data
    }
    return result.data
  }
  return result
}

// Generate unique ID
export function generateId(): string {
  return `tab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

// Get avatar URL
export function getAvatarUrl(template: string, baseUrl: string, size = 45): string {
  if (!template) return ''
  const url = template.replace('{size}', String(size))
  const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url}`
  if (fullUrl.includes('/user_avatar/')) {
    return fullUrl.replace(/\.(png|jpg|jpeg|webp)(\?.*)?$/i, '.gif$2')
  }
  return fullUrl
}

// Format time
export function formatTime(dateStr: string): string {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 60) return `${minutes} 分钟前`
  if (hours < 24) return `${hours} 小时前`
  if (days < 30) return `${days} 天前`
  return date.toLocaleDateString('zh-CN')
}

// Parse post content, extract images for preview
// Skip images inside onebox, emoji, and other special containers
export { parsePostContent }
