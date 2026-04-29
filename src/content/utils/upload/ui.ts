import { createE, DAEL, DOA } from '../dom/createEl'
import { customAlert, customConfirm } from '../ui/dialog'
import { showCustomImagePicker, showCustomFolderPicker } from '../picker'
import { notify } from '../ui/notify'
import { buildMarkdownImage } from '@/utils/emojiMarkdown'

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
  urlTab: HTMLElement
  urlPanel: HTMLElement
  urlTextarea: HTMLTextAreaElement
  urlImportBtn: HTMLButtonElement
  urlProgressList: HTMLElement
  statusBar: HTMLElement
  switchToTab: (tab: 'regular' | 'diff' | 'folder' | 'url') => void
  regularTab: HTMLElement
  regularPanel: HTMLElement
  dropIcon: HTMLElement
  dropText: HTMLElement
  previewGrid: HTMLElement
  uploadSelectedBtn: HTMLButtonElement
  clearBtn: HTMLButtonElement
  previewGridInner: HTMLElement
  addFilesToPreview: (files: File[]) => void
  pendingFiles: () => File[]
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

  const urlTab = createE('button', {
    text: 'URL 导入',
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
  tabContainer.appendChild(urlTab)

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

  // Regular upload panel — WYSIWYG mode
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

  // WYSIWYG preview grid — shows thumbnails before upload
  const previewGrid = createE('div', {
    style: `
      display: none;
      margin-top: 12px;
    `
  })

  const previewGridInner = createE('div', {
    style: `
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
      gap: 8px;
      max-height: 200px;
      overflow-y: auto;
      padding: 4px;
    `
  })

  const previewActions = createE('div', {
    style: `
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      margin-top: 8px;
      align-items: center;
    `
  })

  const previewCount = createE('span', {
    text: '已选择 0 个文件',
    style: `font-size: 13px; color: #6b7280; flex: 1;`
  })

  const clearBtn = createE('button', {
    text: '清空',
    style: `
      padding: 6px 14px;
      background: transparent;
      color: #6b7280;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      font-size: 13px;
      cursor: pointer;
      transition: all 0.2s;
    `
  }) as HTMLButtonElement
  clearBtn.addEventListener('mouseenter', () => { clearBtn.style.background = '#f3f4f6' })
  clearBtn.addEventListener('mouseleave', () => { clearBtn.style.background = 'transparent' })

  const uploadSelectedBtn = createE('button', {
    text: '上传选中 (0)',
    style: `
      padding: 6px 16px;
      background: #3b82f6;
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.2s;
    `
  }) as HTMLButtonElement
  uploadSelectedBtn.addEventListener('mouseenter', () => { uploadSelectedBtn.style.background = '#2563eb' })
  uploadSelectedBtn.addEventListener('mouseleave', () => { uploadSelectedBtn.style.background = '#3b82f6' })

  previewActions.appendChild(previewCount)
  previewActions.appendChild(clearBtn)
  previewActions.appendChild(uploadSelectedBtn)
  previewGrid.appendChild(previewGridInner)
  previewGrid.appendChild(previewActions)

  // Pending files awaiting user confirmation
  let pendingFiles: File[] = []

  const updatePreviewGrid = () => {
    if (pendingFiles.length === 0) {
      previewGrid.style.display = 'none'
      dropZone.style.display = 'block'
      return
    }
    previewGrid.style.display = 'block'
    dropZone.style.display = 'none'
    previewCount.textContent = `已选择 ${pendingFiles.length} 个文件`
    uploadSelectedBtn.textContent = `上传选中 (${pendingFiles.length})`
    previewGridInner.innerHTML = ''
    pendingFiles.forEach((file, idx) => {
      const item = createE('div', {
        style: `
          position: relative;
          aspect-ratio: 1;
          border-radius: 6px;
          overflow: hidden;
          border: 1px solid #e5e7eb;
          background: #f9fafb;
          cursor: default;
        `
      })
      const img = createE('img', {
        style: `
          width: 100%; height: 100%; object-fit: cover;
          display: block;
        `
      }) as HTMLImageElement
      img.src = URL.createObjectURL(file)
      img.onload = () => URL.revokeObjectURL(img.src)

      const removeBtn = createE('button', {
        text: '✕',
        style: `
          position: absolute; top: 2px; right: 2px;
          width: 18px; height: 18px;
          font-size: 10px; line-height: 1;
          background: rgba(0,0,0,0.5); color: white;
          border: none; border-radius: 50%;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          opacity: 0; transition: opacity 0.2s;
        `
      }) as HTMLButtonElement
      item.addEventListener('mouseenter', () => { removeBtn.style.opacity = '1' })
      item.addEventListener('mouseleave', () => { removeBtn.style.opacity = '0' })
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation()
        pendingFiles.splice(idx, 1)
        updatePreviewGrid()
      })

      item.appendChild(img)
      item.appendChild(removeBtn)
      previewGridInner.appendChild(item)
    })
  }

  const addFilesToPreview = (files: File[]) => {
    // Filter images only
    const imageFiles = files.filter(f => f.type.startsWith('image/'))
    if (imageFiles.length === 0) return
    pendingFiles.push(...imageFiles)
    updatePreviewGrid()
    notify(`已添加 ${imageFiles.length} 个图片到预览列表`, 'info')
  }

  const fileInput = createE('input', {
    type: 'file',
    accept: 'image/*',
    multiple: true,
    style: `
      display: none;
    `
  })

  regularPanel.appendChild(dropZone)
  regularPanel.appendChild(previewGrid)
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

  // URL import panel
  const urlPanel = createE('div', {
    class: 'url-import-panel',
    style: `
    display: none;
  `
  }) as HTMLElement

  const urlTextarea = createE('textarea', {
    ph: '每行输入一个图片 URL...',
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

  const urlImportBtn = createE('button', {
    text: '导入并上传',
    style: `
      width: 100%;
      padding: 10px 20px;
      background: #3b82f6;
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.2s;
      margin-bottom: 12px;
    `
  }) as HTMLButtonElement

  urlImportBtn.addEventListener('mouseenter', () => {
    urlImportBtn.style.background = '#2563eb'
  })
  urlImportBtn.addEventListener('mouseleave', () => {
    urlImportBtn.style.background = '#3b82f6'
  })

  const urlProgressList = createE('div', {
    style: `
      max-height: 200px;
      overflow-y: auto;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      padding: 8px;
      background: var(--d-chat-input-bg-color);
    `
  })

  urlPanel.appendChild(urlTextarea)
  urlPanel.appendChild(urlImportBtn)
  urlPanel.appendChild(urlProgressList)

  // Status bar at the bottom of content
  const statusBar = createE('div', {
    style: `
      display: none;
      padding: 8px 12px;
      margin-top: 12px;
      border-radius: 6px;
      font-size: 13px;
      align-items: center;
      justify-content: space-between;
      background: #fef2f2;
      color: #dc2626;
      border: 1px solid #fecaca;
    `
  })

  content.appendChild(tabContainer)
  content.appendChild(regularPanel)
  content.appendChild(folderPanel)
  content.appendChild(diffPanel)
  content.appendChild(urlPanel)
  content.appendChild(statusBar)

  panel.appendChild(header)
  panel.appendChild(content)

  // Tab switching logic
  const switchTab = (activeTab: HTMLElement, activePanel: HTMLElement) => {
    ;[regularTab, diffTab, folderTab, urlTab].forEach(t => {
      t.style.borderBottomColor = 'transparent'
      t.style.color = '#6b7280'
    })
    activeTab.style.borderBottomColor = '#3b82f6'
    activeTab.style.color = '#3b82f6'
    regularPanel.style.display = 'none'
    diffPanel.style.display = 'none'
    folderPanel.style.display = 'none'
    urlPanel.style.display = 'none'
    activePanel.style.display = 'block'
  }

  regularTab.addEventListener('click', () => switchTab(regularTab, regularPanel))
  diffTab.addEventListener('click', () => switchTab(diffTab, diffPanel))
  folderTab.addEventListener('click', () => switchTab(folderTab, folderPanel))
  urlTab.addEventListener('click', () => switchTab(urlTab, urlPanel))

  return {
    panel,
    overlay: null as any,
    dropZone,
    fileInput,
    closeButton,
    diffDropZone,
    diffFileInput,
    markdownTextarea,
    folderDropZone,
    folderInput,
    urlTab,
    urlPanel,
    urlTextarea,
    urlImportBtn,
    urlProgressList,
    statusBar,
    switchToTab: (tab: 'regular' | 'diff' | 'folder' | 'url') => {
      const map: Record<string, [HTMLElement, HTMLElement]> = {
        regular: [regularTab, regularPanel],
        diff: [diffTab, diffPanel],
        folder: [folderTab, folderPanel],
        url: [urlTab, urlPanel]
      }
      const [t, p] = map[tab] || map.regular
      switchTab(t, p)
    },
    regularTab,
    regularPanel,
    dropIcon,
    dropText,
    previewGrid,
    uploadSelectedBtn,
    clearBtn,
    previewGridInner,
    addFilesToPreview: (files: File[]) => {
      const imageFiles = files.filter(f => f.type.startsWith('image/'))
      if (imageFiles.length === 0) return
      pendingFiles.push(...imageFiles)
      updatePreviewGrid()
      notify(`已添加 ${imageFiles.length} 个图片到预览列表`, 'info')
    },
    pendingFiles: () => [...pendingFiles]
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
      folderInput,
      urlTextarea,
      urlImportBtn,
      urlProgressList,
      statusBar,
      switchToTab,
      dropIcon,
      dropText,
      previewGrid,
      uploadSelectedBtn,
      clearBtn,
      previewGridInner,
      addFilesToPreview,
      pendingFiles
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

    const handleFiles = async (files: FileList): Promise<void> => {
      if (!files || files.length === 0) return

      const filesArray = Array.from(files)
      notify(`开始上传 ${filesArray.length} 个文件...`, 'info')

      let successCount = 0
      let failCount = 0

      const results = await Promise.allSettled(
        filesArray.map(async file => {
          try {
            const result = await uploader.uploadImage(file)
            successCount++
            return { file, result, success: true as const }
          } catch (error: any) {
            failCount++
            console.error(`[Image Uploader] Failed to upload ${file.name}:`, error)
            return { file, error, success: false as const }
          }
        })
      )

      // Insert successful ones into editor, collect failures
      const failedItems: { file: File; error: any }[] = []
      for (const r of results) {
        if (r.status === 'fulfilled') {
          if (r.value.success) {
            const alt = r.value.result.width && r.value.result.height
              ? `${r.value.file.name}|${r.value.result.width}x${r.value.result.height}`
              : r.value.file.name
            import('./helpers').then(m => m.insertIntoEditor(buildMarkdownImage(alt, r.value.result)))
          } else {
            failedItems.push({ file: r.value.file, error: r.value.error })
          }
        } else {
          // Should not happen, but handle rejection
          const file = filesArray[results.indexOf(r)]
          failedItems.push({ file, error: r.reason })
        }
      }

      notify(
        `上传完成：${successCount} 成功，${failCount} 失败`,
        failCount === 0 ? 'success' : 'info'
      )

      if (failedItems.length > 0) {
        showRetryBar(failedItems)
      }
    }

    const showRetryBar = (failedItems: { file: File; error: any }[]) => {
      statusBar.style.display = 'flex'
      statusBar.innerHTML = `
        <span>${failedItems.length} 个文件上传失败</span>
        <button style="
          background: #dc2626;
          color: white;
          border: none;
          border-radius: 4px;
          padding: 4px 12px;
          font-size: 12px;
          cursor: pointer;
        ">重试全部</button>
      `
      const retryAllBtn = statusBar.querySelector('button')!
      switchToTab('regular')
      rebuildDropZoneForRetry(failedItems)
      retryAllBtn.addEventListener('click', async () => {
        statusBar.style.display = 'none'
        rebuildDropZoneToDefault()
        const fileList = {
          length: failedItems.length,
          item: (index: number) => failedItems[index].file,
          [Symbol.iterator]: function* () {
            for (const f of failedItems) yield f.file
          }
        }
        await handleFiles(fileList as any)
      })
    }

    const rebuildDropZoneForRetry = (failedItems: { file: File; error: any }[]) => {
      dropZone.style.cursor = 'default'
      dropZone.style.borderStyle = 'solid'
      dropZone.innerHTML = ''
      const list = createE('div', {
        style: `
          max-height: 180px; overflow-y: auto; text-align: left;
          padding: 4px;
        `
      })
      for (const { file, error } of failedItems) {
        const item = createE('div', {
          style: `
            display: flex; align-items: center; gap: 8px;
            padding: 6px 8px; font-size: 13px;
            border-bottom: 1px solid #f3f4f6;
          `
        })
        const nameSpan = createE('span', {
          text: file.name,
          style: `flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #dc2626;`
        })
        const retryBtn = createE('button', {
          text: '重试',
          style: `
            background: #ef4444; color: white; border: none;
            border-radius: 4px; padding: 2px 10px; font-size: 12px;
            cursor: pointer;
          `
        }) as HTMLButtonElement
        retryBtn.addEventListener('click', async (e) => {
          e.stopPropagation()
          retryBtn.disabled = true
          retryBtn.textContent = '...'
          try {
            const result = await uploader.uploadImage(file)
            const alt = result.width && result.height
              ? `${file.name}|${result.width}x${result.height}`
              : file.name
            const { insertIntoEditor } = await import('./helpers')
            insertIntoEditor(buildMarkdownImage(alt, result))
            item.style.display = 'none'
            const idx = failedItems.indexOf({ file, error })
            if (idx !== -1) failedItems.splice(idx, 1)
            if (failedItems.length === 0) {
              statusBar.style.display = 'none'
              rebuildDropZoneToDefault()
            }
          } catch {
            retryBtn.disabled = false
            retryBtn.textContent = '重试'
          }
        })
        item.appendChild(nameSpan)
        item.appendChild(retryBtn)
        list.appendChild(item)
      }
      dropZone.appendChild(list)
    }

    const rebuildDropZoneToDefault = () => {
      dropZone.style.cursor = 'pointer'
      dropZone.style.borderStyle = 'dashed'
      dropZone.innerHTML = ''
      dropZone.appendChild(dropIcon.cloneNode(true))
      dropZone.appendChild(dropText.cloneNode(true))
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

    // Regular upload handlers — WYSIWYG mode
    fileInput.addEventListener('change', async (event: Event) => {
      const files = (event.target as HTMLInputElement).files
      if (files) {
        addFilesToPreview(Array.from(files))
      }
    })

    dropZone.addEventListener('click', async () => {
      // Open native file picker — files go to preview grid, not directly uploaded
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
        addFilesToPreview(Array.from(files))
      }
    })

    // Upload selected button — uploads all pending files
    uploadSelectedBtn.addEventListener('click', async () => {
      const files = pendingFiles()
      if (files.length === 0) return

      uploadSelectedBtn.disabled = true
      uploadSelectedBtn.textContent = '上传中...'
      uploadSelectedBtn.style.background = '#6b7280'

      const fileList = {
        length: files.length,
        item: (index: number) => files[index],
        [Symbol.iterator]: function* () {
          for (const f of files) yield f
        }
      }
      // Clear preview before upload (successful ones won't come back)
      pendingFiles.length = 0
      updatePreviewGrid()
      await uploadAndInsert(fileList as any)
      // Remaining failures were re-added to pendingFiles via handleFiles
    })

    clearBtn.addEventListener('click', () => {
      pendingFiles.length = 0
      updatePreviewGrid()
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

    // No polling — status bar is shown reactively via showRetryBar()
    // Clipboard paste support
    const handlePanelPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return

      const imageFiles: File[] = []
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
            const extension = file.type.split('/')[1] || 'png'
            const renamedFile = new File([file], `pasted-image-${timestamp}.${extension}`, {
              type: file.type
            })
            imageFiles.push(renamedFile)
          }
        }
      }

      if (imageFiles.length > 0) {
        e.preventDefault()
        notify(`从剪贴板添加 ${imageFiles.length} 个图片`, 'info')
        const fileList = {
          length: imageFiles.length,
          item: (index: number) => imageFiles[index],
          [Symbol.iterator]: function* () {
            for (const f of imageFiles) yield f
          }
        }
        handleFiles(fileList as any)
      }
    }

    DAEL('paste', handlePanelPaste)

    // URL import handler
    urlImportBtn.addEventListener('click', async () => {
      const text = urlTextarea.value.trim()
      if (!text) {
        await customAlert('请先输入图片 URL')
        return
      }

      const urls = text
        .split('\n')
        .map(u => u.trim())
        .filter(u => u.length > 0)

      if (urls.length === 0) {
        await customAlert('未找到有效的 URL')
        return
      }

      urlImportBtn.disabled = true
      urlImportBtn.textContent = '导入中...'
      urlImportBtn.style.background = '#6b7280'
      urlImportBtn.style.cursor = 'not-allowed'

      urlProgressList.innerHTML = ''
      let successCount = 0
      let failCount = 0

      for (let i = 0; i < urls.length; i++) {
        const url = urls[i]
        const row = createE('div', {
          style: `
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 6px 8px;
            font-size: 12px;
            border-bottom: 1px solid #f3f4f6;
          `
        })

        const statusIcon = createE('span', { text: '⏳' })
        const label = createE('span', {
          text: url.length > 50 ? url.slice(0, 50) + '...' : url,
          style: `
            flex: 1;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            color: #6b7280;
          `
        })
        row.appendChild(statusIcon)
        row.appendChild(label)
        urlProgressList.appendChild(row)

        try {
          // Download image via fetch
          statusIcon.textContent = '⬇️'
          const resp = await fetch(url, {
            method: 'GET',
            credentials: 'include',
            headers: { Accept: 'image/*,*/*' }
          })

          if (!resp.ok) {
            throw new Error(`HTTP ${resp.status}`)
          }

          const blob = await resp.blob()
          if (!blob.type.startsWith('image/')) {
            throw new Error('不是有效的图片')
          }

          // Extract filename from URL
          let filename = ''
          try {
            const u = new URL(url)
            const name = u.pathname.split('/').pop()
            if (name && name.includes('.')) filename = name
          } catch { /* ignore */ }
          if (!filename) {
            const ext = blob.type.split('/')[1] || 'png'
            filename = `downloaded-${Date.now()}-${i}.${ext}`
          }

          // Upload to Discourse
          statusIcon.textContent = '📤'
          await uploader.uploadDownloadedFile(blob, filename)
          successCount++
          statusIcon.textContent = '✅'
          label.style.color = '#16a34a'
          label.textContent = filename
        } catch (error: any) {
          failCount++
          statusIcon.textContent = '❌'
          label.style.color = '#dc2626'
          label.textContent = `${label.textContent} — ${error.message || '失败'}`
        }
      }

      urlImportBtn.disabled = false
      urlImportBtn.textContent = '导入并上传'
      urlImportBtn.style.background = '#3b82f6'
      urlImportBtn.style.cursor = 'pointer'

      const summary = createE('div', {
        style: `
          padding: 8px;
          font-size: 13px;
          font-weight: 500;
          text-align: center;
          color: ${failCount === 0 ? '#16a34a' : successCount > 0 ? '#d97706' : '#dc2626'};
        `
      })
      summary.textContent = `完成：${successCount} 成功，${failCount} 失败`
      urlProgressList.appendChild(summary)

      notify(`URL 导入完成：${successCount} 成功，${failCount} 失败`, failCount === 0 ? 'success' : 'info')
    })

    // Close handlers — consolidated into enhancedCleanup
    const originalCleanup = cleanup
    const enhancedCleanup = () => {
      document.removeEventListener('paste', handlePanelPaste)
      ;['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        document.removeEventListener(eventName, preventDefaults, false)
      })
      originalCleanup()
    }

    // Prevent default drag behaviors on document
    const preventDefaults = (e: Event) => {
      e.preventDefault()
      e.stopPropagation()
    }

    ;['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      DAEL(eventName, preventDefaults, false)
    })

    closeButton.addEventListener('click', enhancedCleanup)

    // No overlay to append
    DOA(panel)
  })
}
