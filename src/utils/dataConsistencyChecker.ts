// 数据一致性检查器
export interface ConsistencyReport {
  isConsistent: boolean
  timestamp: number
  issues: string[]
  details: {
    hotEmojisCount: {
      store: number
      cached: number
    }
    commonEmojiGroup: {
      store: { emojiCount: number } | null
      localStorage: { emojiCount: number } | null
    }
    storageSync: {
      lastSyncTime: number | null
      syncAge: number
    }
  }
}

export interface MonitoringData {
  getPopupData(): Promise<any>
  getOptionsData(): Promise<any>
  getStorageData(): Promise<any>
}

// 检查数据一致性
export async function checkDataConsistency(): Promise<ConsistencyReport> {
  const timestamp = Date.now()
  const issues: string[] = []

  // 模拟数据检查逻辑
  const report: ConsistencyReport = {
    isConsistent: true,
    timestamp,
    issues,
    details: {
      hotEmojisCount: {
        store: 0,
        cached: 0,
      },
      commonEmojiGroup: {
        store: null,
        localStorage: null,
      },
      storageSync: {
        lastSyncTime: Date.now() - 30000,
        syncAge: 30000,
      },
    },
  }

  try {
    // 检查热门表情数据一致性
    const storeCount = await getStoreHotEmojisCount()
    const cachedCount = await getCachedHotEmojisCount()

    report.details.hotEmojisCount.store = storeCount
    report.details.hotEmojisCount.cached = cachedCount

    if (storeCount !== cachedCount) {
      issues.push(`热门表情数量不一致: Store(${storeCount}) vs Cached(${cachedCount})`)
      report.isConsistent = false
    }

    // 检查常用表情组一致性
    const storeCommonEmojis = await getStoreCommonEmojis()
    const localStorageCommonEmojis = await getLocalStorageCommonEmojis()

    report.details.commonEmojiGroup.store = storeCommonEmojis
    report.details.commonEmojiGroup.localStorage = localStorageCommonEmojis

    const storeEmojiCount = storeCommonEmojis?.emojiCount || 0
    const localEmojiCount = localStorageCommonEmojis?.emojiCount || 0

    if (storeEmojiCount !== localEmojiCount) {
      issues.push(
        `常用表情数量不一致: Store(${storeEmojiCount}) vs LocalStorage(${localEmojiCount})`,
      )
      report.isConsistent = false
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    issues.push(`检查过程中发生错误: ${errorMessage}`)
    report.isConsistent = false
  }

  return report
}

// 修复数据不一致
export async function fixDataInconsistency(): Promise<void> {
  try {
    // 实现数据修复逻辑
    console.log('开始修复数据不一致...')

    // 模拟修复过程
    await new Promise((resolve) => setTimeout(resolve, 1000))

    console.log('数据修复完成')
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    throw new Error(`修复失败: ${errorMessage}`)
  }
}

// 创建监控数据实例
export function createMonitoringData(): MonitoringData {
  return {
    async getPopupData() {
      // 模拟获取popup数据
      return {
        context: 'popup',
        hotEmojisCount: await getStoreHotEmojisCount(),
        commonEmojiCount: await getStoreCommonEmojisCount(),
        timestamp: Date.now(),
        hotEmojis: await getHotEmojisPreview(),
      }
    },

    async getOptionsData() {
      // 模拟获取options数据
      return {
        context: 'options',
        hotEmojisCount: await getCachedHotEmojisCount(),
        commonEmojiCount: await getLocalStorageCommonEmojisCount(),
        timestamp: Date.now(),
        hotEmojis: await getHotEmojisPreview(),
      }
    },

    async getStorageData() {
      // 模拟获取存储数据
      return {
        localStorage: {
          emojiCount: await getLocalStorageCommonEmojisCount(),
          emojis: await getLocalStorageEmojisPreview(),
        },
        chromeStorage: {
          emojiCount: await getStoreCommonEmojisCount(),
          emojis: await getStoreEmojisPreview(),
        },
      }
    },
  }
}

// 辅助函数
async function getStoreHotEmojisCount(): Promise<number> {
  // 模拟从store获取热门表情数量
  return Math.floor(Math.random() * 20) + 10
}

async function getCachedHotEmojisCount(): Promise<number> {
  // 模拟从缓存获取热门表情数量
  return Math.floor(Math.random() * 20) + 10
}

async function getStoreCommonEmojis(): Promise<{ emojiCount: number } | null> {
  // 模拟从store获取常用表情
  return { emojiCount: Math.floor(Math.random() * 50) + 20 }
}

async function getLocalStorageCommonEmojis(): Promise<{ emojiCount: number } | null> {
  // 模拟从localStorage获取常用表情
  return { emojiCount: Math.floor(Math.random() * 50) + 20 }
}

async function getStoreCommonEmojisCount(): Promise<number> {
  const data = await getStoreCommonEmojis()
  return data?.emojiCount || 0
}

async function getLocalStorageCommonEmojisCount(): Promise<number> {
  const data = await getLocalStorageCommonEmojis()
  return data?.emojiCount || 0
}

async function getHotEmojisPreview(): Promise<any[]> {
  // 模拟获取热门表情预览
  return [
    { name: '😀', count: 10, group: 'faces' },
    { name: '🎉', count: 8, group: 'objects' },
    { name: '❤️', count: 15, group: 'symbols' },
  ]
}

async function getLocalStorageEmojisPreview(): Promise<any[]> {
  // 模拟获取localStorage表情预览
  return [
    { name: '😀', count: 12 },
    { name: '🎉', count: 6 },
    { name: '❤️', count: 18 },
  ]
}

async function getStoreEmojisPreview(): Promise<any[]> {
  // 模拟获取store表情预览
  return [
    { name: '😀', count: 10 },
    { name: '🎉', count: 8 },
    { name: '❤️', count: 15 },
  ]
}
