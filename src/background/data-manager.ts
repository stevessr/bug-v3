// background/data-manager.ts - 全局数据状态管理器
// 统一管理所有表情数据，确保跨组件的数据一致性

import { loadFromChromeStorage, ensureCommonEmojiGroupInStorage } from './utils/storage-utils'

declare const chrome: any

export interface EmojiDataState {
  emojiGroups: any[]
  ungroupedEmojis: any[]
  settings: any
  isLoaded: boolean
  lastUpdate: number
}

class BackgroundDataManager {
  private state: EmojiDataState = {
    emojiGroups: [],
    ungroupedEmojis: [],
    settings: {},
    isLoaded: false,
    lastUpdate: 0
  }

  private stores: {
    emojiGroupsStore: any
    settingsStore: any
  } = {
    emojiGroupsStore: null,
    settingsStore: null
  }

  private initPromise: Promise<void> | null = null
  private updateListeners: Set<() => void> = new Set()
  private storageChangeListener: ((changes: any, namespace: string) => void) | null = null

  constructor() {
    this.log('DataManager initialized')
    this.setupStorageListener()
  }

  private log(...args: any[]) {
    console.log('[BackgroundDataManager]', ...args)
  }

  /**
   * 设置存储变化监听器
   */
  private setupStorageListener(): void {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
        this.storageChangeListener = (changes: any, namespace: string) => {
          if (namespace === 'local') {
            this.handleStorageChanges(changes)
          }
        }
        chrome.storage.onChanged.addListener(this.storageChangeListener)
        this.log('✅ Storage change listener set up')
      }
    } catch (error) {
      this.log('⚠️ Failed to set up storage listener:', error)
    }
  }

  /**
   * 处理存储变化
   */
  private async handleStorageChanges(changes: any): Promise<void> {
    this.log('📡 Storage changes detected:', Object.keys(changes))
    
    const relevantKeys = [
      'Settings',
      'ungrouped',
      'emojiGroups-index',
      'emojiGroups-common'
    ]
    
    // 检查是否有相关的表情组变化
    const hasGroupChanges = Object.keys(changes).some(key => 
      relevantKeys.includes(key) || key.startsWith('emojiGroups-')
    )
    
    if (hasGroupChanges) {
      this.log('🔄 Relevant storage changes detected, reloading data')
      try {
        await this.reloadData()
        this.log('✅ Data reloaded successfully after storage change')
      } catch (error) {
        this.log('❌ Failed to reload data after storage change:', error)
      }
    }
  }

  /**
   * 初始化数据管理器
   */
  async initialize(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise
    }

    this.initPromise = this._performInitialization()
    return this.initPromise
  }

  private async _performInitialization(): Promise<void> {
    try {
      this.log('🚀 Starting data initialization...')

      // 首先确保常用表情组在存储中存在
      await ensureCommonEmojiGroupInStorage()
      this.log('✅ Common emoji group ensured in storage')

      // 尝试导入stores
      try {
        const [emojiModule, settingsModule] = await Promise.all([
          import('../data/update/emojiGroupsStore'),
          import('../data/update/settingsStore'),
        ])

        this.stores.emojiGroupsStore = emojiModule.default
        this.stores.settingsStore = settingsModule.default
        this.log('✅ Stores imported successfully')

        // 等待存储初始化完成
        await new Promise(resolve => setTimeout(resolve, 1000))
      } catch (storeError) {
        this.log('⚠️ Failed to import stores:', storeError)
      }

      // 从多个来源加载数据
      await this.loadData()

      this.log('✅ Data initialization completed')
    } catch (error) {
      this.log('❌ Data initialization failed:', error)
      // 即使初始化失败，也标记为已加载，使用空数据
      this.state.isLoaded = true
      this.state.lastUpdate = Date.now()
    }
  }

  /**
   * 从存储加载数据
   */
  async loadData(): Promise<void> {
    this.log('🔄 Loading data from storage...')

    try {
      // 方法1：尝试从emojiGroupsStore获取数据
      if (this.stores.emojiGroupsStore && this.stores.settingsStore) {
        try {
          const groups = this.stores.emojiGroupsStore.getEmojiGroups() || []
          const settings = this.stores.settingsStore.getSettings() || {}
          const ungrouped = this.stores.emojiGroupsStore.getUngrouped() || []

          if (groups.length > 0) {
            this.state.emojiGroups = groups
            this.state.settings = settings
            this.state.ungroupedEmojis = ungrouped
            this.state.isLoaded = true
            this.state.lastUpdate = Date.now()

            this.log('✅ Data loaded from stores:', {
              groupsCount: groups.length,
              emojisCount: groups.reduce((sum: number, g: any) => sum + (g.emojis?.length || 0), 0),
              ungroupedCount: ungrouped.length
            })

            this.notifyListeners()
            return
          }
        } catch (storeError) {
          this.log('⚠️ Failed to get data from stores:', storeError)
        }
      }

      // 方法2：直接从chrome.storage加载
      try {
        const storagePayload = await loadFromChromeStorage()
        if (storagePayload && storagePayload.emojiGroups && storagePayload.emojiGroups.length > 0) {
          this.state.emojiGroups = storagePayload.emojiGroups
          this.state.settings = storagePayload.Settings || {}
          this.state.ungroupedEmojis = storagePayload.ungrouped || []
          this.state.isLoaded = true
          this.state.lastUpdate = Date.now()

          this.log('✅ Data loaded from chrome storage:', {
            groupsCount: storagePayload.emojiGroups.length,
            emojisCount: storagePayload.emojiGroups.reduce(
              (sum: number, g: any) => sum + (g.emojis?.length || 0),
              0
            ),
            ungroupedCount: storagePayload.ungrouped?.length || 0
          })

          this.notifyListeners()
          return
        }
      } catch (storageError) {
        this.log('⚠️ Failed to load from chrome storage:', storageError)
      }

      // 方法3：使用默认空数据
      this.log('⚠️ No data found, using empty state')
      this.state.emojiGroups = []
      this.state.ungroupedEmojis = []
      this.state.settings = {}
      this.state.isLoaded = true
      this.state.lastUpdate = Date.now()

      this.notifyListeners()
    } catch (error) {
      this.log('❌ Failed to load data:', error)
      throw error
    }
  }

  /**
   * 强制重新加载数据
   */
  async reloadData(): Promise<void> {
    this.log('🔄 Force reloading data...')
    this.state.isLoaded = false
    await this.loadData()
  }

  /**
   * 获取当前数据状态
   */
  getState(): Readonly<EmojiDataState> {
    return { ...this.state }
  }

  /**
   * 获取表情数据（兼容现有API）
   */
  getData() {
    return {
      emojiGroups: [...this.state.emojiGroups],
      ungroupedEmojis: [...this.state.ungroupedEmojis],
      settings: { ...this.state.settings }
    }
  }

  /**
   * 检查数据是否已加载
   */
  isDataLoaded(): boolean {
    return this.state.isLoaded
  }

  /**
   * 等待数据加载完成
   */
  async waitForData(): Promise<void> {
    if (this.state.isLoaded) {
      return
    }

    if (this.initPromise) {
      await this.initPromise
      return
    }

    // 如果还没有开始初始化，立即开始
    await this.initialize()
  }

  /**
   * 更新数据状态
   */
  updateState(updates: Partial<EmojiDataState>): void {
    const oldState = { ...this.state }
    
    Object.assign(this.state, updates)
    this.state.lastUpdate = Date.now()

    this.log('📝 State updated:', {
      groupsChanged: oldState.emojiGroups.length !== this.state.emojiGroups.length,
      ungroupedChanged: oldState.ungroupedEmojis.length !== this.state.ungroupedEmojis.length,
      settingsChanged: JSON.stringify(oldState.settings) !== JSON.stringify(this.state.settings)
    })

    this.notifyListeners()
  }

  /**
   * 添加数据更新监听器
   */
  addUpdateListener(listener: () => void): void {
    this.updateListeners.add(listener)
  }

  /**
   * 移除数据更新监听器
   */
  removeUpdateListener(listener: () => void): void {
    this.updateListeners.delete(listener)
  }

  /**
   * 通知所有监听器
   */
  private notifyListeners(): void {
    this.updateListeners.forEach(listener => {
      try {
        listener()
      } catch (error) {
        this.log('❌ Error in update listener:', error)
      }
    })
  }

  /**
   * 处理来自options页面的payload更新
   */
  async handlePayloadUpdate(payload: any): Promise<void> {
    this.log('📥 Handling payload update from options page')
    
    try {
      if (payload && typeof payload === 'object') {
        const updates: Partial<EmojiDataState> = {}
        
        if (Array.isArray(payload.emojiGroups)) {
          updates.emojiGroups = payload.emojiGroups
        }
        
        if (Array.isArray(payload.ungrouped)) {
          updates.ungroupedEmojis = payload.ungrouped
        }
        
        if (payload.Settings && typeof payload.Settings === 'object') {
          updates.settings = payload.Settings
        }

        this.updateState(updates)
        this.log('✅ Payload update processed successfully')
      }
    } catch (error) {
      this.log('❌ Failed to handle payload update:', error)
    }
  }

  /**
   * 记录表情使用
   */
  async recordEmojiUsage(emojiUUID: string): Promise<boolean> {
    this.log('📊 Recording emoji usage:', emojiUUID)

    try {
      if (this.stores.emojiGroupsStore) {
        const success = this.stores.emojiGroupsStore.recordUsageByUUID(emojiUUID)
        if (success) {
          // 重新加载数据以反映使用统计的变化
          await this.reloadData()
          this.log('✅ Emoji usage recorded and data reloaded')
          return true
        }
      }
      
      this.log('⚠️ Failed to record emoji usage - store not available')
      return false
    } catch (error) {
      this.log('❌ Error recording emoji usage:', error)
      return false
    }
  }

  /**
   * 添加表情到未分组
   */
  async addEmojiToUngrouped(emoji: any): Promise<boolean> {
    this.log('➕ Adding emoji to ungrouped:', emoji.displayName || emoji.UUID)

    try {
      if (this.stores.emojiGroupsStore) {
        this.stores.emojiGroupsStore.addUngrouped(emoji)
        
        // 立即更新本地状态
        this.state.ungroupedEmojis = [...this.state.ungroupedEmojis, emoji]
        this.state.lastUpdate = Date.now()
        this.notifyListeners()
        
        this.log('✅ Emoji added to ungrouped successfully')
        return true
      }
      
      this.log('⚠️ Failed to add emoji - store not available')
      return false
    } catch (error) {
      this.log('❌ Error adding emoji to ungrouped:', error)
      return false
    }
  }

  /**
   * 获取统计信息
   */
  getStats() {
    const totalEmojis = this.state.emojiGroups.reduce(
      (sum, group) => sum + (group.emojis?.length || 0),
      0
    )

    return {
      groupsCount: this.state.emojiGroups.length,
      emojisCount: totalEmojis,
      ungroupedCount: this.state.ungroupedEmojis.length,
      isLoaded: this.state.isLoaded,
      lastUpdate: this.state.lastUpdate,
      dataAge: this.state.lastUpdate ? Date.now() - this.state.lastUpdate : Infinity
    }
  }

  /**
   * 清理资源
   */
  destroy(): void {
    try {
      if (this.storageChangeListener && chrome?.storage?.onChanged) {
        chrome.storage.onChanged.removeListener(this.storageChangeListener)
        this.storageChangeListener = null
        this.log('✅ Storage change listener removed')
      }
      
      this.updateListeners.clear()
      this.log('✅ Data manager destroyed')
    } catch (error) {
      this.log('⚠️ Error during cleanup:', error)
    }
  }
}

// 创建全局实例
const globalDataManager = new BackgroundDataManager()

export default globalDataManager
export { BackgroundDataManager }