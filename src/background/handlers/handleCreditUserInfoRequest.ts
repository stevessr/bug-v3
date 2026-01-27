import { getChromeAPI } from '../utils/main.ts'

const CREDIT_USER_INFO_URL = 'https://credit.linux.do/api/v1/oauth/user-info'

export async function handleCreditUserInfoRequest(_sendResponse: (resp: any) => void) {
  const chromeAPI = getChromeAPI()
  if (!chromeAPI || !chromeAPI.cookies) {
    _sendResponse({ success: false, error: 'Chrome API not available' })
    return
  }

  try {
    const cookies = await chromeAPI.cookies.getAll({ domain: 'credit.linux.do' })
    const cookieString = cookies.map((cookie: any) => `${cookie.name}=${cookie.value}`).join('; ')

    const headers: Record<string, string> = {
      Accept: 'application/json, text/javascript, */*; q=0.01',
      'X-Requested-With': 'XMLHttpRequest',
      Referer: 'https://credit.linux.do/home'
    }

    if (cookieString) headers['Cookie'] = cookieString

    const response = await fetch(CREDIT_USER_INFO_URL, {
      method: 'GET',
      headers,
      credentials: 'include'
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const data = await response.json()
    _sendResponse({ success: true, data })
  } catch (error: any) {
    console.error('Failed to fetch credit user info', error)
    _sendResponse({
      success: false,
      error: error?.message || 'Unknown error'
    })
  }
}
