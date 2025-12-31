import { DQS } from '../createEl'
import { notify } from '../notify'

import { insertIntoEditor } from './helpers'

export interface UploadResponse {
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

export interface UploadError {
  errors: string[]
  error_type: string
  extras?: {
    wait_seconds: number
    time_left: string
  }
}

export interface UploadQueueItem {
  id: string
  file: File
  originalFilename: string // Store original filename separately

  resolve: (value: UploadResponse) => void

  reject: (error: any) => void
  retryCount: number
  status: 'waiting' | 'uploading' | 'failed' | 'success'
  error?: any
  result?: UploadResponse
  timestamp: number
}

export class ImageUploader {
  private waitingQueue: UploadQueueItem[] = []
  private uploadingQueue: UploadQueueItem[] = []
  private failedQueue: UploadQueueItem[] = []
  private successQueue: UploadQueueItem[] = []
  private isProcessing = false
  private maxRetries = 2 // Second failure stops retry

  async uploadImage(file: File): Promise<UploadResponse> {
    return new Promise((resolve, reject) => {
      const item: UploadQueueItem = {
        id: `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        file,
        originalFilename: file.name, // Store the original filename
        resolve,
        reject,
        retryCount: 0,
        status: 'waiting',
        timestamp: Date.now()
      }

      this.waitingQueue.push(item)
      this.processQueue()
    })
  }

  private moveToQueue(
    item: UploadQueueItem,
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

        // Insert into editor using the original client filename to avoid issues with server-renamed files
        const markdown = `![${item.originalFilename}](${result.url})`
        insertIntoEditor(markdown)
      } catch (_error: any) {
        item.error = _error

        if (this.shouldRetry(_error, item)) {
          item.retryCount++

          if (_error.error_type === 'rate_limit' && _error.extras?.wait_seconds) {
            const waitSeconds = _error.extras.wait_seconds
            notify(`遇到限流，将等待 ${waitSeconds} 秒后重试...`, 'error')

            // Countdown notifications every second
            let remainingSeconds = waitSeconds
            const countdownInterval = setInterval(() => {
              remainingSeconds--
              if (remainingSeconds > 0) {
                notify(`正在等待限流解除，剩余 ${remainingSeconds} 秒...`, 'info')
              } else {
                clearInterval(countdownInterval)
                notify('限流等待结束，继续上传...', 'success')
              }
            }, 1000)

            // Wait for rate limit before retry
            await this.sleep(waitSeconds * 1000)
            this.moveToQueue(item, 'waiting')
          } else {
            // Wait before retry
            await this.sleep(Math.pow(2, item.retryCount) * 1000)
            this.moveToQueue(item, 'waiting')
          }
        } else {
          this.moveToQueue(item, 'failed')
          item.reject(_error)
        }
      }
    }

    this.isProcessing = false
  }

  private shouldRetry(_error: any, item: UploadQueueItem): boolean {
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

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  private async performUpload(file: File): Promise<UploadResponse> {
    // Calculate SHA1 checksum (simplified - using a placeholder)
    const sha1 = await this.calculateSHA1(file)

    // Create form data
    const formData = new FormData()
    formData.append('upload_type', 'composer')
    formData.append('relativePath', 'null')
    formData.append('name', file.name)
    formData.append('type', file.type)
    formData.append('sha1_checksum', sha1)
    formData.append('file', file, file.name)

    // Get CSRF token from meta tag or cookie
    const csrfToken = this.getCSRFToken()

    const headers: Record<string, string> = {
      'X-Csrf-Token': csrfToken
    }

    // Add cookies if available
    if (document.cookie) {
      headers['Cookie'] = document.cookie
    }

    const response = await fetch(
      window.location.origin +
        `/uploads.json?client_id=` +
        (window.location.host === 'linux.do'
          ? 'f06cb5577ba9410d94b9faf94e48c2d8'
          : 'b9cdb79908284b25925d62befbff3921'),
      {
        method: 'POST',
        headers,
        body: formData
      }
    )

    if (!response.ok) {
      const errorData = (await response.json()) as UploadError
      throw errorData
    }

    return (await response.json()) as UploadResponse
  }

  private getCSRFToken(): string {
    // Try to get CSRF token from meta tag
    const metaToken = DQS('meta[name="csrf-token"]') as HTMLMetaElement
    if (metaToken) {
      return metaToken.content
    }

    // Try to get from cookie
    const match = document.cookie.match(/csrf_token=([^;]+)/)
    if (match) {
      return decodeURIComponent(match[1])
    }

    // Fallback - try to extract from any form
    const hiddenInput = DQS('input[name="authenticity_token"]') as HTMLInputElement
    if (hiddenInput) {
      return hiddenInput.value
    }

    console.warn('[Image Uploader] No CSRF token found')
    return ''
  }

  private async calculateSHA1(file: File): Promise<string> {
    // Simplified SHA1 calculation - in a real implementation, you'd use crypto.subtle
    // For now, return a placeholder based on file properties
    const text = `${file.name}-${file.size}-${file.lastModified}`
    const encoder = new TextEncoder()
    const data = encoder.encode(text)

    if (crypto.subtle) {
      try {
        const hashBuffer = await crypto.subtle.digest('SHA-1', data)
        const hashArray = Array.from(new Uint8Array(hashBuffer))
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
      } catch {
        console.warn('[Image Uploader] Could not calculate SHA1, using fallback')
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

export const uploader = new ImageUploader()
