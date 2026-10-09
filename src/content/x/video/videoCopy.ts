import { createE } from '../../utils/dom/createEl'
import { isXMainHost } from '../utils'

/**
 * X plays most videos through MediaSource blob: URLs, which cannot be fetched
 * as standalone MP4s. Resolve a public tweet's progressive MP4 on click.
 * Do not cache the URL in the button: X reuses tweet/player DOM while scrolling.
 */
type VideoAction = 'copy' | 'download'

interface VideoResponse {
  success: boolean
  data?: { url: string; filename: string; downloadId?: number }
  error?: string
}

const VIDEO_SELECTOR = '[data-testid="videoComponent"], [data-testid="videoPlayer"]'
const PHOTO_SELECTOR = '[data-testid="tweetPhoto"]'
const PLAY_SELECTOR =
  '[data-testid="playButton"], [aria-label="Play"], [aria-label*="Play video" i], ' +
  '[aria-label*="Embedded video" i], [aria-label*="GIF" i]'

function isVideoPoster(photo: HTMLElement): boolean {
  return (
    !!photo.querySelector(PLAY_SELECTOR) ||
    !!photo.parentElement?.querySelector(PLAY_SELECTOR)
  )
}

function videoRoots(scope: ParentNode): HTMLElement[] {
  const roots = new Set<HTMLElement>()
  scope.querySelectorAll<HTMLElement>(VIDEO_SELECTOR).forEach(root => {
    if (!root.parentElement?.closest(VIDEO_SELECTOR)) roots.add(root)
  })

  scope.querySelectorAll('video').forEach(video => {
    if (!video.closest(VIDEO_SELECTOR)) {
      const parent = video.parentElement
      if (parent) roots.add(parent)
    }
  })

  // Before playback, X can show only a poster and play button, no <video>.
  scope.querySelectorAll<HTMLElement>(PHOTO_SELECTOR).forEach(photo => {
    if (!photo.closest(VIDEO_SELECTOR) && isVideoPoster(photo)) roots.add(photo)
  })

  return [...roots].sort((a, b) =>
    a === b ? 0 : a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
  )
}

function tweetIdFor(root: HTMLElement): string | null {
  const article = root.closest('article')
  if (article) {
    const links = article.querySelectorAll<HTMLAnchorElement>('a[href*="/status/"]')
    // Quoted tweets can have different IDs; prefer the enclosing tweet's timestamp.
    for (const link of links) {
      const id = link.getAttribute('href')?.match(/\/status\/(\d+)/)?.[1]
      if (id && link.querySelector('time')) return id
    }
    for (const link of links) {
      const id = link.getAttribute('href')?.match(/\/status\/(\d+)/)?.[1]
      if (id) return id
    }
  }
  return window.location.pathname.match(/\/status\/(\d+)/)?.[1] || null
}

function videoIndexFor(root: HTMLElement): number {
  const article = root.closest('article')
  if (!article) return 0
  return Math.max(0, videoRoots(article).indexOf(root))
}

function directMp4For(root: HTMLElement): string | null {
  const video = root.matches('video')
    ? (root as HTMLVideoElement)
    : root.querySelector('video')
  if (!video) return null
  const sources = [
    video.currentSrc,
    video.src,
    ...Array.from(video.querySelectorAll('source')).map(source => source.src)
  ]
  for (const raw of sources) {
    try {
      const url = new URL(raw)
      if (
        url.protocol === 'https:' &&
        (url.hostname === 'video.twimg.com' || url.hostname.endsWith('.twimg.com')) &&
        /\.mp4$/i.test(url.pathname)
      ) {
        return url.toString()
      }
    } catch {
      // Ignore blob:, empty, and malformed player sources.
    }
  }
  return null
}

function requestVideo(
  tweetId: string,
  index: number,
  action: VideoAction,
  fallbackUrl: string | null
): Promise<VideoResponse> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { type: 'X_VIDEO_MEDIA', tweetId, index, action, fallbackUrl: fallbackUrl || undefined },
      (response: VideoResponse) => {
        const error = chrome.runtime.lastError
        if (error) reject(new Error(error.message))
        else resolve(response)
      }
    )
  })
}

async function copyText(value: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(value)
  } catch {
    // Some browser versions drop transient user activation during API lookup.
    const input = document.createElement('textarea')
    input.value = value
    input.style.position = 'fixed'
    input.style.opacity = '0'
    document.body.appendChild(input)
    input.select()
    const copied = document.execCommand('copy')
    input.remove()
    if (!copied) throw new Error('无法复制到剪贴板')
  }
}

function buttonFor(action: VideoAction): HTMLButtonElement {
  const isDownload = action === 'download'
  const btn = createE('button', {
    class: isDownload ? 'x-video-download-btn' : 'x-video-copy-btn',
    type: 'button',
    ti: isDownload ? '下载 MP4 视频' : '复制 MP4 直链',
    text: isDownload ? '⬇️' : '📋',
    style:
      'position:absolute;top:8px;right:' +
      (isDownload ? '8px' : '48px') +
      ';z-index:99999;cursor:pointer;border-radius:7px;padding:6px 8px;' +
      'background:rgba(0,0,0,.72);color:#fff;border:1px solid rgba(255,255,255,.25);' +
      'font-weight:700;line-height:1.4;pointer-events:auto;'
  })
  btn.setAttribute('aria-label', btn.title)
  return btn
}

function showStatus(btn: HTMLButtonElement, status: 'success' | 'error', original: string) {
  btn.textContent = status === 'success' ? '✓' : '⚠'
  btn.style.background = status === 'success' ? '#059669' : '#dc2626'
  setTimeout(() => {
    if (!btn.isConnected) return
    btn.textContent = original
    btn.style.background = 'rgba(0,0,0,.72)'
    btn.disabled = false
  }, 1800)
}

async function handleClick(root: HTMLElement, btn: HTMLButtonElement, action: VideoAction) {
  if (btn.disabled) return
  const original = btn.textContent || '⬇️'
  btn.disabled = true
  btn.textContent = '…'
  try {
    const tweetId = tweetIdFor(root)
    const fallbackUrl = directMp4For(root)
    if (!tweetId) {
      if (action === 'copy' && fallbackUrl) {
        await copyText(fallbackUrl)
        showStatus(btn, 'success', original)
        return
      }
      throw new Error('找不到视频所属的推文 ID')
    }
    const result = await requestVideo(tweetId, videoIndexFor(root), action, fallbackUrl)
    if (!result?.success || !result.data?.url) {
      throw new Error(result?.error || '无法解析 MP4 地址')
    }
    if (action === 'copy') await copyText(result.data.url)
    showStatus(btn, 'success', original)
  } catch (error) {
    console.warn('[XVideoCopy] MP4 操作失败:', error)
    btn.title = error instanceof Error ? error.message : String(error)
    showStatus(btn, 'error', original)
  }
}

function attachButtons(root: HTMLElement) {
  if (!root.closest('article') && !/\/status\/\d+/.test(location.pathname)) return

  if (getComputedStyle(root).position === 'static') root.style.position = 'relative'
  for (const action of ['download', 'copy'] as const) {
    const selector = action === 'download' ? '.x-video-download-btn' : '.x-video-copy-btn'
    if (root.querySelector(':scope > ' + selector)) continue
    const btn = buttonFor(action)
    btn.addEventListener('click', event => {
      event.preventDefault()
      event.stopPropagation()
      void handleClick(root, btn, action)
    })
    root.appendChild(btn)
  }
}

function scan() {
  videoRoots(document).forEach(root => {
    try {
      attachButtons(root)
    } catch (error) {
      console.warn('[XVideoCopy] 注入失败:', error)
    }
  })
}

let observer: MutationObserver | null = null
let pendingFrame = 0

export function initVideoCopy(): void {
  if (!isXMainHost() || observer) return
  scan()
  observer = new MutationObserver(() => {
    if (pendingFrame) return
    pendingFrame = requestAnimationFrame(() => {
      pendingFrame = 0
      scan()
    })
  })
  observer.observe(document.documentElement, { childList: true, subtree: true })
  console.log('[XVideoCopy] X MP4 controls initialized')
}

export function cleanupVideoCopy(): void {
  observer?.disconnect()
  observer = null
  if (pendingFrame) cancelAnimationFrame(pendingFrame)
  pendingFrame = 0
}
