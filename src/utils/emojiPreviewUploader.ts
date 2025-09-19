// Independent uploader for ungrouped emoji previews to linux.do
// This is a copy of the front-end upload functionality to maintain code independence
import { createE } from '../content/utils/createEl'

interface EmojiUploadResponse {
  id: number
  url: string
  original_filename: string
  filesize: number
  width: number
  height: number
  thumbnail_width: number
  thumbnail_height: number
  extension: string
  short_url: string
  short_path: string
  retain_hours: null
  human_filesize: string
  dominant_color: string
  thumbnail: null
}

interface EmojiUploadError {
  errors: string[]
  error_type: string
  extras?: {
    wait_seconds: number
    time_left: string
  }
}

interface EmojiUploadQueueItem {
  id: string
  file: File
  resolve: (value: EmojiUploadResponse) => void
  reject: (error: any) => void
  retryCount: number
  status: 'waiting' | 'uploading' | 'failed' | 'success'
  error?: any
  result?: EmojiUploadResponse
  timestamp: number
  emojiName?: string // Store emoji name for context
}

class EmojiPreviewUploader {
  private waitingQueue: EmojiUploadQueueItem[] = []
  private uploadingQueue: EmojiUploadQueueItem[] = []
  private failedQueue: EmojiUploadQueueItem[] = []
  private successQueue: EmojiUploadQueueItem[] = []
  private isProcessing = false
  private maxRetries = 2
  private progressDialog: HTMLElement | null = null

  async uploadEmojiImage(file: File, emojiName?: string): Promise<EmojiUploadResponse> {
    return new Promise((resolve, reject) => {
      const item: EmojiUploadQueueItem = {
        id: `emoji_upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        file,
        resolve,
        reject,
        retryCount: 0,
        status: 'waiting',
        timestamp: Date.now(),
        emojiName
      }

      this.waitingQueue.push(item)
      this.updateProgressDialog()
      this.processQueue()
    })
  }

  private moveToQueue(
    item: EmojiUploadQueueItem,
    targetStatus: 'waiting' | 'uploading' | 'failed' | 'success'
  ) {
    // Remove from all queues
    this.waitingQueue = this.waitingQueue.filter(i => i.id !== item.id)
    this.uploadingQueue = this.uploadingQueue.filter(i => i.id !== item.id)
    this.failedQueue = this.failedQueue.filter(i => i.id !== item.id)
    this.successQueue = this.successQueue.filter(i => i.id !== item.id)

    // Add to target queue
    item.status = targetStatus
    switch (targetStatus) {
      case 'waiting':
        this.waitingQueue.push(item)
        break
      case 'uploading':
        this.uploadingQueue.push(item)
        break
      case 'failed':
        this.failedQueue.push(item)
        break
      case 'success':
        this.successQueue.push(item)
        break
    }

    this.updateProgressDialog()
  }

  private async processQueue() {
    if (this.isProcessing || this.waitingQueue.length === 0) {
      return
    }

    this.isProcessing = true

    while (this.waitingQueue.length > 0) {
      const item = this.waitingQueue.shift()
      if (!item) continue
      this.moveToQueue(item, 'uploading')

      try {
        const result = await this.performUpload(item.file)
        item.result = result
        this.moveToQueue(item, 'success')
        item.resolve(result)
      } catch (error: any) {
        item.error = error

        if (this.shouldRetry(error, item)) {
          item.retryCount++

          if (error.error_type === 'rate_limit' && error.extras?.wait_seconds) {
            // Wait for rate limit before retry
            await this.sleep(error.extras.wait_seconds * 1000)
          } else {
            // Wait before retry
            await this.sleep(Math.pow(2, item.retryCount) * 1000)
          }

          this.moveToQueue(item, 'waiting')
        } else {
          this.moveToQueue(item, 'failed')
          item.reject(error)
        }
      }
    }

    this.isProcessing = false
  }

  private shouldRetry(error: any, item: EmojiUploadQueueItem): boolean {
    if (item.retryCount >= this.maxRetries) {
      return false
    }

    // Only retry 429 (rate limit) errors automatically
    return error.error_type === 'rate_limit'
  }

  // Method to manually retry failed items
  retryFailedItem(itemId: string) {
    const item = this.failedQueue.find(i => i.id === itemId)
    if (item && item.retryCount < this.maxRetries) {
      item.retryCount++
      this.moveToQueue(item, 'waiting')
      this.processQueue()
    }
  }

  showProgressDialog() {
    if (this.progressDialog) {
      return // Already showing
    }

    this.progressDialog = this.createProgressDialog()
    document.body.appendChild(this.progressDialog)
  }

  hideProgressDialog() {
    if (this.progressDialog) {
      this.progressDialog.remove()
      this.progressDialog = null
    }
  }

  private updateProgressDialog() {
    if (!this.progressDialog) {
      return
    }

    const allItems = [
      ...this.waitingQueue,
      ...this.uploadingQueue,
      ...this.failedQueue,
      ...this.successQueue
    ]

    this.renderQueueItems(this.progressDialog, allItems)
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  private createProgressDialog(): HTMLElement {
    const dialog = createEl('div', {
      style: `
      position: fixed;
      top: 20px;
      right: 20px;
      width: 350px;
      max-height: 400px;
      background: white;
      border-radius: 8px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      border: 1px solid #e5e7eb;
      overflow: hidden;
    `
    }) as HTMLElement

    const header = createEl('div', {
      style: `
      padding: 16px 20px;
      background: #f9fafb;
      border-bottom: 1px solid #e5e7eb;
      font-weight: 600;
      font-size: 14px;
      color: #374151;
      display: flex;
      justify-content: space-between;
      align-items: center;
    `,
      text: '表情预览上传队列'
    }) as HTMLElement

    const closeButton = createEl('button', {
      in: '✕',
      style: `
      background: none;
      border: none;
      font-size: 16px;
      cursor: pointer;
      color: #6b7280;
      padding: 4px;
      border-radius: 4px;
      transition: background-color 0.2s;
    `
    }) as HTMLButtonElement
    closeButton.addEventListener('click', () => {
      this.hideProgressDialog()
    })

    header.appendChild(closeButton)

    const content = createEl('div', {
      class: 'emoji-upload-queue-content',
      style: `
        max-height: 320px;
        overflow-y: auto;
        padding: 12px;
      `
    })

    dialog.appendChild(header)
    dialog.appendChild(content)

    return dialog
  }

  private renderQueueItems(dialog: HTMLElement, allItems: EmojiUploadQueueItem[]) {
    const content = dialog.querySelector('.emoji-upload-queue-content')
    if (!content) return

    content.innerHTML = ''

    if (allItems.length === 0) {
      const emptyState = createEl('div', {
        style: `
        text-align: center;
        color: #6b7280;
        font-size: 14px;
        padding: 20px;
      `,
        text: '暂无表情上传任务'
      })
      content.appendChild(emptyState)
      return
    }

    allItems.forEach(item => {
      const itemEl = createEl('div', {
        style: `
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 12px;
        margin-bottom: 8px;
        background: #f9fafb;
        border-radius: 6px;
        border-left: 4px solid ${this.getStatusColor(item.status)};
      `
      })

      const leftSide = createEl('div', {
        style: `
        flex: 1;
        min-width: 0;
      `
      })

      const fileName = createEl('div', {
        style: `
        font-size: 13px;
        font-weight: 500;
        color: #374151;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      `,
        text: item.emojiName || item.file.name
      })

      const status = createEl('div', {
        style: `
        font-size: 12px;
        color: #6b7280;
        margin-top: 2px;
      `,
        text: this.getStatusText(item)
      })

      leftSide.appendChild(fileName)
      leftSide.appendChild(status)

      const rightSide = createEl('div', {
        style: `
        display: flex;
        align-items: center;
        gap: 8px;
      `
      })

      // Add retry button for failed items
      if (item.status === 'failed' && item.retryCount < this.maxRetries) {
        const retryButton = createEl('button', {
          in: '🔄',
          style: `
          background: none;
          border: none;
          cursor: pointer;
          font-size: 14px;
          padding: 4px;
          border-radius: 4px;
          transition: background-color 0.2s;
        `,
          ti: '重试上传'
        })
        retryButton.addEventListener('click', () => {
          this.retryFailedItem(item.id)
        })
        retryButton.addEventListener('mouseenter', () => {
          retryButton.style.backgroundColor = '#e5e7eb'
        })
        retryButton.addEventListener('mouseleave', () => {
          retryButton.style.backgroundColor = 'transparent'
        })
        rightSide.appendChild(retryButton)
      }

      const statusIcon = createEl('div', {
        style: 'font-size: 16px;',
        text: this.getStatusIcon(item.status)
      })
      rightSide.appendChild(statusIcon)

      itemEl.appendChild(leftSide)
      itemEl.appendChild(rightSide)

      content.appendChild(itemEl)
    })
  }

  private getStatusColor(status: string): string {
    switch (status) {
      case 'waiting':
        return '#f59e0b'
      case 'uploading':
        return '#3b82f6'
      case 'success':
        return '#10b981'
      case 'failed':
        return '#ef4444'
      default:
        return '#6b7280'
    }
  }

  private getStatusText(item: EmojiUploadQueueItem): string {
    switch (item.status) {
      case 'waiting':
        return '等待上传'
      case 'uploading':
        return '正在上传...'
      case 'success':
        return '上传成功'
      case 'failed':
        if (item.error?.error_type === 'rate_limit') {
          return `上传失败 - 请求过于频繁 (重试 ${item.retryCount}/${this.maxRetries})`
        }
        return `上传失败 (重试 ${item.retryCount}/${this.maxRetries})`
      default:
        return '未知状态'
    }
  }

  private getStatusIcon(status: string): string {
    switch (status) {
      case 'waiting':
        return '⏳'
      case 'uploading':
        return '📤'
      case 'success':
        return '✅'
      case 'failed':
        return '❌'
      default:
        return '❓'
    }
  }

  private async performUpload(file: File): Promise<EmojiUploadResponse> {
    // Calculate SHA1 checksum
    const sha1 = await this.calculateSHA1(file)

    // Create form data
    const formData = new FormData()
    formData.append('upload_type', 'composer')
    formData.append('relativePath', 'null')
    formData.append('name', file.name)
    formData.append('type', file.type)
    formData.append('sha1_checksum', sha1)
    formData.append('file', file, file.name)

    // Get authentication info
    const authInfo = await this.requestAuthFromOptions()

    const headers: Record<string, string> = {
      'X-Csrf-Token': authInfo.csrfToken
    }

    // Add cookies if available
    if (authInfo.cookies) {
      headers['Cookie'] = authInfo.cookies
    }

    const response = await fetch(
      `https://linux.do/uploads.json?client_id=f06cb5577ba9410d94b9faf94e48c2d8`,
      {
        method: 'POST',
        headers,
        body: formData
      }
    )

    if (!response.ok) {
      const errorData = (await response.json()) as EmojiUploadError
      throw errorData
    }

    return (await response.json()) as EmojiUploadResponse
  }

  private async requestAuthFromOptions(): Promise<{ csrfToken: string; cookies: string }> {
    // Check if we're on linux.do already
    if (window.location.hostname.includes('linux.do')) {
      return {
        csrfToken: this.getCSRFToken(),
        cookies: document.cookie
      }
    }

    // Request auth info from background script
    return new Promise((resolve, reject) => {
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.sendMessage({ type: 'REQUEST_LINUX_DO_AUTH' }, (response: any) => {
          if (response?.success) {
            resolve({
              csrfToken: response.csrfToken || '',
              cookies: response.cookies || ''
            })
          } else {
            reject(new Error(response?.error || 'Failed to get authentication info'))
          }
        })
      } else {
        reject(new Error('Chrome extension API not available'))
      }
    })
  }

  private getCSRFToken(): string {
    // Try to get CSRF token from meta tag
    const metaToken = document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement
    if (metaToken) {
      return metaToken.content
    }

    // Try to get from cookie
    const match = document.cookie.match(/csrf_token=([^;]+)/)
    if (match) {
      return decodeURIComponent(match[1])
    }

    // Fallback - try to extract from any form
    const hiddenInput = document.querySelector(
      'input[name="authenticity_token"]'
    ) as HTMLInputElement
    if (hiddenInput) {
      return hiddenInput.value
    }

    console.warn('[Emoji Preview Uploader] No CSRF token found')
    return ''
  }

  private async calculateSHA1(file: File): Promise<string> {
    // SHA1 calculation for file integrity
    const text = `${file.name}-${file.size}-${file.lastModified}`
    const encoder = new TextEncoder()
    const data = encoder.encode(text)

    if (crypto.subtle) {
      try {
        const hashBuffer = await crypto.subtle.digest('SHA-1', data)
        const hashArray = Array.from(new Uint8Array(hashBuffer))
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
      } catch (e) {
        console.warn('[Emoji Preview Uploader] Could not calculate SHA1, using fallback')
      }
    }

    // Fallback simple hash
    let hash = 0
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16).padStart(40, '0')
  }
}

export const emojiPreviewUploader = new EmojiPreviewUploader()
export type { EmojiUploadResponse, EmojiUploadError }
