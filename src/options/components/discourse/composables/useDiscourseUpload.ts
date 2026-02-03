import { ref } from 'vue'

type UploadResponse = {
  url?: string
  short_url?: string
}

type UseDiscourseUploadOptions = {
  baseUrl?: string
  inputFormat: () => 'markdown' | 'bbcode'
  onInsertText: (text: string) => void
}

export function useDiscourseUpload(options: UseDiscourseUploadOptions) {
  const fileInputRef = ref<HTMLInputElement | null>(null)
  const isUploading = ref(false)

  const buildImageMarkup = (url: string, filename?: string) => {
    const safeUrl = url
    if (options.inputFormat() === 'markdown') {
      const alt = filename || 'image'
      return `![${alt}](${safeUrl})`
    }
    return `[img]${safeUrl}[/img]`
  }

  const buildFileMarkup = (url: string, filename?: string) => {
    const safeUrl = url
    const label = filename || safeUrl
    if (options.inputFormat() === 'markdown') {
      return `[${label}](${safeUrl})`
    }
    return `[url=${safeUrl}]${label}[/url]`
  }

  const handleUploadClick = () => {
    fileInputRef.value?.click()
  }

  const sendUploadMessage = (payload: {
    filename: string
    mimeType: string
    arrayBuffer: ArrayBuffer
    discourseBase?: string
  }) => {
    const chromeAPI = (globalThis as any).chrome
    if (!chromeAPI?.tabs?.query || !chromeAPI?.runtime?.onMessage) {
      return Promise.reject(new Error('上传不可用：缺少 chrome 扩展 API'))
    }

    const requestId = `upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    return new Promise<UploadResponse>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        chromeAPI.runtime.onMessage.removeListener(onMessage)
        reject(new Error('上传超时'))
      }, 30000)

      const onMessage = (message: any) => {
        if (message?.type !== 'UPLOAD_RESULT' || message?.requestId !== requestId) return
        window.clearTimeout(timeout)
        chromeAPI.runtime.onMessage.removeListener(onMessage)
        if (message.success) {
          resolve(message.data)
        } else {
          reject(new Error(message.error || message.details?.error || '上传失败'))
        }
      }

      chromeAPI.runtime.onMessage.addListener(onMessage)

      chromeAPI.tabs.query({ active: true, currentWindow: true }, (tabs: any[]) => {
        const tabId = tabs?.[0]?.id
        if (!tabId) {
          window.clearTimeout(timeout)
          chromeAPI.runtime.onMessage.removeListener(onMessage)
          reject(new Error('未找到激活的标签页'))
          return
        }
        chromeAPI.tabs.sendMessage(
          tabId,
          {
            action: 'uploadBlobToDiscourse',
            requestId,
            filename: payload.filename,
            mimeType: payload.mimeType,
            arrayBuffer: payload.arrayBuffer,
            discourseBase: payload.discourseBase
          },
          () => {
            const err = chromeAPI.runtime?.lastError
            if (err) {
              window.clearTimeout(timeout)
              chromeAPI.runtime.onMessage.removeListener(onMessage)
              reject(new Error(err.message || '上传失败'))
            }
          }
        )
      })
    })
  }

  const handleUploadChange = async (event: Event) => {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return
    isUploading.value = true
    try {
      const arrayBuffer = await file.arrayBuffer()
      const response = await sendUploadMessage({
        filename: file.name,
        mimeType: file.type || 'application/octet-stream',
        arrayBuffer,
        discourseBase: options.baseUrl
      })
      const url =
        response?.url && response.url.startsWith('http')
          ? response.url
          : response?.url
            ? `${options.baseUrl?.replace(/\\$/, '')}${response.url}`
            : response?.short_url || ''
      if (!url) {
        throw new Error('上传成功，但未返回 URL')
      }
      const isImage = file.type.startsWith('image/')
      const markup = isImage ? buildImageMarkup(url, file.name) : buildFileMarkup(url, file.name)
      options.onInsertText(markup)
    } catch (error) {
      console.error('Upload failed:', error)
    } finally {
      isUploading.value = false
      input.value = ''
    }
  }

  return {
    fileInputRef,
    isUploading,
    handleUploadClick,
    handleUploadChange
  }
}
