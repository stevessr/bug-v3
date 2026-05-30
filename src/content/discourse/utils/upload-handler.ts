import { DQS } from '../../utils/dom/createEl'

import { isLinuxDoDiscourseBase, uploadLinuxDoMultipart } from '@/utils/discourseUpload'

let discourseUploadHandlerInitialized = false

function sendUploadResult(message: Record<string, unknown>) {
  try {
    ;(window as any).chrome?.runtime?.sendMessage(message)
  } catch (error) {
    console.warn('[DiscourseUpload] failed to send upload result', error)
  }
}

/**
 * 处理上传 blob 到 Discourse 的功能
 */
export function setupDiscourseUploadHandler() {
  const chromeAPI = (window as any).chrome
  if (!chromeAPI?.runtime?.onMessage || discourseUploadHandlerInitialized) return

  discourseUploadHandlerInitialized = true

  // Do not make this listener `async`: Promise-returning listeners can claim unrelated
  // messages (for example PAGE_UPLOAD) with an undefined response before the real
  // handler sends the upload result.
  chromeAPI.runtime.onMessage.addListener((message: any, _sender: any, sendResponse: any) => {
    if (!message || message.action !== 'uploadBlobToDiscourse') {
      return false
    }

    const requestId = message.requestId || null
    sendResponse?.({ success: true, accepted: true, requestId })

    void (async () => {
      try {
        const filename = message.filename || 'image.jpg'
        const mimeType = message.mimeType || 'image/jpeg'
        const arrayBuffer = message.arrayBuffer

        if (!arrayBuffer) throw new Error('no arrayBuffer')

        const blob = new Blob([new Uint8Array(arrayBuffer)], { type: mimeType })
        const file = new File([blob], filename, { type: mimeType })

        const base = message.discourseBase || window.location.origin

        // CSRF token
        const meta = DQS('meta[name="csrf-token"]') as HTMLMetaElement | null
        const csrf = meta
          ? meta.content
          : (document.cookie.match(/csrf_token=([^;]+)/) || [])[1] || ''

        const headers: Record<string, string> = {}
        if (csrf) headers['X-Csrf-Token'] = csrf
        if (document.cookie) headers['Cookie'] = document.cookie

        if (isLinuxDoDiscourseBase(base)) {
          const data = await uploadLinuxDoMultipart({
            baseUrl: base,
            file,
            fileName: file.name,
            mimeType: file.type,
            csrfToken: csrf,
            headers
          })

          sendUploadResult({
            type: 'UPLOAD_RESULT',
            details: data,
            data,
            success: true,
            requestId
          })
          return
        }

        const form = new FormData()
        form.append('upload_type', 'composer')
        form.append('relativePath', 'null')
        form.append('name', file.name)
        form.append('type', file.type)
        form.append('file', file, file.name)

        const uploadUrl = `${base.replace(/\/$/, '')}/uploads.json?client_id=f06cb5577ba9410d94b9faf94e48c2d8`
        const resp = await fetch(uploadUrl, {
          method: 'POST',
          headers,
          body: form,
          credentials: 'include'
        })
        if (!resp.ok) {
          const data = await resp.json().catch(() => null)
          sendUploadResult({
            type: 'UPLOAD_RESULT',
            success: false,
            details: data,
            requestId
          })
        } else {
          const data = await resp.json()
          sendUploadResult({
            type: 'UPLOAD_RESULT',
            success: true,
            data,
            requestId
          })
        }
      } catch (e: any) {
        sendUploadResult({
          type: 'UPLOAD_RESULT',
          success: false,
          error: e?.message || String(e),
          details: e?.details,
          requestId
        })
      }
    })()

    return false
  })
}
