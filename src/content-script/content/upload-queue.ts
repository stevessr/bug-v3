interface UploadQueueItem {
  id: string
  file: File
  status: 'waiting' | 'uploading' | 'success' | 'failed'
  progress: number
  result?: UploadResponse
  error?: any
  retryCount: number
  timestamp: number
  resolve?: (value: any) => void
  reject?: (reason: any) => void
}

interface UploadResponse {
  id: number
  url: string
  original_filename: string
  filesize: number
  width: number
  height: number
  thumbnail_width?: number
  thumbnail_height?: number
  extension: string
  short_url?: string
  short_path?: string
  retain_hours?: number | null
  human_filesize?: string
  dominant_color?: string
  thumbnail?: string | null
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
        reject,
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

    const nextItem = this.queue.find((item) => item.status === 'waiting')
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

  private async uploadFile(item: UploadQueueItem): Promise<UploadResponse> {
    const formData = new FormData()
    formData.append('upload_type', 'composer')
    formData.append('name', item.file.name)
    formData.append('type', item.file.type)
    formData.append('file', item.file, item.file.name)

    const response = await fetch('/uploads.json', {
      method: 'POST',
      body: formData,
      credentials: 'same-origin',
    })

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status} ${response.statusText}`)
    }

    const result = await response.json()
    return result as UploadResponse
  }

  /**
   * 生成 Markdown 格式的上传结果
   * @param response 上传响应结果
   * @returns Markdown 字符串
   */
  /**
   * 解析 Markdown 中的文件名称
   * @param markdown Markdown 字符串
   * @returns 文件名称集合
   */
  parseImageFilenamesFromMarkdown(markdown: string): Set<string> {
    // 匹配格式: [filename|widthxheight,scale%](url) 或 [filename](url)
    const regex = /\[([^\]]+?)(?:\|[^\]]*)?\]\([^)]+\)/g
    const filenames = new Set<string>()
    let match

    while ((match = regex.exec(markdown)) !== null) {
      const filename = match[1]
      if (filename && !filename.startsWith('http')) {
        filenames.add(filename)
        // 也添加无扩展名的版本
        const nameWithoutExt = filename.replace(/\.[^/.]+$/, '')
        if (nameWithoutExt !== filename) {
          filenames.add(nameWithoutExt)
        }
      }
    }

    return filenames
  }

  /**
   * 差分上传：只上传不在现有 Markdown 中的文件
   * @param files 要上传的文件数组
   * @param existingMarkdown 现有的 Markdown 内容
   * @returns Promise<UploadResponse[]> 上传结果数组
   */
  async uploadDiffFiles(files: File[], existingMarkdown: string): Promise<UploadResponse[]> {
    const existingFilenames = this.parseImageFilenamesFromMarkdown(existingMarkdown)
    
    const filesToUpload = files.filter((file) => {
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '')
      return !existingFilenames.has(file.name) && !existingFilenames.has(nameWithoutExt)
    })

    console.log(`[\u5dee\u5206\u4e0a\u4f20] ${filesToUpload.length}/${files.length} \u4e2a\u6587\u4ef6\u9700\u8981\u4e0a\u4f20`)
    
    if (filesToUpload.length === 0) {
      console.log('[\u5dee\u5206\u4e0a\u4f20] \u6ca1\u6709\u65b0\u6587\u4ef6\u9700\u8981\u4e0a\u4f20')
      return []
    }

    // 批量添加到队列
    const uploadPromises = filesToUpload.map((file) => this.addToQueue(file))
    return Promise.all(uploadPromises)
  }

  /**
   * 批量上传所有文件
   * @param files 要上传的文件数组
   * @returns Promise<UploadResponse[]> 上传结果数组
   */
  async uploadBatchFiles(files: File[]): Promise<UploadResponse[]> {
    console.log(`[\u6279\u91cf\u4e0a\u4f20] \u5f00\u59cb\u4e0a\u4f20 ${files.length} \u4e2a\u6587\u4ef6`)
    
    const uploadPromises = files.map((file) => this.addToQueue(file))
    return Promise.all(uploadPromises)
  }

  generateMarkdown(response: UploadResponse): string {
    const { original_filename, width, height, url } = response
    return `[${original_filename}|${width}x${height},100%](${url})`
  }

  /**
   * 批量生成 Markdown
   * @param responses 上传响应结果数组
   * @returns 多行 Markdown 字符串
   */
  generateBatchMarkdown(responses: UploadResponse[]): string {
    return responses.map(response => this.generateMarkdown(response)).join('\n')
  }

  private updateProgressUI() {
    const totalItems = this.queue.length
    const completedItems = this.queue.filter(
      (item) => item.status === 'success' || item.status === 'failed',
    ).length
    const failedItems = this.queue.filter((item) => item.status === 'failed').length

    // Emit progress event
    window.dispatchEvent(
      new CustomEvent('upload-progress', {
        detail: {
          total: totalItems,
          completed: completedItems,
          failed: failedItems,
          queue: this.queue.map((item) => ({
            id: item.id,
            fileName: item.file.name,
            status: item.status,
            progress: item.progress,
            error: item.error,
          })),
        },
      }),
    )
  }

  /**
   * 获取所有成功上传的结果
   * @returns 成功上传的响应结果数组
   */
  getSuccessfulUploads(): UploadResponse[] {
    return this.queue
      .filter(item => item.status === 'success' && item.result)
      .map(item => item.result as UploadResponse)
  }

  /**
   * 获取所有成功上传的 Markdown
   * @returns 成功上传的 Markdown 字符串
   */
  getSuccessfulMarkdown(): string {
    const successfulUploads = this.getSuccessfulUploads()
    return this.generateBatchMarkdown(successfulUploads)
  }

  /**
   * 清除所有队列项目
   */
  clearAll() {
    this.queue = []
    this.updateProgressUI()
  }

  /**
   * 按状态筛选队列项目
   * @param status 要筛选的状态
   * @returns 筛选后的队列项目
   */
  getItemsByStatus(status: 'waiting' | 'uploading' | 'success' | 'failed' | 'all'): UploadQueueItem[] {
    if (status === 'all') {
      return [...this.queue]
    }
    return this.queue.filter(item => item.status === status)
  }

  getQueueStatus() {
    return {
      items: this.queue.map((item) => ({
        id: item.id,
        fileName: item.file.name,
        status: item.status,
        progress: item.progress,
        error: item.error,
      })),
      activeUploads: this.activeUploads,
      processing: this.processing,
    }
  }

  clearCompleted() {
    this.queue = this.queue.filter((item) => item.status !== 'success' && item.status !== 'failed')
    this.updateProgressUI()
  }

  retryFailed() {
    this.queue.forEach((item) => {
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

export { uploadQueue, type UploadQueueItem, type UploadResponse }
export default UploadQueue
