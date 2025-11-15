import type { SyncTargetConfig } from '../userscript/plugins/syncTargets'

// Key for storing sync configuration
const SYNC_CONFIG_KEY = 'emoji_extension_sync_config'

/**
 * Save sync configuration to storage (Chrome Storage or localStorage fallback)
 */
export async function saveSyncConfig(config: SyncTargetConfig): Promise<void> {
  const chromeAPI = typeof chrome !== 'undefined' ? chrome : (globalThis as any).chrome
  console.log('[SyncConfig] Saving config, chromeAPI available:', !!chromeAPI?.storage?.local)
  console.log('[SyncConfig] Config to save:', config)

  if (chromeAPI?.storage?.local) {
    // Use Chrome storage in extension context
    await new Promise(resolve => {
      chromeAPI.storage.local.set({ [SYNC_CONFIG_KEY]: config }, () => {
        console.log('[SyncConfig] Config saved to Chrome storage')
        resolve(undefined)
      })
    })
  } else {
    // Fallback to localStorage in development/standalone mode
    console.log('[SyncConfig] Using localStorage fallback')
    try {
      localStorage.setItem(SYNC_CONFIG_KEY, JSON.stringify(config))
      console.log('[SyncConfig] Config saved to localStorage')
    } catch (e) {
      console.error('[SyncConfig] Failed to save to localStorage:', e)
    }
  }
}

/**
 * Load sync configuration from storage (Chrome Storage or localStorage fallback)
 */
export async function loadSyncConfig(): Promise<SyncTargetConfig | null> {
  try {
    const chromeAPI = typeof chrome !== 'undefined' ? chrome : (globalThis as any).chrome
    console.log('[SyncConfig] Loading config, chromeAPI available:', !!chromeAPI?.storage?.local)

    if (chromeAPI?.storage?.local) {
      // Use Chrome storage in extension context
      const config = await new Promise<any>(resolve => {
        chromeAPI.storage.local.get([SYNC_CONFIG_KEY], (result: any) => {
          console.log('[SyncConfig] Chrome storage result:', result)
          resolve(result[SYNC_CONFIG_KEY] || null)
        })
      })

      console.log('[SyncConfig] Loaded config from Chrome storage:', config)
      if (config && typeof config === 'object' && config.type) {
        return config
      }
    } else {
      // Fallback to localStorage in development/standalone mode
      console.log('[SyncConfig] Using localStorage fallback')
      const stored = localStorage.getItem(SYNC_CONFIG_KEY)
      if (stored) {
        const config = JSON.parse(stored)
        console.log('[SyncConfig] Loaded config from localStorage:', config)
        if (config && typeof config === 'object' && config.type) {
          return config
        }
      }
    }
  } catch (error) {
    console.error('[SyncConfig] Failed to load config:', error)
  }
  return null
}

/**
 * Clear sync configuration from storage
 */
export async function clearSyncConfig(): Promise<void> {
  const chromeAPI = typeof chrome !== 'undefined' ? chrome : (globalThis as any).chrome
  if (chromeAPI?.storage?.local) {
    await new Promise(resolve => {
      chromeAPI.storage.local.remove([SYNC_CONFIG_KEY], () => {
        resolve(undefined)
      })
    })
  } else {
    // Fallback to localStorage
    localStorage.removeItem(SYNC_CONFIG_KEY)
  }
}
