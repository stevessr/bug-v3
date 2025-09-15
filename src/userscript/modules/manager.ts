// Emoji management interface module
import { injectManagerStyles } from '../manager/styles'
import { userscriptState } from '../state'
import {
  saveDataToLocalStorage,
  exportUserscriptData,
  importUserscriptData,
  syncFromManager
} from '../userscript-storage'

// Create popup editor for emoji editing
function createEditorPopup(groupId: string, index: number, renderGroups: () => void, renderSelectedGroup: () => void) {
  const group = userscriptState.emojiGroups.find(g => g.id === groupId)
  if (!group) return
  const emo = group.emojis[index]
  if (!emo) return

  // Create popup backdrop
  const backdrop = document.createElement('div')
  backdrop.style.cssText = `
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

  // Create editor panel
  const editorPanel = document.createElement('div')
  editorPanel.className = 'emoji-manager-editor-panel'
  
  const editorTitle = document.createElement('h3')
  editorTitle.textContent = '编辑表情'
  editorTitle.style.cssText = 'margin: 0 0 16px 0; text-align: center;'
  
  const editorPreview = document.createElement('img')
  editorPreview.className = 'emoji-manager-editor-preview'
  editorPreview.src = emo.url
  
  const editorNameInput = document.createElement('input')
  editorNameInput.className = 'form-control'
  editorNameInput.placeholder = '名称 (alias)'
  editorNameInput.value = emo.name || ''
  
  const editorUrlInput = document.createElement('input')
  editorUrlInput.className = 'form-control'
  editorUrlInput.placeholder = '表情图片 URL'
  editorUrlInput.value = emo.url || ''
  
  const buttonContainer = document.createElement('div')
  buttonContainer.style.cssText = 'display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px;'
  
  const editorSaveBtn = document.createElement('button')
  editorSaveBtn.textContent = '保存修改'
  editorSaveBtn.className = 'btn btn-primary'
  
  const editorCancelBtn = document.createElement('button')
  editorCancelBtn.textContent = '取消'
  editorCancelBtn.className = 'btn'
  
  buttonContainer.appendChild(editorCancelBtn)
  buttonContainer.appendChild(editorSaveBtn)
  
  editorPanel.appendChild(editorTitle)
  editorPanel.appendChild(editorPreview)
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
    if (!newName || !newUrl) {
      alert('名称和 URL 均不能为空')
      return
    }
    emo.name = newName
    emo.url = newUrl
    renderGroups()
    renderSelectedGroup()
    backdrop.remove()
  })

  // Handle cancel
  editorCancelBtn.addEventListener('click', () => {
    backdrop.remove()
  })

  // Handle backdrop click
  backdrop.addEventListener('click', (e) => {
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
  const modal = document.createElement('div')
  modal.className = 'emoji-manager-wrapper'
  modal.setAttribute('role', 'dialog')
  modal.setAttribute('aria-modal', 'true')

  // Create main panel
  const panel = document.createElement('div')
  panel.className = 'emoji-manager-panel'

  // Left: groups list
  const left = document.createElement('div')
  left.className = 'emoji-manager-left'
  
  const leftHeader = document.createElement('div')
  leftHeader.className = 'emoji-manager-left-header'
  const title = document.createElement('h3')
  title.textContent = '表情管理器'
  const closeBtn = document.createElement('button')
  closeBtn.textContent = '×'
  closeBtn.className = 'btn'
  closeBtn.style.cssText = 'font-size:20px; background:none; border:none; cursor:pointer;'
  leftHeader.appendChild(title)
  leftHeader.appendChild(closeBtn)
  left.appendChild(leftHeader)

  const addGroupRow = document.createElement('div')
  addGroupRow.className = 'emoji-manager-addgroup-row'
  const addGroupInput = document.createElement('input')
  addGroupInput.placeholder = '新分组 id'
  addGroupInput.className = 'form-control'
  const addGroupBtn = document.createElement('button')
  addGroupBtn.textContent = '添加'
  addGroupBtn.className = 'btn'
  addGroupRow.appendChild(addGroupInput)
  addGroupRow.appendChild(addGroupBtn)
  left.appendChild(addGroupRow)

  const groupsList = document.createElement('div')
  groupsList.className = 'emoji-manager-groups-list'
  left.appendChild(groupsList)

  // Right: group detail and controls
  const right = document.createElement('div')
  right.className = 'emoji-manager-right'

  const rightHeader = document.createElement('div')
  rightHeader.className = 'emoji-manager-right-header'
  const groupTitle = document.createElement('h4')
  groupTitle.textContent = ''
  const deleteGroupBtn = document.createElement('button')
  deleteGroupBtn.textContent = '删除分组'
  deleteGroupBtn.className = 'btn'
  deleteGroupBtn.style.cssText =
    'background:#ef4444; color:#fff;'
  rightHeader.appendChild(groupTitle)
  rightHeader.appendChild(deleteGroupBtn)
  right.appendChild(rightHeader)

  const managerRightMain = document.createElement('div')
  managerRightMain.className = 'emoji-manager-right-main'
  
  // emojis grid
  const emojisContainer = document.createElement('div')
  emojisContainer.className = 'emoji-manager-emojis'
  managerRightMain.appendChild(emojisContainer)
  
  // Add emoji form
  const addEmojiForm = document.createElement('div')
  addEmojiForm.className = 'emoji-manager-add-emoji-form'
  const emojiUrlInput = document.createElement('input')
  emojiUrlInput.placeholder = '表情图片 URL'
  emojiUrlInput.className = 'form-control'
  const emojiNameInput = document.createElement('input')
  emojiNameInput.placeholder = '名称 (alias)'
  emojiNameInput.className = 'form-control'
  const addEmojiBtn = document.createElement('button')
  addEmojiBtn.textContent = '添加表情'
  addEmojiBtn.className = 'btn btn-primary'
  addEmojiForm.appendChild(emojiUrlInput)
  addEmojiForm.appendChild(emojiNameInput)
  addEmojiForm.appendChild(addEmojiBtn)
  managerRightMain.appendChild(addEmojiForm)
  
  right.appendChild(managerRightMain)

  // Footer actions
  const footer = document.createElement('div')
  footer.className = 'emoji-manager-footer'
  const exportBtn = document.createElement('button')
  exportBtn.textContent = '导出'
  exportBtn.className = 'btn'
  const importBtn = document.createElement('button')
  importBtn.textContent = '导入'
  importBtn.className = 'btn'
  const exitBtn = document.createElement('button')
  exitBtn.textContent = '退出'
  exitBtn.className = 'btn'
  exitBtn.addEventListener('click', () => modal.remove())
  const saveBtn = document.createElement('button')
  saveBtn.textContent = '保存'
  saveBtn.className = 'btn btn-primary'
  const syncBtn = document.createElement('button')
  syncBtn.textContent = '同步管理器'
  syncBtn.className = 'btn'
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
    // If no selection yet, default to first group (if any)
    if (!selectedGroupId && userscriptState.emojiGroups.length > 0) {
      selectedGroupId = userscriptState.emojiGroups[0].id
    }

    userscriptState.emojiGroups.forEach(g => {
      const row = document.createElement('div')
      row.style.cssText =
        'display:flex; justify-content:space-between; align-items:center; padding:6px; border-radius:4px; cursor:pointer;'
      row.tabIndex = 0
      // show friendly name when available
      row.textContent = `${g.name || g.id} (${(g.emojis || []).length})`
      row.dataset.groupId = g.id

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
      const card = document.createElement('div')
      card.className = 'emoji-manager-card'

      const img = document.createElement('img')
      img.src = emo.url
      img.alt = emo.name
      img.className = 'emoji-manager-card-img'

      const name = document.createElement('div')
      name.textContent = emo.name
      name.className = 'emoji-manager-card-name'

      const actions = document.createElement('div')
      actions.className = 'emoji-manager-card-actions'

      const edit = document.createElement('button')
      edit.textContent = '编辑'
      edit.className = 'btn btn-sm'
      edit.addEventListener('click', () => {
        showEditorFor(group.id, idx)
      })

      const del = document.createElement('button')
      del.textContent = '删除'
      del.className = 'btn btn-sm'
      del.addEventListener('click', () => {
        group.emojis.splice(idx, 1)
        renderGroups()
        renderSelectedGroup()
      })

      actions.appendChild(edit)
      actions.appendChild(del)

      card.appendChild(img)
      card.appendChild(name)
      card.appendChild(actions)
      emojisContainer.appendChild(card)
    })
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

  addEmojiBtn.addEventListener('click', () => {
    if (!selectedGroupId) return alert('请先选择分组')
    const url = (emojiUrlInput.value || '').trim()
    const name = (emojiNameInput.value || '').trim()
    if (!url || !name) return alert('请输入 url 和 名称')
    const group = userscriptState.emojiGroups.find(g => g.id === selectedGroupId)
    if (!group) return
    group.emojis = group.emojis || []
    group.emojis.push({ url, name })
    emojiUrlInput.value = ''
    emojiNameInput.value = ''
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
    const data = exportUserscriptData()
    navigator.clipboard
      .writeText(data)
      .then(() => alert('已复制到剪贴板'))
      .catch(() => {
        const ta = document.createElement('textarea')
        ta.value = data
        document.body.appendChild(ta)
        ta.select()
      })
  })

  importBtn.addEventListener('click', () => {
    const ta = document.createElement('textarea')
    ta.placeholder = '粘贴 JSON 后点击确认'
    ta.style.cssText = 'width:100%;height:200px;margin-top:8px;'
    const ok = document.createElement('button')
    ok.textContent = '确认导入'
    ok.style.cssText = 'padding:6px 8px;margin-top:6px;'
    const container = document.createElement('div')
    container.appendChild(ta)
    container.appendChild(ok)
    const importModal = document.createElement('div')
    importModal.style.cssText =
      'position:fixed;left:0;top:0;right:0;bottom:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:1000001;'
    const box = document.createElement('div')
    box.style.cssText = 'background:#fff;padding:12px;border-radius:6px;width:90%;max-width:700px;'
    box.appendChild(container)
    importModal.appendChild(box)
    document.body.appendChild(importModal)
    ok.addEventListener('click', () => {
      try {
        const json = ta.value.trim()
        if (!json) return
        const okdata = importUserscriptData(json)
        if (okdata) {
          alert('导入成功，请保存以持久化')
          loadDataFromLocalStorage()
          renderGroups()
          renderSelectedGroup()
        } else {
          alert('导入失败：格式错误')
        }
      } catch (e) {
        alert('导入异常：' + e)
      }
      importModal.remove()
    })
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
        alert('同步成功，已导入管理器数据')
        loadDataFromLocalStorage()
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

// Helper function to reload data (import)
function loadDataFromLocalStorage() {
  // This should be imported but for now we'll just reference the state
  // In a real implementation, this would trigger a reload from storage
  console.log('Data reload requested')
}