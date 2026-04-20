import { ref } from 'vue'

import { normalizeDiscourseUploadUrl } from '@/utils/discourseUpload'
import { buildMarkdownImage, getPreferredEmojiMarkdownUrl } from '@/utils/emojiMarkdown'

type UploadResponse = {
  url?: string
  short_url?: string
  width?: number
  height?: number
}

type UseDiscourseUploadOptions = {
  baseUrl?: string
  inputFormat: () => 'markdown' | 'bbcode' | 'html'
  onInsertText: (text: string) => void
}

export function useDiscourseUpload(options: UseDiscourseUploadOptions) {
  const fileInputRef = ref<HTMLInputElement | null>(null)
  const isUploading = ref(false)

  const escapeAttr = (value: string) =>
    value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  const buildImageMarkup = (upload: { url: string; short_url?: string }, alt: string) => {
    const safeUrl = upload.url
    if (options.inputFormat() === 'html') {
      return `<img src="${escapeAttr(safeUrl)}" alt="${escapeAttr(alt || 'image')}" />`
    }
    if (options.inputFormat() === 'markdown') {
      return buildMarkdownImage(alt || 'image', upload)
    }
    return `[img]${safeUrl}[/img]`
  }

  const buildFileMarkup = (upload: { url: string; short_url?: string }, filename?: string) => {
    const safeUrl = upload.url
    const label = filename || safeUrl
    if (options.inputFormat() === 'html') {
      const safeLabel = escapeAttr(label)
      return `<a href="${escapeAttr(
        safeUrl
      )}" target="_blank" rel="nofollow noopener">${safeLabel}</a>`
    }
    if (options.inputFormat() === 'markdown') {
      return `[${label}](${getPreferredEmojiMarkdownUrl(upload) || safeUrl})`
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
          reject(
            new Error(
              message.error ||
                message.details?.error ||
                message.details?.message ||
                message.details?.errors?.join?.(', ') ||
                '上传失败'
            )
          )
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
    try {
      await uploadFile(file)
    } catch (error) {
      console.error('Upload failed:', error)
    } finally {
      isUploading.value = false
      input.value = ''
    }
  }

  const uploadFile = async (file: File) => {
    isUploading.value = true
    const arrayBuffer = await file.arrayBuffer()
    const response = await sendUploadMessage({
      filename: file.name,
      mimeType: file.type || 'application/octet-stream',
      arrayBuffer,
      discourseBase: options.baseUrl
    })
    const normalizedUrl = normalizeDiscourseUploadUrl(options.baseUrl, response)
    if (!normalizedUrl) {
      throw new Error('上传成功，但未返回 URL')
    }
    const upload = {
      url: normalizedUrl,
      short_url: response.short_url
    }
    const isImage = file.type.startsWith('image/')
    const alt =
      isImage && response.width && response.height
        ? `${file.name}|${response.width}x${response.height}`
        : file.name || 'image'
    const markup = isImage ? buildImageMarkup(upload, alt) : buildFileMarkup(upload, file.name)
    options.onInsertText(markup)
  }

  return {
    fileInputRef,
    isUploading,
    handleUploadClick,
    handleUploadChange,
    uploadFile
  }
}
