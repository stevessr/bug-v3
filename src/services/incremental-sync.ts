/**
 * 增量同步服务
 * 管理增量同步、冲突检测和解决的核心逻辑
 */

import { syncDb } from '@/utils/sync-db'
import { changeTracker } from './change-tracker'
import { conflictResolver } from './conflict-resolver'
import { offlineQueue } from './offline-queue'
import { cloudflareSyncService } from '@/utils/cloudflareSync'
import { newStorageHelpers } from '@/utils/newStorage'
import { getDeviceId } from '@/utils/device'
import type {
  SyncOptions,
  SyncResult,
  SyncVersion,
  DeltaRecord,
  ConflictInfo,
  SyncState
} from '@/types/sync'

export class IncrementalSyncService {
  private syncInProgress = false
  private syncState: SyncState = {
    status: 'idle',
    progress: 0
  }

  /**
   * 执行增量同步
   * @param options 同步选项
   */
  async sync(options: SyncOptions): Promise<SyncResult> {
    if (this.syncInProgress) {
      return {
        success: false,
        message: 'Sync already in progress',
        error: 'SYNC_IN_PROGRESS'
      }
    }

    this.syncInProgress = true
    this.updateSyncState('syncing', 0, 'Starting sync...')

    try {
      console.log('[IncrementalSync] Starting sync', options)

      // 1. 获取本地和远程版本信息
      this.updateSyncState('syncing', 10, 'Checking versions...')
      const localVersion = await this.getLocalVersion()
      const remoteVersion = await this.getRemoteVersion(options.provider)

      console.log('[IncrementalSync] Versions:', { local: localVersion, remote: remoteVersion })

      // 2. 判断同步方向
      if (options.fullSync || localVersion.local === 0) {
        this.updateSyncState('syncing', 20, 'Performing full sync...')
        return await this.fullSync(options)
      }

      // 3. 获取增量变更
      this.updateSyncState('syncing', 30, 'Fetching local changes...')
      const localDeltas = await this.getLocalDeltas(remoteVersion.remote)

      this.updateSyncState('syncing', 40, 'Fetching remote changes...')
      const remoteDeltas = await this.getRemoteDeltas(options.provider, localVersion.local)

      console.log('[IncrementalSync] Deltas:', {
        local: localDeltas.length,
        remote: remoteDeltas.length
      })

      // 4. 检测冲突
      this.updateSyncState('syncing', 50, 'Detecting conflicts...')
      const conflicts = conflictResolver.detectConflicts(localDeltas, remoteDeltas)

      if (conflicts.length > 0) {
        console.log(`[IncrementalSync] Detected ${conflicts.length} conflicts`)

        // 根据策略处理冲突
        if (options.conflictStrategy === 'manual') {
          this.updateSyncState('conflict', 50, 'Manual conflict resolution required')
          return {
            success: false,
            conflicts,
            message: 'Conflicts detected, manual resolution required'
          }
        } else {
          // 自动解决冲突
          this.updateSyncState('syncing', 60, 'Resolving conflicts...')
          await conflictResolver.autoResolve(conflicts, options.conflictStrategy || 'newest-wins')
        }
      }

      // 5. 应用远程变更
      this.updateSyncState('syncing', 70, 'Applying remote changes...')
      await this.applyRemoteDeltas(remoteDeltas)

      // 6. 推送本地变更
      this.updateSyncState('syncing', 80, 'Pushing local changes...')
      await this.pushLocalDeltas(localDeltas, options.provider)

      // 7. 更新版本信息
      this.updateSyncState('syncing', 90, 'Updating version info...')
      const newVersion = Math.max(localVersion.local, remoteVersion.remote) + localDeltas.length

      await this.updateSyncVersion({
        local: newVersion,
        remote: newVersion,
        lastSyncTime: Date.now(),
        deviceId: localVersion.deviceId,
        pendingChanges: 0
      })

      this.updateSyncState('idle', 100, 'Sync completed successfully')

      return {
        success: true,
        syncedChanges: localDeltas.length + remoteDeltas.length,
        conflicts: [],
        message: 'Sync completed successfully'
      }
    } catch (error) {
      console.error('[IncrementalSync] Sync failed:', error)
      this.updateSyncState('error', 0, error instanceof Error ? error.message : 'Unknown error')

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Sync failed'
      }
    } finally {
      this.syncInProgress = false
    }
  }

  /**
   * 全量同步
   */
  private async fullSync(options: SyncOptions): Promise<SyncResult> {
    console.log('[IncrementalSync] Performing full sync')

    try {
      if (options.provider === 'cloudflare') {
        // 使用 Cloudflare 同步服务
        const result = await cloudflareSyncService.sync('both', progress => {
          this.updateSyncState('syncing', 20 + (progress.current / progress.total) * 60)
        })

        if (result.success) {
          // 重置本地版本
          await this.resetLocalVersion()

          this.updateSyncState('idle', 100, 'Full sync completed')
          return {
            success: true,
            message: 'Full sync completed'
          }
        } else {
          throw new Error(result.message || 'Full sync failed')
        }
      } else {
        throw new Error(`Provider ${options.provider} not supported for full sync`)
      }
    } catch (error) {
      console.error('[IncrementalSync] Full sync failed:', error)
      throw error
    }
  }

  /**
   * 获取本地版本信息
   */
  private async getLocalVersion(): Promise<SyncVersion> {
    const deviceId = await getDeviceId()
    const version = await syncDb.syncVersions.get(deviceId)

    if (!version) {
      const newVersion: SyncVersion = {
        local: 0,
        remote: 0,
        lastSyncTime: 0,
        deviceId,
        pendingChanges: 0
      }
      await syncDb.syncVersions.add(newVersion)
      return newVersion
    }

    return version
  }

  /**
   * 获取远程版本信息
   */
  private async getRemoteVersion(provider: string): Promise<{ remote: number }> {
    try {
      if (provider === 'cloudflare') {
        // 从 Cloudflare 获取版本信息
        const config = cloudflareSyncService.getConfig()
        if (!config) {
          return { remote: 0 }
        }

        // 这里应该从远程读取版本文件
        // 暂时返回0，表示需要全量同步
        return { remote: 0 }
      }

      return { remote: 0 }
    } catch (error) {
      console.error('[IncrementalSync] Failed to get remote version:', error)
      return { remote: 0 }
    }
  }

  /**
   * 获取本地增量变更
   */
  private async getLocalDeltas(sinceVersion: number): Promise<DeltaRecord[]> {
    return await syncDb.getDeltasSince(sinceVersion)
  }

  /**
   * 获取远程增量变更
   */
  private async getRemoteDeltas(provider: string, sinceVersion: number): Promise<DeltaRecord[]> {
    try {
      if (provider === 'cloudflare') {
        // 从 Cloudflare 获取增量变更
        // 这里应该读取远程的 delta 文件
        // 暂时返回空数组
        return []
      }

      return []
    } catch (error) {
      console.error('[IncrementalSync] Failed to get remote deltas:', error)
      return []
    }
  }

  /**
   * 应用远程变更到本地
   */
  private async applyRemoteDeltas(deltas: DeltaRecord[]): Promise<void> {
    if (deltas.length === 0) return

    console.log(`[IncrementalSync] Applying ${deltas.length} remote changes`)

    // 按版本号排序确保顺序应用
    const sortedDeltas = deltas.sort((a, b) => a.version - b.version)

    // 导入 store
    const { useEmojiStore } = await import('@/stores/emojiStore')
    const emojiStore = useEmojiStore()

    // 开始批量操作
    emojiStore.beginBatch()

    try {
      for (const delta of sortedDeltas) {
        await this.applyDelta(delta, emojiStore)
      }
    } finally {
      await emojiStore.endBatch()
    }
  }

  /**
   * 应用单个变更
   */
  private async applyDelta(delta: DeltaRecord, store: any): Promise<void> {
    try {
      switch (delta.entityType) {
        case 'emoji':
          await this.applyEmojiDelta(delta, store)
          break
        case 'group':
          await this.applyGroupDelta(delta, store)
          break
        case 'settings':
          await this.applySettingsDelta(delta, store)
          break
        case 'favorites':
          await this.applyFavoritesDelta(delta, store)
          break
      }

      console.log('[IncrementalSync] Applied delta:', {
        operation: delta.operation,
        entityType: delta.entityType,
        entityId: delta.entityId
      })
    } catch (error) {
      console.error('[IncrementalSync] Failed to apply delta:', error)
    }
  }

  /**
   * 应用 emoji 变更
   */
  private async applyEmojiDelta(delta: DeltaRecord, store: any): Promise<void> {
    switch (delta.operation) {
      case 'create': {
        const emojiData = delta.changes.find(c => c.field === 'emojis')?.newValue
        if (emojiData) {
          store.addEmojiWithoutSave(emojiData.groupId, emojiData)
        }
        break
      }

      case 'update': {
        const updates: any = {}
        for (const change of delta.changes) {
          updates[change.field] = change.newValue
        }
        store.updateEmoji(delta.entityId, updates)
        break
      }

      case 'delete': {
        store.deleteEmoji(delta.entityId)
        break
      }

      case 'move': {
        const moveData = delta.changes.find(c => c.field === 'groupId')
        if (moveData) {
          // 找到 emoji 并移动
          const emoji = store.findEmojiById(delta.entityId)
          if (emoji) {
            const sourceGroup = store.groups.find((g: any) => g.id === moveData.oldValue)
            const targetGroup = store.groups.find((g: any) => g.id === moveData.newValue)
            if (sourceGroup && targetGroup) {
              const sourceIndex = sourceGroup.emojis.findIndex((e: any) => e.id === delta.entityId)
              if (sourceIndex !== -1) {
                store.moveEmoji(sourceGroup.id, sourceIndex, targetGroup.id, 0)
              }
            }
          }
        }
        break
      }
    }
  }

  /**
   * 应用分组变更
   */
  private async applyGroupDelta(delta: DeltaRecord, store: any): Promise<void> {
    switch (delta.operation) {
      case 'create': {
        const groupData = delta.changes.find(c => c.field === 'groups')?.newValue
        if (groupData) {
          store.createGroupWithoutSave(groupData.name, groupData.icon)
        }
        break
      }

      case 'update': {
        const updates: any = {}
        for (const change of delta.changes) {
          updates[change.field] = change.newValue
        }
        store.updateGroup(delta.entityId, updates)
        break
      }

      case 'delete': {
        store.deleteGroup(delta.entityId)
        break
      }
    }
  }

  /**
   * 应用设置变更
   */
  private async applySettingsDelta(delta: DeltaRecord, store: any): Promise<void> {
    const updates: any = {}
    for (const change of delta.changes) {
      updates[change.field] = change.newValue
    }
    store.updateSettings(updates)
  }

  /**
   * 应用收藏变更
   */
  private async applyFavoritesDelta(delta: DeltaRecord, store: any): Promise<void> {
    switch (delta.operation) {
      case 'create':
      case 'update': {
        const emojiId = delta.changes.find(c => c.field === 'favorites')?.newValue
        if (emojiId) {
          store.favorites.add(emojiId)
        }
        break
      }

      case 'delete': {
        store.favorites.delete(delta.entityId)
        break
      }
    }
  }

  /**
   * 推送本地变更到远程
   */
  private async pushLocalDeltas(deltas: DeltaRecord[], provider: string): Promise<void> {
    if (deltas.length === 0) return

    console.log(`[IncrementalSync] Pushing ${deltas.length} local changes`)

    try {
      if (provider === 'cloudflare') {
        // 推送到 Cloudflare
        // 这里应该将 deltas 写入远程存储
        // 暂时使用全量推送
        await cloudflareSyncService.pushData()
      }
    } catch (error) {
      console.error('[IncrementalSync] Failed to push local deltas:', error)
      // 添加到离线队列
      for (const delta of deltas) {
        await offlineQueue.enqueue(delta)
      }
    }
  }

  /**
   * 更新同步版本信息
   */
  private async updateSyncVersion(version: SyncVersion): Promise<void> {
    await syncDb.syncVersions.put(version)
    console.log('[IncrementalSync] Updated sync version:', version)
  }

  /**
   * 重置本地版本
   */
  private async resetLocalVersion(): Promise<void> {
    const deviceId = await getDeviceId()
    await syncDb.syncVersions.delete(deviceId)
    console.log('[IncrementalSync] Reset local version')
  }

  /**
   * 更新同步状态
   */
  private updateSyncState(
    status: SyncState['status'],
    progress: number,
    message?: string
  ): void {
    this.syncState = {
      status,
      progress,
      message
    }
    console.log('[IncrementalSync] State:', this.syncState)
  }

  /**
   * 获取同步状态
   */
  getSyncState(): SyncState {
    return { ...this.syncState }
  }

  /**
   * 获取同步统计
   */
  async getStats(): Promise<{
    localVersion: number
    remoteVersion: number
    pendingChanges: number
    unresolvedConflicts: number
  }> {
    const localVersion = await this.getLocalVersion()
    const stats = await syncDb.getStats()

    return {
      localVersion: localVersion.local,
      remoteVersion: localVersion.remote,
      pendingChanges: localVersion.pendingChanges,
      unresolvedConflicts: stats.unresolvedConflicts
    }
  }
}

// 导出单例实例
export const incrementalSyncService = new IncrementalSyncService()
