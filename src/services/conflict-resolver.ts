/**
 * 冲突解决器
 * 实现三方合并算法和智能冲突检测
 */

import type {
  DeltaRecord,
  ConflictInfo,
  ConflictStrategy,
  MergeResult,
  MergeBase,
  EntityType
} from '@/types/sync'
import { syncDb } from '@/utils/sync-db'
import { nanoid } from 'nanoid'

export class ConflictResolver {
  /**
   * 检测冲突
   * 比较本地和远程变更，识别冲突操作
   */
  detectConflicts(localDeltas: DeltaRecord[], remoteDeltas: DeltaRecord[]): ConflictInfo[] {
    const conflicts: ConflictInfo[] = []

    // 按实体分组
    const localByEntity = this.groupByEntity(localDeltas)
    const remoteByEntity = this.groupByEntity(remoteDeltas)

    // 找出同时在本地和远程修改的实体
    const commonEntities = new Set([
      ...Object.keys(localByEntity),
      ...Object.keys(remoteByEntity)
    ])

    for (const entityKey of commonEntities) {
      const localChanges = localByEntity[entityKey] || []
      const remoteChanges = remoteByEntity[entityKey] || []

      // 只有当本地和远程都有变更时才可能存在冲突
      if (localChanges.length > 0 && remoteChanges.length > 0) {
        const conflict = this.analyzeEntityConflict(localChanges, remoteChanges)
        if (conflict) {
          conflicts.push(conflict)
        }
      }
    }

    console.log(`[ConflictResolver] Detected ${conflicts.length} conflicts`)
    return conflicts
  }

  /**
   * 按实体分组变更
   */
  private groupByEntity(deltas: DeltaRecord[]): Record<string, DeltaRecord[]> {
    const grouped: Record<string, DeltaRecord[]> = {}

    for (const delta of deltas) {
      const key = `${delta.entityType}:${delta.entityId}`
      if (!grouped[key]) {
        grouped[key] = []
      }
      grouped[key].push(delta)
    }

    return grouped
  }

  /**
   * 分析单个实体的冲突
   */
  private analyzeEntityConflict(
    localChanges: DeltaRecord[],
    remoteChanges: DeltaRecord[]
  ): ConflictInfo | null {
    // 取最新的本地和远程变更
    const localChange = localChanges[localChanges.length - 1]
    const remoteChange = remoteChanges[remoteChanges.length - 1]

    // 检查是否有实际冲突
    if (this.hasRealConflict(localChange, remoteChange)) {
      return {
        id: nanoid(),
        entityType: localChange.entityType,
        entityId: localChange.entityId,
        localChange,
        remoteChange,
        timestamp: Date.now(),
        resolved: false
      }
    }

    return null
  }

  /**
   * 判断是否存在真实冲突
   */
  private hasRealConflict(local: DeltaRecord, remote: DeltaRecord): boolean {
    // 删除操作总是冲突
    if (local.operation === 'delete' || remote.operation === 'delete') {
      return true
    }

    // 检查字段级冲突
    const localFields = new Set(local.changes.map(c => c.field))
    const remoteFields = new Set(remote.changes.map(c => c.field))

    // 如果修改了相同的字段，则存在冲突
    for (const field of localFields) {
      if (remoteFields.has(field)) {
        return true
      }
    }

    return false
  }

  /**
   * 自动解决冲突
   * @param conflicts 冲突列表
   * @param strategy 解决策略
   */
  async autoResolve(
    conflicts: ConflictInfo[],
    strategy: ConflictStrategy = 'newest-wins'
  ): Promise<ConflictInfo[]> {
    const resolved: ConflictInfo[] = []

    for (const conflict of conflicts) {
      try {
        let resolution: 'local' | 'remote' | 'merged' = 'local'

        switch (strategy) {
          case 'local-first':
            resolution = 'local'
            break

          case 'remote-first':
            resolution = 'remote'
            break

          case 'newest-wins':
            // 比较时间戳，选择最新的
            resolution =
              conflict.localChange.timestamp > conflict.remoteChange.timestamp ? 'local' : 'remote'
            break

          case 'auto':
            // 尝试智能合并
            const mergeResult = await this.smartMerge(conflict)
            if (mergeResult.success) {
              resolution = 'merged'
            } else {
              // 合并失败，使用最新的
              resolution =
                conflict.localChange.timestamp > conflict.remoteChange.timestamp
                  ? 'local'
                  : 'remote'
            }
            break

          default:
            resolution = 'local'
        }

        // 标记为已解决
        conflict.resolved = true
        conflict.resolution = resolution

        // 保存到冲突历史
        await syncDb.conflictHistory.add({
          id: conflict.id,
          timestamp: conflict.timestamp,
          resolved: true,
          entityType: conflict.entityType,
          entityId: conflict.entityId,
          localData: conflict.localChange,
          remoteData: conflict.remoteChange,
          resolution,
          resolvedAt: Date.now()
        })

        resolved.push(conflict)
        console.log(`[ConflictResolver] Auto-resolved conflict ${conflict.id} with ${resolution}`)
      } catch (error) {
        console.error(`[ConflictResolver] Failed to resolve conflict ${conflict.id}:`, error)
      }
    }

    return resolved
  }

  /**
   * 智能合并（三方合并）
   * 尝试自动合并非冲突的字段
   */
  private async smartMerge(conflict: ConflictInfo): Promise<MergeResult> {
    const { localChange, remoteChange } = conflict

    try {
      // 收集所有变更的字段
      const localFields = new Map(localChange.changes.map(c => [c.field, c.newValue]))
      const remoteFields = new Map(remoteChange.changes.map(c => [c.field, c.newValue]))

      const allFields = new Set([...localFields.keys(), ...remoteFields.keys()])
      const mergedData: any = {}
      const fieldConflicts: Array<{ field: string; localValue: any; remoteValue: any }> = []

      for (const field of allFields) {
        const hasLocal = localFields.has(field)
        const hasRemote = remoteFields.has(field)

        if (hasLocal && hasRemote) {
          // 字段在两边都被修改
          const localValue = localFields.get(field)
          const remoteValue = remoteFields.get(field)

          if (JSON.stringify(localValue) === JSON.stringify(remoteValue)) {
            // 修改后的值相同，不是真正的冲突
            mergedData[field] = localValue
          } else {
            // 真正的冲突，记录下来
            fieldConflicts.push({
              field,
              localValue,
              remoteValue
            })

            // 使用最新的值
            mergedData[field] =
              localChange.timestamp > remoteChange.timestamp ? localValue : remoteValue
          }
        } else if (hasLocal) {
          // 只在本地修改
          mergedData[field] = localFields.get(field)
        } else {
          // 只在远程修改
          mergedData[field] = remoteFields.get(field)
        }
      }

      return {
        success: fieldConflicts.length === 0,
        data: mergedData,
        conflicts: fieldConflicts,
        autoResolved: fieldConflicts.length === 0,
        strategy: 'three-way-merge'
      }
    } catch (error) {
      console.error('[ConflictResolver] Smart merge failed:', error)
      return {
        success: false,
        autoResolved: false,
        strategy: 'three-way-merge'
      }
    }
  }

  /**
   * 手动解决冲突
   * @param conflictId 冲突ID
   * @param resolution 解决方案（local/remote/merged）
   * @param mergedData 如果是合并，提供合并后的数据
   */
  async manualResolve(
    conflictId: string,
    resolution: 'local' | 'remote' | 'merged',
    mergedData?: any
  ): Promise<void> {
    try {
      await syncDb.resolveConflict(conflictId, resolution)

      if (resolution === 'merged' && mergedData) {
        // 保存合并后的数据
        await syncDb.conflictHistory.update(conflictId, {
          mergedData,
          resolvedAt: Date.now()
        })
      }

      console.log(`[ConflictResolver] Manually resolved conflict ${conflictId} with ${resolution}`)
    } catch (error) {
      console.error(`[ConflictResolver] Failed to manually resolve conflict ${conflictId}:`, error)
      throw error
    }
  }

  /**
   * 获取未解决的冲突
   */
  async getUnresolvedConflicts(): Promise<ConflictInfo[]> {
    try {
      const records = await syncDb.getUnresolvedConflicts()

      return records.map(record => ({
        id: record.id,
        entityType: record.entityType,
        entityId: record.entityId,
        localChange: record.localData,
        remoteChange: record.remoteData,
        timestamp: record.timestamp,
        resolved: record.resolved,
        resolution: record.resolution
      }))
    } catch (error) {
      console.error('[ConflictResolver] Failed to get unresolved conflicts:', error)
      return []
    }
  }

  /**
   * 三方合并（带基础版本）
   * 比较 base、local、remote 三个版本，智能合并
   */
  async threeWayMerge<T = any>(
    base: T,
    local: T,
    remote: T,
    entityType: EntityType
  ): Promise<MergeResult<T>> {
    try {
      // 检测变更
      const localChanges = this.diff(base, local)
      const remoteChanges = this.diff(base, remote)

      // 找出冲突字段
      const conflictFields = new Set<string>()
      const allChangedFields = new Set([...localChanges.keys(), ...remoteChanges.keys()])

      for (const field of allChangedFields) {
        if (localChanges.has(field) && remoteChanges.has(field)) {
          const localValue = localChanges.get(field)
          const remoteValue = remoteChanges.get(field)

          if (JSON.stringify(localValue) !== JSON.stringify(remoteValue)) {
            conflictFields.add(field)
          }
        }
      }

      // 构建合并结果
      const merged: any = { ...base }
      const conflicts: Array<{
        field: string
        localValue: any
        remoteValue: any
        baseValue: any
      }> = []

      // 应用非冲突变更
      for (const [field, value] of localChanges) {
        if (!conflictFields.has(field)) {
          merged[field] = value
        }
      }

      for (const [field, value] of remoteChanges) {
        if (!conflictFields.has(field)) {
          merged[field] = value
        }
      }

      // 处理冲突字段
      for (const field of conflictFields) {
        conflicts.push({
          field,
          localValue: localChanges.get(field),
          remoteValue: remoteChanges.get(field),
          baseValue: (base as any)[field]
        })

        // 默认使用 remote 的值（可配置）
        merged[field] = remoteChanges.get(field)
      }

      return {
        success: conflicts.length === 0,
        data: merged as T,
        conflicts,
        autoResolved: conflicts.length === 0,
        strategy: 'three-way-merge'
      }
    } catch (error) {
      console.error('[ConflictResolver] Three-way merge failed:', error)
      return {
        success: false,
        autoResolved: false,
        strategy: 'three-way-merge'
      }
    }
  }

  /**
   * 对比两个对象的差异
   */
  private diff(base: any, modified: any): Map<string, any> {
    const changes = new Map<string, any>()

    const allKeys = new Set([...Object.keys(base || {}), ...Object.keys(modified || {})])

    for (const key of allKeys) {
      const baseValue = base?.[key]
      const modifiedValue = modified?.[key]

      if (JSON.stringify(baseValue) !== JSON.stringify(modifiedValue)) {
        changes.set(key, modifiedValue)
      }
    }

    return changes
  }
}

// 导出单例实例
export const conflictResolver = new ConflictResolver()
