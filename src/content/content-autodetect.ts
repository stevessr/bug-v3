import { logger } from './utils/buildFLagsV2'
import { initializeEmojiFeature } from './utils/init'
import { Uninject } from './utils/Uninject'

logger.log('[Emoji Extension] Content autodetect loader')

function shouldInjectEmoji(): boolean {
  try {
    const discourseMetaTags = document.querySelectorAll(
      'meta[name*="discourse"], meta[content*="discourse"], meta[property*="discourse"]'
    )
    if (discourseMetaTags.length > 0) return true

    const generatorMeta = document.querySelector('meta[name="generator"]')
    if (generatorMeta) {
      const content = generatorMeta.getAttribute('content')?.toLowerCase() || ''
      if (content.includes('discourse') || content.includes('flarum') || content.includes('phpbb')) return true
    }

    const hostname = window.location.hostname.toLowerCase()
    const allowedDomains = ['linux.do', 'meta.discourse.org']
    if (allowedDomains.some(domain => hostname.includes(domain))) return true

    const editors = document.querySelectorAll(
      'textarea.d-editor-input, .ProseMirror.d-editor-input, .composer-input, .reply-area textarea'
    )
    if (editors.length > 0) return true

    return false
  } catch (e) {
    logger.error('[Emoji Extension] shouldInjectEmoji failed', e)
    return false
  }
}

if (shouldInjectEmoji()) {
  logger.log('[Emoji Extension] autodetect: initializing emoji feature')
  initializeEmojiFeature()
} else {
  Uninject()
  logger.log('[Emoji Extension] autodetect: skipping injection - incompatible platform')
}

// linux.do CSRF helper listener kept here for compatibility
if (window.location.hostname.includes('linux.do') && (window as any).chrome?.runtime?.onMessage) {
  ;(window as any).chrome.runtime.onMessage.addListener((message: any, _sender: any, sendResponse: any) => {
    if (message.type === 'GET_CSRF_TOKEN') {
      try {
        const metaToken = document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement | null
        if (metaToken) {
          sendResponse({ csrfToken: metaToken.content })
          return true
        }
        const match = document.cookie.match(/csrf_token=([^;]+)/)
        if (match) {
          sendResponse({ csrfToken: decodeURIComponent(match[1]) })
          return true
        }
        const hiddenInput = document.querySelector('input[name="authenticity_token"]') as HTMLInputElement | null
        if (hiddenInput) {
          sendResponse({ csrfToken: hiddenInput.value })
          return true
        }
        sendResponse({ csrfToken: '' })
        return true
      } catch (error) {
        logger.warn('[Emoji Extension] Failed to get CSRF token:', error)
        sendResponse({ csrfToken: '' })
        return true
      }
    }
    return false
  })
}
