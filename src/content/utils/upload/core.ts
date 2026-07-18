import { getCsrfTokenFromPage } from '../dom'
import { notify } from '../ui/notify'

import {
  uploadThroughDiscourseRoute,
  type DiscourseUploadRouteContext
} from '@/content/discourse/utils/nativeUpload'
import {
  isLinuxDoDiscourseBase,
  normalizeDiscourseUploadUrl,
  uploadLinuxDoMultipart
} from '@/utils/discourseUpload'

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
  /** Chat owns the attachment and insertion after the file is handed off. */
  handledByDiscourseRoute?: boolean
}

export interface UploadError {
  errors: string[]
  error_type: string
  extras?: {
    wait_seconds: number
    time_left: string
  }
  status?: number
  shouldTerminateUploadFlow?: boolean
  message?: string
}

export interface UploadQueueItem {
  id: string
  file: File
  originalFilename: string // Store original filename separately
  routeContext: DiscourseUploadRouteContext

  resolve: (value: UploadResponse) => void

  reject: (error: any) => void
  retryCount: number
  status: 'waiting' | 'uploading' | 'failed' | 'success'
  error?: any
  result?: UploadResponse
  timestamp: number
  onStatusChange?: UploadStatusListener
}

export type UploadQueueStatus = UploadQueueItem['status']

export interface UploadStatusUpdate {
  id: string
  file: File
  status: UploadQueueStatus
  retryCount: number
  error?: any
  waitSeconds?: number
  waitUntil?: number
}

export type UploadStatusListener = (update: UploadStatusUpdate) => void

const DEFAULT_RATE_LIMIT_WAIT_SECONDS = 5

export class ImageUploader {
  private waitingQueue: UploadQueueItem[] = []
  private uploadingQueue: UploadQueueItem[] = []
  private failedQueue: UploadQueueItem[] = []
  private successQueue: UploadQueueItem[] = []
  private isProcessing = false
  private maxRetries = 2 // Two automatic retries after the initial attempt
  private rateLimitUntil = 0
  private rateLimitTimer: ReturnType<typeof setTimeout> | null = null

  async uploadImage(
    file: File,
    routeContext: DiscourseUploadRouteContext = 'auto',
    onStatusChange?: UploadStatusListener
  ): Promise<UploadResponse> {
    return new Promise((resolve, reject) => {
      const item: UploadQueueItem = {
        id: `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        file,
        originalFilename: file.name, // Store the original filename
        routeContext,
        resolve,
        reject,
        retryCount: 0,
        status: 'waiting',
        timestamp: Date.now(),
        onStatusChange
      }

      this.waitingQueue.push(item)
      this.emitStatus(item)
      this.processQueue()
    })
  }

  private moveToQueue(
    item: UploadQueueItem,
    targetStatus: UploadQueueStatus,
    options: { front?: boolean; waitSeconds?: number; waitUntil?: number } = {}
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
        if (options.front) {
          this.waitingQueue.unshift(item)
        } else {
          this.waitingQueue.push(item)
        }
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

    this.emitStatus(item, options)
  }

  private emitStatus(
    item: UploadQueueItem,
    options: { waitSeconds?: number; waitUntil?: number } = {}
  ): void {
    try {
      item.onStatusChange?.({
        id: item.id,
        file: item.file,
        status: item.status,
        retryCount: item.retryCount,
        error: item.error,
        waitSeconds: options.waitSeconds,
        waitUntil: options.waitUntil
      })
    } catch (error) {
      console.warn('[Image Uploader] Upload status listener failed', error)
    }
  }

  private emitWaitingStatus(waitSeconds: number, waitUntil: number, excludedItemId?: string): void {
    for (const item of this.waitingQueue) {
      if (item.id === excludedItemId) continue
      this.emitStatus(item, { waitSeconds, waitUntil })
    }
  }

  private processQueue(): void {
    if (this.isProcessing || this.waitingQueue.length === 0) {
      return
    }

    const remainingWait = this.rateLimitUntil - Date.now()
    if (remainingWait > 0) {
      this.scheduleRateLimitResume()
      return
    }

    this.clearRateLimitTimer()
    this.rateLimitUntil = 0

    const item = this.waitingQueue.shift()
    if (!item) return

    this.isProcessing = true
    this.moveToQueue(item, 'uploading')
    void this.uploadItem(item)
  }

  private async uploadItem(item: UploadQueueItem): Promise<void> {
    try {
      const result = await this.performUpload(item.file, item.routeContext)
      item.result = result
      item.error = undefined
      this.moveToQueue(item, 'success')
      item.resolve(result)
    } catch (_error: any) {
      item.error = _error

      if (this.shouldTerminateUploadFlow(_error)) {
        this.moveToQueue(item, 'failed')
        item.reject(_error)
        this.terminatePendingUploads(_error)
        notify('上传队列已终止，后续文件保留为失败项。', 'error')
        return
      }

      if (this.isRateLimitError(_error)) {
        const willRetryCurrentItem = this.shouldRetry(_error, item)
        if (willRetryCurrentItem) item.retryCount++

        const waitSeconds = this.getRateLimitWaitSeconds(_error)
        const waitUntil = Date.now() + waitSeconds * 1000
        this.rateLimitUntil = Math.max(this.rateLimitUntil, waitUntil)

        if (willRetryCurrentItem) {
          // Put the failed item back at the head immediately. The whole batch
          // is now visibly waiting; no later file is allowed to probe
          // Discourse and fail one-by-one while the limit is active.
          this.moveToQueue(item, 'waiting', { front: true, waitSeconds, waitUntil })
        } else {
          // Even after this item exhausts its retries, retain the same cooldown
          // for the remaining queue instead of immediately probing the next
          // file against a limit that is still known to be active.
          this.moveToQueue(item, 'failed')
          item.reject(_error)
        }

        this.emitWaitingStatus(waitSeconds, waitUntil, willRetryCurrentItem ? item.id : undefined)
        this.scheduleRateLimitResume()
        notify(
          willRetryCurrentItem
            ? `遇到限流，上传队列将等待 ${Math.ceil(waitSeconds)} 秒后继续...`
            : `当前文件已达到重试上限，其余文件将继续等待 ${Math.ceil(waitSeconds)} 秒...`,
          'info'
        )
        return
      }

      this.moveToQueue(item, 'failed')
      item.reject(_error)
    } finally {
      this.isProcessing = false
      this.processQueue()
    }
  }

  private getRateLimitWaitSeconds(error: any): number {
    const candidates = [
      error?.extras?.wait_seconds,
      error?.wait_seconds,
      error?.waitSeconds,
      error?.retryAfterSeconds
    ]

    for (const candidate of candidates) {
      const seconds = Number(candidate)
      if (Number.isFinite(seconds) && seconds > 0) return seconds
    }

    return DEFAULT_RATE_LIMIT_WAIT_SECONDS
  }

  private scheduleRateLimitResume(): void {
    const remainingWait = this.rateLimitUntil - Date.now()
    if (remainingWait <= 0) {
      this.clearRateLimitTimer()
      this.rateLimitUntil = 0
      this.processQueue()
      return
    }

    this.clearRateLimitTimer()
    this.rateLimitTimer = setTimeout(() => {
      this.rateLimitTimer = null
      if (Date.now() < this.rateLimitUntil) {
        this.scheduleRateLimitResume()
        return
      }

      this.rateLimitUntil = 0
      notify('限流等待结束，继续上传...', 'success')
      this.processQueue()
    }, remainingWait + 20)
  }

  private clearRateLimitTimer(): void {
    if (this.rateLimitTimer !== null) {
      clearTimeout(this.rateLimitTimer)
      this.rateLimitTimer = null
    }
  }

  private shouldTerminateUploadFlow(error: any): boolean {
    return Boolean(error?.shouldTerminateUploadFlow && !this.isRateLimitError(error))
  }

  private terminatePendingUploads(error: any) {
    const pendingItems = [...this.waitingQueue]
    for (const pendingItem of pendingItems) {
      pendingItem.error = error
      this.moveToQueue(pendingItem, 'failed')
      pendingItem.reject(error)
    }
  }

  private shouldRetry(_error: any, item: UploadQueueItem): boolean {
    if (item.retryCount >= this.maxRetries) {
      return false
    }

    // Only retry 429 (rate limit) errors automatically. A missing Retry-After
    // no longer causes every file in a batch to be attempted in sequence; the
    // queue uses a conservative fallback wait instead.
    return this.isRateLimitError(_error)
  }

  private isRateLimitError(error: any): boolean {
    return error?.error_type === 'rate_limit' || error?.status === 429
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

  // Get snapshot of failed items
  getFailedItems(): UploadQueueItem[] {
    return [...this.failedQueue]
  }

  // Retry all failed items
  retryAllFailed() {
    const items = [...this.failedQueue]
    for (const item of items) {
      if (item.retryCount < this.maxRetries) {
        item.retryCount++
        this.moveToQueue(item, 'waiting')
      }
    }
    if (items.length > 0) {
      this.processQueue()
    }
  }

  // Upload a File created from a remote download (via fetch)
  async uploadDownloadedFile(
    blob: Blob,
    filename: string,
    routeContext: DiscourseUploadRouteContext = 'auto'
  ): Promise<UploadResponse> {
    const file = new File([blob], filename, { type: blob.type })
    return this.uploadImage(file, routeContext)
  }

  private async performUpload(
    file: File,
    routeContext: DiscourseUploadRouteContext
  ): Promise<UploadResponse> {
    const nativeAttempt = await uploadThroughDiscourseRoute(file, routeContext)
    if (nativeAttempt.status === 'uploaded') {
      return this.normalizeNativeUpload(file, nativeAttempt.upload)
    }
    if (nativeAttempt.status === 'delegated') {
      return this.createDelegatedChatResult(file)
    }

    const csrfToken = this.getCSRFToken()
    if (isLinuxDoDiscourseBase(window.location.origin)) {
      return (await uploadLinuxDoMultipart({
        baseUrl: window.location.origin,
        file,
        fileName: file.name,
        mimeType: file.type,
        csrfToken
      })) as UploadResponse
    }

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
      const rawErrorText = await response.text().catch(() => '')
      let errorData: UploadError | { message?: string } | null = null
      if (rawErrorText) {
        try {
          errorData = JSON.parse(rawErrorText) as UploadError
        } catch {
          errorData = { message: rawErrorText }
        }
      }

      if (response.status === 429 && !(errorData as UploadError | null)?.extras?.wait_seconds) {
        throw {
          errors: ['Upload paused after receiving a bare 429 response.'],
          error_type: 'rate_limit',
          status: 429,
          shouldTerminateUploadFlow: false,
          message: 'Upload paused after receiving a bare 429 response.'
        } satisfies UploadError
      }

      const normalizedError: UploadError = {
        errors:
          Array.isArray((errorData as UploadError | null)?.errors) &&
          (errorData as UploadError).errors.length > 0
            ? (errorData as UploadError).errors
            : [((errorData as { message?: string } | null)?.message || 'Upload failed').trim()],
        error_type: (errorData as UploadError | null)?.error_type || 'upload_failed',
        extras: (errorData as UploadError | null)?.extras,
        status: response.status,
        shouldTerminateUploadFlow: false,
        message: (errorData as { message?: string } | null)?.message
      }
      throw normalizedError
    }

    const data = (await response.json()) as UploadResponse
    return {
      ...data,
      url: normalizeDiscourseUploadUrl(window.location.origin, data) || data.url
    }
  }

  private normalizeNativeUpload(file: File, payload: Record<string, unknown>): UploadResponse {
    const normalizedUrl = normalizeDiscourseUploadUrl(window.location.origin, payload)
    if (!normalizedUrl) {
      throw new Error('Discourse native uploader returned a result without a URL')
    }

    const numberValue = (value: unknown, fallback = 0) =>
      typeof value === 'number' && Number.isFinite(value) ? value : fallback
    const stringValue = (value: unknown, fallback = '') =>
      typeof value === 'string' ? value : fallback
    const extensionFallback = file.name.includes('.') ? file.name.split('.').pop() || '' : ''

    return {
      id: numberValue(payload.id),
      url: normalizedUrl,
      original_filename: stringValue(payload.original_filename, file.name),
      filesize: numberValue(payload.filesize, file.size),
      width: numberValue(payload.width),
      height: numberValue(payload.height),
      thumbnail_width: numberValue(payload.thumbnail_width),
      thumbnail_height: numberValue(payload.thumbnail_height),
      extension: stringValue(payload.extension, extensionFallback),
      short_url: stringValue(payload.short_url),
      short_path: stringValue(payload.short_path),
      retain_hours: null,
      human_filesize: stringValue(payload.human_filesize),
      dominant_color: stringValue(payload.dominant_color),
      thumbnail: null
    }
  }

  private createDelegatedChatResult(file: File): UploadResponse {
    const extension = file.name.includes('.') ? file.name.split('.').pop() || '' : ''
    return {
      id: 0,
      url: '',
      original_filename: file.name,
      filesize: file.size,
      width: 0,
      height: 0,
      thumbnail_width: 0,
      thumbnail_height: 0,
      extension,
      short_url: '',
      short_path: '',
      retain_hours: null,
      human_filesize: '',
      dominant_color: '',
      thumbnail: null,
      handledByDiscourseRoute: true
    }
  }

  private getCSRFToken(): string {
    const token = getCsrfTokenFromPage()
    if (!token) {
      console.warn('[Image Uploader] No CSRF token found')
    }
    return token
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
