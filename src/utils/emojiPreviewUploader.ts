// Independent uploader for ungrouped emoji previews to linux.do
// This is a copy of the front-end upload functionality to maintain code independence

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
    const dialog = document.createElement('div')
    dialog.style.cssText = `
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

    const header = document.createElement('div')
    header.style.cssText = `
      padding: 16px 20px;
      background: #f9fafb;
      border-bottom: 1px solid #e5e7eb;
      font-weight: 600;
      font-size: 14px;
      color: #374151;
      display: flex;
      justify-content: space-between;
      align-items: center;
    `
    header.textContent = '表情预览上传队列'

    const closeButton = document.createElement('button')
    closeButton.innerHTML = '✕'
    closeButton.style.cssText = `
      background: none;
      border: none;
      font-size: 16px;
      cursor: pointer;
      color: #6b7280;
      padding: 4px;
      border-radius: 4px;
      transition: background-color 0.2s;
    `
    closeButton.addEventListener('click', () => {
      this.hideProgressDialog()
    })

    header.appendChild(closeButton)

    const content = document.createElement('div')
    content.className = 'emoji-upload-queue-content'
    content.style.cssText = `
      max-height: 320px;
      overflow-y: auto;
      padding: 12px;
    `

    dialog.appendChild(header)
    dialog.appendChild(content)

    return dialog
  }

  private renderQueueItems(dialog: HTMLElement, allItems: EmojiUploadQueueItem[]) {
    // Simplified implementation for now
    const content = dialog.querySelector('.emoji-upload-queue-content')
    if (!content) return

    content.innerHTML = ''
    if (allItems.length === 0) {
      content.textContent = '暂无表情上传任务'
    } else {
      content.textContent = `${allItems.length} 个上传任务`
    }
  }

  private async performUpload(file: File): Promise<EmojiUploadResponse> {
    // Simplified upload implementation
    throw new Error('Upload not implemented in this simplified version')
  }
}

export const emojiPreviewUploader = new EmojiPreviewUploader()
export type { EmojiUploadResponse, EmojiUploadError }
