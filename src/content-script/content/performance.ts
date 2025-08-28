// 表情选择器性能监控系统
import { cacheUtils } from './state'

interface PerformanceMetric {
  name: string
  startTime: number
  endTime?: number
  duration?: number
  metadata?: any
}

interface PerformanceStats {
  totalOperations: number
  avgDuration: number
  minDuration: number
  maxDuration: number
  lastOperationTime: number
  cacheHitRate: number
  errorRate: number
}

class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetric[]> = new Map()
  private errorCounts: Map<string, number> = new Map()
  private isEnabled: boolean = true

  // 开始性能测量
  startMeasure(operationName: string, metadata?: any): string {
    if (!this.isEnabled) return ''

    const measureId = `${operationName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const metric: PerformanceMetric = {
      name: operationName,
      startTime: performance.now(),
      metadata,
    }

    if (!this.metrics.has(operationName)) {
      this.metrics.set(operationName, [])
    }

    this.metrics.get(operationName)!.push(metric)

    return measureId
  }

  // 结束性能测量
  endMeasure(operationName: string, measureId?: string): number {
    if (!this.isEnabled) return 0

    const metrics = this.metrics.get(operationName)
    if (!metrics || metrics.length === 0) return 0

    const metric = measureId
      ? metrics.find((m) => !m.endTime) // 找到第一个未结束的测量
      : metrics[metrics.length - 1] // 使用最后一个测量

    if (!metric || metric.endTime) return 0

    metric.endTime = performance.now()
    metric.duration = metric.endTime - metric.startTime

    // 记录日志
    const duration = Math.round(metric.duration)
    console.log(`[性能监控] ${operationName} 完成，耗时: ${duration}ms`, metric.metadata || '')

    // 性能警告
    if (duration > this.getWarningThreshold(operationName)) {
      console.warn(`[性能警告] ${operationName} 耗时过长: ${duration}ms`)
    }

    return metric.duration
  }

  // 记录错误
  recordError(operationName: string, error: any) {
    if (!this.isEnabled) return

    const currentCount = this.errorCounts.get(operationName) || 0
    this.errorCounts.set(operationName, currentCount + 1)

    console.error(`[性能监控] ${operationName} 发生错误:`, error)
  }

  // 获取操作统计
  getStats(operationName: string): PerformanceStats | null {
    const metrics = this.metrics.get(operationName)
    if (!metrics || metrics.length === 0) return null

    const completedMetrics = metrics.filter((m) => m.duration !== undefined)
    if (completedMetrics.length === 0) return null

    const durations = completedMetrics.map((m) => m.duration!)
    const totalErrors = this.errorCounts.get(operationName) || 0

    return {
      totalOperations: completedMetrics.length,
      avgDuration: durations.reduce((sum, d) => sum + d, 0) / durations.length,
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
      lastOperationTime: Math.max(...completedMetrics.map((m) => m.endTime!)),
      cacheHitRate: this.calculateCacheHitRate(),
      errorRate: totalErrors / (completedMetrics.length + totalErrors),
    }
  }

  // 获取所有统计信息
  getAllStats(): Record<string, PerformanceStats> {
    const result: Record<string, PerformanceStats> = {}

    for (const operationName of this.metrics.keys()) {
      const stats = this.getStats(operationName)
      if (stats) {
        result[operationName] = stats
      }
    }

    return result
  }

  // 生成性能报告
  generateReport(): string {
    const stats = this.getAllStats()
    const cacheStats = cacheUtils.getCacheStats()

    let report = '=== 表情选择器性能报告 ===\n'
    report += `生成时间: ${new Date().toLocaleString()}\n`
    report += `缓存命中率: ${cacheStats.hitRate}%\n`
    report += `激进缓存模式: ${cacheStats.isAggressiveMode ? '启用' : '禁用'}\n\n`

    // 操作统计
    for (const [operationName, operationStats] of Object.entries(stats)) {
      report += `=== ${operationName} ===\n`
      report += `总操作数: ${operationStats.totalOperations}\n`
      report += `平均耗时: ${Math.round(operationStats.avgDuration)}ms\n`
      report += `最短耗时: ${Math.round(operationStats.minDuration)}ms\n`
      report += `最长耗时: ${Math.round(operationStats.maxDuration)}ms\n`
      report += `错误率: ${(operationStats.errorRate * 100).toFixed(2)}%\n\n`
    }

    // 性能建议
    report += '=== 性能建议 ===\n'
    if (cacheStats.hitRate < 80) {
      report += '• 缓存命中率较低，建议启用激进缓存模式\n'
    }

    const pickerStats = stats['emoji-picker-creation']
    if (pickerStats && pickerStats.avgDuration > 500) {
      report += '• 表情选择器创建耗时过长，建议优化缓存或减少表情数量\n'
    }

    const insertStats = stats['emoji-insertion']
    if (insertStats && insertStats.avgDuration > 100) {
      report += '• 表情插入耗时过长，建议检查网络连接或设置获取逻辑\n'
    }

    return report
  }

  // 清理旧数据
  cleanup() {
    const now = Date.now()
    const maxAge = 10 * 60 * 1000 // 10分钟

    for (const [operationName, metrics] of this.metrics.entries()) {
      const filteredMetrics = metrics.filter((m) => (m.endTime || m.startTime) > now - maxAge)

      if (filteredMetrics.length === 0) {
        this.metrics.delete(operationName)
        this.errorCounts.delete(operationName)
      } else {
        this.metrics.set(operationName, filteredMetrics)
      }
    }
  }

  // 启用/禁用监控
  setEnabled(enabled: boolean) {
    this.isEnabled = enabled
    console.log(`[性能监控] 监控${enabled ? '启用' : '禁用'}`)
  }

  private getWarningThreshold(operationName: string): number {
    const thresholds: Record<string, number> = {
      'emoji-picker-creation': 1000,
      'emoji-insertion': 200,
      'data-loading': 500,
      'cache-operation': 50,
    }

    return thresholds[operationName] || 1000
  }

  private calculateCacheHitRate(): number {
    const cacheStats = cacheUtils.getCacheStats()
    return cacheStats.hitRate
  }
}

// 创建全局性能监控实例
export const performanceMonitor = new PerformanceMonitor()

// 便捷函数
export function measureAsync<T>(
  operationName: string,
  operation: () => Promise<T>,
  metadata?: any,
): Promise<T> {
  const measureId = performanceMonitor.startMeasure(operationName, metadata)

  return operation()
    .then((result) => {
      performanceMonitor.endMeasure(operationName, measureId)
      return result
    })
    .catch((error) => {
      performanceMonitor.recordError(operationName, error)
      performanceMonitor.endMeasure(operationName, measureId)
      throw error
    })
}

export function measureSync<T>(operationName: string, operation: () => T, metadata?: any): T {
  const measureId = performanceMonitor.startMeasure(operationName, metadata)

  try {
    const result = operation()
    performanceMonitor.endMeasure(operationName, measureId)
    return result
  } catch (error) {
    performanceMonitor.recordError(operationName, error)
    performanceMonitor.endMeasure(operationName, measureId)
    throw error
  }
}

// 自动清理
setInterval(
  () => {
    performanceMonitor.cleanup()
  },
  5 * 60 * 1000,
) // 每5分钟清理一次

// 导出调试函数到全局
if (typeof window !== 'undefined') {
  ;(window as any).emojiPerformance = {
    getStats: () => performanceMonitor.getAllStats(),
    generateReport: () => {
      const report = performanceMonitor.generateReport()
      console.log(report)
      return report
    },
    cleanup: () => performanceMonitor.cleanup(),
    setEnabled: (enabled: boolean) => performanceMonitor.setEnabled(enabled),
  }

  console.log('[性能监控] 调试工具已挂载到 window.emojiPerformance')
}

export default performanceMonitor
