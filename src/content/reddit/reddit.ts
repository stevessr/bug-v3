import type { AddEmojiButtonData } from '../pixiv/types'
import { DQSA, createE } from '../utils/dom/createEl'

/** 常量定义 */
const FEEDBACK_DISPLAY_MS = 1500
const BUTTON_DEFAULT_STYLE = `position:absolute;right:8px;top:8px;z-index:100000;cursor:pointer;border-radius:6px;padding:6px 8px;background:rgba(0,0,0,0.6);color:#fff;border:none;font-weight:700;`
const BUTTON_SUCCESS_STYLE = 'linear-gradient(135deg, #10b981, #059669)'
const BUTTON_ERROR_STYLE = 'linear-gradient(135deg, #ef4444, #dc2626)'

/** 存储所有创建的按钮及其清理函数 */
const buttonCleanupFns = new Set<() => void>()

/**
 * 设置按钮反馈样式（成功/失败）
 */
function setButtonFeedback(
  btn: HTMLElement,
  type: 'success' | 'error',
  originalStyle: string
): void {
  btn.textContent = type === 'success' ? '已添加' : '失败'
  btn.style.background = type === 'success' ? BUTTON_SUCCESS_STYLE : BUTTON_ERROR_STYLE

  const timeoutId = setTimeout(() => {
    btn.textContent = '➕'
    btn.style.cssText = originalStyle
  }, FEEDBACK_DISPLAY_MS)

  // 存储 cleanup 函数以防止内存泄漏
  buttonCleanupFns.add(() => clearTimeout(timeoutId))
}

// create a minimal floating button that sends the direct URL to background
function createRedditFloatingButton(data: AddEmojiButtonData): HTMLElement {
  const btn = createE('button', {
    class: 'reddit-emoji-add-btn',
    type: 'button',
    ti: '添加到未分组表情',
    text: '➕',
    style: BUTTON_DEFAULT_STYLE
  })

  const handler = async (ev: Event) => {
    try {
      ev.preventDefault()
      ev.stopPropagation()
    } catch (_e) {
      void _e
    }

    try {
      const chromeAPI = (window as { chrome?: typeof chrome }).chrome
      if (!chromeAPI || !chromeAPI.runtime || !chromeAPI.runtime.sendMessage) {
        console.error('[RedditAddEmoji] Chrome runtime not available')
        return
      }

      // send direct URL to background to avoid converting to base64 in content
      chromeAPI.runtime.sendMessage(
        {
          type: 'ADD_EMOJI_FROM_WEB',
          payload: {
            emojiData: data
          }
        },
        (resp: unknown) => {
          try {
            const response = resp as { success?: boolean }
            if (response && response.success) {
              setButtonFeedback(btn, 'success', BUTTON_DEFAULT_STYLE)
            } else {
              setButtonFeedback(btn, 'error', BUTTON_DEFAULT_STYLE)
            }
          } catch (_e) {
            void _e
          }
        }
      )
    } catch (e) {
      console.error('[RedditAddEmoji] sendMessage failed', e)
    }
  }

  btn.addEventListener('click', handler)
  btn.addEventListener('pointerdown', handler)

  // 存储 cleanup 函数
  const cleanup = () => {
    btn.removeEventListener('click', handler)
    btn.removeEventListener('pointerdown', handler)
  }
  buttonCleanupFns.add(cleanup)

  return btn
}

function isRedditImageContainer(el: Element | null): boolean {
  try {
    if (!el) return false
    // Reddit often uses role="presentation" on its lightbox container
    if (el.getAttribute && el.getAttribute('role') === 'presentation') {
      return !!el.querySelector('img')
    }

    // Post thumbnails / previews may have specific classes - best-effort match
    const className = (el.className || '') as string
    if (className.includes('media-lightbox-img') || className.includes('preview-img')) {
      return !!el.querySelector('img')
    }

    return false
  } catch {
    return false
  }
}

function extractEmojiDataFromReddit(container: Element): AddEmojiButtonData | null {
  try {
    const img = container.querySelector('img') as HTMLImageElement | null
    if (!img || !img.src) return null

    let src = img.getAttribute('src') || img.src || ''
    // prefer the largest candidate from srcset if available
    const srcset = img.getAttribute('srcset') || ''
    if ((!src || src.startsWith('data:')) && srcset) {
      const first = srcset.split(',').pop() || ''
      src = (first.split(' ')[0] || '').trim() || src
    }

    if (!src || !src.startsWith('http')) return null

    let name = (img.getAttribute('alt') || img.getAttribute('title') || '')?.trim() || ''
    if (!name || name.length < 2) name = 'reddit-emoji'

    return { name, url: src }
  } catch {
    return null
  }
}

function addEmojiButtonToContainer(container: Element) {
  try {
    if (!container) return
    if (
      container.querySelector('.reddit-emoji-add-btn') ||
      container.querySelector('.emoji-add-link-pixiv')
    )
      return

    const data = extractEmojiDataFromReddit(container)
    if (!data) return

    const btn = createRedditFloatingButton(data)

    try {
      const parentEl = container as HTMLElement
      const computed = window.getComputedStyle(parentEl)
      if (computed.position === 'static' || !computed.position) parentEl.style.position = 'relative'
    } catch (_e) {
      void _e
    }

    container.appendChild(btn)
  } catch (e) {
    console.error('[RedditAddEmoji] addEmojiButtonToContainer failed', e)
  }
}

function scanForRedditImages() {
  try {
    const candidates = Array.from(DQSA('[role="presentation"], .media-lightbox-img, .preview-img'))
    candidates.forEach(c => {
      if (isRedditImageContainer(c)) addEmojiButtonToContainer(c)
    })

    // fallback: scan images in posts
    const imgs = Array.from(DQSA('img'))
    for (const img of imgs) {
      const parent = img.parentElement
      if (!parent) continue
      if (
        parent.querySelector('.reddit-emoji-add') ||
        parent.querySelector('.emoji-add-link-pixiv')
      )
        continue
      const className = (parent.className || '') as string
      if (
        className.includes('media-lightbox-img') ||
        className.includes('preview-img') ||
        parent.getAttribute('data-test-id') === 'post-content'
      ) {
        addEmojiButtonToContainer(parent)
      }
    }
  } catch (e) {
    console.error('[RedditAddEmoji] scan failed', e)
  }
}

/** MutationObserver 引用，用于清理 */
let redditObserver: MutationObserver | null = null

/** 常量定义 */
const SCAN_DELAY_MS = 120
const INIT_DELAY_MS = 200

function observeReddit() {
  redditObserver = new MutationObserver(ms => {
    let shouldScan = false
    ms.forEach(m => {
      if (m.type === 'childList') {
        m.addedNodes.forEach(node => {
          if (node.nodeType !== Node.ELEMENT_NODE) return
          const el = node as Element
          if (isRedditImageContainer(el)) shouldScan = true
          else if (el.querySelector && el.querySelector('img')) shouldScan = true
        })
      }
    })
    if (shouldScan) {
      setTimeout(scanForRedditImages, SCAN_DELAY_MS)
    }
  })

  redditObserver.observe(document.body, { childList: true, subtree: true })
}

/**
 * 清理函数 - 移除所有事件监听器和观察者
 */
export function cleanupReddit(): void {
  // 断开 MutationObserver
  if (redditObserver) {
    redditObserver.disconnect()
    redditObserver = null
  }

  // 清理所有按钮的事件监听器
  buttonCleanupFns.forEach(cleanup => cleanup())
  buttonCleanupFns.clear()
}

export function initReddit() {
  try {
    const host = window.location.hostname.toLowerCase()
    if (!host.includes('reddit.com') && !host.includes('redd.it')) return
    setTimeout(scanForRedditImages, INIT_DELAY_MS)
    observeReddit()
    console.log('[RedditAddEmoji] initialized')
  } catch (e) {
    console.error('[RedditAddEmoji] init failed', e)
  }
}
