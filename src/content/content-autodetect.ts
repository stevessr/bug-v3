// Unified content autodetect loader (keeps previous behavior)
console.log('[Emoji extension] autodetect injected')
console.log('[Emoji extension] location:', {
  href: window.location.href,
  hostname: window.location.hostname,
  pathname: window.location.pathname
})
function detectPageType(): string {
  try {
    const hostname = window.location.hostname.toLowerCase()
    // quick host checks
    if (hostname.includes('bilibili') || hostname.includes('hdslb.com')) {
      console.debug('[Emoji extension] detectPageType: matched bilibili by hostname', hostname)
      return 'bilibili'
    }
    if (hostname.includes('pixiv') || hostname.includes('pximg.net')) {
      console.debug('[Emoji extension] detectPageType: matched pixiv by hostname', hostname)
      return 'pixiv'
    }
    if (hostname.includes('twitter') || hostname.includes('x.com')) {
      console.debug('[Emoji extension] detectPageType: matched x/twitter by hostname', hostname)
      return 'x'
    }

    // Discourse and other forums
    const discourseMetaTags = document.querySelectorAll(
      'meta[name*="discourse"], meta[content*="discourse"], meta[property*="discourse"]'
    )
    if (discourseMetaTags.length > 0) {
      console.debug('[Emoji extension] detectPageType: matched discourse by meta tags')
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
        console.debug(
          '[Emoji extension] detectPageType: matched discourse by generator meta',
          genContent
        )
        return 'discourse'
      }
    }

    const allowedDomains = ['linux.do', 'meta.discourse.org']
    if (allowedDomains.some(domain => hostname.includes(domain))) {
      console.debug(
        '[Emoji extension] detectPageType: matched discourse by allowed domain',
        hostname
      )
      return 'discourse'
    }

    // Fallback for editors that might be discourse
    const editors = document.querySelectorAll(
      'textarea.d-editor-input, .ProseMirror.d-editor-input, .composer-input, .reply-area textarea'
    )
    if (editors.length > 0) {
      console.debug(
        '[Emoji extension] detectPageType: matched generic editor presence',
        editors.length
      )
      return 'generic'
    }

    console.debug('[Emoji extension] detectPageType: no match for hostname', hostname)
    return '' // No specific page type detected
  } catch (e) {
    console.warn('[Emoji extension] detectPageType failed', e)
    return ''
  }
}

const pageType = detectPageType()

if (pageType) {
  try {
    if ((window as any).chrome?.runtime?.sendMessage) {
      const payload = { action: 'requestInject', pageType }
      console.info('[Emoji extension] requesting background to inject content', payload)
      ;(window as any).chrome.runtime.sendMessage(payload, (response: any) => {
        console.info('[Emoji extension] background requestInject response', { pageType, response })
      })
    } else {
      console.warn(
        '[Emoji extension] chrome.runtime.sendMessage not available; cannot request injection'
      )
    }
  } catch (e) {
    console.error('[Emoji extension] failed to request background inject', e)
  }
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
