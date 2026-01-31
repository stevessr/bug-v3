/**
 * X.com 自动下载设置界面
 */

import { DOA, createE } from '../../utils/createEl'

import { AutoDownloadManager, getAutoDownloadManager } from './manager'

export class AutoDownloadSettingsUI {
  private manager: AutoDownloadManager
  private menuElement: HTMLElement | null = null
  private toggleButton: HTMLElement | null = null

  constructor() {
    this.manager = getAutoDownloadManager()
  }

  async init(): Promise<void> {
    await this.manager.init()
    this.inject()
  }

  private inject(): void {
    if (document.getElementById('x-autodownload-toggle')) return
    this.toggleButton = this.createToggleButton()
    DOA(this.toggleButton)
  }

  private createToggleButton(): HTMLElement {
    const button = createE('div', {
      id: 'x-autodownload-toggle',
      in: '⚙️',
      style: `
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
    })

    button.addEventListener('mouseenter', () => {
      button.style.transform = 'scale(1.1)'
      button.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)'
    })
    button.addEventListener('mouseleave', () => {
      button.style.transform = 'scale(1)'
      button.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)'
    })
    button.addEventListener('click', () => this.toggleMenu())

    return button
  }

  private createSettingsMenu(): HTMLElement {
    const menu = document.createElement('div')
    menu.id = 'x-autodownload-settings-menu'
    menu.style.cssText = `
      position: fixed;
      top: 20px;
      right: 70px;
      z-index: 10000;
      background: white;
      border: 1px solid #e1e8ed;
      border-radius: 12px;
      padding: 16px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 14px;
      width: 320px;
      display: none;
      color: #0f1419;
    `

    // 标题
    const title = document.createElement('div')
    title.textContent = 'Auto Download Settings'
    title.style.fontWeight = '700'
    title.style.marginBottom = '16px'
    title.style.fontSize = '16px'
    menu.appendChild(title)

    // 开关
    const switchContainer = document.createElement('div')
    switchContainer.style.display = 'flex'
    switchContainer.style.alignItems = 'center'
    switchContainer.style.marginBottom = '16px'

    const switchLabel = document.createElement('label')
    switchLabel.style.cssText =
      'display: flex; align-items: center; cursor: pointer; flex: 1; user-select: none;'

    const switchInput = document.createElement('input')
    switchInput.type = 'checkbox'
    switchInput.checked = this.manager.getSettings().enableAutoDownload
    switchInput.style.marginRight = '8px'

    switchLabel.appendChild(switchInput)
    switchLabel.appendChild(document.createTextNode('Enable Auto Download'))
    switchContainer.appendChild(switchLabel)
    menu.appendChild(switchContainer)

    // 后缀列表区域
    const suffixSection = document.createElement('div')
    suffixSection.id = 'suffix-section'

    const suffixLabel = document.createElement('div')
    suffixLabel.textContent = 'URL Suffixes:'
    suffixLabel.style.cssText =
      'font-size: 13px; font-weight: 600; color: #536471; margin-bottom: 8px;'
    suffixSection.appendChild(suffixLabel)

    // 标签列表容器
    const listContainer = document.createElement('div')
    listContainer.style.cssText = `
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-bottom: 12px;
      max-height: 200px;
      overflow-y: auto;
    `
    suffixSection.appendChild(listContainer)

    // 输入行
    const inputRow = document.createElement('div')
    inputRow.style.cssText = 'display: flex; gap: 8px; margin-bottom: 8px;'

    const inputField = document.createElement('input')
    inputField.type = 'text'
    inputField.placeholder = 'Add suffix (e.g. name=large)'
    inputField.style.cssText = `
      flex: 1;
      padding: 6px 10px;
      border: 1px solid #cfd9de;
      border-radius: 4px;
      font-size: 13px;
      outline: none;
    `
    inputField.addEventListener('focus', () => (inputField.style.borderColor = '#1d9bf0'))
    inputField.addEventListener('blur', () => (inputField.style.borderColor = '#cfd9de'))

    const addBtn = document.createElement('button')
    addBtn.textContent = 'Add'
    addBtn.style.cssText = `
      padding: 6px 12px;
      background: #0f1419;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-weight: 600;
      font-size: 13px;
    `

    // 添加后缀逻辑
    const addItem = async () => {
      const val = inputField.value.trim()
      if (!val) return

      const current = [...this.manager.getSettings().autoDownloadSuffixes]
      if (!current.includes(val)) {
        current.push(val)
        await this.manager.updateSettings('autoDownloadSuffixes', current)
        renderList()
        inputField.value = ''
      }
    }

    addBtn.addEventListener('click', addItem)
    inputField.addEventListener('keypress', e => {
      if (e.key === 'Enter') addItem()
    })

    inputRow.appendChild(inputField)
    inputRow.appendChild(addBtn)
    suffixSection.appendChild(inputRow)
    menu.appendChild(suffixSection)

    // 渲染后缀列表
    const renderList = () => {
      listContainer.innerHTML = ''
      const suffixes = this.manager.getSettings().autoDownloadSuffixes

      if (suffixes.length === 0) {
        const emptyMsg = document.createElement('div')
        emptyMsg.textContent = 'No suffixes configured'
        emptyMsg.style.cssText = 'color: #999; font-style: italic; font-size: 12px; padding: 4px 0;'
        listContainer.appendChild(emptyMsg)
        return
      }

      suffixes.forEach((suffix, index) => {
        const tag = document.createElement('div')
        tag.style.cssText = `
          background: #eff3f4;
          border: 1px solid #cfd9de;
          border-radius: 16px;
          padding: 4px 10px;
          font-size: 12px;
          display: flex;
          align-items: center;
          gap: 6px;
        `

        const text = document.createElement('span')
        text.textContent = suffix
        tag.appendChild(text)

        const delBtn = document.createElement('span')
        delBtn.innerHTML = '×'
        delBtn.style.cssText = `
          cursor: pointer;
          font-weight: bold;
          color: #536471;
          font-size: 14px;
          line-height: 1;
        `
        delBtn.addEventListener('mouseover', () => (delBtn.style.color = '#f4212e'))
        delBtn.addEventListener('mouseout', () => (delBtn.style.color = '#536471'))
        delBtn.addEventListener('click', async () => {
          const current = [...this.manager.getSettings().autoDownloadSuffixes]
          current.splice(index, 1)
          await this.manager.updateSettings('autoDownloadSuffixes', current)
          renderList()
        })

        tag.appendChild(delBtn)
        listContainer.appendChild(tag)
      })
    }

    // 更新后缀区域可见性
    const updateSuffixesVisibility = () => {
      const isEnabled = this.manager.getSettings().enableAutoDownload
      suffixSection.style.display = isEnabled ? 'block' : 'none'
      if (isEnabled) renderList()
    }

    // 开关事件
    switchInput.addEventListener('change', async e => {
      await this.manager.updateSettings(
        'enableAutoDownload',
        (e.target as HTMLInputElement).checked
      )
      updateSuffixesVisibility()
    })

    // 初始化渲染
    updateSuffixesVisibility()

    // 关闭按钮
    const closeBtn = document.createElement('button')
    closeBtn.textContent = 'Close Settings'
    closeBtn.style.cssText = `
      display: block;
      width: 100%;
      padding: 8px;
      background: white;
      border: 1px solid #cfd9de;
      color: #536471;
      border-radius: 20px;
      cursor: pointer;
      font-size: 13px;
      margin-top: 16px;
      font-weight: 600;
      transition: background 0.2s;
    `
    closeBtn.addEventListener('mouseover', () => (closeBtn.style.background = '#f7f9f9'))
    closeBtn.addEventListener('mouseout', () => (closeBtn.style.background = 'white'))
    closeBtn.addEventListener('click', () => this.hideMenu())
    menu.appendChild(closeBtn)

    return menu
  }

  private toggleMenu(): void {
    if (!this.menuElement) {
      this.menuElement = this.createSettingsMenu()
      document.body.appendChild(this.menuElement)
    }
    this.menuElement.style.display = this.menuElement.style.display === 'none' ? 'block' : 'none'
  }

  private hideMenu(): void {
    if (this.menuElement) {
      this.menuElement.style.display = 'none'
    }
  }

  destroy(): void {
    if (this.toggleButton) {
      this.toggleButton.remove()
      this.toggleButton = null
    }
    if (this.menuElement) {
      this.menuElement.remove()
      this.menuElement = null
    }
  }
}
