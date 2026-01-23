import { CONFIG } from './config'
import { state } from './state'
import { log } from './ui'

// --- 网络请求 (使用 fetch 代替 GM_xmlhttpRequest) ---
type LinuxDoAuth = { cookies: string; csrfToken: string }

let cachedAuth: { data: LinuxDoAuth; fetchedAt: number } | null = null
const AUTH_CACHE_TTL_MS = 60 * 1000

function getCsrfFromPage(): string {
  const metaToken = document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement | null
  if (metaToken?.content) return metaToken.content

  const match = document.cookie.match(/csrf_token=([^;]+)/)
  if (match) return decodeURIComponent(match[1])

  const hiddenInput = document.querySelector(
    'input[name="authenticity_token"]'
  ) as HTMLInputElement | null
  if (hiddenInput?.value) return hiddenInput.value

  return ''
}

async function getLinuxDoAuth(): Promise<LinuxDoAuth> {
  if (cachedAuth && Date.now() - cachedAuth.fetchedAt < AUTH_CACHE_TTL_MS) {
    return cachedAuth.data
  }

  const fallback: LinuxDoAuth = {
    cookies: document.cookie || '',
    csrfToken: getCsrfFromPage()
  }

  try {
    const chromeAPI = (window as any).chrome
    if (chromeAPI?.runtime?.sendMessage) {
      const data = await new Promise<LinuxDoAuth>(resolve => {
        chromeAPI.runtime.sendMessage({ type: 'REQUEST_LINUX_DO_AUTH' }, (resp: any) => {
          if (resp?.success) {
            resolve({
              cookies: resp.cookies || '',
              csrfToken: resp.csrfToken || ''
            })
          } else {
            resolve(fallback)
          }
        })
      })

      cachedAuth = { data, fetchedAt: Date.now() }
      return data
    }
  } catch {
    // fall back to page-derived cookies/token
  }

  cachedAuth = { data: fallback, fetchedAt: Date.now() }
  return fallback
}

export async function safeFetch(url: string): Promise<any> {
  const auth = await getLinuxDoAuth()
  const headers: Record<string, string> = {
    Accept: 'application/json, text/javascript, */*; q=0.01',
    'X-Requested-With': 'XMLHttpRequest',
    'Discourse-Logged-In': 'true',
    'Discourse-Present': 'true',
    'Discourse-Track-View': 'true'
  }

  if (auth.csrfToken) headers['X-Csrf-Token'] = auth.csrfToken
  if (auth.cookies) headers['Cookie'] = auth.cookies
  if (navigator?.language) headers['Accept-Language'] = navigator.language

  const response = await fetch(url, {
    method: 'GET',
    headers,
    credentials: 'include',
    referrer: document?.location?.href || undefined
  })

  if (response.status >= 200 && response.status < 300) {
    return await response.json()
  } else {
    throw new Error(`Status ${response.status}`)
  }
}

function getIntervalMultiplier(lastSeenAt: string | null): number {
  const collapsedMult = state.isCollapsed ? 2 : 1
  if (!lastSeenAt) return 20 * collapsedMult
  const diff = Date.now() - new Date(lastSeenAt).getTime()
  const minutes = diff / (1000 * 60)
  if (minutes < 2) return 1 * collapsedMult
  if (minutes < 10) return 1.5 * collapsedMult
  if (minutes < 60) return 4 * collapsedMult
  if (minutes < 120) return 5 * collapsedMult
  return 20 * collapsedMult
}

export async function fetchUser(username: string, isInitial = false) {
  try {
    const profileJson = await safeFetch(`${CONFIG.HOST}/u/${username}.json`)
    if (!profileJson || !profileJson.user) return []

    const newLastSeen = profileJson.user.last_seen_at
    const newLastPosted = profileJson.user.last_posted_at
    const oldProfile = state.userProfiles[username]

    state.multipliers[username] = getIntervalMultiplier(newLastSeen)
    const hasChanged = !oldProfile || oldProfile.last_seen_at !== newLastSeen

    state.userProfiles[username] = { last_posted_at: newLastPosted, last_seen_at: newLastSeen }

    if (!isInitial && !hasChanged && state.data[username]?.length > 0) {
      log(`[${username}] dormant.`, 'info')
      return 'SKIPPED'
    }

    const [jsonActions, jsonReactions] = await Promise.all([
      safeFetch(
        `${CONFIG.HOST}/user_actions.json?offset=0&limit=${CONFIG.LOG_LIMIT_PER_USER}&username=${username}&filter=1,4,5`
      ),
      safeFetch(`${CONFIG.HOST}/discourse-reactions/posts/reactions.json?username=${username}`)
    ])

    const actions = (jsonActions.user_actions || []).map((action: any) => {
      if (action.action_type === 1) {
        return {
          ...action,
          username: action.acting_username,
          name: action.acting_name,
          user_id: action.acting_user_id,
          avatar_template: action.acting_avatar_template,
          acting_username: action.username,
          acting_name: action.name,
          acting_user_id: action.user_id,
          acting_avatar_template: action.avatar_template
        }
      }
      return action
    })

    const reactions = (jsonReactions || []).map((r: any) => ({
      id: r.id,
      post_id: r.post_id,
      created_at: r.created_at,
      username: r.user?.username || '',
      name: r.user?.name || '',
      user_id: r.user_id,
      avatar_template: r.user?.avatar_template || '',
      acting_username: r.post?.user?.username || r.post?.username || '',
      acting_name: r.post?.user?.name || r.post?.name || '',
      acting_user_id: r.post?.user_id || '',
      acting_avatar_template: r.post?.user?.avatar_template || r.post?.avatar_template || '',
      topic_id: r.post?.topic_id,
      post_number: r.post?.post_number,
      title: r.post?.topic_title || r.post?.topic?.title || '',
      excerpt: r.post?.excerpt || '',
      category_id: r.post?.category_id,
      action_type: r.reaction?.reaction_value || 'reaction',
      reaction_value: r.reaction?.reaction_value
    }))

    return [...actions, ...reactions]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, CONFIG.LOG_LIMIT_PER_USER)
  } catch (e) {
    log(`[${username}]: ${(e as Error).message}`, 'error')
    return []
  }
}
