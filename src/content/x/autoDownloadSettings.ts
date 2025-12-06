/**
 * X.com AutoDownload Settings Menu
 * 在 X.com 页面上注入的自助设置小菜单
 */

class XAutoDownloadSettings {
  private settings: {
    enableAutoDownload: boolean
    autoDownloadSuffixes: string[]
  }

  private menuElement: HTMLElement | null = null
  private readonly SETTINGS_KEY = 'x-autodownload-settings'

  constructor() {
    this.settings = this.loadSettings()
  }

  private loadSettings() {
    const stored = localStorage.getItem(this.SETTINGS_KEY)
    if (stored) {
      try {
        return JSON.parse(stored)
      } catch {
        // 如果解析失败，使用默认值
      }
    }
    return {
      enableAutoDownload: false,
      autoDownloadSuffixes: ['name=large', 'name=orig']
    }
  }

  private saveSettings() {
    localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(this.settings))
  }

  private createSettingsMenu(): HTMLElement {
    const menu = document.createElement('div')
    menu.id = 'x-autodownload-settings-menu'
    menu.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 10000;
      background: white;
      border: 1px solid #e1e8ed;
      border-radius: 8px;
      padding: 16px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 14px;
      width: 300px;
      display: none;
    `

    // 标题
    const title = document.createElement('div')
    title.textContent = '自动下载设置'
    title.style.cssText = `
      font-weight: 600;
      margin-bottom: 12px;
      color: #0f1419;
    `

    // 开关
    const switchContainer = document.createElement('div')
    switchContainer.style.cssText = `
      display: flex;
      align-items: center;
      margin-bottom: 12px;
    `

    const switchLabel = document.createElement('label')
    switchLabel.style.cssText = `
      display: flex;
      align-items: center;
      cursor: pointer;
      flex: 1;
    `

    const switchInput = document.createElement('input')
    switchInput.type = 'checkbox'
    switchInput.checked = this.settings.enableAutoDownload
    switchInput.style.cssText = `
      margin-right: 8px;
      cursor: pointer;
    `
    switchInput.addEventListener('change', e => {
      const target = e.target as HTMLInputElement
      this.settings.enableAutoDownload = target.checked
      this.saveSettings()
      this.updateSuffixesVisibility()
    })

    const switchText = document.createElement('span')
    switchText.textContent = '启用自动下载'
    switchText.style.cssText = `
      color: #0f1419;
    `

    switchLabel.appendChild(switchInput)
    switchLabel.appendChild(switchText)
    switchContainer.appendChild(switchLabel)

    // 后缀设置
    const suffixContainer = document.createElement('div')
    suffixContainer.id = 'suffix-container'
    suffixContainer.style.cssText = `
      margin-bottom: 12px;
    `

    const suffixLabel = document.createElement('div')
    suffixLabel.textContent = 'URL 后缀列表（每行一个）：'
    suffixLabel.style.cssText = `
      font-size: 12px;
      color: #536471;
      margin-bottom: 4px;
    `

    const suffixTextarea = document.createElement('textarea')
    suffixTextarea.value = this.settings.autoDownloadSuffixes.join('\n')
    suffixTextarea.style.cssText = `
      width: 100%;
      height: 80px;
      border: 1px solid #e1e8ed;
      border-radius: 4px;
      padding: 8px;
      font-size: 12px;
      resize: vertical;
      font-family: monospace;
    `
    suffixTextarea.addEventListener('input', e => {
      const target = e.target as HTMLTextAreaElement
      const suffixes = target.value
        .split('\n')
        .map(s => s.trim())
        .filter(s => s.length > 0)
      this.settings.autoDownloadSuffixes = suffixes
      this.saveSettings()
    })

    suffixContainer.appendChild(suffixLabel)
    suffixContainer.appendChild(suffixTextarea)

    // 按钮
    const buttonContainer = document.createElement('div')
    buttonContainer.style.cssText = `
      display: flex;
      gap: 8px;
      justify-content: flex-end;
    `

    const saveButton = document.createElement('button')
    saveButton.textContent = '保存'
    saveButton.style.cssText = `
      background: #1d9bf0;
      color: white;
      border: none;
      border-radius: 4px;
      padding: 6px 12px;
      font-size: 12px;
      cursor: pointer;
      font-weight: 500;
    `
    saveButton.addEventListener('click', () => {
      this.saveSettings()
      this.showNotification('设置已保存')
      this.hideMenu()
    })

    const cancelButton = document.createElement('button')
    cancelButton.textContent = '取消'
    cancelButton.style.cssText = `
      background: transparent;
      color: #536471;
      border: 1px solid #e1e8ed;
      border-radius: 4px;
      padding: 6px 12px;
      font-size: 12px;
      cursor: pointer;
    `
    cancelButton.addEventListener('click', () => {
      this.hideMenu()
    })

    buttonContainer.appendChild(saveButton)
    buttonContainer.appendChild(cancelButton)

    menu.appendChild(title)
    menu.appendChild(switchContainer)
    menu.appendChild(suffixContainer)
    menu.appendChild(buttonContainer)

    this.updateSuffixesVisibility()
    return menu
  }

  private updateSuffixesVisibility() {
    const suffixContainer = document.getElementById('suffix-container')
    if (suffixContainer) {
      suffixContainer.style.display = this.settings.enableAutoDownload ? 'block' : 'none'
    }
  }

  private createToggleButton(): HTMLElement {
    const button = document.createElement('div')
    button.id = 'x-autodownload-toggle'
    button.innerHTML = '⚙️'
    button.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 9999;
      width: 40px;
      height: 40px;
      background: white;
      border: 1px solid #e1e8ed;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      font-size: 16px;
      transition: all 0.2s ease;
    `
    button.addEventListener('mouseenter', () => {
      button.style.transform = 'scale(1.1)'
      button.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)'
    })
    button.addEventListener('mouseleave', () => {
      button.style.transform = 'scale(1)'
      button.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)'
    })
    button.addEventListener('click', () => {
      this.toggleMenu()
    })
    return button
  }

  private toggleMenu() {
    if (!this.menuElement) {
      this.menuElement = this.createSettingsMenu()
      document.body.appendChild(this.menuElement)
    }

    const isVisible = this.menuElement.style.display === 'block'
    this.menuElement.style.display = isVisible ? 'none' : 'block'
  }

  private hideMenu() {
    if (this.menuElement) {
      this.menuElement.style.display = 'none'
    }
  }

  private showNotification(message: string) {
    const notification = document.createElement('div')
    notification.textContent = message
    notification.style.cssText = `
      position: fixed;
      top: 70px;
      right: 20px;
      z-index: 10001;
      background: #0f1419;
      color: white;
      padding: 8px 12px;
      border-radius: 4px;
      font-size: 12px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      opacity: 0;
      transition: opacity 0.2s ease;
    `

    document.body.appendChild(notification)

    // 淡入
    setTimeout(() => {
      notification.style.opacity = '1'
    }, 10)

    // 2秒后淡出并移除
    setTimeout(() => {
      notification.style.opacity = '0'
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification)
        }
      }, 200)
    }, 2000)
  }

  public getSettings() {
    return this.settings
  }

  public init() {
    // 等待页面加载完成
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        this.inject()
      })
    } else {
      this.inject()
    }
  }

  private inject() {
    // 检查是否在 X.com
    if (
      !window.location.hostname.includes('x.com') &&
      !window.location.hostname.includes('twitter.com')
    ) {
      return
    }

    // 避免重复注入
    if (document.getElementById('x-autodownload-toggle')) {
      return
    }

    // 注入切换按钮
    const toggleButton = this.createToggleButton()
    document.body.appendChild(toggleButton)

    console.log('[XAutoDownloadSettings] Settings menu injected')
  }
}

// 创建全局实例
const xAutoDownloadSettings = new XAutoDownloadSettings()

// 导出供其他模块使用
export default xAutoDownloadSettings
