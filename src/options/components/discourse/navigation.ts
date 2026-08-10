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

export type DiscourseAddressResolution = {
  url: string
  origin: string
  kind: 'navigation' | 'search'
}

export function resolveDiscourseHttpUrl(input: string, baseUrl: string): string | null {
  const value = (input || '').trim()
  if (!value) return null

  try {
    const base = assertHttpUrl(new URL(baseUrl))
    return assertHttpUrl(new URL(value, `${base.origin}/`)).toString()
  } catch {
    return null
  }
}

export function resolveDiscourseAddressInput(
  input: string,
  baseUrl: string
): DiscourseAddressResolution {
  const base = assertHttpUrl(new URL(baseUrl))
  const value = (input || '').trim()

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

export function categoryRouteFromPath(pathname: string): {
  slug: string
  categoryId: number | null
} | null {
  const normalized = normalizePathname(pathname)
  if (!normalized.startsWith('/c/')) return null

  const segments = normalized.slice(3).split('/').filter(Boolean).map(decodePathSegment)
  if (segments.length === 0) return null

  const idIndex = segments.findIndex(segment => /^\d+$/.test(segment) && Number(segment) > 0)
  const categoryId = idIndex >= 0 ? Number(segments[idIndex]) : null
  const slugSegments = idIndex >= 0 ? segments.slice(0, idIndex) : segments
  const slug = slugSegments.join('/').trim()
  if (!slug) return null

  return { slug, categoryId }
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
