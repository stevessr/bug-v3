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
    // Prefer the built content paths under js/content first (Vite outputs there),
    // but keep legacy root-level js/<site>.js as fallback for older builds.
    bilibili: ['js/content/bilibili.js', 'js/bilibili.js'],
    pixiv: ['js/content/pixiv.js', 'js/pixiv.js'],
    discourse: ['js/content/discourse.js', 'js/discourse.js'],
    x: ['js/content/x.js', 'js/x.js'],
    generic: ['js/content/autodetect.js']
  }

  const files = mapping[pageType] || mapping.generic

  try {
    if (canUseScripting) {
      const injected: string[] = []
      for (const f of files) {
        try {
          await chromeAPI.scripting.executeScript({ target: { tabId }, files: [f] })
          injected.push(f)
        } catch (e) {
          // Log and continue to try other candidate paths
          console.warn('[scripting] Failed to inject file, trying next candidate', f, e)
        }
      }

      if (injected.length === 0) {
        return { success: false, error: `Could not inject any of: ${files.join(', ')}` }
      }

      // always inject the bridge as well (bridge now built to js/content/bridge.js)
      try {
        await injectBridgeIntoTab(tabId)
      } catch (e) {
        // ignore bridge injection errors; still consider content injected
        console.warn('[scripting] injectBridgeIntoTab failed after content injection', e)
      }

      return { success: true, message: `Injected ${injected.join(', ')}` }
    }

    // Fallback for older MV2-style APIs: try tabs.executeScript
    if (chromeAPI.tabs && typeof chromeAPI.tabs.executeScript === 'function') {
      const injected: string[] = []
      for (const f of files) {
        try {
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
          injected.push(f)
        } catch (e) {
          console.warn('[scripting] tabs.executeScript failed for file, trying next candidate', f, e)
        }
      }

      if (injected.length === 0) {
        return { success: false, error: `Could not inject any of: ${files.join(', ')}` }
      }

      // Attempt to inject bridge via tabs.executeScript as well (best-effort)
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
      } catch (e) {
        console.warn('[scripting] tabs.executeScript bridge injection failed', e)
      }

      return { success: true, message: `Injected (tabs) ${injected.join(', ')}` }
    }

    return { success: false, error: 'scripting and tabs.executeScript are unavailable' }
  } catch (e) {
    console.warn('[scripting] injectContentForTab failed', e)
    return { success: false, error: String(e) }
  }
}
