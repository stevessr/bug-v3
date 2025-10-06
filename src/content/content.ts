// Entry point: 初始化模块并启动功能

import { initializeEmojiFeature } from './utils/init'
import { Uninject } from './utils/Uninject'
import { postTimings } from './utils/timingsBinder'
import { autoReadAllv2 } from './utils/autoReadReplies'
import { initAntiRateLimit } from './utils/antiRateLimit'

console.log('[Emoji Extension] Content script loaded (entry)')

// Function to check if current page should have emoji injection
function shouldInjectEmoji(): boolean {
  // Check for discourse meta tag as example
  const discourseMetaTags = document.querySelectorAll(
    'meta[name*="discourse"], meta[content*="discourse"], meta[property*="discourse"]'
  )
  if (discourseMetaTags.length > 0) {
    console.log('[Emoji Extension] Discourse detected via meta tags')
    return true
  }

  // Check for common forum/discussion platforms
  const generatorMeta = document.querySelector('meta[name="generator"]')
  if (generatorMeta) {
    const content = generatorMeta.getAttribute('content')?.toLowerCase() || ''
    if (content.includes('discourse') || content.includes('flarum') || content.includes('phpbb')) {
      console.log('[Emoji Extension] Forum platform detected via generator meta')
      return true
    }
  }

  // Check current domain - allow linux.do and other known sites
  const hostname = window.location.hostname.toLowerCase()
  const allowedDomains = ['linux.do', 'meta.discourse.org']
  if (allowedDomains.some(domain => hostname.includes(domain))) {
    console.log('[Emoji Extension] Allowed domain detected:', hostname)
    return true
  }

  // Check for editor elements that suggest a discussion platform
  const editors = document.querySelectorAll(
    'textarea.d-editor-input, .ProseMirror.d-editor-input, .composer-input, .reply-area textarea'
  )
  if (editors.length > 0) {
    console.log('[Emoji Extension] Discussion editor detected')
    return true
  }

  console.log('[Emoji Extension] No compatible platform detected')
  return false
}

// Only inject if compatible platform is detected
if (shouldInjectEmoji()) {
  console.log('[Emoji Extension] Initializing emoji feature')
  initializeEmojiFeature()
} else {
  Uninject()
  console.log('[Emoji Extension] Skipping injection - incompatible platform')
}

// Add message listener for linux.do CSRF token requests
if (window.location.hostname.includes('linux.do')) {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'GET_CSRF_TOKEN') {
      try {
        // Try to get CSRF token from meta tag
        const metaToken = document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement
        if (metaToken) {
          sendResponse({ csrfToken: metaToken.content })
          return true // 表示异步响应
        }

        // Try to get from cookie
        const match = document.cookie.match(/csrf_token=([^;]+)/)
        if (match) {
          sendResponse({ csrfToken: decodeURIComponent(match[1]) })
          return true // 表示异步响应
        }

        // Fallback - try to extract from any form
        const hiddenInput = document.querySelector(
          'input[name="authenticity_token"]'
        ) as HTMLInputElement
        if (hiddenInput) {
          sendResponse({ csrfToken: hiddenInput.value })
          return true // 表示异步响应
        }

        sendResponse({ csrfToken: '' })
        return true // 表示异步响应
      } catch (error) {
        console.warn('[Emoji Extension] Failed to get CSRF token:', error)
        sendResponse({ csrfToken: '' })
        return true // 表示异步响应
      }
    }
    return false // 对于其他消息类型，不处理
  })
}

// Expose postTimings helper to page context for testing and manual triggers.
// We attach it to window only on linux.do pages to avoid polluting other sites.
try {
  if (window.location.hostname.includes('linux.do')) {
    // Directly bind the statically imported postTimings

    // @ts-ignore
    window.postTimings = postTimings
    // expose autoReadAllv2 for userscripts / page scripts
    // @ts-ignore
    window.autoReadAllRepliesV2 = autoReadAllv2
  }
} catch (e) {
  console.warn('[Emoji Extension] failed to expose postTimings to window', e)
}

// Initialize 429 error interceptor for linux.do
// This will automatically trigger Cloudflare challenge when rate limit is hit
if (window.location.hostname.includes('linux.do')) {
  try {
    initAntiRateLimit()
  } catch (error) {
    console.error('[Emoji Extension] Failed to initialize anti-rate-limit:', error)
  }
}
