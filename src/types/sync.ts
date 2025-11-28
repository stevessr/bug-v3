/**
 * 增量同步系统 - 类型定义
 * 定义变更跟踪、版本管理、冲突处理等核心类型
 */

import type { Emoji, EmojiGroup, AppSettings } from './type'

/** 操作类型枚举 */
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  MOVE = 'move', // 移动到不同分组
  REORDER = 'reorder' // 重新排序
}

/** 实体类型 */
export type EntityType = 'emoji' | 'group' | 'settings' | 'favorites'

/** 具体变更内容 */
export interface DeltaChange {
  field: string // 字段名
  oldValue: any // 旧值
  newValue: any // 新值
  path?: string[] // 嵌套路径（如 ['tags', '0']）
}

/** 变更记录 */
export interface DeltaRecord {
  id: string // 变更记录唯一 ID
  timestamp: number // 时间戳（毫秒）
  version: number // 版本号（单调递增）
  deviceId: string // 设备标识
  operation: OperationType // 操作类型
  entityType: EntityType // 实体类型
  entityId: string // 实体 ID
  changes: DeltaChange[] // 具体变更内容
  metadata?: {
    userId?: string
    sessionId?: string
    conflictResolved?: boolean
  }
}

/** 同步版本信息 */
export interface SyncVersion {
  local: number // 本地最新版本号
  remote: number // 远程最新版本号
  lastSyncTime: number // 上次同步时间
  deviceId: string // 当前设备 ID
  pendingChanges: number // 待同步变更数
}

/** 同步状态 */
export interface SyncState {
  status: 'idle' | 'syncing' | 'conflict' | 'error'
  progress: number // 0-100
  message?: string
  conflicts?: ConflictInfo[]
}

/** 冲突信息 */
export interface ConflictInfo {
  id: string
  entityType: EntityType
  entityId: string
  localChange: DeltaRecord
  remoteChange: DeltaRecord
  timestamp: number
  resolved: boolean
  resolution?: 'local' | 'remote' | 'merged' | 'manual'
}

/** 冲突解决策略 */
export type ConflictStrategy = 'auto' | 'manual' | 'local-first' | 'remote-first' | 'newest-wins'

/** 同步结果 */
export interface SyncResult {
  success: boolean
  syncedChanges?: number
  conflicts?: ConflictInfo[]
  error?: any
  message?: string
}

/** 同步选项 */
export interface SyncOptions {
  provider: 'cloudflare' | 'chrome' | 'webdav' | 's3'
  fullSync?: boolean // 强制全量同步
  conflictStrategy?: ConflictStrategy
  skipBackup?: boolean // 跳过备份
}

/** 冲突记录（用于历史追踪） */
export interface ConflictRecord {
  id: string
  timestamp: number
  resolved: boolean
  entityType: EntityType
  entityId: string
  localData: any
  remoteData: any
  mergedData?: any
  resolution: 'local' | 'remote' | 'merged' | 'manual'
  resolvedAt?: number
}

/** 离线队列项 */
export interface QueueItem {
  id: string
  delta: DeltaRecord
  retryCount: number
  maxRetries: number
  createdAt: number
  lastAttempt?: number
}

/** 设备信息 */
export interface DeviceInfo {
  id: string
  name: string
  type: 'desktop' | 'mobile' | 'tablet'
  lastSeen: number
  version: string
}

/** 三方合并基础数据 */
export interface MergeBase {
  baseVersion: number
  baseData: any
  timestamp: number
}

/** 合并结果 */
export interface MergeResult<T = any> {
  success: boolean
  data?: T
  conflicts?: Array<{
    field: string
    localValue: any
    remoteValue: any
    baseValue?: any
  }>
  autoResolved: boolean
  strategy: string
}
