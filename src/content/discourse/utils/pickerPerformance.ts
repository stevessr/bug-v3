import type { Emoji } from '@/types/type'

const HTTP_URL_RE = /^https?:\/\//i
const GRID_THUMBNAIL_SIZE = 96
const PREVIEW_THUMBNAIL_SIZE = 512
const MOTION_HEAVY_EXT_RE = /\.(gif|avif)(?:$|[?#])/i

export const PICKER_EMOJI_SIZE = 32
export const PICKER_MOTION_HEAVY_EMOJI_SIZE = 64

export const PICKER_EAGER_IMAGE_COUNT = 24

type PickerEmojiSource = Pick<Emoji, 'url' | 'displayUrl'>

function getBaseEmojiUrl(emoji: PickerEmojiSource): string {
  return (emoji.displayUrl || emoji.url || '').trim()
}

export function getEmojiPickerImageUrl(
  emoji: PickerEmojiSource,
  thumbnailSize = GRID_THUMBNAIL_SIZE
): string {
  const baseUrl = getBaseEmojiUrl(emoji)
  if (!baseUrl || !HTTP_URL_RE.test(baseUrl)) return baseUrl

  try {
    const parsed = new URL(baseUrl)
    if (/\/optimized\//i.test(parsed.pathname)) return parsed.toString()

    const existingThumbnail = Number(parsed.searchParams.get('thumbnail'))
    if (Number.isFinite(existingThumbnail) && existingThumbnail > 0) {
      if (existingThumbnail <= thumbnailSize) return parsed.toString()
    }

    parsed.searchParams.set('thumbnail', String(thumbnailSize))
    return parsed.toString()
  } catch {
    return baseUrl
  }
}

export function getEmojiPickerPreviewUrl(emoji: PickerEmojiSource): string {
  return getEmojiPickerImageUrl(emoji, PREVIEW_THUMBNAIL_SIZE)
}

export function isMotionHeavyEmoji(emoji: PickerEmojiSource): boolean {
  const candidates = [emoji.displayUrl, emoji.url].filter(Boolean) as string[]

  return candidates.some(candidate => {
    try {
      const parsed = new URL(candidate)
      return MOTION_HEAVY_EXT_RE.test(parsed.pathname)
    } catch {
      return MOTION_HEAVY_EXT_RE.test(candidate)
    }
  })
}

export function loadPickerImage(img: HTMLImageElement) {
  if (img.dataset.loaded === '1') return
  const src = img.dataset.src?.trim()
  if (!src) return

  img.src = src
  img.dataset.loaded = '1'
}

export function preparePickerImage(
  img: HTMLImageElement,
  src: string,
  options: { eager?: boolean; width?: number; height?: number } = {}
) {
  const { eager = false, width = 32, height = 32 } = options

  img.width = width
  img.height = height
  img.decoding = 'async'
  img.loading = eager ? 'eager' : 'lazy'
  img.draggable = false
  img.dataset.src = src
  img.setAttribute('fetchpriority', eager ? 'high' : 'low')

  if (eager) loadPickerImage(img)
}

export function createPickerImageObserver(root?: HTMLElement | null) {
  if (!('IntersectionObserver' in window)) {
    return {
      observe(img: HTMLImageElement) {
        loadPickerImage(img)
      },
      disconnect() {}
    }
  }

  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return

        const img = entry.target as HTMLImageElement
        loadPickerImage(img)
        observer.unobserve(img)
      })
    },
    {
      root: root ?? null,
      rootMargin: '160px',
      threshold: 0.01
    }
  )

  return {
    observe(img: HTMLImageElement) {
      observer.observe(img)
    },
    disconnect() {
      observer.disconnect()
    }
  }
}

export function rafThrottle<T extends (...args: any[]) => void>(fn: T): T {
  let rafId = 0
  let lastArgs: Parameters<T> | null = null

  return ((...args: Parameters<T>) => {
    lastArgs = args
    if (rafId) return

    rafId = window.requestAnimationFrame(() => {
      rafId = 0
      if (!lastArgs) return
      fn(...lastArgs)
    })
  }) as T
}
