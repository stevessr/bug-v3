
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
    console.error('[Background] downloadAndSendToDiscourse failed', error)
    sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) })
  }
}

export async function handleDownloadForUser(payload: any, sendResponse: any) {
  void sendResponse
  try {
    if (!payload || !payload.url) {
      console.error('[Background] handleDownloadForUser missing payload.url')
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
          console.error('[Background] failed to read proxy from storage', e)
        }
      }
      if (proxy && proxy.enabled && proxy.url) {
        try {
          console.log('[Background] attempting proxy download', { proxy: proxy.url, url })
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
            console.error('[Background] proxy fetch failed', { status: proxyResp.status })
            // fall through to try direct download
          }
        } catch (e) {
          console.error('[Background] proxy attempt error', e)
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

          console.log('[Background] attempting directDownload', { url, filename })

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

          console.log('[Background] directDownload started', { downloadId, url })
          sendResponse({ success: true, downloadId })
          return
        }
      } catch (e: any) {
        // Log and fall through to normal fetch-based download below
        console.error(
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
    console.error('[Background] handleDownloadForUser failed', error)
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

/**
 * Handler for content script sending arrayBuffer to be uploaded to linux.do and added as emoji
 * payload: { arrayBuffer: ArrayBuffer, filename: string, mimeType?: string, name?: string }
 */
export async function handleUploadAndAddEmoji(payload: any, sendResponse: any) {
  void sendResponse
  try {
    if (!payload) {
      sendResponse({ success: false, error: 'missing payload' })
      return
    }

    // Diagnostics: log payload shape
    try {
      console.log('[UploadAndAddEmoji] Received payload keys:', Object.keys(payload))
    } catch (_e) {
      void _e
    }

    if (!payload.arrayData) {
      // Might receive Uint8Array or arrayBuffer in some cases — log and fail gracefully
      console.warn('[UploadAndAddEmoji] payload.arrayData missing; keys:', Object.keys(payload))
      sendResponse({ success: false, error: 'missing arrayData' })
      return
    }

    // 将数组数据转换回 ArrayBuffer
    const arrayData: number[] = payload.arrayData
    const arrayBuffer = new Uint8Array(arrayData).buffer
    // Diagnostic: verify arrayBuffer type/length
    try {
      const abType = Object.prototype.toString.call(arrayBuffer)
      const byteLen = arrayBuffer.byteLength
      console.log('[UploadAndAddEmoji] converted arrayData to arrayBuffer:', {
        arrayDataLength: arrayData.length,
        arrayBufferType: abType,
        byteLength: byteLen
      })
    } catch (_e) {
      void _e
    }
    const filename: string = payload.filename || 'image'
    const mimeType: string = payload.mimeType || 'application/octet-stream'
    const name: string = payload.name || filename

    console.log(
      '[UploadAndAddEmoji] Processing file:',
      filename,
      'size:',
      arrayBuffer.byteLength,
      'type:',
      mimeType
    )

    // build blob and form data similar to emojiPreviewUploader
    const blob = new Blob([new Uint8Array(arrayBuffer)], { type: mimeType })

    console.log('[UploadAndAddEmoji] Created blob size:', blob.size, 'type:', blob.type)

    const formData = new FormData()
    formData.append('upload_type', 'composer')
    formData.append('relativePath', 'null')
    formData.append('name', filename)
    formData.append('type', blob.type)
    // do not include sha1 here (optional)
    formData.append('file', blob, filename)

    // Get auth info directly instead of sending message to self
    const chromeAPI = getChromeAPI()
    let authResp: any = { success: false, csrfToken: '', cookies: '' }
    try {
      if (chromeAPI && chromeAPI.cookies) {
        // Get linux.do cookies directly
        const cookies = await chromeAPI.cookies.getAll({ domain: 'linux.do' })
        const cookieString = cookies
          .map((cookie: any) => `${cookie.name}=${cookie.value}`)
          .join('; ')

        // Try to get CSRF token from linux.do tabs
        let csrfToken = ''
        try {
          if (chromeAPI.tabs) {
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
                    } catch (e) {
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
          }
        } catch (e) {
          console.warn('Failed to get CSRF token from linux.do tab:', e)
        }

        authResp = {
          success: true,
          csrfToken: csrfToken,
          cookies: cookieString
        }
      }
    } catch (_e) {
      console.error('Failed to get auth info:', _e)
    }

    const headers: Record<string, string> = {}
    if (authResp && authResp.csrfToken) headers['X-Csrf-Token'] = authResp.csrfToken
    if (authResp && authResp.cookies) headers['Cookie'] = authResp.cookies

    const uploadUrl = `https://linux.do/uploads.json?client_id=f06cb5577ba9410d94b9faf94e48c2d8`

    const resp = await fetch(uploadUrl, {
      method: 'POST',
      headers,
      body: formData,
      credentials: 'include'
    })

    if (!resp.ok) {
      const errData = await resp.json().catch(() => null)
      sendResponse({ success: false, error: 'upload failed', details: errData })
      return
    }

    const data = await resp.json()
    const uploadedUrl = data && data.url ? data.url : null

    if (!uploadedUrl) {
      sendResponse({ success: false, error: 'no url returned from upload', details: data })
      return
    }

    // Add to storage - mimic addEmojiFromWeb ungrouped insertion
    try {
      const { newStorageHelpers } = await import('../utils/newStorage')
      const groups = await newStorageHelpers.getAllEmojiGroups()
      let ungroupedGroup = groups.find((g: any) => g.id === 'ungrouped')
      if (!ungroupedGroup) {
        ungroupedGroup = { id: 'ungrouped', name: '未分组', icon: '📦', order: 999, emojis: [] }
        groups.push(ungroupedGroup)
      }

      const finalUrl = uploadedUrl
      const newEmoji = {
        id: `emoji-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        packet: Date.now(),
        name: name,
        url: finalUrl,
        groupId: 'ungrouped',
        addedAt: Date.now()
      }

      ungroupedGroup.emojis.push(newEmoji)
      await newStorageHelpers.setAllEmojiGroups(groups)

      sendResponse({ success: true, url: finalUrl, added: true })
      return
    } catch (e) {
      sendResponse({ success: true, url: uploadedUrl, added: false, error: String(e) })
      return
    }
  } catch (error) {
    sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) })
  }
}

// 下载图片并上传到 linux.do 的处理器
export async function handleDownloadAndUploadEmoji(payload: any, sendResponse: any) {
  void sendResponse
  try {
    if (!payload || !payload.url) {
      sendResponse({ success: false, error: 'missing url' })
      return
    }

    const imageUrl: string = payload.url
    const filename: string = payload.filename || 'image'
    const name: string = payload.name || filename

    console.log('[DownloadAndUploadEmoji] Processing image:', filename, 'from:', imageUrl)

    // Step 1: 下载图片
    const defaultHeaders: Record<string, string> = {
      Accept: 'image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'Cache-Control': 'max-age=0',
      'sec-ch-ua': '"Not;A=Brand";v="99", "Microsoft Edge";v="139", "Chromium";v="139"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      'Sec-Fetch-Dest': 'image',
      'Sec-Fetch-Mode': 'no-cors',
      'Sec-Fetch-Site': 'cross-site',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }

    // 为 pixiv 添加特殊的 Referer
    if (imageUrl.includes('pximg.net')) {
      defaultHeaders.Referer = 'https://www.pixiv.net/'
    }

    const imageResp = await fetch(imageUrl, {
      method: 'GET',
      headers: defaultHeaders,
      credentials: 'omit'
    })

    if (!imageResp.ok) {
      sendResponse({
        success: false,
        error: `Failed to download image: ${imageResp.status}`,
        details: imageResp.statusText
      })
      return
    }

    const imageBlob = await imageResp.blob()
    console.log('[DownloadAndUploadEmoji] Image downloaded:', imageBlob.size, 'bytes')

    // Step 2: 获取认证信息
    const chromeAPI = getChromeAPI()
    let authResp: any = { success: false, csrfToken: '', cookies: '' }
    try {
      if (chromeAPI && chromeAPI.cookies) {
        const cookies = await chromeAPI.cookies.getAll({ domain: 'linux.do' })
        const cookieString = cookies
          .map((cookie: any) => `${cookie.name}=${cookie.value}`)
          .join('; ')

        let csrfToken = ''
        try {
          if (chromeAPI.tabs) {
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
                    } catch (e) {
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
          }
        } catch (e) {
          console.warn('Failed to get CSRF token from linux.do tab:', e)
        }

        authResp = {
          success: true,
          csrfToken: csrfToken,
          cookies: cookieString
        }
      }
    } catch (_e) {
      console.error('Failed to get auth info:', _e)
    }

    // Step 3: 上传到 linux.do
    const formData = new FormData()
    formData.append('upload_type', 'composer')
    formData.append('relativePath', 'null')
    formData.append('name', filename)
    formData.append('type', imageBlob.type)
    formData.append('file', imageBlob, filename)

    const headers: Record<string, string> = {}
    if (authResp.csrfToken) headers['X-Csrf-Token'] = authResp.csrfToken
    if (authResp.cookies) headers['Cookie'] = authResp.cookies

    const uploadUrl = `https://linux.do/uploads.json?client_id=f06cb5577ba9410d94b9faf94e48c2d8`

    const uploadResp = await fetch(uploadUrl, {
      method: 'POST',
      headers,
      body: formData,
      credentials: 'include'
    })

    if (!uploadResp.ok) {
      const errData = await uploadResp.json().catch(() => null)
      sendResponse({ success: false, error: 'upload failed', details: errData })
      return
    }

    const uploadData = await uploadResp.json()
    const uploadedUrl = uploadData && uploadData.url ? uploadData.url : null

    if (!uploadedUrl) {
      sendResponse({ success: false, error: 'no url returned from upload', details: uploadData })
      return
    }

    // Step 4: 保存到本地存储
    try {
      const { newStorageHelpers } = await import('../utils/newStorage')
      const groups = await newStorageHelpers.getAllEmojiGroups()
      let ungroupedGroup = groups.find((g: any) => g.id === 'ungrouped')
      if (!ungroupedGroup) {
        ungroupedGroup = { id: 'ungrouped', name: '未分组', icon: '📦', order: 999, emojis: [] }
        groups.push(ungroupedGroup)
      }

      const newEmoji = {
        id: `emoji-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        packet: Date.now(),
        name: name,
        url: uploadedUrl,
        groupId: 'ungrouped',
        addedAt: Date.now()
      }

      ungroupedGroup.emojis.push(newEmoji)
      await newStorageHelpers.setAllEmojiGroups(groups)

      sendResponse({ success: true, url: uploadedUrl, added: true })
      return
    } catch (e) {
      sendResponse({ success: true, url: uploadedUrl, added: false, error: String(e) })
      return
    }
  } catch (error) {
    sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) })
  }
}
