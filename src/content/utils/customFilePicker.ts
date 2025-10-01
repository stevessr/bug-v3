import { createE } from './createEl'

/**
 * Custom file picker that mimics native file input but with custom UI
 * Note: Due to browser security restrictions, we still need to use native input
 * but we can provide a better UI wrapper around it
 */

interface CustomFilePickerOptions {
  multiple?: boolean
  accept?: string
  directory?: boolean
  title?: string
  onUpload?: (files: File[], updateStatus: FileStatusUpdater) => Promise<void>
}

interface CustomFilePickerResult {
  files: File[]
  cancelled: boolean
}

// Upload status for each file
interface FileUploadStatus {
  file: File
  status: 'waiting' | 'uploading' | 'success' | 'failed'
  progress?: number
  error?: string
  url?: string
}

// Status updater callback type
export type FileStatusUpdater = (
  file: File, 
  update: Partial<Omit<FileUploadStatus, 'file'>>
) => void

/**
 * Show a custom styled file picker dialog
 * This provides a better UI experience while still using the secure native file input
 */
export async function showCustomFilePicker(
  options: CustomFilePickerOptions = {}
): Promise<CustomFilePickerResult> {
  return new Promise(resolve => {
    const { multiple = false, accept = 'image/*', directory = false, title = '选择文件', onUpload } = options

    // Selected files storage
    let selectedFiles: File[] = []
    
    // Upload status tracking
    const fileStatusMap = new Map<string, FileUploadStatus>()
    let isUploading = false
    let uploadComplete = false

    // Create dialog without backdrop - floating window
    const dialog = createE('div', {
      style: `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: var(--primary-very-low, #ffffff);
        border-radius: 12px;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
        min-width: 400px;
        max-width: 700px;
        max-height: 80vh;
        padding: 0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        animation: slideIn 0.2s ease-out;
        overflow: hidden;
        z-index: 10000;
        display: flex;
        flex-direction: column;
      `
    })

    // Header - make it draggable
    const header = createE('div', {
      style: `
        padding: 20px 24px;
        background: var(--secondary, #f3f4f6);
        border-bottom: 1px solid var(--primary-low-mid, #e5e7eb);
        display: flex;
        justify-content: space-between;
        align-items: center;
        cursor: move;
        user-select: none;
      `
    })

    const titleEl = createE('h3', {
      text: title,
      style: `
        margin: 0;
        font-size: 18px;
        font-weight: 600;
        color: var(--primary, #333);
      `
    })

    const closeBtn = createE('button', {
      text: '✕',
      style: `
        background: none;
        border: none;
        font-size: 20px;
        cursor: pointer;
        color: #6b7280;
        padding: 4px 8px;
        border-radius: 4px;
        transition: background 0.2s;
      `
    }) as HTMLButtonElement

    closeBtn.addEventListener('mouseenter', () => {
      closeBtn.style.background = '#e5e7eb'
    })
    closeBtn.addEventListener('mouseleave', () => {
      closeBtn.style.background = 'transparent'
    })

    header.appendChild(titleEl)
    header.appendChild(closeBtn)

    // Content - with scroll support
    const content = createE('div', {
      style: `
        padding: 24px;
        overflow-y: auto;
        flex: 1;
        min-height: 0;
      `
    })

    // Preview container (hidden initially)
    const previewContainer = createE('div', {
      style: `
        display: none;
        margin-bottom: 20px;
        max-height: 400px;
        overflow-y: auto;
        border: 1px solid var(--primary-low-mid, #e5e7eb);
        border-radius: 8px;
        background: var(--primary-very-low, #f9fafb);
      `
    })

    const previewTitle = createE('div', {
      style: `
        padding: 12px 16px;
        font-weight: 600;
        font-size: 14px;
        color: var(--primary, #333);
        border-bottom: 1px solid var(--primary-low-mid, #e5e7eb);
        background: var(--secondary, #f3f4f6);
        display: flex;
        justify-content: space-between;
        align-items: center;
      `
    })

    const previewTitleText = createE('span', {
      text: '已选择 0 个文件'
    })

    const clearAllBtn = createE('button', {
      text: '清空全部',
      style: `
        background: none;
        border: none;
        color: #ef4444;
        font-size: 13px;
        cursor: pointer;
        padding: 4px 8px;
        border-radius: 4px;
        transition: background 0.2s;
      `
    }) as HTMLButtonElement

    clearAllBtn.addEventListener('mouseenter', () => {
      clearAllBtn.style.background = '#fee2e2'
    })
    clearAllBtn.addEventListener('mouseleave', () => {
      clearAllBtn.style.background = 'transparent'
    })

    previewTitle.appendChild(previewTitleText)
    previewTitle.appendChild(clearAllBtn)

    const previewList = createE('div', {
      style: `
        padding: 8px;
      `
    })

    previewContainer.appendChild(previewTitle)
    previewContainer.appendChild(previewList)

    // File type indicator
    const fileTypeInfo = createE('div', {
      style: `
        padding: 16px;
        background: var(--primary-very-low, #f9fafb);
        border: 2px dashed var(--primary-low-mid, #d1d5db);
        border-radius: 8px;
        text-align: center;
        margin-bottom: 20px;
      `
    })

    const icon = createE('div', {
      text: directory ? '📁' : '📄',
      style: `
        font-size: 48px;
        margin-bottom: 12px;
      `
    })

    const description = createE('div', {
      style: `
        color: var(--primary-medium, #6b7280);
        font-size: 14px;
        line-height: 1.5;
      `
    })

    if (directory) {
      description.innerHTML = `
        <div style="font-weight: 500; margin-bottom: 4px;">选择文件夹</div>
        <div>将上传文件夹内的所有图片文件</div>
      `
    } else {
      description.innerHTML = `
        <div style="font-weight: 500; margin-bottom: 4px;">选择${multiple ? '多个' : '单个'}文件</div>
        <div>支持的格式：${accept === 'image/*' ? '图片文件' : accept}</div>
        <div style="margin-top: 4px; font-size: 12px;">提示：您也可以直接拖拽文件到上传区域</div>
        <div style="margin-top: 8px; font-size: 13px; font-weight: 500; color: #059669;">
          📋 或按 Ctrl+V 粘贴剪贴板中的图片
        </div>
      `
    }

    fileTypeInfo.appendChild(icon)
    fileTypeInfo.appendChild(description)

    // Hidden native input
    const nativeInput = createE('input', {
      type: 'file',
      style: 'display: none;'
    }) as HTMLInputElement

    if (multiple) nativeInput.setAttribute('multiple', '')
    if (accept) nativeInput.setAttribute('accept', accept)
    if (directory) {
      nativeInput.setAttribute('webkitdirectory', '')
      nativeInput.setAttribute('directory', '')
    }

    // Info box
    const infoBox = createE('div', {
      style: `
        padding: 12px 16px;
        background: #eff6ff;
        border: 1px solid #bfdbfe;
        border-radius: 6px;
        color: #1e40af;
        font-size: 13px;
        line-height: 1.5;
        margin-bottom: 20px;
      `
    })

    infoBox.innerHTML = `
      <div style="font-weight: 500; margin-bottom: 4px;">🔒 安全提示</div>
      <div>出于安全考虑，浏览器会使用系统原生的文件选择器。这是所有网站的标准行为。</div>
    `

    // Buttons container - moved to dialog bottom
    const buttonContainer = createE('div', {
      style: `
        display: flex;
        gap: 10px;
        justify-content: flex-end;
        padding: 16px 24px;
        border-top: 1px solid var(--primary-low-mid, #e5e7eb);
        background: var(--secondary, #f9fafb);
      `
    })

    const cancelButton = createE('button', {
      text: '取消',
      style: `
        padding: 10px 24px;
        background: var(--primary-low, #f3f4f6);
        color: var(--primary, #333);
        border: 1px solid var(--primary-low-mid, #d1d5db);
        border-radius: 6px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
      `
    }) as HTMLButtonElement

    cancelButton.addEventListener('mouseenter', () => {
      cancelButton.style.background = 'var(--primary-low-mid, #e5e7eb)'
    })
    cancelButton.addEventListener('mouseleave', () => {
      cancelButton.style.background = 'var(--primary-low, #f3f4f6)'
    })

    const selectButton = createE('button', {
      text: directory ? '选择文件夹' : '浏览文件',
      style: `
        padding: 10px 24px;
        background: #6b7280;
        color: white;
        border: none;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: background 0.2s;
      `
    }) as HTMLButtonElement

    selectButton.addEventListener('mouseenter', () => {
      selectButton.style.background = '#4b5563'
    })
    selectButton.addEventListener('mouseleave', () => {
      selectButton.style.background = '#6b7280'
    })

    const confirmButton = createE('button', {
      text: '确认上传',
      style: `
        padding: 10px 24px;
        background: #10b981;
        color: white;
        border: none;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: background 0.2s;
        display: none;
      `
    }) as HTMLButtonElement

    confirmButton.addEventListener('mouseenter', () => {
      confirmButton.style.background = '#059669'
    })
    confirmButton.addEventListener('mouseleave', () => {
      confirmButton.style.background = '#10b981'
    })

    buttonContainer.appendChild(cancelButton)
    buttonContainer.appendChild(selectButton)
    buttonContainer.appendChild(confirmButton)

    content.appendChild(previewContainer)
    content.appendChild(fileTypeInfo)
    content.appendChild(infoBox)
    content.appendChild(nativeInput)

    dialog.appendChild(header)
    dialog.appendChild(content)
    dialog.appendChild(buttonContainer)

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

      dialog.style.transform = `translate(calc(-50% + ${currentX}px), calc(-50% + ${currentY}px))`
    }

    const dragEnd = () => {
      isDragging = false
      header.style.cursor = 'move'
    }

    header.addEventListener('mousedown', dragStart)
    document.addEventListener('mousemove', drag)
    document.addEventListener('mouseup', dragEnd)

    // Update preview UI
    const updatePreview = () => {
      if (selectedFiles.length === 0) {
        previewContainer.style.display = 'none'
        confirmButton.style.display = 'none'
        selectButton.style.display = 'block'
        fileTypeInfo.style.display = 'block'
        infoBox.style.display = 'block'
        return
      }

      // Show preview and confirm button, hide initial UI
      previewContainer.style.display = 'block'
      confirmButton.style.display = 'block'
      selectButton.style.display = 'none'
      fileTypeInfo.style.display = 'none'
      infoBox.style.display = 'none'

      previewTitleText.textContent = `已选择 ${selectedFiles.length} 个文件`
      previewList.innerHTML = ''

      selectedFiles.forEach((file, index) => {
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
        const status = fileStatusMap.get(fileId)

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
        } else if (!isUploading) {
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
            selectedFiles.splice(index, 1)
            fileStatusMap.delete(fileId)
            updatePreview()
          })

          actionBtn.appendChild(removeBtn)
        }

        fileItem.appendChild(thumbnail)
        fileItem.appendChild(fileInfo)
        fileItem.appendChild(actionBtn)
        previewList.appendChild(fileItem)
      })
    }

    // Helper: Get status icon
    const getStatusIcon = (status: FileUploadStatus['status']): string => {
      const icons = {
        waiting: '⏳',
        uploading: '⬆️',
        success: '✓',
        failed: '✗'
      }
      return icons[status]
    }

    // Helper: Get status display info
    const getStatusInfo = (status: FileUploadStatus): { text: string; color: string } => {
      const colors = {
        waiting: '#6b7280',
        uploading: '#3b82f6',
        success: '#10b981',
        failed: '#ef4444'
      }

      let text = ''
      switch (status.status) {
        case 'waiting':
          text = '等待上传...'
          break
        case 'uploading':
          text = status.progress !== undefined ? `上传中 ${status.progress}%` : '上传中...'
          break
        case 'success':
          text = '✓ 上传成功'
          break
        case 'failed':
          text = status.error ? `✗ ${status.error}` : '✗ 上传失败'
          break
      }

      return {
        text: `${formatFileSize(status.file.size)} • ${text}`,
        color: colors[status.status]
      }
    }

    // Helper function to format file size
    const formatFileSize = (bytes: number): string => {
      if (bytes === 0) return '0 B'
      const k = 1024
      const sizes = ['B', 'KB', 'MB', 'GB']
      const i = Math.floor(Math.log(bytes) / Math.log(k))
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
    }

    const cleanup = (result: CustomFilePickerResult) => {
      dialog.style.opacity = '0'
      dialog.style.transform = 'scale(0.95)'
      
      // Clean up all event listeners
      document.removeEventListener('mousemove', drag)
      document.removeEventListener('mouseup', dragEnd)
      document.removeEventListener('keydown', handleEscape)
      document.removeEventListener('paste', handlePaste)
      
      setTimeout(() => {
        if (dialog.parentElement) {
          dialog.parentElement.removeChild(dialog)
        }
        resolve(result)
      }, 150)
    }

    // Handle paste event for images
    const handlePaste = async (e: ClipboardEvent) => {
      // Only handle paste when dialog is visible and not for folder selection
      if (directory) return

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
            const renamedFile = new File(
              [file],
              `pasted-image-${timestamp}.${extension}`,
              { type: file.type }
            )
            imageFiles.push(renamedFile)
            
            // If not multiple mode, only take the first image
            if (!multiple) break
          }
        }
      }

      // If we found image files, add them to selection
      if (imageFiles.length > 0) {
        e.preventDefault()
        
        if (multiple) {
          // Add to existing selection
          selectedFiles.push(...imageFiles)
        } else {
          // Replace selection
          selectedFiles = imageFiles
        }
        
        updatePreview()
      }
    }

    // ESC key handler (declare before cleanup so it can be referenced)
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        cleanup({
          files: [],
          cancelled: true
        })
      }
    }

    // Add paste event listener
    document.addEventListener('paste', handlePaste)
    document.addEventListener('keydown', handleEscape)

    // Handle file selection from native input
    nativeInput.addEventListener('change', (e: Event) => {
      const files = (e.target as HTMLInputElement).files
      if (files && files.length > 0) {
        if (multiple) {
          // Add to existing selection
          selectedFiles.push(...Array.from(files))
        } else {
          // Replace selection
          selectedFiles = Array.from(files)
        }
        updatePreview()
        // Reset input so the same file can be selected again
        nativeInput.value = ''
      }
    })

    // Select button opens native picker
    selectButton.addEventListener('click', () => {
      nativeInput.click()
    })

    // Cancel/Close button - allow closing during upload
    cancelButton.addEventListener('click', () => {
      if (uploadComplete || !isUploading) {
        cleanup({
          files: isUploading ? selectedFiles : [],
          cancelled: !uploadComplete
        })
      }
    })

    // Close button
    closeBtn.addEventListener('click', () => {
      if (uploadComplete || !isUploading) {
        cleanup({
          files: isUploading ? selectedFiles : [],
          cancelled: !uploadComplete
        })
      }
    })

    // Confirm button - start upload or just return files
    confirmButton.addEventListener('click', async () => {
      if (!onUpload) {
        // No upload handler, just return files
        cleanup({
          files: selectedFiles,
          cancelled: false
        })
        return
      }

      // Start upload process
      isUploading = true
      uploadComplete = false

      // Initialize status for all files
      selectedFiles.forEach((file, index) => {
        const fileId = `${file.name}-${file.size}-${index}`
        fileStatusMap.set(fileId, {
          file,
          status: 'waiting'
        })
      })

      // Update UI to upload mode
      titleEl.textContent = '上传队列'
      confirmButton.textContent = '上传中...'
      confirmButton.disabled = true
      confirmButton.style.background = '#6b7280'
      confirmButton.style.cursor = 'not-allowed'
      selectButton.style.display = 'none'
      clearAllBtn.style.display = 'none'
      fileTypeInfo.style.display = 'none'
      infoBox.style.display = 'none'
      cancelButton.textContent = '最小化'
      updatePreview()

      // Create status updater
      const updateFileStatus: FileStatusUpdater = (file, update) => {
        // Find file by content match
        const index = selectedFiles.findIndex(f => 
          f.name === file.name && f.size === file.size
        )
        if (index !== -1) {
          const fileId = `${file.name}-${file.size}-${index}`
          const currentStatus = fileStatusMap.get(fileId)
          if (currentStatus) {
            Object.assign(currentStatus, update)
            updatePreview()
          }
        }
      }

      try {
        // Execute upload
        await onUpload(selectedFiles, updateFileStatus)

        // Mark remaining as success if not updated
        selectedFiles.forEach((file, index) => {
          const fileId = `${file.name}-${file.size}-${index}`
          const status = fileStatusMap.get(fileId)
          if (status && status.status === 'waiting') {
            status.status = 'success'
          }
        })

        uploadComplete = true
        isUploading = false

        // Update UI to complete state
        confirmButton.style.display = 'none'
        cancelButton.textContent = '关闭'
        cancelButton.disabled = false
        titleEl.textContent = '上传完成'
        updatePreview()

        // Auto close after delay
        setTimeout(() => {
          cleanup({
            files: selectedFiles,
            cancelled: false
          })
        }, 2000)

      } catch (error) {
        console.error('Upload error:', error)
        isUploading = false
        
        // Update UI to error state
        confirmButton.textContent = '重试'
        confirmButton.disabled = false
        confirmButton.style.background = '#ef4444'
        confirmButton.style.cursor = 'pointer'
        cancelButton.textContent = '取消'
        titleEl.textContent = '上传失败'
        updatePreview()
      }
    })

    // Clear all button
    clearAllBtn.addEventListener('click', () => {
      selectedFiles = []
      updatePreview()
    })

    // Add animations
    const style = document.createElement('style')
    style.textContent = `
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
    `
    if (!document.querySelector('style[data-custom-picker-animations]')) {
      style.setAttribute('data-custom-picker-animations', 'true')
      document.head.appendChild(style)
    }

    document.body.appendChild(dialog)

    // Auto focus select button
    setTimeout(() => selectButton.focus(), 100)
  })
}

/**
 * Show custom file picker for images with optional upload handler
 */
export async function showCustomImagePicker(
  multiple: boolean = true,
  onUpload?: (files: File[], updateStatus: FileStatusUpdater) => Promise<void>
): Promise<File[]> {
  const result = await showCustomFilePicker({
    multiple,
    accept: 'image/*',
    directory: false,
    title: multiple ? '选择图片文件' : '选择图片',
    onUpload
  })

  return result.cancelled ? [] : result.files
}

/**
 * Show custom folder picker for images with optional upload handler
 */
export async function showCustomFolderPicker(
  onUpload?: (files: File[], updateStatus: FileStatusUpdater) => Promise<void>
): Promise<File[]> {
  const result = await showCustomFilePicker({
    multiple: true,
    accept: 'image/*',
    directory: true,
    title: '选择文件夹',
    onUpload
  })

  return result.cancelled ? [] : result.files
}
