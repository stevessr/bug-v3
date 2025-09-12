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
          action: 'uploadPixivEmojiToLinuxDo',
          imageData: {
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

// Download image from Pixiv using canvas to respect origin restrictions
async function downloadPixivImage(imageUrl: string): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')

        if (!ctx) {
          reject(new Error('Cannot get canvas context'))
          return
        }

        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight

        ctx.drawImage(img, 0, 0)

        canvas.toBlob(
          blob => {
            if (!blob) {
              reject(new Error('Failed to create blob'))
              return
            }

            const reader = new FileReader()
            reader.onload = () => {
              const arrayBuffer = reader.result as ArrayBuffer
              resolve(new Uint8Array(arrayBuffer))
            }
            reader.onerror = () => reject(new Error('Failed to read blob'))
            reader.readAsArrayBuffer(blob)
          },
          'image/jpeg',
          0.9
        )
      } catch (error) {
        reject(error)
      }
    }

    img.onerror = () => {
      // Fallback: try direct fetch (may fail due to CORS)
      fetch(imageUrl, {
        headers: {
          Referer: 'https://www.pixiv.net/'
        }
      })
        .then(response => response.arrayBuffer())
        .then(buffer => resolve(new Uint8Array(buffer)))
        .catch(error => reject(new Error(`Failed to download image: ${error.message}`)))
    }

    // Set referer for Pixiv images
    img.src = imageUrl
  })
}

function createOverlayButton(data: AddEmojiButtonData, targetElement: Element): HTMLElement {
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

  return images.filter(
    (img, index, self) => self.indexOf(img) === index // Remove duplicates
  )
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

      const imageUrl = (img as HTMLImageElement).src
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

        const button = createOverlayButton(data, container)
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

            const button = createOverlayButton(data, viewer)
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
