// Previously this file called initPixiv/initBilibili/initX directly.
// Injection should now be handled by the background script. This file
// will request the background to perform injection for a given page type.



// No local settings request helper needed; background will decide whether to inject X/Twitter.

export function Uninject() {
  // Helper to request background to inject content for a given page type.
  function requestBackgroundInject(pageType: string) {
    try {
      if (
        (window as any).chrome &&
        (window as any).chrome.runtime &&
        (window as any).chrome.runtime.sendMessage
      ) {
        ;(window as any).chrome.runtime.sendMessage({ action: 'requestInject', pageType }, (response: any) => {
          if (response && response.success) {
            console.log('[Uninject] background injected content for', pageType)
          } else {
            let respLog = 'no response'
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
            console.warn('[Uninject] background failed to inject for', pageType, respLog)
          }
        })
      } else {
        console.warn('[Uninject] chrome.runtime not available; cannot request background inject for', pageType)
      }
    } catch (e) {
      console.error('[Uninject] requestInject failed for', pageType, e)
    }
  }

  // Request the background to inject helpers for common sites.
  requestBackgroundInject('pixiv')
  requestBackgroundInject('bilibili')
  // Let background decide whether to inject X/Twitter (it can consult settings there).
  requestBackgroundInject('x')
}

// safe stringify helper (local copy to avoid cross-file imports)
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
