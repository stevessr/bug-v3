import { createE } from './createEl'
import { notify } from './notify'
import { customAlert, customConfirm } from './dialog'
import { showCustomImagePicker, showCustomFolderPicker } from './customFilePicker'

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

        // Insert into editor
        const markdown = `![${result.original_filename}](${result.url})`
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
  overlay: any
  dropZone: HTMLElement
  fileInput: HTMLInputElement
  closeButton: HTMLElement
  diffDropZone: HTMLElement
  diffFileInput: HTMLInputElement
  markdownTextarea: HTMLTextAreaElement
  folderDropZone: HTMLElement
  folderInput: HTMLInputElement
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
    background: var(--primary-very-low);
    border-radius: 12px;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
    z-index: 10000;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `
  })

  // No overlay - removed for draggable floating window

  const header = createE('div', {
    style: `
      padding: 20px 24px 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      cursor: move;
      user-select: none;
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

  const folderTab = createE('button', {
    text: '文件夹上传',
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
  tabContainer.appendChild(folderTab)

  // Add dragging functionality
  let isDragging = false
  let currentX = 0
  let currentY = 0
  let initialX = 0
  let initialY = 0

  const dragStart = (e: MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return // Don't drag when clicking buttons

    isDragging = true
    initialX = e.clientX - currentX
    initialY = e.clientY - currentY
    header.style.cursor = 'grabbing'
  }

  const drag = (e: MouseEvent) => {
    if (!isDragging) return

    e.preventDefault()
    currentX = e.clientX - initialX
    currentY = e.clientY - initialY

    panel.style.transform = `translate(calc(-50% + ${currentX}px), calc(-50% + ${currentY}px))`
  }

  const dragEnd = () => {
    isDragging = false
    header.style.cursor = 'move'
  }

  header.addEventListener('mousedown', dragStart)
  document.addEventListener('mousemove', drag)
  document.addEventListener('mouseup', dragEnd)

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
    background: var(--primary-low);
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

  // Folder upload panel
  const folderPanel = createE('div', {
    class: 'folder-upload-panel',
    style: `
    display: none;
  `
  }) as HTMLElement

  const folderDropZone = createE('div', {
    class: 'folder-drop-zone',
    style: `
      border: 2px dashed #d1d5db;
    border-radius: 8px;
    padding: 40px 20px;
    text-align: center;
    background: var(--primary-low);
    transition: all 0.2s;
    cursor: pointer;
  `
  })

  const folderIcon = createE('div', {
    in: '📂',
    style: `
      font-size: 48px;
      margin-bottom: 16px;
    `
  })

  const folderText = createE('div', {
    in: `
    <div style="font-size: 16px; font-weight: 500; color: #374151; margin-bottom: 8px;">
      拖拽文件夹到此处，或点击选择文件夹
    </div>
    <div style="font-size: 14px; color: #6b7280;">
      将上传文件夹内所有图片文件
    </div>
  `
  })

  folderDropZone.appendChild(folderIcon)
  folderDropZone.appendChild(folderText)

  const folderInput = createE('input', {
    type: 'file',
    attrs: { webkitdirectory: '', directory: '', multiple: '' },
    style: `
      display: none;
    `
  }) as HTMLInputElement

  folderPanel.appendChild(folderDropZone)
  folderPanel.appendChild(folderInput)

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
    background: var(--primary-low);
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
  content.appendChild(folderPanel)
  content.appendChild(diffPanel)

  panel.appendChild(header)
  panel.appendChild(content)

  // Tab switching logic
  regularTab.addEventListener('click', () => {
    regularTab.style.borderBottomColor = '#3b82f6'
    regularTab.style.color = '#3b82f6'
    diffTab.style.borderBottomColor = 'transparent'
    diffTab.style.color = '#6b7280'
    folderTab.style.borderBottomColor = 'transparent'
    folderTab.style.color = '#6b7280'
    regularPanel.style.display = 'block'
    diffPanel.style.display = 'none'
    folderPanel.style.display = 'none'
  })

  diffTab.addEventListener('click', () => {
    diffTab.style.borderBottomColor = '#3b82f6'
    diffTab.style.color = '#3b82f6'
    regularTab.style.borderBottomColor = 'transparent'
    regularTab.style.color = '#6b7280'
    folderTab.style.borderBottomColor = 'transparent'
    folderTab.style.color = '#6b7280'
    diffPanel.style.display = 'block'
    regularPanel.style.display = 'none'
    folderPanel.style.display = 'none'
  })

  folderTab.addEventListener('click', () => {
    folderTab.style.borderBottomColor = '#3b82f6'
    folderTab.style.color = '#3b82f6'
    regularTab.style.borderBottomColor = 'transparent'
    regularTab.style.color = '#6b7280'
    diffTab.style.borderBottomColor = 'transparent'
    diffTab.style.color = '#6b7280'
    folderPanel.style.display = 'block'
    regularPanel.style.display = 'none'
    diffPanel.style.display = 'none'
  })

  return {
    panel,
    overlay: null as any, // No overlay for draggable window
    dropZone,
    fileInput,
    closeButton,
    diffDropZone,
    diffFileInput,
    markdownTextarea,
    folderDropZone,
    folderInput
  }
}

export async function showImageUploadDialog(): Promise<void> {
  return new Promise(resolve => {
    const {
      panel,
      dropZone,
      fileInput,
      closeButton,
      diffDropZone,
      diffFileInput,
      markdownTextarea,
      folderDropZone,
      folderInput
    } = createDragDropUploadPanel()

    let isDragOver = false
    let isDiffDragOver = false
    let isFolderDragOver = false

    const cleanup = () => {
      if (panel.parentElement) {
        document.body.removeChild(panel)
      }
      resolve()
    }

    const handleFiles = async (files: FileList) => {
      if (!files || files.length === 0) return

      // Don't cleanup - keep the window open
      // cleanup()

      // Upload progress now shown in file picker dialog
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
        // Keep progress dialog open - don't auto-hide
        // setTimeout(() => {
        //   uploader.hideProgressDialog()
        // }, 3000)
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
        // Use custom alert instead of native alert
        await customAlert('所有选择的图片都已在 markdown 文本中存在，无需上传。')
        return
      }

      if (filesToUpload.length < files.length) {
        const skippedCount = files.length - filesToUpload.length
        // Use custom confirm instead of native confirm
        const proceed = await customConfirm(
          `发现 ${skippedCount} 个图片已存在于markdown文本中，将被跳过。是否继续上传剩余 ${filesToUpload.length} 个图片？`
        )
        if (!proceed) {
          return
        }
      }

      // Don't cleanup - keep the window open
      // cleanup()

      // Upload progress now shown in file picker dialog
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
        // Keep progress dialog open - don't auto-hide
        // setTimeout(() => {
        //   uploader.hideProgressDialog()
        // }, 3000)
      }
    }

    // Regular upload handlers
    fileInput.addEventListener('change', async (event: Event) => {
      const files = (event.target as HTMLInputElement).files
      if (files) {
        await handleFiles(files)
      }
    })

    dropZone.addEventListener('click', async () => {
      // Use custom file picker with integrated upload
      await showCustomImagePicker(true, async (files, updateStatus) => {
        // Upload each file with status updates
        for (const file of files) {
          try {
            updateStatus(file, { status: 'uploading', progress: 0 })
            
            // Upload using the uploader's method
            const result = await uploader.uploadImage(file)
            
            updateStatus(file, { status: 'success', url: result.url })
          } catch (error: any) {
            console.error(`Failed to upload ${file.name}:`, error)
            updateStatus(file, { 
              status: 'failed', 
              error: error.message || '上传失败' 
            })
          }
        }
      })
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

    diffDropZone.addEventListener('click', async () => {
      // Get markdown text for diff check
      const markdownText = markdownTextarea.value.trim()
      
      // Use custom file picker with integrated upload and diff check
      await showCustomImagePicker(true, async (files, updateStatus) => {
        // Extract existing filenames from markdown
        const existingFilenames = markdownText
          .match(/!\[.*?\]\((.*?)\)/g)
          ?.map(match => {
            const url = match.match(/!\[.*?\]\((.*?)\)/)?.[1] || ''
            return url.split('/').pop() || ''
          }) || []

        // Filter and upload
        for (const file of files) {
          if (existingFilenames.includes(file.name)) {
            updateStatus(file, { status: 'failed', error: '已存在' })
            continue
          }

          try {
            updateStatus(file, { status: 'uploading', progress: 0 })
            const result = await uploader.uploadImage(file)
            updateStatus(file, { status: 'success', url: result.url })
          } catch (error: any) {
            console.error(`Failed to upload ${file.name}:`, error)
            updateStatus(file, { status: 'failed', error: error.message || '上传失败' })
          }
        }
      })
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

    // Folder upload handlers
    folderInput.addEventListener('change', async (event: Event) => {
      const files = (event.target as HTMLInputElement).files
      if (files) {
        await handleFiles(files)
      }
    })

    folderDropZone.addEventListener('click', async () => {
      // Use custom folder picker with integrated upload
      await showCustomFolderPicker(async (files, updateStatus) => {
        // Upload each file with status updates
        for (const file of files) {
          try {
            updateStatus(file, { status: 'uploading', progress: 0 })
            const result = await uploader.uploadImage(file)
            updateStatus(file, { status: 'success', url: result.url })
          } catch (error: any) {
            console.error(`Failed to upload ${file.name}:`, error)
            updateStatus(file, { status: 'failed', error: error.message || '上传失败' })
          }
        }
      })
    })

    folderDropZone.addEventListener('dragover', (e: DragEvent) => {
      e.preventDefault()
      if (!isFolderDragOver) {
        isFolderDragOver = true
        folderDropZone.style.borderColor = '#3b82f6'
        folderDropZone.style.backgroundColor = '#eff6ff'
      }
    })

    folderDropZone.addEventListener('dragleave', (e: DragEvent) => {
      e.preventDefault()
      if (!folderDropZone.contains(e.relatedTarget as Node)) {
        isFolderDragOver = false
        folderDropZone.style.borderColor = '#d1d5db'
        folderDropZone.style.backgroundColor = '#f9fafb'
      }
    })

    folderDropZone.addEventListener('drop', async (e: DragEvent) => {
      e.preventDefault()
      isFolderDragOver = false
      folderDropZone.style.borderColor = '#d1d5db'
      folderDropZone.style.backgroundColor = '#f9fafb'

      const items = e.dataTransfer?.items
      if (items) {
        const files: File[] = []
        // Process all dropped items
        for (let i = 0; i < items.length; i++) {
          const item = items[i]
          if (item.kind === 'file') {
            const entry = item.webkitGetAsEntry()
            if (entry) {
              await collectFiles(entry, files)
            }
          }
        }
        if (files.length > 0) {
          // Convert to FileList-like object
          const fileList = {
            length: files.length,
            item: (index: number) => files[index],
            [Symbol.iterator]: function* () {
              for (const file of files) {
                yield file
              }
            }
          }
          await handleFiles(fileList as any)
        }
      }
    })

    // Helper function to recursively collect files from folder
    async function collectFiles(entry: any, files: File[]): Promise<void> {
      if (entry.isFile) {
        const file = await new Promise<File>(resolve => {
          entry.file((f: File) => resolve(f))
        })
        // Only collect image files
        if (file.type.startsWith('image/')) {
          files.push(file)
        }
      } else if (entry.isDirectory) {
        const reader = entry.createReader()
        const entries = await new Promise<any[]>(resolve => {
          reader.readEntries((entries: any[]) => resolve(entries))
        })
        for (const subEntry of entries) {
          await collectFiles(subEntry, files)
        }
      }
    }

    // Close handlers
    closeButton.addEventListener('click', cleanup)
    // No overlay to click

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
    // No overlay to remove listeners from
    closeButton.addEventListener('click', enhancedCleanup)
    // No overlay to add listeners to

    // No overlay to append
    document.body.appendChild(panel)
  })
}

export { uploader }
