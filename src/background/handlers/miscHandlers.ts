import { getChromeAPI } from '../utils'
// newStorageHelpers not needed in this file currently

export async function handleLinuxDoAuthRequest(sendResponse: (_resp: any) => void) {
  void sendResponse
  const chromeAPI = getChromeAPI()
  if (!chromeAPI || !chromeAPI.tabs || !chromeAPI.cookies) {
    sendResponse({ success: false, error: 'Chrome API not available' })
    return
  }

  try {
    const cookies = await chromeAPI.cookies.getAll({ domain: 'linux.do' })
    const cookieString = cookies.map((cookie: any) => `${cookie.name}=${cookie.value}`).join('; ')

    let csrfToken = ''
    try {
      const tabs = await chromeAPI.tabs.query({ url: 'https://linux.do/*' })
      if (tabs.length > 0 && tabs[0].id) {
        try {
          const response = await chromeAPI.tabs.sendMessage(tabs[0].id, { type: 'GET_CSRF_TOKEN' })
          if (response && response.csrfToken) csrfToken = response.csrfToken
        } catch (sendMessageError) {
          for (let i = 1; i < tabs.length; i++) {
            if (tabs[i].id) {
              try {
                const response = await chromeAPI.tabs.sendMessage(tabs[i].id, {
                  type: 'GET_CSRF_TOKEN'
                })
                if (response && response.csrfToken) {
                  csrfToken = response.csrfToken
                  break
                }
              } catch (e) {
                continue
              }
            }
          }
          if (!csrfToken)
            console.warn('Failed to get CSRF token from any linux.do tab:', sendMessageError)
        }
      } else {
        console.warn('No linux.do tabs found')
      }
    } catch (e) {
      console.warn('Failed to get CSRF token from linux.do tab:', e)
    }

    sendResponse({ success: true, csrfToken, cookies: cookieString })
  } catch (error: any) {
    console.error('Failed to get linux.do auth info:', error)
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

export async function handleSaveLastDiscourse(payload: any, sendResponse: any) {
  void sendResponse
  try {
    const chromeAPI = getChromeAPI()
    if (!chromeAPI || !chromeAPI.storage || !chromeAPI.storage.local) {
      sendResponse({ success: false, error: 'chrome storage not available' })
      return
    }

    await new Promise<void>((resolve, reject) => {
      try {
        chromeAPI.storage.local.set({ lastDiscourse: payload }, () => {
          if (chromeAPI.runtime.lastError) reject(chromeAPI.runtime.lastError)
          else resolve()
        })
      } catch (e) {
        reject(e)
      }
    })

    sendResponse({ success: true })
  } catch (error) {
    console.error('Failed to save lastDiscourse', error)
    sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) })
  }
}
