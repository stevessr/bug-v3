import {
  normalizeUrl,
  extractImageUrl,
  extractNameFromUrl,
  setupButtonClick,
  AddEmojiButtonData,
  isXMediaHost
} from '../utils'

const carouselOverlayMap = new WeakMap<Element, { btn: HTMLElement; raf?: number }>()
const processedElements = new WeakSet<Element>()

function markInjected(...elements: (Element | null | undefined)[]) {
  for (const el of elements) {
    if (!el) continue
    if (!processedElements.has(el)) {
      processedElements.add(el)
    }
    el.classList.add('injected')
  }
}

function isInjected(el: Element | null | undefined): boolean {
  if (!el) return false
  return processedElements.has(el) || el.classList.contains('injected')
}

function clearInjected(el: Element | null | undefined) {
  if (!el) return
  el.classList.remove('injected')
  processedElements.delete(el)
}

function createCarouselBtn(data: AddEmojiButtonData) {
  const btn = document.createElement('button')
  btn.className = 'x-emoji-add-btn-carousel'
  btn.type = 'button'
  btn.title = '添加到未分组表情'
  btn.setAttribute('aria-label', '添加表情')
  btn.setAttribute('role', 'button')

  btn.innerHTML = `
    <div dir="ltr" style="color: rgb(255, 255, 255);">
      <div></div>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <g><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"></path></g>
        </svg>
    </div>
  `

  btn.style.cssText = `
    background: rgba(0, 0, 0, 0.6);
    border: none;
    cursor: pointer;
    color: rgb(255, 255, 255);
    padding: 0;
    margin: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 9999px;
    transition: background-color 0.2s ease;
    min-height: 32px;
    min-width: 32px;
    z-index: 9999;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    backdrop-filter: blur(4px);
  `
    .replace(/\s+/g, ' ')
    .trim()

  btn.addEventListener('mouseenter', () => {
    btn.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'
  })
  btn.addEventListener('mouseleave', () => {
    btn.style.backgroundColor = 'transparent'
  })

  btn.style.pointerEvents = 'auto'
  setupButtonClick(btn, data)
  return btn
}

function findButtonMenuBar(carouselElement: Element): Element | null {
  let current: Element | null = carouselElement
  while (current && current !== document.body) {
    const parent: HTMLElement | null = current.parentElement
    if (parent) {
      const groupElements = parent.querySelectorAll('[role="group"]')
      for (const group of groupElements) {
        const ariaLabel = group.getAttribute('aria-label') || ''
        if (ariaLabel.match(/replie?s?|repost|like|view|bookmark|点赞|转发|回复|查看|收藏/i)) {
          return group
        }
      }
    }
    current = parent
  }
  let searchRoot: Element | null = carouselElement
  while (searchRoot && searchRoot !== document.body) {
    const parent: HTMLElement | null = searchRoot.parentElement
    if (parent) {
      const buttonContainers = parent.querySelectorAll('[role="group"]')
      for (const container of buttonContainers) {
        const hasReplyButton = container.querySelector(
          '[data-testid="reply"], [aria-label*="reply"], [aria-label*="回复"]'
        )
        const hasLikeButton = container.querySelector(
          '[data-testid="like"], [aria-label*="like"], [aria-label*="点赞"]'
        )
        const hasRetweetButton = container.querySelector(
          '[data-testid="retweet"], [aria-label*="repost"], [aria-label*="转发"]'
        )
        const svgIcons = container.querySelectorAll('svg')
        const buttons = container.querySelectorAll('button, a[role="link"]')
        if (
          (hasReplyButton || hasLikeButton || hasRetweetButton) &&
          buttons.length >= 3 &&
          svgIcons.length >= 3
        ) {
          return container
        }
      }

      const allContainers = parent.querySelectorAll('div')
      for (const container of allContainers) {
        const buttons = container.querySelectorAll('button, a[role="link"]')
        const svgs = container.querySelectorAll('svg')
        if (buttons.length >= 4 && svgs.length >= 4) {
          const style = window.getComputedStyle(container)
          const isHorizontal =
            style.display === 'flex' ||
            style.display === 'inline-flex' ||
            container.children.length >= 4
          if (isHorizontal) {
            let socialButtonCount = 0
            for (const button of buttons) {
              const ariaLabel = button.getAttribute('aria-label') || ''
              const testId = button.getAttribute('data-testid') || ''
              if (
                ariaLabel.match(
                  /reply|like|repost|share|view|bookmark|回复|点赞|转发|分享|查看|收藏/i
                ) ||
                testId.match(/reply|like|retweet|share/i)
              ) {
                socialButtonCount++
              }
            }
            if (socialButtonCount >= 2) {
              return container
            }
          }
        }
      }
    }
    searchRoot = parent
  }
  return null
}

function createMenuBarBtn(data: AddEmojiButtonData, menuBar: Element) {
  const wrapper = document.createElement('div')
  wrapper.className = 'css-175oi2r r-18u37iz r-1h0z5md r-13awgt0'
  const btn = createCarouselBtn(data)
  btn.classList.add(
    'css-175oi2r',
    'r-1777fci',
    'r-bt1l66',
    'r-bztko3',
    'r-lrvibr',
    'r-1loqt21',
    'r-1ny4l3l'
  )
  wrapper.appendChild(btn)
  menuBar.appendChild(wrapper)
  return btn
}

function createCarouselOverlayBtn(data: AddEmojiButtonData, target: Element) {
  const existing = carouselOverlayMap.get(target)
  if (existing) return existing.btn
  const btn = createCarouselBtn(data)
  btn.style.position = 'absolute'
  btn.style.zIndex = '2147483647'
  btn.style.background = 'rgba(0,0,0,0.6)'
  btn.style.pointerEvents = 'auto'
  document.body.appendChild(btn)
  markInjected(target)
  let raf = 0
  const update = () => {
    try {
      if (!document.body.contains(target)) {
        cancelAnimationFrame(raf)
        if (btn.parentElement) btn.parentElement.removeChild(btn)
        carouselOverlayMap.delete(target)
        clearInjected(target)
        return
      }
      const r = (target as Element).getBoundingClientRect()
      const top = Math.max(0, window.scrollY + r.top + 6)
      const left = Math.max(0, window.scrollX + r.right - btn.offsetWidth - 6)
      btn.style.top = top + 'px'
      btn.style.left = left + 'px'
      const inView =
        r.bottom >= 0 && r.top <= window.innerHeight && r.right >= 0 && r.left <= window.innerWidth
      btn.style.display = inView ? '' : 'none'
    } catch {
      /* ignore */
    }
    raf = requestAnimationFrame(update)
    carouselOverlayMap.set(target, { btn, raf })
  }
  raf = requestAnimationFrame(update)
  carouselOverlayMap.set(target, { btn, raf })
  return btn
}

function isInCarousel(el: Element): boolean {
  return !!(
    el.closest('[role="group"][aria-roledescription="carousel"]') ||
    el.closest('li[role="listitem"]') ||
    el.closest('[data-testid="swipe-to-dismiss"]') ||
    el
      .closest('div[style*="position: relative"]')
      ?.querySelector('[data-testid="swipe-to-dismiss"]') ||
    el.closest('[role="dialog"]') ||
    el.closest('[aria-modal="true"]') ||
    (el.closest('article[data-testid="tweet"]') &&
      (el.closest('div[aria-label="Image"]') || el.matches('div[aria-label="Image"]')))
  )
}

function addCarouselButtonToEl(el: Element) {
  try {
    const isPbsHost = isXMediaHost()
    if (!isInCarousel(el) && !(isPbsHost && el instanceof HTMLImageElement)) return
    if (
      isInjected(el) ||
      el.querySelector('.x-emoji-add-btn-carousel') ||
      el.querySelector('.x-emoji-add-btn') ||
      el.closest('.x-emoji-add-btn-carousel') ||
      el.closest('.x-emoji-add-btn')
    ) {
      markInjected(el)
      return
    }

    let targetContainer: HTMLElement | null = null
    let url: string | null = null

    const finalizeTarget = (container: HTMLElement | null, resolvedUrl: string | null) => {
      targetContainer = container
      url = resolvedUrl
    }

    if (el instanceof HTMLImageElement) {
      const imgEl = el
      const altText = imgEl.getAttribute('alt') || ''
      const src = imgEl.src || imgEl.getAttribute('src') || ''
      const lowerSrc = (src || '').toLowerCase()
      const looksLikeTwitterMedia =
        lowerSrc.includes('pbs.twimg.com') || lowerSrc.includes('twimg.com')
      if (altText && !looksLikeTwitterMedia) return

      let parent = imgEl.parentElement
      while (parent && parent !== document.body) {
        if (parent.querySelector('.x-emoji-add-btn-carousel') || isInjected(parent)) return
        const style = window.getComputedStyle(parent)
        const backgroundImage = style.backgroundImage && style.backgroundImage !== 'none'
        const positioned = style.position !== 'static'
        if (backgroundImage || positioned) {
          finalizeTarget(parent, extractImageUrl(parent) || normalizeUrl(imgEl.src))
          break
        }
        parent = parent.parentElement
      }
      if (!targetContainer && imgEl.parentElement) {
        finalizeTarget(imgEl.parentElement as HTMLElement, normalizeUrl(imgEl.src))
      }
    } else {
      const containedImg = el.querySelector('img') as HTMLImageElement | null
      if (containedImg) {
        const altText = containedImg.getAttribute('alt') || ''
        const src = containedImg.src || containedImg.getAttribute('src') || ''
        const lowerSrc = (src || '').toLowerCase()
        const looksLikeTwitterMedia =
          lowerSrc.includes('pbs.twimg.com') || lowerSrc.includes('twimg.com')
        if (altText && !looksLikeTwitterMedia) return
      }
      finalizeTarget(el as HTMLElement, extractImageUrl(el))
    }

    if (!targetContainer || !url) return
    if (url.includes('profile_images')) return

    if (isInjected(targetContainer)) {
      markInjected(el, targetContainer)
      return
    }

    const name = extractNameFromUrl(url)

    try {
      const parsedUrl = new URL(url)
      const pathname = parsedUrl.pathname.toLowerCase()
      const formatParam = (parsedUrl.searchParams.get('format') || '').toLowerCase()
      if (pathname.endsWith('.svg') || formatParam === 'svg') return
    } catch {
      if (url.toLowerCase().includes('.svg')) return
    }

    const handled = tryInjectTwitterMedia(url, targetContainer, createCarouselOverlayBtn)

    if (handled) {
      markInjected(el, targetContainer)
      return
    }

    const menuBar = findButtonMenuBar(targetContainer)
    if (menuBar && !menuBar.querySelector('.x-emoji-add-btn-carousel')) {
      createMenuBarBtn({ name, url }, menuBar)
      markInjected(el, targetContainer, menuBar)
      console.log('[XCarousel] Added button to menu bar')
      return
    }

    const parent = targetContainer
    const computed = window.getComputedStyle(parent)
    const shouldUseOverlay = /hidden|auto|scroll/.test(computed.overflow || '') || true
    if (computed.position === 'static' || !computed.position) parent.style.position = 'relative'

    if (shouldUseOverlay) {
      createCarouselOverlayBtn({ name, url }, parent)
      markInjected(el, parent)
      return
    }

    const btn = createCarouselBtn({ name, url })
    parent.appendChild(btn)
    markInjected(el, parent)

    try {
      const r = btn.getBoundingClientRect()
      const cx = Math.round(r.left + r.width / 2)
      const cy = Math.round(r.top + r.height / 2)
      const topEl = document.elementFromPoint(cx, cy)
      if (topEl !== btn && !btn.contains(topEl)) {
        if (btn.parentElement) btn.parentElement.removeChild(btn)
        createCarouselOverlayBtn({ name, url }, parent)
      }
    } catch {
      /* ignore */
    }
  } catch (err) {
    console.log('[XCarousel] Failed to inject button:', err)
  }
}

export function scanAndInjectCarousel() {
  const selectors = [
    '[role="group"][aria-roledescription="carousel"] div[aria-label="Image"]',
    '[role="group"][aria-roledescription="carousel"] div[style*="background-image"]',
    '[role="group"][aria-roledescription="carousel"] img',
    'li[role="listitem"] div[aria-label="Image"]',
    'li[role="listitem"] div[style*="background-image"]',
    'li[role="listitem"] img',
    '[data-testid="swipe-to-dismiss"] div[aria-label="Image"]',
    '[data-testid="swipe-to-dismiss"] div[style*="background-image"]',
    '[data-testid="swipe-to-dismiss"] img',
    '[role="dialog"] div[aria-label="Image"]',
    '[role="dialog"] div[style*="background-image"]',
    '[role="dialog"] img',
    '[aria-modal="true"] div[aria-label="Image"]',
    '[aria-modal="true"] div[style*="background-image"]',
    '[aria-modal="true"] img',
    'article[data-testid="tweet"] div[aria-label="Image"]'
  ]

  const set = new Set<Element>()
  selectors.forEach(s => document.querySelectorAll(s).forEach(el => set.add(el)))
  // Special-case: when visiting a standalone twitter/pbs image page the document
  // may simply contain one or more top-level <img> elements (or an image inside
  // a minimal wrapper). Add any images whose src points to pbs.twimg.com so they
  // are picked up by the existing injection logic.
  try {
    if (isXMediaHost()) {
      document.querySelectorAll('img').forEach(img => {
        const src = (img as HTMLImageElement).src || img.getAttribute('src') || ''
        if (src && src.includes('pbs.twimg.com')) set.add(img)
      })
    }
  } catch {
    // ignore
  }
  set.forEach(el => addCarouselButtonToEl(el))

  console.log(`[XCarousel] Processed ${set.size} carousel elements`)
}

function tryInjectTwitterMedia(
  url: string,
  targetContainer: Element,
  createOverlayFn: (data: AddEmojiButtonData, target: Element) => HTMLElement | void
): boolean {
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.toLowerCase()
    const isTwitterMedia = host === 'pbs.twimg.com' && parsed.pathname.includes('/media/')
    const pathname = parsed.pathname.toLowerCase()
    const formatParam = (parsed.searchParams.get('format') || '').toLowerCase()
    if (pathname.endsWith('.svg') || formatParam === 'svg') return false
    if (!isTwitterMedia) return false

    if (targetContainer.querySelector('.x-emoji-add-btn-carousel')) return true
    if (targetContainer.classList.contains('injected')) return true

    let imgEl: HTMLImageElement | null = null
    if (targetContainer instanceof HTMLImageElement) imgEl = targetContainer
    else imgEl = targetContainer.querySelector('img') as HTMLImageElement | null

    const target = (imgEl as Element) || targetContainer
    if (target.classList.contains('injected')) return true
    const name = parsed.pathname.split('/').pop()?.split('?')[0] || '表情'

    try {
      createOverlayFn({ name, url }, target)
      targetContainer.classList.add('injected')
      target.classList.add('injected')
      console.log('[TwitterMedia] injected floating overlay for media:', url)
      return true
    } catch (error) {
      console.log('[TwitterMedia] overlay injection failed', error)
      return false
    }
  } catch (error) {
    console.log('[TwitterMedia] error processing URL:', url, error)
    return false
  }
}

let carouselObserver: MutationObserver | null = null
let carouselDebounceTimer: number | null = null

export function observeCarousel() {
  if (carouselObserver) return carouselObserver

  carouselObserver = new MutationObserver(ms => {
    let needsScan = false

    for (const m of ms) {
      // Only react to additions of elements that are <img> or contain <img>
      if (m.type === 'childList') {
        for (const n of Array.from(m.addedNodes)) {
          if (n.nodeType !== 1) continue
          const el = n as Element
          if (el.tagName === 'IMG' || (el.querySelector && el.querySelector('img'))) {
            needsScan = true
            break
          }
        }
        if (needsScan) break
      }

      // React to attribute changes only when the target is an <img> or the
      // attribute change occurs on an element that contains an <img> (e.g. style->background-image)
      if (m.type === 'attributes') {
        const tgt = m.target as Element
        if (!tgt) continue
        if (tgt.tagName === 'IMG') {
          // attribute changes on <img> (e.g. src) are relevant
          needsScan = true
          break
        }
        try {
          if (tgt.querySelector && tgt.querySelector('img')) {
            needsScan = true
            break
          }
        } catch {
          /* ignore */
        }
      }
    }

    if (needsScan) {
      if (carouselDebounceTimer) clearTimeout(carouselDebounceTimer)
      carouselDebounceTimer = window.setTimeout(() => {
        try {
          scanAndInjectCarousel()
        } catch (e) {
          void e
        }
        carouselDebounceTimer = null
      }, 250)
    }
  })

  try {
    carouselObserver.observe(document.body, { childList: true, subtree: true, attributes: true })
  } catch {
    // ignore if document.body not ready
  }

  return carouselObserver
}
