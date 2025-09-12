/**
 * Autonomous X/Twitter Content Script
 * Self-contained script for X/Twitter emoji functionality
 * No external dependencies - all utilities inlined
 */

// ===== PAGE DETECTION =====

function isXPage(): boolean {
  try {
    const host = window.location.hostname.toLowerCase()
    return (
      host === 'x.com' ||
      host.endsWith('.twitter.com') ||
      host.includes('twitter.com') ||
      host === 'pbs.twimg.com' ||
      host.endsWith('.twimg.com') ||
      host.includes('twimg.com') ||
      host.includes('pbs.twimg')
    )
  } catch {
    return false
  }
}

// ===== UTILITY FUNCTIONS =====

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
      console.error('[X] Add emoji failed:', error)
      button.innerHTML = '失败'
      button.style.background = 'linear-gradient(135deg,#ef4444,#dc2626)'

      setTimeout(() => {
        button.innerHTML = originalText
        button.style.cssText = originalStyle
      }, 1500)
    }
  })
}

function createOverlayButton(data: AddEmojiButtonData, targetElement: Element): HTMLElement {
  const button = document.createElement('button')
  button.className = 'x-emoji-add-btn'
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

  targetElement.addEventListener('mouseenter', showButton)
  targetElement.addEventListener('mouseleave', hideButton)
  button.addEventListener('mouseenter', showButton)
  button.addEventListener('mouseleave', hideButton)

  return button
}

function extractImageName(url: string): string {
  try {
    const urlObj = new URL(url)
    const pathname = urlObj.pathname
    const filename = pathname.split('/').pop() || 'x-image'
    return filename.split('.')[0] || 'x-image'
  } catch (e) {
    return 'x-image'
  }
}

function isEmojiImage(img: HTMLImageElement): boolean {
  // Check if image is an emoji based on various criteria
  const src = img.src
  const alt = img.alt || ''
  const title = img.title || ''
  const className = img.className || ''

  // Check for emoji-specific patterns
  if (
    src.includes('/emoji/') ||
    src.includes('emoji.svg') ||
    src.includes('twemoji') ||
    className.includes('emoji') ||
    className.includes('r-4qtqp9') || // Twitter emoji class
    alt.length === 1 || // Single character alt (likely emoji)
    alt.length === 2 || // Two character alt (likely emoji with modifier)
    title.includes('emoji') ||
    title.includes('Emoji')
  ) {
    return true
  }

  // Check if image dimensions suggest emoji (typically small and square)
  const width = img.naturalWidth || img.width
  const height = img.naturalHeight || img.height
  if (width > 0 && height > 0 && width <= 32 && height <= 32 && width === height) {
    return true
  }

  return false
}

// ===== IMAGE SCANNING AND INJECTION =====

function scanAndInjectImages() {
  try {
    // Scan for X/Twitter image containers
    const imageSelectors = [
      'img[src*="pbs.twimg.com"]',
      'img[src*="twimg.com"]',
      '[data-testid="tweetPhoto"] img',
      '[data-testid="card.layoutLarge.media"] img',
      'article img[src*="pbs.twimg.com"]'
    ]

    imageSelectors.forEach(selector => {
      const images = document.querySelectorAll(selector)

      images.forEach(img => {
        // Skip if already processed
        if (
          img.closest('.x-emoji-processed') ||
          img.parentElement?.querySelector('.x-emoji-add-btn')
        ) {
          return
        }

        const imageUrl = (img as HTMLImageElement).src
        if (!imageUrl || !imageUrl.includes('twimg.com')) {
          return
        }

        // Skip emoji images
        if (isEmojiImage(img as HTMLImageElement)) {
          return
        }

        // Mark as processed
        const container = img.closest('div') || img.parentElement
        if (container) {
          container.classList.add('x-emoji-processed')

          // Make container relative for positioning
          const computedStyle = window.getComputedStyle(container)
          if (computedStyle.position === 'static') {
            ;(container as HTMLElement).style.position = 'relative'
          }

          const name = extractImageName(imageUrl)
          const data: AddEmojiButtonData = { name, url: imageUrl }

          const button = createOverlayButton(data, container)
          container.appendChild(button)
        }
      })
    })
  } catch (e) {
    console.error('[X] Image scan failed:', e)
  }
}

// ===== CAROUSEL HANDLING =====

function scanAndInjectCarousel() {
  try {
    // Look for carousel containers
    const carouselSelectors = [
      '[data-testid="carousel"]',
      '[data-testid="swiper-0"]',
      '.r-1p0dtai', // Twitter carousel class
      '[role="group"][aria-label*="image"]'
    ]

    carouselSelectors.forEach(selector => {
      const carousels = document.querySelectorAll(selector)

      carousels.forEach(carousel => {
        if (carousel.classList.contains('x-carousel-processed')) {
          return
        }

        carousel.classList.add('x-carousel-processed')

        // Find images within carousel
        const images = carousel.querySelectorAll('img[src*="twimg.com"]')
        images.forEach(img => {
          const imageUrl = (img as HTMLImageElement).src
          if (!imageUrl) return

          // Skip emoji images
          if (isEmojiImage(img as HTMLImageElement)) {
            return
          }

          const container = img.closest('div[role="button"]') || img.parentElement
          if (container && !container.querySelector('.x-emoji-add-btn')) {
            const computedStyle = window.getComputedStyle(container)
            if (computedStyle.position === 'static') {
              ;(container as HTMLElement).style.position = 'relative'
            }

            const name = extractImageName(imageUrl)
            const data: AddEmojiButtonData = { name, url: imageUrl }

            const button = createOverlayButton(data, container)
            container.appendChild(button)
          }
        })
      })
    })
  } catch (e) {
    console.error('[X] Carousel scan failed:', e)
  }
}

// ===== IMAGE PAGE HANDLING =====

function initImagePage() {
  try {
    // Check if this is an image page (single image display)
    const isImagePage =
      window.location.pathname.includes('/photo/') ||
      document.querySelector('[data-testid="photoViewer"]') !== null

    if (!isImagePage) return

    const observer = new MutationObserver(() => {
      const photoViewer = document.querySelector('[data-testid="photoViewer"]')
      if (photoViewer && !photoViewer.classList.contains('x-photo-processed')) {
        photoViewer.classList.add('x-photo-processed')

        const img = photoViewer.querySelector('img[src*="twimg.com"]')
        if (img) {
          // Skip emoji images
          if (isEmojiImage(img as HTMLImageElement)) {
            return
          }

          const imageUrl = (img as HTMLImageElement).src
          const container = img.parentElement

          if (container && !container.querySelector('.x-emoji-add-btn')) {
            const computedStyle = window.getComputedStyle(container)
            if (computedStyle.position === 'static') {
              ;(container as HTMLElement).style.position = 'relative'
            }

            const name = extractImageName(imageUrl)
            const data: AddEmojiButtonData = { name, url: imageUrl }

            const button = createOverlayButton(data, container)
            container.appendChild(button)
          }
        }
      }
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true
    })
  } catch (e) {
    console.error('[X] Image page init failed:', e)
  }
}

// ===== VIDEO COPY FUNCTIONALITY =====

function initVideoCopy() {
  try {
    // Add video URL copy functionality for X videos
    const observer = new MutationObserver(() => {
      const videos = document.querySelectorAll(
        'video[src*="video.twimg.com"], video[poster*="twimg.com"]'
      )

      videos.forEach(video => {
        if (video.classList.contains('x-video-processed')) return
        video.classList.add('x-video-processed')

        const container = video.closest('div[data-testid="videoComponent"]') || video.parentElement
        if (container) {
          const copyButton = document.createElement('button')
          copyButton.className = 'x-video-copy-btn'
          copyButton.innerHTML = '📋'
          copyButton.title = '复制视频链接'

          copyButton.style.cssText = `
            position: absolute;
            top: 8px;
            left: 8px;
            z-index: 9999;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            border: none;
            border-radius: 6px;
            padding: 6px 8px;
            cursor: pointer;
            font-size: 14px;
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

          copyButton.addEventListener('click', async e => {
            e.preventDefault()
            e.stopPropagation()

            try {
              const videoSrc =
                (video as HTMLVideoElement).src || (video as HTMLVideoElement).currentSrc
              if (videoSrc) {
                await navigator.clipboard.writeText(videoSrc)
                copyButton.innerHTML = '✅'
                setTimeout(() => {
                  copyButton.innerHTML = '📋'
                }, 1000)
              }
            } catch (error) {
              console.error('[X] Copy video URL failed:', error)
              copyButton.innerHTML = '❌'
              setTimeout(() => {
                copyButton.innerHTML = '📋'
              }, 1000)
            }
          })

          // Show/hide on hover
          container.addEventListener('mouseenter', () => {
            copyButton.style.opacity = '1'
          })
          container.addEventListener('mouseleave', () => {
            copyButton.style.opacity = '0'
          })

          const computedStyle = window.getComputedStyle(container)
          if (computedStyle.position === 'static') {
            ;(container as HTMLElement).style.position = 'relative'
          }

          container.appendChild(copyButton)
        }
      })
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true
    })
  } catch (e) {
    console.error('[X] Video copy init failed:', e)
  }
}

// ===== MAIN OBSERVER =====

function observeForChanges() {
  const observer = new MutationObserver(mutations => {
    let shouldScanImages = false
    let shouldScanCarousel = false

    mutations.forEach(mutation => {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element

            // Check for new images
            if (
              element.matches('img[src*="twimg.com"]') ||
              element.querySelector('img[src*="twimg.com"]')
            ) {
              shouldScanImages = true
            }

            // Check for new carousels
            if (
              element.matches('[data-testid="carousel"], [data-testid="swiper-0"]') ||
              element.querySelector('[data-testid="carousel"], [data-testid="swiper-0"]')
            ) {
              shouldScanCarousel = true
            }
          }
        }
      }
    })

    if (shouldScanImages) {
      setTimeout(scanAndInjectImages, 100)
    }
    if (shouldScanCarousel) {
      setTimeout(scanAndInjectCarousel, 100)
    }
  })

  observer.observe(document.body, {
    childList: true,
    subtree: true
  })
}

// ===== MAIN INITIALIZATION =====

function initX() {
  try {
    console.log('[X] Initializing autonomous content script')

    // Initial scans
    setTimeout(() => {
      scanAndInjectImages()
      scanAndInjectCarousel()
    }, 200)

    // Initialize specialized handlers
    initImagePage()
    initVideoCopy()

    // Set up observer for dynamic content
    observeForChanges()

    console.log('[X] Autonomous content script initialized')
  } catch (e) {
    console.error('[X] Initialization failed:', e)
  }
}

// Auto-initialize when script loads
try {
  initX()
} catch (e) {
  console.error('[X] Auto-initialization failed:', e)
}
