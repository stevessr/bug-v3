import { getChromeAPI } from '../utils/main.ts'

export async function handleLinuxDoAuthRequest(_sendResponse: (resp: any) => void) {
  // Handler for requesting linux.do cookies and CSRF token from the options page
  // _sendResponse 用于响应消息
  const chromeAPI = getChromeAPI()
  if (!chromeAPI || !chromeAPI.tabs || !chromeAPI.cookies) {
    _sendResponse({ success: false, error: 'Chrome API not available' })
    return
  }

  try {
    // Get linux.do cookies
    const cookies = await chromeAPI.cookies.getAll({ domain: 'linux.do' })
    const cookieString = cookies.map((cookie: any) => `${cookie.name}=${cookie.value}`).join('; ')

    // Try to get CSRF token from linux.do tabs
    let csrfToken = ''
    try {
      const tabs = await chromeAPI.tabs.query({ url: 'https://linux.do/*' })
      if (tabs.length > 0 && tabs[0].id) {
        try {
          const response = await chromeAPI.tabs.sendMessage(tabs[0].id, {
            type: 'GET_CSRF_TOKEN'
          })
          if (response && response.csrfToken) {
            csrfToken = response.csrfToken
          }
        } catch (sendMessageError) {
          // 尝试其他 linux.do 标签页
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
              } catch {
                // 继续尝试下一个标签页
                continue
              }
            }
          }
          if (!csrfToken) {
            console.warn('Failed to get CSRF token from any linux.do tab:', sendMessageError)
          }
        }
      } else {
        console.warn('No linux.do tabs found')
      }
    } catch {
      console.warn('Failed to get CSRF token from linux.do tab')
    }

    _sendResponse({
      success: true,
      csrfToken: csrfToken,
      cookies: cookieString
    })
  } catch {
    console.error('Failed to get linux.do auth info')
    _sendResponse({
      success: false,
      error: 'Unknown error'
    })
  }
}
