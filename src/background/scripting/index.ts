import { getChromeAPI } from '../utils'

export async function injectAutodetectIntoTab(tabId: number) {
  const chromeAPI = getChromeAPI()
  if (!chromeAPI || !chromeAPI.scripting) return

  try {
    await chromeAPI.scripting.executeScript({
      target: { tabId },
      files: ['js/content/autodetect.js']
    })
  } catch (e) {
    console.warn('[后台] Failed to inject autodetect into tab', tabId, e)
  }
}

export async function injectBridgeIntoTab(tabId: number) {
  const chromeAPI = getChromeAPI()
  if (!chromeAPI || !chromeAPI.scripting) return

  try {
    await chromeAPI.scripting.executeScript({ target: { tabId }, files: ['js/content/bridge.js'] })
  } catch (e) {
    console.warn('[后台] Failed to inject bridge into tab', tabId, e)
  }
}

export async function injectBridgeIntoAllTabs() {
  const chromeAPI = getChromeAPI()
  if (!chromeAPI || !chromeAPI.tabs) return

  try {
    const tabs = await chromeAPI.tabs.query({})
    for (const tab of tabs) {
      if (tab.id) {
        await injectAutodetectIntoTab(tab.id)
        await injectBridgeIntoTab(tab.id)
      }
    }
  } catch (e) {
    console.warn('[后台] Failed to inject scripts into all tabs', e)
  }
}

export async function injectContentForTab(tabId: number, pageType: string) {
  const chromeAPI = getChromeAPI()
  if (!chromeAPI || !chromeAPI.scripting) return { success: false, error: 'scripting unavailable' }

  const mapping: Record<string, string[]> = {
    bilibili: ['js/bilibili.js', 'js/content/bilibili.js'],
    pixiv: ['js/pixiv.js', 'js/content/pixiv.js'],
    discourse: ['js/discourse.js', 'js/content/discourse.js'],
    x: ['js/x.js', 'js/content/x.js'],
    generic: ['js/content/autodetect.js']
  }

  const files = mapping[pageType] || mapping.generic

  try {
    for (const f of files) {
      await chromeAPI.scripting.executeScript({
        target: { tabId },
        files: [f]
      })
    }
    await injectBridgeIntoTab(tabId)
    return { success: true, message: `Injected ${files.join(', ')}` }
  } catch (e) {
    console.warn('[后台] injectContentForTab failed', e)
    return { success: false, error: String(e) }
  }
}

export async function injectImageScriptIntoTab(tabId: number) {
  const chromeAPI = getChromeAPI()
  if (!chromeAPI || !chromeAPI.scripting) return { success: false, error: 'scripting unavailable' }
  try {
    await chromeAPI.scripting.executeScript({
      target: { tabId },
      files: ['js/content/images/image-inject.js']
    })
    return { success: true }
  } catch (e) {
    console.warn('[后台] Failed to inject image-inject into tab', tabId, e)
    return { success: false, error: String(e) }
  }
}
