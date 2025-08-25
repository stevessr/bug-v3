// content-script/content-script.ts
// Receives broadcast messages from the extension background and filters by channel.
declare const chrome: any

function log(...args: any[]) {
  try {
    console.log('[content-script]', ...args)
  } catch (_) {}
}

if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((msg: any, sender: any) => {
    try {
      if (!msg) return
      if (msg.type === 'broadcast') {
        const channel = msg.channel || 'default'
        // Filter or handle channels as needed
        if (channel === 'default' || channel === 'emoji-updates') {
          // handle the broadcast
          log('received broadcast', channel, msg.payload)
          // example: emit a DOM CustomEvent for page scripts
          try {
            window.dispatchEvent(new CustomEvent('extension:broadcast', { detail: msg }))
          } catch (_) {}
        }
      }
    } catch (_) {}
  })
}

export {}
