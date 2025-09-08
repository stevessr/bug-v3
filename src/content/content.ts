// Entry point: 初始化模块并启动功能
import { logger } from '../config/buildFLagsV2'

import { initializeEmojiFeature } from './init'
import { Uninject } from './Uninject'

logger.log('[Emoji Extension] Content script loaded (entry)')

// Function to check if current page should have emoji injection
function shouldInjectEmoji(): boolean {
  // Check for discourse meta tag as example
  const discourseMetaTags = document.querySelectorAll(
    'meta[name*="discourse"], meta[content*="discourse"], meta[property*="discourse"]'
  )
  if (discourseMetaTags.length > 0) {
    logger.log('[Emoji Extension] Discourse detected via meta tags')
    return true
  }

  // Check for common forum/discussion platforms
  const generatorMeta = document.querySelector('meta[name="generator"]')
  if (generatorMeta) {
    const content = generatorMeta.getAttribute('content')?.toLowerCase() || ''
    if (content.includes('discourse') || content.includes('flarum') || content.includes('phpbb')) {
      logger.log('[Emoji Extension] Forum platform detected via generator meta')
      return true
    }
  }

  // Check current domain - allow linux.do and other known sites
  const hostname = window.location.hostname.toLowerCase()
  const allowedDomains = ['linux.do', 'meta.discourse.org']
  if (allowedDomains.some(domain => hostname.includes(domain))) {
    logger.log('[Emoji Extension] Allowed domain detected:', hostname)
    return true
  }

  // Check for editor elements that suggest a discussion platform
  const editors = document.querySelectorAll(
    'textarea.d-editor-input, .ProseMirror.d-editor-input, .composer-input, .reply-area textarea'
  )
  if (editors.length > 0) {
    logger.log('[Emoji Extension] Discussion editor detected')
    return true
  }

  logger.log('[Emoji Extension] No compatible platform detected')
  return false
}

// Only inject if compatible platform is detected
if (shouldInjectEmoji()) {
  logger.log('[Emoji Extension] Initializing emoji feature')
  initializeEmojiFeature()
} else {
  Uninject()
  logger.log('[Emoji Extension] Skipping injection - incompatible platform')
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
          return
        }

        // Try to get from cookie
        const match = document.cookie.match(/csrf_token=([^;]+)/)
        if (match) {
          sendResponse({ csrfToken: decodeURIComponent(match[1]) })
          return
        }

        // Fallback - try to extract from any form
        const hiddenInput = document.querySelector(
          'input[name="authenticity_token"]'
        ) as HTMLInputElement
        if (hiddenInput) {
          sendResponse({ csrfToken: hiddenInput.value })
          return
        }

        sendResponse({ csrfToken: '' })
      } catch (error) {
        logger.warn('[Emoji Extension] Failed to get CSRF token:', error)
        sendResponse({ csrfToken: '' })
      }
    }
  })
}
