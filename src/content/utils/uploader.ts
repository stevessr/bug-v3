import { createE } from './createEl'

// Function to parse image filenames from markdown text
function parseImageFilenamesFromMarkdown(markdownText: string): string[] {
  const imageRegex = /!\[([^\]]*)\]\([^)]+\)/g
  const filenames: string[] = []
  let match

  while ((match = imageRegex.exec(markdownText)) !== null) {
    const filename = match[1]
    if (filename && filename.trim()) {
      filenames.push(filename.trim())
    }
  }

  return filenames
}

// Generic function to insert text into editor
function insertIntoEditor(text: string) {
  const textArea = document.querySelector('textarea.d-editor-input') as HTMLTextAreaElement | null
  const richEle = document.querySelector('.ProseMirror.d-editor-input') as HTMLElement | null

  if (!textArea && !richEle) {
    console.error('找不到输入框')
    return
  }

  if (textArea) {
    const start = textArea.selectionStart
    const end = textArea.selectionEnd
    const value = textArea.value

    textArea.value = value.substring(0, start) + text + value.substring(end)
    textArea.setSelectionRange(start + text.length, start + text.length)
    textArea.focus()

    // Trigger input event to notify any listeners
    const event = new Event('input', { bubbles: true })
    textArea.dispatchEvent(event)
  } else if (richEle) {
    // For rich text editor, insert at current cursor position
    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0)
      const textNode = document.createTextNode(text)
      range.insertNode(textNode)

      // Move cursor after inserted text
      range.setStartAfter(textNode)
      range.setEndAfter(textNode)
      selection.removeAllRanges()
      selection.addRange(range)
    }
    richEle.focus()
  }
}

interface UploadResponse {
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

interface UploadError {
  errors: string[]
  error_type: string
  extras?: {
    wait_seconds: number
    time_left: string
  }
}

interface UploadQueueItem {
  id: string
  file: File

  resolve: (value: UploadResponse) => void

  reject: (error: any) => void
  retryCount: number
  status: 'waiting' | 'uploading' | 'failed' | 'success'
  error?: any
  result?: UploadResponse
  timestamp: number
}

class ImageUploader {
  private waitingQueue: UploadQueueItem[] = []
  private uploadingQueue: UploadQueueItem[] = []
  private failedQueue: UploadQueueItem[] = []
  private successQueue: UploadQueueItem[] = []
  private isProcessing = false
  private maxRetries = 2 // Second failure stops retry
  private progressDialog: HTMLElement | null = null

  async uploadImage(file: File): Promise<UploadResponse> {
    return new Promise((resolve, reject) => {
      const item: UploadQueueItem = {
        id: `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        file,
        resolve,
        reject,
        retryCount: 0,
        status: 'waiting',
        timestamp: Date.now()
      }

      this.waitingQueue.push(item)
      this.updateProgressDialog()
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

        // Insert into editor
        const markdown = `![${result.original_filename}](${result.url})`
        insertIntoEditor(markdown)
      } catch (_error: any) {
        item.error = _error

        if (this.shouldRetry(_error, item)) {
          item.retryCount++

          if (_error.error_type === 'rate_limit' && _error.extras?.wait_seconds) {
            // Wait for rate limit before retry
            setTimeout(() => this.processQueue(), _error.extras.wait_seconds * 1000)
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
    const dialog = createE('div', {
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
    })

    const header = createE('div', {
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
      text: '图片上传队列'
    })

    const closeButton = createE('button', {
      text: '✕',
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
    })

    closeButton.addEventListener('click', () => {
      this.hideProgressDialog()
    })
    closeButton.addEventListener('mouseenter', () => {
      closeButton.style.backgroundColor = '#e5e7eb'
    })
    closeButton.addEventListener('mouseleave', () => {
      closeButton.style.backgroundColor = 'transparent'
    })

    header.appendChild(closeButton)

    const content = createE('div', {
      class: 'upload-queue-content',
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

  private renderQueueItems(dialog: HTMLElement, allItems: UploadQueueItem[]) {
    const content = dialog.querySelector('.upload-queue-content')
    if (!content) return

    content.innerHTML = ''

    if (allItems.length === 0) {
      const emptyState = createE('div', {
        style: `
        text-align: center;
        color: #6b7280;
        font-size: 14px;
        padding: 20px;
      `,
        text: '暂无上传任务'
      })
      content.appendChild(emptyState)
      return
    }

    allItems.forEach(item => {
      const itemEl = createE('div', {
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

      const leftSide = createE('div', {
        style: `
        flex: 1;
        min-width: 0;
      `
      })

      const fileName = createE('div', {
        style: `
        font-size: 13px;
        font-weight: 500;
        color: #374151;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      `,
        text: item.file.name
      })

      const status = createE('div', {
        style: `
        font-size: 12px;
        color: #6b7280;
        margin-top: 2px;
      `
      })
      status.textContent = this.getStatusText(item)

      leftSide.appendChild(fileName)
      leftSide.appendChild(status)

      const rightSide = createE('div', {
        style: `
          display: flex;
          align-items: center;
          gap: 8px;
        `
      })

      // Add retry button for failed items
      if (item.status === 'failed' && item.retryCount < this.maxRetries) {
        const retryButton = createE('button', {
          text: '🔄',
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

      const statusIcon = createE('div', {
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

  private getStatusText(item: UploadQueueItem): string {
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

const uploader = new ImageUploader()

interface DragDropElements {
  panel: HTMLElement
  overlay: HTMLElement
  dropZone: HTMLElement
  fileInput: HTMLInputElement
  closeButton: HTMLButtonElement
  diffDropZone: HTMLElement
  diffFileInput: HTMLInputElement
  markdownTextarea: HTMLTextAreaElement
}

function createDragDropUploadPanel(): DragDropElements {
  const panel = createE('div', {
    class: 'drag-drop-upload-panel',
    style: `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 500px;
    max-width: 90vw;
    background: white;
    border-radius: 12px;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
    z-index: 10000;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `
  })

  const overlay = createE('div', {
    style: `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 9999;
  `
  })

  const header = createE('div', {
    style: `
      padding: 20px 24px 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
    `
  })

  const title = createE('h2', {
    text: '上传图片',
    style: `
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: #111827;
    `
  })

  const closeButton = createE('button', {
    in: '✕',
    style: `
    background: none;
    border: none;
    font-size: 20px;
    cursor: pointer;
    color: #6b7280;
    padding: 4px;
    border-radius: 4px;
    transition: background-color 0.2s;
  `
  })
  closeButton.addEventListener('mouseenter', () => {
    closeButton.style.backgroundColor = '#f3f4f6'
  })
  closeButton.addEventListener('mouseleave', () => {
    closeButton.style.backgroundColor = 'transparent'
  })

  header.appendChild(title)
  header.appendChild(closeButton)

  const content = createE('div', {
    class: 'upload-panel-content',
    style: `
      padding: 24px;
    `
  })

  // Create tabs
  const tabContainer = createE('div', {
    style: `
      display: flex;
      border-bottom: 1px solid #e5e7eb;
      margin-bottom: 20px;
    `
  })

  const regularTab = createE('button', {
    text: '常规上传',
    style: `
      flex: 1;
    padding: 10px 20px;
    background: none;
    border: none;
    border-bottom: 2px solid #3b82f6;
    color: #3b82f6;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  `
  })

  const diffTab = createE('button', {
    text: '差分上传',
    style: `
      flex: 1;
    padding: 10px 20px;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    color: #6b7280;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  `
  })

  tabContainer.appendChild(regularTab)
  tabContainer.appendChild(diffTab)

  // Regular upload panel
  const regularPanel = createE('div', {
    class: 'regular-upload-panel',
    style: `
    display: block;
  `
  }) as HTMLElement

  const dropZone = createE('div', {
    class: 'drop-zone',
    style: `
      border: 2px dashed #d1d5db;
    border-radius: 8px;
    padding: 40px 20px;
    text-align: center;
    background: #f9fafb;
    transition: all 0.2s;
    cursor: pointer;
  `
  })

  const dropIcon = createE('div', {
    in: '📁',
    style: `
      font-size: 48px;
      margin-bottom: 16px;
    `
  })

  const dropText = createE('div', {
    in: `
    <div style="font-size: 16px; font-weight: 500; color: #374151; margin-bottom: 8px;">
      拖拽图片到此处，或点击选择文件
    </div>
    <div style="font-size: 14px; color: #6b7280;">
      支持 JPG、PNG、GIF 等格式，最大 10MB
    </div>
  `
  })

  dropZone.appendChild(dropIcon)
  dropZone.appendChild(dropText)

  const fileInput = createE('input', {
    type: 'file',
    accept: 'image/*',
    multiple: true,
    style: `
      display: none;
    `
  })

  regularPanel.appendChild(dropZone)
  regularPanel.appendChild(fileInput)

  // Diff upload panel
  const diffPanel = createE('div', {
    class: 'diff-upload-panel',
    style: `
    display: none;
  `
  }) as HTMLElement

  const markdownTextarea = createE('textarea', {
    ph: '请粘贴包含图片的 markdown 文本...',
    style: `
      width: 100%;
      height: 120px;
      padding: 12px;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      font-family: monospace;
      font-size: 14px;
      resize: vertical;
      margin-bottom: 12px;
      box-sizing: border-box;
    `
  })

  const diffDropZone = createE('div', {
    class: 'diff-drop-zone',
    style: `
      border: 2px dashed #d1d5db;
    border-radius: 8px;
    padding: 30px 20px;
    text-align: center;
    background: #f9fafb;
    transition: all 0.2s;
    cursor: pointer;
    margin-bottom: 12px;
  `
  }) as HTMLElement

  const diffDropIcon = createE('div', {
    in: '📋',
    style: `
      font-size: 36px;
      margin-bottom: 12px;
    `
  })

  const diffDropText = createE('div', {
    in: `
    <div style="font-size: 16px; font-weight: 500; color: #374151; margin-bottom: 8px;">
      选择图片进行差分上传
    </div>
    <div style="font-size: 14px; color: #6b7280;">
      只会上传不在上方 markdown 文本中的图片
    </div>
  `
  })

  diffDropZone.appendChild(diffDropIcon)
  diffDropZone.appendChild(diffDropText)

  const diffFileInput = createE('input', {
    type: 'file',
    accept: 'image/*',
    multiple: true,
    style: `
      display: none;
    `
  })

  diffPanel.appendChild(markdownTextarea)
  diffPanel.appendChild(diffDropZone)
  diffPanel.appendChild(diffFileInput)

  content.appendChild(tabContainer)
  content.appendChild(regularPanel)
  content.appendChild(diffPanel)

  panel.appendChild(header)
  panel.appendChild(content)

  // Tab switching logic
  const switchToTab = (
    activeTab: HTMLElement,
    inactiveTab: HTMLElement,
    activePanel: HTMLElement,
    inactivePanel: HTMLElement
  ) => {
    activeTab.style.borderBottomColor = '#3b82f6'
    activeTab.style.color = '#3b82f6'
    inactiveTab.style.borderBottomColor = 'transparent'
    inactiveTab.style.color = '#6b7280'
    activePanel.style.display = 'block'
    inactivePanel.style.display = 'none'
  }

  regularTab.addEventListener('click', () => {
    switchToTab(regularTab, diffTab, regularPanel, diffPanel)
  })

  diffTab.addEventListener('click', () => {
    switchToTab(diffTab, regularTab, diffPanel, regularPanel)
  })

  return {
    panel,
    overlay,
    dropZone,
    fileInput,
    closeButton,
    diffDropZone,
    diffFileInput,
    markdownTextarea
  }
}

export async function showImageUploadDialog(): Promise<void> {
  return new Promise(resolve => {
    const {
      panel,
      overlay,
      dropZone,
      fileInput,
      closeButton,
      diffDropZone,
      diffFileInput,
      markdownTextarea
    } = createDragDropUploadPanel()

    let isDragOver = false
    let isDiffDragOver = false

    const cleanup = () => {
      document.body.removeChild(overlay)
      document.body.removeChild(panel)
      resolve()
    }

    const handleFiles = async (files: FileList) => {
      if (!files || files.length === 0) return

      cleanup()

      // Show upload progress
      uploader.showProgressDialog()

      try {
        const promises = Array.from(files).map(async file => {
          try {
            const result = await uploader.uploadImage(file)
            return result
          } catch (_error: any) {
            console.error('[Image Uploader] Upload failed:', _error)
            throw _error
          }
        })

        await Promise.allSettled(promises)
      } finally {
        setTimeout(() => {
          uploader.hideProgressDialog()
        }, 3000)
      }
    }

    const handleDiffFiles = async (files: FileList) => {
      if (!files || files.length === 0) return

      const markdownText = markdownTextarea.value
      const existingFilenames = parseImageFilenamesFromMarkdown(markdownText)

      // Filter files that are not in the existing list
      const filesToUpload = Array.from(files).filter(file => {
        const filename = file.name
        return !existingFilenames.includes(filename)
      })

      if (filesToUpload.length === 0) {
        // Allow alert here to inform users when no files need uploading
        // eslint-disable-next-line no-alert
        alert('所有选择的图片都已在 markdown 文本中存在，无需上传。')
        return
      }

      if (filesToUpload.length < files.length) {
        const skippedCount = files.length - filesToUpload.length
        // Use native confirm to avoid external dependency
        // eslint-disable-next-line no-alert
        const proceed = confirm(
          `发现 ${skippedCount} 个图片已存在于markdown文本中，将被跳过。是否继续上传剩余 ${filesToUpload.length} 个图片？`
        )
        if (!proceed) {
          return
        }
      }

      cleanup()

      // Show upload progress
      uploader.showProgressDialog()

      try {
        const promises = filesToUpload.map(async file => {
          try {
            const result = await uploader.uploadImage(file)
            return result
          } catch (_error: any) {
            console.error('[Image Uploader] Diff upload failed:', _error)
            throw _error
          }
        })

        await Promise.allSettled(promises)
      } finally {
        setTimeout(() => {
          uploader.hideProgressDialog()
        }, 3000)
      }
    }

    // Regular upload handlers
    fileInput.addEventListener('change', async (event: Event) => {
      const files = (event.target as HTMLInputElement).files
      if (files) {
        await handleFiles(files)
      }
    })

    dropZone.addEventListener('click', () => {
      fileInput.click()
    })

    dropZone.addEventListener('dragover', (e: DragEvent) => {
      e.preventDefault()
      if (!isDragOver) {
        isDragOver = true
        dropZone.style.borderColor = '#3b82f6'
        dropZone.style.backgroundColor = '#eff6ff'
      }
    })

    dropZone.addEventListener('dragleave', (e: DragEvent) => {
      e.preventDefault()
      if (!dropZone.contains(e.relatedTarget as Node)) {
        isDragOver = false
        dropZone.style.borderColor = '#d1d5db'
        dropZone.style.backgroundColor = '#f9fafb'
      }
    })

    dropZone.addEventListener('drop', async (e: DragEvent) => {
      e.preventDefault()
      isDragOver = false
      dropZone.style.borderColor = '#d1d5db'
      dropZone.style.backgroundColor = '#f9fafb'

      const files = e.dataTransfer?.files
      if (files) {
        await handleFiles(files)
      }
    })

    // Diff upload handlers
    diffFileInput.addEventListener('change', async (event: Event) => {
      const files = (event.target as HTMLInputElement).files
      if (files) {
        await handleDiffFiles(files)
      }
    })

    diffDropZone.addEventListener('click', () => {
      diffFileInput.click()
    })

    diffDropZone.addEventListener('dragover', (e: DragEvent) => {
      e.preventDefault()
      if (!isDiffDragOver) {
        isDiffDragOver = true
        diffDropZone.style.borderColor = '#3b82f6'
        diffDropZone.style.backgroundColor = '#eff6ff'
      }
    })

    diffDropZone.addEventListener('dragleave', (e: DragEvent) => {
      e.preventDefault()
      if (!diffDropZone.contains(e.relatedTarget as Node)) {
        isDiffDragOver = false
        diffDropZone.style.borderColor = '#d1d5db'
        diffDropZone.style.backgroundColor = '#f9fafb'
      }
    })

    diffDropZone.addEventListener('drop', async (e: DragEvent) => {
      e.preventDefault()
      isDiffDragOver = false
      diffDropZone.style.borderColor = '#d1d5db'
      diffDropZone.style.backgroundColor = '#f9fafb'

      const files = e.dataTransfer?.files
      if (files) {
        await handleDiffFiles(files)
      }
    })

    // Close handlers
    closeButton.addEventListener('click', cleanup)
    overlay.addEventListener('click', cleanup)

    // Prevent default drag behaviors on document
    const preventDefaults = (e: Event) => {
      e.preventDefault()
      e.stopPropagation()
    }

    ;['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      document.addEventListener(eventName, preventDefaults, false)
    })

    // Cleanup event listeners when panel is closed
    const originalCleanup = cleanup
    const enhancedCleanup = () => {
      ;['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        document.removeEventListener(eventName, preventDefaults, false)
      })
      originalCleanup()
    }

    closeButton.removeEventListener('click', cleanup)
    overlay.removeEventListener('click', cleanup)
    closeButton.addEventListener('click', enhancedCleanup)
    overlay.addEventListener('click', enhancedCleanup)

    document.body.appendChild(overlay)
    document.body.appendChild(panel)
  })
}

export { uploader }
