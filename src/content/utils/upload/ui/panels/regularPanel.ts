import { createE } from '../../../dom/createEl'
import { notify } from '../../../ui/notify'

export interface RegularPanelAPI {
  panel: HTMLElement
  dropZone: HTMLElement
  fileInput: HTMLInputElement
  previewGrid: HTMLElement
  clearPreview: () => void
  addFilesToPreview: (files: File[]) => void
  getPendingFiles: () => File[]
  setUploadHandler: (fn: (files: File[]) => Promise<void>) => void
}

export function createRegularPanel(): RegularPanelAPI {
  const panel = createE('div', {
    class: 'regular-upload-panel',
    style: 'display: block;'
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
    style: 'font-size: 48px; margin-bottom: 16px;'
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
    style: 'display: none;'
  })

  // WYSIWYG preview grid
  const previewGrid = createE('div', {
    style: 'display: none; margin-top: 12px;'
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
    style:
      'display: flex; gap: 8px; justify-content: flex-end; margin-top: 8px; align-items: center;'
  })

  const previewCount = createE('span', {
    text: '已选择 0 个文件',
    style: 'font-size: 13px; color: #6b7280; flex: 1;'
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

  // Pending files state
  let pendingFiles: File[] = []
  let onUpload: ((files: File[]) => Promise<void>) | null = null
  const fileItemMap = new Map<File, HTMLElement>()

  const refreshPreviewState = () => {
    const count = pendingFiles.length
    previewGrid.style.display = count === 0 ? 'none' : 'block'
    previewCount.textContent = `已选择 ${count} 个文件`
    uploadSelectedBtn.textContent = `上传选中 (${count})`
  }

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
      style: 'width: 100%; height: 100%; object-fit: cover; display: block;'
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

  // Clear confirmation state
  let clearConfirmTimer: ReturnType<typeof setTimeout> | null = null
  let clearCountdownInterval: ReturnType<typeof setInterval> | null = null
  let clearCountdown = 3

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

  const clearPreview = () => {
    pendingFiles.length = 0
    previewGridInner.innerHTML = ''
    fileItemMap.clear()
    refreshPreviewState()
    resetClearButton()
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

  panel.appendChild(dropZone)
  panel.appendChild(fileInput)

  return {
    panel,
    dropZone,
    fileInput,
    previewGrid,
    clearPreview,
    addFilesToPreview,
    getPendingFiles: () => [...pendingFiles],
    setUploadHandler: (fn: (files: File[]) => Promise<void>) => {
      onUpload = fn
    }
  }
}
