// Emoji management interface module
// 
// Injection Configuration (inspired by magnific-popup.ts):
// - Selectors: Target containers and buttons (e.g., '.emoji-manager-card', '.btn')
// - Parsers: Extract emoji data from URL inputs, name inputs, and dimension inputs
// - Injection Points: Add emoji cards to the grid, insert buttons into action rows
//
import { injectManagerStyles } from '../manager/styles'
import { createEl } from '../utils/createEl'
import { userscriptState } from '../state'
import { ensureHoverPreview } from '../utils/hoverPreview'
import {
  saveDataToLocalStorage,
  syncFromManager,
  loadDataFromLocalStorage
} from '../userscript-storage'

import { showImportExportModal } from './importExport'

// Emoji injection configuration (inspired by magnific-popup.ts)
interface EmojiInjectionConfig {
  // Selectors for finding target elements
  selectors: {
    container: string           // Main container for emoji grid
    card: string                // Individual emoji card
    actionRow: string           // Action button row in card
    editButton: string          // Edit button selector
    deleteButton: string        // Delete button selector
  }
  // Parsers for extracting emoji data
  parsers: {
    getUrl: (inputs: { urlInput: HTMLInputElement }) => string
    getName: (inputs: { nameInput: HTMLInputElement; urlInput: HTMLInputElement }) => string
    getWidth: (inputs: { widthInput: HTMLInputElement }) => number | undefined
    getHeight: (inputs: { heightInput: HTMLInputElement }) => number | undefined
  }
  // Injection points for adding buttons/elements
  injectionPoints: {
    addButton: (parent: HTMLElement, button: HTMLElement) => void
    insertCard: (container: HTMLElement, card: HTMLElement) => void
  }
}

const emojiManagerConfig: EmojiInjectionConfig = {
  selectors: {
    container: '.emoji-manager-emojis',
    card: '.emoji-manager-card',
    actionRow: '.emoji-manager-card-actions',
    editButton: '.btn.btn-sm:first-child',
    deleteButton: '.btn.btn-sm:last-child'
  },
  parsers: {
    getUrl: ({ urlInput }) => (urlInput.value || '').trim(),
    getName: ({ nameInput, urlInput }) => {
      const name = (nameInput.value || '').trim()
      // Fallback: extract from URL if name is empty
      if (!name && urlInput.value) {
        const url = urlInput.value.trim()
        const lastPart = url.split('/').pop() || ''
        const withoutExt = lastPart.replace(/\.[^.]+$/, '')
        return withoutExt || '表情'
      }
      return name || '表情'
    },
    getWidth: ({ widthInput }) => {
      const val = (widthInput.value || '').trim()
      const parsed = parseInt(val, 10)
      return !isNaN(parsed) && parsed > 0 ? parsed : undefined
    },
    getHeight: ({ heightInput }) => {
      const val = (heightInput.value || '').trim()
      const parsed = parseInt(val, 10)
      return !isNaN(parsed) && parsed > 0 ? parsed : undefined
    }
  },
  injectionPoints: {
    addButton: (parent, button) => {
      // Insert button at the end of parent
      parent.appendChild(button)
    },
    insertCard: (container, card) => {
      // Append card to emoji grid
      container.appendChild(card)
    }
  }
}

// Create popup editor for emoji editing
function createEditorPopup(
  groupId: string,
  index: number,
  renderGroups: () => void,
  renderSelectedGroup: () => void
) {
  const group = userscriptState.emojiGroups.find(g => g.id === groupId)
  if (!group) return
  const emo = group.emojis[index]
  if (!emo) return

  // Create popup backdrop
  const backdrop = createEl('div', {
    style: `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.5);
    z-index: 1000000;
    display: flex;
    align-items: center;
    justify-content: center;
  `
  }) as HTMLDivElement

  // Create editor panel
  const editorPanel = createEl('div', { className: 'emoji-manager-editor-panel' }) as HTMLDivElement

  const editorTitle = createEl('h3', {
    text: '编辑表情',
    className: 'emoji-manager-editor-title',
    style: 'margin: 0 0 16px 0; text-align: center;'
  })

  const editorPreview = createEl('img', {
    className: 'emoji-manager-editor-preview'
  }) as HTMLImageElement
  editorPreview.src = emo.url

  // width/height inputs for editor (use createEl factory)
  const editorWidthInput = createEl('input', {
    className: 'form-control',
    placeholder: '宽度 (px) 可选',
    value: emo.width ? String(emo.width) : ''
  }) as HTMLInputElement

  const editorHeightInput = createEl('input', {
    className: 'form-control',
    placeholder: '高度 (px) 可选',
    value: emo.height ? String(emo.height) : ''
  }) as HTMLInputElement

  const editorNameInput = createEl('input', {
    className: 'form-control',
    placeholder: '名称 (alias)',
    value: emo.name || ''
  }) as HTMLInputElement

  const editorUrlInput = createEl('input', {
    className: 'form-control',
    placeholder: '表情图片 URL',
    value: emo.url || ''
  }) as HTMLInputElement

  const buttonContainer = createEl('div', {
    style: 'display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px;'
  }) as HTMLDivElement

  const editorSaveBtn = createEl('button', { text: '保存修改', className: 'btn btn-primary' })
  const editorCancelBtn = createEl('button', { text: '取消', className: 'btn' })

  buttonContainer.appendChild(editorCancelBtn)
  buttonContainer.appendChild(editorSaveBtn)

  editorPanel.appendChild(editorTitle)
  editorPanel.appendChild(editorPreview)
  editorPanel.appendChild(editorWidthInput)
  editorPanel.appendChild(editorHeightInput)
  editorPanel.appendChild(editorNameInput)
  editorPanel.appendChild(editorUrlInput)
  editorPanel.appendChild(buttonContainer)

  backdrop.appendChild(editorPanel)
  document.body.appendChild(backdrop)

  // Update preview when URL changes
  editorUrlInput.addEventListener('input', () => {
    editorPreview.src = editorUrlInput.value
  })

  // Handle save
  editorSaveBtn.addEventListener('click', () => {
    const newName = (editorNameInput.value || '').trim()
    const newUrl = (editorUrlInput.value || '').trim()
    const newWidth = parseInt((editorWidthInput.value || '').trim(), 10)
    const newHeight = parseInt((editorHeightInput.value || '').trim(), 10)
    if (!newName || !newUrl) {
      alert('名称和 URL 均不能为空')
      return
    }
    emo.name = newName
    emo.url = newUrl
    if (!isNaN(newWidth) && newWidth > 0) emo.width = newWidth
    else delete emo.width
    if (!isNaN(newHeight) && newHeight > 0) emo.height = newHeight
    else delete emo.height
    renderGroups()
    renderSelectedGroup()
    backdrop.remove()
  })

  // Handle cancel
  editorCancelBtn.addEventListener('click', () => {
    backdrop.remove()
  })

  // Handle backdrop click
  backdrop.addEventListener('click', e => {
    if (e.target === backdrop) {
      backdrop.remove()
    }
  })
}

// Main management interface
export function openManagementInterface() {
  // ensure manager styles are injected
  injectManagerStyles()

  // Create modal wrapper
  const modal = createEl('div', {
    className: 'emoji-manager-wrapper',
    attrs: { role: 'dialog', 'aria-modal': 'true' }
  }) as HTMLDivElement

  // Create main panel
  const panel = createEl('div', { className: 'emoji-manager-panel' }) as HTMLDivElement

  // Left: groups list
  const left = createEl('div', { className: 'emoji-manager-left' }) as HTMLDivElement

  const leftHeader = createEl('div', { className: 'emoji-manager-left-header' }) as HTMLDivElement
  const title = createEl('h3', { text: '表情管理器' })
  const closeBtn = createEl('button', {
    text: '×',
    className: 'btn',
    style: 'font-size:20px; background:none; border:none; cursor:pointer;'
  }) as HTMLButtonElement
  leftHeader.appendChild(title)
  leftHeader.appendChild(closeBtn)
  left.appendChild(leftHeader)

  const addGroupRow = createEl('div', { className: 'emoji-manager-addgroup-row' }) as HTMLDivElement
  const addGroupInput = createEl('input', {
    placeholder: '新分组 id',
    className: 'form-control'
  }) as HTMLInputElement
  const addGroupBtn = createEl('button', { text: '添加', className: 'btn' }) as HTMLButtonElement
  addGroupRow.appendChild(addGroupInput)
  addGroupRow.appendChild(addGroupBtn)
  left.appendChild(addGroupRow)

  // Add group selector dropdown (for mobile)
  const groupSelectorContainer = createEl('div', { 
    className: 'emoji-manager-group-selector' 
  }) as HTMLDivElement
  const groupSelector = createEl('select', {
    className: 'form-control',
    attrs: { 'aria-label': '选择表情分组' }
  }) as HTMLSelectElement
  groupSelectorContainer.appendChild(groupSelector)
  left.appendChild(groupSelectorContainer)

  const groupsList = createEl('div', { className: 'emoji-manager-groups-list' }) as HTMLDivElement
  left.appendChild(groupsList)

  // Right: group detail and controls
  const right = createEl('div', { className: 'emoji-manager-right' }) as HTMLDivElement

  const rightHeader = createEl('div', { className: 'emoji-manager-right-header' }) as HTMLDivElement
  const groupTitle = createEl('h4') as HTMLHeadingElement
  groupTitle.textContent = ''
  const deleteGroupBtn = createEl('button', {
    text: '删除分组',
    className: 'btn',
    style: 'background:#ef4444; color:#fff;'
  }) as HTMLButtonElement
  rightHeader.appendChild(groupTitle)
  rightHeader.appendChild(deleteGroupBtn)
  right.appendChild(rightHeader)

  const managerRightMain = createEl('div', {
    className: 'emoji-manager-right-main'
  }) as HTMLDivElement

  // emojis grid
  const emojisContainer = createEl('div', { className: 'emoji-manager-emojis' }) as HTMLDivElement
  managerRightMain.appendChild(emojisContainer)

  // Add emoji form
  const addEmojiForm = createEl('div', {
    className: 'emoji-manager-add-emoji-form'
  }) as HTMLDivElement
  const emojiUrlInput = createEl('input', {
    placeholder: '表情图片 URL',
    className: 'form-control'
  }) as HTMLInputElement
  const emojiNameInput = createEl('input', {
    placeholder: '名称 (alias)',
    className: 'form-control'
  }) as HTMLInputElement
  const emojiWidthInput = createEl('input', {
    placeholder: '宽度 (px) 可选',
    className: 'form-control'
  }) as HTMLInputElement
  const emojiHeightInput = createEl('input', {
    placeholder: '高度 (px) 可选',
    className: 'form-control'
  }) as HTMLInputElement
  const addEmojiBtn = createEl('button', { 
    text: '添加表情', 
    className: 'btn btn-primary',
    attrs: {
      'data-action': 'add-emoji',
      'aria-label': '添加表情到当前分组'
    }
  })
  addEmojiForm.appendChild(emojiUrlInput)
  addEmojiForm.appendChild(emojiNameInput)
  addEmojiForm.appendChild(emojiWidthInput)
  addEmojiForm.appendChild(emojiHeightInput)
  addEmojiForm.appendChild(addEmojiBtn)
  managerRightMain.appendChild(addEmojiForm)

  right.appendChild(managerRightMain)

  // Footer actions
  const footer = createEl('div', { className: 'emoji-manager-footer' }) as HTMLDivElement
  const exportBtn = createEl('button', { text: '分组导出', className: 'btn' }) as HTMLButtonElement
  const importBtn = createEl('button', { text: '分组导入', className: 'btn' }) as HTMLButtonElement
  const exitBtn = createEl('button', { text: '退出', className: 'btn' }) as HTMLButtonElement
  exitBtn.addEventListener('click', () => modal.remove())
  const saveBtn = createEl('button', {
    text: '保存',
    className: 'btn btn-primary'
  }) as HTMLButtonElement
  const syncBtn = createEl('button', { text: '同步管理器', className: 'btn' }) as HTMLButtonElement
  footer.appendChild(syncBtn)
  footer.appendChild(exportBtn)
  footer.appendChild(importBtn)
  footer.appendChild(exitBtn)
  footer.appendChild(saveBtn)

  panel.appendChild(left)
  panel.appendChild(right)

  panel.appendChild(footer)
  modal.appendChild(panel)
  document.body.appendChild(modal)

  // state
  let selectedGroupId: string | null = null

  function renderGroups() {
    groupsList.innerHTML = ''
    
    // Get current selector element
    const currentSelector = groupSelectorContainer.querySelector('select') as HTMLSelectElement
    if (currentSelector) {
      currentSelector.innerHTML = ''
    }
    
    // If no selection yet, default to first group (if any)
    if (!selectedGroupId && userscriptState.emojiGroups.length > 0) {
      selectedGroupId = userscriptState.emojiGroups[0].id
    }

    userscriptState.emojiGroups.forEach(g => {
      // Add to desktop list
      const row = createEl('div', {
        style:
          'display:flex; justify-content:space-between; align-items:center; padding:6px; border-radius:4px; cursor:pointer;',
        text: `${g.name || g.id} (${(g.emojis || []).length})`,
        attrs: {
          tabindex: '0',
          'data-group-id': g.id
        }
      }) as HTMLDivElement

      const selectGroup = () => {
        selectedGroupId = g.id
        // rerender left list so highlight is consistent
        renderGroups()
        renderSelectedGroup()
      }

      row.addEventListener('click', selectGroup)
      row.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          selectGroup()
        }
      })

      // highlight currently selected
      if (selectedGroupId === g.id) {
        row.style.background = '#f0f8ff'
      }

      groupsList.appendChild(row)
      
      // Add to mobile dropdown
      if (currentSelector) {
        const option = createEl('option', {
          text: `${g.name || g.id} (${(g.emojis || []).length})`,
          attrs: { value: g.id }
        }) as HTMLOptionElement
        
        if (selectedGroupId === g.id) {
          option.selected = true
        }
        
        currentSelector.appendChild(option)
      }
    })
  }

  function showEditorFor(groupId: string, index: number) {
    createEditorPopup(groupId, index, renderGroups, renderSelectedGroup)
  }

  function renderSelectedGroup() {
    const group = userscriptState.emojiGroups.find(g => g.id === selectedGroupId) || null
    groupTitle.textContent = group ? group.name || group.id : ''
    emojisContainer.innerHTML = ''
    if (!group) return
    const emojis = Array.isArray(group.emojis) ? group.emojis : []
    emojis.forEach((emo: any, idx: number) => {
      const card = createEl('div', { className: 'emoji-manager-card' }) as HTMLDivElement

      const img = createEl('img', {
        src: emo.url,
        alt: emo.name,
        className: 'emoji-manager-card-img'
      }) as HTMLImageElement
      const name = createEl('div', {
        text: emo.name,
        className: 'emoji-manager-card-name'
      }) as HTMLDivElement

      const actions = createEl('div', { className: 'emoji-manager-card-actions' }) as HTMLDivElement

      const edit = createEl('button', {
        text: '编辑',
        className: 'btn btn-sm',
        attrs: {
          'data-action': 'edit-emoji',
          'aria-label': `编辑表情 ${emo.name}`
        }
      }) as HTMLButtonElement
      edit.addEventListener('click', () => {
        showEditorFor(group.id, idx)
      })

      const del = createEl('button', { 
        text: '删除', 
        className: 'btn btn-sm',
        attrs: {
          'data-action': 'delete-emoji',
          'aria-label': `删除表情 ${emo.name}`
        }
      }) as HTMLButtonElement
      del.addEventListener('click', () => {
        group.emojis.splice(idx, 1)
        renderGroups()
        renderSelectedGroup()
      })

      // Use configured injection points
      emojiManagerConfig.injectionPoints.addButton(actions, edit)
      emojiManagerConfig.injectionPoints.addButton(actions, del)

      card.appendChild(img)
      card.appendChild(name)
      card.appendChild(actions)
      
      // Use configured injection to add card to container
      emojiManagerConfig.injectionPoints.insertCard(emojisContainer, card)

      // bind hover preview events
      bindHoverPreview(img, emo)
    })
  }

  function bindHoverPreview(targetImg: HTMLImageElement, emo: any) {
    const preview = ensureHoverPreview()
    const previewImg = preview.querySelector('img') as HTMLImageElement
    const previewLabel = preview.querySelector('.emoji-picker-hover-label') as HTMLDivElement | null

    function onEnter(e: MouseEvent) {
      if (previewImg) previewImg.src = emo.url
      // use specified size for preview if set, otherwise natural size constrained by CSS
      if (previewImg) {
        if (emo.width)
          previewImg.style.width = typeof emo.width === 'number' ? emo.width + 'px' : emo.width
        else previewImg.style.width = ''
        if (emo.height)
          previewImg.style.height = typeof emo.height === 'number' ? emo.height + 'px' : emo.height
        else previewImg.style.height = ''
      }
      if (previewLabel) previewLabel.textContent = emo.name || ''
      preview.style.display = 'block'
      movePreview(e)
    }
    function movePreview(e: MouseEvent) {
      const pad = 12
      const vw = window.innerWidth
      const vh = window.innerHeight
      const rect = preview.getBoundingClientRect()
      let left = e.clientX + pad
      let top = e.clientY + pad
      if (left + rect.width > vw) left = e.clientX - rect.width - pad
      if (top + rect.height > vh) top = e.clientY - rect.height - pad
      preview.style.left = left + 'px'
      preview.style.top = top + 'px'
    }
    function onLeave() {
      preview.style.display = 'none'
    }
    targetImg.addEventListener('mouseenter', onEnter)
    targetImg.addEventListener('mousemove', movePreview)
    targetImg.addEventListener('mouseleave', onLeave)
  }

  // actions
  addGroupBtn.addEventListener('click', () => {
    const id = (addGroupInput.value || '').trim()
    if (!id) return alert('请输入分组 id')
    if (userscriptState.emojiGroups.find(g => g.id === id)) return alert('分组已存在')
    userscriptState.emojiGroups.push({ id, name: id, emojis: [] })
    addGroupInput.value = ''
    // select new group
    const newIdx = userscriptState.emojiGroups.findIndex(g => g.id === id)
    if (newIdx >= 0) selectedGroupId = userscriptState.emojiGroups[newIdx].id
    renderGroups()
    renderSelectedGroup()
  })
  
  // Add event listener for mobile group selector
  groupSelector.addEventListener('change', () => {
    selectedGroupId = groupSelector.value
    renderGroups()
    renderSelectedGroup()
  })

  addEmojiBtn.addEventListener('click', () => {
    if (!selectedGroupId) return alert('请先选择分组')
    
    // Use configured parsers to extract emoji data
    const url = emojiManagerConfig.parsers.getUrl({ urlInput: emojiUrlInput })
    const name = emojiManagerConfig.parsers.getName({ 
      nameInput: emojiNameInput, 
      urlInput: emojiUrlInput 
    })
    const width = emojiManagerConfig.parsers.getWidth({ widthInput: emojiWidthInput })
    const height = emojiManagerConfig.parsers.getHeight({ heightInput: emojiHeightInput })
    
    if (!url || !name) return alert('请输入 url 和 名称')
    
    const group = userscriptState.emojiGroups.find(g => g.id === selectedGroupId)
    if (!group) return
    
    group.emojis = group.emojis || []
    const newEmo: any = { url, name }
    if (width !== undefined) newEmo.width = width
    if (height !== undefined) newEmo.height = height
    group.emojis.push(newEmo)
    
    emojiUrlInput.value = ''
    emojiNameInput.value = ''
    emojiWidthInput.value = ''
    emojiHeightInput.value = ''
    renderGroups()
    renderSelectedGroup()
  })

  deleteGroupBtn.addEventListener('click', () => {
    if (!selectedGroupId) return alert('请先选择分组')
    const idx = userscriptState.emojiGroups.findIndex(g => g.id === selectedGroupId)
    if (idx >= 0) {
      if (!confirm('确认删除该分组？该操作不可撤销')) return
      userscriptState.emojiGroups.splice(idx, 1)
      // choose next group if exists, otherwise previous, otherwise null
      if (userscriptState.emojiGroups.length > 0) {
        const next =
          userscriptState.emojiGroups[Math.min(idx, userscriptState.emojiGroups.length - 1)]
        selectedGroupId = next.id
      } else {
        selectedGroupId = null
      }
      renderGroups()
      renderSelectedGroup()
    }
  })

  exportBtn.addEventListener('click', () => {
    // 调用新的分组导入导出模态窗口，传递当前选中的分组 ID
    showImportExportModal(selectedGroupId || undefined)
  })

  importBtn.addEventListener('click', () => {
    // 调用新的分组导入导出模态窗口，传递当前选中的分组 ID
    showImportExportModal(selectedGroupId || undefined)
  })

  saveBtn.addEventListener('click', () => {
    try {
      saveDataToLocalStorage({ emojiGroups: userscriptState.emojiGroups })
      alert('已保存')
    } catch (e) {
      alert('保存失败：' + e)
    }
  })

  syncBtn.addEventListener('click', () => {
    try {
      const ok = syncFromManager()
      if (ok) {
        // reload in-memory state from storage so UI updates immediately
        const data = loadDataFromLocalStorage()
        userscriptState.emojiGroups = data.emojiGroups || []
        userscriptState.settings = data.settings || userscriptState.settings
        alert('同步成功，已导入管理器数据')
        renderGroups()
        renderSelectedGroup()
      } else {
        alert('同步未成功，未检测到管理器数据')
      }
    } catch (e) {
      alert('同步异常：' + e)
    }
  })

  closeBtn.addEventListener('click', () => modal.remove())
  modal.addEventListener('click', e => {
    if (e.target === modal) modal.remove()
  })

  // initial render
  renderGroups()
  if (userscriptState.emojiGroups.length > 0) {
    selectedGroupId = userscriptState.emojiGroups[0].id
    // highlight first
    const first = groupsList.firstChild as HTMLElement | null
    if (first) first.style.background = '#f0f8ff'
    renderSelectedGroup()
  }
}

// No-op helper removed: we now call the storage loader directly and update userscriptState
