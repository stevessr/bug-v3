export const REACTIONS = [
  { id: 'heart', name: '❤️ Heart', emoji: '❤️' },
  { id: '+1', name: '👍 +1', emoji: '👍' },
  { id: 'laughing', name: '😆 Laughing', emoji: '😆' },
  { id: 'open_mouth', name: '😮 Open Mouth', emoji: '😮' },
  { id: 'clap', name: '👏 Clap', emoji: '👏' },
  { id: 'confetti_ball', name: '🎊 Confetti Ball', emoji: '🎊' },
  { id: 'hugs', name: '🤗 Hugs', emoji: '🤗' },
  { id: 'distorted_face', name: '🫪 Distorted Face', emoji: '🫪' },
  { id: 'tieba_087', name: '🎭 Tieba 087', emoji: '🎭' },
  { id: 'bili_057', name: '📺 Bili 057', emoji: '📺' }
]

const HOST = 'https://linux.do'

// Delay constants
const DELAY_MS = 2000

// Allowed categories (from userscript)
const ALLOWED_CATEGORIES = new Set([
  // Development
  4, 20, 31, 88,
  // Domestic
  98, 99, 100, 101,
  // Resources
  14, 83, 84, 85,
  // Docs
  42, 75, 76, 77,
  // Jobs
  27, 72, 73, 74,
  // Reading
  32, 69, 70, 71,
  // News
  34, 78, 79, 80,
  // Welfare
  36, 60, 61, 62,
  // Daily
  11, 35, 89, 21,
  // Incubator
  102, 103, 104, 105,
  // Operations
  2, 30, 49, 63, 64, 65
])

export interface LinuxDoPost {
  id: number
  title: string
  excerpt: string
  categoryId?: number
  topicId?: number
}

// Get CSRF Token
async function getCsrfToken(): Promise<string | null> {
  try {
    // Method 1: Ask background (which checks tabs)
    const auth = await new Promise<any>(resolve => {
      chrome.runtime.sendMessage({ type: 'REQUEST_LINUX_DO_AUTH' }, resolve)
    })

    if (auth && auth.csrfToken) {
      return auth.csrfToken
    }

    // Method 2: Fetch homepage directly
    const res = await fetch(`${HOST}/`, {
      headers: { 'User-Agent': navigator.userAgent }
    })
    const html = await res.text()
    const match = html.match(/<meta name="csrf-token" content="([^"]+)"/)
    return match ? match[1] : null
  } catch (e) {
    console.error('Failed to get CSRF token', e)
    return null
  }
}

// Fetch user posts
export async function fetchUserActions(
  username: string,
  count: number,
  onLog?: (msg: string) => void
): Promise<LinuxDoPost[]> {
  const results: LinuxDoPost[] = []
  let offset = 0

  if (onLog) onLog(`Fetching data for ${username}...`)

  while (results.length < count) {
    // filter=4,5 (topics/replies)
    const url = `${HOST}/user_actions.json?offset=${offset}&username=${username}&filter=4,5`

    try {
      const res = await fetch(url, { credentials: 'include' })
      if (!res.ok) {
        if (onLog) onLog(`Fetch failed: ${res.status}`)
        break
      }
      const data = await res.json()

      if (!data.user_actions || data.user_actions.length === 0) {
        if (onLog) onLog('No more data found.')
        break
      }

      for (const item of data.user_actions) {
        if (results.length >= count) break

        if (item.category_id && !ALLOWED_CATEGORIES.has(item.category_id)) {
          continue
        }

        if (!results.find(r => r.id === item.post_id)) {
          results.push({
            id: item.post_id,
            title: item.title,
            excerpt: item.excerpt ? item.excerpt.substring(0, 50) + '...' : '(No preview)',
            categoryId: item.category_id,
            topicId: item.topic_id
          })
        }
      }

      offset += 30
      await new Promise(r => setTimeout(r, 500))
    } catch (e: any) {
      if (onLog) onLog(`Error: ${e.message}`)
      break
    }
  }

  return results
}

// Check if already reacted
async function isAlreadyReacted(postId: number, reactionId: string): Promise<boolean> {
  try {
    const url = `${HOST}/posts/${postId}.json`
    const res = await fetch(url, { credentials: 'include' })
    if (!res.ok) return false

    const data = await res.json()
    // Normalize logic
    const postData = data.post || data

    const currentReactions: string[] = []

    // Check current_user_reaction (single object or ID)
    if (postData.current_user_reaction) {
      const r = postData.current_user_reaction
      currentReactions.push(typeof r === 'object' && r.id ? r.id : r)
    }

    // Check current_user_reactions (array)
    if (Array.isArray(postData.current_user_reactions)) {
      postData.current_user_reactions.forEach((r: any) => {
        if (r) currentReactions.push(typeof r === 'object' && r.id ? r.id : r)
      })
    }

    // Check reactions dictionary/array
    if (postData.reactions) {
      if (Array.isArray(postData.reactions)) {
        postData.reactions.forEach((r: any) => {
          if (r && r.reacted && r.id) currentReactions.push(r.id)
        })
      } else if (typeof postData.reactions === 'object') {
        Object.values(postData.reactions).forEach((r: any) => {
          if (r && r.reacted && r.id) currentReactions.push(r.id)
        })
      }
    }

    return currentReactions.includes(reactionId)
  } catch {
    return false
  }
}

// Send reaction
export async function sendReactionToPost(
  postId: number,
  reactionId: string,
  csrfToken: string
): Promise<'success' | 'skipped' | 'rate_limit' | 'failed'> {
  // Check if already reacted
  if (await isAlreadyReacted(postId, reactionId)) {
    return 'skipped'
  }

  const url = `${HOST}/discourse-reactions/posts/${postId}/custom-reactions/${reactionId}/toggle.json`

  try {
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        'X-Csrf-Token': csrfToken,
        'X-Requested-With': 'XMLHttpRequest',
        'Content-Type': 'application/json',
        'Discourse-Logged-In': 'true'
      },
      credentials: 'include'
    })

    if (res.status === 200) {
      return 'success'
    } else if (res.status === 429) {
      return 'rate_limit'
    } else {
      return 'failed'
    }
  } catch (e) {
    console.error(e)
    return 'failed'
  }
}

// Check Daily Limit
export interface DailyLimitInfo {
  limit: number
  used: number
  remaining: number
  cooldownUntil?: number
  username: string
}

export async function checkDailyLimit(): Promise<DailyLimitInfo | null> {
  try {
    // 1. Get Current User & Trust Level
    const sessionRes = await fetch(`${HOST}/session/current.json`, { credentials: 'include' })
    if (!sessionRes.ok) return null
    const sessionData = await sessionRes.json()
    const user = sessionData.current_user
    if (!user) return null

    const trustLevel = user.trust_level
    const username = user.username

    const LIMITS: Record<number, number> = { 0: 50, 1: 50, 2: 75, 3: 100, 4: 150 }
    const limit = LIMITS[trustLevel] || 50

    // 2. Count today's actions
    let used = 0
    const cutoff = Date.now() - 24 * 60 * 60 * 1000

    // Fetch Likes (Action 1)
    // Fetch up to 2 pages to be safe
    const fetchLikes = async () => {
      let offset = 0
      let count = 0
      for (let i = 0; i < 3; i++) {
        const res = await fetch(
          `${HOST}/user_actions.json?limit=50&username=${username}&filter=1&offset=${offset}`,
          { credentials: 'include' }
        )
        const data = await res.json()
        const actions = data.user_actions || []
        if (!actions.length) break

        let hasOld = false
        for (const act of actions) {
          const t = new Date(act.created_at).getTime()
          if (t > cutoff) count++
          else hasOld = true
        }
        if (hasOld || actions.length < 50) break
        offset += 50
      }
      return count
    }

    // Fetch Reactions
    const fetchReactions = async () => {
      let count = 0
      let beforeId = null
      for (let i = 0; i < 3; i++) {
        let url = `${HOST}/discourse-reactions/posts/reactions.json?username=${username}`
        if (beforeId) url += `&before_reaction_user_id=${beforeId}`

        const res = await fetch(url, { credentials: 'include' })
        const data = await res.json()
        if (!Array.isArray(data) || !data.length) break

        let hasOld = false
        for (const r of data) {
          const t = new Date(r.created_at).getTime()
          if (t > cutoff) count++
          else hasOld = true
        }
        beforeId = data[data.length - 1].id
        if (hasOld || data.length < 20) break
      }
      return count
    }

    const [likesCount, reactionsCount] = await Promise.all([fetchLikes(), fetchReactions()])
    used = likesCount + reactionsCount

    return {
      limit,
      used,
      remaining: Math.max(0, limit - used),
      username
    }
  } catch (e) {
    console.error('Failed to check daily limit', e)
    return null
  }
}

// Main execution function
function formatPostStatus(post: LinuxDoPost): string {
  const title = post.title || '(No title)'
  const excerpt = post.excerpt || ''
  return `${title}\n${excerpt}`
}

export async function runBatchReaction(
  username: string,
  count: number,
  reactionId: string,
  onProgress: (current: number, total: number, status: string) => void
) {
  const csrfToken = await getCsrfToken()
  if (!csrfToken) {
    onProgress(0, 0, 'Error: Failed to get CSRF Token')
    return
  }

  onProgress(0, count, `Fetching posts for ${username}...`)
  const posts = await fetchUserActions(username, count, msg => {
    onProgress(0, count, msg)
  })

  if (posts.length === 0) {
    onProgress(0, 0, 'No posts found.')
    return
  }

  onProgress(0, posts.length, `Pre-checking already reacted posts...`)

  const targets: LinuxDoPost[] = []
  for (let i = 0; i < posts.length; i++) {
    const post = posts[i]
    try {
      const reacted = await isAlreadyReacted(post.id, reactionId)
      if (!reacted) {
        targets.push(post)
      }
    } catch {
      targets.push(post)
    }
    onProgress(0, posts.length, `Pre-check ${i + 1}/${posts.length}`)
    await new Promise(r => setTimeout(r, 200))
  }

  if (targets.length === 0) {
    onProgress(0, 0, 'No posts to react (already reacted).')
    return
  }

  onProgress(0, targets.length, `Starting reactions...`)

  let successCount = 0
  let total = targets.length
  let current = 0

  for (let i = 0; i < targets.length; i++) {
    const post = targets[i]

    const result = await sendReactionToPost(post.id, reactionId, csrfToken)

    if (result === 'success') {
      current++
      successCount++
      onProgress(current, total, `✅ ${current}/${total}\n${formatPostStatus(post)}`)
      await new Promise(r => setTimeout(r, DELAY_MS))
    } else if (result === 'skipped') {
      total = Math.max(0, total - 1)
      await new Promise(r => setTimeout(r, 100))
    } else if (result === 'rate_limit') {
      current++
      onProgress(
        current,
        total,
        `⏳ ${current}/${total} Rate limited, waiting 5s...\n${formatPostStatus(post)}`
      )
      await new Promise(r => setTimeout(r, 5000))
    } else {
      current++
      onProgress(current, total, `⚠️ ${current}/${total} Failed\n${formatPostStatus(post)}`)
      await new Promise(r => setTimeout(r, DELAY_MS))
    }
  }

  onProgress(total, total, `Done! Success: ${successCount}/${total}`)
}
