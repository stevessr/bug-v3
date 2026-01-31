import { createE, DAEL, DOA } from '../dom/createEl'
import { customAlert, customConfirm } from '../ui/dialog'
import { showCustomImagePicker, showCustomFolderPicker } from '../picker'
import { notify } from '../ui/notify'

import { uploader } from './core'
import { parseImageFilenamesFromMarkdown } from './helpers'

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
      user-select: none; -webkit-user-select: none;
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
  DAEL('mousemove', drag)
  DAEL('mouseup', dragEnd)

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

      // Upload each file and provide simple progress feedback
      const filesArray = Array.from(files)
      notify(`开始上传 ${filesArray.length} 个文件...`, 'info')

      // Track upload results for progress
      let successCount = 0
      let failCount = 0

      const uploadPromises = filesArray.map(async file => {
        try {
          const result = await uploader.uploadImage(file)
          successCount++
          const progressMsg = `已上传：${successCount} 成功，${failCount} 失败`
          notify(progressMsg, 'info')
          return result
        } catch (error: any) {
          failCount++
          console.error(`[Image Uploader] Failed to upload ${file.name}:`, error)
          const progressMsg = `已上传：${successCount} 成功，${failCount} 失败`
          notify(progressMsg, 'error')
          throw error
        }
      })

      try {
        await Promise.allSettled(uploadPromises)
        notify(
          `上传完成：${successCount} 成功，${failCount} 失败`,
          successCount > 0 ? 'success' : 'info'
        )
      } catch (error) {
        console.error('[Image Uploader] Drag-and-drop upload failed:', error)
      }
    }

    const handleDiffFiles = async (files: FileList) => {
      if (!files || files.length === 0) return

      const markdownText = markdownTextarea.value.trim()

      if (!markdownText) {
        await customAlert('请先在上方文本框中粘贴包含图片的 markdown 文本')
        return
      }

      // Extract existing filenames from markdown using the same logic as parseImageFilenamesFromMarkdown
      const existingFilenames = parseImageFilenamesFromMarkdown(markdownText)

      // Also extract filenames from URLs as a fallback
      const urlFilenames =
        markdownText
          .match(/!\[.*?\]\((.*?)\)/g)
          ?.map(match => {
            const url = match.match(/!\[.*?\]\((.*?)\)/)?.[1] || ''
            return url.split('/').pop()?.split('?')[0] || '' // Remove query params
          })
          .filter(Boolean) || []

      // Combine both lists for comprehensive checking
      const allExistingFilenames = new Set([...existingFilenames, ...urlFilenames])

      // Filter files that are not in the existing list
      const filesToUpload = Array.from(files).filter(file => {
        return !allExistingFilenames.has(file.name)
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
          `发现 ${skippedCount} 个图片已存在于 markdown 文本中，将被跳过。是否继续上传剩余 ${filesToUpload.length} 个图片？`
        )
        if (!proceed) {
          return
        }
      }

      // Don't cleanup - keep the window open
      // cleanup()

      // Upload progress with status updates
      notify(`开始差分上传 ${filesToUpload.length} 个新文件...`, 'info')

      // Track upload results for progress
      let successCount = 0
      let failCount = 0

      const uploadPromises = filesToUpload.map(async file => {
        try {
          const result = await uploader.uploadImage(file)
          successCount++
          const progressMsg = `差分上传：${successCount}/${filesToUpload.length} (成功)`
          notify(progressMsg, 'info')
          return result
        } catch (error: any) {
          failCount++
          console.error(`[Image Uploader] Failed to upload ${file.name}:`, error)
          notify(`差分上传 ${file.name} 失败：${error.message || '上传失败'}`, 'error')
          throw error
        }
      })

      try {
        await Promise.allSettled(uploadPromises)
        // Show summary notification
        notify(
          `差分上传完成：已跳过 ${files.length - filesToUpload.length} 个重复文件，上传 ${successCount} 个新文件，${failCount} 个失败`,
          successCount > 0 ? 'success' : 'info'
        )
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

      if (!markdownText) {
        await customAlert('请先在上方文本框中粘贴包含图片的 markdown 文本')
        return
      }

      // Extract existing filenames from markdown
      const existingFilenames = parseImageFilenamesFromMarkdown(markdownText)

      // Also extract filenames from URLs as a fallback
      const urlFilenames =
        markdownText
          .match(/!\[.*?\]\((.*?)\)/g)
          ?.map(match => {
            const url = match.match(/!\[.*?\]\((.*?)\)/)?.[1] || ''
            return url.split('/').pop()?.split('?')[0] || '' // Remove query params
          })
          .filter(Boolean) || []

      // Combine both lists for comprehensive checking
      const allExistingFilenames = new Set([...existingFilenames, ...urlFilenames])

      // Use custom file picker with file filter
      await showCustomImagePicker(
        true,
        async (files, updateStatus) => {
          // Upload filtered files
          let uploadCount = 0

          for (const file of files) {
            try {
              updateStatus(file, { status: 'uploading', progress: 0 })
              const result = await uploader.uploadImage(file)
              updateStatus(file, { status: 'success', url: result.url })
              uploadCount++
            } catch (error: any) {
              console.error(`Failed to upload ${file.name}:`, error)
              updateStatus(file, { status: 'failed', error: error.message || '上传失败' })
            }
          }

          // Show summary notification if any files were uploaded
          if (uploadCount > 0) {
            notify(`差分上传完成：成功上传 ${uploadCount} 个文件`, 'success')
          }
        },
        // File filter function
        (file: File) => {
          if (allExistingFilenames.has(file.name)) {
            return {
              shouldKeep: false,
              skipReason: '已存在于 markdown 中'
            }
          }
          return { shouldKeep: true }
        }
      )
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
      DAEL(eventName, preventDefaults, false)
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
    DOA(panel)
  })
}
