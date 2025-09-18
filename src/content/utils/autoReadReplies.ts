import { postTimings } from './timingsBinder'
import { notify } from './notify'

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
      totalCount = posts[0].posts_count
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

async function autoReadAll(topicId?: number) {
  try {
    let tid = topicId || 0
    if (!tid) {
      const m1 = window.location.pathname.match(/t\/topic\/(\d+)/)
      const m2 = window.location.pathname.match(/t\/(\d+)/)
      if (m1 && m1[1]) tid = Number(m1[1])
      else if (m2 && m2[1]) tid = Number(m2[1])
      else {
        const el = document.querySelector('[data-topic-id]') as HTMLElement | null
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

    // Build an ordered list of post_numbers based on totalCount (1..totalCount)
    const total = totalCount || posts.length
    const postNumbers: number[] = []
    for (let n = 1; n <= total; n++) postNumbers.push(n)

    // Process in batches of 7
    const BATCH_SIZE = 7
    for (let i = 0; i < postNumbers.length; i += BATCH_SIZE) {
      const batch = postNumbers.slice(i, i + BATCH_SIZE)

      // Build timings: map post_number to a small read time (e.g., 1000ms)
      const timings: Record<number, number> = {}
      for (const pn of batch) {
        timings[pn] = 1000
      }

      // send
      try {
        // attempt to use postTimings with topic id
        await postTimings(tid, timings)
        notify(`已标记 ${Object.keys(timings).length} 个帖子为已读（发送）`, 'success')
      } catch (e: any) {
        notify('发送阅读标记失败: ' + (e && e.message ? e.message : String(e)), 'error')
      }

      // random delay between 500ms and 1500ms
      const delay = 500 + Math.floor(Math.random() * 1000)
      await sleep(delay)
    }

    notify('自动阅读完成', 'success')
  } catch (e: any) {
    notify('自动阅读异常: ' + (e && e.message ? e.message : String(e)), 'error')
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
      const el = document.querySelectorAll('[data-topic-id]')
      if (el && el.length > 0) {
        // process topics one-by-one instead of in parallel
        for (const node of Array.from(el) as HTMLElement[]) {
          const attr = node.getAttribute('data-topic-id')
          const id = attr ? Number(attr) : 0
          if (id) {
            await autoReadAll(id)
            // short pause between topics to avoid hammering the server
            await sleep(200)
          }
        }
      }
    }
  }
}

// expose to window for manual triggering

// @ts-ignore
window.autoReadAllReplies = autoReadAll

export { autoReadAll, autoReadAllv2 }
