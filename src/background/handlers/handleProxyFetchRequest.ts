import { getChromeAPI } from '../utils/main.ts'

type ProxyFetchOptions = {
  url: string
  method?: string
  headers?: Record<string, string>
  body?: string
  includeCookies?: boolean
  cookieDomain?: string
  responseType?: 'json' | 'text'
}

export async function handleProxyFetchRequest(
  opts: ProxyFetchOptions,
  _sendResponse: (resp: any) => void
) {
  const chromeAPI = getChromeAPI()
  if (!chromeAPI) {
    _sendResponse({ success: false, error: 'Chrome API not available' })
    return
  }

  try {
    const urlObj = new URL(opts.url)
    const headers: Record<string, string> = { ...(opts.headers || {}) }

    if (opts.includeCookies) {
      const domain = opts.cookieDomain || urlObj.hostname
      if (chromeAPI.cookies) {
        const cookies = await chromeAPI.cookies.getAll({ domain })
        const cookieString = cookies
          .map((cookie: any) => `${cookie.name}=${cookie.value}`)
          .join('; ')
        if (cookieString) headers['Cookie'] = cookieString
      }
    }

    const response = await fetch(opts.url, {
      method: opts.method || 'GET',
      headers,
      body: opts.body,
      credentials: 'include'
    })

    const responseType = opts.responseType || 'json'
    const data = responseType === 'text' ? await response.text() : await response.json()

    _sendResponse({
      success: true,
      status: response.status,
      ok: response.ok,
      data
    })
  } catch (error: any) {
    console.error('Proxy fetch failed', error)
    _sendResponse({
      success: false,
      error: error?.message || 'Unknown error'
    })
  }
}
