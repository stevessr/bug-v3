import { postTimings } from './timingsBinder'
import { DQSA, DQS } from '@/content/utils/dom/createEl'

// Simplified read tracker inspired by Discourse's screen-track logic.
// - tick() runs every second and accumulates time for visible posts
// - If no scroll for PAUSE_UNLESS_SCROLLED ms, pause accumulation
// - On flush (every FLUSH_INTERVAL), consolidate timings and send via postTimings

const TICK_INTERVAL = 1000 // 1s
const PAUSE_UNLESS_SCROLLED = 3 * 60 * 1000 // 3 minutes
const FLUSH_INTERVAL = 15 * 1000 // 15s default flush interval
const MAX_TOPIC_TIME = 59000 // keep below 60000 per constraint

let lastScrolled = Date.now()
let lastTick = Date.now()
let timings: Record<number, number> = {}
let accumulatedTopicTime = 0
let topicId = 0

// 资源清理相关
const cleanupHandlers: Array<() => void> = []
let isTracking = false

function readTopicId(): number {
  const m1 = window.location.pathname.match(/t\/topic\/(\d+)/)
  const m2 = window.location.pathname.match(/t\/(\d+)/)
  if (m1 && m1[1]) return Number(m1[1])
  if (m2 && m2[1]) return Number(m2[1])
  const el = DQS('[data-topic-id]') as HTMLElement | null
  if (el) return Number(el.getAttribute('data-topic-id')) || 0
  return 0
}

function isVisible(el: Element) {
  const rect = el.getBoundingClientRect()
  return rect.bottom > 0 && rect.top < window.innerHeight
}

function collectVisiblePosts() {
  const postEls = Array.from(DQSA('[data-post-number]')) as HTMLElement[]
  return postEls.filter(isVisible)
}

async function flushIfNeeded() {
  if (!topicId) topicId = readTopicId()
  if (!topicId) return

  // Consolidate timings and send if any
  if (Object.keys(timings).length === 0) return

  // Ensure total topic time < MAX_TOPIC_TIME
  let total = Object.values(timings).reduce((s, v) => s + v, 0)
  if (total > MAX_TOPIC_TIME) {
    // scale down proportionally
    const factor = MAX_TOPIC_TIME / total
    Object.keys(timings).forEach(k => {
      timings[Number(k)] = Math.floor(timings[Number(k)] * factor)
    })
    total = MAX_TOPIC_TIME
  }

  try {
    await postTimings(topicId, timings)
    // reset after successful send
    timings = {}
    accumulatedTopicTime = 0
  } catch (e) {
    // ignore for now; next tick/flush will retry
    console.warn('[readTracker] flush failed', e)
  }
}

export function startReadTracker() {
  if (isTracking) return // already running

  topicId = readTopicId()
  lastScrolled = Date.now()
  lastTick = Date.now()
  isTracking = true

  // 添加滚动监听器（需要保存引用以便清理）
  const scrollHandler = () => {
    lastScrolled = Date.now()
  }
  window.addEventListener('scroll', scrollHandler)

  // 主计时器
  const mainInterval = setInterval(() => {
    const now = Date.now()
    const delta = now - lastTick
    lastTick = now

    // If paused due to no recent scroll, skip
    if (now - lastScrolled > PAUSE_UNLESS_SCROLLED) return

    // Find visible posts and add delta to each (or divide among them)
    const visible = collectVisiblePosts()
    if (visible.length === 0) return

    const per = Math.min(delta, MAX_TOPIC_TIME - accumulatedTopicTime)
    if (per <= 0) return

    // Distribute delta equally across visible posts
    const share = Math.floor(per / visible.length)
    for (const el of visible) {
      const pnAttr = el.getAttribute('data-post-number') || el.dataset.postNumber
      const postNumber = pnAttr ? Number(pnAttr) : NaN
      if (!postNumber || Number.isNaN(postNumber)) continue
      timings[postNumber] = (timings[postNumber] || 0) + share
      accumulatedTopicTime += share
      if (accumulatedTopicTime >= MAX_TOPIC_TIME) break
    }
  }, TICK_INTERVAL)

  // Periodic flush
  const flushInterval = setInterval(() => {
    void flushIfNeeded()
  }, FLUSH_INTERVAL)

  // 保存所有需要清理的资源
  cleanupHandlers.push(
    () => clearInterval(mainInterval),
    () => clearInterval(flushInterval),
    () => window.removeEventListener('scroll', scrollHandler)
  )

  console.log('[readTracker] started')
}

/** Stop tracking and clean up resources */
export function stopReadTracker() {
  if (!isTracking) return // not running

  // 执行所有清理函数
  for (const cleanup of cleanupHandlers) {
    cleanup()
  }
  cleanupHandlers.length = 0
  isTracking = false

  console.log('[readTracker] stopped')
}
