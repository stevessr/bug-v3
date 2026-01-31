import { DQS } from '../../utils/dom/createEl'

/**
 * 处理上传 blob 到 Discourse 的功能
 */
export function setupDiscourseUploadHandler() {
  if ((window as any).chrome?.runtime?.onMessage) {
    ;(window as any).chrome.runtime.onMessage.addListener(async (message: any) => {
      if (message && message.action === 'uploadBlobToDiscourse') {
        try {
          const filename = message.filename || 'image.jpg'
          const mimeType = message.mimeType || 'image/jpeg'
          const arrayBuffer = message.arrayBuffer

          if (!arrayBuffer) throw new Error('no arrayBuffer')

          const blob = new Blob([new Uint8Array(arrayBuffer)], { type: mimeType })
          const file = new File([blob], filename, { type: mimeType })

          // Build form and upload to current discourse host or provided discourseBase
          const base = message.discourseBase || window.location.origin
          const form = new FormData()
          form.append('upload_type', 'composer')
          form.append('relativePath', 'null')
          form.append('name', file.name)
          form.append('type', file.type)
          form.append('file', file, file.name)

          // CSRF token
          const meta = DQS('meta[name="csrf-token"]') as HTMLMetaElement | null
          const csrf = meta
            ? meta.content
            : (document.cookie.match(/csrf_token=([^;]+)/) || [])[1] || ''

          const headers: Record<string, string> = {}
          if (csrf) headers['X-Csrf-Token'] = csrf
          if (document.cookie) headers['Cookie'] = document.cookie

          const uploadUrl = `${base.replace(/\/$/, '')}/uploads.json?client_id=f06cb5577ba9410d94b9faf94e48c2d8`
          const resp = await fetch(uploadUrl, {
            method: 'POST',
            headers,
            body: form,
            credentials: 'include'
          })
          if (!resp.ok) {
            const data = await resp.json().catch(() => null)
            ;(window as any).chrome.runtime.sendMessage({
              type: 'UPLOAD_RESULT',
              success: false,
              details: data
            })
          } else {
            const data = await resp.json()
            ;(window as any).chrome.runtime.sendMessage({
              type: 'UPLOAD_RESULT',
              success: true,
              data
            })
          }
        } catch (e) {
          ;(window as any).chrome.runtime.sendMessage({
            type: 'UPLOAD_RESULT',
            success: false,
            error: String(e)
          })
        }
      }
    })
  }
}
