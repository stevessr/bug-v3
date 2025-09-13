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
  if (!chromeAPI) return { success: false, error: 'chrome API unavailable' }

  const canUseScripting = !!(chromeAPI.scripting && typeof chromeAPI.scripting.executeScript === 'function')

  // 先注入实现文件，再注入 wrapper
  const mapping: Record<string, string[]> = {
    bilibili: ['js/bilibili.js', 'js/content/bilibili.js'],
    pixiv: ['js/pixiv.js', 'js/content/pixiv.js'],
    discourse: ['js/discourse.js', 'js/content/discourse.js'],
    x: ['js/x.js', 'js/content/x.js'],
    generic: ['js/content/autodetect.js']
  }

  const files = mapping[pageType] || mapping.generic

  try {
    if (canUseScripting) {
      for (const f of files) {
        await chromeAPI.scripting.executeScript({ target: { tabId }, files: [f] })
      }
      // always inject the bridge as well (bridge now built to js/content/bridge.js)
      await injectBridgeIntoTab(tabId)
      return { success: true, message: `Injected ${files.join(', ')}` }
    }

    // Fallback for older MV2-style APIs: try tabs.executeScript
    if (chromeAPI.tabs && typeof chromeAPI.tabs.executeScript === 'function') {
      for (const f of files) {
        // tabs.executeScript expects code or file in different shapes; rely on file injection
            await new Promise<void>((resolve, reject) => {
          try {
            chromeAPI.tabs.executeScript(tabId, { file: f }, (_: any) => {
              const err = chromeAPI.runtime && chromeAPI.runtime.lastError
              if (err) reject(err)
              else resolve()
            })
          } catch (e) {
            reject(e)
          }
        })
      }
      // Attempt to inject bridge via tabs.executeScript as well
        try {
        await new Promise<void>((resolve, reject) => {
          try {
            chromeAPI.tabs.executeScript(tabId, { file: 'js/content/bridge.js' }, (_: any) => {
              const err = chromeAPI.runtime && chromeAPI.runtime.lastError
              if (err) reject(err)
              else resolve()
            })
          } catch (e) {
            reject(e)
          }
        })
        return { success: true, message: `Injected (tabs) ${files.join(', ')}` }
      } catch (e) {
        console.warn('[scripting] tabs.executeScript fallback failed', e)
        return { success: false, error: String(e) }
      }
    }

    return { success: false, error: 'scripting and tabs.executeScript are unavailable' }
  } catch (e) {
    console.warn('[scripting] injectContentForTab failed', e)
    return { success: false, error: String(e) }
  }
}
