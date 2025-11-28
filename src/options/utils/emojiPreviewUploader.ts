// Independent uploader for ungrouped emoji previews to linux.do
// This is a copy of the front-end upload functionality to maintain code independence
import { createElement } from './createElement'
import { uploadServices } from '@/utils/uploadServices'

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
  resolve: (_value: EmojiUploadResponse) => void
  reject: (_error: any) => void
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
      } catch (_error: any) {
        item.error = _error

        if (this.shouldRetry(_error, item)) {
          item.retryCount++

          if (_error.error_type === 'rate_limit' && _error.extras?.wait_seconds) {
            // Wait for rate limit before retry
            await this.sleep(_error.extras.wait_seconds * 1000)
          } else {
            // Wait before retry
            await this.sleep(Math.pow(2, item.retryCount) * 1000)
          }

          this.moveToQueue(item, 'waiting')
        } else {
          this.moveToQueue(item, 'failed')
          item.reject(_error)
        }
      }
    }

    this.isProcessing = false
  }

  private shouldRetry(_error: any, item: EmojiUploadQueueItem): boolean {
    if (item.retryCount >= this.maxRetries) {
      return false
    }

    // Only retry 429 (rate limit) errors automatically
    return _error.error_type === 'rate_limit'
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
    const dialog = createElement('div', {
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

    const header = createElement('div', {
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

    const closeButton = createElement('button', {
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

    const content = createElement('div', {
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
      const emptyState = createElement('div', {
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
      const itemEl = createElement('div', {
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

      const leftSide = createElement('div', {
        style: `
        flex: 1;
        min-width: 0;
      `
      })

      const fileName = createElement('div', {
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

      const status = createElement('div', {
        style: `
        font-size: 12px;
        color: #6b7280;
        margin-top: 2px;
      `,
        text: this.getStatusText(item)
      })

      leftSide.appendChild(fileName)
      leftSide.appendChild(status)

      const rightSide = createElement('div', {
        style: `
        display: flex;
        align-items: center;
        gap: 8px;
      `
      })

      // Add retry button for failed items
      if (item.status === 'failed' && item.retryCount < this.maxRetries) {
        const retryButton = createElement('button', {
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

      const statusIcon = createElement('div', {
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
    try {
      // Use the upload service for linux.do
      const url = await uploadServices['linux.do'].uploadFile(file)

      // Convert to expected response format
      return {
        id: Date.now(),
        url: url,
        original_filename: file.name,
        filesize: file.size,
        width: 0, // Not available from upload service
        height: 0, // Not available from upload service
        thumbnail_width: 0,
        thumbnail_height: 0,
        extension: file.name.split('.').pop() || '',
        short_url: url,
        short_path: url,
        retain_hours: null,
        human_filesize: this.formatFileSize(file.size),
        dominant_color: '',
        thumbnail: null
      }
    } catch (error: any) {
      // Convert error to expected format
      throw {
        errors: [error.message || 'Upload failed'],
        error_type: error.error_type || 'upload_failed'
      }
    }
  }

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }
}

export const emojiPreviewUploader = new EmojiPreviewUploader()
export type { EmojiUploadResponse, EmojiUploadError }
