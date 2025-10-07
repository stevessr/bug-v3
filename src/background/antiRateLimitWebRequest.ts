// Listen for network responses and forward 429 events to content scripts
console.log('[Background] antiRateLimitWebRequest module loaded')

// Only add listener if chrome.webRequest is available (some environments may not support it)
try {
  if (chrome && chrome.webRequest && chrome.webRequest.onCompleted) {
    chrome.webRequest.onCompleted.addListener(
      (details) => {
        try {
          const status = (details && (details as any).statusCode) || 0
          const url = details.url || ''
          // Only consider linux.do host (or any other domain you want to protect)
          if (url.includes('linux.do') && status === 429) {
            console.warn('[Background] Detected 429 for', url, 'tabId=', details.tabId)
            // notify content script in the tab where request originated
            if (typeof details.tabId === 'number' && details.tabId >= 0) {
              chrome.tabs.sendMessage(details.tabId, { type: 'ANTI_RATE_LIMIT_429', url })
            }
          }
        } catch (e) {
          console.error('[Background] error in webRequest onCompleted handler', e)
        }
      },
      { urls: ['*://*.linux.do/*'] },
      []
    )
    console.log('[Background] webRequest onCompleted listener registered for linux.do')
  }
} catch (e) {
  console.warn('[Background] webRequest not available or failed to register listener', e)
}
