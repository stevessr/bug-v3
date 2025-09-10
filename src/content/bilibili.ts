import { logger } from '../config/buildFLagsV2'

declare const chrome: any

interface AddEmojiButtonData {
  name: string
  url: string
}

function isBilibiliOpusPage(): boolean {
  try {
    const host = window.location.hostname.toLowerCase()
    if (!host.includes('bilibili.com')) return false
    const path = window.location.pathname
    // match /opus/<digits>
    return /^\/opus\/\d+(?:\/.*)?$/.test(path)
  } catch (e) {
    void e
    return false
  }
}

function normalizeBiliUrl(raw: string): string | null {
  if (!raw) return null
  raw = raw.trim()
  // srcset may contain multiple entries separated by comma; take first token if so
  if (raw.includes(',')) raw = raw.split(',')[0]
  // remove descriptor after whitespace
  raw = raw.split(' ')[0]

  // ensure protocol
  if (raw.startsWith('//')) raw = 'https:' + raw
  else if (raw.startsWith('/')) raw = window.location.origin + raw

  // strip size suffix starting with @ (e.g. ...jpg@264w_...avif)
  const atIndex = raw.indexOf('@')
  if (atIndex !== -1) raw = raw.slice(0, atIndex)

  // basic validation
  if (!/^https?:\/\/.+\.(jpg|jpeg|png|gif|webp|avif)$/i.test(raw)) {
    // if extension missing but path ends with jpg before @ it was preserved; otherwise try allow no ext
    if (!/^https?:\/\/.+/.test(raw)) return null
  }

  return raw
}

function extractImageUrlFromPicture(container: Element): string | null {
  // Look for img first
  const img = container.querySelector('img') as HTMLImageElement | null
  if (img) {
    const src = img.getAttribute('src') || img.getAttribute('data-src') || img.src || ''
    const normalized = normalizeBiliUrl(src)
    if (normalized) return normalized
  }

  // Try source elements (srcset)
  const source = container.querySelector('source[srcset], source[src]') as HTMLSourceElement | null
  if (source) {
    const srcset = source.getAttribute('srcset') || source.getAttribute('src') || ''
    const normalized = normalizeBiliUrl(srcset)
    if (normalized) return normalized
  }

  // try data attributes on container
  const dataSrc = (container as HTMLElement).getAttribute('data-src')
  if (dataSrc) return normalizeBiliUrl(dataSrc)

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

function setupButtonClickHandler(button: HTMLElement, data: AddEmojiButtonData) {
  button.addEventListener('click', async e => {
    e.preventDefault()
    e.stopPropagation()
    const originalContent = button.innerHTML
    const originalStyle = button.style.cssText
    try {
      await chrome.runtime.sendMessage({ action: 'addEmojiFromWeb', emojiData: data })
      button.innerHTML = '已添加'
      button.style.background = 'linear-gradient(135deg, #10b981, #059669)'
      setTimeout(() => {
        button.innerHTML = originalContent
        button.style.cssText = originalStyle
      }, 1500)
    } catch (error) {
      logger.error('[BiliOneClick] 添加表情失败:', error)
      button.innerHTML = '失败'
      button.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)'
      setTimeout(() => {
        button.innerHTML = originalContent
        button.style.cssText = originalStyle
      }, 1500)
    }
  })
}

function createFloatingButton(data: AddEmojiButtonData): HTMLElement {
  const btn = document.createElement('button')
  btn.className = 'bili-emoji-add-btn'
  btn.type = 'button'
  btn.title = '添加到未分组表情'
  btn.innerHTML = '➕'
  // minimal inline styles to ensure visibility; page CSS may override but keep simple
  btn.style.cssText = `position:absolute;right:6px;top:6px;z-index:9999;cursor:pointer;border-radius:6px;padding:6px 8px;background:rgba(0,0,0,0.6);color:#fff;border:none;font-weight:700;`
  setupButtonClickHandler(btn, data)
  return btn
}

function createControlButton(data: AddEmojiButtonData): HTMLElement {
  const btn = document.createElement('div')
  btn.className = 'bili-album__watch__control__option add-emoji'
  btn.title = '添加到未分组表情'
  btn.style.cssText = `cursor:pointer;display:flex;align-items:center;gap:4px;padding:8px 12px;border-radius:6px;background:rgba(255,255,255,0.1);color:#fff;font-size:12px;font-weight:500;transition:background-color 0.2s ease;user-select:none;`

  // Create the emoji icon (14x14px smiley face SVG)
  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  icon.setAttribute('width', '14')
  icon.setAttribute('height', '14')
  icon.setAttribute('viewBox', '0 0 14 14')
  icon.setAttribute('fill', 'currentColor')
  icon.innerHTML = `
    <path d="M7 0C3.134 0 0 3.134 0 7s3.134 7 7 7 7-3.134 7-7-3.134-7-7-7zM5.5 4.5c.552 0 1 .448 1 1s-.448 1-1 1-1-.448-1-1 .448-1 1-1zm3 0c.552 0 1 .448 1 1s-.448 1-1 1-1-.448-1-1 .448-1 1-1zM7 11c-1.657 0-3-1.343-3-3h6c0 1.657-1.343 3-3 3z"/>
  `

  // Create the text label
  const text = document.createElement('span')
  text.textContent = '添加表情'

  btn.appendChild(icon)
  btn.appendChild(text)

  // Add hover effect
  btn.addEventListener('mouseenter', () => {
    btn.style.background = 'rgba(255,255,255,0.2)'
  })
  btn.addEventListener('mouseleave', () => {
    btn.style.background = 'rgba(255,255,255,0.1)'
  })

  setupButtonClickHandler(btn, data)
  return btn
}

function getCurrentDisplayedImage(): Element | null {
  // Try to find the currently displayed image in the viewer
  const selectors = [
    '.bili-album__watch__content img',
    '.bili-album__watch__content picture',
    '.bili-album__watch__content .bili-album__preview__picture__img',
    '.bili-album__watch__content [style*="background-image"]'
  ]

  for (const selector of selectors) {
    const element = document.querySelector(selector)
    if (element) {
      const url = extractImageUrlFromPicture(element)
      if (url) return element
    }
  }

  return null
}

function addButtonToControlSection(controlSection: Element) {
  try {
    // Check if button already exists
    if (controlSection.querySelector('.add-emoji')) return

    // Find the currently displayed image
    const currentImage = getCurrentDisplayedImage()
    if (!currentImage) return

    const url = extractImageUrlFromPicture(currentImage)
    if (!url) return

    const name = extractNameFromUrl(url)
    const btn = createControlButton({ name, url })

    // Add the button to the control section
    controlSection.appendChild(btn)
  } catch (e) {
    void e
  }
}

function addButtonToPicture(pictureEl: Element) {
  try {
    if ((pictureEl as Element).querySelector('.bili-emoji-add-btn')) return
    const url = extractImageUrlFromPicture(pictureEl)
    if (!url) return
    const name = extractNameFromUrl(url)

    const parent = pictureEl as HTMLElement
    // ensure parent is positioned relative so absolute button positions correctly
    const computed = window.getComputedStyle(parent)
    if (computed.position === 'static' || !computed.position) parent.style.position = 'relative'

    const btn = createFloatingButton({ name, url })
    parent.appendChild(btn)
  } catch (e) {
    void e
  }
}

function scanAndInject() {
  // picture containers
  const selectors = [
    '.bili-album__preview__picture__img',
    '.bili-album__preview__picture',
    '.bili-album__watch__track__item',
    '.bili-album__watch__content img'
  ]
  const set = new Set<Element>()
  selectors.forEach(sel => {
    document.querySelectorAll(sel).forEach(el => set.add(el))
  })

  set.forEach(el => addButtonToPicture(el))

  // Add button to control sections (image viewer controls)
  const controlSections = document.querySelectorAll('.bili-album__watch__control')
  controlSections.forEach(controlSection => {
    addButtonToControlSection(controlSection)
  })

  // Add batch parse button for full album container
  const albumContainers = document.querySelectorAll('.bili-album')
  albumContainers.forEach(container => {
    if ((container as Element).querySelector('.bili-emoji-batch-parse')) return
    // create batch button
    const btn = document.createElement('button')
    btn.className = 'bili-emoji-batch-parse'
    btn.type = 'button'
    btn.title = '解析并添加所有图片到未分组表情'
    btn.innerHTML = '一键解析并添加所有图片'
    btn.style.cssText =
      'display:inline-flex;align-items:center;gap:6px;background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;border-radius:8px;padding:8px 12px;margin:8px 0;font-weight:600;'

    btn.addEventListener('click', async e => {
      e.preventDefault()
      e.stopPropagation()
      const original = btn.innerHTML
      btn.innerHTML = '正在解析...'
      btn.disabled = true
      try {
        const pics: Element[] = []
        container
          .querySelectorAll('.bili-album__preview__picture__img, .bili-album__preview__picture')
          .forEach(p => pics.push(p))
        let success = 0
        for (const p of pics) {
          const url = extractImageUrlFromPicture(p)
          if (!url) continue
          const name = extractNameFromUrl(url)
          try {
            await chrome.runtime.sendMessage({
              action: 'addEmojiFromWeb',
              emojiData: { name, url }
            })
            success++
          } catch (err) {
            logger.error('[BiliOneClick] 批量添加失败', url, err)
          }
        }
        btn.innerHTML = `已处理 ${success}/${pics.length} 张图片`
        setTimeout(() => {
          btn.innerHTML = original
          btn.disabled = false
        }, 2000)
      } catch (err) {
        logger.error('[BiliOneClick] 批量解析失败', err)
        btn.innerHTML = '解析失败'
        setTimeout(() => {
          btn.innerHTML = original
          btn.disabled = false
        }, 2000)
      }
    })

    // insert at top of album container
    const first = container.firstChild
    if (first) container.insertBefore(btn, first)
    else container.appendChild(btn)
  })
}

function observeMutations() {
  const observer = new MutationObserver(mutations => {
    let changed = false
    mutations.forEach(m => {
      if (m.type === 'childList') changed = true
      else if (m.type === 'attributes') changed = true
    })
    if (changed) setTimeout(scanAndInject, 100)
  })
  observer.observe(document.body, { childList: true, subtree: true, attributes: true })
}

export function initBilibili() {
  try {
    if (!isBilibiliOpusPage()) {
      logger.log('[BiliOneClick] skipping init: not a Bilibili opus page')
      return
    }
    // initial scan and observe
    setTimeout(scanAndInject, 200)
    observeMutations()
    logger.log('[BiliOneClick] initialized')
  } catch (e) {
    logger.error('[BiliOneClick] init failed', e)
  }
}
