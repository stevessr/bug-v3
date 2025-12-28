import { STORAGE_KEYS } from '@/utils/simpleStorage'

/**
 * Chrome 同步管理 Composable
 * 负责 Chrome Extension 存储同步操作
 */
export function useSyncManager(options: {
  forceSync: () => Promise<boolean>
  showSuccess: (message: string) => void
  showError: (message: string) => void
}) {
  const { forceSync, showSuccess, showError } = options

  /**
   * 同步数据到 Chrome 同步存储
   */
  const syncToChrome = async () => {
    try {
      const success = await forceSync()
      if (success) {
        showSuccess('数据已上传到 Chrome 同步存储')
      } else {
        showError('同步失败，请检查网络连接')
      }
    } catch {
      showError('同步失败，请重试')
    }
  }

  /**
   * 强制从 localStorage 复制到 chrome.storage.local
   * 用于迁移或恢复数据
   */
  const forceLocalToExtension = async () => {
    try {
      if (typeof localStorage === 'undefined') {
        showError('本地存储不可用')
        return
      }

      const chromeAPI = typeof chrome !== 'undefined' ? chrome : (globalThis as any).chrome
      if (!chromeAPI || !chromeAPI.storage || !chromeAPI.storage.local) {
        showError('扩展存储 API 不可用')
        return
      }

      const keys: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (!key) continue
        if (
          key === STORAGE_KEYS.SETTINGS ||
          key === STORAGE_KEYS.FAVORITES ||
          key === STORAGE_KEYS.GROUP_INDEX ||
          key.startsWith(STORAGE_KEYS.GROUP_PREFIX)
        ) {
          keys.push(key)
        }
      }

      if (keys.length === 0) {
        showError('没有找到需要同步的数据')
        return
      }

      let copied = 0
      const batch: Record<string, unknown> = {}

      for (const key of keys) {
        try {
          const rawValue = localStorage.getItem(key)
          if (rawValue !== null) {
            let parsed: unknown
            try {
              parsed = JSON.parse(rawValue)
            } catch {
              parsed = rawValue
            }
            batch[key] = parsed
            copied++
          }
        } catch (err) {
          console.warn(`[SyncManager] Failed to read localStorage key: ${key}`, err)
        }
      }

      if (copied > 0) {
        await chromeAPI.storage.local.set(batch)
        showSuccess(`已复制 ${copied} 项数据到扩展存储`)
      } else {
        showError('没有数据被复制')
      }
    } catch (err) {
      console.error('[SyncManager] Force local to extension failed:', err)
      showError('数据复制失败')
    }
  }

  /**
   * 从 chrome.storage.local 读取所有数据
   * 用于调试和检查存储状态
   */
  const inspectExtensionStorage = async (): Promise<Record<string, unknown> | null> => {
    try {
      const chromeAPI = typeof chrome !== 'undefined' ? chrome : (globalThis as any).chrome
      if (!chromeAPI || !chromeAPI.storage || !chromeAPI.storage.local) {
        return null
      }

      const allData = await chromeAPI.storage.local.get(null)
      return allData
    } catch (err) {
      console.error('[SyncManager] Inspect extension storage failed:', err)
      return null
    }
  }

  /**
   * 清除扩展存储中的所有数据
   * 危险操作，谨慎使用
   */
  const clearExtensionStorage = async () => {
    try {
      const chromeAPI = typeof chrome !== 'undefined' ? chrome : (globalThis as any).chrome
      if (!chromeAPI || !chromeAPI.storage || !chromeAPI.storage.local) {
        showError('扩展存储 API 不可用')
        return
      }

      await chromeAPI.storage.local.clear()
      showSuccess('扩展存储已清除')
    } catch (err) {
      console.error('[SyncManager] Clear extension storage failed:', err)
      showError('清除存储失败')
    }
  }

  return {
    syncToChrome,
    forceLocalToExtension,
    inspectExtensionStorage,
    clearExtensionStorage
  }
}
