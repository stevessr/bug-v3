import { uploadThroughDiscourseRoute } from '../discourse/utils/nativeUpload'
import { getCsrfTokenFromPage } from '../utils/dom/csrf'

import type { MessageHandler } from './types'

import { isLinuxDoDiscourseBase, uploadLinuxDoMultipart } from '@/utils/discourseUpload'
import type { MessageResponse } from '@/types/messages'

let nativeUploadQueue: Promise<unknown> = Promise.resolve()

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
    if (opts.nativeUpload === true) {
      if (new URL(url, window.location.href).origin !== window.location.origin) {
        sendResponse({ success: false, error: '原生上传目标必须与当前论坛同源' })
        return true
      }
      const upload = async () => {
        try {
          const result = await uploadThroughDiscourseRoute(file, 'composer')
          if (result.status === 'unavailable') {
            sendResponse({
              success: true,
              data: { ok: false, nativeUnavailable: true, data: { message: result.reason } }
            })
          } else if (result.status === 'uploaded') {
            sendResponse({ success: true, data: { ok: true, status: 200, data: result.upload } })
          } else {
            sendResponse({ success: false, error: '原生上传没有返回文件结果' })
          }
        } catch (error: any) {
          sendResponse({
            success: true,
            data: {
              ok: false,
              status: error?.status || 0,
              data: {
                message: error?.message || '原生上传失败',
                extras: error?.extras,
                error_type: error?.error_type
              }
            }
          })
        }
      }
      // Composer events identify files by name; serialize so equal names cannot cross-resolve.
      nativeUploadQueue = nativeUploadQueue.then(upload, upload)
      return true
    }
    const headers: Record<string, string> = {}
    const csrfToken = getCsrfTokenFromPage()
    if (csrfToken) headers['X-Csrf-Token'] = csrfToken

    if (isLinuxDoDiscourseBase(url)) {
      uploadLinuxDoMultipart({
        baseUrl: url,
        file,
        fileName: file.name,
        mimeType: file.type,
        csrfToken,
        headers,
        sha1: opts.sha1
      })
        .then(data => {
          const response: MessageResponse = {
            success: true,
            data: { status: 200, ok: true, data }
          }
          sendResponse(response)
        })
        .catch((error: any) => {
          const response: MessageResponse = {
            success: true,
            data: {
              status: error?.status || 0,
              ok: false,
              headers: error?.retryHeaders || {},
              data: error?.details || {
                message: error?.message || 'Page upload failed'
              }
            }
          }
          sendResponse(response)
        })

      return true
    }

    const form = new FormData()
    form.append('upload_type', 'composer')
    form.append('relativePath', 'null')
    form.append('name', file.name)
    form.append('type', file.type)
    if (opts.sha1) form.append('sha1_checksum', opts.sha1)
    form.append('file', file, file.name)

    fetch(url, {
      method: 'POST',
      headers,
      body: form,
      credentials: 'include'
    })
      .then(async res => {
        const text = await res.text()
        let data: unknown
        try {
          data = JSON.parse(text)
        } catch {
          data = { message: text }
        }
        const response: MessageResponse = {
          success: true,
          data: {
            status: res.status,
            ok: res.ok,
            data,
            headers: {
              'retry-after': res.headers.get('retry-after'),
              'cf-mitigated': res.headers.get('cf-mitigated')
            }
          }
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
