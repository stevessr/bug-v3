// Unified content autodetect loader (keeps previous behavior)
console.log('[Emoji拓展] 自动检测注入')
console.log('[Emoji拓展] 位置:', {
  href: window.location.href,
  hostname: window.location.hostname,
  pathname: window.location.pathname
})
function detectPageType(): string {
  try {
    const hostname = window.location.hostname.toLowerCase()
    // quick host checks
    if (hostname.includes('bilibili') || hostname.includes('hdslb.com')) {
      console.debug('[Emoji拓展] detectPageType: matched bilibili by hostname', hostname)
      return 'bilibili'
    }
    if (hostname.includes('pixiv') || hostname.includes('pximg.net')) {
      console.debug('[Emoji拓展] detectPageType: matched pixiv by hostname', hostname)
      return 'pixiv'
    }
    if (hostname.includes('twitter') || hostname.includes('x.com')) {
      console.debug('[Emoji拓展] detectPageType: matched x/twitter by hostname', hostname)
      return 'x'
    }

    // Discourse and other forums
    const discourseMetaTags = document.querySelectorAll(
      'meta[name*="discourse"], meta[content*="discourse"], meta[property*="discourse"]'
    )
    if (discourseMetaTags.length > 0) {
      console.debug('[Emoji拓展] detectPageType: matched discourse by meta tags')
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
        console.debug('[Emoji拓展] detectPageType: matched discourse by generator meta', genContent)
        return 'discourse'
      }
    }

    const allowedDomains = ['linux.do', 'meta.discourse.org']
    if (allowedDomains.some(domain => hostname.includes(domain))) {
      console.debug('[Emoji拓展] detectPageType: matched discourse by allowed domain', hostname)
      return 'discourse'
    }

    // Fallback for editors that might be discourse
    const editors = document.querySelectorAll(
      'textarea.d-editor-input, .ProseMirror.d-editor-input, .composer-input, .reply-area textarea'
    )
    if (editors.length > 0) {
      console.debug('[Emoji拓展] detectPageType: matched generic editor presence', editors.length)
      return 'generic'
    }

    console.debug('[Emoji拓展] detectPageType: no match for hostname', hostname)
    return '' // No specific page type detected
  } catch (e) {
    console.warn('[Emoji拓展] detectPageType failed', e)
    return ''
  }
}

const pageType = detectPageType()

if (pageType) {
  try {
    if ((window as any).chrome?.runtime?.sendMessage) {
      const payload = { action: 'requestInject', pageType }
      console.info('[Emoji拓展] 请求后端注入', payload)
      ;(window as any).chrome.runtime.sendMessage(payload, (response: any) => {
        console.info('[Emoji拓展] background requestInject response', { pageType, response })
      })
    } else {
      console.warn('[Emoji拓展] chrome.runtime.sendMessage not available; cannot request injection')
    }
  } catch (e) {
    console.error('[Emoji拓展] failed to request background inject', e)
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
          console.warn('[Emoji拓展] Failed to get CSRF token:', error)
          sendResponse({ csrfToken: '' })
          return true
        }
      }
      return false
    }
  )
}

// 通用图片直链页面表情按钮注入（排除 pixiv）

function isImageDirectLinkPage() {
  const host = window.location.hostname.toLowerCase()
  // 排除 pixiv 相关域名
  if (host.includes('pximg.net') || host.includes('pixiv.net')) return false
  // 只处理常见图片格式
  const imgExt = ['.jpg', '.jpeg', '.png', '.gif', '.webp']
  // allow URLs that end with image extensions OR have image format in query (e.g., ?format=jpg)
  try {
    const urlObj = new URL(window.location.href)
    const pathname = urlObj.pathname.toLowerCase()
    const search = urlObj.search.toLowerCase()
    const hasExt = imgExt.some(ext => pathname.endsWith(ext))
    const formatParamMatch = /format=(jpg|jpeg|png|gif|webp)/.test(search)
    if (!hasExt && !formatParamMatch) return false
  } catch (e) {
    // If URL parsing fails, fallback to previous behavior
    const url = window.location.href.split('?')[0].toLowerCase()
    if (!imgExt.some(ext => url.endsWith(ext))) return false
  }
  // 页面只有一个 img 元素
  const imgs = Array.from(document.querySelectorAll('img'))
  if (imgs.length !== 1) return false
  return true
}

// 智能判断后动态注入自治脚本
if (isImageDirectLinkPage()) {
  if ((window as any).chrome?.runtime?.sendMessage) {
    chrome.runtime.sendMessage({ action: 'injectImageScript' }, (response: any) => {
      console.log('[Emoji拓展] 请求 background 注入 images/image-inject.js', response)
    })
  } else {
    console.warn('[Emoji拓展] chrome.runtime.sendMessage not available; 无法请求 background 注入')
  }
}
