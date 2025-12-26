# 增量同步与冲突合并系统

完整的增量同步解决方案，支持多端数据同步、智能冲突检测和自动合并。

## 📋 目录

- [核心功能](#核心功能)
- [系统架构](#系统架构)
- [快速开始](#快速开始)
- [API 文档](#api-文档)
- [冲突解决策略](#冲突解决策略)
- [最佳实践](#最佳实践)
- [故障排除](#故障排除)

## 核心功能

### ✨ 主要特性

1. **增量同步**
   - 只同步变更的数据，节省带宽
   - 版本控制和变更追踪
   - 支持离线队列和自动重试

2. **智能冲突检测**
   - 字段级冲突检测
   - 三方合并算法
   - 多种自动解决策略

3. **可视化冲突解决**
   - 直观的对比界面
   - 手动和自动解决选项
   - 冲突历史追踪

4. **离线支持**
   - 离线变更队列
   - 网络恢复自动同步
   - 失败重试机制

## 系统架构

```
┌─────────────────────────────────────────────────────────┐
│                    应用层 (App Layer)                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │ EmojiStore   │  │  UI组件      │  │  用户操作    │   │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘   │
└─────────┼──────────────────┼──────────────────┼─────────┘
          │                  │                  │
┌─────────┼──────────────────┼──────────────────┼─────────┐
│         ▼                  ▼                  ▼         │
│  ┌─────────────────────────────────────────────────┐   │
│  │         变更跟踪器 (ChangeTracker)               │   │
│  │  - 拦截所有数据变更                               │   │
│  │  - 生成 DeltaRecord                              │   │
│  │  - 批量写入优化                                   │   │
│  └─────────────────┬───────────────────────────────┘   │
│                    │                                    │
│         同步服务层 (Sync Service Layer)                │
└────────────────────┼────────────────────────────────────┘
                     │
┌────────────────────┼────────────────────────────────────┐
│                    ▼                                    │
│  ┌──────────────────────────────────────────────────┐  │
│  │    增量同步服务 (IncrementalSyncService)          │  │
│  │  - 版本管理                                       │  │
│  │  - 增量变更计算                                   │  │
│  │  - 冲突检测与解决                                 │  │
│  └─────┬──────────────────────────────────┬─────────┘  │
│        │                                  │            │
│  ┌─────▼─────────┐            ┌──────────▼──────────┐ │
│  │ 冲突解决器     │            │  离线队列管理器      │ │
│  │ (Conflict     │            │  (OfflineQueue)     │ │
│  │  Resolver)    │            │  - 网络状态监听      │ │
│  │ - 三方合并     │            │  - 自动重试         │ │
│  │ - 智能检测     │            └─────────────────────┘ │
│  └───────────────┘                                    │
│                                                        │
│         存储层 (Storage Layer)                         │
└────────────────────────────────────────────────────────┘
                     │
┌────────────────────┼────────────────────────────────────┐
│                    ▼                                    │
│  ┌──────────────────────────────────────────────────┐  │
│  │     IndexedDB (SyncDatabase)                     │  │
│  │  ┌──────────────┐  ┌──────────────┐             │  │
│  │  │ deltaRecords │  │ syncVersions │             │  │
│  │  └──────────────┘  └──────────────┘             │  │
│  │  ┌──────────────┐  ┌──────────────┐             │  │
│  │  │ conflictHist │  │ offlineQueue │             │  │
│  │  └──────────────┘  └──────────────┘             │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │     远程存储 (Remote Storage)                     │  │
│  │  - Cloudflare R2                                 │  │
│  │  - Chrome Sync                                   │  │
│  │  - WebDAV (扩展)                                 │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

## 快速开始

### 1. 初始化同步系统

```typescript
import { changeTracker } from '@/services/change-tracker'
import { incrementalSyncService } from '@/services/incremental-sync'

// 系统会自动初始化，无需手动调用
```

### 2. 记录变更

```typescript
import { changeTracker } from '@/services/change-tracker'
import { OperationType } from '@/types/sync'

// 在数据变更时自动记录
await changeTracker.trackChange({
  operation: OperationType.UPDATE,
  entityType: 'emoji',
  entityId: 'emoji-123',
  changes: [
    {
      field: 'name',
      oldValue: 'old name',
      newValue: 'new name'
    }
  ]
})
```

### 3. 执行同步

```typescript
import { incrementalSyncService } from '@/services/incremental-sync'

// 增量同步
const result = await incrementalSyncService.sync({
  provider: 'cloudflare',
  conflictStrategy: 'newest-wins'
})

if (result.success) {
  console.log('同步成功！')
} else if (result.conflicts) {
  // 处理冲突
  console.log('检测到冲突，需要手动解决')
}
```

### 4. 处理冲突

```vue
<template>
  <ConflictResolver
    v-if="conflicts.length > 0"
    :conflicts="conflicts"
    @resolved="handleResolved"
    @cancel="handleCancel"
    @continue="handleContinue"
  />
</template>

<script setup>
import ConflictResolver from '@/components/ConflictResolver.vue'
import { ref } from 'vue'

const conflicts = ref([])

async function handleResolved(conflict, resolution) {
  console.log(`冲突 ${conflict.id} 已解决：${resolution}`)
}
</script>
```

## API 文档

### ChangeTracker

#### trackChange(params)

记录数据变更。

**参数：**
- `operation`: 操作类型 (CREATE, UPDATE, DELETE, MOVE, REORDER)
- `entityType`: 实体类型 (emoji, group, settings, favorites)
- `entityId`: 实体 ID
- `changes`: 变更内容数组
- `immediate`: 是否立即写入 (可选，默认批量)

**返回：** `Promise<void>`

**示例：**
```typescript
await changeTracker.trackChange({
  operation: OperationType.CREATE,
  entityType: 'emoji',
  entityId: 'new-emoji-123',
  changes: [{
    field: 'emojis',
    oldValue: null,
    newValue: { id: 'new-emoji-123', name: 'New Emoji', url: '...' }
  }]
})
```

#### flush()

手动触发批量写入。

**返回：** `Promise<void>`

#### getStats()

获取统计信息。

**返回：** `Promise<{ currentVersion, deviceId, totalRecords, pendingBatch }>`

### IncrementalSyncService

#### sync(options)

执行同步操作。

**参数：**
- `provider`: 同步提供商 (cloudflare, chrome)
- `fullSync`: 是否强制全量同步 (可选)
- `conflictStrategy`: 冲突解决策略 (可选)

**返回：** `Promise<SyncResult>`

**示例：**
```typescript
const result = await incrementalSyncService.sync({
  provider: 'cloudflare',
  conflictStrategy: 'auto'
})
```

#### getSyncState()

获取当前同步状态。

**返回：** `SyncState`

#### getStats()

获取同步统计信息。

**返回：** `Promise<{ localVersion, remoteVersion, pendingChanges, unresolvedConflicts }>`

### ConflictResolver

#### detectConflicts(localDeltas, remoteDeltas)

检测冲突。

**参数：**
- `localDeltas`: 本地变更数组
- `remoteDeltas`: 远程变更数组

**返回：** `ConflictInfo[]`

#### autoResolve(conflicts, strategy)

自动解决冲突。

**参数：**
- `conflicts`: 冲突数组
- `strategy`: 解决策略 (auto, manual, local-first, remote-first, newest-wins)

**返回：** `Promise<ConflictInfo[]>`

#### manualResolve(conflictId, resolution, mergedData?)

手动解决冲突。

**参数：**
- `conflictId`: 冲突 ID
- `resolution`: 解决方案 (local, remote, merged)
- `mergedData`: 合并后的数据 (可选)

**返回：** `Promise<void>`

#### threeWayMerge(base, local, remote, entityType)

三方合并。

**参数：**
- `base`: 基础版本
- `local`: 本地版本
- `remote`: 远程版本
- `entityType`: 实体类型

**返回：** `Promise<MergeResult>`

## 冲突解决策略

### 1. auto (自动)

尝试智能合并，失败则使用最新的版本。

**适用场景：**
- 大部分常规同步
- 非关键数据

### 2. manual (手动)

检测到冲突时暂停同步，等待用户手动解决。

**适用场景：**
- 重要数据修改
- 需要人工判断的情况

### 3. local-first (本地优先)

始终使用本地版本。

**适用场景：**
- 离线编辑后的首次同步
- 确信本地数据正确

### 4. remote-first (远程优先)

始终使用远程版本。

**适用场景：**
- 从云端恢复数据
- 多设备间以服务器为准

### 5. newest-wins (最新优先)

比较时间戳，使用最新的版本。

**适用场景：**
- 默认策略
- 大部分场景的合理选择

## 最佳实践

### 1. 合理设置同步频率

```typescript
// 不要过于频繁同步
let syncTimer: NodeJS.Timeout | null = null

function scheduleSyncfunction scheduleSync() {
  if (syncTimer) clearTimeout(syncTimer)
  
  syncTimer = setTimeout(async () => {
    await incrementalSyncService.sync({
      provider: 'cloudflare',
      conflictStrategy: 'newest-wins'
    })
  }, 60000) // 每分钟最多同步一次
}
```

### 2. 批量操作使用批处理

```typescript
import { useEmojiStore } from '@/stores/emojiStore'

const store = useEmojiStore()

// 开始批处理
store.beginBatch()

try {
  // 批量添加 emoji
  for (const emoji of emojis) {
    store.addEmojiWithoutSave(groupId, emoji)
  }
} finally {
  // 结束批处理，触发一次性保存和同步
  await store.endBatch()
}
```

### 3. 处理离线场景

```typescript
import { offlineQueue } from '@/services/offline-queue'

// 监听网络状态
window.addEventListener('online', async () => {
  console.log('网络已恢复，开始同步离线变更')
  await offlineQueue.processQueue()
})

// 检查队列状态
const status = offlineQueue.getStatus()
if (status.queueLength > 0) {
  console.log(`有 ${status.queueLength} 个变更待同步`)
}
```

### 4. 定期清理旧记录

```typescript
import { changeTracker } from '@/services/change-tracker'

// 每周清理一次超过 30 天的记录
setInterval(async () => {
  const removed = await changeTracker.cleanupOldRecords(30)
  console.log(`清理了 ${removed} 条旧记录`)
}, 7 * 24 * 60 * 60 * 1000)
```

### 5. 监控同步状态

```typescript
import { incrementalSyncService } from '@/services/incremental-sync'

// 定期检查同步状态
setInterval(async () => {
  const stats = await incrementalSyncService.getStats()
  
  if (stats.unresolvedConflicts > 0) {
    console.warn(`有 ${stats.unresolvedConflicts} 个未解决的冲突`)
  }
  
  if (stats.pendingChanges > 100) {
    console.warn(`有 ${stats.pendingChanges} 个待同步变更`)
  }
}, 60000)
```

## 故障排除

### 问题：同步失败

**可能原因：**
1. 网络连接问题
2. 远程存储配置错误
3. 权限不足

**解决方案：**
```typescript
const result = await incrementalSyncService.sync({
  provider: 'cloudflare',
  conflictStrategy: 'newest-wins'
})

if (!result.success) {
  console.error('同步失败：', result.error)
  
  // 检查网络
  if (!navigator.onLine) {
    console.log('网络离线，变更已加入队列')
  }
  
  // 检查配置
  const config = cloudflareSyncService.getConfig()
  if (!config) {
    console.error('未配置同步服务')
  }
}
```

### 问题：冲突无法自动解决

**可能原因：**
1. 相同字段被不同设备修改
2. 冲突解决策略不适合

**解决方案：**
```typescript
// 使用手动解决策略
const result = await incrementalSyncService.sync({
  provider: 'cloudflare',
  conflictStrategy: 'manual'
})

if (result.conflicts && result.conflicts.length > 0) {
  // 显示冲突解决界面
  showConflictResolver(result.conflicts)
}
```

### 问题：IndexedDB 错误

**可能原因：**
1. 浏览器不支持 IndexedDB
2. 存储空间不足
3. 隐私模式限制

**解决方案：**
```typescript
try {
  const db = new SyncDatabase()
  await db.open()
} catch (error) {
  console.error('IndexedDB 初始化失败：', error)
  
  // 降级到 localStorage
  // 或提示用户启用 IndexedDB
}
```

### 问题：变更记录过多

**可能原因：**
1. 长时间未清理
2. 频繁的小变更

**解决方案：**
```typescript
// 定期清理
await changeTracker.cleanupOldRecords(7) // 只保留 7 天

// 或手动清理
const stats = await changeTracker.getStats()
if (stats.totalRecords > 10000) {
  await changeTracker.cleanupOldRecords(7)
}
```

## 高级用法

### 自定义冲突解决策略

```typescript
import { conflictResolver } from '@/services/conflict-resolver'

async function customResolve(conflict: ConflictInfo): Promise<'local' | 'remote' | 'merged'> {
  // 自定义逻辑
  if (conflict.entityType === 'settings') {
    // 设置总是使用最新的
    return conflict.localChange.timestamp > conflict.remoteChange.timestamp 
      ? 'local' 
      : 'remote'
  }
  
  if (conflict.entityType === 'emoji') {
    // Emoji 尝试合并
    const mergeResult = await conflictResolver.threeWayMerge(
      baseData,
      conflict.localChange,
      conflict.remoteChange,
      'emoji'
    )
    
    return mergeResult.success ? 'merged' : 'local'
  }
  
  return 'local'
}
```

### 实现自定义同步提供商

```typescript
import type { SyncOptions, SyncResult, DeltaRecord } from '@/types/sync'

class CustomSyncProvider {
  async push(deltas: DeltaRecord[]): Promise<void> {
    // 实现推送逻辑
  }
  
  async pull(sinceVersion: number): Promise<DeltaRecord[]> {
    // 实现拉取逻辑
  }
  
  async getRemoteVersion(): Promise<number> {
    // 实现版本获取逻辑
  }
}
```

## 性能优化

### 1. 批量写入

变更跟踪器默认使用 100ms 的批量延迟，可以根据需要调整：

```typescript
// 在 change-tracker.ts 中
private scheduleBatchWrite() {
  this.batchTimeout = window.setTimeout(async () => {
    await this.flushBatch()
  }, 50) // 减少到 50ms 以提高响应速度
}
```

### 2. 索引优化

确保 IndexedDB 的索引设置合理：

```typescript
// 在 sync-db.ts 中
this.version(1).stores({
  deltaRecords: 'id, timestamp, version, [entityType+entityId]',
  // 添加复合索引以提高查询性能
})
```

### 3. 数据压缩

对于大量变更，可以考虑压缩：

```typescript
import pako from 'pako'

function compressDeltas(deltas: DeltaRecord[]): Uint8Array {
  const json = JSON.stringify(deltas)
  return pako.deflate(json)
}

function decompressDeltas(compressed: Uint8Array): DeltaRecord[] {
  const json = pako.inflate(compressed, { to: 'string' })
  return JSON.parse(json)
}
```

## 安全考虑

### 1. 数据加密

```typescript
// 对敏感数据加密
import CryptoJS from 'crypto-js'

function encryptData(data: any, key: string): string {
  return CryptoJS.AES.encrypt(JSON.stringify(data), key).toString()
}

function decryptData(encrypted: string, key: string): any {
  const bytes = CryptoJS.AES.decrypt(encrypted, key)
  return JSON.parse(bytes.toString(CryptoJS.enc.Utf8))
}
```

### 2. 权限验证

```typescript
// 验证用户权限
async function syncWithAuth(options: SyncOptions) {
  const token = await getAuthToken()
  
  if (!token) {
    throw new Error('未授权')
  }
  
  return await incrementalSyncService.sync(options)
}
```

## 许可证

MIT License
