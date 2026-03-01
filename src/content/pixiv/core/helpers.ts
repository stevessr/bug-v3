import type { AddEmojiButtonData } from '../types'

// Duplicate minimal helpers here to avoid circular imports when used from UI
export function extractNameFromUrl(url: string): string {
  try {
    const urlObj = new URL(url)
    const pathname = urlObj.pathname
    const filename = pathname.split('/').pop() || ''

    const nameWithoutExt = filename.replace(/\.[^/.]+$/, '')
    const decoded = decodeURIComponent(nameWithoutExt)
    if (/^[0-9a-f]{8,}$/i.test(decoded) || decoded.length < 2) {
      return '表情'
    }
    return decoded || '表情'
  } catch {
    console.warn('[pixiv][helpers] extractNameFromUrl failed, returning fallback "表情"', url)
    return '表情'
  }
}

export async function tryGetImageViaCanvas(
  url: string
): Promise<{ success: true; blob: Blob } | { success: false; error: any }> {
  return new Promise(resolve => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = async () => {
      try {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        canvas.width = img.naturalWidth || img.width
        canvas.height = img.naturalHeight || img.height
        if (!ctx) throw new Error('no-2d-context')
        ctx.drawImage(img, 0, 0)

        try {
          canvas.toBlob(b => {
            if (b) {
              resolve({ success: true, blob: b })
            } else {
              console.warn('[pixiv][helpers] tryGetImageViaCanvas no blob produced')
              resolve({ success: false, error: 'no-blob' })
            }
          })
        } catch {
          try {
            const dataUrl = canvas.toDataURL()
            fetch(dataUrl)
              .then(r => r.blob())
              .then(b => resolve({ success: true, blob: b }))
              .catch(err => resolve({ success: false, error: err }))
          } catch (err2) {
            console.warn('[pixiv][helpers] tryGetImageViaCanvas toDataURL fallback failed', err2)
            resolve({ success: false, error: err2 })
          }
        }
      } catch (err) {
        console.warn('[pixiv][helpers] tryGetImageViaCanvas drawing/processing failed', err)
        resolve({ success: false, error: err })
      }
    }
    img.onerror = () => resolve({ success: false, error: new Error('image load failed') })
    img.src = url
  })
}

export async function sendEmojiToBackground(
  blob: Blob,
  emojiName: string,
  filename: string,
  originUrl?: string
) {
  try {
    const chromeAPI = (window as any).chrome

    if (!chromeAPI || !chromeAPI.runtime || !chromeAPI.runtime.sendMessage) {
      console.error('[pixiv][helpers] Chrome extension API not available')
      throw new Error('Chrome extension API not available')
    }

    const arrayBuffer = await blob.arrayBuffer()
    const uint8Array = new Uint8Array(arrayBuffer)
    const arrayData = Array.from(uint8Array)

    const bgResp: any = await new Promise(resolve => {
      try {
        chromeAPI.runtime.sendMessage(
          {
            type: 'UPLOAD_AND_ADD_EMOJI',
            payload: {
              arrayData,
              filename,
              mimeType: blob.type,
              name: emojiName,
              originUrl: originUrl
            }
          },
          (r: any) => resolve(r)
        )
      } catch (e) {
        console.error('[pixiv][helpers] sendEmojiToBackground sendMessage failed', e)
        resolve({ success: false, error: 'Failed to send message to background' })
      }
    })

    if (bgResp && bgResp.success) {
      return {
        success: true,
        source: 'uploaded',
        url: bgResp.url,
        added: !!bgResp.added,
        message: '表情已成功添加到未分组'
      }
    } else {
      console.warn('[pixiv][helpers] sendEmojiToBackground background indicated failure', bgResp)
      return {
        success: false,
        error: '后台处理失败',
        details: bgResp?.error || bgResp?.details
      }
    }
  } catch (error) {
    console.error('[pixiv][helpers] sendEmojiToBackground exception', error)
    return {
      success: false,
      error: '发送数据到后台失败',
      details: error instanceof Error ? error.message : String(error)
    }
  }
}

export async function performPixivAddEmojiFlow(data: AddEmojiButtonData) {
  try {
    const baseName = data.name && data.name.length > 0 ? data.name : extractNameFromUrl(data.url)
    const filename = baseName.replace(/\.(webp|jpg|jpeg|png|gif)$/i, '').trim() || 'image'

    try {
      const canvasResult = await tryGetImageViaCanvas(data.url)
      if (canvasResult.success) {
        return await sendEmojiToBackground(canvasResult.blob, baseName, filename, data.url)
      }
    } catch (e) {
      console.warn('[pixiv][helpers] tryGetImageViaCanvas threw', e)
      // fallthrough
    }

    try {
      const response = await fetch(data.url, {
        method: 'GET',
        headers: {
          Referer: 'https://www.pixiv.net/',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        credentials: 'omit'
      })

      if (response.ok) {
        const blob = await response.blob()
        return await sendEmojiToBackground(blob, baseName, filename, data.url)
      }
    } catch (e) {
      console.warn('[pixiv][helpers] fetch failed', e)
      // fallthrough
    }

    try {
      window.open(data.url, '_blank')
      return {
        success: true,
        source: 'opened',
        message: '已在新标签页打开图片，请在图片页面重试添加表情'
      }
    } catch (e) {
      console.error('[pixiv][helpers] failed to open image URL', e)
      return { success: false, error: '无法下载图片或打开图片页面', details: e }
    }
  } catch (error) {
    console.error('[pixiv][helpers] performPixivAddEmojiFlow fatal error', error)
    return { success: false, error: '添加表情失败', details: error }
  }
}
