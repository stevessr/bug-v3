import { getCsrfTokenFromPage } from '../utils/csrf'

import type { MessageHandler } from './types'

import type { MessageResponse } from '@/types/messages'

export const pageUploadHandler: MessageHandler = (message, _sender, sendResponse) => {
  if (message.type !== 'PAGE_UPLOAD') return false

  const opts = message.options || {}
  const url = opts.url
  if (!url) {
    const errorResponse: MessageResponse = { success: false, error: 'Missing url' }
    sendResponse(errorResponse)
    return true
  }

  if (!Array.isArray(opts.fileData) || opts.fileData.length === 0) {
    const errorResponse: MessageResponse = { success: false, error: 'Missing file data' }
    sendResponse(errorResponse)
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
        const response: MessageResponse = {
          success: true,
          data: { status: res.status, ok: res.ok, data }
        }
        sendResponse(response)
      })
      .catch((error: any) => {
        const errorResponse: MessageResponse = {
          success: false,
          error: error?.message || 'Page upload failed'
        }
        sendResponse(errorResponse)
      })
  } catch (error: any) {
    const errorResponse: MessageResponse = {
      success: false,
      error: error?.message || 'Page upload failed'
    }
    sendResponse(errorResponse)
  }

  return true
}
