import { createE, DAEL, DOA } from '../dom/createEl'
import { customAlert, customConfirm } from '../ui/dialog'
import { showCustomImagePicker, showCustomFolderPicker } from '../picker'
import { notify } from '../ui/notify'

import { uploader } from './core'
import { parseImageFilenamesFromMarkdown } from './helpers'

import { buildMarkdownImage } from '@/utils/emojiMarkdown'

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
  addFilesToPreview: (files: File[]) => void
  clearPreview: () => void
  getPendingFiles: () => File[]
  setUploadHandler: (fn: (files: File[]) => Promise<void>) => void
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
  clearBtn.addEventListener('mouseenter', () => {
    clearBtn.style.background = '#f3f4f6'
  })
  clearBtn.addEventListener('mouseleave', () => {
    clearBtn.style.background = 'transparent'
  })

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
  uploadSelectedBtn.addEventListener('mouseenter', () => {
    uploadSelectedBtn.style.background = '#2563eb'
  })
  uploadSelectedBtn.addEventListener('mouseleave', () => {
    uploadSelectedBtn.style.background = '#3b82f6'
  })

  previewActions.appendChild(previewCount)
  previewActions.appendChild(clearBtn)
  previewActions.appendChild(uploadSelectedBtn)
  previewGrid.appendChild(previewGridInner)
  previewGrid.appendChild(previewActions)

  // Pending files awaiting user confirmation
  let pendingFiles: File[] = []
  let onUpload: ((files: File[]) => Promise<void>) | null = null
  const fileItemMap = new Map<File, HTMLElement>()

  const createPreviewItem = (file: File): HTMLElement => {
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
    item.addEventListener('mouseenter', () => {
      removeBtn.style.opacity = '1'
    })
    item.addEventListener('mouseleave', () => {
      removeBtn.style.opacity = '0'
    })
    removeBtn.addEventListener('click', e => {
      e.stopPropagation()
      pendingFiles = pendingFiles.filter(f => f !== file)
      const el = fileItemMap.get(file)
      if (el) {
        el.remove()
        fileItemMap.delete(file)
      }
      refreshPreviewState()
    })

    item.appendChild(img)
    item.appendChild(removeBtn)
    fileItemMap.set(file, item)
    return item
  }

  const refreshPreviewState = () => {
    const count = pendingFiles.length
    if (count === 0) {
      previewGrid.style.display = 'none'
    } else {
      previewGrid.style.display = 'block'
    }
    previewCount.textContent = `已选择 ${count} 个文件`
    uploadSelectedBtn.textContent = `上传选中 (${count})`
  }

  const clearPreview = () => {
    pendingFiles.length = 0
    previewGridInner.innerHTML = ''
    fileItemMap.clear()
    refreshPreviewState()
  }
  uploadSelectedBtn.addEventListener('click', async () => {
    if (!onUpload) return
    const files = [...pendingFiles]
    if (files.length === 0) return
    uploadSelectedBtn.disabled = true
    uploadSelectedBtn.textContent = '上传中...'
    uploadSelectedBtn.style.background = '#6b7280'
    clearPreview()
    await onUpload(files)
    uploadSelectedBtn.disabled = false
    uploadSelectedBtn.textContent =
      pendingFiles.length > 0 ? `上传选中 (${pendingFiles.length})` : `上传选中 (0)`
    uploadSelectedBtn.style.background = '#3b82f6'
  })
  clearBtn.addEventListener('click', clearPreview)

  const addFilesToPreview = (files: File[]) => {
    const imageFiles = files.filter(f => f.type.startsWith('image/'))
    if (imageFiles.length === 0) return
    for (const file of imageFiles) {
      pendingFiles.push(file)
      previewGridInner.appendChild(createPreviewItem(file))
    }
    refreshPreviewState()
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
  content.appendChild(previewGrid)
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
    clearPreview,
    addFilesToPreview,
    getPendingFiles: () => [...pendingFiles],
    setUploadHandler: (fn: (files: File[]) => Promise<void>) => {
      onUpload = fn
    }
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
      addFilesToPreview,
      clearPreview,
      getPendingFiles,
      setUploadHandler
    } = createDragDropUploadPanel()

    let isDragOver = false
    let isDiffDragOver = false
    let isFolderDragOver = false

    // Wire the panel's upload button to our uploadAndInsert
    setUploadHandler(async (files: File[]) => {
      const fileList = {
        length: files.length,
        item: (index: number) => files[index],
        [Symbol.iterator]: function* () {
          for (const f of files) yield f
        }
      }
      await uploadAndInsert(fileList as any)
    })

    const cleanup = () => {
      if (panel.parentElement) {
        document.body.removeChild(panel)
      }
      resolve()
    }

    const uploadAndInsert = async (files: FileList): Promise<void> => {
      if (!files || files.length === 0) return

      const filesArray = Array.from(files)

      // Create floating progress panel — draggable, no backdrop
      const progressPanel = createE('div', {
        style: `
          position: fixed; top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          width: 460px; max-width: 90vw;
          background: var(--primary-very-low);
          border-radius: 12px;
          box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04);
          z-index: 10001;
          padding: 20px 24px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `
      })
      // Drag logic
      let pDrag = false,
        pX = 0,
        pY = 0,
        pIX = 0,
        pIY = 0
      progressPanel.addEventListener('mousedown', (e: MouseEvent) => {
        if ((e.target as HTMLElement).closest('button,input,textarea,.progress-list')) return
        pDrag = true
        pIX = e.clientX - pX
        pIY = e.clientY - pY
        progressPanel.style.cursor = 'grabbing'
      })
      DAEL('mousemove', (e: MouseEvent) => {
        if (!pDrag) return
        e.preventDefault()
        pX = e.clientX - pIX
        pY = e.clientY - pIY
        progressPanel.style.transform = `translate(calc(-50% + ${pX}px), calc(-50% + ${pY}px))`
      })
      DAEL('mouseup', () => {
        pDrag = false
        progressPanel.style.cursor = ''
      })

      const progressTitle = createE('div', {
        style: `
          font-size: 15px; font-weight: 600; color: var(--primary);
          margin-bottom: 12px; cursor: move; user-select: none;
        `
      })
      const svgNS = 'http://www.w3.org/2000/svg'
      const progressBarOuter = createE('div', {
        style: `
          width: 100%; height: 8px;
          background: var(--primary-low);
          border-radius: 4px; overflow: hidden; margin-bottom: 12px;
        `
      })
      const progressBarInner = createE('div', {
        style: `
          width: 0%; height: 100%;
          background: var(--tertiary);
          border-radius: 4px; transition: width 0.3s ease;
        `
      })
      progressBarOuter.appendChild(progressBarInner)
      const progressList = createE('div', {
        style: `max-height: 260px; overflow-y: auto; font-size: 13px;`
      })
      progressList.classList.add('progress-list')
      progressPanel.appendChild(progressTitle)
      progressPanel.appendChild(progressBarOuter)
      progressPanel.appendChild(progressList)
      DOA(progressPanel)

      const successIcon = `<svg xmlns="${svgNS}" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>`
      const failIcon = `<svg xmlns="${svgNS}" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`
      const spinnerSvg = `<svg xmlns="${svgNS}" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--tertiary)" stroke-width="2" style="animation:fa-spin 1s linear infinite"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>`

      let successCount = 0
      let failCount = 0
      const failedItems: { file: File; error: any }[] = []
      const rowMap = new Map<
        string,
        { row: HTMLElement; iconSpan: HTMLElement; nameSpan: HTMLElement }
      >()
      const currentProgressPanel = progressPanel

      const updateProgress = (
        done: number,
        total: number,
        file: File,
        status: 'uploading' | 'success' | 'failed',
        errMsg?: string
      ) => {
        progressTitle.innerHTML = `
          <span>上传中 ${total - done > 0 ? total - done : '—'}</span>
          <span style="color:var(--success);margin-left:12px">成功 ${successCount}</span>
          <span style="color:var(--danger);margin-left:8px">失败 ${failCount}</span>
        `
        progressBarInner.style.width = `${(done / total) * 100}%`

        let entry = rowMap.get(file.name)
        if (!entry) {
          const row = createE('div', {
            style: `
              display: flex; align-items: center; gap: 10px;
              padding: 6px 4px; border-bottom: 1px solid var(--primary-low);
            `
          })
          const thumb = createE('img', {
            style: `
              width: 36px; height: 36px; border-radius: 4px;
              object-fit: cover; flex-shrink: 0;
              background: var(--primary-low);
            `
          }) as HTMLImageElement
          thumb.src = URL.createObjectURL(file)
          thumb.onload = () => URL.revokeObjectURL(thumb.src)
          const iconSpan = createE('div', {
            style: `flex-shrink:0;width:16px;height:16px;display:flex;align-items:center;`
          })
          const nameSpan = createE('span', {
            style: `
              flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
            `
          })
          row.appendChild(thumb)
          row.appendChild(iconSpan)
          row.appendChild(nameSpan)
          progressList.appendChild(row)
          entry = { row, iconSpan, nameSpan }
          rowMap.set(file.name, entry)
        }
        entry.iconSpan.innerHTML =
          status === 'success' ? successIcon : status === 'failed' ? failIcon : spinnerSvg
        entry.nameSpan.textContent = errMsg ? `${file.name} — ${errMsg}` : file.name
        entry.nameSpan.style.color = status === 'failed' ? 'var(--danger)' : 'var(--primary)'
        progressList.scrollTop = progressList.scrollHeight
      }

      for (let i = 0; i < filesArray.length; i++) {
        const file = filesArray[i]
        updateProgress(i, filesArray.length, file, 'uploading')

        try {
          const result = await uploader.uploadImage(file)
          successCount++
          updateProgress(i + 1, filesArray.length, file, 'success')

          // Insert into editor immediately on success
          const alt =
            result.width && result.height
              ? `${file.name}|${result.width}x${result.height}`
              : file.name
          const { insertIntoEditor } = await import('./helpers')
          insertIntoEditor(buildMarkdownImage(alt, result))
        } catch (error: any) {
          failCount++
          updateProgress(i + 1, filesArray.length, file, 'failed', error.message || '上传失败')
          failedItems.push({ file, error })
        }
      }

      // Close progress panel after 1.5s, but keep reference for retry handling
      const closePanel = () => {
        if (currentProgressPanel && currentProgressPanel.parentElement) {
          currentProgressPanel.parentElement.removeChild(currentProgressPanel)
        }
      }
      setTimeout(closePanel, 1500)

      notify(
        `上传完成：${successCount} 成功，${failCount} 失败`,
        failCount === 0 ? 'success' : 'info'
      )

      if (failedItems.length > 0) {
        addFilesToPreview(failedItems.map(f => f.file))
        showRetryBar(failedItems, closePanel)
      }
    }

    const showRetryBar = (failedItems: { file: File; error: any }[], closePanel?: () => void) => {
      // Close any lingering progress panel before retrying
      if (closePanel) closePanel()
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
      const retryAllBtn = statusBar.querySelector('button')
      if (!retryAllBtn) return
      switchToTab('regular')
      retryAllBtn.addEventListener('click', async () => {
        statusBar.style.display = 'none'
        const files = getPendingFiles()
        if (files.length === 0) return
        clearPreview()
        const fileList = {
          length: files.length,
          item: (index: number) => files[index],
          [Symbol.iterator]: function* () {
            for (const f of files) yield f
          }
        }
        await uploadAndInsert(fileList as any)
      })
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

    // Upload selected button wired inside panel via setUploadHandler
    // Clear btn wired inside panel

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
        await uploadAndInsert(files)
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
          await uploadAndInsert(fileList as any)
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
        addFilesToPreview(imageFiles)
      }
    }

    urlTextarea.addEventListener('paste', handlePanelPaste)

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
          } catch {
            /* ignore */
          }
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

      notify(
        `URL 导入完成：${successCount} 成功，${failCount} 失败`,
        failCount === 0 ? 'success' : 'info'
      )
    })

    // Close handlers — consolidated into enhancedCleanup
    const originalCleanup = cleanup
    const enhancedCleanup = () => {
      urlTextarea.removeEventListener('paste', handlePanelPaste)
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
