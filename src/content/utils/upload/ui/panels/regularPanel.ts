import { createE } from '../../../dom/createEl'
import { notify } from '../../../ui/notify'

import { isVideoFileLike } from '@/utils/video/videoAnimationArgs'

export type UploadMode = 'image' | 'video'

const IMAGE_ACCEPT = 'image/*,.avif,.webp,.gif,.png,.jpg,.jpeg'
const VIDEO_ACCEPT = 'video/*,.mp4,.webm,.mov,.mkv,.m4v,.ogv'

const IMAGE_NAME_PATTERN = /\.(png|jpe?g|gif|webp|avif|bmp|svg)$/i

const isImageFileLike = (file: Pick<File, 'name' | 'type'>): boolean =>
  file.type.toLowerCase().startsWith('image/') || IMAGE_NAME_PATTERN.test(file.name)

export interface RegularPanelAPI {
  panel: HTMLElement
  dropZone: HTMLElement
  fileInput: HTMLInputElement
  previewGrid: HTMLElement
  modeToggle: HTMLElement
  clearPreview: () => void
  addFilesToPreview: (files: File[]) => void
  getPendingFiles: () => File[]
  setUploadHandler: (fn: (files: File[]) => Promise<void>) => void
  setMode: (mode: UploadMode) => void
  getMode: () => UploadMode
  onModeChange: (fn: (mode: UploadMode) => void) => void
}

export function createRegularPanel(): RegularPanelAPI {
  const panel = createE('div', {
    class: 'regular-upload-panel',
    style: 'display: block;'
  }) as HTMLElement

  // ---- 图片 / 视频 模式切换 ----
  let mode: UploadMode = 'image'
  const modeChangeListeners: Array<(mode: UploadMode) => void> = []

  const modeToggle = createE('div', {
    class: 'upload-mode-toggle',
    role: 'group',
    attrs: { 'aria-label': '上传类型' },
    style: `
      display: inline-flex;
      align-items: center;
      gap: 2px;
      padding: 2px;
      border-radius: 6px;
      background: var(--primary-low);
    `
  }) as HTMLElement

  const modeButtons: Record<UploadMode, HTMLButtonElement> = {
    image: createE('button', {
      type: 'button',
      text: '🖼️ 图片',
      ti: '只选择图片文件',
      style: `
        padding: 4px 10px;
        border: none;
        border-radius: 4px;
        background: transparent;
        color: var(--primary-high);
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s;
        white-space: nowrap;
      `
    }) as HTMLButtonElement,
    video: createE('button', {
      type: 'button',
      text: '🎬 视频',
      ti: '只选择视频文件（上传时自动转换为动图）',
      style: `
        padding: 4px 10px;
        border: none;
        border-radius: 4px;
        background: transparent;
        color: var(--primary-high);
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s;
        white-space: nowrap;
      `
    }) as HTMLButtonElement
  }

  modeToggle.appendChild(modeButtons.image)
  modeToggle.appendChild(modeButtons.video)

  const dropZone = createE('div', {
    class: 'drop-zone',
    style: `
      border: 2px dashed var(--primary-low);
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
    in: ''
  })

  const renderDropText = () => {
    const isVideoMode = mode === 'video'
    dropText.innerHTML = `
      <div style="font-size: 16px; font-weight: 500; color: var(--primary); margin-bottom: 8px;">
        ${isVideoMode ? '拖拽视频到此处，或点击选择文件' : '拖拽图片到此处，或点击选择文件'}
      </div>
      <div style="font-size: 14px; color: var(--primary-medium); line-height: 1.5;">
        ${
          isVideoMode
            ? '支持 MP4、WebM、MOV、MKV 等视频，最大 10MB<br/>上传时按选项页「视频转动图」的设置自动转换为动图'
            : '支持 JPG、PNG、GIF、WebP、AVIF 等格式，最大 10MB<br/>需要上传视频？点击上方「视频」切换上传模式'
        }
      </div>
    `
  }

  const applyModeStyles = () => {
    for (const key of ['image', 'video'] as UploadMode[]) {
      const button = modeButtons[key]
      const active = key === mode
      button.style.background = active ? 'var(--tertiary)' : 'transparent'
      button.style.color = active ? 'var(--secondary)' : 'var(--primary-high)'
    }
  }

  const applyMode = () => {
    fileInput.accept = mode === 'video' ? VIDEO_ACCEPT : IMAGE_ACCEPT
    renderDropText()
    applyModeStyles()
    for (const listener of modeChangeListeners) {
      try {
        listener(mode)
      } catch {
        // ignore listener errors
      }
    }
  }

  const setMode = (nextMode: UploadMode) => {
    if (nextMode === mode) return
    mode = nextMode
    applyMode()
  }

  modeButtons.image.addEventListener('click', () => setMode('image'))
  modeButtons.video.addEventListener('click', () => setMode('video'))

  dropZone.appendChild(dropIcon)
  dropZone.appendChild(dropText)

  const fileInput = createE('input', {
    type: 'file',
    accept: IMAGE_ACCEPT,
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
    style: 'font-size: 13px; color: var(--primary-medium); flex: 1;'
  })

  const clearBtn = createE('button', {
    text: '清空',
    style: `
      padding: 6px 14px;
      background: transparent;
      color: var(--primary-medium);
      border: 1px solid var(--primary-low);
      border-radius: 6px;
      font-size: 13px;
      cursor: pointer;
      transition: all 0.2s;
    `
  }) as HTMLButtonElement
  clearBtn.addEventListener('mouseenter', () => {
    clearBtn.style.background = 'var(--primary-low)'
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
        border: 1px solid var(--primary-low);
        background: var(--primary-very-low);
        cursor: default;
      `
    })
    const isVideo = isVideoFileLike(file)
    const media = createE(isVideo ? 'video' : 'img', {
      style: 'width: 100%; height: 100%; object-fit: cover; display: block;'
    }) as HTMLImageElement | HTMLVideoElement
    const mediaUrl = URL.createObjectURL(file)
    media.src = mediaUrl
    if (media instanceof HTMLVideoElement) {
      // Videos are converted on upload; the first frame is only a preview.
      media.muted = true
      media.preload = 'metadata'
      media.title = `${file.name}（上传时自动转换）`
      media.onloadeddata = () => URL.revokeObjectURL(mediaUrl)
      media.onerror = () => URL.revokeObjectURL(mediaUrl)
    } else {
      media.onload = () => URL.revokeObjectURL(mediaUrl)
    }

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

    item.appendChild(media)
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
    clearBtn.style.color = 'var(--primary-medium)'
    clearBtn.style.borderColor = 'var(--primary-low)'
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
    const accepted = files.filter(f => (mode === 'video' ? isVideoFileLike(f) : isImageFileLike(f)))
    const skipped = files.length - accepted.length
    if (accepted.length === 0) {
      if (skipped > 0) {
        notify(
          mode === 'video'
            ? '当前为视频上传模式，请选择视频文件或切换到图片模式'
            : '当前为图片上传模式，请选择图片文件或切换到视频模式',
          'info'
        )
      }
      return
    }
    for (const file of accepted) {
      pendingFiles.push(file)
      previewGridInner.appendChild(createPreviewItem(file))
    }
    refreshPreviewState()
    notify(
      skipped > 0
        ? `已添加 ${accepted.length} 个文件到预览列表（跳过 ${skipped} 个当前模式不支持的文件）`
        : `已添加 ${accepted.length} 个文件到预览列表`,
      'info'
    )
  }

  applyMode()

  panel.appendChild(dropZone)
  panel.appendChild(fileInput)

  return {
    panel,
    dropZone,
    fileInput,
    previewGrid,
    modeToggle,
    clearPreview,
    addFilesToPreview,
    getPendingFiles: () => [...pendingFiles],
    setUploadHandler: (fn: (files: File[]) => Promise<void>) => {
      onUpload = fn
    },
    setMode,
    getMode: () => mode,
    onModeChange: fn => {
      modeChangeListeners.push(fn)
    }
  }
}
