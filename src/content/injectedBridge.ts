// This file is injected into pages using chrome.scripting.executeScript
// It runs in the extension isolated world and can use chrome.runtime APIs.

// Listen for messages from the page (main world) and forward to background
window.addEventListener('message', event => {
  if (!event.source || event.source !== window) return
  const msg = event.data
  if (!msg || msg.__emoji_ext_bridge !== true) return

  // Forward to background
  try {
    chrome.runtime.sendMessage(msg.payload)
  } catch (e) {
    console.warn('[injectedBridge] sendMessage failed', e)
  }
})

// Listen for messages from background and forward to page (main world)
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  try {
    window.postMessage({ __emoji_ext_bridge: true, from: 'background', payload: message }, '*')
  } catch (e) {
    // ignore
  }
  // synchronous response not used
  void sendResponse
  return false
})

// Expose a small helper on window for the page to request data via the bridge
;(window as any).__emojiExtensionBridge = {
  request(payload: any) {
    return new Promise(resolve => {
      try {
        const listener = (ev: MessageEvent) => {
          if (ev.source !== window) return
          const data = ev.data
          if (data && data.__emoji_ext_bridge_response === true && data.requestId === requestId) {
            window.removeEventListener('message', listener)
            resolve(data.payload)
          }
        }

        const requestId = Math.random().toString(36).slice(2)
        window.addEventListener('message', listener)
        window.postMessage(
          { __emoji_ext_bridge: true, payload: payload, requestId, from: 'page' },
          '*'
        )
      } catch (e) {
        resolve(null)
      }
    })
  }
}
