/**
 * 变更跟踪器
 * 拦截并记录所有数据变更操作
 */

import { syncDb } from '@/utils/sync-db'
import { getDeviceId } from '@/utils/device'
import { nanoid } from 'nanoid'
import type { DeltaRecord, DeltaChange, OperationType, EntityType } from '@/types/sync'

export class ChangeTracker {
  private currentVersion = 0
  private batchBuffer: DeltaRecord[] = []
  private batchTimeout: number | null = null
  private isInitialized = false
  private deviceId: string = ''

  constructor() {
    this.initialize()
  }

  /** 初始化 - 加载当前版本号和设备 ID */
  private async initialize() {
    try {
      // 加载设备 ID
      this.deviceId = await getDeviceId()

      // 加载当前版本号
      await this.loadCurrentVersion()

      this.isInitialized = true
      console.log('[ChangeTracker] Initialized', {
        deviceId: this.deviceId,
        currentVersion: this.currentVersion
      })
    } catch (error) {
      console.error('[ChangeTracker] Failed to initialize:', error)
    }
  }

  /** 加载当前版本号 */
  private async loadCurrentVersion() {
    try {
      const records = await syncDb.deltaRecords.orderBy('version').reverse().limit(1).toArray()

      this.currentVersion = records[0]?.version ?? 0
      console.log('[ChangeTracker] Loaded version:', this.currentVersion)
    } catch (error) {
      console.error('[ChangeTracker] Failed to load version:', error)
      this.currentVersion = 0
    }
  }

  /** 等待初始化完成 */
  private async ensureInitialized(): Promise<void> {
    if (this.isInitialized) return

    // 等待初始化，最多 5 秒
    let attempts = 0
    while (!this.isInitialized && attempts < 50) {
      await new Promise(resolve => setTimeout(resolve, 100))
      attempts++
    }

    if (!this.isInitialized) {
      throw new Error('ChangeTracker initialization timeout')
    }
  }

  /**
   * 记录变更
   * @param params 变更参数
   * @param params.operation 操作类型
   * @param params.entityType 实体类型
   * @param params.entityId 实体 ID
   * @param params.changes 变更内容
   * @param params.immediate 是否立即写入（默认批量）
   */
  async trackChange(params: {
    operation: OperationType
    entityType: EntityType
    entityId: string
    changes: DeltaChange[]
    immediate?: boolean
  }): Promise<void> {
    try {
      await this.ensureInitialized()

      const delta: DeltaRecord = {
        id: nanoid(),
        timestamp: Date.now(),
        version: ++this.currentVersion,
        deviceId: this.deviceId,
        operation: params.operation,
        entityType: params.entityType,
        entityId: params.entityId,
        changes: params.changes
      }

      if (params.immediate) {
        // 立即写入
        await syncDb.deltaRecords.add(delta)
        console.log('[ChangeTracker] Tracked change (immediate):', {
          operation: delta.operation,
          entityType: delta.entityType,
          entityId: delta.entityId,
          version: delta.version
        })
      } else {
        // 批量写入
        this.batchBuffer.push(delta)
        this.scheduleBatchWrite()
      }
    } catch (error) {
      console.error('[ChangeTracker] Failed to track change:', error)
    }
  }

  /** 批量写入调度 */
  private scheduleBatchWrite() {
    if (this.batchTimeout) return

    this.batchTimeout = window.setTimeout(async () => {
      await this.flushBatch()
      this.batchTimeout = null
    }, 100) // 100ms 批量间隔
  }

  /** 刷新批量缓冲 */
  private async flushBatch() {
    if (this.batchBuffer.length === 0) return

    try {
      await syncDb.deltaRecords.bulkAdd(this.batchBuffer)
      console.log(`[ChangeTracker] Flushed ${this.batchBuffer.length} changes to database`)
      this.batchBuffer = []
    } catch (error) {
      console.error('[ChangeTracker] Failed to flush batch:', error)
      // 保留缓冲区，下次重试
    }
  }

  /** 手动触发批量写入 */
  async flush(): Promise<void> {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout)
      this.batchTimeout = null
    }
    await this.flushBatch()
  }

  /** 获取当前版本号 */
  getCurrentVersion(): number {
    return this.currentVersion
  }

  /** 获取设备 ID */
  getDeviceId(): string {
    return this.deviceId
  }

  /**
   * 获取指定版本之后的变更
   */
  async getDeltasSince(version: number): Promise<DeltaRecord[]> {
    return await syncDb.getDeltasSince(version)
  }

  /**
   * 清理旧的变更记录
   */
  async cleanupOldRecords(daysToKeep: number = 30): Promise<number> {
    return await syncDb.cleanupOldRecords(daysToKeep)
  }

  /**
   * 获取统计信息
   */
  async getStats(): Promise<{
    currentVersion: number
    deviceId: string
    totalRecords: number
    pendingBatch: number
  }> {
    const totalRecords = await syncDb.deltaRecords.count()

    return {
      currentVersion: this.currentVersion,
      deviceId: this.deviceId,
      totalRecords,
      pendingBatch: this.batchBuffer.length
    }
  }
}

// 导出单例实例
export const changeTracker = new ChangeTracker()
