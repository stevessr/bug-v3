import { logger } from './buildFlags'

declare const chrome: any

interface AddEmojiButtonData {
  name: string
  url: string
}

// Duplicate minimal helpers here to avoid circular imports
function extractNameFromUrl(url: string): string {
  try {
    const urlObj = new URL(url)
    const pathname = urlObj.pathname
    const filename = pathname.split('/').pop() || ''

    const nameWithoutExt = filename.replace(/\.[^/.]+$/, '')
    const decoded = decodeURIComponent(nameWithoutExt)
    if (/^[0-9a-f]{8,}$/i.test(decoded) || decoded.length < 2) {
      return '表情'
    }
    return decoded || '表情'
  } catch {
    return '表情'
  }
}

function setupButtonClickHandler(button: HTMLElement, data: AddEmojiButtonData) {
  button.addEventListener('click', async e => {
    e.preventDefault()
    e.stopPropagation()

    const originalContent = button.innerHTML
    const originalStyle = button.style.cssText

    try {
      await chrome.runtime.sendMessage({ action: 'addEmojiFromWeb', emojiData: data })

      button.innerHTML = `\n        <svg class="fa d-icon d-icon-check svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width: 1em; height: 1em; fill: currentColor; margin-right: 4px;">\n          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>\n        </svg>已添加\n      `
      button.style.background = 'linear-gradient(135deg, #10b981, #059669)'
      button.style.color = '#ffffff'
      button.style.border = '2px solid #ffffff'
      button.style.boxShadow = '0 2px 4px rgba(16, 185, 129, 0.3)'

      setTimeout(() => {
        button.innerHTML = originalContent
        button.style.cssText = originalStyle
      }, 2000)
    } catch (error) {
      logger.error('[PixivOneClick] 添加表情失败:', error)
      button.innerHTML = `\n        <svg class="fa d-icon d-icon-times svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width: 1em; height: 1em; fill: currentColor; margin-right: 4px;">\n          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>\n        </svg>失败\n      `
      button.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)'
      button.style.color = '#ffffff'
      button.style.border = '2px solid #ffffff'
      button.style.boxShadow = '0 2px 4px rgba(239, 68, 68, 0.3)'

      setTimeout(() => {
        button.innerHTML = originalContent
        button.style.cssText = originalStyle
      }, 2000)
    }
  })
}

/** Pixiv-specific logic **/
function isPixivViewer(element: Element): boolean {
  try {
    if (!element) return false
    if (element.getAttribute && element.getAttribute('role') === 'presentation') {
      return !!element.querySelector('img[src*="i.pximg.net"]')
    }
    return false
  } catch (_e) {
    return false
  }
}

function extractEmojiDataFromPixiv(container: Element): AddEmojiButtonData | null {
  const img = container.querySelector('img[src*="i.pximg.net"]') as HTMLImageElement | null
  if (!img) return null
  const src = img.src || ''
  if (!src || !src.startsWith('http')) return null
  let name = (img.alt || img.getAttribute('title') || '').trim()
  if (!name || name.length < 2) name = extractNameFromUrl(src)
  name = name.replace(/\.(webp|jpg|jpeg|png|gif)$/i, '').trim()
  if (name.length === 0) name = '表情'
  return { name, url: src }
}

function createPixivEmojiButton(data: AddEmojiButtonData): HTMLElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'emoji-add-link-pixiv'
  button.style.cssText = `
    color: #ffffff;
    background: linear-gradient(135deg, #ef4444, #f97316);
    border: 2px solid rgba(255,255,255,0.9);
    border-radius: 6px;
    padding: 6px 10px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    margin-left: 6px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  `
  button.innerHTML = `\n    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">\n      <path d="M12 4c.55 0 1 .45 1 1v6h6c.55 0 1 .45 1 1s-.45 1-1 1h-6v6c0 .55-.45 1-1 1s-1-.45-1-1v-6H5c-.55 0-1-.45-1-1s.45-1 1-1h6V5c0-.55.45-1 1-1z"/>\n    </svg>\n    添加到表情\n  `
  button.title = '添加到未分组表情'
  setupButtonClickHandler(button, data)
  return button
}

function addEmojiButtonToPixiv(pixivContainer: Element) {
  if (!pixivContainer) return
  if (pixivContainer.querySelector('.emoji-add-link-pixiv')) return
  const emojiData = extractEmojiDataFromPixiv(pixivContainer)
  if (!emojiData) return
  const addButton = createPixivEmojiButton(emojiData)
  const targetButton = pixivContainer.querySelector('button')
  if (targetButton && targetButton.parentElement) {
    targetButton.parentElement.insertBefore(addButton, targetButton)
  } else {
    pixivContainer.appendChild(addButton)
  }
}

function scanForPixivViewer() {
  const candidates = document.querySelectorAll('[role="presentation"]')
  candidates.forEach(c => {
    if (isPixivViewer(c)) addEmojiButtonToPixiv(c)
  })
}

function observePixivViewer() {
  const observer = new MutationObserver(mutations => {
    let shouldScan = false
    mutations.forEach(m => {
      if (m.type === 'childList') {
        m.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as Element
            if (el.getAttribute && el.getAttribute('role') === 'presentation') {
              shouldScan = true
            } else if (el.querySelector && el.querySelector('img[src*="i.pximg.net"]')) {
              shouldScan = true
            }
          }
        })
      }
    })
    if (shouldScan) setTimeout(scanForPixivViewer, 120)
  })
  observer.observe(document.body, { childList: true, subtree: true })
}

export function initPixiv() {
  // 初始扫描与观察器（仅当页面为 Pixiv 时）
  try {
    if (!isPixivPage()) {
      logger.log('[PixivOneClick] skipping init: not a Pixiv page')
      return
    }

    setTimeout(scanForPixivViewer, 100)
    observePixivViewer()
  } catch (e) {
    logger.error('[PixivOneClick] init failed', e)
  }
}

/**
 * 简单判断当前页面是否为 Pixiv：
 * - title 包含 pixiv
 * - meta[property="og:site_name"] 内容为 pixiv
 * - canonical 链接指向 pixiv.net
 * - meta[property="twitter:site"] 或 meta[property="twitter:site"] 包含 pixiv
 */
function isPixivPage(): boolean {
  try {
    // Only inspect meta tags in <head>
    const ogSite =
      document.querySelector('meta[property="og:site_name"]')?.getAttribute('content') || ''
    if (ogSite.toLowerCase().includes('pixiv')) return true

    const twitterMeta =
      document.querySelector('meta[property="twitter:site"]') ||
      document.querySelector('meta[name="twitter:site"]')
    const twitterSite = (twitterMeta && twitterMeta.getAttribute('content')) || ''
    if (twitterSite.toLowerCase().includes('pixiv')) return true

    const desc = document.querySelector('meta[name="description"]')?.getAttribute('content') || ''
    if (desc.toLowerCase().includes('pixiv')) return true

    // og:image may point to embed.pixiv.net or pximg.net
    const ogImage =
      document.querySelector('meta[property="og:image"]')?.getAttribute('content') || ''
    if (
      ogImage.includes('pixiv.net') ||
      ogImage.includes('pximg.net') ||
      ogImage.includes('embed.pixiv.net')
    ) {
      return true
    }

    return false
  } catch (e) {
    logger.error('[PixivOneClick] isPixivPage check failed', e)
    return false
  }
}
