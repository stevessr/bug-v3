/**
 * 自动下载管理器
 * 负责检测图片 URL 并自动下载匹配指定后缀的图片
 * 支持跨页面状态共享和下载历史记录
 */

class AutoDownloadManager {
  private settings: {
    enableAutoDownload: boolean
    autoDownloadSuffixes: string[]
  }
  private readonly DOWNLOAD_HISTORY_KEY = 'x-autodownload-history'
  private readonly HISTORY_EXPIRY_TIME = 24 * 60 * 60 * 1000 // 24小时

  constructor() {
    this.settings = this.loadSettings()
    this.cleanExpiredHistory()
  }

  private loadSettings() {
    const stored = localStorage.getItem('x-autodownload-settings')
    if (stored) {
      try {
        return JSON.parse(stored)
      } catch {
        // 如果解析失败，使用默认值
      }
    }
    return {
      enableAutoDownload: false,
      autoDownloadSuffixes: ['name=large', 'name=orig']
    }
  }

  private cleanExpiredHistory() {
    try {
      const historyData = localStorage.getItem(this.DOWNLOAD_HISTORY_KEY)
      if (!historyData) return

      const history = JSON.parse(historyData)
      const now = Date.now()
      const cleanedHistory: Record<string, number> = {}

      for (const [url, timestamp] of Object.entries(history)) {
        if (now - (timestamp as number) < this.HISTORY_EXPIRY_TIME) {
          cleanedHistory[url] = timestamp as number
        }
      }

      localStorage.setItem(this.DOWNLOAD_HISTORY_KEY, JSON.stringify(cleanedHistory))
    } catch (error) {
      console.error('[AutoDownloadManager] Failed to clean history:', error)
    }
  }

  private addToHistory(url: string) {
    try {
      const historyData = localStorage.getItem(this.DOWNLOAD_HISTORY_KEY)
      const history = historyData ? JSON.parse(historyData) : {}
      history[url] = Date.now()
      localStorage.setItem(this.DOWNLOAD_HISTORY_KEY, JSON.stringify(history))
    } catch (error) {
      console.error('[AutoDownloadManager] Failed to add to history:', error)
    }
  }

  private isInHistory(url: string): boolean {
    try {
      const historyData = localStorage.getItem(this.DOWNLOAD_HISTORY_KEY)
      if (!historyData) return false

      const history = JSON.parse(historyData)
      const timestamp = history[url]
      if (!timestamp) return false

      // 检查是否过期
      const now = Date.now()
      if (now - timestamp < this.HISTORY_EXPIRY_TIME) {
        return true
      } else {
        // 移除过期记录
        delete history[url]
        localStorage.setItem(this.DOWNLOAD_HISTORY_KEY, JSON.stringify(history))
        return false
      }
    } catch (error) {
      console.error('[AutoDownloadManager] Failed to check history:', error)
      return false
    }
  }

  private shouldDownload(url: string): boolean {
    if (!this.settings.enableAutoDownload) {
      return false
    }

    if (this.isInHistory(url)) {
      return false
    }

    return this.settings.autoDownloadSuffixes.some(suffix => url.includes(suffix))
  }

  async triggerAutoDownload(imageUrl: string) {
    if (!this.shouldDownload(imageUrl)) {
      return
    }

    try {
      this.addToHistory(imageUrl)

      // 发送下载消息到后台脚本
      const response = await new Promise<any>((resolve) => {
        chrome.runtime.sendMessage(
          {
            type: 'downloadImage',
            url: imageUrl,
            source: 'auto-download'
          },
          (result) => {
            if (chrome.runtime.lastError) {
              console.error('[AutoDownloadManager] Download failed:', chrome.runtime.lastError)
              resolve(null)
            } else {
              resolve(result)
            }
          }
        )
      })

      if (response && response.success) {
        console.log(`[AutoDownloadManager] Auto-downloaded: ${imageUrl}`)
      } else {
        console.warn(`[AutoDownloadManager] Download failed for: ${imageUrl}`)
      }
    } catch (error) {
      console.error('[AutoDownloadManager] Error triggering auto-download:', error)
    }
  }

  // 清除下载历史
  clearHistory() {
    try {
      localStorage.removeItem(this.DOWNLOAD_HISTORY_KEY)
      console.log('[AutoDownloadManager] Download history cleared')
    } catch (error) {
      console.error('[AutoDownloadManager] Failed to clear history:', error)
    }
  }

  // 获取下载历史
  getHistory(): Record<string, number> {
    try {
      const historyData = localStorage.getItem(this.DOWNLOAD_HISTORY_KEY)
      return historyData ? JSON.parse(historyData) : {}
    } catch (error) {
      console.error('[AutoDownloadManager] Failed to get history:', error)
      return {}
    }
  }
}

// 创建单例实例
export const autoDownloadManager = new AutoDownloadManager()
