interface UploadQueueItem {
  id: string
  file: File
  status: 'waiting' | 'uploading' | 'success' | 'failed'
  progress: number
  result?: any
  error?: any
  retryCount: number
  timestamp: number
  resolve?: (value: any) => void
  reject?: (reason: any) => void
}

class UploadQueue {
  private queue: UploadQueueItem[] = []
  private processing = false
  private maxRetries = 3
  private concurrency = 2
  private activeUploads = 0

  async addToQueue(file: File): Promise<any> {
    return new Promise((resolve, reject) => {
      const item: UploadQueueItem = {
        id: `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        file,
        status: 'waiting',
        progress: 0,
        retryCount: 0,
        timestamp: Date.now(),
        resolve,
        reject
      }

      this.queue.push(item)
      this.updateProgressUI()
      this.processQueue()
    })
  }

  private async processQueue() {
    if (this.processing || this.activeUploads >= this.concurrency) {
      return
    }

    const nextItem = this.queue.find(item => item.status === 'waiting')
    if (!nextItem) {
      return
    }

    this.processing = true
    this.activeUploads++
    nextItem.status = 'uploading'
    this.updateProgressUI()

    try {
      const result = await this.uploadFile(nextItem)
      nextItem.status = 'success'
      nextItem.result = result
      nextItem.resolve?.(result)
    } catch (error) {
      nextItem.error = error
      
      if (nextItem.retryCount < this.maxRetries) {
        nextItem.retryCount++
        nextItem.status = 'waiting'
        // Add exponential backoff delay
        setTimeout(() => this.processQueue(), Math.pow(2, nextItem.retryCount) * 1000)
      } else {
        nextItem.status = 'failed'
        nextItem.reject?.(error)
      }
    } finally {
      this.activeUploads--
      this.processing = false
      this.updateProgressUI()
      
      // Continue processing queue
      setTimeout(() => this.processQueue(), 100)
    }
  }

  private async uploadFile(item: UploadQueueItem): Promise<any> {
    // Mock upload implementation - replace with actual upload logic
    const formData = new FormData()
    formData.append('files[]', item.file)
    formData.append('type', 'composer')
    formData.append('synchronous', 'true')

    const response = await fetch('/uploads.json', {
      method: 'POST',
      body: formData,
      credentials: 'same-origin'
    })

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status} ${response.statusText}`)
    }

    const result = await response.json()
    return result
  }

  private updateProgressUI() {
    const totalItems = this.queue.length
    const completedItems = this.queue.filter(item => 
      item.status === 'success' || item.status === 'failed'
    ).length
    const failedItems = this.queue.filter(item => item.status === 'failed').length
    
    // Emit progress event
    window.dispatchEvent(new CustomEvent('upload-progress', {
      detail: {
        total: totalItems,
        completed: completedItems,
        failed: failedItems,
        queue: this.queue.map(item => ({
          id: item.id,
          fileName: item.file.name,
          status: item.status,
          progress: item.progress,
          error: item.error
        }))
      }
    }))
  }

  getQueueStatus() {
    return {
      items: this.queue.map(item => ({
        id: item.id,
        fileName: item.file.name,
        status: item.status,
        progress: item.progress,
        error: item.error
      })),
      activeUploads: this.activeUploads,
      processing: this.processing
    }
  }

  clearCompleted() {
    this.queue = this.queue.filter(item => 
      item.status !== 'success' && item.status !== 'failed'
    )
    this.updateProgressUI()
  }

  retryFailed() {
    this.queue.forEach(item => {
      if (item.status === 'failed') {
        item.status = 'waiting'
        item.retryCount = 0
        item.error = undefined
      }
    })
    this.updateProgressUI()
    this.processQueue()
  }
}

// Global upload queue instance
const uploadQueue = new UploadQueue()

export { uploadQueue, type UploadQueueItem }
export default UploadQueue