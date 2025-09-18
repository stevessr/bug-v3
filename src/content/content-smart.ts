// Smart Content Script with Intelligent Platform Injection
// This script detects the platform and requests the background to inject the appropriate script

import { initializeEmojiFeature } from './utils/init'
import { postTimings } from './utils/timingsBinder'

console.log('[Emoji Extension] Smart content script loaded')

// ==== Platform Detection ====
function detectPlatform(): 'discourse' | 'x' | 'pixiv' | 'reddit' | 'emoji' | 'unknown' {
  try {
    const hostname = window.location.hostname.toLowerCase()

    // X (Twitter) detection
    if (
      hostname === 'x.com' ||
      hostname.endsWith('.x.com') ||
      hostname === 'twitter.com' ||
      hostname.endsWith('.twitter.com') ||
      hostname.includes('twitter.com')
    ) {
      return 'x'
    }

    // Pixiv detection
    if (
      hostname.includes('pixiv.net') ||
      hostname.includes('pximg.net') ||
      hostname.includes('i.pximg.net')
    ) {
      return 'pixiv'
    }

    // Reddit detection
    if (hostname.includes('reddit.com') || hostname.includes('redd.it')) {
      return 'reddit'
    }

    // Discourse detection - check meta tags first
    const discourseMetaTags = document.querySelectorAll(
      'meta[name*="discourse"], meta[content*="discourse"], meta[property*="discourse"]'
    )
    if (discourseMetaTags.length > 0) {
      return 'discourse'
    }

    // Check generator meta tag
    const generatorMeta = document.querySelector('meta[name="generator"]')
    if (generatorMeta) {
      const content = generatorMeta.getAttribute('content')?.toLowerCase() || ''
      if (content.includes('discourse') || content.includes('flarum') || content.includes('phpbb')) {
        return 'discourse'
      }
    }

    // Check known discourse domains
    const discourseDomains = ['linux.do', 'meta.discourse.org']
    if (discourseDomains.some(domain => hostname.includes(domain))) {
      return 'discourse'
    }

    // Check for discourse editor elements
    const editors = document.querySelectorAll(
      'textarea.d-editor-input, .ProseMirror.d-editor-input, .composer-input'
    )
    if (editors.length > 0) {
      return 'discourse'
    }

    // Check for any forum/discussion platform that should get emoji features
    const allowedDomains = ['linux.do', 'meta.discourse.org']
    if (allowedDomains.some(domain => hostname.includes(domain))) {
      return 'emoji' // Should get emoji picker but not platform-specific injection
    }

    return 'unknown'
  } catch (e) {
    console.error('[Emoji Extension] Platform detection failed', e)
    return 'unknown'
  }
}

// ==== Chrome Extension Communication ====
function sendToBackground(message: any): Promise<any> {
  return new Promise((resolve) => {
    try {
      const chromeAPI = chrome
      if (chromeAPI && chromeAPI.runtime && chromeAPI.runtime.sendMessage) {
        chromeAPI.runtime.sendMessage(message, (response: any) => {
          resolve(response || { success: false, error: 'No response' })
        })
      } else {
        console.warn('[Emoji Extension] Chrome runtime not available')
        resolve({ success: false, error: 'Chrome runtime not available' })
      }
    } catch (e) {
      console.error('[Emoji Extension] Failed to send message to background', e)
      resolve({ success: false, error: e.message })
    }
  })
}

// ==== Request Platform Script Injection ====
async function requestPlatformInjection(platform: string): Promise<boolean> {
  try {
    console.log(`[Emoji Extension] Requesting injection for platform: ${platform}`)
    
    const response = await sendToBackground({
      type: 'INJECT_PLATFORM_SCRIPT',
      platform: platform,
      url: window.location.href,
      tabId: undefined // Background will determine the current tab
    })
    
    if (response.success) {
      console.log(`[Emoji Extension] Platform script injection requested successfully for ${platform}`)
      return true
    } else {
      console.warn(`[Emoji Extension] Failed to request injection for ${platform}:`, response.error)
      return false
    }
  } catch (e) {
    console.error(`[Emoji Extension] Failed to request platform injection for ${platform}:`, e)
    return false
  }
}

// ==== Main Initialization Logic ====
async function initializeSmartContent() {
  try {
    console.log('[Emoji Extension] Initializing smart content script...')
    
    // Detect the current platform
    const platform = detectPlatform()
    console.log(`[Emoji Extension] Detected platform: ${platform}`)
    
    // Handle different platform types
    switch (platform) {
      case 'discourse':
      case 'x':
      case 'pixiv':
      case 'reddit':
        // Request background to inject the platform-specific script
        console.log(`[Emoji Extension] Requesting platform script injection for ${platform}`)
        const success = await requestPlatformInjection(platform)
        
        if (success) {
          console.log(`[Emoji Extension] Platform script injection requested successfully for ${platform}`)
        } else {
          console.error(`[Emoji Extension] Failed to request platform script injection for ${platform}`)
        }
        break
        
      case 'emoji':
        // Only load emoji picker features, no platform-specific injection
        console.log('[Emoji Extension] Initializing emoji features only')
        initializeEmojiFeature()
        break
        
      case 'unknown':
      default:
        console.log('[Emoji Extension] Unknown platform, no features will be loaded')
        break
    }
    
    // Notify background about platform detection
    sendToBackground({
      type: 'PLATFORM_DETECTED',
      platform: platform,
      url: window.location.href,
      timestamp: Date.now()
    })
    
  } catch (e) {
    console.error('[Emoji Extension] Smart content script initialization failed', e)
  }
}

// ==== CSRF Token Support for linux.do ====
// Keep the existing CSRF token functionality for compatibility
if (window.location.hostname.includes('linux.do')) {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'GET_CSRF_TOKEN') {
      try {
        // Try to get CSRF token from meta tag
        const metaToken = document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement
        if (metaToken) {
          sendResponse({ csrfToken: metaToken.content })
          return true
        }

        // Try to get from cookie
        const match = document.cookie.match(/csrf_token=([^;]+)/)
        if (match) {
          sendResponse({ csrfToken: decodeURIComponent(match[1]) })
          return true
        }

        // Fallback - try to extract from any form
        const hiddenInput = document.querySelector(
          'input[name="authenticity_token"]'
        ) as HTMLInputElement
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
  })
}

// ==== Expose Timing Helper ====
// Keep the existing postTimings exposure for compatibility
try {
  if (window.location.hostname.includes('linux.do')) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    window.postTimings = postTimings
  }
} catch (e) {
  console.warn('[Emoji Extension] failed to expose postTimings to window', e)
}

// ==== Entry Point ====
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeSmartContent)
} else {
  initializeSmartContent()
}