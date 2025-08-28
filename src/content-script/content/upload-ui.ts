import { uploadQueue, type UploadQueueItem } from './upload-queue'

type FilterType = 'all' | 'waiting' | 'uploading' | 'success' | 'failed'

/**
 * 上传队列UI管理器
 */
class UploadQueueUI {
  private panel: HTMLElement | null = null
  private currentFilter: FilterType = 'all'
  private panelVisible = false
  private boundUploadProgressHandler: ((event: Event) => void) | null = null

  /**
   * 创建上传队列面板
   */
  createUploadQueuePanel(): HTMLElement {
    const panel = document.createElement('div')
    panel.className = 'upload-queue-panel'
    panel.style.cssText = `
      position: fixed;
      top: 50px;
      right: 20px;
      width: 400px;
      max-height: 600px;
      background: white;
      border: 1px solid #ddd;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 10001;
      overflow: hidden;
      display: none;
    `

    panel.innerHTML = `
      <div class="upload-queue-header">
        <h3 style="margin: 0; padding: 16px; border-bottom: 1px solid #eee; font-size: 16px; font-weight: 600;">
          文件上传队列
        </h3>
        <div class="upload-queue-controls" style="padding: 8px 16px; border-bottom: 1px solid #eee; display: flex; gap: 8px; justify-content: flex-end;">
          <button class="btn btn-small" id="upload-retry-failed" title="重试所有失败的上传">重试失败</button>
          <button class="btn btn-small" id="upload-clear-completed" title="清除已完成的上传">清除完成</button>
          <button class="btn btn-small" id="upload-clear-all" title="清除所有上传">清除全部</button>
          <button class="btn btn-small" id="upload-close-panel" title="关闭上传队列">关闭</button>
        </div>
      </div>
      <div class="upload-queue-filters" style="padding: 8px 16px; border-bottom: 1px solid #eee; display: flex; gap: 4px;">
        <button class="btn btn-small filter-btn active" data-filter="all">全部</button>
        <button class="btn btn-small filter-btn" data-filter="waiting">等待中</button>
        <button class="btn btn-small filter-btn" data-filter="uploading">上传中</button>
        <button class="btn btn-small filter-btn" data-filter="success">成功</button>
        <button class="btn btn-small filter-btn" data-filter="failed">失败</button>
      </div>
      <div class="upload-queue-summary" style="padding: 8px 16px; background: #f8f9fa; font-size: 14px; color: #666;">
        <span id="upload-summary-text">暂无上传任务</span>
      </div>
      <div class="upload-queue-list" id="upload-queue-list" style="max-height: 400px; overflow-y: auto; padding: 8px;">
        <!-- 动态生成队列项 -->
      </div>
      <div class="upload-queue-actions" style="padding: 16px; border-top: 1px solid #eee; background: #f8f9fa;">
        <button class="btn btn-primary" id="upload-copy-markdown" style="width: 100%;" title="复制所有成功上传的Markdown到剪贴板">
          复制成功上传的Markdown
        </button>
      </div>
    `

    this.bindEvents(panel)
    this.panel = panel
    return panel
  }

  /**
   * 绑定面板事件
   */
  private bindEvents(panel: HTMLElement) {
    // 重试失败按钮
    const retryBtn = panel.querySelector('#upload-retry-failed') as HTMLButtonElement
    retryBtn?.addEventListener('click', () => {
      uploadQueue.retryFailed()
      this.updateQueueDisplay()
    })

    // 清除完成按钮  
    const clearCompletedBtn = panel.querySelector('#upload-clear-completed') as HTMLButtonElement
    clearCompletedBtn?.addEventListener('click', () => {
      uploadQueue.clearCompleted()
      this.updateQueueDisplay()
    })

    // 清除全部按钮
    const clearAllBtn = panel.querySelector('#upload-clear-all') as HTMLButtonElement
    clearAllBtn?.addEventListener('click', () => {
      if (confirm('确定要清除所有上传任务吗？')) {
        uploadQueue.clearAll()
        this.updateQueueDisplay()
      }
    })

    // 关闭面板按钮
    const closeBtn = panel.querySelector('#upload-close-panel') as HTMLButtonElement
    closeBtn?.addEventListener('click', () => {
      this.hidePanel()
    })

    // 过滤按钮
    const filterBtns = panel.querySelectorAll('.filter-btn')
    filterBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.target as HTMLButtonElement
        const filter = target.getAttribute('data-filter') as FilterType

        // 更新按钮状态
        filterBtns.forEach(b => b.classList.remove('active'))
        target.classList.add('active')

        this.currentFilter = filter
        this.updateQueueDisplay()
      })
    })

    // 复制Markdown按钮
    const copyMarkdownBtn = panel.querySelector('#upload-copy-markdown') as HTMLButtonElement
    copyMarkdownBtn?.addEventListener('click', () => {
      this.copySuccessfulMarkdown()
    })

    // 监听上传进度事件
    this.boundUploadProgressHandler = this.handleUploadProgress.bind(this)
    window.addEventListener('upload-progress', this.boundUploadProgressHandler)
  }

  /**
   * 处理上传进度事件
   */
  private handleUploadProgress(event: Event) {
    const customEvent = event as CustomEvent
    this.updateQueueDisplay()
  }

  /**
   * 显示面板
   */
  showPanel() {
    if (!this.panel) {
      this.panel = this.createUploadQueuePanel()
      document.body.appendChild(this.panel)
    }
    
    this.panel.style.display = 'block'
    this.panelVisible = true
    this.updateQueueDisplay()
  }

  /**
   * 隐藏面板
   */
  hidePanel() {
    if (this.panel) {
      this.panel.style.display = 'none'
    }
    this.panelVisible = false
  }

  /**
   * 切换面板显示状态
   */
  togglePanel() {
    if (this.panelVisible) {
      this.hidePanel()
    } else {
      this.showPanel()
    }
  }

  /**
   * 更新队列显示
   */
  updateQueueDisplay() {
    if (!this.panel || !this.panelVisible) return

    const queueList = this.panel.querySelector('#upload-queue-list') as HTMLElement
    const summaryText = this.panel.querySelector('#upload-summary-text') as HTMLElement

    if (!queueList || !summaryText) return

    // 获取队列状态
    const queueStatus = uploadQueue.getQueueStatus()
    const filteredItems = this.currentFilter === 'all' 
      ? queueStatus.items 
      : queueStatus.items.filter(item => item.status === this.currentFilter)

    // 更新摘要信息
    const total = queueStatus.items.length
    const waiting = queueStatus.items.filter(item => item.status === 'waiting').length
    const uploading = queueStatus.items.filter(item => item.status === 'uploading').length
    const success = queueStatus.items.filter(item => item.status === 'success').length
    const failed = queueStatus.items.filter(item => item.status === 'failed').length

    summaryText.innerHTML = `
      总计: ${total} | 等待: ${waiting} | 上传中: ${uploading} | 成功: ${success} | 失败: ${failed}
    `

    // 更新队列列表
    if (filteredItems.length === 0) {
      queueList.innerHTML = `
        <div style="text-align: center; padding: 20px; color: #666;">
          ${this.currentFilter === 'all' ? '暂无上传任务' : `暂无${this.getFilterDisplayName(this.currentFilter)}的任务`}
        </div>
      `
    } else {
      queueList.innerHTML = filteredItems.map(item => this.createQueueItemHTML(item)).join('')
    }
  }

  /**
   * 创建队列项HTML
   */
  private createQueueItemHTML(item: any): string {
    const statusClass = `status-${item.status}`
    const statusText = this.getStatusDisplayText(item.status)
    const progressBar = item.status === 'uploading' 
      ? `<div class="progress-bar" style="width: 100%; height: 4px; background: #eee; border-radius: 2px; margin: 4px 0;"><div style="width: ${item.progress}%; height: 100%; background: #007cba; border-radius: 2px; transition: width 0.3s;"></div></div>`
      : ''

    const errorText = item.error 
      ? `<div style="color: #dc3545; font-size: 12px; margin-top: 4px;">错误: ${item.error.message || item.error}</div>`
      : ''

    return `
      <div class="upload-queue-item ${statusClass}" style="
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 12px;
        margin-bottom: 8px;
        border: 1px solid #eee;
        border-radius: 6px;
        background: ${this.getStatusBackgroundColor(item.status)};
      ">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-weight: 500; max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${item.fileName}">
            ${item.fileName}
          </span>
          <span class="status-badge" style="
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 500;
            color: ${this.getStatusTextColor(item.status)};
            background: ${this.getStatusBadgeColor(item.status)};
          ">
            ${statusText}
          </span>
        </div>
        ${progressBar}
        ${errorText}
      </div>
    `
  }

  /**
   * 获取状态显示文本
   */
  private getStatusDisplayText(status: string): string {
    const statusMap: Record<string, string> = {
      waiting: '等待中',
      uploading: '上传中',
      success: '成功',
      failed: '失败'
    }
    return statusMap[status] || status
  }

  /**
   * 获取过滤器显示名称
   */
  private getFilterDisplayName(filter: FilterType): string {
    const filterMap: Record<FilterType, string> = {
      all: '全部',
      waiting: '等待中',
      uploading: '上传中',
      success: '成功',
      failed: '失败'
    }
    return filterMap[filter] || filter
  }

  /**
   * 获取状态背景色
   */
  private getStatusBackgroundColor(status: string): string {
    const colorMap: Record<string, string> = {
      waiting: '#fff3cd',
      uploading: '#e3f2fd',
      success: '#e8f5e8',
      failed: '#ffebee'
    }
    return colorMap[status] || '#ffffff'
  }

  /**
   * 获取状态文字颜色
   */
  private getStatusTextColor(status: string): string {
    const colorMap: Record<string, string> = {
      waiting: '#856404',
      uploading: '#1976d2',
      success: '#2e7d32',
      failed: '#d32f2f'
    }
    return colorMap[status] || '#333333'
  }

  /**
   * 获取状态徽章颜色
   */
  private getStatusBadgeColor(status: string): string {
    const colorMap: Record<string, string> = {
      waiting: '#fff3cd',
      uploading: '#bbdefb',
      success: '#c8e6c9',
      failed: '#ffcdd2'
    }
    return colorMap[status] || '#f0f0f0'
  }

  /**
   * 复制成功上传的Markdown
   */
  private async copySuccessfulMarkdown() {
    try {
      const markdown = uploadQueue.getSuccessfulMarkdown()
      
      if (!markdown) {
        alert('暂无成功上传的文件')
        return
      }

      await navigator.clipboard.writeText(markdown)
      
      // 显示成功提示
      const copyBtn = this.panel?.querySelector('#upload-copy-markdown') as HTMLButtonElement
      if (copyBtn) {
        const originalText = copyBtn.textContent
        copyBtn.textContent = '已复制！'
        copyBtn.style.background = '#28a745'
        
        setTimeout(() => {
          copyBtn.textContent = originalText
          copyBtn.style.background = ''
        }, 2000)
      }
      
      console.log('[上传队列] 已复制Markdown到剪贴板:', markdown)
    } catch (error) {
      console.error('[上传队列] 复制失败:', error)
      alert('复制失败，请手动复制')
    }
  }

  /**
   * 获取面板是否可见
   */
  isVisible(): boolean {
    return this.panelVisible
  }

  /**
   * 销毁UI组件
   */
  destroy() {
    if (this.boundUploadProgressHandler) {
      window.removeEventListener('upload-progress', this.boundUploadProgressHandler)
      this.boundUploadProgressHandler = null
    }
    
    if (this.panel) {
      this.panel.remove()
      this.panel = null
    }
    
    this.panelVisible = false
  }
}

// 全局上传队列UI实例
const uploadQueueUI = new UploadQueueUI()

export { uploadQueueUI, UploadQueueUI }
export default uploadQueueUI