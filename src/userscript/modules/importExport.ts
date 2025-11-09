// Import/Export module for userscript data - Group-focused operations
import { userscriptState } from '../state'
import { saveDataToLocalStorage } from '../userscript-storage'
import { injectGlobalThemeStyles } from '../utils/themeSupport'
import { showTemporaryMessage } from '../utils/tempMessage'
import { createModalElement } from '../utils/editorUtils'

export function showImportExportModal(currentGroupId?: string) {
  // Ensure theme styles are injected
  injectGlobalThemeStyles()

  // 获取当前选中的分组
  const currentGroup = currentGroupId
    ? userscriptState.emojiGroups.find(g => g.id === currentGroupId)
    : null

  const contentHTML = `
    ${
      currentGroup
        ? `
    <div style="margin-bottom: 24px; padding: 16px; background: var(--emoji-modal-button-bg); border-radius: 8px;">
      <h3 style="margin: 0 0 12px 0; color: var(--emoji-modal-label);">当前分组信息</h3>
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
        ${
          currentGroup.icon?.startsWith('http')
            ? `<img src="${currentGroup.icon}" alt="图标" style="width: 24px; height: 24px; object-fit: contain;">`
            : `<span style="font-size: 20px;">${currentGroup.icon || '📁'}</span>`
        }
        <span style="font-weight: bold; color: var(--emoji-modal-text);">${currentGroup.name || currentGroup.id}</span>
      </div>
      <div style="color: var(--emoji-modal-text); font-size: 14px;">
        分组 ID: ${currentGroup.id} | 表情数量：${currentGroup.emojis?.length || 0}
      </div>
    </div>
    `
        : ''
    }

    <div style="margin-bottom: 24px;">
      <h3 style="margin: 0 0 12px 0; color: var(--emoji-modal-label);">导出分组表情</h3>
      
      <div style="margin-bottom: 16px;">
        <label style="display: block; margin-bottom: 8px; color: var(--emoji-modal-label);">选择要导出的分组:</label>
        <select id="exportGroupSelect" style="
          width: 100%;
          padding: 8px;
          background: var(--emoji-modal-button-bg);
          color: var(--emoji-modal-text);
          border: 1px solid var(--emoji-modal-border);
          border-radius: 4px;
          margin-bottom: 8px;
        ">
          ${currentGroup ? `<option value="${currentGroup.id}" selected>${currentGroup.name || currentGroup.id} (${currentGroup.emojis?.length || 0} 表情)</option>` : ''}
          ${userscriptState.emojiGroups
            .filter(g => g.id !== currentGroupId)
            .map(
              group =>
                `<option value="${group.id}">${group.name || group.id} (${group.emojis?.length || 0} 表情)</option>`
            )
            .join('')}
        </select>
      </div>

      <div style="display: flex; gap: 8px;">
        <button id="exportGroup" style="padding: 8px 16px; background: var(--emoji-modal-primary-bg); color: white; border: none; border-radius: 4px; cursor: pointer;">导出选中分组</button>
      </div>
    </div>

    <div>
      <h3 style="margin: 0 0 12px 0; color: var(--emoji-modal-label);">导入分组表情</h3>
      
      <div style="margin-bottom: 16px;">
        <label style="display: block; margin-bottom: 8px; color: var(--emoji-modal-label);">导入目标分组:</label>
        <select id="importTargetGroupSelect" style="
          width: 100%;
          padding: 8px;
          background: var(--emoji-modal-button-bg);
          color: var(--emoji-modal-text);
          border: 1px solid var(--emoji-modal-border);
          border-radius: 4px;
          margin-bottom: 8px;
        ">
          ${currentGroup ? `<option value="${currentGroup.id}" selected>${currentGroup.name || currentGroup.id}</option>` : ''}
          ${userscriptState.emojiGroups
            .filter(g => g.id !== currentGroupId)
            .map(group => `<option value="${group.id}">${group.name || group.id}</option>`)
            .join('')}
          <option value="__new__">创建新分组...</option>
        </select>
      </div>

      <div style="margin-bottom: 16px;">
        <label style="display: block; margin-bottom: 8px; color: var(--emoji-modal-label);">上传分组文件:</label>
        <input type="file" id="importFile" accept=".json" style="margin-bottom: 8px; color: var(--emoji-modal-text);">
        <div style="font-size: 12px; color: var(--emoji-modal-text); opacity: 0.7;">
          支持 JSON 格式的分组文件
        </div>
      </div>

      <div style="margin-bottom: 16px;">
        <label style="display: block; margin-bottom: 8px; color: var(--emoji-modal-label);">或粘贴分组 JSON:</label>
        <textarea id="importText" placeholder="在此粘贴分组表情 JSON..." style="
          width: 100%;
          height: 120px;
          padding: 8px;
          background: var(--emoji-modal-button-bg);
          color: var(--emoji-modal-text);
          border: 1px solid var(--emoji-modal-border);
          border-radius: 4px;
          resize: vertical;
          font-family: monospace;
          font-size: 12px;
        "></textarea>
      </div>

      <div style="margin-bottom: 16px;">
        <label style="display: block; margin-bottom: 8px; color: var(--emoji-modal-label);">导入选项:</label>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <label style="display: flex; align-items: center; color: var(--emoji-modal-text);">
            <input type="radio" name="importMode" value="replace" checked style="margin-right: 8px;">
            替换现有表情 (清空目标分组后导入)
          </label>
          <label style="display: flex; align-items: center; color: var(--emoji-modal-text);">
            <input type="radio" name="importMode" value="merge" style="margin-right: 8px;">
            合并表情 (添加到现有表情中，跳过重复的)
          </label>
          <label style="display: flex; align-items: center; color: var(--emoji-modal-text);">
            <input type="radio" name="importMode" value="append" style="margin-right: 8px;">
            追加表情 (直接添加到现有表情后面)
          </label>
        </div>
      </div>

      <div style="display: flex; gap: 8px;">
        <button id="importGroup" style="padding: 8px 16px; background: var(--emoji-modal-primary-bg); color: white; border: none; border-radius: 4px; cursor: pointer;">导入到分组</button>
        <button id="previewImport" style="padding: 8px 16px; background: var(--emoji-modal-button-bg); color: var(--emoji-modal-text); border: 1px solid var(--emoji-modal-border); border-radius: 4px; cursor: pointer;">预览导入</button>
      </div>
    </div>
  `

  const modal = createModalElement({
    title: '分组表情导入/导出',
    content: contentHTML,
    onClose: () => modal.remove()
  })

  // Get the actual content div inside the modal
  const content = modal.querySelector('div:last-child') as HTMLElement
  document.body.appendChild(modal)

  // 工具函数：创建下载链接
  function createDownload(data: any, filename: string) {
    const jsonString = JSON.stringify(data, null, 2)
    const blob = new Blob([jsonString], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // 工具函数：验证并解析导入数据
  function parseImportData(jsonData: string): any {
    try {
      const data = JSON.parse(jsonData)
      if (!data || typeof data !== 'object') {
        throw new Error('无效的 JSON 格式')
      }
      return data
    } catch (error) {
      throw new Error('JSON 解析失败：' + (error instanceof Error ? error.message : String(error)))
    }
  }

  // 导出分组功能
  content.querySelector('#exportGroup')?.addEventListener('click', () => {
    try {
      const exportGroupSelect = content.querySelector('#exportGroupSelect') as HTMLSelectElement
      const selectedGroupId = exportGroupSelect.value

      if (!selectedGroupId) {
        alert('请选择要导出的分组')
        return
      }

      const group = userscriptState.emojiGroups.find(g => g.id === selectedGroupId)
      if (!group) {
        alert('找不到指定的分组')
        return
      }

      const exportData = {
        type: 'emoji_group',
        exportDate: new Date().toISOString(),
        group: {
          id: group.id,
          name: group.name,
          icon: group.icon,
          emojis: group.emojis || [],
          order: group.order
        }
      }

      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
      const filename = `emoji-group-${group.name || group.id}-${timestamp}.json`
      createDownload(exportData, filename)

      showTemporaryMessage(
        `已导出分组 "${group.name || group.id}" (${group.emojis?.length || 0} 个表情)`
      )
    } catch (error) {
      console.error('Export group failed:', error)
      alert('导出分组失败：' + (error instanceof Error ? error.message : String(error)))
    }
  })

  // 文件上传处理
  content.querySelector('#importFile')?.addEventListener('change', e => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = event => {
        const text = event.target?.result as string
        const importTextarea = content.querySelector('#importText') as HTMLTextAreaElement
        if (importTextarea) {
          importTextarea.value = text
        }
      }
      reader.onerror = () => {
        alert('文件读取失败')
      }
      reader.readAsText(file)
    }
  })

  // 预览导入功能
  content.querySelector('#previewImport')?.addEventListener('click', () => {
    try {
      const importText = (content.querySelector('#importText') as HTMLTextAreaElement).value.trim()
      if (!importText) {
        alert('请输入或选择要导入的内容')
        return
      }

      const data = parseImportData(importText)
      let preview = '导入预览:\\n\\n'

      // 检查是否是分组格式
      if (data.type === 'emoji_group' && data.group) {
        const group = data.group
        preview += `分组类型：单个表情分组\\n`
        preview += `分组名称：${group.name || group.id || 'Unnamed'}\\n`
        preview += `分组 ID: ${group.id || 'N/A'}\\n`
        preview += `图标：${group.icon || '无'}\\n`
        preview += `表情数量：${group.emojis?.length || 0}\\n\\n`

        if (group.emojis && group.emojis.length > 0) {
          preview += `表情列表 (前 5 个):\\n`
          group.emojis.slice(0, 5).forEach((emoji: any, index: number) => {
            preview += `  ${index + 1}. ${emoji.name || 'Unnamed'} - ${emoji.url || 'No URL'}\\n`
          })
          if (group.emojis.length > 5) {
            preview += `  ... 还有 ${group.emojis.length - 5} 个表情\\n`
          }
        }
      } else if (data.emojiGroups && Array.isArray(data.emojiGroups)) {
        // 兼容旧格式
        preview += `分组类型：多个表情分组\\n`
        preview += `分组数量：${data.emojiGroups.length}\\n\\n`
        data.emojiGroups.slice(0, 3).forEach((group: any, index: number) => {
          preview += `${index + 1}. ${group.name || group.id || 'Unnamed'} (${group.emojis?.length || 0} 表情)\\n`
        })
        if (data.emojiGroups.length > 3) {
          preview += `... 还有 ${data.emojiGroups.length - 3} 个分组\\n`
        }
      } else if (Array.isArray(data) && data.length > 0 && data[0].id && data[0].url) {
        // 兼容带有 packet、groupId 等字段的表情数组格式
        preview += `分组类型：表情数组 (带扩展字段)\\n`
        preview += `表情数量：${data.length}\\n\\n`

        // 统计不同的 groupId
        const groupIds = [...new Set(data.map((emoji: any) => emoji.groupId).filter(Boolean))]
        if (groupIds.length > 0) {
          preview += `包含的原始分组 ID: ${groupIds.join(', ')}\\n\\n`
        }

        if (data.length > 0) {
          preview += `表情列表 (前 5 个):\\n`
          data.slice(0, 5).forEach((emoji: any, index: number) => {
            preview += `  ${index + 1}. ${emoji.name || emoji.id} - ${emoji.url}\\n`
            if (emoji.groupId) {
              preview += `     原分组：${emoji.groupId}\\n`
            }
          })
          if (data.length > 5) {
            preview += `  ... 还有 ${data.length - 5} 个表情\\n`
          }
        }
      } else {
        preview += '无法识别的格式，可能不是有效的分组导出文件'
      }

      alert(preview)
    } catch (error) {
      alert('预览失败：' + (error instanceof Error ? error.message : String(error)))
    }
  })

  // 导入分组功能
  content.querySelector('#importGroup')?.addEventListener('click', () => {
    try {
      const importText = (content.querySelector('#importText') as HTMLTextAreaElement).value.trim()
      if (!importText) {
        alert('请输入或选择要导入的内容')
        return
      }

      const targetGroupSelect = content.querySelector(
        '#importTargetGroupSelect'
      ) as HTMLSelectElement
      let targetGroupId = targetGroupSelect.value

      // 处理创建新分组的情况
      if (targetGroupId === '__new__') {
        const newGroupName = prompt('请输入新分组的名称：')
        if (!newGroupName || !newGroupName.trim()) {
          return
        }

        const newGroupId = 'imported_' + Date.now()
        const newGroup = {
          id: newGroupId,
          name: newGroupName.trim(),
          icon: '📁',
          emojis: [],
          order: userscriptState.emojiGroups.length
        }

        userscriptState.emojiGroups.push(newGroup)
        targetGroupId = newGroupId
      }

      if (!targetGroupId) {
        alert('请选择目标分组')
        return
      }

      const targetGroup = userscriptState.emojiGroups.find(g => g.id === targetGroupId)
      if (!targetGroup) {
        alert('找不到目标分组')
        return
      }

      const data = parseImportData(importText)
      const importModeInputs = content.querySelectorAll(
        'input[name="importMode"]'
      ) as NodeListOf<HTMLInputElement>
      const importMode =
        Array.from(importModeInputs).find(input => input.checked)?.value || 'replace'

      let importedEmojis: any[] = []

      // 解析要导入的表情
      if (data.type === 'emoji_group' && data.group && data.group.emojis) {
        importedEmojis = data.group.emojis
      } else if (data.emojiGroups && Array.isArray(data.emojiGroups)) {
        // 兼容旧格式：合并所有分组的表情
        importedEmojis = data.emojiGroups.reduce((acc: any[], group: any) => {
          return acc.concat(group.emojis || [])
        }, [])
      } else if (Array.isArray(data.emojis)) {
        // 直接表情数组格式
        importedEmojis = data.emojis
      } else if (Array.isArray(data) && data.length > 0 && data[0].id && data[0].url) {
        // 兼容带有 packet、groupId 等字段的表情数组格式
        importedEmojis = data.map((emoji: any) => ({
          name: emoji.name || emoji.id || 'unnamed',
          url: emoji.url,
          width: emoji.width,
          height: emoji.height,
          // 保存原始数据以备后用
          originalId: emoji.id,
          packet: emoji.packet,
          originalGroupId: emoji.groupId
        }))
      } else {
        alert('无法识别的导入格式')
        return
      }

      if (importedEmojis.length === 0) {
        alert('导入文件中没有找到表情数据')
        return
      }

      // 根据导入模式处理表情
      let finalEmojis: any[] = []

      switch (importMode) {
        case 'replace':
          finalEmojis = importedEmojis
          break

        case 'merge':
          // 合并模式：跳过重复的表情 (基于 URL 或原始 ID)
          const existingUrls = new Set((targetGroup.emojis || []).map((e: any) => e.url))
          const existingIds = new Set(
            (targetGroup.emojis || []).map((e: any) => e.originalId || e.id).filter(Boolean)
          )
          const newEmojis = importedEmojis.filter(e => {
            // 检查 URL 重复
            if (existingUrls.has(e.url)) return false
            // 检查原始 ID 重复（如果存在）
            if (e.originalId && existingIds.has(e.originalId)) return false
            return true
          })
          finalEmojis = [...(targetGroup.emojis || []), ...newEmojis]
          break

        case 'append':
          // 追加模式：直接添加
          finalEmojis = [...(targetGroup.emojis || []), ...importedEmojis]
          break

        default:
          finalEmojis = importedEmojis
      }

      // 更新目标分组
      targetGroup.emojis = finalEmojis

      // 保存到本地存储
      saveDataToLocalStorage({ emojiGroups: userscriptState.emojiGroups })

      const message = `成功导入 ${importedEmojis.length} 个表情到分组 "${targetGroup.name || targetGroup.id}"`
      showTemporaryMessage(message)
      alert(message + '\\n\\n修改已保存，分组现在共有 ' + finalEmojis.length + ' 个表情')

      modal.remove()
    } catch (error) {
      console.error('Import group failed:', error)
      alert('导入分组失败：' + (error instanceof Error ? error.message : String(error)))
    }
  })
}
