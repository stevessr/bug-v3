import { createE, DAEL, DOA } from '../../dom/createEl'
import { uploader } from '../core'
import { notify } from '../../ui/notify'

import { buildMarkdownImage } from '@/utils/emojiMarkdown'


export async function uploadAndInsert(
  files: FileList | File[],
  addFilesToPreview: (files: File[]) => void,
  showRetryBar: (failedItems: { file: File; error: any }[], closePanel?: () => void) => void
): Promise<void> {
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
      const { insertIntoEditor } = await import('../helpers')
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
