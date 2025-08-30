// State management for cached emoji data
import type { ContentState } from './types'

export const cachedState: ContentState = {
  emojiGroups: [],
  settings: {
    imageScale: 30,
    defaultEmojiGroupUUID: 'default-uuid',
    gridColumns: 4,
    outputFormat: 'markdown',
    MobileMode: false,
    sidebarCollapsed: false,
    lastModified: new Date(),
  },
  ungroupedEmojis: [],
}

// 激进缓存管理系统
export interface CacheManager {
  // 组级别缓存状态
  groupCache: Map<
    string,
    {
      data: any
      lastUpdate: number
      version: number
    }
  >

  // 常用表情组缓存
  commonGroupCache: {
    data: any | null
    lastUpdate: number
    version: number
  }

  // 未分组表情缓存
  ungroupedCache: {
    data: any[]
    lastUpdate: number
    version: number
  }

  // 设置缓存
  settingsCache: {
    data: any
    lastUpdate: number
    version: number
  }

  // 缓存统计
  stats: {
    hitCount: number
    missCount: number
    lastHit: number
    lastMiss: number
  }

  // 更新模式
  isAggressiveMode: boolean

  // 最后一次全量更新时间
  lastFullUpdate: number
}

// 创建缓存管理器实例
export const cacheManager: CacheManager = {
  groupCache: new Map(),
  commonGroupCache: {
    data: null,
    lastUpdate: 0,
    version: 0,
  },
  ungroupedCache: {
    data: [],
    lastUpdate: 0,
    version: 0,
  },
  settingsCache: {
    data: {},
    lastUpdate: 0,
    version: 0,
  },
  stats: {
    hitCount: 0,
    missCount: 0,
    lastHit: 0,
    lastMiss: 0,
  },
  isAggressiveMode: true, // 启用激进缓存模式
  lastFullUpdate: 0,
}

// 缓存操作工具函数
export const cacheUtils = {
  // 更新特定组缓存
  updateGroupCache(groupUUID: string, data: any) {
    const now = Date.now()
    const currentCache = cacheManager.groupCache.get(groupUUID)
    cacheManager.groupCache.set(groupUUID, {
      data,
      lastUpdate: now,
      version: (currentCache?.version || 0) + 1,
    })
    console.log(
      `[缓存] 更新表情组缓存: ${groupUUID}, 版本: ${cacheManager.groupCache.get(groupUUID)?.version}`,
    )
  },

  // 更新常用表情组缓存
  updateCommonGroupCache(data: any) {
    const now = Date.now()
    cacheManager.commonGroupCache = {
      data,
      lastUpdate: now,
      version: cacheManager.commonGroupCache.version + 1,
    }
    console.log(`[缓存] 更新常用表情组缓存, 版本: ${cacheManager.commonGroupCache.version}`)
  },

  // 更新未分组缓存
  updateUngroupedCache(data: any[]) {
    const now = Date.now()
    cacheManager.ungroupedCache = {
      data,
      lastUpdate: now,
      version: cacheManager.ungroupedCache.version + 1,
    }
    console.log(`[缓存] 更新未分组缓存, 版本: ${cacheManager.ungroupedCache.version}`)
  },

  // 更新设置缓存
  updateSettingsCache(data: any) {
    const now = Date.now()
    cacheManager.settingsCache = {
      data: { ...cacheManager.settingsCache.data, ...data },
      lastUpdate: now,
      version: cacheManager.settingsCache.version + 1,
    }
    console.log(`[缓存] 更新设置缓存, 版本: ${cacheManager.settingsCache.version}`)
  },

  // 获取组缓存
  getGroupCache(groupUUID: string) {
    const cache = cacheManager.groupCache.get(groupUUID)
    if (cache) {
      cacheManager.stats.hitCount++
      cacheManager.stats.lastHit = Date.now()
      console.log(`[缓存] 命中表情组缓存: ${groupUUID}`)
      return cache.data
    }
    cacheManager.stats.missCount++
    cacheManager.stats.lastMiss = Date.now()
    console.log(`[缓存] 未命中表情组缓存: ${groupUUID}`)
    return null
  },

  // 获取常用表情组缓存
  getCommonGroupCache() {
    if (cacheManager.commonGroupCache.data) {
      cacheManager.stats.hitCount++
      cacheManager.stats.lastHit = Date.now()
      console.log(`[缓存] 命中常用表情组缓存`)
      return cacheManager.commonGroupCache.data
    }
    cacheManager.stats.missCount++
    cacheManager.stats.lastMiss = Date.now()
    console.log(`[缓存] 未命中常用表情组缓存`)
    return null
  },

  // 获取所有缓存的表情组
  getAllCachedGroups() {
    const groups = []

    // 添加常用表情组（如果存在）
    if (cacheManager.commonGroupCache.data) {
      groups.push(cacheManager.commonGroupCache.data)
    }

    // 添加其他表情组
    for (const [uuid, cache] of cacheManager.groupCache.entries()) {
      if (uuid !== 'common-emoji-group') {
        groups.push(cache.data)
      }
    }

    return groups
  },

  // 清空特定组缓存
  clearGroupCache(groupUUID: string) {
    cacheManager.groupCache.delete(groupUUID)
    console.log(`[缓存] 清除表情组缓存: ${groupUUID}`)
  },

  // 清空所有缓存
  clearAllCache() {
    cacheManager.groupCache.clear()
    cacheManager.commonGroupCache = { data: null, lastUpdate: 0, version: 0 }
    cacheManager.ungroupedCache = { data: [], lastUpdate: 0, version: 0 }
    cacheManager.settingsCache = { data: {}, lastUpdate: 0, version: 0 }
    console.log('[缓存] 清除所有缓存')
  },

  // 获取缓存统计
  getCacheStats() {
    const totalGroups = cacheManager.groupCache.size + (cacheManager.commonGroupCache.data ? 1 : 0)
    const hitRate =
      cacheManager.stats.hitCount / (cacheManager.stats.hitCount + cacheManager.stats.missCount) ||
      0

    return {
      totalGroups,
      hitCount: cacheManager.stats.hitCount,
      missCount: cacheManager.stats.missCount,
      hitRate: Math.round(hitRate * 100),
      lastHit: cacheManager.stats.lastHit,
      lastMiss: cacheManager.stats.lastMiss,
      isAggressiveMode: cacheManager.isAggressiveMode,
    }
  },

  // 设置激进模式
  setAggressiveMode(enabled: boolean) {
    cacheManager.isAggressiveMode = enabled
    console.log(`[缓存] 激进缓存模式: ${enabled ? '启用' : '禁用'}`)
  },
}
