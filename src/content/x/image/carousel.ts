import {
  normalizeUrl,
  extractImageUrl,
  extractNameFromUrl,
  setupButtonClick,
  AddEmojiButtonData,
  isXMediaHost
} from '../utils'
import { isImageInjectionEnabled, ImageType } from '../xConfig'
import { DOA, DQSA, createE } from '../../utils/dom/createEl'

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
  // create button without innerHTML, append SVG via DOM for reliability
  const btn = createE('button', {
    class: 'x-emoji-add-btn-carousel',
    type: 'button',
    ti: '添加到未分组表情',
    attrs: {
      'aria-label': '添加表情',
      role: 'button'
    },
    style: `
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
    pointerEvents: auto;  
  `,
    on: {
      mouseenter: () => {
        btn.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'
      },
      mouseleave: () => {
        btn.style.backgroundColor = 'transparent'
      }
    }
  })
  // build SVG icon via DOM
  const svgNS = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(svgNS, 'svg')
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('aria-hidden', 'true')
  svg.style.width = '18px'
  svg.style.height = '18px'
  svg.style.display = 'block'
  const g = document.createElementNS(svgNS, 'g')
  const path = document.createElementNS(svgNS, 'path')
  path.setAttribute('d', 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z')
  g.appendChild(path)
  svg.appendChild(g)
  const wrapper = createE('div', {
    attrs: { dir: 'ltr' },
    style: 'color: rgb(255, 255, 255)',
    child: [svg]
  })
  btn.appendChild(wrapper)
  setupButtonClick(btn, data)
  return btn
}

function createDownloadBtn(data: AddEmojiButtonData) {
  const btn = createE('button', {
    class: 'x-emoji-download-btn-carousel',
    type: 'button',
    ti: '下载图片',
    attrs: {
      'aria-label': '下载图片',
      role: 'button'
    },
    style: `
    background: rgba(0, 0, 0, 0.6);
    border: none;
    cursor: pointer;
    color: rgb(255, 255, 255);
    padding: 0;
    margin: 0 6px 0 0;
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
    pointerEvents: auto;
  `,
    on: {
      mouseenter: () => {
        btn.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'
      },
      mouseleave: () => {
        btn.style.backgroundColor = 'transparent'
      },
      click: async () => {
        try {
          const url = data.url
          const name = data.name || 'image'
          // Try to fetch the resource and save via blob to preserve filename where possible
          try {
            const resp = await fetch(url)
            if (!resp.ok) throw new Error('network')
            const blob = await resp.blob()
            const blobUrl = URL.createObjectURL(blob)
            const a = createE('a', {
              src: blobUrl,
              attrs: { download: name }
            }) as HTMLAnchorElement
            // append to DOM so click works in all browsers
            DOA(a)
            a.click()
            a.remove()
            setTimeout(() => URL.revokeObjectURL(blobUrl), 5000)
            return
          } catch (e) {
            // fallback to opening in new tab if fetch fails (CORS etc)
            window.open(url, '_blank')
            return
          }
        } catch (err) {
          // final fallback
          try {
            window.open(data.url, '_blank')
          } catch {
            /* ignore */
          }
        }
      }
    }
  })
  // append SVG icon via DOM
  const svgNS = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(svgNS, 'svg')
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('aria-hidden', 'true')
  svg.style.width = '18px'
  svg.style.height = '18px'
  svg.style.display = 'block'
  const g = document.createElementNS(svgNS, 'g')
  const path = document.createElementNS(svgNS, 'path')
  path.setAttribute('d', 'M5 20h14v-2H5v2zm7-18L5.33 9h3.67v6h6V9h3.67L12 2z')
  g.appendChild(path)
  svg.appendChild(g)
  const wrapper = createE('div', {
    attrs: { dir: 'ltr' },
    style: 'color: rgb(255, 255, 255)',
    child: [svg]
  })
  btn.appendChild(wrapper)

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
  const wrapper = createE('div')
  const addBtn = createCarouselBtn(data)
  const downloadBtn = createDownloadBtn(data)

  wrapper.appendChild(downloadBtn)
  wrapper.appendChild(addBtn)
  menuBar.appendChild(wrapper)
  return addBtn
}

function createCarouselOverlayBtn(data: AddEmojiButtonData, target: Element) {
  const existing = carouselOverlayMap.get(target)
  if (existing) return existing.btn
  // wrapper to hold both buttons — create with DOM API and set proper CSS so it can be positioned
  const wrapper = createE('div', {
    class: 'x-emoji-overlay-wrapper',
    style:
      'position:absolute;z-index:2147483647;pointer-events:auto;display:flex;gap:6px;align-items:center;'
  })

  const downloadBtn = createDownloadBtn(data)
  const addBtn = createCarouselBtn(data)
  downloadBtn.style.position = 'static'
  addBtn.style.position = 'static'
  wrapper.appendChild(downloadBtn)
  wrapper.appendChild(addBtn)

  DOA(wrapper)
  markInjected(target)
  let raf = 0
  const update = () => {
    try {
      if (!document.body.contains(target)) {
        cancelAnimationFrame(raf)
        if (wrapper.parentElement) wrapper.parentElement.removeChild(wrapper)
        carouselOverlayMap.delete(target)
        clearInjected(target)
        return
      }
      const r = (target as Element).getBoundingClientRect()
      const top = Math.max(0, window.scrollY + r.top + 6)
      const left = Math.max(0, window.scrollX + r.right - wrapper.offsetWidth - 6)
      wrapper.style.top = top + 'px'
      wrapper.style.left = left + 'px'
      const inView =
        r.bottom >= 0 && r.top <= window.innerHeight && r.right >= 0 && r.left <= window.innerWidth
      wrapper.style.display = inView ? '' : 'none'
    } catch {
      /* ignore */
    }
    raf = requestAnimationFrame(update)
    carouselOverlayMap.set(target, { btn: wrapper, raf })
  }
  raf = requestAnimationFrame(update)
  carouselOverlayMap.set(target, { btn: wrapper, raf })
  return wrapper
}

/**
 * 检查图片 URL 是否应该被过滤
 */
function shouldFilterImageUrl(url: string): boolean {
  // 过滤头像图片
  if (url.includes('profile_images')) return true

  // 过滤商品图片
  if (url.includes('commerce_product_img')) return true

  // 过滤 120x120 图片（通常是头像缩略图）
  if (url.includes('name=120x120')) return true

  if (url.includes('amplify_video_thumb')) return true

  return false
}

/**
 * 检测元素所属的图片类型
 */
function detectImageType(el: Element): ImageType | null {
  // 检查是否在轮播图中
  if (el.closest('[role="group"][aria-roledescription="carousel"]')) {
    return ImageType.Carousel
  }

  // 检查是否在对话框/模态框中
  if (el.closest('[role="dialog"]') || el.closest('[aria-modal="true"]')) {
    return ImageType.Dialog
  }

  // 检查是否在推文中
  if (
    el.closest('article[data-testid="tweet"]') &&
    (el.closest('div[aria-label="Image"]') ||
      el.matches('div[aria-label="Image"]') ||
      el.closest('div[data-testid="tweetPhoto"]') ||
      el.matches('div[data-testid="tweetPhoto"]'))
  ) {
    return ImageType.Tweet
  }

  // 检查是否在列表项中
  if (el.closest('li[role="listitem"]')) {
    return ImageType.ListItem
  }

  // 检查是否在滑动关闭元素中
  if (
    el.closest('[data-testid="swipe-to-dismiss"]') ||
    el
      .closest('div[style*="position: relative"]')
      ?.querySelector('[data-testid="swipe-to-dismiss"]')
  ) {
    return ImageType.SwipeToDismiss
  }

  // 检查是否是独立媒体页面
  if (isXMediaHost() && el instanceof HTMLImageElement) {
    return ImageType.StandaloneMedia
  }

  return null
}

function isInCarousel(el: Element): boolean {
  return detectImageType(el) !== null
}

function addCarouselButtonToEl(el: Element) {
  try {
    const isPbsHost = isXMediaHost()

    // 检测图片类型
    const imageType = detectImageType(el)
    if (!imageType) return

    // 检查该类型的图片注入是否启用
    if (!isImageInjectionEnabled(imageType)) {
      return
    }

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

    let targetContainer: HTMLElement = null as any
    let url: string = null as any

    const finalizeTarget = (container: HTMLElement | null, resolvedUrl: string | null) => {
      targetContainer = container as HTMLElement
      url = resolvedUrl as string
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

    // 使用统一的过滤器检查 URL
    if (shouldFilterImageUrl(url)) {
      console.log('[XCarousel] Skipping filtered image:', url)
      return
    }

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
  // 检查是否至少有一个类型启用
  if (!isImageInjectionEnabled()) {
    return
  }

  const selectors: string[] = []

  // 根据配置动态构建选择器
  if (isImageInjectionEnabled(ImageType.Carousel)) {
    selectors.push(
      '[role="group"][aria-roledescription="carousel"] div[aria-label="Image"]',
      '[role="group"][aria-roledescription="carousel"] div[style*="background-image"]',
      '[role="group"][aria-roledescription="carousel"] img'
    )
  }

  if (isImageInjectionEnabled(ImageType.ListItem)) {
    selectors.push(
      'li[role="listitem"] div[aria-label="Image"]',
      'li[role="listitem"] div[style*="background-image"]',
      'li[role="listitem"] img'
    )
  }

  if (isImageInjectionEnabled(ImageType.SwipeToDismiss)) {
    selectors.push(
      '[data-testid="swipe-to-dismiss"] div[aria-label="Image"]',
      '[data-testid="swipe-to-dismiss"] div[style*="background-image"]',
      '[data-testid="swipe-to-dismiss"] img'
    )
  }

  if (isImageInjectionEnabled(ImageType.Dialog)) {
    selectors.push(
      '[role="dialog"] div[aria-label="Image"]',
      '[role="dialog"] div[style*="background-image"]',
      '[role="dialog"] img',
      '[aria-modal="true"] div[aria-label="Image"]',
      '[aria-modal="true"] div[style*="background-image"]',
      '[aria-modal="true"] img'
    )
  }

  if (isImageInjectionEnabled(ImageType.Tweet)) {
    selectors.push(
      'article[data-testid="tweet"] div[aria-label="Image"]',
      'article[data-testid="tweet"] div[data-testid="tweetPhoto"]',
      'article[data-testid="tweet"] div[style*="background-image"]',
      'article[data-testid="tweet"] img'
    )
  }

  // 如果没有任何选择器，直接返回
  if (selectors.length === 0) {
    return
  }

  const set = new Set<Element>()
  selectors.forEach(s => DQSA(s).forEach(el => set.add(el)))

  // Special-case: when visiting a standalone twitter/pbs image page the document
  // may simply contain one or more top-level <img> elements (or an image inside
  // a minimal wrapper). Add any images whose src points to pbs.twimg.com so they
  // are picked up by the existing injection logic.
  if (isImageInjectionEnabled(ImageType.StandaloneMedia)) {
    try {
      if (isXMediaHost()) {
        DQSA('img').forEach(img => {
          const src = (img as HTMLImageElement).src || img.getAttribute('src') || ''
          if (src && src.includes('pbs.twimg.com')) set.add(img)
        })
      }
    } catch {
      // ignore
    }
  }

  // Filter out elements whose ancestors are also in the set to prevent duplicate processing
  // For example, if both a container div and its child img are in the set, only process the container
  const filtered = new Set<Element>()
  const skipped: Element[] = []

  set.forEach(el => {
    let hasAncestorInSet = false
    let parent = el.parentElement
    while (parent && parent !== document.body) {
      if (set.has(parent)) {
        hasAncestorInSet = true
        skipped.push(el)
        break
      }
      parent = parent.parentElement
    }
    if (!hasAncestorInSet) {
      filtered.add(el)
    }
  })

  // Log detailed information for debugging
  if (skipped.length > 0) {
    console.log(
      `[XCarousel] Filtered out ${skipped.length} nested elements:`,
      skipped.map(el => ({
        tag: el.tagName,
        class: el.className,
        testid: el.getAttribute('data-testid'),
        ariaLabel: el.getAttribute('aria-label')
      }))
    )
  }

  filtered.forEach(el => addCarouselButtonToEl(el))

  console.log(
    `[XCarousel] Processed ${filtered.size} carousel elements (${set.size} total matched)`
  )
}

function tryInjectTwitterMedia(
  url: string,
  targetContainer: Element,
  createOverlayFn: (data: AddEmojiButtonData, target: Element) => HTMLElement | void
): boolean {
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.toLowerCase()
    const pathname = parsed.pathname.toLowerCase()

    // 使用统一的过滤器检查 URL
    if (shouldFilterImageUrl(url)) {
      console.log('[TwitterMedia] Skipping filtered image:', url)
      return false
    }

    const isTwitterMedia = host === 'pbs.twimg.com' && parsed.pathname.includes('/media/')
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
  // 检查图片注入功能开关
  if (!isImageInjectionEnabled()) {
    console.log('[XCarousel] Image injection disabled by config')
    return null
  }

  if (carouselObserver) return carouselObserver

  carouselObserver = new MutationObserver(ms => {
    let needsScan = false

    for (const m of ms) {
      // Only react to additions of elements that are <img> or contain <img>
      if (m.type === 'childList') {
        for (const n of Array.from(m.addedNodes)) {
          if (n.nodeType !== 1) continue
          const el = n as Element
          // Skip if this is our own injected button being added
          if (
            el.classList &&
            (el.classList.contains('x-emoji-add-btn-carousel') ||
              el.classList.contains('x-emoji-add-btn'))
          ) {
            continue
          }
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
        // Skip if this is just adding the 'injected' class to prevent double injection
        if (m.attributeName === 'class' && tgt.classList.contains('injected')) {
          continue
        }
        // Skip attribute changes on already-injected elements to prevent re-injection
        if (isInjected(tgt)) {
          continue
        }
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
