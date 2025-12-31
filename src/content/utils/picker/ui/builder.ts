import { createE } from '../../createEl'
import type { PickerUI } from '../types'

export function createPickerUI(
  title: string,
  multiple: boolean,
  accept: string,
  directory: boolean
): PickerUI {
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
      user-select: none; -webkit-user-select: none;
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

  return {
    dialog,
    header,
    titleEl,
    closeBtn,
    content,
    previewContainer,
    previewTitleText,
    previewList,
    fileTypeInfo,
    nativeInput,
    infoBox,
    cancelButton,
    selectButton,
    confirmButton,
    clearAllBtn
  }
}
