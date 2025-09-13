/**
 * Autonomous Bilibili Content Script
 * Self-contained script for Bilibili emoji functionality
 * No external dependencies - all utilities inlined
 */

// ===== INLINED UTILITIES =====

// Bilibili utility functions (inlined from bilibili/utils/bilibili-utils.ts)
function isBilibiliOpusPage(): boolean {
  try {
    const hostname = window.location.hostname.toLowerCase()
    if (!hostname.includes('bilibili') && !hostname.includes('hdslb.com')) {
      return false
    }

    // Check for opus page patterns
    const pathname = window.location.pathname.toLowerCase()
    return (
      pathname.includes('/opus/') ||
      pathname.includes('/dynamic/') ||
      document.querySelector('.bili-dyn-item') !== null ||
      document.querySelector('.opus-detail') !== null
    )
  } catch (e) {
    return false
  }
}

/**
 * 规范化B站URL - 处理协议、尺寸参数等
 */
function normalizeBiliUrl(raw: string): string | null {
  if (!raw) return null
  raw = raw.trim()

  // srcset may contain multiple entries separated by comma; take first token if so
  if (raw.includes(',')) raw = raw.split(',')[0]
  // remove descriptor after whitespace
  raw = raw.split(' ')[0]

  // ensure protocol - 处理//开头的URL
  if (raw.startsWith('//')) raw = 'https:' + raw
  else if (raw.startsWith('/')) raw = window.location.origin + raw

  // strip size suffix starting with @ (e.g. ...jpg@264w_...avif)
  // 去除@后面的尺寸参数获取原图URL
  const atIndex = raw.indexOf('@')
  if (atIndex !== -1) raw = raw.slice(0, atIndex)

  // basic validation
  if (!/^https?:\/\/.+\.(jpg|jpeg|png|gif|webp|avif)$/i.test(raw)) {
    // if extension missing but path ends with jpg before @ it was preserved; otherwise try allow no ext
    if (!/^https?:\/\/.+/.test(raw)) return null
  }

  return raw
}

function extractImageUrlFromPicture(pictureElement: Element): string | null {
  try {
    // 尝试多种方式获取图片URL
    const urlSources: (() => string | null)[] = [
      // 1. 如果容器本身是 <img>
      () => {
        if (pictureElement instanceof HTMLImageElement) {
          return (
            pictureElement.getAttribute('src') ||
            pictureElement.getAttribute('data-src') ||
            pictureElement.getAttribute('data-original') ||
            pictureElement.src ||
            null
          )
        }
        return null
      },

      // 2. 查找内部的 <img> 元素
      () => {
        const img = pictureElement.querySelector('img')
        if (img) {
          return (
            img.getAttribute('src') ||
            img.getAttribute('data-src') ||
            img.getAttribute('data-original') ||
            img.src ||
            null
          )
        }
        return null
      },

      // 3. 查找 <source> 元素的 srcset
      () => {
        const sources = pictureElement.querySelectorAll('source')
        for (const source of sources) {
          const srcset = source.getAttribute('srcset')
          if (srcset) {
            // Extract first URL from srcset
            const match = srcset.match(/^([^\s,]+)/)
            if (match) return match[1]
          }
        }
        return null
      }
    ]

    // 尝试每种方法，返回第一个有效的URL
    for (const getUrl of urlSources) {
      try {
        const rawUrl = getUrl()
        if (rawUrl) {
          const normalized = normalizeBiliUrl(rawUrl)
          if (normalized) return normalized
        }
      } catch (e) {
        // 忽略单个方法的错误，继续尝试下一个
        continue
      }
    }

    return null
  } catch (e) {
    return null
  }
}

function extractNameFromUrl(url: string): string {
  try {
    const urlObj = new URL(url)
    const pathname = urlObj.pathname
    const filename = pathname.split('/').pop() || 'bilibili-image'
    return filename.split('.')[0] || 'bilibili-image'
  } catch (e) {
    return 'bilibili-image'
  }
}

// ===== BUTTON CREATION UTILITIES =====

interface AddEmojiButtonData {
  name: string
  url: string
}

function setupButtonClick(button: HTMLElement, data: AddEmojiButtonData) {
  button.addEventListener('click', async e => {
    e.preventDefault()
    e.stopPropagation()

    const originalText = button.innerHTML
    const originalStyle = button.style.cssText

    try {
      button.innerHTML = '添加中...'
      button.style.background = 'linear-gradient(135deg,#f59e0b,#d97706)'

      if ((window as any).chrome?.runtime?.sendMessage) {
        await (window as any).chrome.runtime.sendMessage({
          action: 'addEmojiFromWeb',
          emojiData: data
        })

        button.innerHTML = '已添加'
        button.style.background = 'linear-gradient(135deg,#10b981,#059669)'

        setTimeout(() => {
          button.innerHTML = originalText
          button.style.cssText = originalStyle
        }, 1500)
      } else {
        throw new Error('Chrome runtime not available')
      }
    } catch (error) {
      console.error('[Bilibili] Add emoji failed:', error)
      button.innerHTML = '失败'
      button.style.background = 'linear-gradient(135deg,#ef4444,#dc2626)'

      setTimeout(() => {
        button.innerHTML = originalText
        button.style.cssText = originalStyle
      }, 1500)
    }
  })
}

function createFloatingButton(data: AddEmojiButtonData, targetElement: Element): HTMLElement {
  const button = document.createElement('button')
  button.className = 'bilibili-emoji-add-btn'
  button.type = 'button'
  button.title = '添加到表情包'
  button.innerHTML = '➕'

  // Styling
  button.style.cssText = `
    position: absolute;
    top: 8px;
    right: 8px;
    z-index: 9999;
    background: rgba(0, 0, 0, 0.8);
    color: white;
    border: none;
    border-radius: 6px;
    padding: 6px 8px;
    cursor: pointer;
    font-size: 14px;
    font-weight: bold;
    opacity: 0;
    transition: opacity 0.2s ease;
    backdrop-filter: blur(4px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    min-width: 28px;
    min-height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
  `

  setupButtonClick(button, data)

  // Show/hide on hover
  let isHovered = false
  const showButton = () => {
    isHovered = true
    button.style.opacity = '1'
  }
  const hideButton = () => {
    isHovered = false
    button.style.opacity = '0'
  }

  targetElement.addEventListener('mouseenter', showButton)
  targetElement.addEventListener('mouseleave', hideButton)
  button.addEventListener('mouseenter', showButton)
  button.addEventListener('mouseleave', hideButton)

  return button
}

function createControlButton(data: AddEmojiButtonData): HTMLElement {
  const button = document.createElement('button')
  button.className = 'bili-album__watch__control__option add-emoji'
  button.type = 'button'
  button.title = '添加到表情包'
  button.innerHTML = '➕'

  setupButtonClick(button, data)
  return button
}

// ===== DOM INJECTION LOGIC =====

function scanAndInject() {
  try {
    // Scan for Bilibili image containers, including pswp__img for large images
    const imageContainers = document.querySelectorAll(
      '.bili-album__watch__content, .opus-module-content img, .bili-dyn-item img, .pswp__img'
    )

    imageContainers.forEach(container => {
      // Skip if already processed - 改进的重复检测
      if (
        container.querySelector('.bilibili-emoji-add-btn') ||
        container.classList.contains('bilibili-processed') ||
        container.closest('.bilibili-processed')
      ) {
        return
      }

      // 过滤掉头像 - Skip avatar images
      if (
        container.closest('.b-avatar__layer__res') ||
        container.closest('.bili-avatar') ||
        container.closest('.user-avatar') ||
        container.matches('.avatar, .user-face, .bili-avatar img')
      ) {
        return
      }

      let imageUrl: string | null = null
      let targetElement: Element = container

      if (container.tagName.toLowerCase() === 'img') {
        const imgElement = container as HTMLImageElement
        // 对于pswp__img，直接使用src
        if (container.classList.contains('pswp__img')) {
          imageUrl = normalizeBiliUrl(imgElement.src)
        } else {
          imageUrl = normalizeBiliUrl(
            imgElement.src ||
              imgElement.getAttribute('data-src') ||
              imgElement.getAttribute('src') ||
              ''
          )
        }
        targetElement = container.parentElement || container
      } else {
        // Look for picture or img elements within container
        const picture = container.querySelector('picture')
        if (picture) {
          imageUrl = extractImageUrlFromPicture(picture)
          targetElement = picture
        } else {
          const img = container.querySelector('img')
          if (img) {
            // 特别处理 bili-album__watch__content 容器中的图片
            let rawUrl = ''
            if (container.classList.contains('bili-album__watch__content')) {
              // 对于大图区域，优先使用img的src属性，确保获取正确的图片URL
              rawUrl = img.src || img.getAttribute('src') || img.getAttribute('data-src') || ''
            } else {
              rawUrl = img.src || img.getAttribute('data-src') || img.getAttribute('src') || ''
            }

            imageUrl = normalizeBiliUrl(rawUrl)
            targetElement = img.parentElement || img
          }
        }
      }

      if (imageUrl) {
        const name = extractNameFromUrl(imageUrl)
        const data: AddEmojiButtonData = { name, url: imageUrl }

        // Create and position button
        const button = createFloatingButton(data, targetElement)

        // Position relative to target
        if (targetElement.parentElement) {
          targetElement.parentElement.style.position = 'relative'
          targetElement.parentElement.appendChild(button)
        }

        // Mark container as processed to prevent duplicate buttons
        container.classList.add('bilibili-processed')
      }
    })

    // Also scan for control areas
    const controlAreas = document.querySelectorAll('.bili-album__watch__control')
    controlAreas.forEach(area => {
      if (area.querySelector('.add-emoji') || area.classList.contains('bilibili-control-processed'))
        return

      // Find associated image
      const albumContent = area
        .closest('.bili-album__watch')
        ?.querySelector('.bili-album__watch__content')
      if (albumContent) {
        const picture = albumContent.querySelector('picture')
        if (picture) {
          const imageUrl = extractImageUrlFromPicture(picture)
          if (imageUrl) {
            const name = extractNameFromUrl(imageUrl)
            const data: AddEmojiButtonData = { name, url: imageUrl }
            const button = createControlButton(data)
            area.appendChild(button)

            // Mark control area as processed
            area.classList.add('bilibili-control-processed')
          }
        }
      }
    })
  } catch (e) {
    console.error('[Bilibili] Scan and inject failed:', e)
  }
}

function observeMutations() {
  try {
    const observer = new MutationObserver(mutations => {
      let shouldScan = false

      mutations.forEach(mutation => {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          // Check if any added nodes contain images or are image containers
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as Element
              if (
                element.matches(
                  '.bili-album__watch__content, .opus-module-content, .bili-dyn-item'
                ) ||
                element.querySelector(
                  '.bili-album__watch__content, .opus-module-content, .bili-dyn-item'
                )
              ) {
                shouldScan = true
                break
              }
            }
          }
        }
      })

      if (shouldScan) {
        setTimeout(scanAndInject, 100)
      }
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true
    })
  } catch (e) {
    console.error('[Bilibili] Observer setup failed:', e)
  }
}

// ===== CSS INJECTION =====

function injectBilibiliButtonStyles() {
  if (document.getElementById('bilibili-emoji-button-fixes')) {
    return
  }

  const css = `
    /* Bilibili Button Styling Fixes */
    .bili-album__watch__control__option.add-emoji {
      background: inherit !important;
      color: inherit !important;
      font-size: inherit !important;
      font-weight: inherit !important;
      padding: inherit !important;
      border: inherit !important;
      border-radius: inherit !important;
      cursor: pointer !important;
      transition: all 0.2s ease !important;
    }
    
    .bili-album__watch__control__option.add-emoji:hover {
      background: rgba(0, 0, 0, 0.1) !important;
    }
    
    .bilibili-emoji-add-btn {
      pointer-events: auto !important;
    }
  `

  const style = document.createElement('style')
  style.id = 'bilibili-emoji-button-fixes'
  style.textContent = css
  document.head.appendChild(style)
}

// ===== MAIN INITIALIZATION =====

function initBilibili() {
  try {
    console.log('[Bilibili] Initializing autonomous content script')

    // Inject CSS fixes for button styling
    injectBilibiliButtonStyles()

    // Initial scan and observe
    setTimeout(scanAndInject, 200)
    observeMutations()

    console.log('[Bilibili] Autonomous content script initialized')
  } catch (e) {
    console.error('[Bilibili] Initialization failed:', e)
  }
}

// Auto-initialize when script loads
try {
  initBilibili()
} catch (e) {
  console.error('[Bilibili] Auto-initialization failed:', e)
}
