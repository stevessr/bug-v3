declare const chrome: any

export const DEFAULT_SYNC_CONFIG = {
  ACK_TIMEOUT_MS: 3000,
  MAX_RETRIES: 3,
  POLL_INTERVAL_MS: 1000,
}

export function getRuntimeSyncConfig(): Promise<typeof DEFAULT_SYNC_CONFIG> {
  return new Promise((resolve) => {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['sync_config'], (res: any) => {
          try {
            const overrides = res?.sync_config || {}
            resolve({ ...DEFAULT_SYNC_CONFIG, ...overrides })
          } catch (_) {
            resolve(DEFAULT_SYNC_CONFIG)
          }
        })
      } else {
        resolve(DEFAULT_SYNC_CONFIG)
      }
    } catch (_) {
      resolve(DEFAULT_SYNC_CONFIG)
    }
  })
}

export default { DEFAULT_SYNC_CONFIG, getRuntimeSyncConfig }
