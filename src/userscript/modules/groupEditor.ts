// Group editor module for editing emoji group names and icons
import { userscriptState } from '../state'
import { saveDataToLocalStorage } from '../userscript-storage'
import { injectGlobalThemeStyles } from '../utils/themeSupport'
import { showTemporaryMessage } from '../utils/tempMessage'
import { ensureStyleInjected } from '../utils/injectStyles'
import { createModalElement } from '../utils/editorUtils'

import { showImportExportModal } from './importExport'
import { customPrompt, customConfirm } from '../utils'

export function showGroupEditorModal() {
  // Ensure theme styles are injected
  injectGlobalThemeStyles()

  const contentHTML = `
    <div style="margin-bottom: 20px; padding: 16px; background: var(--emoji-modal-button-bg);">
      <div>编辑说明</div>
      <div>
        • 点击分组名称或图标进行编辑<br>
        • 图标支持 emoji 字符或单个字符<br>
        • 修改会立即保存到本地存储<br>
        • 使用上移/下移按钮调整分组的显示顺序
      </div>
    </div>
    
    <div id="groupsList" style="display: flex; flex-wrap: wrap; gap: 16px; max-height: 70vh; overflow-y: auto; justify-content: flex-start;">
      ${userscriptState.emojiGroups
        .map(
          (group, index) =>
            `
        <div class="group-item" data-group-id="${group.id}" data-index="${index}" style="
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 16px;
          background: var(--emoji-modal-button-bg);
          border: 1px solid var(--emoji-modal-border);
          border-radius: 8px;
          width: calc(20% - 13px);
          min-width: 200px;
          box-sizing: border-box;
        ">
          <div style="display: flex; align-items: center; gap: 8px; justify-content: flex-end;">
            <button class="delete-group" data-index="${index}" data-group-id="${group.id}" data-group-name="${group.name}" style="
              background: #dc3545;
              border: 1px solid #c82333;
              border-radius: 3px;
              padding: 4px 8px;
              cursor: pointer;
              font-size: 12px;
              color: white;
            " title="删除分组">🗑️</button>
          </div>` +
            (group.icon?.startsWith('https://')
              ? `<img class="group-icon-editor" src="${group.icon}" alt="图标" style="
            width: 100%;
            height: 100px;
            object-fit: contain;
            cursor: pointer;
          " data-group-id="${group.id}" title="点击编辑图标">`
              : `
          <div class="group-icon-editor" style="
            display: flex;
            align-items: center;
            justify-content: center;
            background: var(--secondary);
            font-size: 48px;
            user-select: none;
            cursor: pointer;
            height: 100px;
            border-radius: 6px;
          " data-group-id="${group.id}" title="点击编辑图标">
            ${group.icon || '📁'}
          </div>`) +
            `<div style="display: flex; flex-direction: column; gap: 8px;">
            <input class="group-name-editor" 
                   type="text" 
                   value="${group.name || 'Unnamed Group'}" 
                   data-group-id="${group.id}"
                   style="
                     background: var(--secondary);
                     color: var(--emoji-modal-text);
                     border: 1px solid var(--emoji-modal-border);
                     border-radius: 4px;
                     padding: 8px 12px;
                     font-size: 14px;
                     font-weight: 500;
                     width: 100%;
                     box-sizing: border-box;
                   " 
                   placeholder="分组名称">
            <div style="font-size: 12px; color: var(--emoji-modal-text); opacity: 0.7;">
              ID: ${group.id}<br>
              表情数：${group.emojis ? group.emojis.length : 0}
            </div>
          </div>
          
          <div style="display: flex; gap: 4px; justify-content: center;">
            <button class="move-up" data-index="${index}" style="
              background: var(--emoji-modal-button-bg);
              border: 1px solid var(--emoji-modal-border);
              border-radius: 3px;
              padding: 6px 12px;
              cursor: pointer;
              font-size: 12px;
              color: var(--emoji-modal-text);
              flex: 1;
            " ${index === 0 ? 'disabled' : ''}>↑ 上移</button>
            <button class="move-down" data-index="${index}" style="
              background: var(--emoji-modal-button-bg);
              border: 1px solid var(--emoji-modal-border);
              border-radius: 3px;
              padding: 6px 12px;
              cursor: pointer;
              font-size: 12px;
              color: var(--emoji-modal-text);
              flex: 1;
            " ${index === userscriptState.emojiGroups.length - 1 ? 'disabled' : ''}>↓ 下移</button>
          </div>
        </div>
      `
        )
        .join('')}
    </div>
    
    <div style="margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--emoji-modal-border); display: flex; gap: 8px; justify-content: space-between;">
      <button id="openImportExport" style="padding: 8px 16px; background: var(--emoji-modal-button-bg); color: var(--emoji-modal-text); border: 1px solid var(--emoji-modal-border); border-radius: 4px; cursor: pointer;">分组导入/导出</button>
      <div style="display: flex; gap: 8px;">
        <button id="addNewGroup" style="padding: 8px 16px; background: var(--emoji-modal-primary-bg); color: white; border: none; border-radius: 4px; cursor: pointer;">新建分组</button>
        <button id="saveAllChanges" style="padding: 8px 16px; background: var(--emoji-modal-primary-bg); color: white; border: none; border-radius: 4px; cursor: pointer;">保存所有更改</button>
      </div>
    </div>
  `

  const modal = createModalElement({
    title: '表情分组编辑器',
    content: contentHTML,
    onClose: () => modal.remove()
  })

  // Get the actual content div inside the modal
  const content = modal.querySelector('div:last-child') as HTMLElement

  // Apply custom width to the modal content container
  const modalContent = modal.querySelector('div > div') as HTMLElement
  if (modalContent) {
    modalContent.style.width = '80vw'
    modalContent.style.maxWidth = '80vw'
  }

  document.body.appendChild(modal)

  // Add hover effects
  const id = 'group-editor-styles'
  const css = `
    .group-item:hover {
      border-color: var(--emoji-modal-primary-bg) !important;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }
    .group-icon-editor:hover {
      background: var(--emoji-modal-primary-bg) !important;
      color: white;
    }
    .move-up:hover, .move-down:hover {
      background: var(--emoji-modal-primary-bg) !important;
      color: white;
    }
    .move-up:disabled, .move-down:disabled {
      opacity: 0.3;
      cursor: not-allowed !important;
    }
    .delete-group:hover {
      background: #c82333 !important;
      border-color: #bd2130 !important;
    }
    
    /* Responsive layout adjustments */
    @media (max-width: 1600px) {
      .group-item {
        width: calc(25% - 12px) !important;
      }
    }
    @media (max-width: 1200px) {
      .group-item {
        width: calc(33.333% - 11px) !important;
      }
    }
    @media (max-width: 900px) {
      .group-item {
        width: calc(50% - 8px) !important;
      }
    }
    @media (max-width: 600px) {
      .group-item {
        width: 100% !important;
        min-width: unset !important;
      }
    }
  `
  ensureStyleInjected(id, css)

  // Group name editing
  content.querySelectorAll('.group-name-editor').forEach(input => {
    input.addEventListener('change', e => {
      const target = e.target as HTMLInputElement
      const groupId = target.getAttribute('data-group-id')
      const newName = target.value.trim()

      if (groupId && newName) {
        const group = userscriptState.emojiGroups.find(g => g.id === groupId)
        if (group) {
          group.name = newName
          showTemporaryMessage(`分组 "${newName}" 名称已更新`)
        }
      }
    })
  })

  // Group icon editing
  content.querySelectorAll('.group-icon-editor').forEach(iconEl => {
    iconEl.addEventListener('click', e => {
      const target = e.target as HTMLElement
      const groupId = target.getAttribute('data-group-id')

      if (groupId) {
        customPrompt('请输入新的图标字符 (emoji 或单个字符):', target.textContent || '📁').then(
          newIcon => {
            if (newIcon && newIcon.trim()) {
              const group = userscriptState.emojiGroups.find(g => g.id === groupId)
              if (group) {
                group.icon = newIcon.trim()
                target.textContent = newIcon.trim()
                showTemporaryMessage(`分组图标已更新为: ${newIcon.trim()}`)
              }
            }
          }
        )
      }
    })
  })

  // Move up/down buttons
  content.querySelectorAll('.move-up').forEach(btn => {
    btn.addEventListener('click', e => {
      const index = parseInt((e.target as HTMLElement).getAttribute('data-index') || '0')
      if (index > 0) {
        const temp = userscriptState.emojiGroups[index]
        userscriptState.emojiGroups[index] = userscriptState.emojiGroups[index - 1]
        userscriptState.emojiGroups[index - 1] = temp

        modal.remove()
        showTemporaryMessage('分组顺序已调整')
        setTimeout(() => showGroupEditorModal(), 300)
      }
    })
  })

  content.querySelectorAll('.move-down').forEach(btn => {
    btn.addEventListener('click', e => {
      const index = parseInt((e.target as HTMLElement).getAttribute('data-index') || '0')
      if (index < userscriptState.emojiGroups.length - 1) {
        const temp = userscriptState.emojiGroups[index]
        userscriptState.emojiGroups[index] = userscriptState.emojiGroups[index + 1]
        userscriptState.emojiGroups[index + 1] = temp

        modal.remove()
        showTemporaryMessage('分组顺序已调整')
        setTimeout(() => showGroupEditorModal(), 300)
      }
    })
  })

  // Delete group
  content.querySelectorAll('.delete-group').forEach(btn => {
    btn.addEventListener('click', e => {
      const target = e.target as HTMLElement
      const index = parseInt(target.getAttribute('data-index') || '0')
      const groupName = target.getAttribute('data-group-name')

      // Confirm deletion
      const confirmMsg = `确认删除分组 "${groupName}"？\n\n该分组包含 ${userscriptState.emojiGroups[index].emojis?.length || 0} 个表情。\n删除后数据将无法恢复。`

      customConfirm(confirmMsg).then(confirmed => {
        if (confirmed) {
          userscriptState.emojiGroups.splice(index, 1)
          modal.remove()
          showTemporaryMessage(`分组 "${groupName}" 已删除`)
          setTimeout(() => showGroupEditorModal(), 300)
        }
      })
    })
  })

  // Add new group
  content.querySelector('#addNewGroup')?.addEventListener('click', () => {
    customPrompt('请输入新分组的名称:').then(groupName => {
      if (groupName && groupName.trim()) {
        const newGroupId = 'custom_' + Date.now()
        const newGroup = {
          id: newGroupId,
          name: groupName.trim(),
          icon: '📁',
          order: userscriptState.emojiGroups.length,
          emojis: []
        }

        userscriptState.emojiGroups.push(newGroup)
        modal.remove()
        showTemporaryMessage(`新分组 "${groupName.trim()}" 已创建`)
        setTimeout(() => showGroupEditorModal(), 300)
      }
    })
  })

  // Save all changes
  content.querySelector('#saveAllChanges')?.addEventListener('click', () => {
    saveDataToLocalStorage({ emojiGroups: userscriptState.emojiGroups })
    showTemporaryMessage('所有更改已保存到本地存储')
  })

  // Open import/export modal
  content.querySelector('#openImportExport')?.addEventListener('click', () => {
    modal.remove()
    showImportExportModal()
  })
}
