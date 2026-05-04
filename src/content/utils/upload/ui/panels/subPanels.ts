import { createE } from '../../../dom/createEl'

export function createFolderPanel() {
  const panel = createE('div', {
    class: 'folder-upload-panel',
    style: 'display: none;'
  }) as HTMLElement

  const dropZone = createE('div', {
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

  const icon = createE('div', {
    in: '📂',
    style: 'font-size: 48px; margin-bottom: 16px;'
  })

  const text = createE('div', {
    in: `
      <div style="font-size: 16px; font-weight: 500; color: #374151; margin-bottom: 8px;">
        拖拽文件夹到此处，或点击选择文件夹
      </div>
      <div style="font-size: 14px; color: #6b7280;">
        将上传文件夹内所有图片文件
      </div>
    `
  })

  dropZone.appendChild(icon)
  dropZone.appendChild(text)

  const fileInput = createE('input', {
    type: 'file',
    attrs: { webkitdirectory: '', directory: '', multiple: '' },
    style: 'display: none;'
  }) as HTMLInputElement

  panel.appendChild(dropZone)
  panel.appendChild(fileInput)

  return { panel, dropZone, fileInput }
}

export function createDiffPanel() {
  const panel = createE('div', {
    class: 'diff-upload-panel',
    style: 'display: none;'
  }) as HTMLElement

  const textarea = createE('textarea', {
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

  const dropZone = createE('div', {
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

  const icon = createE('div', {
    in: '📋',
    style: 'font-size: 36px; margin-bottom: 12px;'
  })

  const text = createE('div', {
    in: `
      <div style="font-size: 16px; font-weight: 500; color: #374151; margin-bottom: 8px;">
        选择图片进行差分上传
      </div>
      <div style="font-size: 14px; color: #6b7280;">
        只会上传不在上方 markdown 文本中的图片
      </div>
    `
  })

  dropZone.appendChild(icon)
  dropZone.appendChild(text)

  const fileInput = createE('input', {
    type: 'file',
    accept: 'image/*',
    multiple: true,
    style: 'display: none;'
  })

  panel.appendChild(textarea)
  panel.appendChild(dropZone)
  panel.appendChild(fileInput)

  return { panel, dropZone, fileInput, textarea }
}

export function createUrlPanel() {
  const panel = createE('div', {
    class: 'url-import-panel',
    style: 'display: none;'
  }) as HTMLElement

  const textarea = createE('textarea', {
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

  const importBtn = createE('button', {
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

  importBtn.addEventListener('mouseenter', () => {
    importBtn.style.background = '#2563eb'
  })
  importBtn.addEventListener('mouseleave', () => {
    importBtn.style.background = '#3b82f6'
  })

  const progressList = createE('div', {
    style: `
      max-height: 200px;
      overflow-y: auto;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      padding: 8px;
      background: var(--d-chat-input-bg-color);
    `
  })

  panel.appendChild(textarea)
  panel.appendChild(importBtn)
  panel.appendChild(progressList)

  return { panel, textarea, importBtn, progressList }
}
