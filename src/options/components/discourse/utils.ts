// Discourse Browser Utilities

type BlobPayload = {
  arrayData: number[]
  mimeType?: string
}

type PageFetchResponse<T> = {
  success: boolean
  data?: { status: number; ok: boolean; data: T }
  error?: string
}

let PAGE_FETCH_MAX_CONCURRENCY = 2
const PAGE_FETCH_TIMEOUT_MS = 30000
const pageFetchQueue: Array<() => void> = []
let pageFetchInFlight = 0

/**
 * 运行时调整单一论坛的页面抓取并发数（设置页可调，持久化由调用方负责）。
 * 取值范围 1..8，非法值回退当前值。
 */
export function setPageFetchMaxConcurrency(value: number): number {
  const parsed = Math.floor(Number(value))
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return PAGE_FETCH_MAX_CONCURRENCY
  }
  PAGE_FETCH_MAX_CONCURRENCY = Math.min(8, parsed)
  drainPageFetchQueue()
  return PAGE_FETCH_MAX_CONCURRENCY
}

export function getPageFetchMaxConcurrency(): number {
  return PAGE_FETCH_MAX_CONCURRENCY
}

export interface PageFetchActivity {
  active: number
  queued: number
  completed: number
  failed: number
  total: number
}

const pageFetchActivity: PageFetchActivity = {
  active: 0,
  queued: 0,
  completed: 0,
  failed: 0,
  total: 0
}
const pageFetchActivityListeners = new Set<(activity: PageFetchActivity) => void>()

const emitPageFetchActivity = () => {
  const snapshot = { ...pageFetchActivity }
  pageFetchActivityListeners.forEach(listener => listener(snapshot))
}

export function getPageFetchActivity(): PageFetchActivity {
  return { ...pageFetchActivity }
}

export function subscribePageFetchActivity(
  listener: (activity: PageFetchActivity) => void
): () => void {
  pageFetchActivityListeners.add(listener)
  listener(getPageFetchActivity())
  return () => pageFetchActivityListeners.delete(listener)
}

function drainPageFetchQueue() {
  while (pageFetchInFlight < PAGE_FETCH_MAX_CONCURRENCY && pageFetchQueue.length > 0) {
    const task = pageFetchQueue.shift()
    if (!task) return
    pageFetchInFlight += 1
    task()
  }
}

function enqueuePageFetch<T>(task: () => Promise<T>): Promise<T> {
  pageFetchActivity.total += 1
  pageFetchActivity.queued += 1
  emitPageFetchActivity()

  return new Promise((resolve, reject) => {
    pageFetchQueue.push(() => {
      pageFetchActivity.queued = Math.max(0, pageFetchActivity.queued - 1)
      pageFetchActivity.active += 1
      emitPageFetchActivity()

      return task()
        .then(resolve)
        .catch(error => {
          pageFetchActivity.failed += 1
          reject(error)
        })
        .finally(() => {
          pageFetchInFlight = Math.max(0, pageFetchInFlight - 1)
          pageFetchActivity.active = Math.max(0, pageFetchActivity.active - 1)
          pageFetchActivity.completed += 1
          emitPageFetchActivity()
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
  options?: {
    method?: string
    headers?: Record<string, string>
    body?: string
    passHeaders?: string[]
  },
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
                responseType,
                passHeaders: options?.passHeaders
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

// ── linux.do 头像特判 ──────────────────────────────────────────────
// linux.do 主站返回的 user_avatar 模板（形如 /user_avatar/linux.do/<user>/{size}/<hash>）
// 服务端实际由 CDN 提供。这里在客户端直接改写为 CDN 地址，
// 例如 https://linux.do/user_avatar/linux.do/stevessr/32/1589755_2.png
//   → https://cdn.ldstatic.com/user_avatar/linux.do/stevessr/96/1589755_2.png
// 从而减少对主站 linux.do 的请求。
// 仅特判 linux.do 主站自身的头像：主机必须为 linux.do 且路径形如
// /user_avatar/linux.do/...；其他站点返回的类似物（主机非 linux.do，
// 或路径首段为其他论坛名）一律保持原样。
// 尺寸段统一抬升到至少 96px（示例 32 → 96），便于 CDN 侧缓存复用。
const LINUXDO_AVATAR_CDN_HOST = 'cdn.ldstatic.com'
const LINUXDO_AVATAR_CDN_MIN_SIZE = 96

/**
 * linux.do 头像特判：把主站 user_avatar URL 直接改写为 CDN URL。
 * 不匹配特判条件的 URL 原样返回。
 */
export function rewriteAvatarUrlForCdn(url: string): string {
  try {
    const parsed = new URL(url)
    if (parsed.hostname !== 'linux.do') return url
    const segments = parsed.pathname.split('/')
    // ['', 'user_avatar', 'linux.do', '<user>', '<size>', '<hash>.<ext>']
    if (segments.length < 6 || segments[1] !== 'user_avatar' || segments[2] !== 'linux.do') {
      return url
    }
    parsed.hostname = LINUXDO_AVATAR_CDN_HOST
    const sizeInUrl = Number(segments[4])
    if (Number.isFinite(sizeInUrl) && sizeInUrl > 0) {
      segments[4] = String(Math.max(sizeInUrl, LINUXDO_AVATAR_CDN_MIN_SIZE))
      parsed.pathname = segments.join('/')
    }
    return parsed.toString()
  } catch {
    return url
  }
}

// ── linux.do 表情特判 ──────────────────────────────────────────────
// linux.do 站点表情（/images/emoji/...）直接改走 CDN，减少对主站请求。
// 个别表情在 CDN 侧使用不同的文件名（站点自定义命名 → CDN 命名）。
const LINUXDO_EMOJI_CDN_HOST = 'cdn.ldstatic.com'
const LINUXDO_EMOJI_CDN_NAME_MAP: Record<string, string> = {
  smiling_face_with_three_hearts: 'heart'
}

/**
 * linux.do 表情特判：把主站 /images/emoji/ 表情 URL 直接改写为 CDN URL，
 * 例如 https://linux.do/images/emoji/twemoji/smiling_face_with_three_hearts.png?v=15
 *   → https://cdn.ldstatic.com/images/emoji/twemoji/heart.png?v=15
 * 不匹配特判条件的 URL 原样返回（其他站点/其他路径不受影响）。
 */
export function rewriteEmojiUrlForCdn(url: string): string {
  try {
    const parsed = new URL(url)
    if (parsed.hostname !== 'linux.do') return url
    const segments = parsed.pathname.split('/')
    // ['', 'images', 'emoji', '<set>', '<name>.png']
    if (segments.length < 5 || segments[1] !== 'images' || segments[2] !== 'emoji') {
      return url
    }
    const fileName = segments[segments.length - 1] || ''
    const dotIndex = fileName.lastIndexOf('.')
    if (dotIndex > 0) {
      const baseName = fileName.slice(0, dotIndex)
      const mappedName = LINUXDO_EMOJI_CDN_NAME_MAP[baseName]
      if (mappedName) {
        segments[segments.length - 1] = `${mappedName}${fileName.slice(dotIndex)}`
      }
    }
    parsed.hostname = LINUXDO_EMOJI_CDN_HOST
    parsed.pathname = segments.join('/')
    return parsed.toString()
  } catch {
    return url
  }
}

// Get avatar URL
export function getAvatarUrl(template: string, baseUrl: string, size = 45): string {
  if (!template) return ''
  const url = template.replace('{size}', String(size))
  try {
    const base = new URL(baseUrl)
    const resolved = new URL(url, `${base.origin}/`)
    if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') return ''
    return rewriteAvatarUrlForCdn(resolved.toString())
  } catch {
    return ''
  }
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
