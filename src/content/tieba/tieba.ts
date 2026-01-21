import { AddEmojiButtonData, extractNameFromUrl } from '../x/utils'
import { DQSA, createE } from '../utils/createEl'

const SELECTOR = 'div.lazy-img-wrapper'
const BUTTON_CLASS = 'tieba-emoji-add-btn'
const SCAN_DELAY_MS = 200
const INIT_DELAY_MS = 200
const FEEDBACK_DISPLAY_MS = 1500

function isTiebaPage(): boolean {
  try {
    const host = window.location.hostname.toLowerCase()
    return host.includes('tieba.baidu.com')
  } catch {
    return false
  }
}

function normalizeUrl(raw: string): string | null {
  if (!raw) return null
  let url = raw.trim()
  if (url.startsWith('//')) url = `https:${url}`
  else if (url.startsWith('/')) url = `${window.location.origin}${url}`
  if (!/^https?:\/\//i.test(url)) return null
  return url
}

function extractTiebaImageUrl(container: Element): string | null {
  const img = container.querySelector('img') as HTMLImageElement | null
  if (!img) return null
  const raw = img.getAttribute('data-src') || img.getAttribute('src') || img.src || ''
  return normalizeUrl(raw)
}

function getImageDimensions(img: HTMLImageElement): { width: number; height: number } | null {
  const naturalWidth = img.naturalWidth || 0
  const naturalHeight = img.naturalHeight || 0
  if (naturalWidth > 0 && naturalHeight > 0) {
    return { width: naturalWidth, height: naturalHeight }
  }

  const widthAttr = Number.parseInt(img.getAttribute('width') || '', 10)
  const heightAttr = Number.parseInt(img.getAttribute('height') || '', 10)
  if (Number.isFinite(widthAttr) && widthAttr > 0 && Number.isFinite(heightAttr) && heightAttr > 0) {
    return { width: widthAttr, height: heightAttr }
  }

  const rect = img.getBoundingClientRect()
  if (rect.width > 0 && rect.height > 0) {
    return { width: Math.round(rect.width), height: Math.round(rect.height) }
  }

  return null
}

function setupTiebaButtonClick(
  button: HTMLElement,
  img: HTMLImageElement,
  baseData: AddEmojiButtonData
) {
  button.addEventListener('click', async e => {
    e.preventDefault()
    e.stopPropagation()
    const orig = button.textContent || '添加表情'
    const origStyle = button.style.cssText
    try {
      const size = getImageDimensions(img)
      const emojiData = {
        ...baseData,
        ...(size ? { width: size.width, height: size.height } : {})
      }
      await chrome.runtime.sendMessage({ action: 'addEmojiFromWeb', emojiData })
      button.textContent = '已添加'
      button.style.background = 'linear-gradient(135deg,#10b981,#059669)'
      setTimeout(() => {
        button.textContent = orig
        button.style.cssText = origStyle
      }, FEEDBACK_DISPLAY_MS)
    } catch (err) {
      console.error('[TiebaAddEmoji] 添加失败', err)
      button.textContent = '失败'
      button.style.background = 'linear-gradient(135deg,#ef4444,#dc2626)'
      setTimeout(() => {
        button.textContent = orig
        button.style.cssText = origStyle
      }, FEEDBACK_DISPLAY_MS)
    }
  })
}

function createTiebaButton(img: HTMLImageElement, data: AddEmojiButtonData): HTMLElement {
  const btn = createE('button', {
    class: BUTTON_CLASS,
    type: 'button',
    ti: '添加表情',
    in: '添加表情',
    style: `
      position: absolute;
      top: 8px;
      right: 8px;
      z-index: 100000;
      cursor: pointer;
      border-radius: 6px;
      padding: 6px 10px;
      background: rgba(0,0,0,0.65);
      color: #fff;
      border: none;
      font-size: 12px;
      line-height: 1;
      white-space: nowrap;
      box-shadow: 0 2px 6px rgba(0,0,0,0.25);
    `
  })
  setupTiebaButtonClick(btn, img, data)
  return btn
}

function addButtonToContainer(container: Element): void {
  try {
    if (!container) return
    if (container.querySelector(`.${BUTTON_CLASS}`) || container.querySelector('.emoji-add-link-pixiv'))
      return

    const img = container.querySelector('img') as HTMLImageElement | null
    if (!img) return

    const url = extractTiebaImageUrl(container)
    if (!url) return

    const name = extractNameFromUrl(url)
    const data: AddEmojiButtonData = { name, url }
    const btn = createTiebaButton(img, data)

    const parent = container as HTMLElement
    const computed = window.getComputedStyle(parent)
    if (computed.position === 'static' || !computed.position) parent.style.position = 'relative'

    parent.appendChild(btn)
  } catch (e) {
    console.error('[TiebaAddEmoji] addButtonToContainer failed', e)
  }
}

function scanTiebaImages(): void {
  try {
    const containers = Array.from(DQSA(SELECTOR))
    containers.forEach(container => addButtonToContainer(container))
  } catch (e) {
    console.error('[TiebaAddEmoji] scanTiebaImages failed', e)
  }
}

let tiebaObserver: MutationObserver | null = null
let debounceTimer: number | null = null

function observeTieba(): void {
  if (tiebaObserver) return
  tiebaObserver = new MutationObserver(mutations => {
    let shouldScan = false
    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType !== 1) return
          const el = node as Element
          if (el.matches && el.matches(SELECTOR)) shouldScan = true
          else if (el.querySelector && el.querySelector(SELECTOR)) shouldScan = true
          else if (el.tagName === 'IMG') shouldScan = true
        })
      } else if (mutation.type === 'attributes') {
        const tgt = mutation.target as Element
        if (tgt.tagName === 'IMG') shouldScan = true
      }
      if (shouldScan) break
    }

    if (shouldScan) {
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = window.setTimeout(() => {
        scanTiebaImages()
        debounceTimer = null
      }, SCAN_DELAY_MS)
    }
  })

  try {
    tiebaObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src', 'data-src']
    })
  } catch (e) {
    console.error('[TiebaAddEmoji] observeTieba failed to attach observer', e)
  }
}

export function initTieba(): void {
  try {
    if (!isTiebaPage()) return
    setTimeout(() => {
      scanTiebaImages()
      observeTieba()
    }, INIT_DELAY_MS)
    console.log('[TiebaAddEmoji] initialized')
  } catch (e) {
    console.error('[TiebaAddEmoji] init failed', e)
  }
}
