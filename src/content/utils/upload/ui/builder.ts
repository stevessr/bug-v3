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
      width: 520px;
      max-width: 92vw;
      max-height: 90vh;
      overflow-y: auto;
      background: var(--primary-very-low);
      border-radius: 12px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `
  })

  // ---- Sub-panels (created before the header so the header can host the
  //      image/video mode toggle that lives in the regular panel) ----
  const regular = createRegularPanel()
  const folder = createFolderPanel()
  const diff = createDiffPanel()
  const url = createUrlPanel()

  const header = createE('div', {
    style: `
      padding: 18px 24px 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      cursor: move;
      user-select: none; -webkit-user-select: none;
    `
  })

  const titleGroup = createE('div', {
    style: 'display: flex; align-items: center; gap: 10px; min-width: 0; flex-wrap: wrap;'
  })

  const title = createE('h2', {
    text: '上传图片',
    style: 'margin: 0; font-size: 18px; font-weight: 600; color: var(--primary);'
  })

  titleGroup.appendChild(title)
  titleGroup.appendChild(regular.modeToggle)

  // Keep the dialog title in sync with the selected upload mode.
  regular.onModeChange(mode => {
    title.textContent = mode === 'video' ? '上传视频' : '上传图片'
  })

  const closeButton = createE('button', {
    in: '✕',
    style: `
      background: none;
      border: none;
      font-size: 20px;
      line-height: 1;
      cursor: pointer;
      color: var(--primary-medium);
      padding: 4px 6px;
      border-radius: 4px;
      transition: background-color 0.2s;
    `
  })
  closeButton.addEventListener('mouseenter', () => {
    closeButton.style.backgroundColor = 'var(--primary-low)'
  })
  closeButton.addEventListener('mouseleave', () => {
    closeButton.style.backgroundColor = 'transparent'
  })

  header.appendChild(titleGroup)
  header.appendChild(closeButton)

  // ---- Tab bar ----
  // Tabs share the row equally and never wrap: the injected panel is narrow and
  // "文件夹上传" used to break onto a second line inside its tab.
  const tabContainer = createE('div', {
    style:
      'display: flex; border-bottom: 1px solid var(--primary-low); margin-bottom: 20px; gap: 2px;'
  })

  const tabStyle = (active: boolean) => `
    flex: 1 1 0;
    min-width: 0;
    padding: 9px 6px;
    background: none;
    border: none;
    border-bottom: 2px solid ${active ? 'var(--tertiary)' : 'transparent'};
    color: ${active ? 'var(--tertiary)' : 'var(--primary-medium)'};
    font-size: 13px;
    font-weight: 500;
    white-space: nowrap;
    text-align: center;
    cursor: pointer;
    transition: all 0.2s;
  `

  const regularTab = createE('button', { type: 'button', text: '常规上传', style: tabStyle(true) })
  const diffTab = createE('button', { type: 'button', text: '差分上传', style: tabStyle(false) })
  const folderTab = createE('button', {
    type: 'button',
    text: '文件夹上传',
    style: tabStyle(false)
  })
  const urlTab = createE('button', { type: 'button', text: 'URL 导入', style: tabStyle(false) })

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
      background: var(--danger-low);
      color: var(--danger);
      border: 1px solid var(--danger);
    `
  })

  // ---- Content assembly ----
  const content = createE('div', { class: 'upload-panel-content', style: 'padding: 0 24px 24px;' })
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
    // The image/video switch only applies to the regular upload tab.
    regular.modeToggle.style.display = activePanel === regular.panel ? 'inline-flex' : 'none'
    allTabs.forEach(t => {
      t.style.borderBottomColor = 'transparent'
      t.style.color = 'var(--primary-medium)'
    })
    activeTab.style.borderBottomColor = 'var(--tertiary)'
    activeTab.style.color = 'var(--tertiary)'
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
    modeToggle: regular.modeToggle,
    setUploadMode: regular.setMode,
    getUploadMode: regular.getMode,
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
