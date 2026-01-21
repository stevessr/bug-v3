/**
 * 增量同步服务
 * 管理增量同步、冲突检测和解决的核心逻辑
 */

import { conflictResolver } from './conflict-resolver'
import { offlineQueue } from './offline-queue'

import { syncDb } from '@/utils/sync-db'
import { useEmojiStore } from '@/stores'
import { cloudflareSyncService } from '@/utils/cloudflareSync'
import { getDeviceId } from '@/utils/device'
import { createLogger } from '@/utils/logger'
import type {
  SyncOptions,
  SyncResult,
  SyncVersion,
  DeltaRecord,
  SyncState,
  DeltaValue
} from '@/types/sync'

const log = createLogger('IncrementalSync')

/** Type for the emoji store instance */
type EmojiStoreInstance = ReturnType<typeof useEmojiStore>

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
        error: { code: 'SYNC_IN_PROGRESS', message: 'Sync already in progress' }
      }
    }

    this.syncInProgress = true
    this.updateSyncState('syncing', 0, 'Starting sync...')

    try {
      log.info('Starting sync', options)

      // 1. 获取本地和远程版本信息
      this.updateSyncState('syncing', 10, 'Checking versions...')
      const localVersion = await this.getLocalVersion()
      const remoteVersion = await this.getRemoteVersion(options.provider)

      log.info('Versions:', { local: localVersion, remote: remoteVersion })

      // 2. 判断同步方向
      if (options.fullSync || localVersion.local === 0) {
        this.updateSyncState('syncing', 20, 'Performing full sync...')
        return await this.fullSync(options)
      }

      // 3. 获取增量变更
      this.updateSyncState('syncing', 30, 'Fetching local changes...')
      const localDeltas = await this.getLocalDeltas(remoteVersion.remote)

      this.updateSyncState('syncing', 40, 'Fetching remote changes...')
      const remoteDeltas = await this.getRemoteDeltas(options.provider)

      log.info('Deltas:', {
        local: localDeltas.length,
        remote: remoteDeltas.length
      })

      // 4. 检测冲突
      this.updateSyncState('syncing', 50, 'Detecting conflicts...')
      const conflicts = conflictResolver.detectConflicts(localDeltas, remoteDeltas)

      if (conflicts.length > 0) {
        log.info(`Detected ${conflicts.length} conflicts`)

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
      log.error('Sync failed:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.updateSyncState('error', 0, errorMessage)

      return {
        success: false,
        error: { message: errorMessage },
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
    log.info('Performing full sync')

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
      log.error('Full sync failed:', error)
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
        // 暂时返回 0，表示需要全量同步
        return { remote: 0 }
      }

      return { remote: 0 }
    } catch (error) {
      log.error('Failed to get remote version:', error)
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
  private async getRemoteDeltas(provider: string): Promise<DeltaRecord[]> {
    try {
      if (provider === 'cloudflare') {
        // 从 Cloudflare 获取增量变更
        // 这里应该读取远程的 delta 文件
        // 暂时返回空数组
        return []
      }

      return []
    } catch (error) {
      log.error('Failed to get remote deltas:', error)
      return []
    }
  }

  /**
   * 应用远程变更到本地
   */
  private async applyRemoteDeltas(deltas: DeltaRecord[]): Promise<void> {
    if (deltas.length === 0) return

    log.info(`Applying ${deltas.length} remote changes`)

    // 按版本号排序确保顺序应用
    const sortedDeltas = deltas.sort((a, b) => a.version - b.version)

    // 导入 store
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
  private async applyDelta(delta: DeltaRecord, store: EmojiStoreInstance): Promise<void> {
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

      log.debug('Applied delta:', {
        operation: delta.operation,
        entityType: delta.entityType,
        entityId: delta.entityId
      })
    } catch (error) {
      log.error('Failed to apply delta:', error)
    }
  }

  /**
   * 应用 emoji 变更
   */
  private async applyEmojiDelta(delta: DeltaRecord, store: EmojiStoreInstance): Promise<void> {
    switch (delta.operation) {
      case 'create': {
        const emojiData = delta.changes.find(c => c.field === 'emojis')?.newValue
        if (emojiData && typeof emojiData === 'object' && 'groupId' in emojiData) {
          const groupId = (emojiData as { groupId: string }).groupId
          store.addEmojiWithoutSave(
            groupId,
            emojiData as Parameters<typeof store.addEmojiWithoutSave>[1]
          )
        }
        break
      }

      case 'update': {
        const updates: Record<string, DeltaValue> = {}
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
            const sourceGroupId =
              typeof moveData.oldValue === 'string' ? moveData.oldValue : undefined
            const targetGroupId =
              typeof moveData.newValue === 'string' ? moveData.newValue : undefined
            const sourceGroup = sourceGroupId
              ? store.groups.find(g => g.id === sourceGroupId)
              : undefined
            const targetGroup = targetGroupId
              ? store.groups.find(g => g.id === targetGroupId)
              : undefined
            if (sourceGroup && targetGroup) {
              const sourceIndex = sourceGroup.emojis.findIndex(e => e.id === delta.entityId)
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
  private async applyGroupDelta(delta: DeltaRecord, store: EmojiStoreInstance): Promise<void> {
    switch (delta.operation) {
      case 'create': {
        const groupData = delta.changes.find(c => c.field === 'groups')?.newValue
        if (groupData && typeof groupData === 'object') {
          const name =
            'name' in groupData && typeof groupData.name === 'string' ? groupData.name : undefined
          const icon =
            'icon' in groupData && typeof groupData.icon === 'string' ? groupData.icon : undefined
          if (name && icon) {
            store.createGroupWithoutSave(name, icon)
          }
        }
        break
      }

      case 'update': {
        const updates: Record<string, DeltaValue> = {}
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
  private async applySettingsDelta(delta: DeltaRecord, store: EmojiStoreInstance): Promise<void> {
    const updates: Record<string, DeltaValue> = {}
    for (const change of delta.changes) {
      updates[change.field] = change.newValue
    }
    store.updateSettings(updates)
  }

  /**
   * 应用收藏变更
   */
  private async applyFavoritesDelta(delta: DeltaRecord, store: EmojiStoreInstance): Promise<void> {
    switch (delta.operation) {
      case 'create':
      case 'update': {
        const emojiId = delta.changes.find(c => c.field === 'favorites')?.newValue
        if (typeof emojiId === 'string') {
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

    log.info(`Pushing ${deltas.length} local changes`)

    try {
      if (provider === 'cloudflare') {
        // 推送到 Cloudflare
        // 这里应该将 deltas 写入远程存储
        // 暂时使用全量推送
        await cloudflareSyncService.pushData()
      }
    } catch (error) {
      log.error('Failed to push local deltas:', error)
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
    log.info('Updated sync version:', version)
  }

  /**
   * 重置本地版本
   */
  private async resetLocalVersion(): Promise<void> {
    const deviceId = await getDeviceId()
    await syncDb.syncVersions.delete(deviceId)
    log.info('Reset local version')
  }

  /**
   * 更新同步状态
   */
  private updateSyncState(status: SyncState['status'], progress: number, message?: string): void {
    this.syncState = {
      status,
      progress,
      message
    }
    log.debug('State:', this.syncState)
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
