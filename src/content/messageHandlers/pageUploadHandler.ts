import { getCsrfTokenFromPage } from '../utils/csrf'
import type { MessageHandler } from './types'

export const pageUploadHandler: MessageHandler = (message, _sender, sendResponse) => {
  if (message.type !== 'PAGE_UPLOAD') return false

  const opts = message.options || {}
  const url = opts.url
  if (!url) {
    sendResponse({ success: false, error: 'Missing url' })
    return true
  }

  if (!Array.isArray(opts.fileData) || opts.fileData.length === 0) {
    sendResponse({ success: false, error: 'Missing file data' })
    return true
  }

  try {
    const buffer = new Uint8Array(opts.fileData)
    const blob = new Blob([buffer], { type: opts.mimeType || 'application/octet-stream' })
    const file = new File([blob], opts.fileName || 'image', { type: blob.type })

    const form = new FormData()
    form.append('upload_type', 'composer')
    form.append('relativePath', 'null')
    form.append('name', file.name)
    form.append('type', file.type)
    if (opts.sha1) form.append('sha1_checksum', opts.sha1)
    form.append('file', file, file.name)

    const headers: Record<string, string> = {}
    const csrfToken = getCsrfTokenFromPage()
    if (csrfToken) headers['X-Csrf-Token'] = csrfToken

    fetch(url, {
      method: 'POST',
      headers,
      body: form,
      credentials: 'include'
    })
      .then(async res => {
        const data = await res.json().catch(async () => {
          try {
            return { message: await res.text() }
          } catch {
            return null
          }
        })
        sendResponse({ success: true, status: res.status, ok: res.ok, data })
      })
      .catch((error: any) => {
        sendResponse({ success: false, error: error?.message || 'Page upload failed' })
      })
  } catch (error: any) {
    sendResponse({ success: false, error: error?.message || 'Page upload failed' })
  }

  return true
}
