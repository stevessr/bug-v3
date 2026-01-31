/**
 * Proxy image requests through background service worker
 * to bypass CORP (Cross-Origin-Resource-Policy) restrictions
 *
 * For linux.do images, tries to fetch via an open linux.do tab first.
 * If no tab is found, silently opens one in the background.
 */

import { getChromeAPI } from '../utils/main.ts'

// Track if we're currently opening a background tab to avoid duplicates
let isOpeningBackgroundTab = false
let backgroundTabPromise: Promise<number | null> | null = null

/**
 * Open a background tab for the specified domain and wait for it to load
 */
async function openBackgroundTab(domain: string): Promise<number | null> {
  const chromeAPI = getChromeAPI()
  if (!chromeAPI?.tabs) {
    return null
  }

  // Avoid opening multiple tabs simultaneously
  if (isOpeningBackgroundTab && backgroundTabPromise) {
    return backgroundTabPromise
  }

  isOpeningBackgroundTab = true
  backgroundTabPromise = (async () => {
    try {
      // Create a new tab in the background (not active)
      const tab = await chromeAPI.tabs.create({
        url: `https://${domain}/`,
        active: false
      })

      if (!tab?.id) {
        return null
      }

      const tabId = tab.id

      // Wait for the tab to finish loading with timeout
      await new Promise<void>(resolve => {
        const timeout = setTimeout(() => {
          resolve()
        }, 15000) // 15 second timeout

        const listener = (updatedTabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
          if (updatedTabId === tabId && changeInfo.status === 'complete') {
            chromeAPI.tabs.onUpdated.removeListener(listener)
            clearTimeout(timeout)
            // Give the content script a moment to initialize
            setTimeout(resolve, 500)
          }
        }

        chromeAPI.tabs.onUpdated.addListener(listener)
      })

      console.log(`[ProxyImage] Opened background tab for ${domain}, id: ${tabId}`)
      return tabId
    } catch (error) {
      console.error(`[ProxyImage] Failed to open background tab for ${domain}:`, error)
      return null
    } finally {
      isOpeningBackgroundTab = false
      backgroundTabPromise = null
    }
  })()

  return backgroundTabPromise
}

/**
 * Try to fetch image via a content script in an open tab of the same domain
 * If no tab exists, opens one silently in the background
 */
async function fetchViaContentScript(
  url: string,
  domain: string
): Promise<{
  success: boolean
  data?: number[]
  mimeType?: string
  size?: number
  error?: string
}> {
  const chromeAPI = getChromeAPI()
  if (!chromeAPI?.tabs) {
    return { success: false, error: 'Tabs API not available' }
  }

  try {
    // Find tabs matching the domain
    let tabs = await chromeAPI.tabs.query({ url: `https://${domain}/*` })

    // If no tabs found, open one in the background
    if (!tabs || tabs.length === 0) {
      console.log(`[ProxyImage] No ${domain} tab found, opening one in background...`)
      const newTabId = await openBackgroundTab(domain)
      if (newTabId) {
        // Re-query to get the new tab
        tabs = await chromeAPI.tabs.query({ url: `https://${domain}/*` })
      }
    }

    if (!tabs || tabs.length === 0) {
      return { success: false, error: `Failed to open ${domain} tab` }
    }

    // Try each tab until one succeeds
    for (const tab of tabs) {
      if (!tab.id) continue

      try {
        const response = await chromeAPI.tabs.sendMessage(tab.id, {
          type: 'FETCH_IMAGE',
          url
        })

        if (response?.success && response.data) {
          return {
            success: true,
            data: response.data,
            mimeType: response.mimeType,
            size: response.size
          }
        }
      } catch (tabError) {
        // This tab couldn't handle the request, try next
        console.warn(`Tab ${tab.id} failed to fetch image:`, tabError)
        continue
      }
    }

    return { success: false, error: 'All tabs failed to fetch image' }
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed to query tabs' }
  }
}

export async function handleProxyImageRequest(
  opts: { url: string },
  sendResponse: (resp: any) => void
) {
  try {
    const urlObj = new URL(opts.url)
    const chromeAPI = getChromeAPI()

    // For linux.do images, try to fetch via content script first
    if (urlObj.hostname === 'linux.do' || urlObj.hostname.endsWith('.linux.do')) {
      const contentResult = await fetchViaContentScript(opts.url, 'linux.do')
      if (contentResult.success) {
        sendResponse(contentResult)
        return
      }
      console.log(
        '[ProxyImage] Content script fetch failed, falling back to direct:',
        contentResult.error
      )
    }

    // Fallback: Direct fetch with cookies
    const headers: Record<string, string> = {
      Accept: 'image/*,*/*'
    }

    // Try to get cookies for the domain
    if (chromeAPI?.cookies) {
      try {
        const cookies = await chromeAPI.cookies.getAll({ domain: urlObj.hostname })
        if (cookies && cookies.length > 0) {
          const cookieString = cookies.map((c: any) => `${c.name}=${c.value}`).join('; ')
          headers['Cookie'] = cookieString
        }
      } catch (cookieError) {
        console.warn('Failed to get cookies for proxy image:', cookieError)
      }
    }

    const response = await fetch(opts.url, {
      method: 'GET',
      mode: 'cors',
      credentials: 'include',
      headers
    })

    if (!response.ok) {
      sendResponse({
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`
      })
      return
    }

    const blob = await response.blob()
    const arrayBuffer = await blob.arrayBuffer()

    sendResponse({
      success: true,
      data: Array.from(new Uint8Array(arrayBuffer)),
      mimeType: blob.type,
      size: blob.size
    })
  } catch (error: any) {
    console.error('Proxy image request failed:', error)
    sendResponse({
      success: false,
      error: error?.message || 'Unknown error'
    })
  }
}
