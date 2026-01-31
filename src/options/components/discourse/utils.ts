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
  if (!cooked) return { html: '', images: [] }

  const images: string[] = []
  const seen = new Set<string>()

  const addImage = (url: string) => {
    if (!url) return ''
    const fullUrl = url.startsWith('http') ? url : baseUrl ? `${baseUrl}${url}` : url
    if (!seen.has(fullUrl)) {
      seen.add(fullUrl)
      images.push(fullUrl)
    }
    return fullUrl
  }

  // Step 1: Temporarily replace onebox content with placeholders to protect them
  const oneboxes: string[] = []
  let html = cooked.replace(
    /<aside[^>]*class="[^"]*onebox[^"]*"[^>]*>[\s\S]*?<\/aside>/gi,
    match => {
      const idx = oneboxes.length
      oneboxes.push(match)
      return `<!--ONEBOX_PLACEHOLDER_${idx}-->`
    }
  )

  // Step 2: Replace lightbox-wrapper images with placeholders (these are user-uploaded images)
  html = html.replace(
    /<div class="lightbox-wrapper">[\s\S]*?<a[^>]*href="([^"]+)"[^>]*>[\s\S]*?<img[^>]*src="([^"]+)"[^>]*>[\s\S]*?<\/a>[\s\S]*?<\/div>/gi,
    (_match, fullUrl, _thumbUrl) => {
      const index = images.length
      addImage(fullUrl)
      return `<span class="post-image-placeholder" data-index="${index}"></span>`
    }
  )

  // Step 2.5: Collect lightbox links that are not wrapped with images
  html = html.replace(
    /<a([^>]*class="[^"]*lightbox[^"]*"[^>]*href="([^"]+)"[^>]*)>([\s\S]*?)<\/a>/gi,
    (match, _before, href) => {
      addImage(href)
      return match
    }
  )

  // Step 3: Process regular img tags (non-lightbox, non-onebox)
  html = html.replace(/<img([^>]*)src="([^"]+)"([^>]*)>/gi, (_match, before, src, after) => {
    // Skip emoji images
    if (src.includes('/images/emoji/') || before.includes('emoji') || after.includes('emoji')) {
      return `<img${before}src="${src}"${after}>`
    }
    // Skip avatar images
    if (before.includes('avatar') || after.includes('avatar')) {
      return `<img${before}src="${src}"${after}>`
    }
    // Skip site-icon images (usually in onebox headers, but just in case)
    if (before.includes('site-icon') || after.includes('site-icon')) {
      return `<img${before}src="${src}"${after}>`
    }
    const index = images.length
    addImage(src)
    return `<span class="post-image-placeholder" data-index="${index}"></span>`
  })

  // Step 4: Restore onebox content
  html = html.replace(/<!--ONEBOX_PLACEHOLDER_(\d+)-->/g, (_match, idx) => {
    return oneboxes[parseInt(idx)] || ''
  })

  return { html, images }
}
