// Callout Suggestions Script Injection Handler
// Manages injection of the standalone callout-suggestions script based on user settings

import { getChromeAPI } from '../utils/main'

// Track which tabs have the script injected to avoid duplicate injections
const injectedTabs = new Set<number>()

/**
 * Inject callout-suggestions script into a specific tab
 */
export async function injectCalloutScript(tabId: number): Promise<{ success: boolean; error?: string }> {
  const chromeAPI = getChromeAPI()
  if (!chromeAPI?.scripting) {
    console.warn('[CalloutInjection] chrome.scripting API not available')
    return { success: false, error: 'chrome.scripting API not available' }
  }

  try {
    // Check if already injected
    if (injectedTabs.has(tabId)) {
      console.log(`[CalloutInjection] Script already injected in tab ${tabId}`)
      return { success: true } // Already injected is considered success
    }

    // Inject the standalone script
    await chromeAPI.scripting.executeScript({
      target: { tabId },
      files: ['js/callout-suggestions.js']
    })

    injectedTabs.add(tabId)
    console.log(`[CalloutInjection] Successfully injected callout script into tab ${tabId}`)
    return { success: true }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error(`[CalloutInjection] Failed to inject script into tab ${tabId}:`, error)
    return { success: false, error: errorMsg }
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
 * Handle injection request from content script
 */
export async function handleCalloutInjectionRequest(
  sender: chrome.runtime.MessageSender
): Promise<{ success: boolean; error?: string }> {
  const tabId = sender.tab?.id
  if (!tabId) {
    console.warn('[CalloutInjection] No tab ID in sender')
    return { success: false, error: 'No tab ID available' }
  }

  console.log(`[CalloutInjection] Received injection request from tab ${tabId}`)
  return await injectCalloutScript(tabId)
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
 * Note: Tab injection is now handled by content script requests,
 * this only sets up storage change listeners for when user toggles the setting
 */
export function setupCalloutInjection() {
  const chromeAPI = getChromeAPI()
  if (!chromeAPI) {
    return
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
