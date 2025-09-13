/**
 * Autonomous Pixiv Content Script
 * Self-contained script for Pixiv emoji functionality
 * No external dependencies - all utilities inlined
 */

// ===== PAGE DETECTION =====

function isPixivPage(): boolean {
  try {
    const hostname = window.location.hostname.toLowerCase()
    return hostname.includes('pixiv.net') || hostname.includes('pximg.net')
  } catch (e) {
    return false
  }
}

function isPixivArtworkPage(): boolean {
  try {
    const pathname = window.location.pathname.toLowerCase()
    return pathname.includes('/artworks/') || pathname.includes('/member_illust.php')
  } catch (e) {
    return false
  }
}

// ===== UTILITY FUNCTIONS =====

interface AddEmojiButtonData {
  name: string
  url: string
}

function extractFilenameFromUrl(url: string): string {
  try {
    const urlObj = new URL(url)
    const pathname = urlObj.pathname
    const filename = pathname.split('/').pop() || 'pixiv-image'
    return filename.split('.')[0] || 'pixiv-image'
  } catch (e) {
    return 'pixiv-image'
  }
}

function isValidImageUrl(url: string): boolean {
  try {
    const urlObj = new URL(url)
    const pathname = urlObj.pathname.toLowerCase()
    return (
      pathname.includes('pximg.net') ||
      pathname.includes('img-original') ||
      pathname.endsWith('.jpg') ||
      pathname.endsWith('.jpeg') ||
      pathname.endsWith('.png') ||
      pathname.endsWith('.gif') ||
      pathname.endsWith('.webp')
    )
  } catch (e) {
    return false
  }
}

function setupButtonClick(button: HTMLElement, data: AddEmojiButtonData) {
  button.addEventListener('click', async e => {
    e.preventDefault()
    e.stopPropagation()

    const originalText = button.innerHTML
    const originalStyle = button.style.cssText

    try {
      button.innerHTML = '下载中...'
      button.style.background = 'linear-gradient(135deg,#3b82f6,#2563eb)'

      // Step 1: Download image from Pixiv page (respecting origin restrictions)
      const imageData = await downloadPixivImage(data.url)

      button.innerHTML = '上传中...'
      button.style.background = 'linear-gradient(135deg,#f59e0b,#d97706)'

      // Step 2: Send image data to background script
      if ((window as any).chrome?.runtime?.sendMessage) {
        const response = await (window as any).chrome.runtime.sendMessage({
          action: 'uploadAndAddEmoji',
          payload: {
            arrayData: Array.from(imageData),
            filename: extractFilenameFromUrl(data.url),
            mimeType: 'image/jpeg', // Pixiv images are typically JPEG
            name: data.name,
            hiddenUrl: data.url // Original Pixiv URL
          }
        })

        if (response && response.success) {
          button.innerHTML = '已添加'
          button.style.background = 'linear-gradient(135deg,#10b981,#059669)'

          setTimeout(() => {
            button.innerHTML = originalText
            button.style.cssText = originalStyle
          }, 1500)
        } else {
          throw new Error(response?.error || '上传失败')
        }
      } else {
        throw new Error('Chrome runtime not available')
      }
    } catch (error) {
      console.error('[Pixiv] Add emoji failed:', error)
      button.innerHTML = '失败'
      button.style.background = 'linear-gradient(135deg,#ef4444,#dc2626)'

      setTimeout(() => {
        button.innerHTML = originalText
        button.style.cssText = originalStyle
      }, 1500)
    }
  })
}

// Download image from Pixiv using direct fetch
async function downloadPixivImage(imageUrl: string): Promise<Uint8Array> {
  try {
    const response = await fetch(imageUrl, {
      method: 'GET',
      headers: {
        Accept: 'image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Cache-Control': 'max-age=0',
        Referer: 'https://www.pixiv.net/',
        'sec-ch-ua': '"Not;A=Brand";v="99", "Microsoft Edge";v="139", "Chromium";v="139"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'Sec-Fetch-Dest': 'image',
        'Sec-Fetch-Mode': 'no-cors',
        'Sec-Fetch-Site': 'cross-site',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      credentials: 'omit'
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    return new Uint8Array(arrayBuffer)
  } catch (error) {
    console.error('[Pixiv] Direct fetch failed:', error)
    throw new Error(
      `Failed to download image: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

function createOverlayButtonSP(data: AddEmojiButtonData, targetElement: Element): HTMLElement {
  const button = document.createElement('button')
  button.className = 'pixiv-emoji-add-btn'
  button.type = 'button'
  button.title = '添加到表情包'
  button.innerHTML = '➕'

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
    pointer-events: auto;
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

  // Safely add event listeners only if targetElement is a valid DOM element
  if (targetElement && typeof targetElement.addEventListener === 'function') {
    targetElement.addEventListener('mouseenter', showButton)
    targetElement.addEventListener('mouseleave', hideButton)
  }
  button.addEventListener('mouseenter', showButton)
  button.addEventListener('mouseleave', hideButton)

  return button
}

// ===== IMAGE DETECTION AND PROCESSING =====

function findPixivImages(): Element[] {
  const selectors = [
    // Main artwork image
    'div[role="presentation"] img[src*="pximg.net"]',
    // Thumbnail images
    'a[href*="/artworks/"] img[src*="pximg.net"]',
    // Gallery images
    '.gtm-expand-full-size-illust img[src*="pximg.net"]',
    // User profile images
    'img[src*="pximg.net"][alt*="pixiv"]',
    // Large preview images (new selector for big previews)
    '.sc-890d9a80-1 img[src*="pximg.net"]',
    '.sc-e4167f06-0 img[src*="pximg.net"]',
    // Direct img-original images
    'img[src*="img-original"]',
    // General Pixiv images
    'img[src*="pximg.net"]'
  ]

  const images: Element[] = []
  selectors.forEach(selector => {
    const elements = document.querySelectorAll(selector)
    images.push(...Array.from(elements))
  })

  // Remove duplicates and filter out preview images
  const uniqueImages = images.filter(
    (img, index, self) => self.indexOf(img) === index // Remove duplicates
  )

  return uniqueImages.filter(img => {
    // 过滤预览图 - Filter out preview images
    if (
      img.closest('.sc-e85d81bc-0.eLoxRg') ||
      img.closest('.sc-e85d81bc-0') ||
      img.matches('.sc-e85d81bc-0 img') ||
      img.closest('[class*="eLoxRg"]')
    ) {
      return false
    }
    return true
  })
}

// Check if an image is an avatar/profile image - 检查是否为头像图片
function isAvatarImage(img: Element): boolean {
  // Check for avatar-related selectors
  const avatarSelectors = [
    // User profile avatar containers
    'div[role="img"]', // Profile avatar containers
    '.sc-3ec1b211-0', // Avatar wrapper class
    'a[href*="/users/"]', // User profile links

    // Avatar size indicators (typically small sizes)
    'img[width="40"]', // 40px avatars
    'img[width="50"]', // 50px avatars
    'img[height="40"]', // 40px avatars
    'img[height="50"]', // 50px avatars

    // Profile-related containers
    '.user-avatar',
    '.profile-avatar',
    '.avatar',

    // Pixiv-specific avatar classes
    '[class*="avatar"]',
    '[class*="profile"]'
  ]

  // Check if image or its container matches avatar selectors
  for (const selector of avatarSelectors) {
    if (img.matches(selector) || img.closest(selector)) {
      return true
    }
  }

  // Check for small image dimensions (likely avatars)
  const imgElement = img as HTMLImageElement
  if (imgElement.naturalWidth > 0 && imgElement.naturalHeight > 0) {
    if (imgElement.naturalWidth <= 60 && imgElement.naturalHeight <= 60) {
      return true
    }
  }

  // Check for user profile URL patterns in parent links
  const parentLink = img.closest('a[href*="/users/"]')
  if (parentLink) {
    return true
  }

  // Check for specific avatar URL patterns
  const src = imgElement.src
  if (
    src &&
    (src.includes('user-profile') ||
      src.includes('_50.') || // 50px profile images
      src.includes('_40.') || // 40px profile images
      src.includes('/profile/') ||
      src.includes('/avatar/'))
  ) {
    return true
  }

  return false
}

function scanAndInjectPixivImages() {
  try {
    const images = findPixivImages()

    images.forEach(img => {
      // Skip if already processed
      if (
        img.closest('.pixiv-emoji-processed') ||
        img.parentElement?.querySelector('.pixiv-emoji-add-btn')
      ) {
        return
      }

      // Skip avatar images - 过滤头像图片
      if (isAvatarImage(img)) {
        return
      }

      // 优先从a标签href获取原图URL - Prioritize getting original image URL from a tag href
      let imageUrl: string | null = null

      // 1. 首先尝试从父级a标签获取原图URL
      const parentLink =
        img.closest('a[href*="i.pximg.net"]') || img.closest('a[href*="img-original"]')
      if (parentLink) {
        const href = parentLink.getAttribute('href')
        if (href && (href.includes('i.pximg.net') || href.includes('img-original'))) {
          imageUrl = href
        }
      }

      // 2. 如果没有找到，使用img的src但尝试转换为原图URL
      if (!imageUrl) {
        const imgSrc = (img as HTMLImageElement).src
        if (imgSrc) {
          // 尝试将缩略图URL转换为原图URL
          imageUrl = imgSrc
            .replace(/\/c\/[^/]+\//, '/img-original/')
            .replace(/\/custom-thumb\/[^/]+\//, '/img-original/')
            .replace(/_square\d*\./, '.')
            .replace(/_master\d*\./, '.')
        }
      }

      if (!imageUrl || !isValidImageUrl(imageUrl)) {
        return
      }

      // Find appropriate container
      let container = img.parentElement

      // Look for better container (artwork container, link container, etc.)
      const artworkContainer =
        img.closest('div[role="presentation"]') ||
        img.closest('a[href*="/artworks/"]') ||
        img.closest('.gtm-expand-full-size-illust') ||
        img.closest('.sc-e4167f06-0') || // Large preview container
        img.closest('.sc-890d9a80-0') || // Another preview container
        img.closest('.sc-890d9a80-1') // Image wrapper container

      if (artworkContainer) {
        container = artworkContainer as HTMLElement
      }

      if (container) {
        container.classList.add('pixiv-emoji-processed')

        // Make container relative for positioning
        const computedStyle = window.getComputedStyle(container)
        if (computedStyle.position === 'static') {
          ;(container as HTMLElement).style.position = 'relative'
        }

        const name = extractFilenameFromUrl(imageUrl)
        const data: AddEmojiButtonData = { name, url: imageUrl }

        const button = createOverlayButtonSP(data, container)
        container.appendChild(button)
      }
    })
  } catch (e) {
    console.error('[Pixiv] Image scan failed:', e)
  }
}

// ===== PIXIV VIEWER DETECTION =====

function detectPixivViewer() {
  try {
    // Look for Pixiv's image viewer
    const viewerSelectors = [
      'div[role="presentation"][style*="cursor: zoom"]',
      '.gtm-expand-full-size-illust',
      'div[data-gtm-value*="expand_illust"]'
    ]

    viewerSelectors.forEach(selector => {
      const viewers = document.querySelectorAll(selector)

      viewers.forEach(viewer => {
        if (viewer.classList.contains('pixiv-viewer-processed')) {
          return
        }

        viewer.classList.add('pixiv-viewer-processed')

        const img = viewer.querySelector('img[src*="pximg.net"]')
        if (img) {
          const imageUrl = (img as HTMLImageElement).src
          if (isValidImageUrl(imageUrl)) {
            const computedStyle = window.getComputedStyle(viewer)
            if (computedStyle.position === 'static') {
              ;(viewer as HTMLElement).style.position = 'relative'
            }

            const name = extractFilenameFromUrl(imageUrl)
            const data: AddEmojiButtonData = { name, url: imageUrl }

            const button = createOverlayButtonSP(data, viewer)
            viewer.appendChild(button)
          }
        }
      })
    })
  } catch (e) {
    console.error('[Pixiv] Viewer detection failed:', e)
  }
}

// ===== MUTATION OBSERVER =====

function observeForChanges() {
  const observer = new MutationObserver(mutations => {
    let shouldScan = false

    mutations.forEach(mutation => {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element

            // Check for new images or containers
            if (
              element.matches('img[src*="pximg.net"]') ||
              element.querySelector('img[src*="pximg.net"]') ||
              element.matches('div[role="presentation"]') ||
              element.querySelector('div[role="presentation"]') ||
              element.matches('.gtm-expand-full-size-illust') ||
              element.querySelector('.gtm-expand-full-size-illust')
            ) {
              shouldScan = true
              break
            }
          }
        }
      }
    })

    if (shouldScan) {
      setTimeout(() => {
        scanAndInjectPixivImages()
        detectPixivViewer()
      }, 100)
    }
  })

  observer.observe(document.body, {
    childList: true,
    subtree: true
  })
}

// ===== URL CHANGE DETECTION =====

function observeUrlChanges() {
  let currentUrl = window.location.href

  const checkUrlChange = () => {
    if (window.location.href !== currentUrl) {
      currentUrl = window.location.href

      // Clear processed markers when URL changes
      document.querySelectorAll('.pixiv-emoji-processed, .pixiv-viewer-processed').forEach(el => {
        el.classList.remove('pixiv-emoji-processed', 'pixiv-viewer-processed')
      })

      // Re-scan after URL change
      setTimeout(() => {
        scanAndInjectPixivImages()
        detectPixivViewer()
      }, 500)
    }
  }

  // Check for URL changes periodically (for SPA navigation)
  setInterval(checkUrlChange, 1000)

  // Also listen for popstate events
  window.addEventListener('popstate', () => {
    setTimeout(checkUrlChange, 100)
  })
}

// ===== MAIN INITIALIZATION =====

function initPixiv() {
  try {
    console.log('[Pixiv] Initializing autonomous content script')

    // Initial scans
    setTimeout(() => {
      scanAndInjectPixivImages()
      detectPixivViewer()
    }, 200)

    // Set up observers
    observeForChanges()
    observeUrlChanges()

    console.log('[Pixiv] Autonomous content script initialized')
  } catch (e) {
    console.error('[Pixiv] Initialization failed:', e)
  }
}

// Auto-initialize when script loads
try {
  initPixiv()
} catch (e) {
  console.error('[Pixiv] Auto-initialization failed:', e)
}
