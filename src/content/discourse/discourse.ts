// 导入各个功能模块
import { scanForMagnificPopup, observeMagnificPopup } from './utils/magnific-popup'
import { scanForCookedContent, observeCookedContent } from './utils/cooked-content'
import { isDiscoursePage } from './utils/page-detection'
import { setupDiscourseUploadHandler } from './utils/upload-handler'
import { notify } from '../utils/notify'

// postTimings will be available through window (exposed by content.ts)
declare const window: Window & {
  postTimings?: (topicId: number, timings: Record<number, number>) => Promise<any>
}

// If not available on window, we'll use the one from content.ts
// In practice, content.ts exposes it to window, so we can always access it
const getPostTimings = (): typeof window.postTimings => {
  return window.postTimings
}

// Inlined helper to request setting from background
function requestSettingFromBackground(key: string): Promise<any> {
  return new Promise(resolve => {
    try {
      const chromeAPI = (window as any).chrome
      if (chromeAPI && chromeAPI.runtime && chromeAPI.runtime.sendMessage) {
        chromeAPI.runtime.sendMessage({ type: 'GET_EMOJI_SETTING', key }, (resp: any) => {
          if (
            resp &&
            resp.success &&
            resp.data &&
            Object.prototype.hasOwnProperty.call(resp.data, 'value')
          ) {
            resolve(resp.data.value)
          } else {
            resolve(null)
          }
        })
      } else {
        resolve(null)
      }
    } catch (e) {
      void e
      resolve(null)
    }
  })
}

export async function initDiscourse() {
  try {
    if (!isDiscoursePage()) {
      console.log('[DiscourseOneClick] skipping init: not a Discourse page')
      return
    }

    setTimeout(scanForMagnificPopup, 200)
    observeMagnificPopup()
    setupDiscourseUploadHandler()

    let enableBatchParseImages = true
    try {
      const setting = await requestSettingFromBackground('enableBatchParseImages')
      if (typeof setting === 'boolean') enableBatchParseImages = setting
    } catch (e) {
      console.warn('[DiscourseOneClick] failed to get enableBatchParseImages setting', e)
    }

    if (enableBatchParseImages) {
      setTimeout(scanForCookedContent, 300)
      observeCookedContent()
    } else {
      console.log('[DiscourseOneClick] batch parse button disabled via settings')
    }

    // Expose autoReadReplies functions to window
    exposeAutoReadFunctions()

  } catch (e) {
    console.error('[DiscourseOneClick] init failed', e)
  }
}

// ==================== Auto Read Replies Functionality ====================
// Migrated from utils/autoReadReplies.ts

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function fetchPostsForTopic(topicId: number) {
  const url = `/t/${topicId}/posts.json`
  const resp = await fetch(url, { credentials: 'same-origin' })
  if (!resp.ok) throw new Error(`failed to fetch posts.json: ${resp.status}`)
  const data = await resp.json()

  let posts: any[] = []
  let totalCount = 0

  if (data && data.post_stream && Array.isArray(data.post_stream.posts)) {
    posts = data.post_stream.posts
    if (posts.length > 0 && typeof posts[0].posts_count === 'number') {
      totalCount = posts[0].posts_count + 1
    }
  }

  if ((!posts || posts.length === 0) && data && Array.isArray(data.posts)) {
    posts = data.posts
  }

  if (!totalCount) {
    if (data && typeof data.highest_post_number === 'number') totalCount = data.highest_post_number
    else if (data && typeof data.posts_count === 'number') totalCount = data.posts_count
    else if (posts && posts.length > 0) totalCount = posts.length
  }

  return { posts, totalCount }
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

    const total = totalCount || posts.length
    const postNumbers: number[] = []
    if (startFrom > total) {
      notify(`起始帖子号 ${startFrom} 超过总帖子数 ${total}，已跳过`, 'info')
      return
    }
    for (let n = startFrom; n <= total; n++) postNumbers.push(n)

    const BATCH_SIZE = 10
    for (let i = 0; i < postNumbers.length; i += BATCH_SIZE) {
      const batch = postNumbers.slice(i, i + BATCH_SIZE)

      const timings: Record<number, number> = {}
      for (const pn of batch) {
        timings[pn] = Math.random() * 10000
      }

      try {
        if (window.postTimings) {
          await window.postTimings(tid, timings)
          notify(`已标记 ${Object.keys(timings).length} 个帖子为已读（发送）`, 'success')
        } else {
          notify('postTimings 功能未加载', 'error')
          break
        }
      } catch (e: any) {
        notify('发送阅读标记失败：' + (e && e.message ? e.message : String(e)), 'error')
      }

      const delay = 500 + Math.floor(Math.random() * 1000)
      await sleep(delay)
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
      const anchors = Array.from(document.querySelectorAll('a[href]')) as HTMLAnchorElement[]
      const seen = new Set<number>()
      for (const a of anchors) {
        const href = a.getAttribute('href') || ''
        const m = href.match(/^\/t\/topic\/(\d+)(?:\/(\d+))?$/)
        if (!m) continue
        const id = Number(m[1])
        const readPart = m[2] ? Number(m[2]) : undefined
        const start = readPart && !Number.isNaN(readPart) ? readPart : 2
        if (!id || seen.has(id)) continue
        seen.add(id)
        await autoReadAll(id, start)
        await sleep(200)
      }
    }
  }
}

function exposeAutoReadFunctions() {
  try {
    ;(window as any).autoReadAllReplies = autoReadAll
    ;(window as any).autoReadAllRepliesV2 = autoReadAllv2
    console.log('[DiscourseFeatures] Auto-read functions exposed to window')
  } catch (e) {
    console.warn('[DiscourseFeatures] Failed to expose auto-read functions', e)
  }
}
