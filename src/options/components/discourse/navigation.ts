import type {
  DiscourseNotificationFilter,
  MessagesTabType,
  TopicListPeriod,
  TopicListType
} from './types'

const TOPIC_LIST_TYPES = new Set<TopicListType>([
  'latest',
  'new',
  'unread',
  'unseen',
  'top',
  'hot',
  'posted',
  'read',
  'bookmarks'
])

const MESSAGE_FILTERS = new Set<MessagesTabType>(['all', 'sent', 'new', 'unread', 'archive'])

const TOPIC_LIST_PERIODS = new Set<TopicListPeriod>([
  'all',
  'yearly',
  'quarterly',
  'monthly',
  'weekly',
  'daily'
])

const NOTIFICATION_FILTERS = new Set<DiscourseNotificationFilter>([
  'all',
  'unread',
  'replies',
  'mentions',
  'likes',
  'messages',
  'badges',
  'other'
])

const EXPLICIT_SCHEME_RE = /^[a-z][a-z\d+.-]*:/i
const UNSAFE_SCHEME_RE = /^(?:about|blob|chrome|chrome-extension|data|file|javascript|vbscript):/i
const HOST_LIKE_RE =
  /^(?:localhost(?::\d+)?|(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?|(?:[a-z\d-]+\.)+[a-z\d-]{2,}(?::\d+)?)(?:[/?#].*)?$/i
const HTTP_URL_RE = /^https?:\/\/\S+$/i
const TITLE_URL_DELIMITER_RE = /(?:\t+|\s+[|—–-]\s+|[：:]\s*)$/
const HTML_LINK_HREF_RE =
  /^<a\b[^>]*\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>[\s\S]*<\/a>$/i

const decodePathSegment = (value: string) => {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

const normalizePathname = (pathname: string) => {
  const path = (pathname || '/').replace(/\.json$/i, '').replace(/\/+$/, '')
  return path || '/'
}

const assertHttpUrl = (url: URL) => {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('仅支持 HTTP 或 HTTPS 论坛地址')
  }
  if (url.username || url.password) {
    throw new Error('论坛地址不能包含用户名或密码')
  }
  return url
}

const FAVICON_PROXY_PATH_RE = /^\/favicon\/proxied\/?$/i

/**
 * Discourse wraps remote favicons in `/favicon/proxied?{encoded-url}`.  The
 * browser extension can request an already-public favicon directly, avoiding
 * the extra proxy hop.  Only unwrap that exact endpoint and keep the usual
 * HTTP(S)-only URL validation for the decoded target.
 */
export function unwrapDiscourseFaviconProxyUrl(input: string, baseUrl?: string): string {
  const value = (input || '').trim()
  if (!value) return ''

  try {
    const proxyUrl = baseUrl ? new URL(value, `${baseUrl.replace(/\/+$/, '')}/`) : new URL(value)
    if (!FAVICON_PROXY_PATH_RE.test(proxyUrl.pathname)) return proxyUrl.toString()

    const queryTarget = proxyUrl.searchParams.get('url') || proxyUrl.search.slice(1)
    if (!queryTarget) return proxyUrl.toString()

    const decodedTarget = decodeURIComponent(queryTarget)
    return assertHttpUrl(new URL(decodedTarget)).toString()
  } catch {
    // Preserve the original value when it is malformed or points to a
    // non-HTTP target; callers can apply their normal fallback behavior.
    return value
  }
}

export type DiscourseAddressResolution = {
  url: string
  origin: string
  kind: 'navigation' | 'search'
}

const normalizeTitleUrlCandidate = (value: string): string | null => {
  const trimmed = value.trim()
  const unwrapped =
    trimmed.startsWith('<') && trimmed.endsWith('>') ? trimmed.slice(1, -1).trim() : trimmed
  return HTTP_URL_RE.test(unwrapped) ? unwrapped : null
}

/**
 * Extract the URL from the compact title/link text emitted by some browsers,
 * share sheets, and bookmark tools.  We intentionally only accept structured
 * formats (a final standalone URL line, an exact Markdown/HTML link, or a
 * title followed by a clear delimiter) so a normal search that merely
 * mentions a URL remains a search.
 */
export function extractDiscourseTitleUrl(input: string): string | null {
  const value = (input || '').trim()
  if (!value) return null

  const htmlLink = value.match(HTML_LINK_HREF_RE)
  if (htmlLink) {
    return normalizeTitleUrlCandidate(htmlLink[1] || htmlLink[2] || htmlLink[3] || '')
  }

  if (value.startsWith('[') && value.endsWith(')')) {
    const separatorIndex = value.lastIndexOf('](')
    if (separatorIndex > 1) {
      const markdownUrl = value.slice(separatorIndex + 2, -1)
      const candidate = normalizeTitleUrlCandidate(markdownUrl)
      if (candidate) return candidate
    }
  }

  const lines = value
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
  if (lines.length >= 2) {
    const candidate = normalizeTitleUrlCandidate(lines[lines.length - 1])
    if (candidate) return candidate
  }

  const lastWhitespaceIndex = value.search(/\shttps?:\/\//i)
  if (lastWhitespaceIndex > 0) {
    const titleAndDelimiter = value.slice(0, lastWhitespaceIndex + 1)
    const candidate = normalizeTitleUrlCandidate(value.slice(lastWhitespaceIndex + 1))
    if (candidate && TITLE_URL_DELIMITER_RE.test(titleAndDelimiter)) return candidate
  }

  return null
}

export function resolveDiscourseHttpUrl(input: string, baseUrl: string): string | null {
  const value = (input || '').trim()
  if (!value) return null

  try {
    const base = assertHttpUrl(new URL(baseUrl))
    const resolved = assertHttpUrl(new URL(value, `${base.origin}/`)).toString()
    return unwrapDiscourseFaviconProxyUrl(resolved)
  } catch {
    return null
  }
}

export function resolveDiscourseAddressInput(
  input: string,
  baseUrl: string
): DiscourseAddressResolution {
  const base = assertHttpUrl(new URL(baseUrl))
  const rawValue = (input || '').trim()
  const value = extractDiscourseTitleUrl(rawValue) || rawValue

  if (!value) {
    return { url: base.origin, origin: base.origin, kind: 'navigation' }
  }

  let target: URL
  let kind: DiscourseAddressResolution['kind'] = 'navigation'

  if (value.startsWith('//')) {
    target = new URL(value, base)
  } else if (value.startsWith('/') || value.startsWith('?') || value.startsWith('#')) {
    target = new URL(value, `${base.origin}/`)
  } else if (HOST_LIKE_RE.test(value)) {
    target = new URL(`${base.protocol}//${value}`)
  } else if (/^https?:/i.test(value) || (EXPLICIT_SCHEME_RE.test(value) && value.includes('://'))) {
    target = new URL(value)
  } else if (UNSAFE_SCHEME_RE.test(value)) {
    throw new Error('仅支持 HTTP 或 HTTPS 论坛地址')
  } else {
    target = new URL('/search', base.origin)
    target.searchParams.set('q', value)
    kind = 'search'
  }

  assertHttpUrl(target)
  return { url: target.toString(), origin: target.origin, kind }
}

export type TopicListRoute = {
  type: TopicListType
  period: TopicListPeriod | null
}

export function normalizeTopicListPeriod(value: unknown): TopicListPeriod | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLocaleLowerCase() as TopicListPeriod
  return TOPIC_LIST_PERIODS.has(normalized) ? normalized : null
}

export function topicListRouteFromPath(pathname: string): TopicListRoute | null {
  const segments = normalizePathname(pathname).split('/').filter(Boolean)
  if (segments.length === 0) return null
  const candidate = segments[0].toLocaleLowerCase() as TopicListType
  if (!TOPIC_LIST_TYPES.has(candidate)) return null
  if (segments.length === 1) return { type: candidate, period: null }
  if (candidate !== 'top' || segments.length !== 2) return null

  const period = normalizeTopicListPeriod(segments[1])
  return period ? { type: candidate, period } : null
}

export function topicListTypeFromPath(pathname: string): TopicListType | null {
  return topicListRouteFromPath(pathname)?.type ?? null
}

export function buildTopicListApiUrl(
  baseUrl: string,
  type: TopicListType,
  period: TopicListPeriod | null = null,
  page?: number
): string {
  const base = assertHttpUrl(new URL(baseUrl))
  const target = new URL(`/${type}.json`, base.origin)
  if (type === 'top' && period) target.searchParams.set('period', period)
  if (typeof page === 'number' && page > 0) target.searchParams.set('page', String(page))
  return target.toString()
}

export type CategoryRoute = {
  slug: string
  categoryId: number | null
  listType: TopicListType
}

export function categoryRouteFromPath(pathname: string): CategoryRoute | null {
  const normalized = normalizePathname(pathname)
  if (!normalized.startsWith('/c/')) return null

  const segments = normalized.slice(3).split('/').filter(Boolean).map(decodePathSegment)
  if (segments.length === 0) return null

  const listIndex = segments.findIndex(
    (segment, index) => index > 0 && segment.toLocaleLowerCase() === 'l'
  )
  const categorySegments = listIndex >= 0 ? segments.slice(0, listIndex) : segments
  const listTypeSegment = listIndex >= 0 ? segments[listIndex + 1]?.toLocaleLowerCase() : 'latest'
  const listType = listTypeSegment as TopicListType

  if (!listTypeSegment || !TOPIC_LIST_TYPES.has(listType as TopicListType)) return null

  const idIndex = categorySegments.findIndex(
    segment => /^\d+$/.test(segment) && Number(segment) > 0
  )
  const categoryId = idIndex >= 0 ? Number(categorySegments[idIndex]) : null
  if (categoryId !== null && !Number.isFinite(categoryId)) return null
  const slugSegments = idIndex >= 0 ? categorySegments.slice(0, idIndex) : categorySegments
  const slug = slugSegments.join('/').trim()
  if (!slug) return null

  return { slug, categoryId, listType }
}

export function messagesTabFromPath(pathname: string): MessagesTabType {
  const segments = normalizePathname(pathname).split('/').filter(Boolean)
  if (segments[0] !== 'u') return 'all'
  const routeIndex = segments.findIndex(
    (segment, index) => index >= 2 && (segment === 'messages' || segment === 'private-messages')
  )
  if (routeIndex < 0) return 'all'
  const filter = (segments[routeIndex + 1] || 'all').toLocaleLowerCase() as MessagesTabType
  return MESSAGE_FILTERS.has(filter) ? filter : 'all'
}

export function normalizeNotificationFilter(value: unknown): DiscourseNotificationFilter {
  if (typeof value !== 'string') return 'all'
  const normalized = decodePathSegment(value).trim().toLocaleLowerCase()
  if (NOTIFICATION_FILTERS.has(normalized as DiscourseNotificationFilter)) {
    return normalized as DiscourseNotificationFilter
  }
  if (/^category:[a-z\d_-]+$/i.test(normalized)) {
    return normalized as DiscourseNotificationFilter
  }
  return 'all'
}
