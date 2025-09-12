import { getChromeAPI } from '../utils'

export async function handleDownloadAndSendToDiscourse(payload: any, sendResponse: any) {
  void sendResponse
  try {
    if (!payload || !payload.url) {
      sendResponse({ success: false, error: 'missing payload.url' })
      return
    }

    const url: string = payload.url
    const discourseBase: string | undefined = payload.discourseBase

    const defaultHeaders: Record<string, string> = {
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6',
      'Cache-Control': 'max-age=0',
      'sec-ch-ua': '"Not;A=Brand";v="99", "Microsoft Edge";v="139", "Chromium";v="139"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'cross-site',
      'Upgrade-Insecure-Requests': '1'
    }

    const headers = Object.assign({}, defaultHeaders, payload.headers || {})

    const resp = await fetch(url, {
      method: 'GET',
      headers,
      referrer: payload.referrer || 'https://www.pixiv.net/',
      referrerPolicy: payload.referrerPolicy || 'no-referrer-when-downgrade',
      cache: 'no-cache',
      redirect: 'follow'
    })

    if (!resp.ok) {
      sendResponse({ success: false, error: `failed to download image: ${resp.status}` })
      return
    }

    const arrayBuffer = await resp.arrayBuffer()

    const chromeAPI = getChromeAPI()
    const tabs = await (chromeAPI.tabs && chromeAPI.tabs.query ? chromeAPI.tabs.query({}) : [])

    let sent = 0
    for (const tab of tabs) {
      try {
        if (discourseBase && tab.url && !String(tab.url).startsWith(discourseBase)) continue

        await chromeAPI.tabs.sendMessage(tab.id, {
          action: 'uploadBlobToDiscourse',
          filename: payload.filename || 'image.jpg',
          mimeType: payload.mimeType || 'image/jpeg',
          arrayBuffer,
          discourseBase
        })
        sent++
      } catch (e) {
        void e
      }
    }

    if (sent === 0) {
      sendResponse({ success: false, error: 'no discourse tab found to receive upload' })
      return
    }

    sendResponse({ success: true, message: `sent to ${sent} tab(s)` })
  } catch (error) {
    sendResponse({ success: false, error: String(error) })
  }
}

export async function handleDownloadForUser(_payload: any, sendResponse: any) {
  void _payload
  sendResponse({ success: false, error: 'Not implemented in handlers/downloadAndSend' })
}

export async function handleUploadAndAddEmoji(_payload: any, sendResponse: any) {
  void _payload
  sendResponse({ success: false, error: 'Not implemented in handlers/downloadAndSend' })
}

export async function handleDownloadAndUploadEmoji(_payload: any, sendResponse: any) {
  void _payload
  sendResponse({ success: false, error: 'Not implemented in handlers/downloadAndSend' })
}
