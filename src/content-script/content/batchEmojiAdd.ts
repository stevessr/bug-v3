// batchEmojiAdd.ts - 批量添加表情功能（支持 Magnific Popup 和其他模态框）
declare const chrome: any

// 批量添加相关的CSS样式
const batchAddCSS = `
  .batch-emoji-floating-button {
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 99999;
    background: linear-gradient(135deg, #8b5cf6, #a855f7);
    color: white;
    border: none;
    border-radius: 50px;
    padding: 12px 16px;
    font-size: 14px;
    font-weight: 600;
    box-shadow: 0 4px 12px rgba(139, 92, 246, 0.4);
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: all 0.3s ease;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }

  .batch-emoji-floating-button:hover {
    background: linear-gradient(135deg, #7c3aed, #9333ea);
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(139, 92, 246, 0.6);
  }

  .batch-emoji-floating-button.selecting {
    background: linear-gradient(135deg, #f59e0b, #d97706);
  }

  .batch-emoji-floating-button.processing {
    background: linear-gradient(135deg, #06b6d4, #0891b2);
    cursor: not-allowed;
  }

  .batch-emoji-selection-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.3);
    z-index: 99998;
    pointer-events: none;
  }

  .batch-emoji-selection-box {
    border: 2px dashed #8b5cf6;
    background: rgba(139, 92, 246, 0.1);
    pointer-events: none;
    position: absolute;
    z-index: 99999;
  }

  .batch-selected-image {
    outline: 3px solid #8b5cf6 !important;
    outline-offset: 2px !important;
    box-shadow: 0 0 0 6px rgba(139, 92, 246, 0.2) !important;
  }

  .batch-progress-panel {
    position: fixed;
    top: 80px;
    right: 20px;
    width: 320px;
    max-height: 400px;
    background: white;
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    z-index: 99997;
    overflow: hidden;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }

  .batch-progress-header {
    padding: 16px;
    background: linear-gradient(135deg, #8b5cf6, #a855f7);
    color: white;
    font-weight: 600;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .batch-progress-body {
    padding: 16px;
    max-height: 300px;
    overflow-y: auto;
  }

  .batch-progress-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 0;
    border-bottom: 1px solid #f3f4f6;
  }

  .batch-progress-item:last-child {
    border-bottom: none;
  }

  .batch-progress-image {
    width: 40px;
    height: 40px;
    object-fit: cover;
    border-radius: 6px;
    background: #f3f4f6;
  }

  .batch-progress-info {
    flex: 1;
    min-width: 0;
  }

  .batch-progress-name {
    font-weight: 500;
    color: #374151;
    font-size: 14px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .batch-progress-status {
    font-size: 12px;
    color: #6b7280;
    margin-top: 2px;
  }

  .batch-progress-status.success {
    color: #10b981;
  }

  .batch-progress-status.error {
    color: #ef4444;
  }

  .batch-progress-status.processing {
    color: #3b82f6;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .spinning {
    animation: spin 1s linear infinite;
  }
`

interface BatchEmojiData {
  displayName: string
  realUrl: URL
  element: HTMLImageElement
}

interface BatchProgress {
  total: number
  completed: number
  succeeded: number
  failed: number
  items: Array<{
    data: BatchEmojiData
    status: 'pending' | 'processing' | 'success' | 'error'
    error?: string
  }>
}

class BatchEmojiManager {
  private floatingButton: HTMLElement | null = null
  private isSelecting = false
  private selectedImages: Set<HTMLImageElement> = new Set()
  private progressPanel: HTMLElement | null = null
  private batchProgress: BatchProgress | null = null

  constructor() {
    this.injectCSS()
    this.createFloatingButton()
    this.setupEventListeners()
  }

  private injectCSS() {
    if (!document.getElementById('batch-emoji-styles')) {
      const style = document.createElement('style')
      style.id = 'batch-emoji-styles'
      style.textContent = batchAddCSS
      document.head.appendChild(style)
    }
  }

  private createFloatingButton() {
    if (this.floatingButton) return

    this.floatingButton = document.createElement('button')
    this.floatingButton.className = 'batch-emoji-floating-button'
    this.floatingButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width: 18px; height: 18px; fill: currentColor;">
        <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
      </svg>
      <span>批量添加表情</span>
    `
    this.floatingButton.title = '批量选择并添加表情到收藏'

    this.floatingButton.addEventListener('click', () => {
      this.toggleSelectionMode()
    })

    document.body.appendChild(this.floatingButton)
  }

  private setupEventListeners() {
    // 监听模态框变化
    const observer = new MutationObserver((mutations) => {
      let hasModalChanges = false

      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as Element
              if (this.isModalContainer(element)) {
                hasModalChanges = true
              }
            }
          })

          mutation.removedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as Element
              if (this.isModalContainer(element)) {
                this.hideFloatingButton()
                this.exitSelectionMode()
              }
            }
          })
        }
      })

      if (hasModalChanges) {
        setTimeout(() => this.updateButtonVisibility(), 100)
      }
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    })

    // 监听页面可见性变化
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        setTimeout(() => this.updateButtonVisibility(), 200)
      }
    })

    // 监听 ESC 键退出选择模式
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isSelecting) {
        this.exitSelectionMode()
      }
    })
  }

  private isModalContainer(element: Element): boolean {
    return (
      element.classList?.contains('mfp-wrap') ||
      element.classList?.contains('mfp-content') ||
      element.querySelector?.('.mfp-content') !== null ||
      element.querySelector?.('.mfp-figure') !== null
    )
  }

  private updateButtonVisibility() {
    const hasModal = this.hasActiveModal()
    if (hasModal) {
      this.showFloatingButton()
    } else {
      this.hideFloatingButton()
      this.exitSelectionMode()
    }
  }

  private hasActiveModal(): boolean {
    return (
      document.querySelector('.mfp-wrap') !== null ||
      document.querySelector('.mfp-content') !== null ||
      document.querySelector('[class*="modal"]') !== null
    )
  }

  private showFloatingButton() {
    if (this.floatingButton) {
      this.floatingButton.style.display = 'flex'
    }
  }

  private hideFloatingButton() {
    if (this.floatingButton) {
      this.floatingButton.style.display = 'none'
    }
  }

  private toggleSelectionMode() {
    if (this.isSelecting) {
      this.exitSelectionMode()
    } else {
      this.enterSelectionMode()
    }
  }

  private enterSelectionMode() {
    this.isSelecting = true
    this.selectedImages.clear()

    if (this.floatingButton) {
      this.floatingButton.className = 'batch-emoji-floating-button selecting'
      this.floatingButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width: 18px; height: 18px; fill: currentColor;">
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
        </svg>
        <span>选择表情 (0)</span>
      `
    }

    // 为所有可选择的图片添加点击监听器
    this.setupImageSelection()

    console.log('[BatchEmojiAdd] 进入选择模式')
  }

  private exitSelectionMode() {
    this.isSelecting = false
    this.selectedImages.clear()

    if (this.floatingButton) {
      this.floatingButton.className = 'batch-emoji-floating-button'
      this.floatingButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width: 18px; height: 18px; fill: currentColor;">
          <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
        </svg>
        <span>批量添加表情</span>
      `
    }

    // 移除所有选择标记
    document.querySelectorAll('.batch-selected-image').forEach((img) => {
      img.classList.remove('batch-selected-image')
    })

    console.log('[BatchEmojiAdd] 退出选择模式')
  }

  private setupImageSelection() {
    const images = this.getSelectableImages()

    images.forEach((img) => {
      const clickHandler = (e: Event) => {
        e.preventDefault()
        e.stopPropagation()
        this.toggleImageSelection(img)
      }

      // 移除之前的监听器（如果有的话）
      img.removeEventListener('click', clickHandler)
      img.addEventListener('click', clickHandler)

      // 添加视觉指示
      img.style.cursor = 'pointer'
      img.title = '点击选择此表情'
    })
  }

  private getSelectableImages(): HTMLImageElement[] {
    const selectors = [
      '.mfp-content img',
      '.mfp-figure img',
      '.modal-content img',
      '[class*="modal"] img[src*="emoji"]',
      '[class*="modal"] img[src*="sticker"]',
      'img[src*="emoji"]',
      'img[src*="sticker"]',
    ]

    const images: HTMLImageElement[] = []
    selectors.forEach((selector) => {
      const found = document.querySelectorAll(selector) as NodeListOf<HTMLImageElement>
      found.forEach((img) => {
        if (this.isValidEmojiImage(img) && !images.includes(img)) {
          images.push(img)
        }
      })
    })

    return images
  }

  private isValidEmojiImage(img: HTMLImageElement): boolean {
    if (!img.src || !img.src.startsWith('http')) return false

    // 检查图片尺寸（排除过大或过小的图片）
    const { width, height } = img
    if (width > 500 || height > 500 || width < 16 || height < 16) return false

    return true
  }

  private toggleImageSelection(img: HTMLImageElement) {
    if (this.selectedImages.has(img)) {
      this.selectedImages.delete(img)
      img.classList.remove('batch-selected-image')
    } else {
      this.selectedImages.add(img)
      img.classList.add('batch-selected-image')
    }

    this.updateSelectionCount()

    // 如果有选中的图片，显示开始处理按钮
    if (this.selectedImages.size > 0) {
      this.showBatchProcessButton()
    } else {
      this.hideBatchProcessButton()
    }
  }

  private updateSelectionCount() {
    if (this.floatingButton && this.isSelecting) {
      const count = this.selectedImages.size
      this.floatingButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width: 18px; height: 18px; fill: currentColor;">
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
        </svg>
        <span>选择表情 (${count})</span>
      `
    }
  }

  private showBatchProcessButton() {
    const existingButton = document.querySelector('.batch-process-button')
    if (existingButton) return

    const processButton = document.createElement('button')
    processButton.className = 'batch-emoji-floating-button batch-process-button'
    processButton.style.top = '80px'
    processButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width: 18px; height: 18px; fill: currentColor;">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
      </svg>
      <span>开始批量添加 (${this.selectedImages.size})</span>
    `

    processButton.addEventListener('click', () => {
      this.startBatchProcess()
    })

    document.body.appendChild(processButton)
  }

  private hideBatchProcessButton() {
    const processButton = document.querySelector('.batch-process-button')
    if (processButton) {
      processButton.remove()
    }
  }

  private async startBatchProcess() {
    if (this.selectedImages.size === 0) return

    // 收集选中的表情数据
    const emojiDataList: BatchEmojiData[] = []
    this.selectedImages.forEach((img) => {
      const data = this.extractEmojiData(img)
      if (data) {
        emojiDataList.push(data)
      }
    })

    if (emojiDataList.length === 0) {
      alert('没有找到有效的表情数据')
      return
    }

    // 初始化批量处理状态
    this.batchProgress = {
      total: emojiDataList.length,
      completed: 0,
      succeeded: 0,
      failed: 0,
      items: emojiDataList.map((data) => ({
        data,
        status: 'pending',
      })),
    }

    // 显示进度面板
    this.showProgressPanel()

    // 更新按钮状态
    if (this.floatingButton) {
      this.floatingButton.className = 'batch-emoji-floating-button processing'
      this.floatingButton.innerHTML = `
        <div class="spinning" style="width: 18px; height: 18px;">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width: 100%; height: 100%; fill: currentColor;">
            <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8z"/>
            <path d="M12 18c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
          </svg>
        </div>
        <span>处理中...</span>
      `
    }

    // 隐藏批量处理按钮
    this.hideBatchProcessButton()

    // 开始批量处理
    await this.processBatchEmojis()
  }

  private extractEmojiData(img: HTMLImageElement): BatchEmojiData | null {
    const src = img.src
    if (!src || !src.startsWith('http')) return null

    // 尝试从各种属性获取名称
    let displayName = img.alt || img.title || img.dataset.name || ''

    // 如果没有找到名称，尝试从父元素获取
    if (!displayName) {
      const parent = img.closest('.mfp-title, .modal-title, [class*="title"]')
      if (parent) {
        displayName = parent.textContent?.trim() || ''
      }
    }

    // 最后尝试从URL提取名称
    if (!displayName || displayName.length < 2) {
      displayName = this.extractNameFromUrl(src)
    }

    return {
      displayName: displayName || '表情',
      realUrl: new URL(src),
      element: img,
    }
  }

  private extractNameFromUrl(url: string): string {
    try {
      const urlObj = new URL(url)
      const pathname = urlObj.pathname
      const filename = pathname.split('/').pop() || ''
      const nameWithoutExt = filename.replace(/\.[^/.]+$/, '')
      const decoded = decodeURIComponent(nameWithoutExt)

      if (/^[0-9a-f]{8,}$/i.test(decoded) || decoded.length < 2) {
        return '表情'
      }

      return decoded || '表情'
    } catch {
      return '表情'
    }
  }

  private showProgressPanel() {
    if (this.progressPanel) return

    this.progressPanel = document.createElement('div')
    this.progressPanel.className = 'batch-progress-panel'
    this.updateProgressPanel()

    document.body.appendChild(this.progressPanel)
  }

  private updateProgressPanel() {
    if (!this.progressPanel || !this.batchProgress) return

    const { total, completed, succeeded, failed, items } = this.batchProgress

    this.progressPanel.innerHTML = `
      <div class="batch-progress-header">
        <span>批量添加进度 (${completed}/${total})</span>
        <button onclick="this.parentElement.parentElement.remove()" style="background: none; border: none; color: white; cursor: pointer; font-size: 18px;">×</button>
      </div>
      <div class="batch-progress-body">
        ${items
          .map(
            (item) => `
          <div class="batch-progress-item">
            <img src="${item.data.realUrl}" alt="${item.data.displayName}" class="batch-progress-image" onerror="this.style.display='none'">
            <div class="batch-progress-info">
              <div class="batch-progress-name">${item.data.displayName}</div>
              <div class="batch-progress-status ${item.status}">${this.getStatusText(item.status)}</div>
            </div>
          </div>
        `,
          )
          .join('')}
      </div>
    `
  }

  private getStatusText(status: string): string {
    switch (status) {
      case 'pending':
        return '等待处理'
      case 'processing':
        return '处理中...'
      case 'success':
        return '添加成功'
      case 'error':
        return '添加失败'
      default:
        return '未知状态'
    }
  }

  private async processBatchEmojis() {
    if (!this.batchProgress) return

    for (let i = 0; i < this.batchProgress.items.length; i++) {
      const item = this.batchProgress.items[i]
      item.status = 'processing'
      this.updateProgressPanel()

      try {
        await chrome.runtime.sendMessage({
          action: 'addEmojiFromWeb',
          emojiData: {
            displayName: item.data.displayName,
            realUrl: item.data.realUrl,
          },
        })

        item.status = 'success'
        this.batchProgress.succeeded++
      } catch (error) {
        console.error('[BatchEmojiAdd] 添加表情失败:', error)
        item.status = 'error'
        item.error = error instanceof Error ? error.message : '未知错误'
        this.batchProgress.failed++
      }

      this.batchProgress.completed++
      this.updateProgressPanel()

      // 添加小延迟避免过快的请求
      await new Promise((resolve) => setTimeout(resolve, 200))
    }

    // 处理完成
    await this.completeBatchProcess()
  }

  private async completeBatchProcess() {
    if (!this.batchProgress) return

    const { total, succeeded, failed } = this.batchProgress

    console.log(`[BatchEmojiAdd] 批量处理完成: 成功 ${succeeded}/${total}, 失败 ${failed}`)

    // 恢复按钮状态
    this.exitSelectionMode()

    // 显示完成通知
    if (succeeded > 0) {
      this.showNotification(`成功添加 ${succeeded} 个表情！${failed > 0 ? ` (${failed} 个失败)` : ''}`, 'success')
    } else {
      this.showNotification('批量添加失败，请检查网络连接', 'error')
    }

    // 清理状态
    this.batchProgress = null
  }

  private showNotification(message: string, type: 'success' | 'error') {
    const notification = document.createElement('div')
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: ${type === 'success' ? '#10b981' : '#ef4444'};
      color: white;
      padding: 12px 24px;
      border-radius: 6px;
      font-weight: 500;
      z-index: 99999;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    `
    notification.textContent = message

    document.body.appendChild(notification)

    setTimeout(() => {
      notification.remove()
    }, 3000)
  }

  // 公共方法：手动更新按钮可见性
  public updateVisibility() {
    this.updateButtonVisibility()
  }

  // 公共方法：销毁管理器
  public destroy() {
    if (this.floatingButton) {
      this.floatingButton.remove()
      this.floatingButton = null
    }

    if (this.progressPanel) {
      this.progressPanel.remove()
      this.progressPanel = null
    }

    this.hideBatchProcessButton()
    this.exitSelectionMode()
  }
}

// 全局实例
let batchEmojiManager: BatchEmojiManager | null = null

/**
 * 初始化批量添加表情功能
 */
export function initBatchEmojiAdd() {
  console.log('[BatchEmojiAdd] 初始化批量添加表情功能')

  if (batchEmojiManager) {
    batchEmojiManager.destroy()
  }

  batchEmojiManager = new BatchEmojiManager()
}

/**
 * 销毁批量添加功能
 */
export function destroyBatchEmojiAdd() {
  if (batchEmojiManager) {
    batchEmojiManager.destroy()
    batchEmojiManager = null
  }
}