import { logger } from '../../config/buildFLagsV2'

import { tryInjectTwitterMedia } from './twitterMediaInject'

declare const chrome: any

interface AddEmojiButtonData {
  name: string
  url: string
}

// Track overlay buttons attached to body so we can reposition / remove them when target is gone
const carouselOverlayMap = new WeakMap<Element, { btn: HTMLElement; raf?: number }>()

function normalizeUrl(raw: string): string | null {
  if (!raw) return null
  raw = raw.trim()
  // remove surrounding url("...") if present
  const urlMatch = raw.match(/url\((?:\s*['"]?)(.*?)(?:['"]?\s*)\)/)
  if (urlMatch) raw = urlMatch[1]
  // remove query params that are not needed? Keep them; some images require params
  // ensure protocol
  if (raw.startsWith('//')) raw = 'https:' + raw
  else if (raw.startsWith('/')) raw = window.location.origin + raw

  if (raw.includes(',')) raw = raw.split(',')[0]
  raw = raw.split(' ')[0]

  // strip known size suffixes like :large or ?format=jpg&name=large - we keep query but try to strip common suffix markers
  raw = raw.replace(/:large$|:orig$/i, '')

  // validation
  // validation: ensure starts with http(s)
  if (!/^https?:\/\//i.test(raw)) return null

  // optional host whitelist for X/Twitter images to avoid false positives
  try {
    const u = new URL(raw)
    const host = u.hostname.toLowerCase()
    const allowed = ['pbs.twimg.com', 'twimg.com', 'twitter.com', 'x.com', 'pbs.twimg']
    const ok = allowed.some(a => host.endsWith(a) || host.includes(a))
    if (!ok) return null
  } catch {
    return null
  }

  return raw
}

function extractImageUrl(el: Element): string | null {
  // background-image inline style
  const style = (el as HTMLElement).style && (el as HTMLElement).style.backgroundImage
  if (style && style !== 'none') {
    const normalized = normalizeUrl(style)
    if (normalized) return normalized
  }

  // find img tag inside
  const img = el.querySelector('img') as HTMLImageElement | null
  if (img) {
    const src = img.getAttribute('src') || img.getAttribute('data-src') || img.src || ''
    const normalized = normalizeUrl(src)
    if (normalized) return normalized
  }

  // direct src attribute on element
  const elSrc = (el as HTMLImageElement).src
  if (elSrc) return normalizeUrl(elSrc)

  return null
}

function extractNameFromUrl(url: string): string {
  try {
    const u = new URL(url)
    const filename = u.pathname.split('/').pop() || ''
    return decodeURIComponent(filename.replace(/\.[^/.]+$/, '')) || '表情'
  } catch {
    return '表情'
  }
}

function setupButtonClick(button: HTMLElement, data: AddEmojiButtonData) {
  button.addEventListener('click', async e => {
    e.preventDefault()
    e.stopPropagation()
    const orig = button.innerHTML
    const origStyle = button.style.cssText
    try {
      await chrome.runtime.sendMessage({ action: 'addEmojiFromWeb', emojiData: data })
      button.innerHTML = '已添加'
      button.style.background = 'linear-gradient(135deg,#10b981,#059669)'
      setTimeout(() => {
        button.innerHTML = orig
        button.style.cssText = origStyle
      }, 1500)
    } catch (err) {
      logger.error('[XCarousel] 添加失败', err)
      button.innerHTML = '失败'
      button.style.background = 'linear-gradient(135deg,#ef4444,#dc2626)'
      setTimeout(() => {
        button.innerHTML = orig
        button.style.cssText = origStyle
      }, 1500)
    }
  })
}

function createCarouselBtn(data: AddEmojiButtonData) {
  const btn = document.createElement('button')
  btn.className = 'x-emoji-add-btn-carousel'
  btn.type = 'button'
  btn.title = '添加到未分组表情'
  btn.setAttribute('aria-label', '添加表情')
  btn.setAttribute('role', 'button')

  // 创建按钮内容结构，模仿原网站按钮样式
  btn.innerHTML = `
    <div dir="ltr" class="css-146c3p1 r-bcqeeo r-1ttztb7 r-qvutc0 r-37j5jr r-a023e6 r-rjixqe r-16dba41 r-1awozwy r-6koalj r-1h0z5md r-o7ynqc r-clp7b1 r-3s2u2q" style="color: rgb(255, 255, 255);">
      <div class="css-175oi2r r-xoduu5">
        <div class="css-175oi2r r-xoduu5 r-1p0dtai r-1d2f490 r-u8s1d r-zchlnj r-ipm5af r-1niwhzg r-sdzlij r-xf4iuw r-o7ynqc r-6416eg r-1ny4l3l"></div>
        <svg viewBox="0 0 24 24" aria-hidden="true" class="r-4qtqp9 r-yyyyoo r-dnmrzs r-bnwqim r-lrvibr r-m6rgpd r-50lct3 r-1srniue">
          <g><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"></path></g>
        </svg>
      </div>
    </div>
  `

  // 应用与原网站按钮相同的样式，增强可见性
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

  // 添加悬停效果
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
  // 通过DOM结构查找按钮菜单栏，避免使用易变的CSS类名

  // 从轮播元素开始向上查找包含菜单栏的容器
  let current: Element | null = carouselElement
  while (current && current !== document.body) {
    // 在当前元素及其兄弟元素中查找菜单栏
    const parent: HTMLElement | null = current.parentElement
    if (parent) {
      // 通过 aria-label 查找包含统计信息的 role="group" 元素
      const groupElements = parent.querySelectorAll('[role="group"]')
      for (const group of groupElements) {
        const ariaLabel = group.getAttribute('aria-label') || ''
        // 检查是否包含回复、转发、点赞等关键词
        if (ariaLabel.match(/replie?s?|repost|like|view|bookmark|点赞|转发|回复|查看|书签/i)) {
          return group
        }
      }
    }
    current = parent
  }

  // 如果没找到，尝试通过按钮特征和DOM结构查找
  let searchRoot: Element | null = carouselElement
  while (searchRoot && searchRoot !== document.body) {
    const parent: HTMLElement | null = searchRoot.parentElement
    if (parent) {
      // 查找包含多个按钮的 role="group" 容器
      const buttonContainers = parent.querySelectorAll('[role="group"]')
      for (const container of buttonContainers) {
        // 检查容器内是否有社交媒体按钮的特征
        const hasReplyButton = container.querySelector(
          '[data-testid="reply"], [aria-label*="reply"], [aria-label*="回复"]'
        )
        const hasLikeButton = container.querySelector(
          '[data-testid="like"], [aria-label*="like"], [aria-label*="点赞"]'
        )
        const hasRetweetButton = container.querySelector(
          '[data-testid="retweet"], [aria-label*="repost"], [aria-label*="转发"]'
        )

        // 检查是否有SVG图标（社交媒体按钮通常使用SVG图标）
        const svgIcons = container.querySelectorAll('svg')
        const buttons = container.querySelectorAll('button, a[role="link"]')

        // 如果容器包含社交媒体按钮特征，且有多个按钮和SVG图标
        if (
          (hasReplyButton || hasLikeButton || hasRetweetButton) &&
          buttons.length >= 3 &&
          svgIcons.length >= 3
        ) {
          return container
        }
      }

      // 备用方案：查找包含特定结构的容器
      // 寻找包含多个按钮和SVG的水平排列容器
      const allContainers = parent.querySelectorAll('div')
      for (const container of allContainers) {
        const buttons = container.querySelectorAll('button, a[role="link"]')
        const svgs = container.querySelectorAll('svg')

        // 检查是否是水平排列的按钮容器
        if (buttons.length >= 4 && svgs.length >= 4) {
          const style = window.getComputedStyle(container)
          const isHorizontal =
            style.display === 'flex' ||
            style.display === 'inline-flex' ||
            container.children.length >= 4

          if (isHorizontal) {
            // 验证是否包含社交媒体按钮特征
            let socialButtonCount = 0
            for (const button of buttons) {
              const ariaLabel = button.getAttribute('aria-label') || ''
              const testId = button.getAttribute('data-testid') || ''
              if (
                ariaLabel.match(
                  /reply|like|repost|share|view|bookmark|回复|点赞|转发|分享|查看|书签/i
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
  // 创建一个包装容器，模仿菜单栏中其他按钮的结构
  const wrapper = document.createElement('div')
  wrapper.className = 'css-175oi2r r-18u37iz r-1h0z5md r-13awgt0'

  const btn = createCarouselBtn(data)
  // 添加菜单栏按钮特有的样式类
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
  // If we already created an overlay for this element, return it
  const existing = carouselOverlayMap.get(target)
  if (existing) return existing.btn

  const btn = createCarouselBtn(data)
  // Base styles for overlayed button appended to body
  btn.style.position = 'absolute'
  btn.style.zIndex = '2147483647' // very large to avoid clipping by site styles
  btn.style.background = 'rgba(0,0,0,0.6)'
  btn.style.pointerEvents = 'auto'
  // ensure body-level pointer handling
  document.body.appendChild(btn)

  let raf = 0

  const update = () => {
    try {
      if (!document.body.contains(target)) {
        // target removed — cleanup
        cancelAnimationFrame(raf)
        if (btn.parentElement) btn.parentElement.removeChild(btn)
        carouselOverlayMap.delete(target)
        return
      }

      const r = (target as Element).getBoundingClientRect()
      // place button at top-right inside the target rect with some padding
      const top = Math.max(0, window.scrollY + r.top + 6)
      const left = Math.max(0, window.scrollX + r.right - btn.offsetWidth - 6)
      btn.style.top = top + 'px'
      btn.style.left = left + 'px'

      // hide if offscreen - carousel buttons are always shown when in view
      const inView =
        r.bottom >= 0 && r.top <= window.innerHeight && r.right >= 0 && r.left <= window.innerWidth
      btn.style.display = inView ? '' : 'none'
    } catch {
      // swallow positioning errors
    }
    raf = requestAnimationFrame(update)
    carouselOverlayMap.set(target, { btn, raf })
  }

  // start loop
  raf = requestAnimationFrame(update)
  carouselOverlayMap.set(target, { btn, raf })
  return btn
}

function isInCarousel(el: Element): boolean {
  return !!(
    el.closest('[role="group"][aria-roledescription="carousel"]') ||
    el.closest('li[role="listitem"]') ||
    // 检测图片查看器/轮播模式的特征
    el.closest('[data-testid="swipe-to-dismiss"]') ||
    // 检测包含轮播相关样式的容器
    el
      .closest('div[style*="position: relative"]')
      ?.querySelector('[data-testid="swipe-to-dismiss"]') ||
    // 检测图片灯箱/查看器模式
    el.closest('[role="dialog"]') ||
    el.closest('[aria-modal="true"]') ||
    // 检测包含图片轮播的推文结构
    (el.closest('article[data-testid="tweet"]') &&
      (el.closest('div[aria-label="Image"]') || el.matches('div[aria-label="Image"]')))
  )
}

function addCarouselButtonToEl(el: Element) {
  try {
    // Only process elements in carousel
    if (!isInCarousel(el)) return

    // 更严格的重复检查 - 检查元素本身和父容器
    if (
      (el as Element).querySelector('.x-emoji-add-btn-carousel') ||
      (el as Element).querySelector('.x-emoji-add-btn') ||
      (el as Element).closest('.x-emoji-add-btn-carousel') ||
      (el as Element).closest('.x-emoji-add-btn')
    )
      return

    // For img elements, find the parent container that should receive the button
    let targetContainer: HTMLElement | null = null
    let url: string | null = null

    if (el instanceof HTMLImageElement) {
      // This is an img element - find its parent container with background-image or similar styling
      const imgEl = el as HTMLImageElement
      if (imgEl.getAttribute('alt') !== '') {
        return // skip if not decorative image
      }

      // Look for parent container that might have background-image or suitable styling
      let parent = imgEl.parentElement
      while (parent && parent !== document.body) {
        if (parent.querySelector('.x-emoji-add-btn-carousel')) return // already has button

        // Check if this parent has background-image or looks like an image container
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

      // If no suitable parent found, use the direct parent
      if (!targetContainer && imgEl.parentElement) {
        targetContainer = imgEl.parentElement as HTMLElement
        url = normalizeUrl(imgEl.src)
      }
    } else {
      // This is a div or other container element
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

    // If this is a Twitter media host, delegate to twitterMediaInject helper
    const handled = tryInjectTwitterMedia(url, targetContainer, createCarouselOverlayBtn, logger)

    if (!handled) {
      // 首先尝试查找按钮菜单栏（常规流程）
      const menuBar = findButtonMenuBar(targetContainer)

      if (menuBar && !menuBar.querySelector('.x-emoji-add-btn-carousel')) {
        // 如果找到菜单栏且还没有添加按钮，则添加到菜单栏
        createMenuBarBtn({ name, url }, menuBar)
        logger.log('[XCarousel] Added button to menu bar')
      } else {
        // 回退到原来的悬浮按钮方式
        const parent = targetContainer
        const computed = window.getComputedStyle(parent)

        // Carousel images always use overlay to avoid conflicts with carousel controls
        const shouldUseOverlay = /hidden|auto|scroll/.test(computed.overflow || '') || true

        if (computed.position === 'static' || !computed.position) parent.style.position = 'relative'

        if (shouldUseOverlay) {
          createCarouselOverlayBtn({ name, url }, parent)
        } else {
          const btn = createCarouselBtn({ name, url })
          parent.appendChild(btn)

          // Quick runtime check: ensure the button is actually on top and receives pointer events.
          try {
            const r = btn.getBoundingClientRect()
            const cx = Math.round(r.left + r.width / 2)
            const cy = Math.round(r.top + r.height / 2)
            const topEl = document.elementFromPoint(cx, cy)
            if (topEl !== btn && !btn.contains(topEl)) {
              // Not topmost — replace with overlay so clicks work
              if (btn.parentElement) btn.parentElement.removeChild(btn)
              createCarouselOverlayBtn({ name, url }, parent)
            }
          } catch {
            // ignore elementFromPoint errors on cross-origin or other odd pages
          }
        }
      }
    }
  } catch (e) {
    void e
  }
}

export function scanAndInjectCarousel() {
  // Special selectors for carousel images only
  const selectors = [
    // 原有的轮播选择器
    '[role="group"][aria-roledescription="carousel"] div[aria-label="Image"]',
    '[role="group"][aria-roledescription="carousel"] div[style*="background-image"]',
    '[role="group"][aria-roledescription="carousel"] img',
    'li[role="listitem"] div[aria-label="Image"]',
    'li[role="listitem"] div[style*="background-image"]',
    'li[role="listitem"] img',
    // 新增的图片查看器/轮播选择器
    '[data-testid="swipe-to-dismiss"] div[aria-label="Image"]',
    '[data-testid="swipe-to-dismiss"] div[style*="background-image"]',
    '[data-testid="swipe-to-dismiss"] img',
    // 图片灯箱/查看器模式
    '[role="dialog"] div[aria-label="Image"]',
    '[role="dialog"] div[style*="background-image"]',
    '[role="dialog"] img',
    '[aria-modal="true"] div[aria-label="Image"]',
    '[aria-modal="true"] div[style*="background-image"]',
    '[aria-modal="true"] img',
    // 推文中的图片轮播
    'article[data-testid="tweet"] div[aria-label="Image"]'
  ]

  const set = new Set<Element>()
  selectors.forEach(s => document.querySelectorAll(s).forEach(el => set.add(el)))
  set.forEach(el => addCarouselButtonToEl(el))

  logger.log(`[XCarousel] Processed ${set.size} carousel elements`)
}
