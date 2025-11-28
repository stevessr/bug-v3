/**
 * 同步系统测试工具
 * 提供测试和调试功能
 */

import { syncDb } from './sync-db'

import { changeTracker } from '@/services/change-tracker'
import { incrementalSyncService } from '@/services/incremental-sync'
import { conflictResolver } from '@/services/conflict-resolver'
import { offlineQueue } from '@/services/offline-queue'
import { OperationType } from '@/types/sync'
import type { DeltaRecord, ConflictInfo } from '@/types/sync'

export class SyncTestHelper {
  /**
   * 生成测试变更记录
   */
  async generateTestDeltas(count: number = 10): Promise<DeltaRecord[]> {
    const deltas: DeltaRecord[] = []

    for (let i = 0; i < count; i++) {
      await changeTracker.trackChange({
        operation: OperationType.UPDATE,
        entityType: 'emoji',
        entityId: `test-emoji-${i}`,
        changes: [
          {
            field: 'name',
            oldValue: `Old Name ${i}`,
            newValue: `New Name ${i}`
          }
        ],
        immediate: true
      })

      const records = await syncDb.deltaRecords
        .where('entityId')
        .equals(`test-emoji-${i}`)
        .toArray()

      if (records.length > 0) {
        deltas.push(records[0])
      }
    }

    return deltas
  }

  /**
   * 模拟冲突场景
   */
  async simulateConflict(): Promise<ConflictInfo[]> {
    // 创建本地变更
    await changeTracker.trackChange({
      operation: OperationType.UPDATE,
      entityType: 'emoji',
      entityId: 'conflict-emoji-1',
      changes: [
        {
          field: 'name',
          oldValue: 'Original Name',
          newValue: 'Local Name'
        }
      ],
      immediate: true
    })

    await new Promise(resolve => setTimeout(resolve, 100))

    // 创建远程变更（模拟）
    await changeTracker.trackChange({
      operation: OperationType.UPDATE,
      entityType: 'emoji',
      entityId: 'conflict-emoji-1',
      changes: [
        {
          field: 'name',
          oldValue: 'Original Name',
          newValue: 'Remote Name'
        }
      ],
      immediate: true
    })

    // 获取变更并检测冲突
    const deltas = await syncDb.deltaRecords.where('entityId').equals('conflict-emoji-1').toArray()

    if (deltas.length >= 2) {
      return conflictResolver.detectConflicts([deltas[0]], [deltas[1]])
    }

    return []
  }

  /**
   * 测试三方合并
   */
  async testThreeWayMerge() {
    const base = {
      id: 'test-1',
      name: 'Original',
      tags: ['tag1', 'tag2'],
      count: 10
    }

    const local = {
      id: 'test-1',
      name: 'Local Modified',
      tags: ['tag1', 'tag2', 'tag3'],
      count: 15
    }

    const remote = {
      id: 'test-1',
      name: 'Remote Modified',
      tags: ['tag1', 'tag2', 'tag4'],
      count: 20
    }

    const result = await conflictResolver.threeWayMerge(base, local, remote, 'emoji')

    console.log('[SyncTest] Three-way merge result:', result)
    return result
  }

  /**
   * 测试离线队列
   */
  async testOfflineQueue() {
    // 生成测试变更
    const deltas = await this.generateTestDeltas(5)

    // 添加到离线队列
    for (const delta of deltas) {
      await offlineQueue.enqueue(delta)
    }

    // 获取队列状态
    const status = offlineQueue.getStatus()
    console.log('[SyncTest] Offline queue status:', status)

    // 手动处理队列
    await offlineQueue.processQueue()

    return status
  }

  /**
   * 性能测试 - 批量变更
   */
  async performanceTestBatch(count: number = 1000) {
    console.log(`[SyncTest] Starting batch performance test with ${count} changes`)

    const startTime = Date.now()

    // 生成大量变更
    for (let i = 0; i < count; i++) {
      await changeTracker.trackChange({
        operation: OperationType.UPDATE,
        entityType: 'emoji',
        entityId: `perf-test-${i}`,
        changes: [
          {
            field: 'name',
            oldValue: `Name ${i}`,
            newValue: `New Name ${i}`
          }
        ]
        // 使用批量模式（不设置 immediate）
      })
    }

    // 手动刷新
    await changeTracker.flush()

    const endTime = Date.now()
    const duration = endTime - startTime

    const stats = await changeTracker.getStats()

    console.log('[SyncTest] Batch performance test results:', {
      count,
      duration: `${duration}ms`,
      avgPerChange: `${(duration / count).toFixed(2)}ms`,
      stats
    })

    return {
      count,
      duration,
      avgPerChange: duration / count,
      stats
    }
  }

  /**
   * 性能测试 - 即时写入
   */
  async performanceTestImmediate(count: number = 100) {
    console.log(`[SyncTest] Starting immediate performance test with ${count} changes`)

    const startTime = Date.now()

    for (let i = 0; i < count; i++) {
      await changeTracker.trackChange({
        operation: OperationType.UPDATE,
        entityType: 'emoji',
        entityId: `perf-test-immediate-${i}`,
        changes: [
          {
            field: 'name',
            oldValue: `Name ${i}`,
            newValue: `New Name ${i}`
          }
        ],
        immediate: true // 立即写入
      })
    }

    const endTime = Date.now()
    const duration = endTime - startTime

    const stats = await changeTracker.getStats()

    console.log('[SyncTest] Immediate performance test results:', {
      count,
      duration: `${duration}ms`,
      avgPerChange: `${(duration / count).toFixed(2)}ms`,
      stats
    })

    return {
      count,
      duration,
      avgPerChange: duration / count,
      stats
    }
  }

  /**
   * 测试完整同步流程
   */
  async testFullSyncFlow() {
    console.log('[SyncTest] Starting full sync flow test')

    // 1. 生成本地变更
    const localDeltas = await this.generateTestDeltas(5)
    console.log('[SyncTest] Generated local deltas:', localDeltas.length)

    // 2. 模拟冲突
    const conflicts = await this.simulateConflict()
    console.log('[SyncTest] Simulated conflicts:', conflicts.length)

    // 3. 自动解决冲突
    if (conflicts.length > 0) {
      const resolved = await conflictResolver.autoResolve(conflicts, 'newest-wins')
      console.log('[SyncTest] Resolved conflicts:', resolved.length)
    }

    // 4. 获取统计信息
    const stats = await incrementalSyncService.getStats()
    console.log('[SyncTest] Sync stats:', stats)

    return {
      localDeltas: localDeltas.length,
      conflicts: conflicts.length,
      stats
    }
  }

  /**
   * 清理测试数据
   */
  async cleanup() {
    console.log('[SyncTest] Cleaning up test data')

    // 删除所有测试相关的记录
    await syncDb.deltaRecords.where('entityId').startsWith('test-').delete()
    await syncDb.deltaRecords.where('entityId').startsWith('perf-test-').delete()
    await syncDb.deltaRecords.where('entityId').startsWith('conflict-').delete()

    // 清空离线队列
    await offlineQueue.clearQueue()

    console.log('[SyncTest] Cleanup completed')
  }

  /**
   * 获取数据库统计
   */
  async getDatabaseStats() {
    const stats = await syncDb.getStats()

    const [totalDeltas, totalVersions, totalConflicts, totalQueue] = await Promise.all([
      syncDb.deltaRecords.count(),
      syncDb.syncVersions.count(),
      syncDb.conflictHistory.count(),
      syncDb.offlineQueue.count()
    ])

    return {
      ...stats,
      tables: {
        deltaRecords: totalDeltas,
        syncVersions: totalVersions,
        conflictHistory: totalConflicts,
        offlineQueue: totalQueue
      }
    }
  }

  /**
   * 导出数据（用于调试）
   */
  async exportData() {
    const [deltas, versions, conflicts, queue] = await Promise.all([
      syncDb.deltaRecords.limit(100).toArray(),
      syncDb.syncVersions.toArray(),
      syncDb.conflictHistory.limit(50).toArray(),
      syncDb.offlineQueue.toArray()
    ])

    return {
      deltas,
      versions,
      conflicts,
      queue,
      timestamp: Date.now()
    }
  }
}

// 导出单例
export const syncTestHelper = new SyncTestHelper()

// 在开发环境下挂载到 window 对象方便调试
if (import.meta.env.DEV) {
  ;(window as any).syncTestHelper = syncTestHelper
  console.log('[SyncTest] Test helper available at window.syncTestHelper')
}
