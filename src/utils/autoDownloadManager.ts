/**
 * 自动下载管理器
 * 监控图片 URL，当匹配特定后缀时自动下载
 * 维护已下载 URL 列表，防止重复下载
 */

export interface AutoDownloadConfig {
  enabled: boolean
  suffixes: string[] // 需要监控的 URL 后缀，如 'name=large', 'name=orig'
}

class AutoDownloadManager {
  private downloadedUrls = new Set<string>()
  private config: AutoDownloadConfig = {
    enabled: false,
    suffixes: []
  }
  private initPromise: Promise<void> | null = null

  /**
   * 懒加载初始化配置
   */
  private initialize(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise
    }

    this.initPromise = (async () => {
      try {
        const result = await chrome.storage.local.get(['settings'])
        if (result.settings) {
          const { enableAutoDownload, autoDownloadSuffixes } = result.settings
          this.updateConfig({
            enabled: enableAutoDownload ?? false,
            suffixes: autoDownloadSuffixes ?? ['name=large', 'name=orig']
          })
        }
        console.log('[AutoDownload] Initialized with config:', this.getConfig())

        // 监听配置变化
        chrome.storage.onChanged.addListener((changes, areaName) => {
          if (areaName === 'local' && changes.settings) {
            const newSettings = changes.settings.newValue
            if (newSettings) {
              this.updateConfig({
                enabled: newSettings.enableAutoDownload ?? false,
                suffixes: newSettings.autoDownloadSuffixes ?? ['name=large', 'name=orig']
              })
            }
          }
        })
      } catch (err) {
        console.error('[AutoDownload] Failed to initialize:', err)
      }
    })()

    return this.initPromise
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<AutoDownloadConfig>) {
    this.config = { ...this.config, ...config }
    console.log('[AutoDownload] Config updated:', this.config)
  }

  /**
   * 获取当前配置
   */
  getConfig(): AutoDownloadConfig {
    return { ...this.config }
  }

  /**
   * 检查 URL 是否应该自动下载
   */
  async shouldAutoDownload(url: string): Promise<boolean> {
    await this.initialize()

    if (!this.config.enabled) {
      return false
    }

    // 检查是否已经下载过
    if (this.downloadedUrls.has(url)) {
      return false
    }

    // 检查 URL 是否匹配任何配置的后缀
    return this.config.suffixes.some(suffix => url.includes(suffix))
  }

  /**
   * 标记 URL 已下载
   */
  markAsDownloaded(url: string) {
    this.downloadedUrls.add(url)
    console.log('[AutoDownload] Marked as downloaded:', url)
  }

  /**
   * 检查 URL 是否已下载
   */
  isDownloaded(url: string): boolean {
    return this.downloadedUrls.has(url)
  }

  /**
   * 清除已下载记录
   */
  clearDownloadHistory() {
    const count = this.downloadedUrls.size
    this.downloadedUrls.clear()
    console.log(`[AutoDownload] Cleared ${count} download records`)
  }

  /**
   * 获取已下载数量
   */
  getDownloadedCount(): number {
    return this.downloadedUrls.size
  }

  /**
   * 获取已下载的 URL 列表
   */
  getDownloadedUrls(): string[] {
    return Array.from(this.downloadedUrls)
  }

  /**
   * 触发自动下载（如果 URL 匹配）
   * 这是自动下载的主要入口点
   */
  async triggerAutoDownload(url: string, onDownloaded?: (url: string) => void): Promise<boolean> {
    await this.initialize()
    if (!(await this.shouldAutoDownload(url))) {
      return false
    }

    try {
      console.log('[AutoDownload] Starting auto-download:', url)
      const filename = this.extractFilenameFromUrl(url) || `image-${Date.now()}.jpg`

      // 尝试使用 fetch 下载
      try {
        const response = await fetch(url)
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }
        const blob = await response.blob()
        const blobUrl = URL.createObjectURL(blob)

        const a = document.createElement('a')
        a.href = blobUrl
        a.download = filename
        a.style.display = 'none'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        setTimeout(() => URL.revokeObjectURL(blobUrl), 5000)

        this.markAsDownloaded(url)
        onDownloaded?.(url)
        console.log('[AutoDownload] Successfully auto-downloaded:', filename)
        return true
      } catch (fetchError) {
        console.warn('[AutoDownload] Fetch failed, using fallback:', fetchError)
        window.open(url, '_blank')
        this.markAsDownloaded(url)
        onDownloaded?.(url)
        return true
      }
    } catch (error) {
      console.error('[AutoDownload] Failed to auto-download:', url, error)
      return false
    }
  }

  /**
   * 从 URL 中提取文件名
   */
  private extractFilenameFromUrl(url: string): string | null {
    try {
      const urlObj = new URL(url)
      const pathname = urlObj.pathname
      const parts = pathname.split('/')
      let filename = parts[parts.length - 1]

      // 如果文件名为空或太短，尝试使用 URL 参数
      if (!filename || filename.length < 3) {
        const format = urlObj.searchParams.get('format')
        const name = urlObj.searchParams.get('name')
        if (format) {
          filename = `image-${Date.now()}.${format}`
        } else if (name) {
          filename = `image-${name}-${Date.now()}.jpg`
        }
      }

      // 确保有扩展名
      if (filename && !filename.includes('.')) {
        const format = urlObj.searchParams.get('format') || 'jpg'
        filename += `.${format}`
      }

      return filename
    } catch {
      return null
    }
  }

  /**
   * 批量检测并下载图片
   */
  async processBatch(urls: string[]): Promise<{ success: number; failed: number }> {
    await this.initialize()
    const results = { success: 0, failed: 0 }

    for (const url of urls) {
      // triggerAutoDownload 返回 true 表示成功，false 表示跳过或失败
      const success = await this.triggerAutoDownload(url)
      if (success) {
        results.success++
      }
      // 添加小延迟避免并发下载过多
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    return results
  }
}

// 导出单例
export const autoDownloadManager = new AutoDownloadManager()
