/**
 * Enhanced Userscript with default.json integration, mobile support, and file upload queues
 */

import defaultConfig from '../config/default.json'

// Upload queue states
export enum UploadState {
  PENDING = 'pending',
  UPLOADING = 'uploading',
  RETRY = 'retry',
  SUCCESS = 'success',
  FAILED = 'failed'
}

export interface UploadItem {
  id: string
  file: File
  state: UploadState
  progress: number
  error?: string
  uploadedUrl?: string
  retryCount: number
  timestamp: number
}

export interface UserscriptSettings {
  imageScale: number
  gridColumns: number
  outputFormat: 'markdown' | 'html'
  forceMobileMode: boolean
  defaultGroup: string
  showSearchBar: boolean
  enableFileUpload: boolean
  maxConcurrentUploads: number
  autoRetryFailedUploads: boolean
  uploadTimeout: number
}

export interface EmojiGroup {
  id: string
  name: string
  icon: string
  order: number
  emojis: Array<{
    id: string
    name: string
    url: string
    width?: number
    height?: number
    groupId: string
    packet?: number
    addedAt?: number
    lastUsed?: number
    usageCount?: number
  }>
}

export class EnhancedUserscriptManager {
  private settings: UserscriptSettings
  private emojiGroups: EmojiGroup[]
  private uploadQueues: Map<UploadState, UploadItem[]> = new Map()
  private uploadWorkers: number = 0
  private maxWorkers: number = 3
  private isMobile: boolean = false
  private container: HTMLElement | null = null

  constructor() {
    this.isMobile = this.detectMobile()
    this.settings = this.loadSettings()
    this.emojiGroups = this.loadEmojiGroups()

    // Initialize upload queues
    this.uploadQueues.set(UploadState.PENDING, [])
    this.uploadQueues.set(UploadState.UPLOADING, [])
    this.uploadQueues.set(UploadState.RETRY, [])
    this.uploadQueues.set(UploadState.SUCCESS, [])

    this.setupUploadProcessor()
  }

  private detectMobile(): boolean {
    return (
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
      window.innerWidth <= 768
    )
  }

  private loadSettings(): UserscriptSettings {
    try {
      const stored = localStorage.getItem('emoji_extension_userscript_settings')
      if (stored) {
        const parsed = JSON.parse(stored)
        return {
          ...defaultConfig.settings,
          ...parsed
        } as UserscriptSettings
      }
    } catch (error) {
      console.error('Failed to load userscript settings:', error)
    }

    // Return defaults from default.json
    return {
      imageScale: defaultConfig.settings.imageScale,
      gridColumns: defaultConfig.settings.gridColumns,
      outputFormat: defaultConfig.settings.outputFormat as 'markdown' | 'html',
      forceMobileMode: defaultConfig.settings.forceMobileMode,
      defaultGroup: defaultConfig.settings.defaultGroup,
      showSearchBar: defaultConfig.settings.showSearchBar,
      enableFileUpload: true,
      maxConcurrentUploads: 3,
      autoRetryFailedUploads: true,
      uploadTimeout: 30000
    }
  }

  private loadEmojiGroups(): EmojiGroup[] {
    try {
      const stored = localStorage.getItem('emoji_extension_userscript_data')
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed
        }
      }
    } catch (error) {
      console.error('Failed to load emoji groups:', error)
    }

    // Return defaults from default.json
    return defaultConfig.groups as EmojiGroup[]
  }

  private saveSettings(): void {
    try {
      localStorage.setItem('emoji_extension_userscript_settings', JSON.stringify(this.settings))
    } catch (error) {
      console.error('Failed to save userscript settings:', error)
    }
  }

  private saveEmojiGroups(): void {
    try {
      localStorage.setItem('emoji_extension_userscript_data', JSON.stringify(this.emojiGroups))
    } catch (error) {
      console.error('Failed to save emoji groups:', error)
    }
  }

  public createEmojiPicker(): HTMLElement {
    const picker = document.createElement('div')
    picker.className = `emoji-picker ${this.isMobile || this.settings.forceMobileMode ? 'mobile' : 'desktop'}`

    picker.innerHTML = this.generatePickerHTML()
    this.setupPickerEvents(picker)

    return picker
  }

  private generatePickerHTML(): string {
    const isMobileLayout = this.isMobile || this.settings.forceMobileMode
    const columns = isMobileLayout
      ? Math.max(4, Math.min(6, this.settings.gridColumns))
      : this.settings.gridColumns

    return `
      <div class="emoji-picker__header">
        <div class="emoji-picker__title">
          <span>表情选择器</span>
          ${this.settings.enableFileUpload ? '<button class="upload-btn" title="上传图片">📁</button>' : ''}
          <button class="close-btn" title="关闭">×</button>
        </div>
        ${this.settings.showSearchBar ? '<input type="text" class="emoji-picker__search" placeholder="搜索表情...">' : ''}
      </div>
      
      <div class="emoji-picker__tabs">
        ${this.emojiGroups
          .map(
            group => `
          <button class="emoji-picker__tab" data-group="${group.id}" title="${group.name}">
            ${group.icon}
          </button>
        `
          )
          .join('')}
      </div>
      
      <div class="emoji-picker__content" style="grid-template-columns: repeat(${columns}, 1fr)">
        ${this.generateGroupsHTML()}
      </div>
      
      ${this.settings.enableFileUpload ? this.generateUploadQueuesHTML() : ''}
      
      <style>
        .emoji-picker {
          position: fixed;
          z-index: 10000;
          background: white;
          border: 1px solid #ddd;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          max-width: 400px;
          max-height: 500px;
          overflow: hidden;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        
        .emoji-picker.mobile {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          max-width: 100vw;
          max-height: 60vh;
          border-radius: 8px 8px 0 0;
          border-bottom: none;
        }
        
        .emoji-picker__header {
          background: #f8f9fa;
          border-bottom: 1px solid #ddd;
          padding: 8px 12px;
        }
        
        .emoji-picker__title {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-weight: 600;
          font-size: 14px;
        }
        
        .upload-btn, .close-btn {
          background: none;
          border: none;
          cursor: pointer;
          font-size: 16px;
          padding: 4px;
          border-radius: 4px;
        }
        
        .upload-btn:hover, .close-btn:hover {
          background: #e9ecef;
        }
        
        .emoji-picker__search {
          width: 100%;
          padding: 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
          margin-top: 8px;
          font-size: 14px;
        }
        
        .emoji-picker__tabs {
          display: flex;
          background: #f8f9fa;
          border-bottom: 1px solid #ddd;
          overflow-x: auto;
        }
        
        .emoji-picker__tab {
          background: none;
          border: none;
          padding: 8px 12px;
          cursor: pointer;
          font-size: 18px;
          border-bottom: 2px solid transparent;
          min-width: 44px;
        }
        
        .emoji-picker__tab:hover {
          background: #e9ecef;
        }
        
        .emoji-picker__tab.active {
          border-bottom-color: #007bff;
          background: white;
        }
        
        .emoji-picker__content {
          max-height: 300px;
          overflow-y: auto;
          padding: 8px;
          display: grid;
          gap: 4px;
        }
        
        .emoji-picker.mobile .emoji-picker__content {
          max-height: 250px;
        }
        
        .emoji-item {
          aspect-ratio: 1;
          border: none;
          background: none;
          cursor: pointer;
          border-radius: 4px;
          padding: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .emoji-item:hover {
          background: #f8f9fa;
        }
        
        .emoji-item img {
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
        }
        
        .upload-queues {
          border-top: 1px solid #ddd;
          background: #f8f9fa;
          max-height: 120px;
          overflow-y: auto;
        }
        
        .queue-section {
          padding: 8px;
          border-bottom: 1px solid #eee;
        }
        
        .queue-header {
          font-size: 12px;
          font-weight: 600;
          margin-bottom: 4px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .queue-items {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
        }
        
        .queue-item {
          font-size: 10px;
          padding: 2px 6px;
          border-radius: 12px;
          background: white;
          border: 1px solid #ddd;
          max-width: 100px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        
        .queue-item.pending { border-color: #ffc107; }
        .queue-item.uploading { border-color: #007bff; }
        .queue-item.retry { border-color: #dc3545; }
        .queue-item.success { border-color: #28a745; }
        
        @media (max-width: 768px) {
          .emoji-picker:not(.mobile) {
            max-width: 90vw;
            max-height: 70vh;
          }
        }
      </style>
    `
  }

  private generateGroupsHTML(): string {
    return this.emojiGroups
      .map(
        group => `
      <div class="emoji-group" data-group="${group.id}" style="display: none;">
        ${group.emojis
          .map(
            emoji => `
          <button class="emoji-item" 
                  data-emoji='${JSON.stringify(emoji)}' 
                  title="${emoji.name}">
            <img src="${emoji.url}" 
                 alt="${emoji.name}"
                 style="width: ${this.settings.imageScale}%; height: ${this.settings.imageScale}%"
                 loading="lazy">
          </button>
        `
          )
          .join('')}
      </div>
    `
      )
      .join('')
  }

  private generateUploadQueuesHTML(): string {
    return `
      <div class="upload-queues">
        <div class="queue-section" data-state="pending">
          <div class="queue-header">
            <span>⏳ 待上传 (<span class="count">0</span>)</span>
            <button class="clear-queue-btn" data-state="pending">清空</button>
          </div>
          <div class="queue-items" data-state="pending"></div>
        </div>
        
        <div class="queue-section" data-state="uploading">
          <div class="queue-header">
            <span>⬆️ 上传中 (<span class="count">0</span>)</span>
          </div>
          <div class="queue-items" data-state="uploading"></div>
        </div>
        
        <div class="queue-section" data-state="retry">
          <div class="queue-header">
            <span>🔄 重试/失败 (<span class="count">0</span>)</span>
            <button class="retry-all-btn">重试全部</button>
          </div>
          <div class="queue-items" data-state="retry"></div>
        </div>
        
        <div class="queue-section" data-state="success">
          <div class="queue-header">
            <span>✅ 已完成 (<span class="count">0</span>)</span>
            <button class="clear-queue-btn" data-state="success">清空</button>
          </div>
          <div class="queue-items" data-state="success"></div>
        </div>
      </div>
    `
  }

  private setupPickerEvents(picker: HTMLElement): void {
    // Close button
    const closeBtn = picker.querySelector('.close-btn')
    closeBtn?.addEventListener('click', () => {
      picker.remove()
    })

    // Upload button
    const uploadBtn = picker.querySelector('.upload-btn')
    uploadBtn?.addEventListener('click', () => {
      this.openFileDialog()
    })

    // Tab switching
    const tabs = picker.querySelectorAll('.emoji-picker__tab')
    const groups = picker.querySelectorAll('.emoji-group')

    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => {
        // Remove active class from all tabs and groups
        tabs.forEach(t => t.classList.remove('active'))
        groups.forEach(g => ((g as HTMLElement).style.display = 'none'))

        // Activate clicked tab and corresponding group
        tab.classList.add('active')
        if (groups[index]) {
          ;(groups[index] as HTMLElement).style.display = 'grid'
        }
      })
    })

    // Activate first tab by default
    if (tabs.length > 0) {
      ;(tabs[0] as HTMLElement).click()
    }

    // Emoji click events
    picker.addEventListener('click', e => {
      const target = e.target as HTMLElement
      const emojiButton = target.closest('.emoji-item') as HTMLElement

      if (emojiButton) {
        const emojiData = JSON.parse(emojiButton.dataset.emoji || '{}')
        this.insertEmoji(emojiData)
        picker.remove()
      }
    })

    // Search functionality
    const searchInput = picker.querySelector('.emoji-picker__search') as HTMLInputElement
    if (searchInput) {
      searchInput.addEventListener('input', e => {
        const query = (e.target as HTMLInputElement).value.toLowerCase()
        this.filterEmojis(picker, query)
      })
    }

    // Queue management events
    if (this.settings.enableFileUpload) {
      this.setupQueueEvents(picker)
    }

    // Mobile-specific events
    if (this.isMobile || this.settings.forceMobileMode) {
      this.setupMobileEvents(picker)
    }
  }

  private setupQueueEvents(picker: HTMLElement): void {
    // Clear queue buttons
    picker.querySelectorAll('.clear-queue-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        const state = (e.target as HTMLElement).dataset.state as UploadState
        this.clearQueue(state)
        this.updateQueueDisplay(picker)
      })
    })

    // Retry all button
    const retryAllBtn = picker.querySelector('.retry-all-btn')
    retryAllBtn?.addEventListener('click', () => {
      this.retryAllFailed()
      this.updateQueueDisplay(picker)
    })
  }

  private setupMobileEvents(picker: HTMLElement): void {
    // Handle touch events for better mobile experience
    let startY = 0
    let currentY = 0

    picker.addEventListener('touchstart', e => {
      startY = e.touches[0].clientY
    })

    picker.addEventListener('touchmove', e => {
      currentY = e.touches[0].clientY
      const diff = startY - currentY

      // Prevent scrolling the page when scrolling within picker
      if (Math.abs(diff) > 10) {
        e.preventDefault()
      }
    })
  }

  private filterEmojis(picker: HTMLElement, query: string): void {
    const groups = picker.querySelectorAll('.emoji-group')

    groups.forEach(group => {
      const items = group.querySelectorAll('.emoji-item')
      let visibleCount = 0

      items.forEach(item => {
        const emojiData = JSON.parse((item as HTMLElement).dataset.emoji || '{}')
        const name = emojiData.name?.toLowerCase() || ''
        const visible = name.includes(query)

        ;(item as HTMLElement).style.display = visible ? 'flex' : 'none'
        if (visible) visibleCount++
      })

      // Show/hide group based on visible items
      ;(group as HTMLElement).style.display = visibleCount > 0 ? 'grid' : 'none'
    })
  }

  private insertEmoji(emoji: any): void {
    const textarea = document.querySelector('textarea.d-editor-input') as HTMLTextAreaElement
    const proseMirror = document.querySelector('.ProseMirror.d-editor-input') as HTMLElement

    if (!textarea && !proseMirror) {
      console.error('找不到输入框')
      return
    }

    // Generate emoji content based on output format
    const content = this.generateEmojiContent(emoji)

    if (textarea) {
      this.insertIntoTextarea(textarea, content)
    } else if (proseMirror) {
      this.insertIntoProseMirror(proseMirror, content)
    }

    // Update usage statistics
    this.updateEmojiUsage(emoji.id)
  }

  private generateEmojiContent(emoji: any): string {
    const scale = this.settings.imageScale
    const width = emoji.width || 500
    const height = emoji.height || 500

    const scaledWidth = Math.round((width * scale) / 100)
    const scaledHeight = Math.round((height * scale) / 100)

    if (this.settings.outputFormat === 'html') {
      return `<img src="${emoji.url}" alt="${emoji.name}" width="${scaledWidth}" height="${scaledHeight}" loading="lazy">`
    } else {
      return `![${emoji.name}|${scaledWidth}x${scaledHeight}](${emoji.url})`
    }
  }

  private insertIntoTextarea(textarea: HTMLTextAreaElement, content: string): void {
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const text = textarea.value

    textarea.value = text.substring(0, start) + content + text.substring(end)
    textarea.selectionStart = textarea.selectionEnd = start + content.length

    // Trigger input event
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
    textarea.focus()
  }

  private insertIntoProseMirror(proseMirror: HTMLElement, content: string): void {
    try {
      // Create a temporary element to parse HTML
      const temp = document.createElement('div')
      temp.innerHTML = content

      // Try clipboard approach first
      const dataTransfer = new DataTransfer()
      dataTransfer.setData('text/html', content)
      const pasteEvent = new ClipboardEvent('paste', {
        clipboardData: dataTransfer,
        bubbles: true
      })

      proseMirror.dispatchEvent(pasteEvent)
    } catch (error) {
      console.error('Failed to insert into ProseMirror:', error)

      // Fallback: try to insert as plain text
      try {
        const textContent =
          this.settings.outputFormat === 'html' ? content : `![${emoji.name}](${emoji.url})`

        document.execCommand('insertText', false, textContent)
      } catch (fallbackError) {
        console.error('Fallback insertion also failed:', fallbackError)
      }
    }
  }

  private updateEmojiUsage(emojiId: string): void {
    const now = Date.now()

    for (const group of this.emojiGroups) {
      const emoji = group.emojis.find(e => e.id === emojiId)
      if (emoji) {
        emoji.lastUsed = now
        emoji.usageCount = (emoji.usageCount || 0) + 1
        break
      }
    }

    this.saveEmojiGroups()
  }

  // File upload functionality
  private openFileDialog(): void {
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = true
    input.accept = 'image/*'

    input.addEventListener('change', e => {
      const files = Array.from((e.target as HTMLInputElement).files || [])
      this.addFilesToUploadQueue(files)
    })

    input.click()
  }

  private addFilesToUploadQueue(files: File[]): void {
    const pendingQueue = this.uploadQueues.get(UploadState.PENDING) || []

    files.forEach(file => {
      if (file.type.startsWith('image/')) {
        const uploadItem: UploadItem = {
          id: `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          file,
          state: UploadState.PENDING,
          progress: 0,
          retryCount: 0,
          timestamp: Date.now()
        }

        pendingQueue.push(uploadItem)
      }
    })

    this.uploadQueues.set(UploadState.PENDING, pendingQueue)
    this.processUploadQueue()
    this.updateQueueDisplay()
  }

  private setupUploadProcessor(): void {
    // Process upload queue periodically
    setInterval(() => {
      this.processUploadQueue()
    }, 1000)
  }

  private async processUploadQueue(): Promise<void> {
    if (this.uploadWorkers >= this.maxWorkers) return

    const pendingQueue = this.uploadQueues.get(UploadState.PENDING) || []
    const retryQueue = this.uploadQueues.get(UploadState.RETRY) || []

    // Process pending items first, then retry items
    const nextItem =
      pendingQueue.shift() || (this.settings.autoRetryFailedUploads && retryQueue.shift())

    if (!nextItem) return

    this.uploadWorkers++

    try {
      await this.uploadFile(nextItem)
    } catch (error) {
      console.error('Upload failed:', error)
    } finally {
      this.uploadWorkers--
    }
  }

  private async uploadFile(item: UploadItem): Promise<void> {
    // Move to uploading queue
    item.state = UploadState.UPLOADING
    const uploadingQueue = this.uploadQueues.get(UploadState.UPLOADING) || []
    uploadingQueue.push(item)
    this.uploadQueues.set(UploadState.UPLOADING, uploadingQueue)

    this.updateQueueDisplay()

    try {
      // Simulate upload process (replace with actual upload logic)
      const uploadedUrl = await this.performUpload(item.file, progress => {
        item.progress = progress
        this.updateQueueDisplay()
      })

      // Move to success queue
      item.state = UploadState.SUCCESS
      item.uploadedUrl = uploadedUrl
      item.progress = 100

      const successQueue = this.uploadQueues.get(UploadState.SUCCESS) || []
      successQueue.push(item)
      this.uploadQueues.set(UploadState.SUCCESS, successQueue)

      // Remove from uploading queue
      this.removeFromQueue(UploadState.UPLOADING, item.id)

      // Add to emoji groups if successful
      this.addUploadedEmojiToGroups(item)
    } catch (error) {
      // Move to retry queue
      item.state = UploadState.RETRY
      item.error = error instanceof Error ? error.message : 'Upload failed'
      item.retryCount++

      const retryQueue = this.uploadQueues.get(UploadState.RETRY) || []
      retryQueue.push(item)
      this.uploadQueues.set(UploadState.RETRY, retryQueue)

      // Remove from uploading queue
      this.removeFromQueue(UploadState.UPLOADING, item.id)
    }

    this.updateQueueDisplay()
  }

  private async performUpload(file: File, onProgress: (progress: number) => void): Promise<string> {
    // This is a placeholder implementation
    // Replace with actual upload logic to your preferred image hosting service

    return new Promise((resolve, reject) => {
      // Simulate upload progress
      let progress = 0
      const interval = setInterval(() => {
        progress += Math.random() * 20
        onProgress(Math.min(progress, 90))

        if (progress >= 90) {
          clearInterval(interval)

          // Simulate final upload completion
          setTimeout(() => {
            onProgress(100)

            // For demo purposes, create a local blob URL
            // In a real implementation, this would be the uploaded URL
            const url = URL.createObjectURL(file)
            resolve(url)
          }, 500)
        }
      }, 200)

      // Simulate potential failure
      if (Math.random() < 0.1) {
        // 10% failure rate for demo
        setTimeout(() => {
          clearInterval(interval)
          reject(new Error('Upload service unavailable'))
        }, 2000)
      }
    })
  }

  private addUploadedEmojiToGroups(item: UploadItem): void {
    if (!item.uploadedUrl) return

    // Find or create "用户上传" group
    let uploadGroup = this.emojiGroups.find(g => g.id === 'user_uploads')
    if (!uploadGroup) {
      uploadGroup = {
        id: 'user_uploads',
        name: '用户上传',
        icon: '📁',
        order: 999,
        emojis: []
      }
      this.emojiGroups.push(uploadGroup)
    }

    // Add emoji to group
    const emoji = {
      id: `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: item.file.name.replace(/\.[^.]+$/, ''),
      url: item.uploadedUrl,
      groupId: uploadGroup.id,
      addedAt: Date.now(),
      usageCount: 0
    }

    uploadGroup.emojis.push(emoji)
    this.saveEmojiGroups()
  }

  private removeFromQueue(state: UploadState, itemId: string): void {
    const queue = this.uploadQueues.get(state) || []
    const filtered = queue.filter(item => item.id !== itemId)
    this.uploadQueues.set(state, filtered)
  }

  private clearQueue(state: UploadState): void {
    this.uploadQueues.set(state, [])
  }

  private retryAllFailed(): void {
    const retryQueue = this.uploadQueues.get(UploadState.RETRY) || []
    const pendingQueue = this.uploadQueues.get(UploadState.PENDING) || []

    // Move all retry items back to pending
    retryQueue.forEach(item => {
      item.state = UploadState.PENDING
      item.progress = 0
      item.error = undefined
      pendingQueue.push(item)
    })

    this.uploadQueues.set(UploadState.PENDING, pendingQueue)
    this.uploadQueues.set(UploadState.RETRY, [])
  }

  private updateQueueDisplay(picker?: HTMLElement): void {
    if (!picker) {
      picker = document.querySelector('.emoji-picker') as HTMLElement
    }

    if (!picker) return

    // Update queue counts and items
    Object.values(UploadState).forEach(state => {
      const queue = this.uploadQueues.get(state) || []
      const section = picker.querySelector(`[data-state="${state}"]`)

      if (section) {
        const countSpan = section.querySelector('.count')
        const itemsContainer = section.querySelector('.queue-items')

        if (countSpan) {
          countSpan.textContent = queue.length.toString()
        }

        if (itemsContainer) {
          itemsContainer.innerHTML = queue
            .map(
              item => `
            <div class="queue-item ${state}" title="${item.file.name}${item.error ? '\n' + item.error : ''}">
              ${item.file.name}
              ${item.state === UploadState.UPLOADING ? ` (${Math.round(item.progress)}%)` : ''}
            </div>
          `
            )
            .join('')
        }
      }
    })
  }

  // Public API methods
  public updateSettings(newSettings: Partial<UserscriptSettings>): void {
    this.settings = { ...this.settings, ...newSettings }
    this.saveSettings()
  }

  public getSettings(): UserscriptSettings {
    return { ...this.settings }
  }

  public addEmojiGroup(group: EmojiGroup): void {
    this.emojiGroups.push(group)
    this.saveEmojiGroups()
  }

  public removeEmojiGroup(groupId: string): void {
    this.emojiGroups = this.emojiGroups.filter(g => g.id !== groupId)
    this.saveEmojiGroups()
  }

  public exportData(): string {
    return JSON.stringify(
      {
        version: '2.0',
        exportDate: new Date().toISOString(),
        settings: this.settings,
        groups: this.emojiGroups
      },
      null,
      2
    )
  }

  public importData(dataJson: string): void {
    try {
      const data = JSON.parse(dataJson)

      if (data.settings) {
        this.settings = { ...this.settings, ...data.settings }
        this.saveSettings()
      }

      if (data.groups && Array.isArray(data.groups)) {
        this.emojiGroups = data.groups
        this.saveEmojiGroups()
      }
    } catch (error) {
      throw new Error(`Import failed: ${error}`)
    }
  }

  public resetToDefaults(): void {
    this.settings = this.loadSettings()
    this.emojiGroups = defaultConfig.groups as EmojiGroup[]
    this.saveSettings()
    this.saveEmojiGroups()
  }
}

// Global instance for userscript
export const userscriptManager = new EnhancedUserscriptManager()

// Auto-initialize on compatible pages
if (typeof window !== 'undefined') {
  // Check if current page should have emoji injection
  function shouldInjectEmoji(): boolean {
    // Check for discourse meta tags
    const discourseMetaTags = document.querySelectorAll(
      'meta[name*="discourse"], meta[content*="discourse"], meta[property*="discourse"]'
    )
    if (discourseMetaTags.length > 0) return true

    // Check for common forum/discussion platforms
    const generatorMeta = document.querySelector('meta[name="generator"]')
    if (generatorMeta) {
      const content = generatorMeta.getAttribute('content')?.toLowerCase() || ''
      if (
        content.includes('discourse') ||
        content.includes('flarum') ||
        content.includes('phpbb')
      ) {
        return true
      }
    }

    // Check current domain
    const hostname = window.location.hostname.toLowerCase()
    const allowedDomains = ['linux.do', 'meta.discourse.org']
    if (allowedDomains.some(domain => hostname.includes(domain))) return true

    // Check for editor elements
    const editors = document.querySelectorAll(
      'textarea.d-editor-input, .ProseMirror.d-editor-input, .composer-input, .reply-area textarea'
    )
    return editors.length > 0
  }

  // Initialize userscript functionality
  if (shouldInjectEmoji()) {
    console.log('[Enhanced Userscript] Compatible platform detected, initializing...')

    // Add emoji button to toolbar when available
    function addEmojiButton(): void {
      const toolbar = document.querySelector(
        '.d-editor-button-bar, .composer-toolbar, .reply-toolbar'
      )
      if (toolbar && !toolbar.querySelector('.emoji-extension-btn')) {
        const button = document.createElement('button')
        button.className = 'emoji-extension-btn btn btn-icon no-text'
        button.innerHTML = '😀'
        button.title = '表情选择器 (增强版)'
        button.style.cssText = 'margin-left: 8px; font-size: 16px;'

        button.addEventListener('click', e => {
          e.preventDefault()
          const picker = userscriptManager.createEmojiPicker()
          document.body.appendChild(picker)

          // Position picker near button
          const rect = button.getBoundingClientRect()
          const pickerEl = picker as HTMLElement
          pickerEl.style.top = rect.bottom + 8 + 'px'
          pickerEl.style.left = rect.left + 'px'
        })

        toolbar.appendChild(button)
      }
    }

    // Try to add button immediately and on DOM changes
    addEmojiButton()

    const observer = new MutationObserver(() => {
      addEmojiButton()
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true
    })
  }
}
