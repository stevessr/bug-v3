import {
  normalizeUrl,
  extractImageUrl,
  extractNameFromUrl,
  setupButtonClick,
  AddEmojiButtonData
} from '../utils'

import { tryInjectTwitterMedia } from './twitterMediaInject'

declare const chrome: any

const carouselOverlayMap = new WeakMap<Element, { btn: HTMLElement; raf?: number }>()

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
  let raf = 0
  const update = () => {
    try {
      if (!document.body.contains(target)) {
        cancelAnimationFrame(raf)
        if (btn.parentElement) btn.parentElement.removeChild(btn)
        carouselOverlayMap.delete(target)
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
    } catch (e) {
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
    if (!isInCarousel(el)) return
    if (
      el.querySelector('.x-emoji-add-btn-carousel') ||
      el.querySelector('.x-emoji-add-btn') ||
      el.closest('.x-emoji-add-btn-carousel') ||
      el.closest('.x-emoji-add-btn')
    )
      return

    let targetContainer: HTMLElement | null = null
    let url: string | null = null

    if (el instanceof HTMLImageElement) {
      const imgEl = el as HTMLImageElement
      if (imgEl.getAttribute('alt') !== '') {
        return
      }
      let parent = imgEl.parentElement
      while (parent && parent !== document.body) {
        if (parent.querySelector('.x-emoji-add-btn-carousel')) return
        const style = window.getComputedStyle(parent)
        const hasBackgroundImage = style.backgroundImage && style.backgroundImage !== 'none'
        const hasPositioning = style.position !== 'static'
        if (hasBackgroundImage || hasPositioning) {
          targetContainer = parent
          url = extractImageUrl(parent) || normalizeUrl(imgEl.src)
          break
        }
        parent = parent.parentElement
      }
      if (!targetContainer && imgEl.parentElement) {
        targetContainer = imgEl.parentElement as HTMLElement
        url = normalizeUrl(imgEl.src)
      }
    } else {
      const containedImg = el.querySelector('img') as HTMLImageElement | null
      if (containedImg && containedImg.getAttribute('alt') !== '') {
        return
      }
      targetContainer = el as HTMLElement
      url = extractImageUrl(el)
    }

    if (!targetContainer || !url) return
    if (url.includes('profile_images')) return
    const name = extractNameFromUrl(url)

    const handled = tryInjectTwitterMedia(url, targetContainer, createCarouselOverlayBtn)

    if (!handled) {
      const menuBar = findButtonMenuBar(targetContainer)
      if (menuBar && !menuBar.querySelector('.x-emoji-add-btn-carousel')) {
        createMenuBarBtn({ name, url }, menuBar)
        console.log('[XCarousel] Added button to menu bar')
      } else {
        const parent = targetContainer
        const computed = window.getComputedStyle(parent)
        const shouldUseOverlay = /hidden|auto|scroll/.test(computed.overflow || '') || true
        if (computed.position === 'static' || !computed.position) parent.style.position = 'relative'
        if (shouldUseOverlay) {
          createCarouselOverlayBtn({ name, url }, parent)
        } else {
          const btn = createCarouselBtn({ name, url })
          parent.appendChild(btn)
          try {
            const r = btn.getBoundingClientRect()
            const cx = Math.round(r.left + r.width / 2)
            const cy = Math.round(r.top + r.height / 2)
            const topEl = document.elementFromPoint(cx, cy)
            if (topEl !== btn && !btn.contains(topEl)) {
              if (btn.parentElement) btn.parentElement.removeChild(btn)
              createCarouselOverlayBtn({ name, url }, parent)
            }
          } catch (e) {
            /* ignore */
          }
        }
      }
    }
  } catch (e) {
    void e
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
    const host = window.location.hostname.toLowerCase()
    if (host === 'pbs.twimg.com' || host.endsWith('.twimg.com') || host.includes('pbs.twimg')) {
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
