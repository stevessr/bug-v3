/**
 * Autonomous Auto-Detection Content Script
 * Self-contained script for page type detection and injection coordination
 * No external dependencies - all utilities inlined
 */

// ===== PAGE TYPE DETECTION =====

function detectPageType(): string {
  try {
    const hostname = window.location.hostname.toLowerCase()
    const pathname = window.location.pathname.toLowerCase()
    
    // Quick host checks
    if (hostname.includes('bilibili') || hostname.includes('hdslb.com')) {
      console.debug('[Emoji Extension] detectPageType: matched bilibili by hostname', hostname)
      return 'bilibili'
    }
    
    if (hostname.includes('pixiv') || hostname.includes('pximg.net')) {
      console.debug('[Emoji Extension] detectPageType: matched pixiv by hostname', hostname)
      return 'pixiv'
    }
    
    if (hostname.includes('twitter') || hostname.includes('x.com')) {
      console.debug('[Emoji Extension] detectPageType: matched x/twitter by hostname', hostname)
      return 'x'
    }
    
    // Discourse and other forums
    const discourseMetaTags = document.querySelectorAll(
      'meta[name*="discourse"], meta[content*="discourse"], meta[property*="discourse"]'
    )
    if (discourseMetaTags.length > 0) {
      console.debug('[Emoji Extension] detectPageType: matched discourse by meta tags')
      return 'discourse'
    }
    
    const generatorMeta = document.querySelector('meta[name="generator"]')
    if (generatorMeta) {
      const genContent = generatorMeta.getAttribute('content')?.toLowerCase() || ''
      if (
        genContent.includes('discourse') ||
        genContent.includes('flarum') ||
        genContent.includes('phpbb')
      ) {
        console.debug('[Emoji Extension] detectPageType: matched discourse by generator meta', genContent)
        return 'discourse'
      }
    }
    
    const allowedDomains = ['linux.do', 'meta.discourse.org']
    if (allowedDomains.some(domain => hostname.includes(domain))) {
      console.debug('[Emoji Extension] detectPageType: matched discourse by allowed domain', hostname)
      return 'discourse'
    }
    
    // Fallback for editors that might be discourse
    const editors = document.querySelectorAll(
      'textarea.d-editor-input, .ProseMirror.d-editor-input, .composer-input, .reply-area textarea'
    )
    if (editors.length > 0) {
      console.debug('[Emoji Extension] detectPageType: matched generic editor presence', editors.length)
      return 'generic'
    }
    
    console.debug('[Emoji Extension] detectPageType: no match for hostname', hostname)
    return '' // No specific page type detected
  } catch (e) {
    console.warn('[Emoji Extension] detectPageType failed', e)
    return ''
  }
}

// ===== IMAGE PAGE DETECTION =====

function isImageDirectLinkPage(): boolean {
  try {
    const host = window.location.hostname.toLowerCase()
    
    // Exclude pixiv related domains
    if (host.includes('pximg.net') || host.includes('pixiv.net')) {
      return false
    }
    
    // Only handle common image formats
    const imgExt = ['.jpg', '.jpeg', '.png', '.gif', '.webp']
    
    // Allow URLs that end with image extensions OR have image format in query (e.g., ?format=jpg)
    try {
      const urlObj = new URL(window.location.href)
      const pathname = urlObj.pathname.toLowerCase()
      const search = urlObj.search.toLowerCase()
      const hasExt = imgExt.some(ext => pathname.endsWith(ext))
      const formatParamMatch = /format=(jpg|jpeg|png|gif|webp)/.test(search)
      
      if (!hasExt && !formatParamMatch) {
        return false
      }
    } catch (e) {
      // If URL parsing fails, fallback to previous behavior
      const url = window.location.href.split('?')[0].toLowerCase()
      if (!imgExt.some(ext => url.endsWith(ext))) {
        return false
      }
    }
    
    // Page should have only one img element
    const imgs = Array.from(document.querySelectorAll('img'))
    if (imgs.length !== 1) {
      return false
    }
    
    return true
  } catch (e) {
    console.warn('[Emoji Extension] isImageDirectLinkPage failed', e)
    return false
  }
}

// ===== CSRF TOKEN HELPER =====

function setupCSRFTokenListener() {
  // linux.do CSRF helper listener for compatibility
  if (window.location.hostname.includes('linux.do') && (window as any).chrome?.runtime?.onMessage) {
    (window as any).chrome.runtime.onMessage.addListener(
      (message: any, _sender: any, sendResponse: any) => {
        if (message.type === 'GET_CSRF_TOKEN') {
          try {
            const metaToken = document.querySelector(
              'meta[name="csrf-token"]'
            ) as HTMLMetaElement | null
            if (metaToken) {
              sendResponse({ csrfToken: metaToken.content })
              return true
            }
            
            const match = document.cookie.match(/csrf_token=([^;]+)/)
            if (match) {
              sendResponse({ csrfToken: decodeURIComponent(match[1]) })
              return true
            }
            
            const hiddenInput = document.querySelector(
              'input[name="authenticity_token"]'
            ) as HTMLInputElement | null
            if (hiddenInput) {
              sendResponse({ csrfToken: hiddenInput.value })
              return true
            }
            
            sendResponse({ csrfToken: '' })
            return true
          } catch (error) {
            console.warn('[Emoji Extension] Failed to get CSRF token:', error)
            sendResponse({ csrfToken: '' })
            return true
          }
        }
        return false
      }
    )
  }
}

// ===== INJECTION REQUEST =====

function requestContentScriptInjection(pageType: string) {
  try {
    if ((window as any).chrome?.runtime?.sendMessage) {
      const payload = { action: 'requestInject', pageType }
      console.info('[Emoji Extension] Requesting background injection', payload)
      
      ;(window as any).chrome.runtime.sendMessage(payload, (response: any) => {
        console.info('[Emoji Extension] Background requestInject response', { pageType, response })
      })
    } else {
      console.warn('[Emoji Extension] chrome.runtime.sendMessage not available; cannot request injection')
    }
  } catch (e) {
    console.error('[Emoji Extension] Failed to request background inject', e)
  }
}

function requestImageScriptInjection() {
  try {
    if ((window as any).chrome?.runtime?.sendMessage) {
      (window as any).chrome.runtime.sendMessage({ action: 'injectImageScript' }, (response: any) => {
        console.log('[Emoji Extension] Requested background to inject images/image-inject.js', response)
      })
    } else {
      console.warn('[Emoji Extension] chrome.runtime.sendMessage not available; cannot request image script injection')
    }
  } catch (e) {
    console.error('[Emoji Extension] Failed to request image script injection', e)
  }
}

// ===== DELAYED DETECTION =====

function performDelayedDetection() {
  // Sometimes page content loads after initial script execution
  setTimeout(() => {
    const pageType = detectPageType()
    if (pageType && pageType !== 'generic') {
      console.info('[Emoji Extension] Delayed detection found page type:', pageType)
      requestContentScriptInjection(pageType)
    }
  }, 1000)
  
  // Check for image pages after DOM is more stable
  setTimeout(() => {
    if (isImageDirectLinkPage()) {
      console.info('[Emoji Extension] Delayed detection found image direct link page')
      requestImageScriptInjection()
    }
  }, 1500)
}

// ===== URL CHANGE DETECTION =====

function observeUrlChanges() {
  let currentUrl = window.location.href
  
  const checkUrlChange = () => {
    if (window.location.href !== currentUrl) {
      currentUrl = window.location.href
      console.info('[Emoji Extension] URL changed, re-detecting page type')
      
      // Re-detect page type after URL change
      setTimeout(() => {
        const pageType = detectPageType()
        if (pageType) {
          requestContentScriptInjection(pageType)
        }
        
        if (isImageDirectLinkPage()) {
          requestImageScriptInjection()
        }
      }, 500)
    }
  }
  
  // Check for URL changes periodically (for SPA navigation)
  setInterval(checkUrlChange, 2000)
  
  // Also listen for popstate events
  window.addEventListener('popstate', () => {
    setTimeout(checkUrlChange, 100)
  })
}

// ===== MAIN INITIALIZATION =====

function initAutoDetect() {
  try {
    console.log('[Emoji Extension] Auto-detection script loaded')
    console.log('[Emoji Extension] Location:', {
      href: window.location.href,
      hostname: window.location.hostname,
      pathname: window.location.pathname
    })
    
    // Set up CSRF token listener
    setupCSRFTokenListener()
    
    // Initial page type detection
    const pageType = detectPageType()
    if (pageType) {
      console.info('[Emoji Extension] Initial detection found page type:', pageType)
      requestContentScriptInjection(pageType)
    }
    
    // Check for image direct link pages
    if (isImageDirectLinkPage()) {
      console.info('[Emoji Extension] Initial detection found image direct link page')
      requestImageScriptInjection()
    }
    
    // Set up delayed detection for dynamic content
    performDelayedDetection()
    
    // Set up URL change observation for SPAs
    observeUrlChanges()
    
    console.log('[Emoji Extension] Auto-detection script initialized')
  } catch (e) {
    console.error('[Emoji Extension] Auto-detection initialization failed:', e)
  }
}

// Auto-initialize when script loads
try {
  initAutoDetect()
} catch (e) {
  console.error('[Emoji Extension] Auto-detection auto-initialization failed:', e)
}
