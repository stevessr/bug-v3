import type { AddEmojiButtonData } from './types'

// Duplicate minimal helpers here to avoid circular imports
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
            if (b) resolve({ success: true, blob: b })
            else resolve({ success: false, error: 'no-blob' })
          })
        } catch {
          try {
            const dataUrl = canvas.toDataURL()
            fetch(dataUrl)
              .then(r => r.blob())
              .then(b => resolve({ success: true, blob: b }))
              .catch(err => resolve({ success: false, error: err }))
          } catch (err2) {
            resolve({ success: false, error: err2 })
          }
        }
      } catch (err) {
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
      throw new Error('Chrome extension API not available')
    }

    console.log('[PixivAddEmoji] Converting blob to ArrayBuffer for background:', {
      name: emojiName,
      filename,
      size: blob.size,
      type: blob.type
    })

    const arrayBuffer = await blob.arrayBuffer()
    const uint8Array = new Uint8Array(arrayBuffer)
    const arrayData = Array.from(uint8Array)

    console.log('[PixivAddEmoji] Converted blob to array data:', {
      originalBlobSize: blob.size,
      arrayBufferSize: arrayBuffer.byteLength,
      arrayDataLength: arrayData.length
    })

    const bgResp: any = await new Promise(resolve => {
      try {
        chromeAPI.runtime.sendMessage(
          {
            action: 'uploadAndAddEmoji',
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
      } catch {
        resolve({ success: false, error: 'Failed to send message to background' })
      }
    })

    if (bgResp && bgResp.success) {
      console.log('[PixivAddEmoji] Emoji successfully processed by background:', bgResp)
      return {
        success: true,
        source: 'uploaded',
        url: bgResp.url,
        added: !!bgResp.added,
        message: '表情已成功添加到未分组'
      }
    } else {
      console.error(
        '[PixivAddEmoji] Background processing failed:',
        JSON.stringify(bgResp, null, 2)
      )
      return {
        success: false,
        error: '后台处理失败',
        details: bgResp?.error || bgResp?.details
      }
    }
  } catch (error) {
    console.error('[PixivAddEmoji] Failed to send to background:', error)
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

    console.log('[PixivAddEmoji] Starting add emoji flow for:', { name: baseName, url: data.url })

    try {
      const canvasResult = await tryGetImageViaCanvas(data.url)
      if (canvasResult.success) {
        console.log('[PixivAddEmoji] Canvas download successful, sending to background')
        return await sendEmojiToBackground(canvasResult.blob, baseName, filename, data.url)
      }
    } catch (e) {
      console.warn('[PixivAddEmoji] Canvas method failed:', e)
    }

    try {
      console.log('[PixivAddEmoji] Trying direct fetch as fallback')
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
        console.log('[PixivAddEmoji] Direct fetch successful, sending to background')
        return await sendEmojiToBackground(blob, baseName, filename, data.url)
      }
    } catch (e) {
      console.warn('[PixivAddEmoji] Direct fetch failed:', e)
    }

    console.log('[PixivAddEmoji] Direct methods failed, opening image URL for injection')
    try {
      window.open(data.url, '_blank')
      return {
        success: true,
        source: 'opened',
        message: '已在新标签页打开图片，请在图片页面重试添加表情'
      }
    } catch (e) {
      console.error('[PixivAddEmoji] Failed to open image URL:', e)
      return { success: false, error: '无法下载图片或打开图片页面', details: e }
    }
  } catch (error) {
    console.error('[PixivAddEmoji] Add emoji flow failed:', error)
    return { success: false, error: '添加表情失败', details: error }
  }
}
