import { getChromeAPI } from '../utils/main.ts'

export async function handleCreditAuthRequest(_sendResponse: (resp: any) => void) {
  const chromeAPI = getChromeAPI()
  if (!chromeAPI || !chromeAPI.cookies) {
    _sendResponse({ success: false, error: 'Chrome API not available' })
    return
  }

  try {
    const cookies = await chromeAPI.cookies.getAll({ domain: 'credit.linux.do' })
    const cookieString = cookies.map((cookie: any) => `${cookie.name}=${cookie.value}`).join('; ')

    _sendResponse({
      success: true,
      cookies: cookieString
    })
  } catch {
    console.error('Failed to get credit.linux.do cookies')
    _sendResponse({
      success: false,
      error: 'Unknown error'
    })
  }
}
