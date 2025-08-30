// 数据同步管理器
import type { EmojiGroup, Emoji } from './communication'
import {
  BatchUpdateManager,
  type UpdateOperation,
  type BatchProcessResult,
} from './BatchUpdateManager'

// Chrome Storage API 声明
declare const chrome: {
  storage?: {
    local?: {
      get?(keys: string[] | string | null, callback: (items: any) => void): void
      set?(items: Record<string, any>, callback?: () => void): void
      onChanged?: {
        addListener?(callback: (changes: any, areaName: string) => void): void
      }
    }
  }
  runtime?: {
    lastError?: any
  }
}

// 存储变化事件接口
export interface StorageChange {
  key: string
  oldValue?: any
  newValue?: any
  timestamp: number
}

// 通知队列项接口
export interface NotificationItem {
  type: 'common-emoji' | 'emoji-order' | 'group-icon' | 'ungrouped-emojis'
  data: any
  timestamp: number
  priority: 'high' | 'normal' | 'low'
}

// 数据同步管理器类
export class DataSyncManager {
  private isWatching = false
  private notificationQueue: NotificationItem[] = []
  private processingQueue = false
  private storageChangeListeners: Array<(change: StorageChange) => void> = []
  private debounceTimer: any = null
  private readonly DEBOUNCE_DELAY = 100 // 100ms 防抖延迟
  private batchUpdateManager: BatchUpdateManager

  constructor() {
    this.batchUpdateManager = new BatchUpdateManager({
      immediate: 0,
      high: 50,
      normal: 200,
      low: 1000,
      maxBatchSize: 15,
    })
    this.init()
    this.setupBatchHandlers()
  }

  private init() {
    console.log('[DataSyncManager] Initializing data sync manager')
    this.setupStorageWatcher()
  }

  /**
   * 设置批量处理器的处理函数
   */
  private setupBatchHandlers() {
    // 注册常用表情更新处理器
    this.batchUpdateManager.registerHandler('common-emoji', async (operation) => {
      try {
        console.log('[DataSyncManager] Processing common emoji batch update')
        await this.handleCommonEmojiUpdate(operation.data)
        return true
      } catch (error) {
        console.error('[DataSyncManager] Common emoji batch update failed:', error)
        return false
      }
    })

    // 注册表情排序更新处理器
    this.batchUpdateManager.registerHandler('emoji-order', async (operation) => {
      try {
        console.log('[DataSyncManager] Processing emoji order batch update')
        await this.handleEmojiOrderUpdate(operation.data)
        return true
      } catch (error) {
        console.error('[DataSyncManager] Emoji order batch update failed:', error)
        return false
      }
    })

    // 注册分组图标更新处理器
    this.batchUpdateManager.registerHandler('group-icon', async (operation) => {
      try {
        console.log('[DataSyncManager] Processing group icon batch update')
        await this.handleGroupIconUpdate(operation.data)
        return true
      } catch (error) {
        console.error('[DataSyncManager] Group icon batch update failed:', error)
        return false
      }
    })

    // 注册未分组表情更新处理器
    this.batchUpdateManager.registerHandler('ungrouped-emojis', async (operation) => {
      try {
        console.log('[DataSyncManager] Processing ungrouped emojis batch update')
        await this.handleUngroupedEmojisUpdate(operation.data)
        return true
      } catch (error) {
        console.error('[DataSyncManager] Ungrouped emojis batch update failed:', error)
        return false
      }
    })

    // 注册缓存失效处理器
    this.batchUpdateManager.registerHandler('cache-invalidation', async (operation) => {
      try {
        console.log('[DataSyncManager] Processing cache invalidation')
        await this.handleCacheInvalidation(operation.data)
        return true
      } catch (error) {
        console.error('[DataSyncManager] Cache invalidation failed:', error)
        return false
      }
    })
  }

  /**
   * 设置存储监听器
   */
  private setupStorageWatcher() {
    try {
      if (
        typeof chrome !== 'undefined' &&
        chrome.storage &&
        chrome.storage.local &&
        chrome.storage.local.onChanged
      ) {
        chrome.storage.local.onChanged.addListener?.((changes: any, areaName: string) => {
          if (areaName === 'local') {
            this.handleStorageChanges(changes)
          }
        })
        console.log('[DataSyncManager] Chrome storage watcher set up successfully')
      } else {
        console.warn('[DataSyncManager] Chrome storage API not available')
      }
    } catch (error) {
      console.error('[DataSyncManager] Failed to set up storage watcher:', error)
    }
  }

  /**
   * 处理存储变化
   */
  private handleStorageChanges(changes: any) {
    console.log('[DataSyncManager] Storage changes detected:', changes)

    for (const key in changes) {
      const change = changes[key]
      const storageChange: StorageChange = {
        key,
        oldValue: change.oldValue,
        newValue: change.newValue,
        timestamp: Date.now(),
      }

      // 通知所有监听器
      this.storageChangeListeners.forEach((listener) => {
        try {
          listener(storageChange)
        } catch (error) {
          console.error('[DataSyncManager] Error in storage change listener:', error)
        }
      })

      // 根据键名类型添加到通知队列
      this.queueNotificationFromStorageChange(storageChange)
    }
  }

  /**
   * 根据存储变化添加通知到队列
   */
  private queueNotificationFromStorageChange(change: StorageChange) {
    let notificationItem: NotificationItem | null = null

    if (change.key === 'emojiGroups-common') {
      notificationItem = {
        type: 'common-emoji',
        data: change.newValue,
        timestamp: change.timestamp,
        priority: 'high',
      }
    } else if (change.key.startsWith('emojiGroups-') && change.key !== 'emojiGroups-index') {
      notificationItem = {
        type: 'group-icon',
        data: {
          groupUUID: change.key.replace('emojiGroups-', ''),
          group: change.newValue,
        },
        timestamp: change.timestamp,
        priority: 'normal',
      }
    } else if (change.key === 'ungrouped-emojis') {
      notificationItem = {
        type: 'ungrouped-emojis',
        data: change.newValue,
        timestamp: change.timestamp,
        priority: 'normal',
      }
    } else if (change.key === 'emoji-order-cache') {
      notificationItem = {
        type: 'emoji-order',
        data: change.newValue,
        timestamp: change.timestamp,
        priority: 'normal',
      }
    }

    if (notificationItem) {
      this.queueNotification(notificationItem)
    }
  }

  /**
   * 添加通知到队列
   */
  private queueNotification(item: NotificationItem) {
    // 按优先级插入队列
    const insertIndex = this.notificationQueue.findIndex(
      (queueItem) =>
        this.getPriorityValue(queueItem.priority) > this.getPriorityValue(item.priority),
    )

    if (insertIndex === -1) {
      this.notificationQueue.push(item)
    } else {
      this.notificationQueue.splice(insertIndex, 0, item)
    }

    console.log(
      `[DataSyncManager] Queued ${item.type} notification, queue length: ${this.notificationQueue.length}`,
    )

    // 防抖处理队列
    this.debouncedProcessQueue()
  }

  /**
   * 获取优先级数值（数值越小优先级越高）
   */
  private getPriorityValue(priority: NotificationItem['priority']): number {
    switch (priority) {
      case 'high':
        return 1
      case 'normal':
        return 2
      case 'low':
        return 3
      default:
        return 2
    }
  }

  /**
   * 防抖处理队列
   */
  private debouncedProcessQueue() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
    }

    this.debounceTimer = setTimeout(() => {
      this.processPendingNotifications()
    }, this.DEBOUNCE_DELAY)
  }

  /**
   * 开始监控存储变化
   */
  watchStorageChanges(): void {
    if (this.isWatching) {
      console.log('[DataSyncManager] Already watching storage changes')
      return
    }

    this.isWatching = true
    console.log('[DataSyncManager] Started watching storage changes')
  }

  /**
   * 停止监控存储变化
   */
  stopWatchingStorageChanges(): void {
    this.isWatching = false
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
    console.log('[DataSyncManager] Stopped watching storage changes')
  }

  /**
   * 同步 localStorage 和 Chrome Storage
   */
  async syncStorages(): Promise<void> {
    console.log('[DataSyncManager] Starting storage synchronization')

    try {
      // 从 Chrome Storage 读取数据
      const chromeData = await this.getChromeStorageData()

      // 从 localStorage 读取数据
      const localData = this.getLocalStorageData()

      // 比较并同步数据
      const syncResult = this.compareAndSync(chromeData, localData)

      console.log('[DataSyncManager] Storage synchronization completed:', syncResult)
    } catch (error) {
      console.error('[DataSyncManager] Storage synchronization failed:', error)
      throw error
    }
  }

  /**
   * 从 Chrome Storage 获取数据
   */
  private getChromeStorageData(): Promise<any> {
    return new Promise((resolve, reject) => {
      try {
        if (chrome.storage && chrome.storage.local && chrome.storage.local.get) {
          chrome.storage.local.get(null, (items) => {
            if (chrome.runtime && chrome.runtime.lastError) {
              reject(chrome.runtime.lastError)
            } else {
              resolve(items)
            }
          })
        } else {
          resolve({})
        }
      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * 从 localStorage 获取数据
   */
  private getLocalStorageData(): any {
    const data: any = {}

    try {
      // 获取所有相关的 localStorage 键
      const keys = ['emojiGroups-common', 'ungrouped-emojis', 'emoji-order-cache']

      for (const key of keys) {
        const value = localStorage.getItem(key)
        if (value) {
          try {
            data[key] = JSON.parse(value)
          } catch (parseError) {
            console.warn(`[DataSyncManager] Failed to parse localStorage item ${key}:`, parseError)
          }
        }
      }
    } catch (error) {
      console.error('[DataSyncManager] Failed to read localStorage:', error)
    }

    return data
  }

  /**
   * 比较并同步数据
   */
  private compareAndSync(
    chromeData: any,
    localData: any,
  ): { synced: boolean; conflicts: string[] } {
    const conflicts: string[] = []
    let synced = false

    try {
      // 比较常用表情组
      if (chromeData['emojiGroups-common'] && localData['emojiGroups-common']) {
        const chromeTimestamp = chromeData['emojiGroups-common'].lastUpdated || 0
        const localTimestamp = localData['emojiGroups-common'].lastUpdated || 0

        if (chromeTimestamp !== localTimestamp) {
          conflicts.push('emojiGroups-common')
          // 使用时间戳较新的数据
          if (chromeTimestamp > localTimestamp) {
            this.updateLocalStorage('emojiGroups-common', chromeData['emojiGroups-common'])
          } else {
            this.updateChromeStorage('emojiGroups-common', localData['emojiGroups-common'])
          }
          synced = true
        }
      }

      // 比较未分组表情
      if (chromeData['ungrouped-emojis'] && localData['ungrouped-emojis']) {
        const chromeLength = chromeData['ungrouped-emojis'].length || 0
        const localLength = localData['ungrouped-emojis'].length || 0

        if (chromeLength !== localLength) {
          conflicts.push('ungrouped-emojis')
          // 使用数量较多的数据（假设是更新的）
          if (chromeLength > localLength) {
            this.updateLocalStorage('ungrouped-emojis', chromeData['ungrouped-emojis'])
          } else {
            this.updateChromeStorage('ungrouped-emojis', localData['ungrouped-emojis'])
          }
          synced = true
        }
      }
    } catch (error) {
      console.error('[DataSyncManager] Error during data comparison:', error)
    }

    return { synced, conflicts }
  }

  /**
   * 更新 localStorage
   */
  private updateLocalStorage(key: string, value: any): void {
    try {
      localStorage.setItem(key, JSON.stringify(value))
      console.log(`[DataSyncManager] Updated localStorage key: ${key}`)
    } catch (error) {
      console.error(`[DataSyncManager] Failed to update localStorage key ${key}:`, error)
    }
  }

  /**
   * 更新 Chrome Storage
   */
  private updateChromeStorage(key: string, value: any): void {
    try {
      if (chrome.storage && chrome.storage.local && chrome.storage.local.set) {
        chrome.storage.local.set({ [key]: value }, () => {
          if (chrome.runtime && chrome.runtime.lastError) {
            console.error(
              `[DataSyncManager] Failed to update Chrome storage key ${key}:`,
              chrome.runtime.lastError,
            )
          } else {
            console.log(`[DataSyncManager] Updated Chrome storage key: ${key}`)
          }
        })
      }
    } catch (error) {
      console.error(`[DataSyncManager] Failed to update Chrome storage key ${key}:`, error)
    }
  }

  /**
   * 批量处理待处理的通知
   */
  processPendingNotifications(): void {
    if (this.processingQueue || this.notificationQueue.length === 0) {
      return
    }

    this.processingQueue = true
    console.log(
      `[DataSyncManager] Processing ${this.notificationQueue.length} pending notifications`,
    )

    try {
      // 按优先级处理通知
      const processedItems: NotificationItem[] = []

      while (this.notificationQueue.length > 0) {
        const item = this.notificationQueue.shift()!
        this.processNotification(item)
        processedItems.push(item)
      }

      console.log(`[DataSyncManager] Processed ${processedItems.length} notifications`)
    } catch (error) {
      console.error('[DataSyncManager] Error processing notifications:', error)
    } finally {
      this.processingQueue = false
    }
  }

  /**
   * 处理单个通知
   */
  private processNotification(item: NotificationItem): void {
    console.log(`[DataSyncManager] Processing ${item.type} notification`)

    try {
      // 这里可以添加具体的通知处理逻辑
      // 例如发送消息到其他组件、更新UI等

      // 触发自定义事件
      if (typeof window !== 'undefined') {
        const event = new CustomEvent('data-sync-notification', {
          detail: {
            type: item.type,
            data: item.data,
            timestamp: item.timestamp,
            priority: item.priority,
          },
        })
        window.dispatchEvent(event)
      }
    } catch (error) {
      console.error(`[DataSyncManager] Error processing ${item.type} notification:`, error)
    }
  }

  /**
   * 添加存储变化监听器
   */
  addStorageChangeListener(listener: (change: StorageChange) => void): void {
    this.storageChangeListeners.push(listener)
    console.log(
      `[DataSyncManager] Added storage change listener, total: ${this.storageChangeListeners.length}`,
    )
  }

  /**
   * 移除存储变化监听器
   */
  removeStorageChangeListener(listener: (change: StorageChange) => void): void {
    const index = this.storageChangeListeners.indexOf(listener)
    if (index > -1) {
      this.storageChangeListeners.splice(index, 1)
      console.log(
        `[DataSyncManager] Removed storage change listener, total: ${this.storageChangeListeners.length}`,
      )
    }
  }

  /**
   * 获取队列状态
   */
  getQueueStatus(): { length: number; processing: boolean; watching: boolean } {
    return {
      length: this.notificationQueue.length,
      processing: this.processingQueue,
      watching: this.isWatching,
    }
  }

  /**
   * 清空通知队列
   */
  clearQueue(): void {
    this.notificationQueue = []
    console.log('[DataSyncManager] Notification queue cleared')
  }

  /**
   * 批量处理更新操作
   */
  async processBatchUpdates(): Promise<BatchProcessResult> {
    return await this.batchUpdateManager.processBatch()
  }

  /**
   * 添加批量更新操作
   */
  queueBatchUpdate(
    type: 'common-emoji' | 'emoji-order' | 'group-icon' | 'ungrouped-emojis' | 'cache-invalidation',
    data: any,
    priority: 'immediate' | 'high' | 'normal' | 'low' = 'normal',
    maxRetries: number = 3,
  ): string {
    return this.batchUpdateManager.queueUpdate({
      type,
      priority,
      data,
      maxRetries,
    })
  }

  /**
   * 立即处理高优先级更新
   */
  async processImmediateUpdate(
    type: 'common-emoji' | 'emoji-order' | 'group-icon' | 'ungrouped-emojis' | 'cache-invalidation',
    data: any,
  ): Promise<boolean> {
    return await this.batchUpdateManager.processImmediate({
      type,
      priority: 'immediate',
      data,
      maxRetries: 1,
    })
  }

  /**
   * 获取批量处理队列状态
   */
  getBatchQueueStatus() {
    return this.batchUpdateManager.getQueueStatus()
  }

  // 批量处理的具体实现方法

  /**
   * 处理常用表情更新
   */
  private async handleCommonEmojiUpdate(data: any): Promise<void> {
    try {
      // 更新存储
      this.updateChromeStorage('emojiGroups-common', data)
      this.updateLocalStorage('emojiGroups-common', data)

      // 发送通知事件
      if (typeof window !== 'undefined') {
        const event = new CustomEvent('common-emoji-batch-updated', {
          detail: { data, timestamp: Date.now() },
        })
        window.dispatchEvent(event)
      }

      console.log('[DataSyncManager] Common emoji batch update completed')
    } catch (error) {
      console.error('[DataSyncManager] Common emoji batch update error:', error)
      throw error
    }
  }

  /**
   * 处理表情排序更新
   */
  private async handleEmojiOrderUpdate(data: any): Promise<void> {
    try {
      const { groupUUID, order } = data

      // 更新排序缓存
      const orderCache = {
        [groupUUID]: {
          order,
          lastUpdated: Date.now(),
        },
      }

      this.updateChromeStorage('emoji-order-cache', orderCache)
      this.updateLocalStorage('emoji-order-cache', orderCache)

      // 发送通知事件
      if (typeof window !== 'undefined') {
        const event = new CustomEvent('emoji-order-batch-updated', {
          detail: { groupUUID, order, timestamp: Date.now() },
        })
        window.dispatchEvent(event)
      }

      console.log('[DataSyncManager] Emoji order batch update completed')
    } catch (error) {
      console.error('[DataSyncManager] Emoji order batch update error:', error)
      throw error
    }
  }

  /**
   * 处理分组图标更新
   */
  private async handleGroupIconUpdate(data: any): Promise<void> {
    try {
      const { groupUUID, iconUrl, group } = data

      // 更新分组数据
      if (group) {
        this.updateChromeStorage(`emojiGroups-${groupUUID}`, group)
        this.updateLocalStorage(`emojiGroups-${groupUUID}`, group)
      }

      // 发送通知事件
      if (typeof window !== 'undefined') {
        const event = new CustomEvent('group-icon-batch-updated', {
          detail: { groupUUID, iconUrl, timestamp: Date.now() },
        })
        window.dispatchEvent(event)
      }

      console.log('[DataSyncManager] Group icon batch update completed')
    } catch (error) {
      console.error('[DataSyncManager] Group icon batch update error:', error)
      throw error
    }
  }

  /**
   * 处理未分组表情更新
   */
  private async handleUngroupedEmojisUpdate(data: any): Promise<void> {
    try {
      // 更新未分组表情
      this.updateChromeStorage('ungrouped-emojis', data)
      this.updateLocalStorage('ungrouped-emojis', data)

      // 发送通知事件
      if (typeof window !== 'undefined') {
        const event = new CustomEvent('ungrouped-emojis-batch-updated', {
          detail: { data, timestamp: Date.now() },
        })
        window.dispatchEvent(event)
      }

      console.log('[DataSyncManager] Ungrouped emojis batch update completed')
    } catch (error) {
      console.error('[DataSyncManager] Ungrouped emojis batch update error:', error)
      throw error
    }
  }

  /**
   * 处理缓存失效
   */
  private async handleCacheInvalidation(data: any): Promise<void> {
    try {
      const { keys } = data

      // 清除指定的缓存键
      if (Array.isArray(keys)) {
        for (const key of keys) {
          // 这里可以添加具体的缓存清除逻辑
          console.log(`[DataSyncManager] Invalidating cache for key: ${key}`)
        }
      }

      // 发送通知事件
      if (typeof window !== 'undefined') {
        const event = new CustomEvent('cache-invalidated', {
          detail: { keys, timestamp: Date.now() },
        })
        window.dispatchEvent(event)
      }

      console.log('[DataSyncManager] Cache invalidation completed')
    } catch (error) {
      console.error('[DataSyncManager] Cache invalidation error:', error)
      throw error
    }
  }

  /**
   * 销毁管理器
   */
  destroy(): void {
    this.stopWatchingStorageChanges()
    this.clearQueue()
    this.batchUpdateManager.destroy()
    this.storageChangeListeners = []
    console.log('[DataSyncManager] Data sync manager destroyed')
  }
}

export default DataSyncManager
