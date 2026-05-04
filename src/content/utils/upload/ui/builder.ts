import { createE, DAEL } from '../../dom/createEl'

import { DragDropElements } from './types'
import { createRegularPanel } from './panels/regularPanel'
import { createFolderPanel, createDiffPanel, createUrlPanel } from './panels/subPanels'

export function createDragDropUploadPanel(): DragDropElements {
  // ---- Panel shell ----
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
    style: 'margin: 0; font-size: 18px; font-weight: 600; color: #111827;'
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

  // ---- Tab bar ----
  const tabContainer = createE('div', {
    style: 'display: flex; border-bottom: 1px solid #e5e7eb; margin-bottom: 20px;'
  })

  const tabStyle = (active: boolean) => `
    flex: 1;
    padding: 10px 20px;
    background: none;
    border: none;
    border-bottom: 2px solid ${active ? '#3b82f6' : 'transparent'};
    color: ${active ? '#3b82f6' : '#6b7280'};
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  `

  const regularTab = createE('button', { text: '常规上传', style: tabStyle(true) })
  const diffTab = createE('button', { text: '差分上传', style: tabStyle(false) })
  const folderTab = createE('button', { text: '文件夹上传', style: tabStyle(false) })
  const urlTab = createE('button', { text: 'URL 导入', style: tabStyle(false) })

  tabContainer.appendChild(regularTab)
  tabContainer.appendChild(diffTab)
  tabContainer.appendChild(folderTab)
  tabContainer.appendChild(urlTab)

  // ---- Drag-to-move ----
  let isDragging = false
  let currentX = 0,
    currentY = 0,
    initialX = 0,
    initialY = 0

  header.addEventListener('mousedown', (e: MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return
    isDragging = true
    initialX = e.clientX - currentX
    initialY = e.clientY - currentY
    header.style.cursor = 'grabbing'
  })
  DAEL('mousemove', (e: MouseEvent) => {
    if (!isDragging) return
    e.preventDefault()
    currentX = e.clientX - initialX
    currentY = e.clientY - initialY
    panel.style.transform = `translate(calc(-50% + ${currentX}px), calc(-50% + ${currentY}px))`
  })
  DAEL('mouseup', () => {
    isDragging = false
    header.style.cursor = 'move'
  })

  // ---- Sub-panels ----
  const regular = createRegularPanel()
  const folder = createFolderPanel()
  const diff = createDiffPanel()
  const url = createUrlPanel()

  // ---- Status bar ----
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

  // ---- Content assembly ----
  const content = createE('div', { class: 'upload-panel-content', style: 'padding: 24px;' })
  content.appendChild(tabContainer)
  content.appendChild(regular.previewGrid)
  content.appendChild(regular.panel)
  content.appendChild(folder.panel)
  content.appendChild(diff.panel)
  content.appendChild(url.panel)
  content.appendChild(statusBar)

  panel.appendChild(header)
  panel.appendChild(content)

  // ---- Tab switching ----
  const allTabs = [regularTab, diffTab, folderTab, urlTab] as HTMLElement[]
  const allPanels = [regular.panel, diff.panel, folder.panel, url.panel] as HTMLElement[]

  const switchTab = (activeTab: HTMLElement, activePanel: HTMLElement) => {
    allTabs.forEach(t => {
      t.style.borderBottomColor = 'transparent'
      t.style.color = '#6b7280'
    })
    activeTab.style.borderBottomColor = '#3b82f6'
    activeTab.style.color = '#3b82f6'
    allPanels.forEach(p => {
      p.style.display = 'none'
    })
    activePanel.style.display = 'block'
  }

  regularTab.addEventListener('click', () => switchTab(regularTab, regular.panel))
  diffTab.addEventListener('click', () => switchTab(diffTab, diff.panel))
  folderTab.addEventListener('click', () => switchTab(folderTab, folder.panel))
  urlTab.addEventListener('click', () => switchTab(urlTab, url.panel))

  return {
    panel,
    overlay: null as any,
    dropZone: regular.dropZone,
    fileInput: regular.fileInput,
    closeButton,
    diffDropZone: diff.dropZone,
    diffFileInput: diff.fileInput,
    markdownTextarea: diff.textarea,
    folderDropZone: folder.dropZone,
    folderInput: folder.fileInput,
    urlTab,
    urlPanel: url.panel,
    urlTextarea: url.textarea,
    urlImportBtn: url.importBtn,
    urlProgressList: url.progressList,
    statusBar,
    switchToTab: (tab: 'regular' | 'diff' | 'folder' | 'url') => {
      const map: Record<string, [HTMLElement, HTMLElement]> = {
        regular: [regularTab, regular.panel],
        diff: [diffTab, diff.panel],
        folder: [folderTab, folder.panel],
        url: [urlTab, url.panel]
      }
      const [t, p] = map[tab] || map.regular
      switchTab(t, p)
    },
    clearPreview: regular.clearPreview,
    addFilesToPreview: regular.addFilesToPreview,
    getPendingFiles: regular.getPendingFiles,
    setUploadHandler: regular.setUploadHandler
  }
}
