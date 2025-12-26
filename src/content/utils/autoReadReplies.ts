import { postTimings } from './timingsBinder'
import { notify } from './notify'
import { DQS, DQSA } from './createEl'

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function fetchPostsForTopic(topicId: number) {
  const url = `/t/${topicId}/posts.json`
  const resp = await fetch(url, { credentials: 'same-origin' })
  if (!resp.ok) throw new Error(`failed to fetch posts.json: ${resp.status}`)
  const data = await resp.json()

  // Determine posts array and totalCount
  let posts: any[] = []
  let totalCount = 0

  if (data && data.post_stream && Array.isArray(data.post_stream.posts)) {
    posts = data.post_stream.posts
    // prefer posts_count from first post if present
    if (posts.length > 0 && typeof posts[0].posts_count === 'number') {
      totalCount = posts[0].posts_count + 1 // 有个偏移，因为第一帖不算
    }
  }

  if ((!posts || posts.length === 0) && data && Array.isArray(data.posts)) {
    posts = data.posts
  }

  // fallback to other fields
  if (!totalCount) {
    if (data && typeof data.highest_post_number === 'number') totalCount = data.highest_post_number
    else if (data && typeof data.posts_count === 'number') totalCount = data.posts_count
    else if (posts && posts.length > 0) totalCount = posts.length
  }

  return { posts, totalCount }
}

function getCSRFToken(): string | null {
  try {
    const meta = document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement | null
    if (meta && meta.content) return meta.content

    const meta2 = document.querySelector('meta[name="x-csrf-token"]') as HTMLMetaElement | null
    if (meta2 && meta2.content) return meta2.content

    // window variable fallback
    const anyWin = window as any
    if (anyWin && anyWin.csrfToken) return anyWin.csrfToken
    if (anyWin && anyWin._csrf_token) return anyWin._csrf_token

    // cookie fallback (XSRF-TOKEN or _csrf)
    const m = document.cookie.match(/(?:XSRF-TOKEN|_csrf)=([^;]+)/)
    if (m && m[1]) return decodeURIComponent(m[1])
  } catch (e) {
    // ignore
  }
  return null
}

async function setNotificationLevel(topicId: number, level = 1) {
  const token = getCSRFToken()
  if (!token) {
    notify('无法获取 CSRF token，未能设置追踪等级', 'error')
    return
  }

  const url = `${location.origin}/t/${topicId}/notifications`
  const body = `notification_level=${encodeURIComponent(String(level))}`

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        accept: '*/*',
        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'x-csrf-token': token,
        'x-requested-with': 'XMLHttpRequest',
        // keep these similar to the example; they are harmless if ignored
        'discourse-logged-in': 'true',
        'discourse-present': 'true',
        priority: 'u=1, i'
      },
      body,
      mode: 'cors',
      credentials: 'include'
    })

    if (!resp.ok) {
      throw new Error(`设置追踪等级请求失败：${resp.status}`)
    }

    notify(`话题 ${topicId} 的追踪等级已设置为 ${level}`, 'rainbow')
  } catch (e: any) {
    notify('设置追踪等级失败：' + (e && e.message ? e.message : String(e)), 'error')
  }
}

async function autoReadAll(topicId?: number, startFrom = 1) {
  try {
    let tid = topicId || 0
    if (!tid) {
      const m1 = window.location.pathname.match(/t\/topic\/(\d+)/)
      const m2 = window.location.pathname.match(/t\/(\d+)/)
      if (m1 && m1[1]) tid = Number(m1[1])
      else if (m2 && m2[1]) tid = Number(m2[1])
      else {
        const el = DQS('[data-topic-id]') as HTMLElement | null
        if (el) tid = Number(el.getAttribute('data-topic-id')) || 0
      }
    }

    if (!tid) {
      notify('无法推断 topic_id，自动阅读取消', 'error')
      return
    }

    notify(`开始自动阅读话题 ${tid} 的所有帖子...`, 'info')

    const { posts, totalCount } = await fetchPostsForTopic(tid)
    if ((!posts || posts.length === 0) && !totalCount) {
      notify('未获取到任何帖子或总数信息', 'error')
      return
    }

    // Build an ordered list of post_numbers based on totalCount (startFrom..totalCount)
    const total = totalCount || posts.length
    const postNumbers: number[] = []
    if (startFrom > total) {
      notify(`起始帖子号 ${startFrom} 超过总帖子数 ${total}，已跳过`, 'transparent')
      return
    }
    for (let n = startFrom; n <= total; n++) postNumbers.push(n)

    // Process in batches with a randomized batch size between 50 and 1000
    // 说明：范围可按需调整。如果需要更小或更大的批次，请告诉我。
    let BATCH_SIZE = Math.floor(Math.random() * 951) + 50 // 50..1000
    const ran = () => {
      BATCH_SIZE = Math.floor(Math.random() * 1000) + 50 // 50..1000
    }
    for (let i = 0; i < postNumbers.length; i += BATCH_SIZE) {
      const batch = postNumbers.slice(i, i + BATCH_SIZE)
      ran()

      // Build timings: map post_number to a small read time (e.g., 1000ms)
      const timings: Record<number, number> = {}
      for (const pn of batch) {
        timings[pn] = Math.random() * 10000
      }

      // send
      try {
        // attempt to use postTimings with topic id
        await postTimings(tid, timings)
        notify(`已标记 ${Object.keys(timings).length} 个帖子为已读（发送）`, 'success')
      } catch (e: any) {
        notify('发送阅读标记失败：' + (e && e.message ? e.message : String(e)), 'error')
      }

      // random delay between 500ms and 1500ms
      const delay = 500 + Math.floor(Math.random() * 1000)
      await sleep(delay)
    }

    // 在所有帖子已标记为已读后，将话题的追踪等级设置为常规（1）
    try {
      await setNotificationLevel(tid, 1)
    } catch (e) {
      // setNotificationLevel 自行通知错误，这里保持沉默
    }

    notify('自动阅读完成', 'success')
  } catch (e: any) {
    notify('自动阅读异常：' + (e && e.message ? e.message : String(e)), 'error')
  }
}

async function autoReadAllv2(topicId?: number) {
  let tid = topicId || 0
  if (!tid) {
    const m1 = window.location.pathname.match(/t\/topic\/(\d+)/)
    const m2 = window.location.pathname.match(/t\/(\d+)/)
    if (m1 && m1[1]) tid = Number(m1[1])
    else if (m2 && m2[1]) tid = Number(m2[1])
    else {
      // only consider anchor links of the form /t/topic/{id}/1
      const anchors = Array.from(DQSA('a[href]')) as HTMLAnchorElement[]
      const seen = new Set<number>()
      for (const a of anchors) {
        const href = a.getAttribute('href') || ''
        // match /t/topic/{id} or /t/topic/{id}/{read}
        const m = href.match(/^\/t\/topic\/(\d+)(?:\/(\d+))?$/)
        if (!m) continue
        const id = Number(m[1])
        const readPart = m[2] ? Number(m[2]) : undefined
        const start = readPart && !Number.isNaN(readPart) ? readPart : 2
        if (!id || seen.has(id)) continue
        seen.add(id)
        await autoReadAll(id, start)
        // short pause between topics to avoid hammering the server
        await sleep(200)
      }
    }
  }
}

// expose to window for manual triggering

window.autoReadAllReplies = autoReadAll

// expose v2 for manual triggers
window.autoReadAllRepliesV2 = autoReadAllv2

export { autoReadAll, autoReadAllv2 }
