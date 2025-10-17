// Platform Scripts Injection Handler
// Manages injection of standalone platform-specific scripts (X, Pixiv, Bilibili, Reddit, etc.)

import { getChromeAPI } from '../utils/main'

// Platform configuration
interface PlatformConfig {
  scriptFile: string
  trackerKey: string
  disableMessageType: string
  world?: 'ISOLATED' | 'MAIN' // Injection world (default: ISOLATED for extension API access)
}

const PLATFORMS: Record<string, PlatformConfig> = {
  'discourse-features': {
    scriptFile: 'js/discourse-features.js',
    trackerKey: 'DISCOURSE_FEATURES',
    disableMessageType: 'DISABLE_DISCOURSE_FEATURES',
    world: 'ISOLATED' // Needs chrome.runtime API
  },
  'x-features': {
    scriptFile: 'js/x-features.js',
    trackerKey: 'X_FEATURES',
    disableMessageType: 'DISABLE_X_FEATURES'
  },
  'pixiv-features': {
    scriptFile: 'js/pixiv-features.js',
    trackerKey: 'PIXIV_FEATURES',
    disableMessageType: 'DISABLE_PIXIV_FEATURES'
  },
  'bilibili-features': {
    scriptFile: 'js/bilibili-features.js',
    trackerKey: 'BILIBILI_FEATURES',
    disableMessageType: 'DISABLE_BILIBILI_FEATURES'
  },
  'reddit-features': {
    scriptFile: 'js/reddit-features.js',
    trackerKey: 'REDDIT_FEATURES',
    disableMessageType: 'DISABLE_REDDIT_FEATURES'
  },
  'callout-suggestions': {
    scriptFile: 'js/callout-suggestions.js',
    trackerKey: 'CALLOUT_SUGGESTIONS',
    disableMessageType: 'DISABLE_CALLOUT_SUGGESTIONS',
    world: 'ISOLATED' // Needs chrome.runtime API
  },
  'xhs-features': {
    scriptFile: 'js/xhs-features.js',
    trackerKey: 'XHS_FEATURES',
    disableMessageType: 'DISABLE_XHS_FEATURES'
  }
}

// Track which tabs have which scripts injected
// Map<tabId, Set<platformKey>>
const injectedScripts = new Map<number, Set<string>>()

/**
 * Inject a platform script into a specific tab
 */
export async function injectPlatformScript(
  tabId: number,
  platform: string
): Promise<{ success: boolean; error?: string }> {
  const chromeAPI = getChromeAPI()
  if (!chromeAPI?.scripting) {
    console.warn('[PlatformInjection] chrome.scripting API not available')
    return { success: false, error: 'chrome.scripting API not available' }
  }

  const config = PLATFORMS[platform]
  if (!config) {
    console.warn(`[PlatformInjection] Unknown platform: ${platform}`)
    return { success: false, error: `Unknown platform: ${platform}` }
  }

  try {
    // Check if already injected
    const tabScripts = injectedScripts.get(tabId)
    if (tabScripts?.has(platform)) {
      console.log(`[PlatformInjection] ${platform} already injected in tab ${tabId}`)
      return { success: true }
    }

    // Inject the standalone script
    // Use configured world (MAIN for ES modules, ISOLATED for extension API access)
    await chromeAPI.scripting.executeScript({
      target: { tabId },
      files: [config.scriptFile],
      world: config.world || 'MAIN' // Default to MAIN for ES module support
    })

    // Track injection
    if (!injectedScripts.has(tabId)) {
      injectedScripts.set(tabId, new Set())
    }
    injectedScripts.get(tabId)!.add(platform)

    console.log(`[PlatformInjection] Successfully injected ${platform} into tab ${tabId}`)
    return { success: true }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error(`[PlatformInjection] Failed to inject ${platform} into tab ${tabId}:`, error)
    return { success: false, error: errorMsg }
  }
}

/**
 * Remove a platform script from a specific tab
 */
export async function removePlatformScript(tabId: number, platform: string) {
  const chromeAPI = getChromeAPI()
  if (!chromeAPI?.tabs) {
    console.warn('[PlatformInjection] chrome.tabs API not available')
    return
  }

  const config = PLATFORMS[platform]
  if (!config) {
    console.warn(`[PlatformInjection] Unknown platform: ${platform}`)
    return
  }

  try {
    // Send disable message to the tab
    await chromeAPI.tabs.sendMessage(tabId, {
      type: config.disableMessageType
    })

    // Remove from tracking
    const tabScripts = injectedScripts.get(tabId)
    if (tabScripts) {
      tabScripts.delete(platform)
      if (tabScripts.size === 0) {
        injectedScripts.delete(tabId)
      }
    }

    console.log(`[PlatformInjection] Sent disable message for ${platform} to tab ${tabId}`)
  } catch (error) {
    console.error(`[PlatformInjection] Failed to disable ${platform} in tab ${tabId}:`, error)
  }
}

/**
 * Handle injection request from content script
 */
export async function handlePlatformInjectionRequest(
  sender: chrome.runtime.MessageSender,
  platform: string
): Promise<{ success: boolean; error?: string }> {
  const tabId = sender.tab?.id
  if (!tabId) {
    console.warn('[PlatformInjection] No tab ID in sender')
    return { success: false, error: 'No tab ID available' }
  }

  console.log(`[PlatformInjection] Received ${platform} injection request from tab ${tabId}`)
  return await injectPlatformScript(tabId, platform)
}

/**
 * Clean up tab tracking when tabs are closed
 */
export function setupPlatformTabCleanup() {
  const chromeAPI = getChromeAPI()
  if (chromeAPI?.tabs?.onRemoved) {
    chromeAPI.tabs.onRemoved.addListener((tabId: number) => {
      injectedScripts.delete(tabId)
      console.log(`[PlatformInjection] Cleaned up tracking for closed tab ${tabId}`)
    })
  }
}

/**
 * Get list of available platforms
 */
export function getAvailablePlatforms(): string[] {
  return Object.keys(PLATFORMS)
}
