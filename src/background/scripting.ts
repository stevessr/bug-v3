import { getChromeAPI } from './utils'

/**
 * Inject the isolated-world content bridge into the specified tab.
 * This uses chrome.scripting.executeScript (MV3) so the injected script runs
 * in the extension isolated world and can use chrome.runtime APIs.
 */
export async function injectBridgeIntoTab(tabId: number) {
  const chromeAPI = getChromeAPI()
  if (!chromeAPI || !chromeAPI.scripting) return

  try {
    await chromeAPI.scripting.executeScript({
      target: { tabId },
      files: ['js/content/bridge.js']
    })
  } catch (e) {
    // swallow errors - tab may be a chrome page or unavailable
    console.warn('[scripting] Failed to inject bridge into tab', tabId, e)
  }
}

export async function injectBridgeIntoAllTabs() {
  const chromeAPI = getChromeAPI()
  if (!chromeAPI || !chromeAPI.tabs) return

  try {
    const tabs = await chromeAPI.tabs.query({})
    for (const tab of tabs) {
      if (tab.id) await injectBridgeIntoTab(tab.id)
    }
  } catch (e) {
    console.warn('[scripting] Failed to inject bridge into all tabs', e)
  }
}

/**
 * Inject site-specific content scripts based on pageType.
 * pageType is a coarse string such as 'bilibili', 'pixiv', 'discourse', 'x', 'generic'
 */
export async function injectContentForTab(tabId: number, pageType: string) {
  const chromeAPI = getChromeAPI()
  if (!chromeAPI || !chromeAPI.scripting) return { success: false, error: 'scripting unavailable' }

  // First inject shared runtime and polyfills (if present) so implementation
  // scripts can rely on shared globals. Then inject site-specific files,
  // and finally the bridge.
  const mapping: Record<string, string[]> = {
    bilibili: ['js/bilibili-impl.js', 'js/content/bilibili.js'],
    pixiv: ['js/pixiv-impl.js', 'js/content/pixiv.js'],
    discourse: ['js/content/discourse.js'],
    x: ['js/content/x.js'],
    generic: ['js/content/autodetect.js']
  }

  const files = mapping[pageType] || mapping.generic

  const preloads: string[] = []
  // modulepreload polyfill and shared runtime are useful for implementation files
  // check presence by attempting to inject; if missing, executeScript will throw and we ignore
  preloads.push('js/modulepreload-polyfill.js')
  preloads.push('js/shared.js')

  try {
    // inject preloads first (ignore errors if a file doesn't exist in extension bundle)
    for (const p of preloads) {
      try {
        // executeScript will throw if file not present; swallow that and continue
        // run in isolated world so implementation attaches to the same window
        await chromeAPI.scripting.executeScript({ target: { tabId }, files: [p] })
      } catch (e) {
        // not fatal - some builds may not produce these files
        console.debug('[scripting] preload injection failed (ignored):', p, e)
      }
    }

    // inject implementation files
    for (const f of files) {
      await chromeAPI.scripting.executeScript({ target: { tabId }, files: [f] })
    }

    // always inject the bridge as well (bridge now built to js/content/bridge.js)
    await injectBridgeIntoTab(tabId)
    return { success: true, message: `Injected ${files.join(', ')}` }
  } catch (e) {
    console.warn('[scripting] injectContentForTab failed', e)
    return { success: false, error: String(e) }
  }
}
