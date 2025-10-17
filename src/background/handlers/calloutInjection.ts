// Callout Suggestions Script Injection Handler
// Manages injection of the standalone callout-suggestions script based on user settings

import { getChromeAPI } from '../utils/main'

// Track which tabs have the script injected to avoid duplicate injections
const injectedTabs = new Set<number>()

/**
 * Inject callout-suggestions script into a specific tab
 */
export async function injectCalloutScript(tabId: number) {
  const chromeAPI = getChromeAPI()
  if (!chromeAPI?.scripting) {
    console.warn('[CalloutInjection] chrome.scripting API not available')
    return
  }

  try {
    // Check if already injected
    if (injectedTabs.has(tabId)) {
      console.log(`[CalloutInjection] Script already injected in tab ${tabId}`)
      return
    }

    // Inject the standalone script
    await chromeAPI.scripting.executeScript({
      target: { tabId },
      files: ['js/callout-suggestions.js']
    })

    injectedTabs.add(tabId)
    console.log(`[CalloutInjection] Successfully injected callout script into tab ${tabId}`)
  } catch (error) {
    console.error(`[CalloutInjection] Failed to inject script into tab ${tabId}:`, error)
  }
}

/**
 * Remove callout-suggestions script from a specific tab
 * Note: There's no direct way to "uninject" a script, so we mark it as removed
 * and the script itself will need to check settings or receive a message to deactivate
 */
export async function removeCalloutScript(tabId: number) {
  const chromeAPI = getChromeAPI()
  if (!chromeAPI?.tabs) {
    console.warn('[CalloutInjection] chrome.tabs API not available')
    return
  }

  try {
    // Send message to the tab to deactivate the callout suggestions
    await chromeAPI.tabs.sendMessage(tabId, {
      type: 'DISABLE_CALLOUT_SUGGESTIONS'
    })

    injectedTabs.delete(tabId)
    console.log(`[CalloutInjection] Sent deactivation message to tab ${tabId}`)
  } catch (error) {
    console.error(`[CalloutInjection] Failed to deactivate script in tab ${tabId}:`, error)
  }
}

/**
 * Check if callout suggestions are enabled in settings
 */
async function isCalloutEnabled(): Promise<boolean> {
  const chromeAPI = getChromeAPI()
  if (!chromeAPI?.storage) {
    return false
  }

  try {
    const result = await chromeAPI.storage.local.get('appSettings')
    const settings = result.appSettings || {}
    // Default to false if not set
    return settings.enableCalloutSuggestions === true
  } catch (error) {
    console.error('[CalloutInjection] Failed to read settings:', error)
    return false
  }
}

/**
 * Handle tab activation - inject script if enabled
 */
export async function handleTabActivation(tabId: number, url?: string) {
  // Skip special pages
  if (!url || url.startsWith('chrome://') || url.startsWith('edge://')) {
    return
  }

  const enabled = await isCalloutEnabled()
  if (enabled) {
    await injectCalloutScript(tabId)
  }
}

/**
 * Handle setting change - inject or remove script from all tabs
 */
export async function handleCalloutSettingChange(enabled: boolean) {
  const chromeAPI = getChromeAPI()
  if (!chromeAPI?.tabs) {
    return
  }

  try {
    const tabs = await chromeAPI.tabs.query({})

    for (const tab of tabs) {
      if (!tab.id || !tab.url) continue

      // Skip special pages
      if (tab.url.startsWith('chrome://') || tab.url.startsWith('edge://')) {
        continue
      }

      if (enabled) {
        await injectCalloutScript(tab.id)
      } else {
        await removeCalloutScript(tab.id)
      }
    }

    console.log(
      `[CalloutInjection] ${enabled ? 'Injected' : 'Removed'} callout script for ${tabs.length} tabs`
    )
  } catch (error) {
    console.error('[CalloutInjection] Failed to handle setting change:', error)
  }
}

/**
 * Setup listeners for callout injection
 */
export function setupCalloutInjection() {
  const chromeAPI = getChromeAPI()
  if (!chromeAPI) {
    return
  }

  // Listen for tab updates (page navigation)
  if (chromeAPI.tabs?.onUpdated) {
    chromeAPI.tabs.onUpdated.addListener(
      async (tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab) => {
        // Only inject when the page is fully loaded
        if (changeInfo.status === 'complete' && tab.url) {
          await handleTabActivation(tabId, tab.url)
        }
      }
    )
  }

  // Listen for storage changes to react to setting changes
  if (chromeAPI.storage?.onChanged) {
    chromeAPI.storage.onChanged.addListener(
      async (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
        if (areaName === 'local' && changes.appSettings) {
          const oldSettings = changes.appSettings.oldValue || {}
          const newSettings = changes.appSettings.newValue || {}

          // Check if enableCalloutSuggestions changed
          if (oldSettings.enableCalloutSuggestions !== newSettings.enableCalloutSuggestions) {
            await handleCalloutSettingChange(newSettings.enableCalloutSuggestions === true)
          }
        }
      }
    )
  }

  console.log('[CalloutInjection] Setup complete')
}

/**
 * Clean up tab tracking when tabs are closed
 */
export function setupTabCleanup() {
  const chromeAPI = getChromeAPI()
  if (chromeAPI?.tabs?.onRemoved) {
    chromeAPI.tabs.onRemoved.addListener((tabId: number) => {
      injectedTabs.delete(tabId)
    })
  }
}
