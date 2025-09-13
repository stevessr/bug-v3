console.log('[Emoji Extension] Content autodetect loader')

function detectPageType(): string {
  try {
    const hostname = window.location.hostname.toLowerCase()
    if (hostname.includes('bilibili')) return 'bilibili'
    if (hostname.includes('pixiv')) return 'pixiv'
    if (hostname.includes('twitter') || hostname.includes('x.com')) return 'x'

    // Discourse and other forums
    const discourseMetaTags = document.querySelectorAll(
      'meta[name*="discourse"], meta[content*="discourse"], meta[property*="discourse"]'
    )
    if (discourseMetaTags.length > 0) return 'discourse'

    const generatorMeta = document.querySelector('meta[name="generator"]')
    if (generatorMeta) {
      const content = generatorMeta.getAttribute('content')?.toLowerCase() || ''
      if (
        content.includes('discourse') ||
        content.includes('flarum') ||
        content.includes('phpbb')
      ) {
        return 'discourse'
      }
    }

    const allowedDomains = ['linux.do', 'meta.discourse.org']
    if (allowedDomains.some(domain => hostname.includes(domain))) return 'discourse'

    // Fallback for editors that might be discourse
    const editors = document.querySelectorAll(
      'textarea.d-editor-input, .ProseMirror.d-editor-input, .composer-input, .reply-area textarea'
    )
    if (editors.length > 0) return 'generic'

    return '' // No specific page type detected
  } catch (e) {
    console.warn('[Emoji Extension] detectPageType failed', e)
    return ''
  }
}

const pageType = detectPageType()

if (pageType) {
  console.log(`[Emoji Extension] Detected page type: ${pageType}. Requesting injection.`)
  try {
    if ((window as any).chrome?.runtime?.sendMessage) {
      ;(window as any).chrome.runtime.sendMessage(
        { action: 'requestInject', pageType },
        (response: any) => {
          if (response && response.success) {
            console.log('[Emoji Extension] Background injected content:', response.message)
          } else {
            console.warn('[Emoji Extension] Background failed to inject content script.')
          }
        }
      )
    }
  } catch (e) {
    console.warn('[Emoji Extension] Failed to send requestInject message', e)
  }
} else {
  console.log('[Emoji Extension] No specific page type detected. Skipping injection.')
}

// linux.do CSRF helper listener kept here for compatibility
if (window.location.hostname.includes('linux.do') && (window as any).chrome?.runtime?.onMessage) {
  ;(window as any).chrome.runtime.onMessage.addListener(
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
