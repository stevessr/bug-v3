// Discourse Browser Utilities

import type { ParsedContent } from './types'

// Page proxy request via Chrome extension
export async function pageFetch<T>(
  url: string,
  options?: { method?: string; headers?: Record<string, string>; body?: string },
  responseType: 'json' | 'text' = 'json'
): Promise<{ status: number; ok: boolean; data: T | null }> {
  const chromeAPI = (globalThis as any).chrome
  if (!chromeAPI?.runtime?.sendMessage) {
    throw new Error('Page fetch unavailable: chrome.runtime is not accessible')
  }

  return await new Promise((resolve, reject) => {
    chromeAPI.runtime.sendMessage(
      {
        type: 'LINUX_DO_PAGE_FETCH',
        options: {
          url,
          method: options?.method || 'GET',
          headers: options?.headers,
          body: options?.body,
          responseType
        }
      },
      (resp: {
        success: boolean
        data?: { status: number; ok: boolean; data: T }
        error?: string
      }) => {
        if (resp?.success && resp.data) {
          resolve({
            status: resp.data.status || 200,
            ok: resp.data.ok !== false,
            data: resp.data.data ?? null
          })
          return
        }
        reject(new Error(resp?.error || `Page fetch failed: ${resp?.data?.status || 'unknown'}`))
      }
    )
  })
}

// Extract data from API response (handles nesting)
export function extractData(result: any): any {
  if (!result) return null
  if (result.data && typeof result.data === 'object') {
    if (result.data.data && typeof result.data.data === 'object') {
      return result.data.data
    }
    return result.data
  }
  return result
}

// Generate unique ID
export function generateId(): string {
  return `tab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

// Get avatar URL
export function getAvatarUrl(template: string, baseUrl: string, size = 45): string {
  if (!template) return ''
  const url = template.replace('{size}', String(size))
  return url.startsWith('http') ? url : `${baseUrl}${url}`
}

// Format time
export function formatTime(dateStr: string): string {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 60) return `${minutes} 分钟前`
  if (hours < 24) return `${hours} 小时前`
  if (days < 30) return `${days} 天前`
  return date.toLocaleDateString('zh-CN')
}

// Parse post content, extract images for preview
// Skip images inside onebox, emoji, and other special containers
export function parsePostContent(cooked: string, baseUrl?: string): ParsedContent {
  if (!cooked) return { html: '', images: [], segments: [] }

  const images: string[] = []
  const carousels: string[][] = []
  const seen = new Set<string>()

  const resolveUrl = (url: string) => {
    if (!url) return ''
    return url.startsWith('http') ? url : baseUrl ? `${baseUrl}${url}` : url
  }

  const addImage = (url: string) => {
    const fullUrl = resolveUrl(url)
    if (!fullUrl) return ''
    if (!seen.has(fullUrl)) {
      seen.add(fullUrl)
      images.push(fullUrl)
    }
    return fullUrl
  }

  const parser = new DOMParser()
  const doc = parser.parseFromString(cooked, 'text/html')
  const body = doc.body

  const isInsideOnebox = (el: Element | null) => {
    if (!el) return false
    return !!el.closest('.onebox')
  }

  const replaceWithMarker = (el: Element, marker: string) => {
    const text = doc.createTextNode(marker)
    el.replaceWith(text)
  }

  // Step 1: handle carousel image grid
  const carouselNodes = Array.from(body.querySelectorAll('.d-image-grid--carousel'))
  carouselNodes.forEach(node => {
    if (isInsideOnebox(node)) return
    const urls: string[] = []
    const slides = Array.from(node.querySelectorAll('.d-image-carousel__slide'))
    slides.forEach(slide => {
      const anchor = slide.querySelector('a.lightbox') as HTMLAnchorElement | null
      const img = slide.querySelector('img') as HTMLImageElement | null
      const rawUrl = anchor?.getAttribute('href') || img?.getAttribute('src')
      const resolved = rawUrl ? resolveUrl(rawUrl) : ''
      if (resolved && !urls.includes(resolved)) urls.push(resolved)
    })
    if (urls.length > 0) {
      const index = carousels.length
      carousels.push(urls)
      replaceWithMarker(node, `__DISCOURSE_CAROUSEL_${index}__`)
    }
  })

  // Step 2: replace lightbox-wrapper images
  const lightboxWrappers = Array.from(body.querySelectorAll('.lightbox-wrapper'))
  lightboxWrappers.forEach(wrapper => {
    if (isInsideOnebox(wrapper)) return
    const anchor = wrapper.querySelector('a.lightbox') as HTMLAnchorElement | null
    const href = anchor?.getAttribute('href')
    if (!href) return
    const index = images.length
    addImage(href)
    replaceWithMarker(wrapper, `__DISCOURSE_IMG_${index}__`)
  })

  // Step 2.5: collect lightbox links without images
  const lightboxLinks = Array.from(body.querySelectorAll('a.lightbox'))
  lightboxLinks.forEach(link => {
    if (isInsideOnebox(link)) return
    const href = link.getAttribute('href')
    if (href) addImage(href)
  })

  // Step 3: process regular img tags (non-lightbox, non-onebox)
  const imagesNodes = Array.from(body.querySelectorAll('img'))
  imagesNodes.forEach(img => {
    if (isInsideOnebox(img)) return
    if (img.closest('.lightbox-wrapper')) return
    const src = img.getAttribute('src') || ''
    const className = img.getAttribute('class') || ''
    if (src.includes('/images/emoji/') || className.includes('emoji')) return
    if (className.includes('avatar')) return
    if (className.includes('site-icon')) return
    if (!src) return
    const index = images.length
    addImage(src)
    replaceWithMarker(img, `__DISCOURSE_IMG_${index}__`)
  })

  const html = body.innerHTML

  const markers: Array<{ marker: string; type: 'image' | 'carousel'; index: number }> = []
  images.forEach((_item, idx) => {
    markers.push({ marker: `__DISCOURSE_IMG_${idx}__`, type: 'image', index: idx })
  })
  carousels.forEach((_item, idx) => {
    markers.push({ marker: `__DISCOURSE_CAROUSEL_${idx}__`, type: 'carousel', index: idx })
  })

  const segments: ParsedContent['segments'] = []
  let cursor = 0

  const pushHtmlChunk = (chunk: string) => {
    if (chunk && chunk.trim().length > 0) {
      segments.push({ type: 'html', html: chunk })
    }
  }

  while (cursor < html.length) {
    let nextIndex = -1
    let nextMarker: (typeof markers)[number] | null = null
    for (const marker of markers) {
      const idx = html.indexOf(marker.marker, cursor)
      if (idx !== -1 && (nextIndex === -1 || idx < nextIndex)) {
        nextIndex = idx
        nextMarker = marker
      }
    }
    if (nextIndex === -1 || !nextMarker) break

    const chunk = html.slice(cursor, nextIndex)
    pushHtmlChunk(chunk)

    if (nextMarker.type === 'image') {
      const src = images[nextMarker.index]
      if (src) segments.push({ type: 'image', src })
    } else {
      const items = carousels[nextMarker.index] || []
      if (items.length > 0) segments.push({ type: 'carousel', images: items })
    }

    cursor = nextIndex + nextMarker.marker.length
  }

  if (cursor < html.length) {
    pushHtmlChunk(html.slice(cursor))
  }

  if (segments.length === 0) {
    segments.push({ type: 'html', html })
  }

  const cleanedHtml = segments
    .filter(segment => segment.type === 'html')
    .map(segment => segment.html)
    .join('')

  return { html: cleanedHtml, images, segments }
}
