// Group editor module for editing emoji group names and icons
import { userscriptState } from '../state'
import { saveDataToLocalStorage } from '../userscript-storage'
import { createEl } from '../utils/createEl'
import { injectGlobalThemeStyles } from '../utils/themeSupport'
import { showTemporaryMessage } from '../utils/tempMessage'
import { ensureStyleInjected, removeInjectedStyle } from '../utils/injectStyles'

export function showGroupEditorModal() {
  // Ensure theme styles are injected
  injectGlobalThemeStyles()

  const modal = createEl('div', {
    style: `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 999999;
      display: flex;
      align-items: center;
      justify-content: center;
    `
  })

  const content = createEl('div', {
    style: `
      color: var(--emoji-modal-text);
      border-radius: 8px;
      padding: 24px;
      max-width: 700px;
      max-height: 80vh;
      overflow-y: auto;
      position: relative;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
    `
  })

  content.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
      <h2 style="margin: 0; color: var(--emoji-modal-text);backdrop-filter: blur(10px);">表情分组编辑器</h2>
      <button id="closeModal" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #999;">×</button>
    </div>
    
    <div style="margin-bottom: 20px; padding: 16px; background: var(--emoji-modal-button-bg); border-radius: 6px; border: 1px solid var(--emoji-modal-border);">
      <div style="font-weight: 500; color: var(--emoji-modal-label); margin-bottom: 8px;">编辑说明</div>
      <div style="font-size: 14px; color: var(--emoji-modal-text); opacity: 0.8; line-height: 1.4;">
        • 点击分组名称或图标进行编辑<br>
        • 图标支持 emoji 字符或单个字符<br>
        • 修改会立即保存到本地存储<br>
        • 可以调整分组的显示顺序
      </div>
    </div>
    
    <div id="groupsList" style="display: flex; flex-direction: column; gap: 12px;">
      ${userscriptState.emojiGroups
        .map(
          (group, index) =>
            `
        <div class="group-item" data-group-id="${group.id}" data-index="${index}" style="
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px;
          background: var(--emoji-modal-button-bg);
          border: 1px solid var(--emoji-modal-border);
          border-radius: 6px;
          transition: all 0.2s;
        ">
          <div class="drag-handle" style="
            cursor: grab;
            color: var(--emoji-modal-text);
            opacity: 0.5;
            font-size: 16px;
            user-select: none;
          " title="拖拽调整顺序">⋮⋮</div>` +
            (group.icon?.startsWith('https://')
              ? `<img class="group-icon-editor" src="${group.icon}" alt="图标" style="
            width: 40px;
            height: 40px;
            object-fit: cover;
            border: 1px dashed var(--emoji-modal-border);
            border-radius: 4px;
            cursor: pointer;
            user-select: none;
          " data-group-id="${group.id}" title="点击编辑图标">`
              : `
          <div class="group-icon-editor" style="
            min-width: 40px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: var(--emoji-modal-bg);
            border: 1px dashed var(--emoji-modal-border);
            border-radius: 4px;
            cursor: pointer;
            font-size: 18px;
            user-select: none;
          " data-group-id="${group.id}" title="点击编辑图标">
            ${group.icon || '📁'}
          </div>`) +
            `<div style="flex: 1; display: flex; flex-direction: column; gap: 4px;">
            <input class="group-name-editor" 
                   type="text" 
                   value="${group.name || 'Unnamed Group'}" 
                   data-group-id="${group.id}"
                   style="
                     background: var(--emoji-modal-bg);
                     color: var(--emoji-modal-text);
                     border: 1px solid var(--emoji-modal-border);
                     border-radius: 4px;
                     padding: 8px 12px;
                     font-size: 14px;
                     font-weight: 500;
                   " 
                   placeholder="分组名称">
            <div style="font-size: 12px; color: var(--emoji-modal-text); opacity: 0.6;">
              ID: ${group.id} | 表情数: ${group.emojis ? group.emojis.length : 0}
            </div>
          </div>
          
          <div style="display: flex; flex-direction: column; gap: 4px; align-items: center;">
            <button class="move-up" data-index="${index}" style="
              background: var(--emoji-modal-button-bg);
              border: 1px solid var(--emoji-modal-border);
              border-radius: 3px;
              padding: 4px 8px;
              cursor: pointer;
              font-size: 12px;
              color: var(--emoji-modal-text);
            " ${index === 0 ? 'disabled' : ''}>↑</button>
            <button class="move-down" data-index="${index}" style="
              background: var(--emoji-modal-button-bg);
              border: 1px solid var(--emoji-modal-border);
              border-radius: 3px;
              padding: 4px 8px;
              cursor: pointer;
              font-size: 12px;
              color: var(--emoji-modal-text);
            " ${index === userscriptState.emojiGroups.length - 1 ? 'disabled' : ''}>↓</button>
          </div>
        </div>
      `
        )
        .join('')}
    </div>
    
    <div style="margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--emoji-modal-border); display: flex; gap: 8px; justify-content: flex-end;">
      <button id="addNewGroup" style="padding: 8px 16px; background: var(--emoji-modal-primary-bg); color: white; border: none; border-radius: 4px; cursor: pointer;">新建分组</button>
      <button id="saveAllChanges" style="padding: 8px 16px; background: var(--emoji-modal-primary-bg); color: white; border: none; border-radius: 4px; cursor: pointer;">保存所有更改</button>
    </div>
  `

  modal.appendChild(content)
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
  `
  ensureStyleInjected(id, css)

  // Event listeners
  content.querySelector('#closeModal')?.addEventListener('click', () => {
    modal.remove()
    removeInjectedStyle('group-editor-styles')
  })

  // Close on outside click
  modal.addEventListener('click', e => {
    if (e.target === modal) {
      modal.remove()
      removeInjectedStyle('group-editor-styles')
    }
  })

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
        const newIcon = prompt('请输入新的图标字符 (emoji 或单个字符):', target.textContent || '📁')
        if (newIcon && newIcon.trim()) {
          const group = userscriptState.emojiGroups.find(g => g.id === groupId)
          if (group) {
            group.icon = newIcon.trim()
            target.textContent = newIcon.trim()
            showTemporaryMessage(`分组图标已更新为: ${newIcon.trim()}`)
          }
        }
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
        removeInjectedStyle('group-editor-styles')
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
        removeInjectedStyle('group-editor-styles')
        showTemporaryMessage('分组顺序已调整')
        setTimeout(() => showGroupEditorModal(), 300)
      }
    })
  })

  // Add new group
  content.querySelector('#addNewGroup')?.addEventListener('click', () => {
    const groupName = prompt('请输入新分组的名称:')
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
      removeInjectedStyle('group-editor-styles')
      showTemporaryMessage(`新分组 "${groupName.trim()}" 已创建`)
      setTimeout(() => showGroupEditorModal(), 300)
    }
  })

  // Save all changes
  content.querySelector('#saveAllChanges')?.addEventListener('click', () => {
    saveDataToLocalStorage({ emojiGroups: userscriptState.emojiGroups })
    showTemporaryMessage('所有更改已保存到本地存储')
  })
}


