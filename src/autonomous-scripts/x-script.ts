// Autonomous X (Twitter) Platform Script
// Self-contained script for X/Twitter, includes all necessary functions inline

;(function () {
  'use strict'

  // ==== Platform Detection ====
  function isXPage(): boolean {
    try {
      const host = window.location.hostname.toLowerCase()
      return (
        // x.com and any subdomains like www.x.com, mobile.x.com
        host === 'x.com' ||
        host.endsWith('.x.com') ||
        // legacy twitter domains
        host === 'twitter.com' ||
        host.endsWith('.twitter.com') ||
        host.includes('twitter.com')
      )
    } catch {
      return false
    }
  }

  // ==== Utility Functions ====
  function normalizeUrl(url: string): string {
    try {
      if (!url || !url.trim()) return ''

      const trimmed = url.trim()
      if (!trimmed.startsWith('http')) return ''

      // Remove query parameters for better caching
      const urlObj = new URL(trimmed)
      const cleanUrl = `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`

      return cleanUrl
    } catch {
      return ''
    }
  }

  function extractImageUrl(imgElement: HTMLImageElement): string {
    try {
      if (!imgElement) return ''

      // Get the largest available image
      const src = imgElement.getAttribute('src') || imgElement.src || ''

      // For Twitter/X images, try to get the original size
      if (src.includes('pbs.twimg.com')) {
        // Remove size parameters to get original
        return src.replace(/\?.*$/, '').replace(/&.*$/, '')
      }

      return normalizeUrl(src)
    } catch {
      return ''
    }
  }

  function extractNameFromUrl(url: string): string {
    try {
      const urlObj = new URL(url)
      const pathname = urlObj.pathname
      const filename = pathname.split('/').pop() || ''

      const nameWithoutExt = filename.replace(/\.[^/.]+$/, '')
      const decoded = decodeURIComponent(nameWithoutExt)

      if (/^[0-9a-f]{8,}$/i.test(decoded) || decoded.length < 2) {
        return `x-image-${Date.now()}`
      }

      return decoded || `x-image-${Date.now()}`
    } catch {
      return `x-image-${Date.now()}`
    }
  }

  // ==== Chrome Extension Communication ====
  function sendToBackground(message: any): Promise<any> {
    return new Promise(resolve => {
      try {
        const chromeAPI = (window as any).chrome
        if (chromeAPI && chromeAPI.runtime && chromeAPI.runtime.sendMessage) {
          chromeAPI.runtime.sendMessage(message, (response: any) => {
            resolve(response || { success: false, error: 'No response' })
          })
        } else {
          console.warn('[XScript] Chrome runtime not available')
          resolve({ success: false, error: 'Chrome runtime not available' })
        }
      } catch (e) {
        console.error('[XScript] Failed to send message to background', e)
        resolve({ success: false, error: e.message })
      }
    })
  }

  // ==== Button Creation ====
  function createCarouselAddButton(data: { name: string; url: string }): HTMLElement {
    const btn = document.createElement('button')
    btn.className = 'x-emoji-add-btn-carousel'
    btn.type = 'button'
    btn.title = '添加到未分组表情'
    btn.setAttribute('aria-label', '添加表情')
    btn.setAttribute('role', 'button')

    btn.innerHTML = `
    <div dir="ltr" style="color: rgb(255, 255, 255);">
      <div></div>
        <svg viewBox="0 0 24 24" aria-hidden="true" style="width: 20px; height: 20px; fill: currentColor;">
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
  `.replace(/\s+/g, ' ')

    // Add hover effect
    btn.addEventListener('mouseenter', () => {
      btn.style.background = 'rgba(29, 155, 240, 0.8)'
    })

    btn.addEventListener('mouseleave', () => {
      btn.style.background = 'rgba(0, 0, 0, 0.6)'
    })

    // Add click handler
    btn.addEventListener('click', async e => {
      e.preventDefault()
      e.stopPropagation()

      const originalHTML = btn.innerHTML

      try {
        btn.innerHTML = `
        <div style="color: rgb(255, 255, 255);">
          <div style="animation: spin 1s linear infinite; width: 20px; height: 20px;">⏳</div>
        </div>
      `

        const response = await sendToBackground({
          action: 'addEmojiFromWeb',
          emojiData: data
        })

        if (response.success) {
          btn.innerHTML = `
          <div style="color: rgb(34, 197, 94);">
            <div style="width: 20px; height: 20px;">✅</div>
          </div>
        `
          btn.style.background = 'rgba(34, 197, 94, 0.8)'
        } else {
          btn.innerHTML = `
          <div style="color: rgb(239, 68, 68);">
            <div style="width: 20px; height: 20px;">❌</div>
          </div>
        `
          btn.style.background = 'rgba(239, 68, 68, 0.8)'
        }

        setTimeout(() => {
          btn.innerHTML = originalHTML
          btn.style.background = 'rgba(0, 0, 0, 0.6)'
        }, 2000)
      } catch (error) {
        console.error('[XScript] Add emoji failed', error)
        btn.innerHTML = `
        <div style="color: rgb(239, 68, 68);">
          <div style="width: 20px; height: 20px;">❌</div>
        </div>
      `
        btn.style.background = 'rgba(239, 68, 68, 0.8)'

        setTimeout(() => {
          btn.innerHTML = originalHTML
          btn.style.background = 'rgba(0, 0, 0, 0.6)'
        }, 2000)
      }
    })

    return btn
  }

  // ==== Image Carousel Processing ====
  function processImageCarousel(carousel: Element) {
    try {
      // Skip if already processed
      if (carousel.querySelector('.x-emoji-add-btn-carousel')) {
        return
      }

      const images = carousel.querySelectorAll(
        'img[src*="pbs.twimg.com"], img[src*="twimg.com"]'
      ) as NodeListOf<HTMLImageElement>

      if (images.length === 0) return

      // Create container for buttons
      const buttonContainer = document.createElement('div')
      buttonContainer.style.cssText = `
      position: absolute;
      top: 12px;
      right: 12px;
      display: flex;
      gap: 8px;
      z-index: 10000;
      pointer-events: none;
    `

      images.forEach((img, index) => {
        const imageUrl = extractImageUrl(img)
        if (!imageUrl) return

        const imageName = extractNameFromUrl(imageUrl)
        const data = { name: imageName, url: imageUrl }
        const button = createCarouselAddButton(data)

        // Enable pointer events for the button
        button.style.pointerEvents = 'auto'

        buttonContainer.appendChild(button)
      })

      if (buttonContainer.children.length > 0) {
        // Make sure the carousel container can handle absolute positioning
        const carouselElement = carousel as HTMLElement
        const computed = window.getComputedStyle(carouselElement)
        if (computed.position === 'static') {
          carouselElement.style.position = 'relative'
        }

        carouselElement.appendChild(buttonContainer)
      }
    } catch (e) {
      console.error('[XScript] Process image carousel failed', e)
    }
  }

  // ==== Video Processing ====
  function processVideoElement(video: HTMLVideoElement) {
    try {
      // Skip if already processed
      if (video.parentElement?.querySelector('.x-video-copy-btn')) {
        return
      }

      const videoSrc = video.src || video.currentSrc
      if (!videoSrc) return

      const button = document.createElement('button')
      button.className = 'x-video-copy-btn'
      button.type = 'button'
      button.title = '复制视频链接'
      button.innerHTML = '📋'

      button.style.cssText = `
      position: absolute;
      top: 12px;
      left: 12px;
      background: rgba(0, 0, 0, 0.6);
      border: none;
      border-radius: 6px;
      color: #fff;
      cursor: pointer;
      font-size: 16px;
      padding: 8px;
      z-index: 10000;
      backdrop-filter: blur(4px);
    `

      button.addEventListener('click', async e => {
        e.preventDefault()
        e.stopPropagation()

        try {
          await navigator.clipboard.writeText(videoSrc)
          button.innerHTML = '✅'
          button.style.background = 'rgba(34, 197, 94, 0.8)'

          setTimeout(() => {
            button.innerHTML = '📋'
            button.style.background = 'rgba(0, 0, 0, 0.6)'
          }, 1500)
        } catch (err) {
          console.error('[XScript] Copy to clipboard failed', err)
          button.innerHTML = '❌'
          button.style.background = 'rgba(239, 68, 68, 0.8)'

          setTimeout(() => {
            button.innerHTML = '📋'
            button.style.background = 'rgba(0, 0, 0, 0.6)'
          }, 1500)
        }
      })

      // Make sure the video container can handle absolute positioning
      const container = video.parentElement
      if (container) {
        const computed = window.getComputedStyle(container)
        if (computed.position === 'static') {
          container.style.position = 'relative'
        }
        container.appendChild(button)
      }
    } catch (e) {
      console.error('[XScript] Process video element failed', e)
    }
  }

  // ==== Content Scanning ====
  function scanAndInjectCarousel() {
    try {
      // X/Twitter image carousel selectors
      const carouselSelectors = [
        '[data-testid="tweetPhoto"]',
        '[data-testid="tweet"] img[src*="pbs.twimg.com"]',
        '.media-gallery',
        '[aria-label*="Image"]',
        '.css-1dbjc4n img[src*="twimg.com"]'
      ]

      carouselSelectors.forEach(selector => {
        const elements = document.querySelectorAll(selector)
        elements.forEach(element => {
          // Find the closest container that might be the carousel
          const carousel =
            element.closest('[data-testid="tweetPhoto"]') ||
            element.closest('.media-gallery') ||
            element.parentElement

          if (carousel) {
            processImageCarousel(carousel)
          }
        })
      })
    } catch (e) {
      console.error('[XScript] Scan and inject carousel failed', e)
    }
  }

  function scanAndInjectVideos() {
    try {
      const videos = document.querySelectorAll('video') as NodeListOf<HTMLVideoElement>
      videos.forEach(processVideoElement)
    } catch (e) {
      console.error('[XScript] Scan and inject videos failed', e)
    }
  }

  // ==== DOM Observers ====
  function observeCarousel() {
    const observer = new MutationObserver(mutations => {
      let shouldScan = false

      mutations.forEach(mutation => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as Element

              // Check if the added node contains images or videos
              if (element.tagName === 'IMG' && element.getAttribute('src')?.includes('twimg.com')) {
                shouldScan = true
              } else if (element.tagName === 'VIDEO') {
                shouldScan = true
              } else if (
                element.querySelector &&
                (element.querySelector('img[src*="twimg.com"]') || element.querySelector('video'))
              ) {
                shouldScan = true
              }

              // Check for X/Twitter specific containers
              if (
                element.querySelector &&
                (element.querySelector('[data-testid="tweetPhoto"]') ||
                  element.querySelector('.media-gallery') ||
                  element.querySelector('[data-testid="tweet"]'))
              ) {
                shouldScan = true
              }
            }
          })
        }
      })

      if (shouldScan) {
        setTimeout(() => {
          scanAndInjectCarousel()
          scanAndInjectVideos()
        }, 100)
      }
    })

    observer.observe(document.body, { childList: true, subtree: true })
  }

  // ==== Settings Management ====
  async function getXSettings(): Promise<{ enabled: boolean }> {
    try {
      const response = await sendToBackground({
        type: 'GET_EMOJI_SETTING',
        key: 'enableXcomExtraSelectors'
      })

      const enabled = response.success ? response.data?.value !== false : true // Default to enabled

      return { enabled }
    } catch (e) {
      console.error('[XScript] Failed to get settings', e)
      return { enabled: true } // Default to enabled
    }
  }

  // ==== Main Initialization ====
  async function initXScript() {
    try {
      console.log('[XScript] Initializing...')

      if (!isXPage()) {
        console.log('[XScript] Not an X/Twitter page, skipping initialization')
        return
      }

      const settings = await getXSettings()
      if (!settings.enabled) {
        console.log('[XScript] X features disabled in settings, skipping initialization')
        return
      }

      console.log('[XScript] X/Twitter page detected, starting feature injection')

      // Initial scans with delay to allow page to load
      setTimeout(() => {
        scanAndInjectCarousel()
        scanAndInjectVideos()
      }, 200)

      // Start observer for dynamic content
      observeCarousel()

      console.log('[XScript] Initialization complete')
    } catch (e) {
      console.error('[XScript] Initialization failed', e)
    }
  }

  // ==== Auto-injection Detection and Request ====
  function requestBackendInjection() {
    try {
      // This function can be used to notify the background script
      // that this autonomous script is ready and functional
      sendToBackground({
        type: 'AUTONOMOUS_SCRIPT_READY',
        platform: 'x',
        url: window.location.href,
        timestamp: Date.now()
      })
    } catch (e) {
      console.error('[XScript] Failed to request backend injection', e)
    }
  }

  // ==== Entry Point ====
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initXScript)
  } else {
    initXScript()
  }

  // Request backend injection
  requestBackendInjection()
})()
