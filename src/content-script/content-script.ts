// content-script/content-script.ts
// Receives broadcast messages from the extension background and filters by channel.
declare const chrome: any

// ensure content entry that starts inject features runs when content-script is injected
import '../content/main'

function log(...args: any[]) {
  try {
    console.log('[content-script]', ...args)
  } catch (_) {}
}

const channelList: Set<string> = new Set(['default', 'emoji-updates'])

function updateChannelsFromStorage() {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['channels'], (res: any) => {
        try {
          const arr = Array.isArray(res?.channels) ? res.channels : []
          if (arr.length) {
            channelList.clear()
            for (const c of arr) channelList.add(c)
          }
        } catch (_) {}
      })
    }
  } catch (_) {}
}

updateChannelsFromStorage()

// log when script is injected into the page
try {
  log('injected', {
    href: typeof location !== 'undefined' ? String(location.href).slice(0, 200) : undefined,
    title: typeof document !== 'undefined' ? String(document.title).slice(0, 200) : undefined,
    channels: Array.from(channelList),
    anyPending:
      (typeof window !== 'undefined' &&
        window.localStorage &&
        (window.localStorage.getItem('bugcopilot_flag_session_pending') === 'true' ||
          window.localStorage.getItem('bugcopilot_flag_extended_pending') === 'true')) ||
      false,
    time: new Date().toISOString(),
  })
} catch (_) {}

// Polling watcher: only active when pending flags exist in this tab
const PollWatcher = (function () {
  let intervalId: any = null

  function checkOnce() {
    try {
      // if session pending, check sessionStorage for payload
      try {
        const sessionPending =
          window.localStorage.getItem('bugcopilot_flag_session_pending') === 'true'
        if (sessionPending) {
          const sess = window.sessionStorage.getItem('bugcopilot_settings_v1')
          if (sess) {
            // session applied: clear local pending and ack background
            try {
              window.localStorage.removeItem('bugcopilot_flag_session_pending')
            } catch (_) {}
            try {
              if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
                chrome.runtime.sendMessage(
                  { type: 'stage-ack', stage: 'session' },
                  (_resp: any) => {
                    try {
                      if (chrome.runtime && chrome.runtime.lastError) {
                        log('content-script sendMessage error:', chrome.runtime.lastError)
                      }
                    } catch (_) {}
                  },
                )
              }
            } catch (_) {}
          }
        }
      } catch (_) {}

      // if extended pending, check chrome.storage.local.extended_payload
      try {
        const extendedPending =
          window.localStorage.getItem('bugcopilot_flag_extended_pending') === 'true'
        if (extendedPending) {
          if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.get(['extended_payload'], (res: any) => {
              try {
                if (res && res.extended_payload) {
                  try {
                    window.localStorage.removeItem('bugcopilot_flag_extended_pending')
                  } catch (_) {}
                  try {
                    if (
                      typeof chrome !== 'undefined' &&
                      chrome.runtime &&
                      chrome.runtime.sendMessage
                    ) {
                      chrome.runtime.sendMessage(
                        { type: 'stage-ack', stage: 'extended' },
                        (_resp: any) => {
                          try {
                            if (chrome.runtime && chrome.runtime.lastError) {
                              log('content-script sendMessage error:', chrome.runtime.lastError)
                            }
                          } catch (_) {}
                        },
                      )
                    }
                  } catch (_) {}
                }
              } catch (_) {}
            })
          }
        }
      } catch (_) {}
    } catch (_) {}
  }

  function start() {
    if (intervalId) return
    try {
      log('PollWatcher.start')
    } catch (_) {}
    intervalId = setInterval(() => checkOnce(), 1000)
  }

  function stop() {
    try {
      if (intervalId) {
        try {
          log('PollWatcher.stop')
        } catch (_) {}
        clearInterval(intervalId)
      }
    } catch (_) {}
    intervalId = null
  }

  // initial start check
  try {
    const anyPending =
      window.localStorage.getItem('bugcopilot_flag_session_pending') === 'true' ||
      window.localStorage.getItem('bugcopilot_flag_extended_pending') === 'true'
    if (anyPending) start()
  } catch (_) {}

  return { start, stop }
})()

if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((msg: any, sender: any) => {
    try {
      if (!msg) return
      // handle flag set/clear messages from background
      if (msg.type === 'set-local-flag' && msg.key) {
        try {
          window.localStorage.setItem(msg.key, String(msg.value))
          // start polling when a pending flag is set
          try {
            PollWatcher.start()
          } catch (_) {}
        } catch (_) {}
        return
      }
      if (msg.type === 'clear-local-flag' && msg.key) {
        try {
          window.localStorage.removeItem(msg.key)
          // stop polling when a pending flag is cleared
          try {
            PollWatcher.stop()
          } catch (_) {}
        } catch (_) {}
        return
      }
      if (msg.type === 'broadcast') {
        const channel = msg.channel || 'default'
        if (channelList.has(channel)) {
          log('received broadcast', channel, msg.payload)
          try {
            window.dispatchEvent(new CustomEvent('extension:broadcast', { detail: msg }))
          } catch (_) {}
        }
        return
      }
      if (msg.type === 'sync-session') {
        try {
          const payload = msg.payload
          if (payload) {
            try {
              window.sessionStorage.setItem('bugcopilot_settings_v1', JSON.stringify(payload))
              log('sessionStorage updated via sync-session')
              // after applying to sessionStorage, clear the session_pending flag in localStorage for this tab
              try {
                window.localStorage.removeItem('bugcopilot_flag_session_pending')
              } catch (_) {}
              // notify background immediately that session applied
              try {
                if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
                  chrome.runtime.sendMessage(
                    { type: 'stage-ack', stage: 'session' },
                    (_resp: any) => {
                      try {
                        if (chrome.runtime && chrome.runtime.lastError) {
                          log('content-script sendMessage error:', chrome.runtime.lastError)
                        }
                      } catch (_) {}
                    },
                  )
                }
              } catch (_) {}
            } catch (_) {}
          }
        } catch (_) {}
        return
      }
    } catch (_) {}
  })
}

// listen for changes to chrome.storage.local to update channels dynamically
try {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes: any, area: string) => {
      try {
        if (area === 'local' && changes.channels) updateChannelsFromStorage()
      } catch (_) {}
    })
  }
} catch (_) {}

export {}
