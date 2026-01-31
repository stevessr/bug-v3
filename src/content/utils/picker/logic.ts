import { createE, DOA, DHA, DQS, DAEL } from '../createEl'

import type {
  CustomFilePickerOptions,
  CustomFilePickerResult,
  FileUploadStatus,
  FileStatusUpdater,
  PickerUI
} from './types'
import { createPickerUI } from './ui/builder'
import { formatFileSize, getStatusIcon, getStatusInfo } from './ui/helpers'

export class FilePickerLogic {
  private options: CustomFilePickerOptions
  private resolve: (value: CustomFilePickerResult | PromiseLike<CustomFilePickerResult>) => void
  private ui: PickerUI

  // State
  private selectedFiles: File[] = []
  private filteredCount = 0
  private filteredReasons: Map<string, number> = new Map()
  private fileStatusMap = new Map<string, FileUploadStatus>()
  private isUploading = false
  private uploadComplete = false
  private isDragging = false

  // Drag state
  private currentX = 0
  private currentY = 0
  private initialX = 0
  private initialY = 0

  constructor(
    options: CustomFilePickerOptions,
    resolve: (value: CustomFilePickerResult | PromiseLike<CustomFilePickerResult>) => void
  ) {
    this.options = options
    this.resolve = resolve

    // Initialize UI
    this.ui = createPickerUI(
      options.title || '选择文件',
      options.multiple || false,
      options.accept || 'image/*',
      options.directory || false
    )

    this.initialize()
  }

  private initialize() {
    this.setupEventListeners()
    this.setupDragAndDrop()
    this.injectStyles()

    DOA(this.ui.dialog)

    // Auto focus select button
    setTimeout(() => this.ui.selectButton.focus(), 100)
  }

  private setupEventListeners() {
    // Button listeners
    this.ui.closeBtn.addEventListener('click', () => this.handleClose())
    this.ui.cancelButton.addEventListener('click', () => this.handleCancel())
    this.ui.selectButton.addEventListener('click', () => this.ui.nativeInput.click())
    this.ui.confirmButton.addEventListener('click', () => this.handleConfirm())
    this.ui.clearAllBtn.addEventListener('click', () => {
      this.selectedFiles = []
      this.updatePreview()
    })

    // Native input listener
    this.ui.nativeInput.addEventListener('change', e => this.handleFileSelection(e))

    // Global listeners
    DAEL('paste', this.handlePaste)
    DAEL('keydown', this.handleEscape)
  }

  private setupDragAndDrop() {
    // Window drag logic
    const dragStart = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('button')) return

      this.isDragging = true
      this.initialX = e.clientX - this.currentX
      this.initialY = e.clientY - this.currentY
      this.ui.header.style.cursor = 'grabbing'
    }

    const drag = (e: MouseEvent) => {
      if (!this.isDragging) return

      e.preventDefault()
      this.currentX = e.clientX - this.initialX
      this.currentY = e.clientY - this.initialY

      this.ui.dialog.style.transform = `translate(calc(-50% + ${this.currentX}px), calc(-50% + ${this.currentY}px))`
    }

    const dragEnd = () => {
      this.isDragging = false
      this.ui.header.style.cursor = 'move'
    }

    this.ui.header.addEventListener('mousedown', dragStart)
    DAEL('mousemove', drag)
    DAEL('mouseup', dragEnd)

    // Store reference to remove listeners later
    this.cleanupDrag = () => {
      document.removeEventListener('mousemove', drag)
      document.removeEventListener('mouseup', dragEnd)
    }
  }

  private cleanupDrag: () => void = () => {}

  private handleClose() {
    if (this.uploadComplete || !this.isUploading) {
      this.cleanup({
        files: this.isUploading ? this.selectedFiles : [],
        cancelled: !this.uploadComplete
      })
    }
  }

  private handleCancel() {
    if (this.uploadComplete || !this.isUploading) {
      this.cleanup({
        files: this.isUploading ? this.selectedFiles : [],
        cancelled: !this.uploadComplete
      })
    }
  }

  private handleEscape = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      this.cleanup({
        files: [],
        cancelled: true
      })
    }
  }

  private handlePaste = async (e: ClipboardEvent) => {
    // Only handle paste when dialog is visible and not for folder selection
    if (this.options.directory) return

    const items = e.clipboardData?.items
    if (!items) return

    const imageFiles: File[] = []

    // Extract image files from clipboard
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile()
        if (file) {
          // Generate a meaningful filename with timestamp
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
          const extension = file.type.split('/')[1] || 'png'
          const renamedFile = new File([file], `pasted-image-${timestamp}.${extension}`, {
            type: file.type
          })
          imageFiles.push(renamedFile)

          // If not multiple mode, only take the first image
          if (!this.options.multiple) break
        }
      }
    }

    // If we found image files, add them to selection
    if (imageFiles.length > 0) {
      e.preventDefault()
      this.processFiles(imageFiles)
    }
  }

  private handleFileSelection(e: Event) {
    const files = (e.target as HTMLInputElement).files
    if (files && files.length > 0) {
      this.processFiles(Array.from(files))
      // Reset input so the same file can be selected again
      this.ui.nativeInput.value = ''
    }
  }

  private processFiles(filesToAdd: File[]) {
    let localFilteredCount = 0

    // Apply file filter if provided
    if (this.options.fileFilter) {
      const filtered: File[] = []
      const fileFilter = this.options.fileFilter

      filesToAdd.forEach(file => {
        const result = fileFilter(file)
        if (result.shouldKeep) {
          filtered.push(file)
        } else {
          localFilteredCount++
          const reason = result.skipReason || '不符合条件'
          this.filteredReasons.set(reason, (this.filteredReasons.get(reason) || 0) + 1)
        }
      })

      filesToAdd = filtered
      this.filteredCount += localFilteredCount

      // Show filter notification
      if (localFilteredCount > 0) {
        this.showFilterNotification(localFilteredCount)
      }
    }

    if (filesToAdd.length > 0) {
      if (this.options.multiple) {
        // Add to existing selection
        this.selectedFiles.push(...filesToAdd)
      } else {
        // Replace selection
        this.selectedFiles = filesToAdd
      }
      this.updatePreview()
    } else if (localFilteredCount > 0) {
      // All files were filtered, show message
      this.showNotification('所有选择的文件都已被过滤', '#f59e0b')
    }
  }

  private showFilterNotification(count: number) {
    const reasons = Array.from(this.filteredReasons.entries())
      .map(([reason, c]) => `${c} 个${reason}`)
      .join('，')
    const message = `已过滤 ${count} 个文件（${reasons}）`
    this.showNotification(message, '#3b82f6')
  }

  private showNotification(message: string, bgColor: string) {
    const notification = createE('div', {
      text: message,
      style: `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: ${bgColor};
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        z-index: 10001;
        font-size: 14px;
        animation: slideInRight 0.3s ease-out;
      `
    })
    DOA(notification)
    setTimeout(() => {
      notification.style.opacity = '0'
      notification.style.transition = 'opacity 0.3s'
      setTimeout(() => notification.remove(), 300)
    }, 3000)
  }

  private async handleConfirm() {
    if (!this.options.onUpload) {
      // No upload handler, just return files
      this.cleanup({
        files: this.selectedFiles,
        cancelled: false
      })
      return
    }

    // Start upload process
    this.isUploading = true
    this.uploadComplete = false

    // Initialize status for all files
    this.selectedFiles.forEach((file, index) => {
      const fileId = `${file.name}-${file.size}-${index}`
      this.fileStatusMap.set(fileId, {
        file,
        status: 'waiting'
      })
    })

    // Update UI to upload mode
    this.updateUIToUploadMode()

    // Create status updater
    const updateFileStatus: FileStatusUpdater = (file, update) => {
      // Find file by content match
      const index = this.selectedFiles.findIndex(f => f.name === file.name && f.size === file.size)
      if (index !== -1) {
        const fileId = `${file.name}-${file.size}-${index}`
        const currentStatus = this.fileStatusMap.get(fileId)
        if (currentStatus) {
          Object.assign(currentStatus, update)
          this.updatePreview()
        }
      }
    }

    try {
      // Execute upload
      await this.options.onUpload(this.selectedFiles, updateFileStatus)

      // Mark remaining as success if not updated
      this.selectedFiles.forEach((file, index) => {
        const fileId = `${file.name}-${file.size}-${index}`
        const status = this.fileStatusMap.get(fileId)
        if (status && status.status === 'waiting') {
          status.status = 'success'
        }
      })

      this.uploadComplete = true
      this.isUploading = false

      // Update UI to complete state
      this.ui.confirmButton.style.display = 'none'
      this.ui.cancelButton.textContent = '关闭'
      this.ui.cancelButton.disabled = false
      this.ui.titleEl.textContent = '上传完成'
      this.updatePreview()

      // Auto close after delay
      setTimeout(() => {
        this.cleanup({
          files: this.selectedFiles,
          cancelled: false
        })
      }, 2000)
    } catch (error) {
      console.error('Upload error:', error)
      this.isUploading = false

      // Update UI to error state
      this.ui.confirmButton.textContent = '重试'
      this.ui.confirmButton.disabled = false
      this.ui.confirmButton.style.background = '#ef4444'
      this.ui.confirmButton.style.cursor = 'pointer'
      this.ui.cancelButton.textContent = '取消'
      this.ui.titleEl.textContent = '上传失败'
      this.updatePreview()
    }
  }

  private updateUIToUploadMode() {
    this.ui.titleEl.textContent = '上传队列'
    this.ui.confirmButton.textContent = '上传中...'
    this.ui.confirmButton.disabled = true
    this.ui.confirmButton.style.background = '#6b7280'
    this.ui.confirmButton.style.cursor = 'not-allowed'
    this.ui.selectButton.style.display = 'none'
    this.ui.clearAllBtn.style.display = 'none'
    this.ui.fileTypeInfo.style.display = 'none'
    this.ui.infoBox.style.display = 'none'
    this.ui.cancelButton.textContent = '最小化'
    this.updatePreview()
  }

  private updatePreview() {
    if (this.selectedFiles.length === 0) {
      this.ui.previewContainer.style.display = 'none'
      this.ui.confirmButton.style.display = 'none'
      this.ui.selectButton.style.display = 'block'
      this.ui.fileTypeInfo.style.display = 'block'
      this.ui.infoBox.style.display = 'block'
      return
    }

    // Show preview and confirm button, hide initial UI
    this.ui.previewContainer.style.display = 'block'
    this.ui.confirmButton.style.display = 'block'
    this.ui.selectButton.style.display = 'none'
    this.ui.fileTypeInfo.style.display = 'none'
    this.ui.infoBox.style.display = 'none'

    this.ui.previewTitleText.textContent = `已选择 ${this.selectedFiles.length} 个文件`
    this.ui.previewList.innerHTML = ''

    this.selectedFiles.forEach((file, index) => {
      this.createFilePreviewItem(file, index)
    })
  }

  private createFilePreviewItem(file: File, index: number) {
    const fileItem = createE('div', {
      style: `
        display: flex;
        align-items: center;
        padding: 8px 12px;
        margin-bottom: 6px;
        background: white;
        border: 1px solid var(--primary-low-mid, #e5e7eb);
        border-radius: 6px;
        gap: 12px;
        transition: all 0.2s;
      `
    })

    // Preview thumbnail for images
    const thumbnail = createE('div', {
      style: `
        width: 48px;
        height: 48px;
        border-radius: 4px;
        background: var(--primary-low, #f3f4f6);
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        flex-shrink: 0;
      `
    })

    if (file.type.startsWith('image/')) {
      const img = createE('img', {
        style: `
          width: 100%;
          height: 100%;
          object-fit: cover;
        `
      }) as HTMLImageElement
      img.src = URL.createObjectURL(file)
      img.onload = () => URL.revokeObjectURL(img.src)
      thumbnail.appendChild(img)
    } else {
      thumbnail.textContent = '📄'
      thumbnail.style.fontSize = '24px'
    }

    // File info
    const fileInfo = createE('div', {
      style: `
        flex: 1;
        min-width: 0;
      `
    })

    const fileName = createE('div', {
      text: file.name,
      style: `
        font-size: 14px;
        font-weight: 500;
        color: var(--primary, #333);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      `
    })

    const fileSize = createE('div', {
      style: `
        font-size: 12px;
        color: var(--primary-medium, #6b7280);
        margin-top: 2px;
      `
    })

    // Get upload status
    const fileId = `${file.name}-${file.size}-${index}`
    const status = this.fileStatusMap.get(fileId)

    if (status) {
      // Show upload status with color coding
      const statusInfo = getStatusInfo(status)
      fileSize.textContent = statusInfo.text
      fileSize.style.color = statusInfo.color
      if (status.status === 'success') {
        fileSize.style.fontWeight = '500'
      }
    } else {
      fileSize.textContent = formatFileSize(file.size)
    }

    fileInfo.appendChild(fileName)
    fileInfo.appendChild(fileSize)

    // Status indicator / Remove button
    const actionBtn = createE('div', {
      style: `
        width: 28px;
        height: 28px;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        font-size: 16px;
      `
    })

    if (status) {
      // Show status icon
      actionBtn.textContent = getStatusIcon(status.status)
      actionBtn.style.color = getStatusInfo(status).color
    } else if (!this.isUploading) {
      // Show remove button
      const removeBtn = createE('button', {
        text: '✕',
        style: `
          width: 100%;
          height: 100%;
          border: none;
          background: transparent;
          color: #6b7280;
          cursor: pointer;
          font-size: 16px;
          transition: all 0.2s;
        `
      }) as HTMLButtonElement

      removeBtn.addEventListener('mouseenter', () => {
        removeBtn.style.background = '#fee2e2'
        removeBtn.style.color = '#ef4444'
        actionBtn.style.borderRadius = '4px'
      })
      removeBtn.addEventListener('mouseleave', () => {
        removeBtn.style.background = 'transparent'
        removeBtn.style.color = '#6b7280'
      })

      removeBtn.addEventListener('click', () => {
        this.selectedFiles.splice(index, 1)
        this.fileStatusMap.delete(fileId)
        this.updatePreview()
      })

      actionBtn.appendChild(removeBtn)
    }

    fileItem.appendChild(thumbnail)
    fileItem.appendChild(fileInfo)
    fileItem.appendChild(actionBtn)
    this.ui.previewList.appendChild(fileItem)
  }

  private injectStyles() {
    const style = createE('style', {
      text: `
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes slideIn {
        from {
          opacity: 0;
          transform: scale(0.95);
        }
        to {
          opacity: 1;
          transform: scale(1);
        }
      }
      @keyframes slideInRight {
        from {
          opacity: 0;
          transform: translateX(100%);
        }
        to {
          opacity: 1;
          transform: translateX(0);
        }
      }
    `,
      attrs: { 'data-custom-picker-animations': 'true' }
    })
    if (!DQS('style[data-custom-picker-animations]')) {
      DHA(style)
    }
  }

  private cleanup(result: CustomFilePickerResult) {
    this.ui.dialog.style.opacity = '0'
    this.ui.dialog.style.transform = 'scale(0.95)'

    // Clean up all event listeners
    this.cleanupDrag()
    document.removeEventListener('keydown', this.handleEscape)
    document.removeEventListener('paste', this.handlePaste)

    setTimeout(() => {
      if (this.ui.dialog.parentElement) {
        this.ui.dialog.parentElement.removeChild(this.ui.dialog)
      }
      this.resolve(result)
    }, 150)
  }
}
