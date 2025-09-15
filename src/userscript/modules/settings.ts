// Settings modal module
import { userscriptState } from '../state'
import { saveDataToLocalStorage } from '../userscript-storage'

// Show settings modal
export function showSettingsModal() {
  const modal = document.createElement('div')
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.8);
    z-index: 999999;
    display: flex;
    align-items: center;
    justify-content: center;
  `

  const content = document.createElement('div')
  content.style.cssText = `
    background: white;
    border-radius: 8px;
    padding: 24px;
    max-width: 500px;
    max-height: 80vh;
    overflow-y: auto;
    position: relative;
  `

  content.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
      <h2 style="margin: 0; color: #333;">设置</h2>
      <button id="closeModal" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #999;">×</button>
    </div>
    
    <div style="margin-bottom: 16px;">
      <label style="display: block; margin-bottom: 8px; color: #555; font-weight: 500;">图片缩放比例: <span id="scaleValue">${userscriptState.settings.imageScale}%</span></label>
      <input type="range" id="scaleSlider" min="5" max="150" step="5" value="${userscriptState.settings.imageScale}" 
             style="width: 100%; margin-bottom: 8px;">
    </div>
    
    <div style="margin-bottom: 16px;">
      <label style="display: block; margin-bottom: 8px; color: #555; font-weight: 500;">输出格式:</label>
      <div style="display: flex; gap: 16px;">
        <label style="display: flex; align-items: center; color: #666;">
          <input type="radio" name="outputFormat" value="markdown" ${userscriptState.settings.outputFormat === 'markdown' ? 'checked' : ''} style="margin-right: 4px;">
          Markdown
        </label>
        <label style="display: flex; align-items: center; color: #666;">
          <input type="radio" name="outputFormat" value="html" ${userscriptState.settings.outputFormat === 'html' ? 'checked' : ''} style="margin-right: 4px;">
          HTML
        </label>
      </div>
    </div>
    
    <div style="margin-bottom: 16px;">
      <label style="display: flex; align-items: center; color: #555; font-weight: 500;">
        <input type="checkbox" id="showSearchBar" ${userscriptState.settings.showSearchBar ? 'checked' : ''} style="margin-right: 8px;">
        显示搜索栏
      </label>
    </div>
    
    <div style="margin-bottom: 16px;">
      <label style="display: flex; align-items: center; color: #555; font-weight: 500;">
        <input type="checkbox" id="forceMobileMode" ${userscriptState.settings.forceMobileMode ? 'checked' : ''} style="margin-right: 8px;">
        强制移动模式 (在不兼容检测时也注入移动版布局)
      </label>
    </div>
    
    <div style="display: flex; gap: 8px; justify-content: flex-end;">
      <button id="resetSettings" style="padding: 8px 16px; background: #f5f5f5; border: 1px solid #ddd; border-radius: 4px; cursor: pointer;">重置</button>
      <button id="saveSettings" style="padding: 8px 16px; background: #1890ff; color: white; border: none; border-radius: 4px; cursor: pointer;">保存</button>
    </div>
  `

  modal.appendChild(content)
  document.body.appendChild(modal)

  // Event listeners
  const scaleSlider = content.querySelector('#scaleSlider') as HTMLInputElement
  const scaleValue = content.querySelector('#scaleValue') as HTMLElement

  scaleSlider?.addEventListener('input', () => {
    if (scaleValue) {
      scaleValue.textContent = scaleSlider.value + '%'
    }
  })

  content.querySelector('#closeModal')?.addEventListener('click', () => {
    modal.remove()
  })

  content.querySelector('#resetSettings')?.addEventListener('click', async () => {
    const confirmed = confirm('确定要重置所有设置吗？')
    if (confirmed) {
      userscriptState.settings = {
        imageScale: 30,
        gridColumns: 4,
        outputFormat: 'markdown',
        forceMobileMode: false,
        defaultGroup: 'nachoneko',
        showSearchBar: true
      }
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

  // Close on outside click
  modal.addEventListener('click', e => {
    if (e.target === modal) {
      modal.remove()
    }
  })
}
