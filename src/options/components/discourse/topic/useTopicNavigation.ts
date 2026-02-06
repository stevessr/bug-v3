import { ref, nextTick, onMounted, onUnmounted, watch } from 'vue'
import hljs from 'highlight.js'
import '../css/highlight.css'

import type { DiscoursePost, ParsedContent } from '../types'
import type { extractData, pageFetch, parsePostContent } from '../utils'

type Notify = {
  warning: (message: string) => void
}

export function useTopicNavigation(options: {
  baseUrl: string
  topicId: number
  postsListRef: { value: HTMLElement | null }
  targetPostNumber: number | null
  pageFetch: typeof pageFetch
  extractData: typeof extractData
  parsePostContent: typeof parsePostContent
  emitOpenQuote: (payload: { topicId: number; postNumber: number }) => void
  notify: Notify
}) {
  const timelinePostNumber = ref(1)
  const timelineTicking = ref(false)
  const lastAutoScrollKey = ref<string | null>(null)
  const highlightedPostNumber = ref<number | null>(null)
  const highlightTimeoutId = ref<number | null>(null)

  const HIGHLIGHT_DURATION_MS = 2000

  const scrollElementIntoView = (
    el: HTMLElement,
    container: HTMLElement | null,
    behavior: ScrollBehavior = 'smooth'
  ) => {
    if (container) {
      const elRect = el.getBoundingClientRect()
      const containerRect = container.getBoundingClientRect()
      const targetTop =
        elRect.top - containerRect.top + container.scrollTop - containerRect.height / 2
      const nextTop = Math.max(0, targetTop)
      container.scrollTo({ top: nextTop, behavior })
      if (behavior !== 'auto') {
        container.scrollTop = nextTop
      }
    } else {
      el.scrollIntoView({ behavior, block: 'center' })
    }
  }

  const findNearestPostElement = (targetPost: number): HTMLElement | null => {
    const list = options.postsListRef.value
    if (!list) return null
    const nodes = Array.from(list.querySelectorAll<HTMLElement>('[data-post-number]'))
    if (!nodes.length) return null
    let above: { num: number; el: HTMLElement } | null = null
    let below: { num: number; el: HTMLElement } | null = null
    for (const node of nodes) {
      const raw = node.getAttribute('data-post-number')
      if (!raw) continue
      const num = Number.parseInt(raw, 10)
      if (!Number.isFinite(num)) continue
      if (num >= targetPost) {
        if (!above || num < above.num) {
          above = { num, el: node }
        }
      } else if (!below || num > below.num) {
        below = { num, el: node }
      }
    }
    return (above || below)?.el || null
  }

  const scrollToPost = (postNumber: number, behavior: ScrollBehavior = 'smooth') => {
    const list = options.postsListRef.value
    if (!list) return
    const target = list.querySelector<HTMLElement>(`[data-post-number="${postNumber}"]`)
    const container = list.closest('.content-area') as HTMLElement | null
    if (target) {
      scrollElementIntoView(target, container, behavior)
      triggerHighlight(postNumber)
      return
    }
    const nearest = findNearestPostElement(postNumber)
    if (nearest) {
      scrollElementIntoView(nearest, container, behavior)
      triggerHighlight(postNumber)
    }
  }

  const triggerHighlight = (postNumber: number) => {
    if (highlightTimeoutId.value !== null) {
      clearTimeout(highlightTimeoutId.value)
    }
    highlightedPostNumber.value = postNumber
    highlightTimeoutId.value = window.setTimeout(() => {
      highlightedPostNumber.value = null
      highlightTimeoutId.value = null
    }, HIGHLIGHT_DURATION_MS)
  }

  const updateTimelineFromScroll = () => {
    if (timelineTicking.value) return
    timelineTicking.value = true
    requestAnimationFrame(() => {
      const list = options.postsListRef.value
      const container = list?.closest('.content-area') as HTMLElement | null
      if (!list || !container) {
        timelineTicking.value = false
        return
      }
      const nodes = Array.from(list.querySelectorAll<HTMLElement>('[data-post-number]'))
      const containerRect = container.getBoundingClientRect()
      let closest: { num: number; distance: number } | null = null
      for (const node of nodes) {
        const raw = node.getAttribute('data-post-number')
        if (!raw) continue
        const num = Number.parseInt(raw, 10)
        const rect = node.getBoundingClientRect()
        const distance = Math.abs(rect.top - containerRect.top)
        if (!closest || distance < closest.distance) {
          closest = { num, distance }
        }
      }
      if (closest) {
        timelinePostNumber.value = closest.num
      }
      timelineTicking.value = false
    })
  }

  const handleQuoteToggle = async (event: Event) => {
    const target = event.target as HTMLElement | null

    const spoiler = target?.closest('.spoiled') as HTMLElement | null
    if (spoiler) {
      const isBlurred =
        spoiler.classList.contains('spoiler-blurred') ||
        spoiler.getAttribute('data-spoiler-state') === 'blurred'
      if (isBlurred) {
        spoiler.classList.remove('spoiler-blurred')
        spoiler.setAttribute('data-spoiler-state', 'revealed')
        spoiler.setAttribute('aria-expanded', 'true')
        spoiler.querySelectorAll('[aria-hidden="true"]').forEach(el => {
          el.setAttribute('aria-hidden', 'false')
        })
      } else {
        spoiler.classList.add('spoiler-blurred')
        spoiler.setAttribute('data-spoiler-state', 'blurred')
        spoiler.setAttribute('aria-expanded', 'false')
        spoiler.querySelectorAll('[aria-hidden="false"]').forEach(el => {
          el.setAttribute('aria-hidden', 'true')
        })
      }
      event.preventDefault()
      event.stopPropagation()
      return
    }

    const titleLink = target?.closest('.quote-title__text-content, .quote-controls')
    if (titleLink) {
      const aside = target?.closest('aside.quote') as HTMLElement | null
      if (!aside) return
      const topicId = aside.getAttribute('data-topic')
      const postNumber = aside.getAttribute('data-post')
      if (!topicId || !postNumber) return
      event.preventDefault()
      event.stopPropagation()
      options.emitOpenQuote({ topicId: parseInt(topicId), postNumber: parseInt(postNumber) })
      return
    }

    const button = target?.closest('button.quote-toggle') as HTMLButtonElement | null
    if (!button) return

    const aside = button.closest('aside.quote') as HTMLElement | null
    if (!aside) return

    event.preventDefault()
    event.stopPropagation()

    const blockquote = aside.querySelector('blockquote') as HTMLElement | null
    if (!blockquote) return

    const expanded = aside.getAttribute('data-expanded') === 'true'
    const original = blockquote.getAttribute('data-original-html')

    if (expanded) {
      if (original !== null) {
        blockquote.innerHTML = original
      }
      aside.setAttribute('data-expanded', 'false')
      button.setAttribute('aria-expanded', 'false')
      return
    }

    if (original === null) {
      blockquote.setAttribute('data-original-html', blockquote.innerHTML)
    }

    const topicId = aside.getAttribute('data-topic')
    const postNumber = aside.getAttribute('data-post')
    if (!topicId || !postNumber) return

    button.classList.add('is-loading')
    button.setAttribute('aria-expanded', 'true')
    aside.setAttribute('data-expanded', 'true')

    try {
      const result = await options.pageFetch<any>(
        `${options.baseUrl}/posts/by_number/${topicId}/${postNumber}.json`
      )

      if (result.status === 404) {
        blockquote.innerHTML = '<div class="quote-error">引用内容不存在 (404)</div>'
        return
      }

      const data = options.extractData(result)
      if (data?.cooked) {
        const parsed = options.parsePostContent(data.cooked, options.baseUrl)
        blockquote.innerHTML = parsed.html

        const codeBlocks = blockquote.querySelectorAll('pre code')
        codeBlocks.forEach(block => {
          const el = block as HTMLElement
          const langMatch = Array.from(el.classList).find(cls => cls.startsWith('lang-'))
          if (langMatch) {
            const lang = langMatch.replace('lang-', '')
            if (hljs.getLanguage(lang)) {
              el.innerHTML = hljs.highlight(el.textContent || '', { language: lang }).value
              el.classList.add('hljs')
              return
            }
          }
          hljs.highlightElement(el)
        })
      } else if (result.ok === false) {
        const statusText = result.status ? ` (${result.status})` : ''
        blockquote.innerHTML = `<div class="quote-error">引用内容加载失败${statusText}</div>`
      }
    } catch (error) {
      console.warn('[DiscourseBrowser] expand quote failed:', error)
      aside.setAttribute('data-expanded', 'false')
      button.setAttribute('aria-expanded', 'false')
    } finally {
      button.classList.remove('is-loading')
    }
  }

  watch(
    () => options.targetPostNumber,
    async value => {
      if (!value) return
      const key = `${options.topicId}-${value}`
      if (lastAutoScrollKey.value === key) return
      lastAutoScrollKey.value = key
      await nextTick()
      scrollToPost(value)
      timelinePostNumber.value = value
    },
    { immediate: true }
  )

  onMounted(() => {
    options.postsListRef.value?.addEventListener('click', handleQuoteToggle)
    const container = options.postsListRef.value?.closest('.content-area') as HTMLElement | null
    container?.addEventListener('scroll', updateTimelineFromScroll)
    updateTimelineFromScroll()
  })

  onUnmounted(() => {
    options.postsListRef.value?.removeEventListener('click', handleQuoteToggle)
    const container = options.postsListRef.value?.closest('.content-area') as HTMLElement | null
    container?.removeEventListener('scroll', updateTimelineFromScroll)
  })

  return {
    timelinePostNumber,
    highlightedPostNumber,
    scrollToPost,
    updateTimelineFromScroll
  }
}
