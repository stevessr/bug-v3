import { getChromeAPI } from '../utils/main'

export type DiscourseBrowseStrategy = 'latest' | 'new' | 'unread' | 'top'

export interface DiscourseRequestOptions {
  csrf?: boolean
  retries?: number
  timeoutMs?: number
}

export interface DiscoursePostLikeState {
  current_user_reaction?: unknown
  actions_summary?: Array<{ id?: number; acted?: boolean }>
}

export interface DiscourseTopicWindowOptions {
  includeRaw?: boolean
  maxPosts?: number
  postOffset?: number
}

export interface DiscourseTopicWindow {
  topic: any
  posts: any[]
  stream: number[]
  offset: number
  windowSize: number
  truncated: boolean
  hasMore: boolean
  hasPrevious: boolean
  nextOffset: number | null
  previousOffset: number | null
}

const DEFAULT_DISCOURSE_BASE_URL = 'https://linux.do'
const DEFAULT_TIMEOUT_MS = 15000
const DEFAULT_RETRIES = 2
const POST_BATCH_SIZE = 20
const POST_BATCH_CONCURRENCY = 3
const CSRF_CACHE_TTL_MS = 5 * 60 * 1000

const csrfCache = new Map<string, { token: string; expiresAt: number }>()

export class DiscourseHttpError extends Error {
  status: number
  url: string
  method: string
  details?: unknown

  constructor(message: string, status: number, url: string, method: string, details?: unknown) {
    super(message)
    this.name = 'DiscourseHttpError'
    this.status = status
    this.url = url
    this.method = method
    this.details = details
  }
}

export function normalizeDiscourseBaseUrl(input?: string): string {
  const raw = String(input || DEFAULT_DISCOURSE_BASE_URL).trim()
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    throw new Error(`无效的 Discourse 站点 URL：${raw}`)
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`不支持的 Discourse URL 协议：${parsed.protocol}`)
  }
  if (parsed.username || parsed.password) {
    throw new Error('Discourse baseUrl 不允许包含用户名或密码')
  }

  parsed.search = ''
  parsed.hash = ''
  parsed.pathname = parsed.pathname.replace(/\/+$/, '')
  return parsed.toString().replace(/\/$/, '')
}

function buildDiscourseUrl(baseUrl: string, path: string): string {
  const base = normalizeDiscourseBaseUrl(baseUrl)
  if (/^https?:\/\//i.test(path)) {
    const target = new URL(path)
    const baseOrigin = new URL(base).origin
    if (target.origin !== baseOrigin) {
      throw new Error('Discourse 请求不允许跨 baseUrl origin 跳转')
    }
    return target.toString()
  }
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function retryDelayMs(response: Response, attempt: number): number {
  const retryAfter = response.headers.get('Retry-After')
  if (retryAfter) {
    const seconds = Number(retryAfter)
    if (Number.isFinite(seconds)) return Math.min(Math.max(seconds * 1000, 0), 10000)

    const dateMs = Date.parse(retryAfter)
    if (Number.isFinite(dateMs)) return Math.min(Math.max(dateMs - Date.now(), 0), 10000)
  }
  return Math.min(500 * 2 ** attempt, 4000)
}

async function releaseResponse(response: Response): Promise<void> {
  try {
    await response.body?.cancel()
  } catch {
    // Best-effort only; retrying should not fail because a body cannot be cancelled.
  }
}

async function readResponseDetails(response: Response): Promise<unknown> {
  try {
    const text = await response.text()
    if (!text) return undefined
    try {
      return JSON.parse(text)
    } catch {
      return text.slice(0, 1000)
    }
  } catch {
    return undefined
  }
}

function extractErrorMessage(details: unknown): string | undefined {
  if (!details) return undefined
  if (typeof details === 'string') return details
  if (typeof details === 'object') {
    const value = details as Record<string, unknown>
    if (Array.isArray(value.errors) && value.errors.length > 0) {
      return value.errors.map(String).join(', ')
    }
    if (typeof value.error === 'string') return value.error
    if (typeof value.message === 'string') return value.message
  }
  return undefined
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`Discourse 请求超时（${timeoutMs}ms）：${url}`)
    }
    throw error
  } finally {
    clearTimeout(timer)
  }
}

async function getCsrfTokenFallback(baseUrl: string): Promise<string> {
  const chromeAPI = getChromeAPI()
  if (!chromeAPI) return ''

  const parsed = new URL(normalizeDiscourseBaseUrl(baseUrl))
  try {
    if (chromeAPI.cookies?.getAll) {
      const cookies = await chromeAPI.cookies.getAll({ domain: parsed.hostname })
      const tokenCookie = cookies.find((cookie: any) =>
        ['csrf_token', 'XSRF-TOKEN', '_csrf'].includes(cookie.name)
      )
      if (tokenCookie?.value) return tokenCookie.value
    }
  } catch {
    // Best-effort fallback only.
  }

  try {
    if (chromeAPI.tabs?.query) {
      const tabs = await chromeAPI.tabs.query({ url: `${parsed.origin}/*` })
      for (const tab of tabs) {
        if (!tab.id) continue
        try {
          const response = await chromeAPI.tabs.sendMessage(tab.id, { type: 'GET_CSRF_TOKEN' })
          if (response?.csrfToken) return String(response.csrfToken)
        } catch {
          // Try the next matching tab.
        }
      }
    }
  } catch {
    // Best-effort fallback only.
  }

  return ''
}

export async function getDiscourseCsrfToken(
  baseUrl: string,
  forceRefresh = false
): Promise<string> {
  const normalized = normalizeDiscourseBaseUrl(baseUrl)
  const cached = csrfCache.get(normalized)
  if (!forceRefresh && cached && cached.expiresAt > Date.now()) return cached.token

  try {
    const response = await fetchWithTimeout(
      buildDiscourseUrl(normalized, '/session/csrf.json'),
      {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        }
      },
      DEFAULT_TIMEOUT_MS
    )

    if (response.ok) {
      const data = (await response.json().catch(() => null)) as { csrf?: unknown } | null
      if (typeof data?.csrf === 'string' && data.csrf) {
        csrfCache.set(normalized, {
          token: data.csrf,
          expiresAt: Date.now() + CSRF_CACHE_TTL_MS
        })
        return data.csrf
      }
    }
  } catch {
    // Fall through to legacy extraction paths below.
  }

  const fallback = await getCsrfTokenFallback(normalized)
  if (fallback) {
    csrfCache.set(normalized, {
      token: fallback,
      expiresAt: Date.now() + Math.min(CSRF_CACHE_TTL_MS, 60_000)
    })
  }
  return fallback
}

export async function discourseRequest<T = any>(
  baseUrl: string,
  path: string,
  init: RequestInit = {},
  options: DiscourseRequestOptions = {}
): Promise<T> {
  const normalized = normalizeDiscourseBaseUrl(baseUrl)
  const url = buildDiscourseUrl(normalized, path)
  const method = String(init.method || 'GET').toUpperCase()
  const timeoutMs = Math.max(1000, Number(options.timeoutMs || DEFAULT_TIMEOUT_MS))
  const retries =
    method === 'GET' || method === 'HEAD' ? Math.max(0, options.retries ?? DEFAULT_RETRIES) : 0

  const perform = async (forceCsrfRefresh = false): Promise<Response> => {
    const headers = new Headers(init.headers || {})
    if (!headers.has('Accept')) headers.set('Accept', 'application/json')
    if (options.csrf) {
      const csrfToken = await getDiscourseCsrfToken(normalized, forceCsrfRefresh)
      if (csrfToken) headers.set('X-CSRF-Token', csrfToken)
      headers.set('X-Requested-With', 'XMLHttpRequest')
      headers.set('Discourse-Logged-In', 'true')
    }

    return fetchWithTimeout(
      url,
      {
        ...init,
        credentials: 'include',
        headers
      },
      timeoutMs
    )
  }

  let response: Response | undefined
  let lastError: unknown

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      response = await perform(false)
      if (response.ok) break

      const retryable = response.status === 408 || response.status === 429 || response.status >= 500
      if (!retryable || attempt >= retries) break
      const delayMs = retryDelayMs(response, attempt)
      await releaseResponse(response)
      await sleep(delayMs)
    } catch (error) {
      lastError = error
      if (attempt >= retries) throw error
      await sleep(Math.min(500 * 2 ** attempt, 4000))
    }
  }

  if (!response) {
    throw lastError instanceof Error ? lastError : new Error('Discourse 请求失败')
  }

  if (!response.ok && options.csrf && response.status === 403) {
    csrfCache.delete(normalized)
    await releaseResponse(response)
    response = await perform(true)
  }

  if (!response.ok) {
    const details = await readResponseDetails(response)
    const serverMessage = extractErrorMessage(details)
    const message = serverMessage
      ? `${method} ${new URL(url).pathname} 失败：HTTP ${response.status} - ${serverMessage}`
      : `${method} ${new URL(url).pathname} 失败：HTTP ${response.status}`
    throw new DiscourseHttpError(message, response.status, url, method, details)
  }

  if (response.status === 204) return undefined as T
  const text = await response.text()
  if (!text) return undefined as T
  try {
    return JSON.parse(text) as T
  } catch {
    return text as T
  }
}

export function isDiscoursePostLiked(post: DiscoursePostLikeState | null | undefined): boolean {
  if (post?.current_user_reaction) return true
  if (Array.isArray(post?.actions_summary)) {
    const likeAction = post.actions_summary.find(action => action.id === 2)
    if (likeAction?.acted) return true
  }
  return false
}

export function mapDiscoursePost(post: any, includeRaw = false) {
  return {
    id: post.id,
    topic_id: post.topic_id,
    post_number: post.post_number,
    username: post.username,
    name: post.name,
    created_at: post.created_at,
    updated_at: post.updated_at,
    cooked: post.cooked,
    raw: includeRaw ? post.raw : undefined,
    reply_to_post_number: post.reply_to_post_number,
    reads: post.reads,
    score: post.score,
    yours: post.yours,
    hidden: post.hidden,
    trust_level: post.trust_level,
    avatar_template: post.avatar_template,
    bookmark_id: post.bookmark_id,
    liked: isDiscoursePostLiked(post)
  }
}

export async function fetchDiscoursePost(baseUrl: string, postId: number): Promise<any> {
  if (!Number.isFinite(postId) || postId <= 0) throw new Error('无效 postId')
  return discourseRequest(baseUrl, `/posts/${postId}.json`)
}

export async function fetchDiscourseTopic(
  baseUrl: string,
  topicId: number,
  includeRaw = false
): Promise<any> {
  if (!Number.isFinite(topicId) || topicId <= 0) throw new Error('无效 topicId')
  const query = includeRaw ? '?include_raw=1' : ''
  return discourseRequest(baseUrl, `/t/${topicId}.json${query}`)
}

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size))
  }
  return result
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  worker: (value: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(values.length)
  let cursor = 0

  const runners = Array.from(
    { length: Math.min(Math.max(concurrency, 1), values.length) },
    async () => {
      while (true) {
        const index = cursor++
        if (index >= values.length) return
        results[index] = await worker(values[index], index)
      }
    }
  )

  await Promise.all(runners)
  return results
}

export async function fetchDiscourseTopicPostsByIds(
  baseUrl: string,
  topicId: number,
  postIds: number[],
  includeRaw = false
): Promise<any[]> {
  const uniqueIds = [...new Set(postIds.map(Number).filter(id => Number.isFinite(id) && id > 0))]
  if (uniqueIds.length === 0) return []

  const batches = chunk(uniqueIds, POST_BATCH_SIZE)
  const responses = await mapWithConcurrency(batches, POST_BATCH_CONCURRENCY, async ids => {
    const params = new URLSearchParams()
    ids.forEach(id => params.append('post_ids[]', String(id)))
    if (includeRaw) params.set('include_raw', '1')
    const data = await discourseRequest<any>(
      baseUrl,
      `/t/${topicId}/posts.json?${params.toString()}`
    )
    return Array.isArray(data?.post_stream?.posts) ? data.post_stream.posts : []
  })

  const posts = responses.flat()
  const byId = new Map<number, any>(
    posts.map((post: any) => [Number(post.id), post] as [number, any])
  )
  return uniqueIds.map(id => byId.get(id)).filter(Boolean)
}

export async function fetchDiscourseTopicWithPosts(
  baseUrl: string,
  topicId: number,
  options: DiscourseTopicWindowOptions = {}
): Promise<DiscourseTopicWindow> {
  const includeRaw = Boolean(options.includeRaw)
  const parsedMaxPosts = Number(options.maxPosts ?? 200)
  const maxPosts = Number.isFinite(parsedMaxPosts)
    ? Math.max(1, Math.min(Math.floor(parsedMaxPosts), 2000))
    : 200
  const parsedOffset = Number(options.postOffset ?? 0)
  const postOffset = Number.isFinite(parsedOffset)
    ? Math.max(0, Math.min(Math.floor(parsedOffset), 1_000_000))
    : 0

  const topic = await fetchDiscourseTopic(baseUrl, topicId, includeRaw)
  const initialPosts = Array.isArray(topic?.post_stream?.posts) ? topic.post_stream.posts : []
  const stream = Array.isArray(topic?.post_stream?.stream)
    ? topic.post_stream.stream.map(Number).filter((id: number) => Number.isFinite(id) && id > 0)
    : initialPosts.map((post: any) => Number(post.id)).filter(Boolean)

  const selectedStream = stream.slice(postOffset, postOffset + maxPosts)
  const initialById = new Map<number, any>(
    initialPosts.map((post: any) => [Number(post.id), post] as [number, any])
  )
  const missingIds = selectedStream.filter((id: number) => !initialById.has(id))
  const fetched = await fetchDiscourseTopicPostsByIds(baseUrl, topicId, missingIds, includeRaw)
  const allById = new Map<number, any>(initialById)
  fetched.forEach(post => allById.set(Number(post.id), post))

  const posts = selectedStream.map((id: number) => allById.get(id)).filter(Boolean)
  if (postOffset === 0 && posts.length === 0 && initialPosts.length > 0) {
    posts.push(...initialPosts.slice(0, maxPosts))
  }

  const effectiveWindowSize = selectedStream.length || posts.length
  const knownTotal = Math.max(stream.length, Number(topic?.posts_count || 0))
  const hasPrevious = postOffset > 0
  const hasMore = postOffset + effectiveWindowSize < knownTotal
  const nextOffset = hasMore ? postOffset + effectiveWindowSize : null
  const previousOffset = hasPrevious ? Math.max(0, postOffset - maxPosts) : null

  return {
    topic,
    posts,
    stream,
    offset: postOffset,
    windowSize: effectiveWindowSize,
    truncated: hasPrevious || hasMore,
    hasMore,
    hasPrevious,
    nextOffset,
    previousOffset
  }
}

export async function fetchDiscourseTopicList(
  baseUrl: string,
  strategy: DiscourseBrowseStrategy = 'latest',
  page = 0
): Promise<any> {
  const endpoints: Record<DiscourseBrowseStrategy, string> = {
    latest: '/latest.json',
    new: '/new.json',
    unread: '/unread.json',
    top: '/top.json'
  }
  const safeStrategy = strategy in endpoints ? strategy : 'latest'
  const params = new URLSearchParams()
  if (page > 0) params.set('page', String(Math.floor(page)))
  const suffix = params.size > 0 ? `?${params.toString()}` : ''
  return discourseRequest(baseUrl, `${endpoints[safeStrategy]}${suffix}`)
}

export async function sendDiscourseTimings(
  baseUrl: string,
  topicId: number,
  postNumbers: number[],
  timeMs: number
): Promise<boolean> {
  const safeTimeMs = Math.max(1000, Math.min(Number(timeMs || 10000), 30 * 60 * 1000))
  const uniqueNumbers = [
    ...new Set(postNumbers.map(Number).filter(n => Number.isFinite(n) && n > 0))
  ]
  const timings: Record<string, number> = {}
  uniqueNumbers.forEach(postNumber => {
    timings[String(postNumber)] = safeTimeMs
  })

  await discourseRequest(
    baseUrl,
    '/topics/timings',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        topic_id: String(topicId),
        topic_time: String(safeTimeMs),
        timings: JSON.stringify(timings)
      }).toString()
    },
    { csrf: true }
  )
  return true
}

export async function toggleDiscourseReaction(
  baseUrl: string,
  postId: number,
  reactionId = 'heart'
): Promise<any> {
  const safeReaction = String(reactionId || 'heart').trim() || 'heart'
  return discourseRequest(
    baseUrl,
    `/discourse-reactions/posts/${postId}/custom-reactions/${encodeURIComponent(safeReaction)}/toggle.json`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' }
    },
    { csrf: true }
  )
}

async function createCoreDiscourseLike(baseUrl: string, postId: number): Promise<any> {
  return discourseRequest(
    baseUrl,
    '/post_actions',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        id: String(postId),
        post_action_type_id: '2',
        flag_topic: 'false'
      }).toString()
    },
    { csrf: true }
  )
}

async function deleteCoreDiscourseLike(baseUrl: string, postId: number): Promise<any> {
  return discourseRequest(
    baseUrl,
    `/post_actions/${postId}`,
    {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ post_action_type_id: '2' }).toString()
    },
    { csrf: true }
  )
}

export async function ensureDiscoursePostLiked(
  baseUrl: string,
  postId: number,
  reactionId = 'heart'
): Promise<{
  liked: true
  alreadyLiked: boolean
  data?: any
  post: any
  mode?: 'reaction' | 'core'
}> {
  const post = await fetchDiscoursePost(baseUrl, postId)
  if (isDiscoursePostLiked(post)) {
    return { liked: true, alreadyLiked: true, post }
  }

  try {
    const data = await toggleDiscourseReaction(baseUrl, postId, reactionId)
    return { liked: true, alreadyLiked: false, data, post, mode: 'reaction' }
  } catch (error) {
    if (!(error instanceof DiscourseHttpError) || ![404, 405].includes(error.status)) {
      throw error
    }
    const data = await createCoreDiscourseLike(baseUrl, postId)
    return { liked: true, alreadyLiked: false, data, post, mode: 'core' }
  }
}

export async function ensureDiscoursePostUnliked(
  baseUrl: string,
  postId: number,
  reactionId = 'heart'
): Promise<{
  liked: false
  alreadyUnliked: boolean
  data?: any
  post: any
  mode?: 'reaction' | 'core'
}> {
  const post = await fetchDiscoursePost(baseUrl, postId)
  if (!isDiscoursePostLiked(post)) {
    return { liked: false, alreadyUnliked: true, post }
  }

  try {
    const data = await toggleDiscourseReaction(baseUrl, postId, reactionId)
    return { liked: false, alreadyUnliked: false, data, post, mode: 'reaction' }
  } catch (error) {
    if (!(error instanceof DiscourseHttpError) || ![404, 405].includes(error.status)) {
      throw error
    }
    const data = await deleteCoreDiscourseLike(baseUrl, postId)
    return { liked: false, alreadyUnliked: false, data, post, mode: 'core' }
  }
}
