import { logger } from '../config/buildFlags'

import { getChromeAPI } from './utils'
import { defaultProxyConfig } from './proxyConfig'

export async function handleDownloadAndSendToDiscourse(payload: any, sendResponse: any) {
  void sendResponse
  try {
    if (!payload || !payload.url) {
      sendResponse({ success: false, error: 'missing payload.url' })
      return
    }

    const url: string = payload.url
    const discourseBase: string | undefined = payload.discourseBase

    // fetch the image with headers approximating a browser request to Pixiv
    // use fetch's referrer option rather than trying to set User-Agent or restricted headers
    const defaultHeaders: Record<string, string> = {
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6',
      'Cache-Control': 'max-age=0',
      // sec-ch-ua and related client hints — may be ignored by fetch/runtime but included to approximate the curl
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
      // set referrer to pixiv to emulate the browser Referer header
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

    // Find tabs that match discourseBase (if provided), otherwise send to all tabs
    const chromeAPI = getChromeAPI()
    const tabs = await (chromeAPI.tabs && chromeAPI.tabs.query ? chromeAPI.tabs.query({}) : [])

    let sent = 0
    for (const tab of tabs) {
      try {
        // If discourseBase provided, filter by URL
        if (discourseBase && tab.url && !String(tab.url).startsWith(discourseBase)) continue

        // send structured-cloneable payload
        await chromeAPI.tabs.sendMessage(tab.id, {
          action: 'uploadBlobToDiscourse',
          filename: payload.filename || 'image.jpg',
          mimeType: payload.mimeType || 'image/jpeg',
          arrayBuffer,
          discourseBase
        })
        sent++
      } catch (e) {
        // Ignore send errors for tabs without content script
        void e
      }
    }

    if (sent === 0) {
      sendResponse({ success: false, error: 'no discourse tab found to receive upload' })
      return
    }

    sendResponse({ success: true, message: `sent to ${sent} tab(s)` })
  } catch (error) {
    logger.error('[Background] downloadAndSendToDiscourse failed', error)
    sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) })
  }
}

export async function handleDownloadForUser(payload: any, sendResponse: any) {
  void sendResponse
  try {
    if (!payload || !payload.url) {
      logger.error('[Background] handleDownloadForUser missing payload.url')
      sendResponse({ success: false, error: 'missing payload.url' })
      return
    }

    const url: string = payload.url

    // If content requested a direct browser download, try proxy first (if configured),
    // otherwise try chrome.downloads.download directly.
    if (payload.directDownload) {
      // payload may contain proxy override
      let proxy = payload.proxy || defaultProxyConfig

      // If content requested to use storage proxy, try to read proxy config from chrome.storage
      if (payload.useStorageProxy) {
        try {
          const chromeAPI = getChromeAPI()
          const readStorageProxy = () =>
            new Promise<any>(resolve => {
              try {
                if (chromeAPI.storage && chromeAPI.storage.sync && chromeAPI.storage.sync.get) {
                  chromeAPI.storage.sync.get(['proxy'], (res: any) => resolve(res?.proxy || null))
                } else if (
                  chromeAPI.storage &&
                  chromeAPI.storage.local &&
                  chromeAPI.storage.local.get
                ) {
                  chromeAPI.storage.local.get(['proxy'], (res: any) => resolve(res?.proxy || null))
                } else resolve(null)
              } catch (_e) {
                resolve(null)
              }
            })

          const stored = await readStorageProxy()
          if (stored && stored.enabled && stored.url) proxy = stored
        } catch (e) {
          logger.error('[Background] failed to read proxy from storage', e)
        }
      }
      if (proxy && proxy.enabled && proxy.url) {
        try {
          logger.log('[Background] attempting proxy download', { proxy: proxy.url, url })
          const proxyUrl = new URL(proxy.url)
          proxyUrl.searchParams.set('url', url)
          if (proxy.password) proxyUrl.searchParams.set('pw', proxy.password)

          const proxyResp = await fetch(proxyUrl.toString(), { method: 'GET' })
          if (proxyResp.ok) {
            // proxy returned the image body; create object URL and download
            const arrayBuffer = await proxyResp.arrayBuffer()
            const contentType = proxyResp.headers.get('content-type') || 'application/octet-stream'
            const blob = new Blob([new Uint8Array(arrayBuffer)], { type: contentType })
            const objectUrl = URL.createObjectURL(blob)
            const chromeAPI = getChromeAPI()
            if (chromeAPI && chromeAPI.downloads && chromeAPI.downloads.download) {
              const filename =
                payload.filename ||
                ((): string => {
                  try {
                    const u = new URL(url)
                    return (u.pathname.split('/').pop() || 'image').replace(/\?.*$/, '')
                  } catch (_e) {
                    return 'image'
                  }
                })()
              try {
                const downloadId: number = await new Promise((resolve, reject) => {
                  try {
                    chromeAPI.downloads.download({ url: objectUrl, filename }, (id: number) => {
                      if (chromeAPI.runtime && chromeAPI.runtime.lastError)
                        reject(chromeAPI.runtime.lastError)
                      else resolve(id)
                    })
                  } catch (e) {
                    reject(e)
                  }
                })
                setTimeout(() => URL.revokeObjectURL(objectUrl), 5000)
                sendResponse({ success: true, downloadId, via: 'proxy' })
                return
              } catch (e) {
                void e
                // fall through to other paths
              }
            } else {
              // no downloads API available; return arrayBuffer fallback
              sendResponse({
                success: true,
                fallback: true,
                arrayBuffer,
                mimeType: contentType,
                filename: payload.filename || 'image'
              })
              return
            }
          } else {
            logger.error('[Background] proxy fetch failed', { status: proxyResp.status })
            // fall through to try direct download
          }
        } catch (e) {
          logger.error('[Background] proxy attempt error', e)
          // fall through to try direct download
        }
      }

      // Try direct chrome.downloads.download next
      try {
        const chromeAPI = getChromeAPI()
        if (chromeAPI && chromeAPI.downloads && chromeAPI.downloads.download) {
          const filename =
            payload.filename ||
            (() => {
              try {
                const u = new URL(url)
                return (u.pathname.split('/').pop() || 'image').replace(/\?.*$/, '')
              } catch (_e) {
                return 'image'
              }
            })()

          logger.log('[Background] attempting directDownload', { url, filename })

          const downloadId: number = await new Promise((resolve, reject) => {
            try {
              chromeAPI.downloads.download({ url, filename }, (id: number) => {
                const le = chromeAPI.runtime && chromeAPI.runtime.lastError
                if (le) {
                  // provide structured error to caller
                  reject(le)
                } else resolve(id)
              })
            } catch (e) {
              reject(e)
            }
          })

          logger.log('[Background] directDownload started', { downloadId, url })
          sendResponse({ success: true, downloadId })
          return
        }
      } catch (e: any) {
        // Log and fall through to normal fetch-based download below
        logger.error(
          '[Background] directDownload attempt failed, will fallback to fetch',
          e && e.message ? e.message : e
        )
        // don't return here; fall back to fetch path to try another approach
      }
    }

    const defaultHeaders: Record<string, string> = {
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6',
      'Cache-Control': 'max-age=0'
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
    const contentType = resp.headers.get('content-type') || 'application/octet-stream'

    // attempt to determine filename from Content-Disposition or URL
    let filename = payload.filename || ''
    const cd = resp.headers.get('content-disposition') || ''
    const m = /filename\*=UTF-8''([^;\n]+)/i.exec(cd) || /filename="?([^";\n]+)"?/i.exec(cd)
    if (m && m[1]) filename = decodeURIComponent(m[1])
    if (!filename) {
      try {
        const u = new URL(url)
        filename = (u.pathname.split('/').pop() || 'image').replace(/\?.*$/, '')
      } catch (_e) {
        filename = payload.filename || 'image'
      }
    }

    // create blob and object URL and use chrome.downloads to save file
    try {
      const blob = new Blob([new Uint8Array(arrayBuffer)], { type: contentType })
      const objectUrl = URL.createObjectURL(blob)
      const chromeAPI = getChromeAPI()
      let downloadId: number | undefined = undefined
      if (chromeAPI && chromeAPI.downloads && chromeAPI.downloads.download) {
        // chrome.downloads.download accepts a URL; we pass the object URL
        downloadId = await new Promise<number>((resolve, reject) => {
          try {
            chromeAPI.downloads.download({ url: objectUrl, filename }, (id: number) => {
              if (chromeAPI.runtime.lastError) reject(chromeAPI.runtime.lastError)
              else resolve(id)
            })
          } catch (e) {
            reject(e)
          }
        })
      } else {
        // Fallback: send arrayBuffer back to page if downloads API not available
        sendResponse({
          success: true,
          fallback: true,
          arrayBuffer,
          mimeType: contentType,
          filename
        })
        return
      }

      // revoke object URL after short delay
      setTimeout(() => URL.revokeObjectURL(objectUrl), 5000)

      sendResponse({ success: true, downloadId })
      return
    } catch (e) {
      // If downloads API failed, fallback to returning arrayBuffer
      void e
      sendResponse({ success: true, fallback: true, arrayBuffer, mimeType: contentType, filename })
      return
    }
  } catch (error) {
    logger.error('[Background] handleDownloadForUser failed', error)
    sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) })
  }
}

/**
 * Download a remote image (with Referer) and upload it directly to a Discourse instance.
 * Returns parsed upload response or throws on error.
 */
export async function downloadAndUploadDirect(
  url: string,
  filename: string,
  opts: { discourseBase: string; cookie?: string; csrf?: string; mimeType?: string }
) {
  const { discourseBase, cookie, csrf, mimeType } = opts
  // download
  const defaultHeaders: Record<string, string> = {
    Accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6',
    'Cache-Control': 'max-age=0'
  }

  const resp = await fetch(url, {
    method: 'GET',
    headers: defaultHeaders,
    referrer: 'https://www.pixiv.net/',
    referrerPolicy: 'no-referrer-when-downgrade',
    cache: 'no-cache',
    redirect: 'follow'
  })

  if (!resp.ok) throw new Error(`failed to download image: ${resp.status}`)
  const arrayBuffer = await resp.arrayBuffer()
  const blob = new Blob([new Uint8Array(arrayBuffer)], { type: mimeType || 'image/png' })

  // prepare form
  const form = new FormData()
  form.append('upload_type', 'composer')
  form.append('relativePath', 'null')
  form.append('name', filename)
  form.append('type', blob.type)
  form.append('file', blob, filename)

  const uploadUrl = `${discourseBase.replace(/\/$/, '')}/uploads.json?client_id=f06cb5577ba9410d94b9faf94e48c2d8`

  const headers: Record<string, string> = {}
  if (csrf) headers['X-Csrf-Token'] = csrf
  if (cookie) headers['Cookie'] = cookie

  const uploadResp = await fetch(uploadUrl, {
    method: 'POST',
    headers,
    body: form,
    credentials: 'include'
  })
  if (!uploadResp.ok) {
    const data = await uploadResp.json().catch(() => null)
    const err = new Error('upload failed') as any
    err.details = data
    throw err
  }

  const data = await uploadResp.json()
  return data
}
