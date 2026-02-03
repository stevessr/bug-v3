<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, watch, createApp } from 'vue'

import type { ParsedContent, LightboxImage, DiscoursePoll } from '../types'
import { parseEmojiShortcodeToHTML } from '../bbcode'
import { parsePostContent } from '../parser/parsePostContent'
import { pageFetch, extractData } from '../utils'
import { ensureEmojiShortcodesLoaded } from '../linux.do/emojis'

import PollView from './PollView'
import HashtagCooked from './HashtagCooked'
import ImageCarousel from './ImageCarousel'
import ImageMasonry from './ImageMasonry'

type ImageGridSegment = Extract<ParsedContent['segments'][number], { type: 'image-grid' }>

const props = defineProps<{
  segments: ParsedContent['segments']
  baseUrl: string
  postId: number
  footnotes?: Record<string, string>
  polls?: DiscoursePoll[]
}>()

const emit = defineEmits<{
  (e: 'navigate', url: string): void
}>()

const getLightboxThumb = (image: LightboxImage) => {
  return image.thumbSrc || image.href
}

const getLightboxPreview = (image: LightboxImage) => {
  if (image.href && image.href !== getLightboxThumb(image)) {
    return { src: image.href }
  }
  return true
}

const processHtmlContent = (html: string) => {
  emojiReadyToken.value
  return replaceEmojiShortcodesInHtml(html)
}

let activeFootnoteRoot: HTMLElement | null = null
let activeFootnoteContainer: HTMLDivElement | null = null
let scrollContainer: HTMLElement | null = null
let pollCleanupFns: Array<() => void> = []
let hashtagCleanupFns: Array<() => void> = []

const getImageGridColumnsCount = (segment: ImageGridSegment) => {
  if (segment.columnsCount) return Math.max(segment.columnsCount, 1)
  if (segment.columns.length > 1) return segment.columns.length
  return 2
}

const isSameSiteUrl = (url: string): boolean => {
  if (!url) return false
  try {
    const urlObj = new URL(url, props.baseUrl)
    const baseUrlObj = new URL(props.baseUrl)
    return urlObj.origin === baseUrlObj.origin
  } catch {
    return false
  }
}

const handleClick = (event: MouseEvent) => {
  const target = event.target as HTMLElement

  // Handle spoiler click
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

  const anchor = target?.closest('a') as HTMLAnchorElement | null

  if (!anchor) return
  if (anchor.dataset.noRouter === 'true') return
  if (anchor.closest('sup.footnote-ref')) {
    event.preventDefault()
    return
  }

  const href = anchor.getAttribute('href')
  if (!href) return

  // Check if it's a same-site URL
  if (href.startsWith('/')) {
    // Internal path
    event.preventDefault()
    emit('navigate', href)
  } else if (href.startsWith('http') && isSameSiteUrl(href)) {
    // Same-site full URL, convert to internal path
    event.preventDefault()
    try {
      const urlObj = new URL(href)
      const internalPath = urlObj.pathname + urlObj.search + urlObj.hash
      emit('navigate', internalPath)
    } catch {
      // Invalid URL, let it open
      return
    }
  }
  // External links will open normally or in new tab
}

const updateFootnotePosition = () => {
  if (!activeFootnoteRoot || !activeFootnoteContainer || !contentRef.value) return
  const host = contentRef.value
  const rect = activeFootnoteRoot.getBoundingClientRect()
  const hostRect = host.getBoundingClientRect()
  const maxWidth = Math.min(520, Math.max(240, hostRect.width - 24))
  const left = Math.min(rect.left - hostRect.left, hostRect.width - maxWidth - 12)
  const top = rect.bottom - hostRect.top + 6
  activeFootnoteContainer.style.maxWidth = `${maxWidth}px`
  activeFootnoteContainer.style.left = `${Math.max(12, left)}px`
  activeFootnoteContainer.style.top = `${Math.max(8, top)}px`
}

const hideActiveFootnote = () => {
  if (activeFootnoteContainer) {
    activeFootnoteContainer.remove()
  }
  if (activeFootnoteRoot) {
    const trigger = activeFootnoteRoot.querySelector('sup.footnote-ref a')
    trigger?.setAttribute('aria-expanded', 'false')
  }
  activeFootnoteContainer = null
  activeFootnoteRoot = null
}

const voteEndpoint = () => `${props.baseUrl.replace(/\/+$/, '')}/polls/vote`

const requestPollVote = async (method: 'PUT' | 'DELETE', body: URLSearchParams) => {
  const response = await pageFetch<any>(
    voteEndpoint(),
    {
      method,
      headers: {
        accept: '*/*',
        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
        'Discourse-Logged-In': 'true'
      },
      body: body.toString()
    },
    'json'
  )
  const data = extractData(response)
  if (!response.ok || !data?.poll) {
    throw new Error(data?.errors?.[0] || data?.error || '投票失败')
  }
  return data
}

const teardownPollEnhancements = () => {
  pollCleanupFns.forEach(fn => fn())
  pollCleanupFns = []
}

const teardownHashtagEnhancements = () => {
  hashtagCleanupFns.forEach(fn => fn())
  hashtagCleanupFns = []
}

const getHashtagLabel = (anchor: HTMLAnchorElement) => {
  const labelNode = anchor.querySelector('span:last-child')
  const label = (labelNode?.textContent || anchor.textContent || '').trim()
  return label
}

const splitClassList = (value: string) =>
  value
    .split(/\s+/)
    .map(item => item.trim())
    .filter(Boolean)

const getHashtagPropsFromAnchor = (anchor: HTMLAnchorElement) => {
  const label = getHashtagLabel(anchor)
  if (!label) return null

  const extraClass = splitClassList(anchor.className).filter(item => item !== 'hashtag-cooked')

  const {
    type,
    slug,
    id: tagId,
    styleType,
    icon,
    valid
  } = anchor.dataset as {
    type?: string
    slug?: string
    id?: string
    styleType?: string
    icon?: string
    valid?: string
  }

  return {
    href: anchor.getAttribute('href') || '',
    label,
    type,
    slug,
    tagId,
    styleType,
    icon,
    valid: valid !== 'false',
    extraClass,
    title: anchor.getAttribute('title') || undefined,
    ariaLabel: anchor.getAttribute('aria-label') || undefined
  }
}

const getHashtagPropsFromHost = (host: HTMLElement) => {
  const label = host.dataset.label || ''
  if (!label) return null

  const extraClass = splitClassList(host.dataset.extraClass || '')
  return {
    href: host.dataset.href || '',
    label,
    type: host.dataset.type,
    slug: host.dataset.slug,
    tagId: host.dataset.tagId,
    styleType: host.dataset.styleType,
    icon: host.dataset.icon,
    valid: host.dataset.valid !== 'false',
    extraClass,
    title: host.dataset.title || undefined,
    ariaLabel: host.dataset.ariaLabel || undefined
  }
}

const persistHashtagHostData = (
  host: HTMLElement,
  data: ReturnType<typeof getHashtagPropsFromAnchor>
) => {
  if (!data) return
  host.dataset.href = data.href
  host.dataset.label = data.label
  host.dataset.type = data.type || ''
  host.dataset.slug = data.slug || ''
  host.dataset.tagId = data.tagId || ''
  host.dataset.styleType = data.styleType || ''
  host.dataset.icon = data.icon || ''
  host.dataset.valid = data.valid ? 'true' : 'false'
  host.dataset.extraClass = data.extraClass.join(' ')
  host.dataset.title = data.title || ''
  host.dataset.ariaLabel = data.ariaLabel || ''
}

const setupHashtagEnhancements = () => {
  teardownHashtagEnhancements()
  const host = contentRef.value
  if (!host) return

  const anchors = Array.from(host.querySelectorAll<HTMLAnchorElement>('a.hashtag-cooked'))
  anchors.forEach(anchor => {
    const data = getHashtagPropsFromAnchor(anchor)
    if (!data) return

    const mountRoot = document.createElement('span')
    mountRoot.className = 'hashtag-cooked-host'
    persistHashtagHostData(mountRoot, data)
    anchor.replaceWith(mountRoot)

    const app = createApp(HashtagCooked, data)
    app.mount(mountRoot)
    hashtagCleanupFns.push(() => app.unmount())
  })

  const hosts = Array.from(host.querySelectorAll<HTMLElement>('span.hashtag-cooked-host'))
  hosts.forEach(mountRoot => {
    if (mountRoot.childNodes.length > 0) return
    const data = getHashtagPropsFromHost(mountRoot)
    if (!data) return
    const app = createApp(HashtagCooked, data)
    app.mount(mountRoot)
    hashtagCleanupFns.push(() => app.unmount())
  })
}

const setupPollEnhancements = () => {
  teardownPollEnhancements()
  const host = contentRef.value
  if (!host) return

  const pollRoots = Array.from(
    host.querySelectorAll<HTMLElement>('.poll-outer[data-poll-name], .poll[data-poll-name]')
  )

  pollRoots.forEach(root => {
    const pollContainer = root.classList.contains('poll')
      ? root
      : root.querySelector<HTMLElement>('.poll[data-poll-name]') || root

    const pollName =
      pollContainer.dataset.pollName ||
      pollContainer.closest<HTMLElement>('.poll-outer')?.dataset.pollName ||
      ''
    if (!pollName) return

    const pollType =
      pollContainer.dataset.pollType ||
      pollContainer.closest<HTMLElement>('.poll-outer')?.dataset.pollType ||
      'regular'

    const pollData = props.polls?.find(item => item.name === pollName)

    const optionNodes = Array.from(
      pollContainer.querySelectorAll<HTMLElement>(
        'li[data-poll-option-id], .ranked-choice-poll-option[data-poll-option-id]'
      )
    )

    const options = optionNodes
      .map(node => {
        const id = node.dataset.pollOptionId || ''
        if (!id) return null
        const textNode = node.querySelector<HTMLElement>('.option-text')
        const label = (textNode?.textContent || node.textContent || '').trim()
        return { id, label }
      })
      .filter(Boolean) as Array<{ id: string; label: string }>

    const pollTitleHtml = pollContainer.querySelector<HTMLElement>('.poll-title')?.innerHTML || ''

    const mountRoot = root
    mountRoot.innerHTML = ''
    const mountEl = document.createElement('div')
    mountEl.className = 'poll-tsx-root'
    mountRoot.appendChild(mountEl)

    const app = createApp(PollView, {
      pollName,
      pollType,
      pollTitleHtml,
      options,
      pollData,
      baseUrl: props.baseUrl,
      postId: props.postId,
      requestPollVote,
      pollMeta: {
        min: Number(pollContainer.dataset.pollMin) || pollData?.min,
        max: Number(pollContainer.dataset.pollMax) || pollData?.max,
        results: pollContainer.dataset.pollResults || pollData?.results,
        voters: pollData?.voters
      }
    })

    app.mount(mountEl)
    pollCleanupFns.push(() => app.unmount())
  })
}
const showFootnoteFor = (footnoteRoot: HTMLElement, trigger: HTMLAnchorElement) => {
  if (activeFootnoteRoot === footnoteRoot) return
  hideActiveFootnote()

  const href = trigger.getAttribute('href') || ''
  const id = href.startsWith('#') ? href.slice(1) : href
  const rawContent = id ? props.footnotes?.[id] : undefined
  if (!rawContent) return

  const container = document.createElement('div')
  container.className = 'post-footnote-inline'
  const parsed = parsePostContent(rawContent, props.baseUrl)
  container.innerHTML = parsed.html
  container.addEventListener('mouseenter', () => {
    // keep visible while hovering the tooltip itself
  })
  container.addEventListener('mouseleave', () => {
    hideActiveFootnote()
  })

  const host = contentRef.value
  if (!host) return

  host.appendChild(container)
  trigger.setAttribute('aria-expanded', 'true')
  activeFootnoteRoot = footnoteRoot
  activeFootnoteContainer = container
  updateFootnotePosition()
}

const handleMouseOver = (event: MouseEvent) => {
  const target = event.target as HTMLElement
  const footnoteRoot = target?.closest('sup.footnote-ref') as HTMLElement | null
  if (!footnoteRoot) return
  const trigger = footnoteRoot.querySelector('a') as HTMLAnchorElement | null
  if (!trigger) return
  showFootnoteFor(footnoteRoot, trigger)
}

const handleMouseOut = (event: MouseEvent) => {
  const target = event.target as HTMLElement
  const footnoteRoot = target?.closest('sup.footnote-ref') as HTMLElement | null
  if (!footnoteRoot) return
  if (
    event.relatedTarget instanceof Node &&
    (footnoteRoot.contains(event.relatedTarget) ||
      activeFootnoteContainer?.contains(event.relatedTarget))
  ) {
    return
  }
  hideActiveFootnote()
}

const mounted = ref(false)
const contentRef = ref<HTMLElement | null>(null)
const emojiReadyToken = ref(0)

const replaceEmojiShortcodesInHtml = (html: string) => {
  if (!html || !emojiReadyToken.value) return html
  if (!html.includes(':')) return html

  const parser = new DOMParser()
  const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html')
  const root = doc.body
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const textNodes: Text[] = []

  while (walker.nextNode()) {
    const node = walker.currentNode as Text
    if (node.nodeValue && node.nodeValue.includes(':')) {
      textNodes.push(node)
    }
  }

  textNodes.forEach(node => {
    const text = node.nodeValue || ''
    const converted = parseEmojiShortcodeToHTML(text, 100)
    if (converted === text) return
    const wrapper = doc.createElement('span')
    wrapper.innerHTML = converted
    node.replaceWith(...Array.from(wrapper.childNodes))
  })

  return root.innerHTML
}

onMounted(() => {
  mounted.value = true
  // Add click event listener to the content div
  nextTick(() => {
    const contentDiv = contentRef.value
    if (contentDiv) {
      contentDiv.addEventListener('click', handleClick)
      contentDiv.addEventListener('mouseover', handleMouseOver)
      contentDiv.addEventListener('mouseout', handleMouseOut)
      scrollContainer = contentDiv.closest('.content-area') as HTMLElement | null
      scrollContainer?.addEventListener('scroll', updateFootnotePosition, { passive: true })
      setupPollEnhancements()
      setupHashtagEnhancements()
    }
  })
  window.addEventListener('resize', updateFootnotePosition, { passive: true })

  void ensureEmojiShortcodesLoaded(props.baseUrl).then(count => {
    if (count > 0) emojiReadyToken.value++
  })
})

onUnmounted(() => {
  const contentDiv = contentRef.value
  if (contentDiv) {
    contentDiv.removeEventListener('click', handleClick)
    contentDiv.removeEventListener('mouseover', handleMouseOver)
    contentDiv.removeEventListener('mouseout', handleMouseOut)
    scrollContainer?.removeEventListener('scroll', updateFootnotePosition)
  }
  scrollContainer = null
  window.removeEventListener('resize', updateFootnotePosition)
  hideActiveFootnote()
  teardownPollEnhancements()
  teardownHashtagEnhancements()
})

watch(
  () => props.segments,
  async () => {
    await nextTick()
    setupPollEnhancements()
    setupHashtagEnhancements()
  }
)

watch(
  () => props.baseUrl,
  async value => {
    if (!value) return
    const count = await ensureEmojiShortcodesLoaded(value)
    if (count > 0) {
      emojiReadyToken.value++
      await nextTick()
      setupPollEnhancements()
      setupHashtagEnhancements()
    }
  }
)
</script>

<template>
  <div ref="contentRef" class="post-content prose dark:prose-invert max-w-none text-sm">
    <template v-for="(segment, idx) in props.segments" :key="idx">
      <div
        v-if="segment.type === 'html'"
        class="post-content-fragment"
        v-html="processHtmlContent(segment.html)"
      />
      <ImageCarousel v-else-if="segment.type === 'carousel'" :images="segment.images" />
      <ImageMasonry
        v-else-if="segment.type === 'image-grid'"
        :columns="segment.columns"
        :columnsCount="getImageGridColumnsCount(segment)"
      />
      <a-image
        v-else
        class="post-inline-image rounded"
        wrapper-class-name="post-inline-image-wrapper"
        :src="getLightboxThumb(segment.image)"
        :preview="getLightboxPreview(segment.image)"
        :alt="segment.image.alt || ''"
        :width="segment.image.width"
        :height="segment.image.height"
        :srcset="segment.image.srcset"
        :style="segment.image.style"
      />
    </template>
  </div>
</template>

<style scoped src="../css/PostContent.css"></style>
