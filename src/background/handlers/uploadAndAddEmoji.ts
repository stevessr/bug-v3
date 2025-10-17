import { newStorageHelpers } from '../../utils/newStorage'
import { getChromeAPI } from '../utils/main.ts'

const LINUX_DO_UPLOAD_URL =
  'https://linux.do/uploads.json?client_id=f06cb5577ba9410d94b9faf94e48c2d8'

async function computeSHA1OfArrayBuffer(buffer: ArrayBuffer) {
  if (typeof crypto === 'undefined' || !crypto.subtle) return null
  try {
    const hash = await crypto.subtle.digest('SHA-1', buffer)
    const arr = Array.from(new Uint8Array(hash))
    return arr.map(b => b.toString(16).padStart(2, '0')).join('')
  } catch {
    return null
  }
}

export async function handleUploadAndAddEmoji(message: any, sendResponse: any) {
  // message.payload: { arrayData, filename, mimeType, name }
  try {
    const payload = message.payload || {}
    const { arrayData, filename, mimeType, name, originUrl } = payload

    console.debug('[Background] handleUploadAndAddEmoji received payload', {
      filename,
      mimeType,
      name,
      length: Array.isArray(arrayData) ? arrayData.length : undefined
    })

    if (!Array.isArray(arrayData) || arrayData.length === 0) {
      sendResponse({ success: false, error: 'No arrayData provided' })
      return
    }

    // Reconstruct blob
    const uint8 = new Uint8Array(arrayData)
    const blob = new Blob([uint8], { type: mimeType || 'application/octet-stream' })

    // Attempt to upload to linux.do
    let finalUrl: string | null = null
    try {
      const chromeAPI = getChromeAPI()
      let cookies = ''
      let csrfToken = ''
      if (chromeAPI && chromeAPI.cookies) {
        try {
          const cookieList: any[] = await chromeAPI.cookies.getAll({ domain: 'linux.do' })
          cookies = cookieList.map((c: any) => `${c.name}=${c.value}`).join('; ')
        } catch (e) {
          console.warn('[Background] failed to get linux.do cookies', e)
        }
      }

      // Try to get CSRF token from any linux.do tab
      if (chromeAPI && chromeAPI.tabs) {
        try {
          const tabs = await chromeAPI.tabs.query({ url: 'https://linux.do/*' })
          for (let i = 0; i < tabs.length; i++) {
            const t = tabs[i]
            if (t && t.id) {
              try {
                // send a message to the tab to request CSRF token
                // The content script on linux.do should respond to type GET_CSRF_TOKEN
                // If not available, this will throw and we will keep trying other tabs

                const resp = await chromeAPI.tabs.sendMessage(t.id, { type: 'GET_CSRF_TOKEN' })
                if (resp && resp.csrfToken) {
                  csrfToken = resp.csrfToken
                  break
                }
              } catch {
                // ignore and continue
                continue
              }
            }
          }
        } catch (e) {
          console.warn('[Background] failed to query linux.do tabs for CSRF token', e)
        }
      }

      // Build form data similar to front-end uploader
      const arrayBuffer = await blob.arrayBuffer()
      const sha1 = (await computeSHA1OfArrayBuffer(arrayBuffer)) || ''

      const file = new File([blob], filename || 'image', { type: blob.type })
      const form = new FormData()
      form.append('upload_type', 'composer')
      form.append('relativePath', 'null')
      form.append('name', file.name)
      form.append('type', file.type)
      if (sha1) form.append('sha1_checksum', sha1)
      form.append('file', file, file.name)

      const headers: Record<string, string> = {}
      if (csrfToken) headers['X-Csrf-Token'] = csrfToken
      if (cookies) headers['Cookie'] = cookies

      const resp = await fetch(LINUX_DO_UPLOAD_URL, {
        method: 'POST',
        headers,
        body: form
      })

      if (resp.ok) {
        const data = await resp.json()
        if (data && data.url) {
          finalUrl = data.url
        }
      } else {
        try {
          const errData = await resp.json().catch(() => null)
          console.warn('[Background] linux.do upload response not ok', resp.status, errData)
        } catch (e) {
          console.warn('[Background] linux.do upload non-ok and no JSON body', e)
        }
      }
    } catch (e) {
      console.warn('[Background] upload to linux.do failed, will fallback to data/object URL', e)
    }

    // Fallback to data URL/object URL if upload failed
    if (!finalUrl) {
      const dataUrl: string | null = await new Promise(resolve => {
        try {
          const reader = new FileReader()
          reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null)
          reader.onerror = () => resolve(null)
          reader.readAsDataURL(blob)
        } catch (e) {
          console.warn('[Background] failed to create dataURL from blob', e)
          resolve(null)
        }
      })
      finalUrl = dataUrl || URL.createObjectURL(blob)
    }

    // Add to storage (ungrouped)
    const groups = await newStorageHelpers.getAllEmojiGroups()
    let ungroupedGroup = groups.find((g: any) => g.id === 'ungrouped')
    if (!ungroupedGroup) {
      ungroupedGroup = { id: 'ungrouped', name: '未分组', icon: '📦', order: 999, emojis: [] }
      groups.push(ungroupedGroup)
    }

    const newEmoji: any = {
      id: `emoji-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      packet: Date.now(),
      name: name || filename || 'image',
      url: finalUrl,
      groupId: 'ungrouped',
      originUrl: originUrl || undefined,
      addedAt: Date.now()
    }

    ungroupedGroup.emojis.push(newEmoji)
    await newStorageHelpers.setAllEmojiGroups(groups)

    try {
      const chromeAPI = getChromeAPI()
      if (chromeAPI?.runtime?.sendMessage) {
        chromeAPI.runtime.sendMessage({
          type: 'EMOJI_EXTENSION_UNGROUPED_ADDED',
          payload: {
            emoji: newEmoji,
            group: {
              id: ungroupedGroup.id,
              name: ungroupedGroup.name,
              icon: ungroupedGroup.icon,
              order: ungroupedGroup.order
            }
          }
        })
      }
    } catch (broadcastError) {
      console.warn('[Background] Failed to broadcast upload addition', broadcastError)
    }

    console.log('[Background] handleUploadAndAddEmoji added emoji to ungrouped', newEmoji.name)
    sendResponse({ success: true, url: finalUrl, added: true })
  } catch (error) {
    console.error('[Background] handleUploadAndAddEmoji failed', error)
    sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) })
  }
}
