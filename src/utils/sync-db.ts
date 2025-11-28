/**
 * 增量同步数据库 - IndexedDB 存储
 * 使用 Dexie 管理变更记录、版本信息、冲突历史
 */

import Dexie, { Table } from 'dexie'
import type { DeltaRecord, SyncVersion, ConflictRecord, QueueItem, DeviceInfo } from '@/types/sync'

export class SyncDatabase extends Dexie {
  // 表定义
  deltaRecords!: Table<DeltaRecord, string>
  syncVersions!: Table<SyncVersion, string>
  conflictHistory!: Table<ConflictRecord, string>
  offlineQueue!: Table<QueueItem, string>
  devices!: Table<DeviceInfo, string>

  constructor() {
    super('EmojiSyncDB')

    this.version(1).stores({
      // 变更记录表 - 按时间戳、版本号、设备 ID、实体类型索引
      deltaRecords: 'id, timestamp, version, deviceId, entityType, entityId, [entityType+entityId]',

      // 版本信息表 - 按设备 ID 索引
      syncVersions: 'deviceId, lastSyncTime',

      // 冲突历史表 - 按时间戳、解决状态、实体 ID 索引
      conflictHistory: 'id, timestamp, resolved, entityId, [resolved+timestamp]',

      // 离线队列表 - 按创建时间、重试次数索引
      offlineQueue: 'id, createdAt, retryCount',

      // 设备信息表 - 按设备 ID、最后活跃时间索引
      devices: 'id, lastSeen'
    })
  }

  /**
   * 清理旧的变更记录（保留最近 30 天）
   */
  async cleanupOldRecords(daysToKeep: number = 30): Promise<number> {
    const cutoffTime = Date.now() - daysToKeep * 24 * 60 * 60 * 1000
    return await this.deltaRecords.where('timestamp').below(cutoffTime).delete()
  }

  /**
   * 获取指定版本之后的所有变更
   */
  async getDeltasSince(version: number): Promise<DeltaRecord[]> {
    return await this.deltaRecords.where('version').above(version).sortBy('version')
  }

  /**
   * 获取指定时间之后的所有变更
   */
  async getDeltasSinceTime(timestamp: number): Promise<DeltaRecord[]> {
    return await this.deltaRecords.where('timestamp').above(timestamp).sortBy('timestamp')
  }

  /**
   * 获取未解决的冲突
   */
  async getUnresolvedConflicts(): Promise<ConflictRecord[]> {
    return await this.conflictHistory.where('resolved').equals(0).sortBy('timestamp')
  }

  /**
   * 标记冲突为已解决
   */
  async resolveConflict(conflictId: string, resolution: ConflictRecord['resolution']): Promise<void> {
    await this.conflictHistory.update(conflictId, {
      resolved: true,
      resolution,
      resolvedAt: Date.now()
    })
  }

  /**
   * 获取离线队列中的所有项
   */
  async getQueuedItems(): Promise<QueueItem[]> {
    return await this.offlineQueue.orderBy('createdAt').toArray()
  }

  /**
   * 从队列中移除项
   */
  async dequeueItem(itemId: string): Promise<void> {
    await this.offlineQueue.delete(itemId)
  }

  /**
   * 更新队列项的重试次数
   */
  async updateQueueItemRetry(itemId: string): Promise<void> {
    const item = await this.offlineQueue.get(itemId)
    if (item) {
      await this.offlineQueue.update(itemId, {
        retryCount: item.retryCount + 1,
        lastAttempt: Date.now()
      })
    }
  }

  /**
   * 获取数据库统计信息
   */
  async getStats(): Promise<{
    deltaRecords: number
    unresolvedConflicts: number
    queuedItems: number
    devices: number
  }> {
    const [deltaRecords, unresolvedConflicts, queuedItems, devices] = await Promise.all([
      this.deltaRecords.count(),
      this.conflictHistory.where('resolved').equals(0).count(),
      this.offlineQueue.count(),
      this.devices.count()
    ])

    return {
      deltaRecords,
      unresolvedConflicts,
      queuedItems,
      devices
    }
  }
}

// 导出单例实例
export const syncDb = new SyncDatabase()
