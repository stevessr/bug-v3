import { DOA, createE } from '../../utils/dom/createEl'

/**
 * X.com 图片自动下载管理器
 * 根据配置的 URL 后缀自动下载图片
 */

const STORAGE_KEY = 'x-autodownload-settings'
const HISTORY_KEY = 'x-autodownload-history'
const HISTORY_EXPIRY_TIME = 24 * 60 * 60 * 1000 // 24 hours

export interface AutoDownloadSettings {
  enableAutoDownload: boolean
  autoDownloadSuffixes: string[]
}

const DEFAULT_SETTINGS: AutoDownloadSettings = {
  enableAutoDownload: false,
  autoDownloadSuffixes: ['name=large', 'name=4096x4096']
}

/**
 * 发送消息到 background script
 */
function sendMessageToBackground(message: any): Promise<any> {
  return new Promise(resolve => {
    try {
      if (
        (window as any).chrome &&
        (window as any).chrome.runtime &&
        (window as any).chrome.runtime.sendMessage
      ) {
        ;(window as any).chrome.runtime.sendMessage(message, (response: any) => {
          resolve(response)
        })
      } else {
        resolve({ success: false, error: 'chrome.runtime.sendMessage not available' })
      }
    } catch (e) {
      resolve({ success: false, error: e instanceof Error ? e.message : String(e) })
    }
  })
}

/**
 * 升级 URL 质量：将 medium 替换为 large
 * 例如：name=medium -> name=large
 */
function upgradeImageQuality(url: string): string {
  try {
    const u = new URL(url)
    const name = u.searchParams.get('name')
    if (name === 'medium') {
      u.searchParams.set('name', 'large')
      return u.toString()
    }
  } catch {
    // 如果 URL 解析失败，尝试简单字符串替换
    if (url.includes('name=medium')) {
      return url.replace('name=medium', 'name=large')
    }
  }
  return url
}

/**
 * 规范化 URL
 */
function normalizeUrl(raw: string): string | null {
  if (!raw) return null
  raw = raw.trim()

  // 从 CSS url() 格式中提取
  const urlMatch = raw.match(/url\((?:\s*['"]?)(.*?)(?:['"]?\s*)\)/)
  if (urlMatch) raw = urlMatch[1]

  // 处理协议
  if (raw.startsWith('//')) raw = 'https:' + raw
  else if (raw.startsWith('/')) raw = window.location.origin + raw

  // 清理 URL
  if (raw.includes(',')) raw = raw.split(',')[0]
  raw = raw.split(' ')[0]
  raw = raw.replace(/:large$|:orig$/i, '')

  if (!/^https?:\/\//i.test(raw)) return null

  // 验证是 Twitter/X 的域名
  try {
    const u = new URL(raw)
    const host = u.hostname.toLowerCase()
    const allowed = ['pbs.twimg.com', 'twimg.com', 'twitter.com', 'x.com']
    const ok = allowed.some(a => host.endsWith(a) || host.includes(a))
    if (!ok) return null
  } catch {
    return null
  }

  // 自动升级图片质量：medium -> large
  raw = upgradeImageQuality(raw)

  return raw
}

/**
 * Toast 容器管理
 */
let toastContainer: HTMLElement | null = null

function getToastContainer() {
  if (!toastContainer) {
    toastContainer = createE('div', {
      style: `
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      flex-direction: column-reverse;
      align-items: center;
      gap: 10px;
      z-index: 10000;
      pointer-events: none;
    `
    })
    DOA(toastContainer)
  }
  return toastContainer
}

/**
 * 显示 Toast 提示（支持多条堆叠）
 */
function showToast(message: string, type: 'success' | 'error' = 'success') {
  const container = getToastContainer()
  const toast = createE('div', {
    text: message,
    style: `
    background: ${type === 'success' ? 'rgba(29, 155, 240, 0.9)' : 'rgba(244, 33, 46, 0.9)'};
    color: white;
    padding: 10px 20px;
    border-radius: 20px;
    font-size: 14px;
    font-weight: 500;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    opacity: 0;
    transform: translateY(20px);
    transition: all 0.3s ease;
    white-space: nowrap;
    max-width: 80vw;
    overflow: hidden;
    text-overflow: ellipsis;
  `
  })

  container.appendChild(toast)

  // 动画进入
  requestAnimationFrame(() => {
    toast.style.opacity = '1'
    toast.style.transform = 'translateY(0)'
  })

  // 3 秒后消失
  setTimeout(() => {
    toast.style.opacity = '0'
    toast.style.transform = 'translateY(20px)'
    setTimeout(() => {
      toast.remove()
      // 如果容器空了，清理容器
      if (container.childNodes.length === 0) {
        container.remove()
        toastContainer = null
      }
    }, 300)
  }, 3000)
}

export class AutoDownloadManager {
  private settings: AutoDownloadSettings = { ...DEFAULT_SETTINGS }
  private history: Map<string, number> = new Map()
  private initialized = false

  async init(): Promise<void> {
    if (this.initialized) return
    this.initialized = true

    await this.loadSettings()
    await this.loadHistory()
    this.cleanExpiredHistory()
  }

  private async loadSettings(): Promise<void> {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        // 支持新格式 { data: {...}, timestamp } 和旧格式
        const data = parsed.data || parsed
        this.settings = {
          enableAutoDownload: data.enableAutoDownload ?? DEFAULT_SETTINGS.enableAutoDownload,
          autoDownloadSuffixes: Array.isArray(data.autoDownloadSuffixes)
            ? data.autoDownloadSuffixes
            : DEFAULT_SETTINGS.autoDownloadSuffixes
        }
      }
    } catch (error) {
      console.warn('[AutoDownloadManager] Failed to load settings:', error)
    }
  }

  private async loadHistory(): Promise<void> {
    try {
      const stored = localStorage.getItem(HISTORY_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        const data = parsed.data || parsed
        if (typeof data === 'object') {
          this.history = new Map(Object.entries(data))
        }
      }
    } catch (error) {
      console.warn('[AutoDownloadManager] Failed to load history:', error)
    }
  }

  private async saveSettings(): Promise<void> {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          data: this.settings,
          timestamp: Date.now()
        })
      )
    } catch (error) {
      console.warn('[AutoDownloadManager] Failed to save settings:', error)
    }
  }

  private async saveHistory(): Promise<void> {
    try {
      localStorage.setItem(
        HISTORY_KEY,
        JSON.stringify({
          data: Object.fromEntries(this.history),
          timestamp: Date.now()
        })
      )
    } catch (error) {
      console.warn('[AutoDownloadManager] Failed to save history:', error)
    }
  }

  private cleanExpiredHistory(): void {
    const now = Date.now()
    let changed = false

    for (const [url, timestamp] of this.history.entries()) {
      if (now - timestamp >= HISTORY_EXPIRY_TIME) {
        this.history.delete(url)
        changed = true
      }
    }

    if (changed) {
      this.saveHistory()
    }
  }

  private isInHistory(url: string): boolean {
    const timestamp = this.history.get(url)
    if (!timestamp) return false

    if (Date.now() - timestamp < HISTORY_EXPIRY_TIME) {
      return true
    }

    this.history.delete(url)
    this.saveHistory()
    return false
  }

  private addToHistory(url: string): void {
    this.history.set(url, Date.now())
    this.saveHistory()
  }

  getSettings(): AutoDownloadSettings {
    return { ...this.settings }
  }

  async updateSettings(key: keyof AutoDownloadSettings, value: any): Promise<void> {
    ;(this.settings as any)[key] = value
    await this.saveSettings()
  }

  shouldDownload(url: string): boolean {
    if (!this.settings.enableAutoDownload) return false
    if (this.isInHistory(url)) return false

    const suffixes = this.settings.autoDownloadSuffixes
    if (!Array.isArray(suffixes) || suffixes.length === 0) return false

    const decodedUrl = decodeURIComponent(url)
    return suffixes.some(suffix => suffix && decodedUrl.includes(suffix))
  }

  async triggerAutoDownload(imageUrl: string): Promise<void> {
    if (!this.shouldDownload(imageUrl)) return

    console.log(`[AutoDownloadManager] Triggering download for: ${imageUrl}`)
    this.addToHistory(imageUrl)

    // 发送消息给 background 处理下载
    const response = await sendMessageToBackground({
      type: 'DOWNLOAD_IMAGE',
      url: imageUrl,
      source: 'x-auto-download'
    })

    if (response?.success) {
      console.log(`[AutoDownloadManager] Download started: ${imageUrl}`)
      // 提取文件名用于显示
      let displayFilename = 'image'
      try {
        const u = new URL(imageUrl)
        const pathname = u.pathname
        const name = pathname.split('/').pop()
        if (name) displayFilename = name
      } catch {
        /* ignore */
      }
      showToast(`Started: ${displayFilename}`, 'success')
    } else {
      console.error(`[AutoDownloadManager] Download failed: ${imageUrl}`, response?.error)
      showToast('Download failed', 'error')
    }
  }

  /**
   * 检查单个图片并触发下载
   */
  checkImage(img: HTMLImageElement): void {
    const src = img.src
    if (!src) return

    const normalized = normalizeUrl(src)
    if (normalized) {
      this.triggerAutoDownload(normalized)
    }
  }

  /**
   * 检查元素及其子元素中的所有图片
   */
  checkForImages(root: Element | Document): void {
    const imgs = root.querySelectorAll('img')
    imgs.forEach(img => this.checkImage(img as HTMLImageElement))

    if ((root as HTMLElement).tagName === 'IMG') {
      this.checkImage(root as HTMLImageElement)
    }
  }
}

// 单例
let managerInstance: AutoDownloadManager | null = null

export function getAutoDownloadManager(): AutoDownloadManager {
  if (!managerInstance) {
    managerInstance = new AutoDownloadManager()
  }
  return managerInstance
}
