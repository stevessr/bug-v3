// 实时UI更新器
import { ref, reactive } from 'vue'

// 刷新状态接口
export interface RefreshStatus {
  isRefreshing: boolean
  lastRefreshTime: number
  refreshCount: number
  errors: string[]
}

// 刷新选项接口
export interface RefreshOptions {
  force?: boolean
  showIndicator?: boolean
  timeout?: number
  retryCount?: number
  onSuccess?: () => void
  onError?: (error: Error) => void
  onComplete?: () => void
}

// UI组件刷新器接口
export interface UIComponentRefresher {
  refresh(): Promise<void>
  canRefresh(): boolean
  getComponentName(): string
}

// 实时UI更新器类
export class RealtimeUIUpdater {
  private refreshers = new Map<string, UIComponentRefresher>()
  private refreshStatus = reactive<RefreshStatus>({
    isRefreshing: false,
    lastRefreshTime: 0,
    refreshCount: 0,
    errors: []
  })
  
  private refreshQueue: Array<{
    componentName: string
    options: RefreshOptions
    resolve: (value: boolean) => void
    reject: (error: Error) => void
  }> = []
  
  private isProcessingQueue = false
  private readonly DEFAULT_TIMEOUT = 5000 // 5秒超时
  private readonly DEFAULT_RETRY_COUNT = 3

  constructor() {
    console.log('[RealtimeUIUpdater] UI更新器已初始化')
  }

  /**
   * 注册UI组件刷新器
   */
  registerRefresher(componentName: string, refresher: UIComponentRefresher): void {
    this.refreshers.set(componentName, refresher)
    console.log(`[RealtimeUIUpdater] 已注册组件刷新器: ${componentName}`)
  }

  /**
   * 取消注册UI组件刷新器
   */
  unregisterRefresher(componentName: string): void {
    this.refreshers.delete(componentName)
    console.log(`[RealtimeUIUpdater] 已取消注册组件刷新器: ${componentName}`)
  }

  /**
   * 强制刷新指定组件
   */
  async forceRefresh(componentName: string, options: RefreshOptions = {}): Promise<boolean> {
    return new Promise((resolve, reject) => {
      // 添加到刷新队列
      this.refreshQueue.push({
        componentName,
        options: {
          force: true,
          showIndicator: true,
          timeout: this.DEFAULT_TIMEOUT,
          retryCount: this.DEFAULT_RETRY_COUNT,
          ...options
        },
        resolve,
        reject
      })

      // 处理队列
      this.processRefreshQueue()
    })
  }

  /**
   * 刷新所有注册的组件
   */
  async refreshAll(options: RefreshOptions = {}): Promise<{ success: number; failed: number; errors: string[] }> {
    console.log('[RealtimeUIUpdater] 开始刷新所有组件')
    
    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[]
    }

    const refreshPromises = Array.from(this.refreshers.keys()).map(async (componentName) => {
      try {
        const success = await this.forceRefresh(componentName, options)
        if (success) {
          results.success++
        } else {
          results.failed++
          results.errors.push(`组件 ${componentName} 刷新失败`)
        }
      } catch (error) {
        results.failed++
        const errorMessage = error instanceof Error ? error.message : String(error)
        results.errors.push(`组件 ${componentName} 刷新异常: ${errorMessage}`)
      }
    })

    await Promise.all(refreshPromises)
    
    console.log(`[RealtimeUIUpdater] 所有组件刷新完成: 成功 ${results.success}, 失败 ${results.failed}`)
    return results
  }

  /**
   * 处理刷新队列
   */
  private async processRefreshQueue(): Promise<void> {
    if (this.isProcessingQueue || this.refreshQueue.length === 0) {
      return
    }

    this.isProcessingQueue = true
    this.refreshStatus.isRefreshing = true

    try {
      while (this.refreshQueue.length > 0) {
        const item = this.refreshQueue.shift()!
        await this.processRefreshItem(item)
      }
    } catch (error) {
      console.error('[RealtimeUIUpdater] 处理刷新队列时发生错误:', error)
    } finally {
      this.isProcessingQueue = false
      this.refreshStatus.isRefreshing = false
    }
  }

  /**
   * 处理单个刷新项
   */
  private async processRefreshItem(item: {
    componentName: string
    options: RefreshOptions
    resolve: (value: boolean) => void
    reject: (error: Error) => void
  }): Promise<void> {
    const { componentName, options, resolve, reject } = item
    
    try {
      console.log(`[RealtimeUIUpdater] 开始刷新组件: ${componentName}`)
      
      const refresher = this.refreshers.get(componentName)
      if (!refresher) {
        const error = new Error(`未找到组件 ${componentName} 的刷新器`)
        this.handleRefreshError(componentName, error, options)
        reject(error)
        return
      }

      // 检查组件是否可以刷新
      if (!options.force && !refresher.canRefresh()) {
        const error = new Error(`组件 ${componentName} 当前不可刷新`)
        this.handleRefreshError(componentName, error, options)
        reject(error)
        return
      }

      // 执行刷新，带超时控制
      const refreshPromise = this.executeRefreshWithTimeout(refresher, options.timeout || this.DEFAULT_TIMEOUT)
      
      await refreshPromise
      
      // 刷新成功
      this.handleRefreshSuccess(componentName, options)
      resolve(true)
      
    } catch (error) {
      // 刷新失败，尝试重试
      const retryCount = options.retryCount || this.DEFAULT_RETRY_COUNT
      if (retryCount > 0) {
        console.log(`[RealtimeUIUpdater] 组件 ${componentName} 刷新失败，尝试重试 (剩余 ${retryCount} 次)`)
        
        // 递归重试
        setTimeout(() => {
          this.processRefreshItem({
            ...item,
            options: { ...options, retryCount: retryCount - 1 }
          })
        }, 1000) // 1秒后重试
      } else {
        const finalError = error instanceof Error ? error : new Error(String(error))
        this.handleRefreshError(componentName, finalError, options)
        reject(finalError)
      }
    }
  }

  /**
   * 执行带超时的刷新
   */
  private async executeRefreshWithTimeout(refresher: UIComponentRefresher, timeout: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`刷新超时 (${timeout}ms)`))
      }, timeout)

      refresher.refresh()
        .then(() => {
          clearTimeout(timeoutId)
          resolve()
        })
        .catch((error) => {
          clearTimeout(timeoutId)
          reject(error)
        })
    })
  }

  /**
   * 处理刷新成功
   */
  private handleRefreshSuccess(componentName: string, options: RefreshOptions): void {
    this.refreshStatus.lastRefreshTime = Date.now()
    this.refreshStatus.refreshCount++
    
    console.log(`[RealtimeUIUpdater] 组件 ${componentName} 刷新成功`)
    
    if (options.onSuccess) {
      try {
        options.onSuccess()
      } catch (error) {
        console.error('[RealtimeUIUpdater] 刷新成功回调执行失败:', error)
      }
    }

    if (options.onComplete) {
      try {
        options.onComplete()
      } catch (error) {
        console.error('[RealtimeUIUpdater] 刷新完成回调执行失败:', error)
      }
    }
  }

  /**
   * 处理刷新错误
   */
  private handleRefreshError(componentName: string, error: Error, options: RefreshOptions): void {
    const errorMessage = `组件 ${componentName} 刷新失败: ${error.message}`
    this.refreshStatus.errors.push(errorMessage)
    
    // 保持错误列表在合理大小
    if (this.refreshStatus.errors.length > 10) {
      this.refreshStatus.errors = this.refreshStatus.errors.slice(-10)
    }
    
    console.error(`[RealtimeUIUpdater] ${errorMessage}`)
    
    if (options.onError) {
      try {
        options.onError(error)
      } catch (callbackError) {
        console.error('[RealtimeUIUpdater] 刷新错误回调执行失败:', callbackError)
      }
    }

    if (options.onComplete) {
      try {
        options.onComplete()
      } catch (callbackError) {
        console.error('[RealtimeUIUpdater] 刷新完成回调执行失败:', callbackError)
      }
    }
  }

  /**
   * 获取刷新状态
   */
  getRefreshStatus(): RefreshStatus {
    return { ...this.refreshStatus }
  }

  /**
   * 清除错误记录
   */
  clearErrors(): void {
    this.refreshStatus.errors = []
    console.log('[RealtimeUIUpdater] 已清除错误记录')
  }

  /**
   * 获取已注册的组件列表
   */
  getRegisteredComponents(): string[] {
    return Array.from(this.refreshers.keys())
  }

  /**
   * 检查组件是否已注册
   */
  isComponentRegistered(componentName: string): boolean {
    return this.refreshers.has(componentName)
  }

  /**
   * 获取组件刷新器信息
   */
  getComponentInfo(componentName: string): { name: string; canRefresh: boolean } | null {
    const refresher = this.refreshers.get(componentName)
    if (!refresher) {
      return null
    }

    return {
      name: refresher.getComponentName(),
      canRefresh: refresher.canRefresh()
    }
  }

  /**
   * 销毁更新器
   */
  destroy(): void {
    // 清空刷新队列
    this.refreshQueue = []
    
    // 清空刷新器
    this.refreshers.clear()
    
    // 重置状态
    this.refreshStatus.isRefreshing = false
    this.refreshStatus.errors = []
    
    console.log('[RealtimeUIUpdater] UI更新器已销毁')
  }
}

// 创建全局实例
export const realtimeUIUpdater = new RealtimeUIUpdater()

// 导出工具函数
export function createComponentRefresher(
  componentName: string,
  refreshFn: () => Promise<void>,
  canRefreshFn: () => boolean = () => true
): UIComponentRefresher {
  return {
    refresh: refreshFn,
    canRefresh: canRefreshFn,
    getComponentName: () => componentName
  }
}

export default RealtimeUIUpdater