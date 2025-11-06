// Settings modal module
import { userscriptState } from '../state'
import { saveDataToLocalStorage, DEFAULT_USER_SETTINGS } from '../userscript-storage'
import { createEl } from '../utils/createEl'
import { injectGlobalThemeStyles } from '../utils/themeSupport'

import { showGroupEditorModal } from './groupEditor'
import { showPopularEmojisModal } from './popularEmojis'
import { showImportExportModal } from './importExport'

// Show settings modal
export function showSettingsModal() {
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

  modal.appendChild(
    createEl('div', {
      style: `
    backdrop-filter: blur(10px);
    padding: 24px;
    overflow-y: auto;
    position: relative;
  `,
      innerHTML: `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
      <h2 style="margin: 0; color: var(--emoji-modal-text);">设置</h2>
      <button id="closeModal" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #999;">×</button>
    </div>
    
    <div style="margin-bottom: 16px;">
      <label style="display: block; margin-bottom: 8px; color: var(--emoji-modal-label); font-weight: 500;">图片缩放比例：<span id="scaleValue">${userscriptState.settings.imageScale}%</span></label>
      <input type="range" id="scaleSlider" min="5" max="150" step="5" value="${userscriptState.settings.imageScale}" 
             style="width: 100%; margin-bottom: 8px;">
    </div>
    
    <div style="margin-bottom: 16px;">
      <label style="display: block; margin-bottom: 8px; color: var(--emoji-modal-label); font-weight: 500;">输出格式:</label>
      <div style="display: flex; gap: 16px;">
        <label style="display: flex; align-items: center; color: var(--emoji-modal-text);">
          <input type="radio" name="outputFormat" value="markdown" ${userscriptState.settings.outputFormat === 'markdown' ? 'checked' : ''} style="margin-right: 4px;">
          Markdown
        </label>
        <label style="display: flex; align-items: center; color: var(--emoji-modal-text);">
          <input type="radio" name="outputFormat" value="html" ${userscriptState.settings.outputFormat === 'html' ? 'checked' : ''} style="margin-right: 4px;">
          HTML
        </label>
      </div>
    </div>
    
    <div style="margin-bottom: 16px;">
      <label style="display: flex; align-items: center; color: var(--emoji-modal-label); font-weight: 500;">
        <input type="checkbox" id="showSearchBar" ${userscriptState.settings.showSearchBar ? 'checked' : ''} style="margin-right: 8px;">
        显示搜索栏
      </label>
    </div>
    
    <div style="margin-bottom: 16px;">
      <label style="display: flex; align-items: center; color: var(--emoji-modal-label); font-weight: 500;">
        <input type="checkbox" id="enableFloatingPreview" ${userscriptState.settings.enableFloatingPreview ? 'checked' : ''} style="margin-right: 8px;">
        启用悬浮预览功能
      </label>
    </div>

    <div style="margin-bottom: 16px;">
      <label style="display: flex; align-items: center; color: var(--emoji-modal-label); font-weight: 500;">
        <input type="checkbox" id="enableCalloutSuggestions" ${userscriptState.settings.enableCalloutSuggestions ? 'checked' : ''} style="margin-right: 8px;">
        在 textarea 中启用 Callout Suggestion（输入 [ 即可触发）
      </label>
    </div>

    <div style="margin-bottom: 16px;">
      <label style="display: flex; align-items: center; color: var(--emoji-modal-label); font-weight: 500;">
        <input type="checkbox" id="enableBatchParseImages" ${userscriptState.settings.enableBatchParseImages ? 'checked' : ''} style="margin-right: 8px;">
        注入“一键解析并添加所有图片”按钮
      </label>
    </div>
    
    <div style="margin-bottom: 16px;">
      <label style="display: flex; align-items: center; color: var(--emoji-modal-label); font-weight: 500;">
        <input type="checkbox" id="forceMobileMode" ${userscriptState.settings.forceMobileMode ? 'checked' : ''} style="margin-right: 8px;">
        强制移动模式 (在不兼容检测时也注入移动版布局)
      </label>
    </div>
    
    <div style="margin-bottom: 16px; padding: 12px; background: var(--emoji-modal-button-bg); border-radius: 6px; border: 1px solid var(--emoji-modal-border);">
      <div style="font-weight: 500; color: var(--emoji-modal-label); margin-bottom: 8px;">高级功能</div>
      <div style="display: flex; gap: 8px; flex-wrap: wrap;">
        <button id="openGroupEditor" style="
          padding: 6px 12px; 
          background: var(--emoji-modal-primary-bg); 
          color: white; 
          border: none; 
          font-size: 12px;
        ">编辑分组</button>
        <button id="openPopularEmojis" style="
          padding: 6px 12px; 
          background: var(--emoji-modal-primary-bg); 
          color: white; 
          border: none; 
          font-size: 12px;
        ">常用表情</button>
        <button id="openImportExport" style="
          padding: 6px 12px; 
          background: var(--emoji-modal-primary-bg); 
          color: white; 
          border: none; 
          font-size: 12px;
        ">导入导出</button>
      </div>
    </div>
    
    <div style="display: flex; gap: 8px; justify-content: flex-end;">
      <button id="resetSettings" style="padding: 8px 16px; background: var(--emoji-modal-button-bg); color: var(--emoji-modal-text); border: 1px solid var(--emoji-modal-border); border-radius: 4px; cursor: pointer;">重置</button>
      <button id="saveSettings" style="padding: 8px 16px; background: var(--emoji-modal-primary-bg); color: white; border: none; border-radius: 4px; cursor: pointer;">保存</button>
    </div>
  `
    })
  )
  document.body.appendChild(modal)

  // Get the actual content div inside the modal
  const content = modal.querySelector('div:last-child') as HTMLElement

  // Event listeners
  const scaleSlider = content.querySelector('#scaleSlider') as HTMLInputElement
  const scaleValue = content.querySelector('#scaleValue') as HTMLElement

  // Close button
  content.querySelector('#closeModal')?.addEventListener('click', () => {
    modal.remove()
  })

  scaleSlider?.addEventListener('input', () => {
    if (scaleValue) {
      scaleValue.textContent = scaleSlider.value + '%'
    }
  })

  content.querySelector('#resetSettings')?.addEventListener('click', async () => {
    const confirmed = confirm('确定要重置所有设置吗？')
    if (confirmed) {
      userscriptState.settings = { ...DEFAULT_USER_SETTINGS }
      modal.remove()
    }
  })

  content.querySelector('#saveSettings')?.addEventListener('click', () => {
    // Update settings
    userscriptState.settings.imageScale = parseInt(scaleSlider?.value || '30')

    const outputFormat = content.querySelector(
      'input[name="outputFormat"]:checked'
    ) as HTMLInputElement
    if (outputFormat) {
      userscriptState.settings.outputFormat = outputFormat.value as 'markdown' | 'html'
    }

    const showSearchBar = content.querySelector('#showSearchBar') as HTMLInputElement
    if (showSearchBar) {
      userscriptState.settings.showSearchBar = showSearchBar.checked
    }

    const enableFloatingPreview = content.querySelector(
      '#enableFloatingPreview'
    ) as HTMLInputElement
    if (enableFloatingPreview) {
      userscriptState.settings.enableFloatingPreview = enableFloatingPreview.checked
    }

    const enableCalloutEl = content.querySelector(
      '#enableCalloutSuggestions'
    ) as HTMLInputElement | null
    if (enableCalloutEl) {
      userscriptState.settings.enableCalloutSuggestions = !!enableCalloutEl.checked
    }

    const enableBatchEl = content.querySelector(
      '#enableBatchParseImages'
    ) as HTMLInputElement | null
    if (enableBatchEl) {
      userscriptState.settings.enableBatchParseImages = !!enableBatchEl.checked
    }

    const forceMobileEl = content.querySelector('#forceMobileMode') as HTMLInputElement | null
    if (forceMobileEl) {
      userscriptState.settings.forceMobileMode = !!forceMobileEl.checked
    }

    // Save to localStorage
    saveDataToLocalStorage({ settings: userscriptState.settings })
    // Also persist remote config URL for remote variant
    try {
      const remoteInput = content.querySelector('#remoteConfigUrl') as HTMLInputElement | null
      if (remoteInput && remoteInput.value.trim()) {
        localStorage.setItem('emoji_extension_remote_config_url', remoteInput.value.trim())
      }
    } catch (e) {
      // ignore
    }
    alert('设置已保存')

    modal.remove()
  })

  // Advanced feature buttons
  content.querySelector('#openGroupEditor')?.addEventListener('click', () => {
    modal.remove()
    showGroupEditorModal()
  })

  content.querySelector('#openPopularEmojis')?.addEventListener('click', () => {
    modal.remove()
    showPopularEmojisModal()
  })

  content.querySelector('#openImportExport')?.addEventListener('click', () => {
    modal.remove()
    showImportExportModal()
  })
}
