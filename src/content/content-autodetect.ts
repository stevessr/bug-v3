
import { initializeEmojiFeature } from './utils/init'
import { Uninject } from './utils/Uninject'

// Safe stringify helper to avoid [object Object] and handle circular refs
function safeStringify(obj: any) {
  const seen = new WeakSet()
  return JSON.stringify(obj, function (_key, value) {
    if (value && typeof value === 'object') {
      if (seen.has(value)) return '[Circular]'
      seen.add(value)
    }
    return value
  })
}

console.log('[Emoji Extension] Content autodetect loader')

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
    console.error('[Emoji Extension] shouldInjectEmoji failed', e)
    return false
  }
}

if (shouldInjectEmoji()) {
  console.log('[Emoji Extension] autodetect: requesting background to inject content')

  // Determine a coarse pageType to inform background which scripts to inject
  function detectPageType(): string {
    try {
      const hostname = window.location.hostname.toLowerCase()
      if (hostname.includes('bilibili')) return 'bilibili'
      if (hostname.includes('pixiv')) return 'pixiv'
      if (hostname.includes('twitter') || hostname.includes('x.com')) return 'x'
      // discourse-like
      const discourseMeta = document.querySelectorAll('meta[name*="discourse"], meta[content*="discourse"]').length
      if (discourseMeta > 0) return 'discourse'
      return 'generic'
    } catch (e) {
      return 'generic'
    }
  }

  const pageType = detectPageType()

  if ((window as any).chrome && (window as any).chrome.runtime && (window as any).chrome.runtime.sendMessage) {
    try {
      ;(window as any).chrome.runtime.sendMessage({ action: 'requestInject', pageType }, (response: any) => {
        if (response && response.success) {
          console.log('[Emoji Extension] background injected content:', response.message)
        } else {
          // Prefer explicit error/message fields, otherwise safely stringify
          let respLog: string = 'no response'
          try {
            if (response && typeof response === 'object') {
              if (response.error) respLog = String(response.error)
              else if (response.message) respLog = String(response.message)
              else respLog = safeStringify(response)
            } else if (response !== undefined) {
              respLog = String(response)
            }
          } catch (e) {
            respLog = String(e)
          }

          console.warn('[Emoji Extension] background failed to inject, falling back to local init', respLog)
          // fallback to legacy in-page initialization
          initializeEmojiFeature()
        }
      })
    } catch (e) {
      console.warn('[Emoji Extension] sendMessage failed, falling back to local init', e)
      initializeEmojiFeature()
    }
  } else {
    // If runtime not available, run local init (best-effort)
    console.warn('[Emoji Extension] chrome.runtime not available in content script; running local init')
    initializeEmojiFeature()
  }
} else {
  Uninject()
  console.log('[Emoji Extension] autodetect: skipping injection - incompatible platform')
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
        console.warn('[Emoji Extension] Failed to get CSRF token:', error)
        sendResponse({ csrfToken: '' })
        return true
      }
    }
    return false
  })
}
