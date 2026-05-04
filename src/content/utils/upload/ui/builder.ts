import { createE, DAEL } from '../../dom/createEl'
import { notify } from '../../ui/notify'

import { DragDropElements } from './types'

export function createDragDropUploadPanel(): DragDropElements {
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

  let clearConfirmTimer: ReturnType<typeof setTimeout> | null = null
  let clearCountdownInterval: ReturnType<typeof setInterval> | null = null
  let clearCountdown = 3

  const clearPreview = () => {
    pendingFiles.length = 0
    previewGridInner.innerHTML = ''
    fileItemMap.clear()
    refreshPreviewState()
    resetClearButton()
  }

  const resetClearButton = () => {
    if (clearConfirmTimer) {
      clearTimeout(clearConfirmTimer)
      clearConfirmTimer = null
    }
    if (clearCountdownInterval) {
      clearInterval(clearCountdownInterval)
      clearCountdownInterval = null
    }
    clearBtn.textContent = '清空'
    clearBtn.style.color = '#6b7280'
    clearBtn.style.borderColor = '#d1d5db'
    clearBtn.style.background = 'transparent'
  }

  clearBtn.addEventListener('click', () => {
    if (pendingFiles.length === 0) return
    if (clearConfirmTimer) {
      clearPreview()
    } else {
      clearCountdown = 3
      clearBtn.textContent = `确认清空？ (${clearCountdown}s)`
      clearBtn.style.color = '#ef4444'
      clearBtn.style.borderColor = '#ef4444'
      clearBtn.style.background = '#fef2f2'
      clearCountdownInterval = setInterval(() => {
        clearCountdown--
        if (clearCountdown <= 0) {
          resetClearButton()
        } else {
          clearBtn.textContent = `确认清空？ (${clearCountdown}s)`
        }
      }, 1000)
      clearConfirmTimer = setTimeout(resetClearButton, 3000)
    }
  })

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
