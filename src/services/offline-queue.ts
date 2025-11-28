/**
 * 离线队列管理器
 * 管理离线时的变更队列，网络恢复时自动同步
 */

import { syncDb } from '@/utils/sync-db'
import { nanoid } from 'nanoid'
import type { DeltaRecord, QueueItem } from '@/types/sync'

export class OfflineQueue {
  private queue: QueueItem[] = []
  private isOnline = navigator.onLine
  private syncInProgress = false
  private eventListenersAdded = false

  constructor() {
    this.setupNetworkListeners()
    this.loadQueue()
  }

  /** 设置网络状态监听 */
  private setupNetworkListeners() {
    if (this.eventListenersAdded) return

    window.addEventListener('online', () => {
      console.log('[OfflineQueue] Network online, starting sync')
      this.isOnline = true
      this.processPendingQueue()
    })

    window.addEventListener('offline', () => {
      console.log('[OfflineQueue] Network offline')
      this.isOnline = false
    })

    this.eventListenersAdded = true
  }

  /** 从数据库加载队列 */
  private async loadQueue() {
    try {
      this.queue = await syncDb.getQueuedItems()
      console.log(`[OfflineQueue] Loaded ${this.queue.length} items from database`)

      // 如果在线且有待处理项，立即处理
      if (this.isOnline && this.queue.length > 0) {
        this.processPendingQueue()
      }
    } catch (error) {
      console.error('[OfflineQueue] Failed to load queue:', error)
    }
  }

  /**
   * 添加变更到队列
   */
  async enqueue(delta: DeltaRecord, maxRetries: number = 3): Promise<void> {
    const item: QueueItem = {
      id: nanoid(),
      delta,
      retryCount: 0,
      maxRetries,
      createdAt: Date.now()
    }

    try {
      // 保存到数据库
      await syncDb.offlineQueue.add(item)

      // 添加到内存队列
      this.queue.push(item)

      console.log('[OfflineQueue] Enqueued item:', {
        id: item.id,
        operation: delta.operation,
        entityType: delta.entityType
      })

      // 如果在线，立即尝试同步
      if (this.isOnline) {
        this.processPendingQueue()
      }
    } catch (error) {
      console.error('[OfflineQueue] Failed to enqueue item:', error)
    }
  }

  /**
   * 处理待处理队列
   */
  private async processPendingQueue() {
    if (this.syncInProgress || this.queue.length === 0 || !this.isOnline) {
      return
    }

    this.syncInProgress = true
    console.log(`[OfflineQueue] Processing ${this.queue.length} queued items`)

    const itemsToProcess = [...this.queue]

    for (const item of itemsToProcess) {
      try {
        // 尝试同步这个变更
        const success = await this.syncItem(item)

        if (success) {
          // 成功，从队列移除
          await this.dequeue(item.id)
        } else {
          // 失败，增加重试次数
          if (item.retryCount < item.maxRetries) {
            await syncDb.updateQueueItemRetry(item.id)
            item.retryCount++
            console.log(
              `[OfflineQueue] Retry ${item.retryCount}/${item.maxRetries} for item ${item.id}`
            )
          } else {
            // 超过最大重试次数，标记为失败并移除
            console.error(`[OfflineQueue] Item ${item.id} exceeded max retries, removing`)
            await this.dequeue(item.id)
          }
        }
      } catch (error) {
        console.error(`[OfflineQueue] Error processing item ${item.id}:`, error)
      }
    }

    this.syncInProgress = false
  }

  /**
   * 同步单个队列项
   * 这里需要实际的同步逻辑，暂时返回成功
   */
  private async syncItem(item: QueueItem): Promise<boolean> {
    try {
      // TODO: 实现实际的同步逻辑
      // 这里需要调用 IncrementalSyncService 来推送变更

      console.log('[OfflineQueue] Syncing item:', {
        id: item.id,
        operation: item.delta.operation,
        entityType: item.delta.entityType
      })

      // 模拟网络延迟
      await new Promise(resolve => setTimeout(resolve, 100))

      return true
    } catch (error) {
      console.error('[OfflineQueue] Failed to sync item:', error)
      return false
    }
  }

  /**
   * 从队列移除项
   */
  private async dequeue(itemId: string): Promise<void> {
    try {
      // 从数据库移除
      await syncDb.dequeueItem(itemId)

      // 从内存队列移除
      this.queue = this.queue.filter(item => item.id !== itemId)

      console.log(`[OfflineQueue] Dequeued item ${itemId}`)
    } catch (error) {
      console.error(`[OfflineQueue] Failed to dequeue item ${itemId}:`, error)
    }
  }

  /**
   * 获取队列状态
   */
  getStatus(): {
    isOnline: boolean
    queueLength: number
    syncInProgress: boolean
  } {
    return {
      isOnline: this.isOnline,
      queueLength: this.queue.length,
      syncInProgress: this.syncInProgress
    }
  }

  /**
   * 手动触发队列处理
   */
  async processQueue(): Promise<void> {
    await this.processPendingQueue()
  }

  /**
   * 清空队列
   */
  async clearQueue(): Promise<void> {
    try {
      // 清空数据库
      await syncDb.offlineQueue.clear()

      // 清空内存队列
      this.queue = []

      console.log('[OfflineQueue] Queue cleared')
    } catch (error) {
      console.error('[OfflineQueue] Failed to clear queue:', error)
    }
  }
}

// 导出单例实例
export const offlineQueue = new OfflineQueue()
