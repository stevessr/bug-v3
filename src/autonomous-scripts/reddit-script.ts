// Autonomous Reddit Platform Script
// Self-contained script for Reddit, includes all necessary functions inline
// This script will be injected by chrome.scripting.executeScript

// ==== Platform Detection ====
function isRedditPage(): boolean {
    try {
      const host = window.location.hostname.toLowerCase()
      if (host.includes('reddit.com') || host.includes('redd.it')) {
        return true
      }

      // Check for Reddit-specific meta tags
      const ogSite =
        document.querySelector('meta[property="og:site_name"]')?.getAttribute('content') || ''
      if (ogSite.toLowerCase().includes('reddit')) return true

      const twitterMeta =
        document.querySelector('meta[property="twitter:site"]') ||
        document.querySelector('meta[name="twitter:site"]')
      const twitterSite = (twitterMeta && twitterMeta.getAttribute('content')) || ''
      if (twitterSite.toLowerCase().includes('reddit')) return true

      // Check for Reddit-specific page elements
      const redditElements = document.querySelectorAll('[data-testid*="reddit"], .reddit, #reddit')
      if (redditElements.length > 0) return true

      // Check page title
      const title = document.title.toLowerCase()
      if (title.includes('reddit')) return true

      return false
    } catch (e) {
      console.error('[RedditScript] Platform detection failed', e)
      return false
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
          console.warn('[RedditScript] Chrome runtime not available')
          resolve({ success: false, error: 'Chrome runtime not available' })
        }
      } catch (e) {
        console.error('[RedditScript] Failed to send message to background', e)
        resolve({ success: false, error: e.message })
      }
    })
  }

  // ==== Button Creation ====
  function createRedditFloatingButton(data: { name: string; url: string }): HTMLElement {
    const btn = document.createElement('button')
    btn.className = 'reddit-emoji-add-btn'
    btn.type = 'button'
    btn.title = '添加到未分组表情'
    btn.innerHTML = '➕'

    btn.style.cssText = `
    position: absolute;
    right: 8px;
    top: 8px;
    z-index: 100000;
    cursor: pointer;
    border-radius: 6px;
    padding: 6px 8px;
    background: rgba(0, 0, 0, 0.6);
    color: #fff;
    border: none;
    font-weight: 700;
    font-size: 14px;
    transition: all 0.2s ease;
    backdrop-filter: blur(4px);
  `

    // Add hover effect
    btn.addEventListener('mouseenter', () => {
      btn.style.background = 'rgba(255, 69, 0, 0.8)' // Reddit orange
    })

    btn.addEventListener('mouseleave', () => {
      btn.style.background = 'rgba(0, 0, 0, 0.6)'
    })

    const handler = async (ev: Event) => {
      try {
        ev.preventDefault()
        ev.stopPropagation()
      } catch (_e) {
        // ignore
      }

      const originalContent = btn.innerHTML

      try {
        btn.innerHTML = '⏳'
        btn.style.background = 'rgba(100, 100, 100, 0.8)'

        // Send direct URL to background to avoid converting to base64 in content
        const response = await sendToBackground({
          action: 'addEmojiFromWeb',
          emojiData: data
        })

        if (response && response.success) {
          btn.innerHTML = '✅'
          btn.style.background = 'rgba(34, 197, 94, 0.8)' // Green
          setTimeout(() => {
            btn.innerHTML = originalContent
            btn.style.background = 'rgba(0, 0, 0, 0.6)'
          }, 1500)
        } else {
          btn.innerHTML = '❌'
          btn.style.background = 'rgba(239, 68, 68, 0.8)' // Red
          setTimeout(() => {
            btn.innerHTML = originalContent
            btn.style.background = 'rgba(0, 0, 0, 0.6)'
          }, 1500)
        }
      } catch (e) {
        console.error('[RedditScript] Add emoji failed', e)
        btn.innerHTML = '❌'
        btn.style.background = 'rgba(239, 68, 68, 0.8)'
        setTimeout(() => {
          btn.innerHTML = originalContent
          btn.style.background = 'rgba(0, 0, 0, 0.6)'
        }, 1500)
      }
    }

    btn.addEventListener('click', handler)
    btn.addEventListener('pointerdown', handler)

    return btn
  }

  // ==== Content Detection and Processing ====
  function isRedditImageContainer(el: Element | null): boolean {
    try {
      if (!el) return false

      // Reddit often uses role="presentation" on its lightbox container
      if (el.getAttribute && el.getAttribute('role') === 'presentation') {
        return !!el.querySelector('img')
      }

      // Post thumbnails / previews may have specific classes - best-effort match
      const className = (el.className || '') as string
      if (
        className.includes('media-lightbox-img') ||
        className.includes('preview-img') ||
        className.includes('ImageBox') ||
        className.includes('media-preview')
      ) {
        return !!el.querySelector('img')
      }

      // Check for Reddit-specific data attributes
      if (
        el.hasAttribute &&
        (el.hasAttribute('data-testid') || el.hasAttribute('data-adclicklocation'))
      ) {
        return !!el.querySelector('img')
      }

      return false
    } catch (_e) {
      return false
    }
  }

  function extractEmojiDataFromReddit(container: Element): { name: string; url: string } | null {
    try {
      const img = container.querySelector('img') as HTMLImageElement | null
      if (!img || !img.src) return null

      let src = img.getAttribute('src') || img.src || ''

      // Prefer the largest candidate from srcset if available
      const srcset = img.getAttribute('srcset') || ''
      if ((!src || src.startsWith('data:')) && srcset) {
        const candidates = srcset.split(',').map(s => s.trim())
        const largest = candidates[candidates.length - 1] || ''
        src = (largest.split(' ')[0] || '').trim() || src
      }

      if (!src || !src.startsWith('http')) return null

      let name = (img.getAttribute('alt') || img.getAttribute('title') || '')?.trim() || ''
      if (!name || name.length < 2) {
        // Try to extract from URL or use default
        try {
          const urlObj = new URL(src)
          const filename = urlObj.pathname.split('/').pop() || ''
          name = filename.replace(/\.[^/.]+$/, '') || 'reddit-emoji'
        } catch {
          name = 'reddit-emoji'
        }
      }

      // Clean up name
      name = name.replace(/[^\w\s-]/g, '').trim()
      if (name.length === 0) name = 'reddit-emoji'

      return { name, url: src }
    } catch (_e) {
      return null
    }
  }

  function addEmojiButtonToContainer(container: Element) {
    try {
      if (!container) return

      // Skip if already processed
      if (
        container.querySelector('.reddit-emoji-add-btn') ||
        container.querySelector('.emoji-add-link-pixiv')
      ) {
        return
      }

      const data = extractEmojiDataFromReddit(container)
      if (!data) return

      const btn = createRedditFloatingButton(data)

      try {
        const parentEl = container as HTMLElement
        const computed = window.getComputedStyle(parentEl)
        if (computed.position === 'static' || !computed.position) {
          parentEl.style.position = 'relative'
        }
      } catch (_e) {
        // ignore
      }

      container.appendChild(btn)
    } catch (e) {
      console.error('[RedditScript] Add emoji button failed', e)
    }
  }

  // ==== Scanning Functions ====
  function scanForRedditImages() {
    try {
      // Look for Reddit-specific image containers
      const selectors = [
        '[role="presentation"]',
        '.media-lightbox-img',
        '.preview-img',
        '.ImageBox',
        '.media-preview',
        '[data-testid*="post-content"]',
        '[data-testid*="media"]',
        '.Post img',
        '.thing img',
        '.media img'
      ]

      const candidates = new Set<Element>()

      // Collect unique candidates
      selectors.forEach(selector => {
        try {
          const elements = document.querySelectorAll(selector)
          elements.forEach(el => {
            if (isRedditImageContainer(el)) {
              candidates.add(el)
            }
          })
        } catch (e) {
          console.warn('[RedditScript] Selector failed:', selector, e)
        }
      })

      // Process each candidate
      candidates.forEach(container => {
        addEmojiButtonToContainer(container)
      })

      // Fallback: scan images directly and process their parents
      const imgs = Array.from(document.querySelectorAll('img'))
      for (const img of imgs) {
        const parent = img.parentElement
        if (!parent) continue

        // Skip if already processed
        if (
          parent.querySelector('.reddit-emoji-add-btn') ||
          parent.querySelector('.emoji-add-link-pixiv')
        ) {
          continue
        }

        // Check if this looks like a Reddit post image
        const parentClass = (parent.className || '') as string
        const imgSrc = img.src || ''

        if (
          imgSrc.includes('redd.it') ||
          imgSrc.includes('reddit') ||
          parentClass.includes('media') ||
          parentClass.includes('post') ||
          parent.getAttribute('data-testid')
        ) {
          addEmojiButtonToContainer(parent)
        }
      }
    } catch (e) {
      console.error('[RedditScript] Scan for Reddit images failed', e)
    }
  }

  // ==== DOM Observer ====
  function observeReddit() {
    const observer = new MutationObserver(mutations => {
      let shouldScan = false

      mutations.forEach(mutation => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType !== Node.ELEMENT_NODE) return

            const el = node as Element

            // Check if the added node is or contains images
            if (el.tagName === 'IMG') {
              shouldScan = true
            } else if (isRedditImageContainer(el)) {
              shouldScan = true
            } else if (el.querySelector && el.querySelector('img')) {
              shouldScan = true
            }

            // Check for Reddit-specific containers
            if (
              el.getAttribute &&
              (el.getAttribute('data-testid') ||
                el.getAttribute('role') === 'presentation' ||
                el.className.includes('Post') ||
                el.className.includes('media'))
            ) {
              shouldScan = true
            }
          })
        }
      })

      if (shouldScan) {
        setTimeout(scanForRedditImages, 120)
      }
    })

    observer.observe(document.body, { childList: true, subtree: true })
  }

  // ==== Main Initialization ====
  function initRedditScript() {
    try {
      console.log('[RedditScript] Initializing...')

      if (!isRedditPage()) {
        console.log('[RedditScript] Not a Reddit page, skipping initialization')
        return
      }

      console.log('[RedditScript] Reddit page detected, starting feature injection')

      // Initial scan with delay to allow page to load
      setTimeout(scanForRedditImages, 200)

      // Start observer for dynamic content
      observeReddit()

      console.log('[RedditScript] Initialization complete')
    } catch (e) {
      console.error('[RedditScript] Initialization failed', e)
    }
  }

  // ==== Auto-injection Detection and Request ====
  function requestBackendInjection() {
    try {
      // This function can be used to notify the background script
      // that this autonomous script is ready and functional
      sendToBackground({
        type: 'AUTONOMOUS_SCRIPT_READY',
        platform: 'reddit',
        url: window.location.href,
        timestamp: Date.now()
      })
    } catch (e) {
      console.error('[RedditScript] Failed to request backend injection', e)
    }
  }

  // ==== Entry Point ====
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initRedditScript)
  } else {
    initRedditScript()
  }

// Request backend injection
requestBackendInjection()
