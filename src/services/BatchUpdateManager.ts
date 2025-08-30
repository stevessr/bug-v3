// 批量更新管理器
import type { EmojiGroup, Emoji } from './communication'

// 更新操作类型
export type UpdateOperationType = 'common-emoji' | 'emoji-order' | 'group-icon' | 'ungrouped-emojis' | 'cache-invalidation'

// 更新操作接口
export interface UpdateOperation {
  id: string
  type: UpdateOperationType
  priority: 'immediate' | 'high' | 'normal' | 'low'
  data: any
  timestamp: number
  retryCount: number
  maxRetries: number
  callback?: (success: boolean, error?: Error) => void
}

// 批量处理结果
export interface BatchProcessResult {
  processed: number
  succeeded: number
  failed: number
  errors: Array<{ operationId: string; error: Error }>
  duration: number
}

// 防抖和节流配置
export interface ThrottleConfig {
  immediate: number    // 立即处理的延迟 (ms)
  high: number        // 高优先级的延迟 (ms)
  normal: number      // 普通优先级的延迟 (ms)
  low: number         // 低优先级的延迟 (ms)
  maxBatchSize: number // 最大批处理大小
}

// 批量更新管理器类
export class BatchUpdateManager {
  private updateQueue: UpdateOperation[] = []
  private processingBatch = false
  private timers: Map<UpdateOperationType, any> = new Map()
  private operationHandlers: Map<UpdateOperationType, (operation: UpdateOperation) => Promise<boolean>> = new Map()
  
  private readonly config: ThrottleConfig = {
    immediate: 0,      // 立即处理
    high: 50,         // 50ms 延迟
    normal: 200,      // 200ms 延迟
    low: 1000,        // 1s 延迟
    maxBatchSize: 10  // 最多批处理10个操作
  }

  constructor(customConfig?: Partial<ThrottleConfig>) {
    if (customConfig) {
      this.config = { ...this.config, ...customConfig }
    }
    console.log('[BatchUpdateManager] Initialized with config:', this.config)
  }

  /**
   * 注册操作处理器
   */
  registerHandler(type: UpdateOperationType, handler: (operation: UpdateOperation) => Promise<boolean>): void {
    this.operationHandlers.set(type, handler)
    console.log(`[BatchUpdateManager] Registered handler for ${type}`)
  }

  /**
   * 添加更新操作到队列
   */
  queueUpdate(operation: Omit<UpdateOperation, 'id' | 'timestamp' | 'retryCount'>): string {
    const fullOperation: UpdateOperation = {
      ...operation,
      id: this.generateOperationId(),
      timestamp: Date.now(),
      retryCount: 0
    }

    // 检查是否有相同类型的操作可以合并
    const existingIndex = this.findMergeableOperation(fullOperation)
    if (existingIndex !== -1) {
      // 合并操作
      this.updateQueue[existingIndex] = this.mergeOperations(this.updateQueue[existingIndex], fullOperation)
      console.log(`[BatchUpdateManager] Merged operation ${fullOperation.id} with existing operation`)
    } else {
      // 按优先级插入队列
      this.insertByPriority(fullOperation)
      console.log(`[BatchUpdateManager] Queued ${fullOperation.type} operation with priority ${fullOperation.priority}`)
    }

    // 根据优先级调度处理
    this.scheduleProcessing(fullOperation.priority, fullOperation.type)
    
    return fullOperation.id
  }

  /**
   * 立即处理高优先级更新
   */
  async processImmediate(operation: Omit<UpdateOperation, 'id' | 'timestamp' | 'retryCount'>): Promise<boolean> {
    const immediateOperation: UpdateOperation = {
      ...operation,
      id: this.generateOperationId(),
      timestamp: Date.now(),
      retryCount: 0,
      priority: 'immediate'
    }

    console.log(`[BatchUpdateManager] Processing immediate operation: ${immediateOperation.type}`)
    
    try {
      const handler = this.operationHandlers.get(immediateOperation.type)
      if (!handler) {
        throw new Error(`No handler registered for operation type: ${immediateOperation.type}`)
      }

      const success = await handler(immediateOperation)
      
      if (immediateOperation.callback) {
        immediateOperation.callback(success)
      }
      
      return success
    } catch (error) {
      console.error(`[BatchUpdateManager] Immediate operation failed:`, error)
      
      if (immediateOperation.callback) {
        immediateOperation.callback(false, error as Error)
      }
      
      return false
    }
  }

  /**
   * 批量处理队列中的操作
   */
  async processBatch(): Promise<BatchProcessResult> {
    if (this.processingBatch || this.updateQueue.length === 0) {
      return {
        processed: 0,
        succeeded: 0,
        failed: 0,
        errors: [],
        duration: 0
      }
    }

    this.processingBatch = true
    const startTime = Date.now()
    
    console.log(`[BatchUpdateManager] Starting batch processing of ${this.updateQueue.length} operations`)

    const result: BatchProcessResult = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      errors: [],
      duration: 0
    }

    try {
      // 取出要处理的操作（最多 maxBatchSize 个）
      const operationsToProcess = this.updateQueue.splice(0, this.config.maxBatchSize)
      result.processed = operationsToProcess.length

      // 按类型分组操作以提高效率
      const groupedOperations = this.groupOperationsByType(operationsToProcess)

      // 并行处理不同类型的操作
      const processingPromises = Array.from(groupedOperations.entries()).map(
        async ([type, operations]) => {
          const handler = this.operationHandlers.get(type)
          if (!handler) {
            console.warn(`[BatchUpdateManager] No handler for operation type: ${type}`)
            return { type, results: operations.map(() => false) }
          }

          const results = await Promise.allSettled(
            operations.map(op => handler(op))
          )

          const operationResults = results.map((result, index) => {
            const operation = operations[index]
            if (result.status === 'fulfilled') {
              if (operation.callback) {
                operation.callback(result.value)
              }
              return { success: result.value, operation }
            } else {
              const error = result.reason as Error
              if (operation.callback) {
                operation.callback(false, error)
              }
              return { success: false, operation, error }
            }
          })

          return {
            type,
            results: operationResults.map(r => r.success),
            errors: operationResults.filter(r => r.error).map(r => ({ operationId: r.operation.id, error: r.error! }))
          }
        }
      )

      const processingResults = await Promise.all(processingPromises)

      // 统计结果
      for (const { results, errors } of processingResults) {
        for (const success of results) {
          if (success) {
            result.succeeded++
          } else {
            result.failed++
          }
        }
        // 合并错误
        result.errors.push(...errors)
      }

      // 处理失败的操作（重试逻辑）
      await this.handleFailedOperations(operationsToProcess, result)

    } catch (error) {
      console.error('[BatchUpdateManager] Batch processing error:', error)
      result.errors.push({ operationId: 'batch', error: error as Error })
    } finally {
      result.duration = Date.now() - startTime
      this.processingBatch = false
      
      console.log(`[BatchUpdateManager] Batch processing completed:`, result)
      
      // 如果队列中还有操作，继续处理
      if (this.updateQueue.length > 0) {
        this.scheduleNextBatch()
      }
    }

    return result
  }

  /**
   * 获取队列状态
   */
  getQueueStatus(): {
    length: number
    processing: boolean
    byPriority: Record<string, number>
    byType: Record<string, number>
  } {
    const byPriority: Record<string, number> = {}
    const byType: Record<string, number> = {}

    for (const operation of this.updateQueue) {
      byPriority[operation.priority] = (byPriority[operation.priority] || 0) + 1
      byType[operation.type] = (byType[operation.type] || 0) + 1
    }

    return {
      length: this.updateQueue.length,
      processing: this.processingBatch,
      byPriority,
      byType
    }
  }

  /**
   * 清空队列
   */
  clearQueue(): void {
    this.updateQueue = []
    this.clearAllTimers()
    console.log('[BatchUpdateManager] Queue cleared')
  }

  /**
   * 销毁管理器
   */
  destroy(): void {
    this.clearQueue()
    this.operationHandlers.clear()
    console.log('[BatchUpdateManager] Batch update manager destroyed')
  }

  // 私有方法

  private generateOperationId(): string {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private findMergeableOperation(operation: UpdateOperation): number {
    return this.updateQueue.findIndex(existing => 
      existing.type === operation.type && 
      this.canMergeOperations(existing, operation)
    )
  }

  private canMergeOperations(existing: UpdateOperation, incoming: UpdateOperation): boolean {
    // 只有相同类型且时间间隔较短的操作才能合并
    const timeDiff = incoming.timestamp - existing.timestamp
    return timeDiff < 1000 && existing.type === incoming.type
  }

  private mergeOperations(existing: UpdateOperation, incoming: UpdateOperation): UpdateOperation {
    // 合并操作数据，保留最新的时间戳和更高的优先级
    const priorityOrder = { immediate: 4, high: 3, normal: 2, low: 1 }
    const higherPriority = priorityOrder[incoming.priority] > priorityOrder[existing.priority] 
      ? incoming.priority 
      : existing.priority

    return {
      ...existing,
      priority: higherPriority,
      data: this.mergeOperationData(existing.data, incoming.data),
      timestamp: incoming.timestamp,
      callback: incoming.callback || existing.callback
    }
  }

  private mergeOperationData(existingData: any, incomingData: any): any {
    // 简单的数据合并策略
    if (Array.isArray(existingData) && Array.isArray(incomingData)) {
      return [...existingData, ...incomingData]
    }
    
    if (typeof existingData === 'object' && typeof incomingData === 'object') {
      return { ...existingData, ...incomingData }
    }
    
    // 默认使用新数据
    return incomingData
  }

  private insertByPriority(operation: UpdateOperation): void {
    const priorityOrder = { immediate: 4, high: 3, normal: 2, low: 1 }
    const insertIndex = this.updateQueue.findIndex(
      existing => priorityOrder[existing.priority] < priorityOrder[operation.priority]
    )
    
    if (insertIndex === -1) {
      this.updateQueue.push(operation)
    } else {
      this.updateQueue.splice(insertIndex, 0, operation)
    }
  }

  private scheduleProcessing(priority: UpdateOperation['priority'], type: UpdateOperationType): void {
    // 清除现有的定时器
    const existingTimer = this.timers.get(type)
    if (existingTimer) {
      clearTimeout(existingTimer)
    }

    // 根据优先级设置延迟
    const delay = this.config[priority]
    
    const timer = setTimeout(() => {
      this.processBatch()
      this.timers.delete(type)
    }, delay)
    
    this.timers.set(type, timer)
  }

  private scheduleNextBatch(): void {
    // 为下一批处理设置较短的延迟
    setTimeout(() => {
      if (!this.processingBatch && this.updateQueue.length > 0) {
        this.processBatch()
      }
    }, 100)
  }

  private groupOperationsByType(operations: UpdateOperation[]): Map<UpdateOperationType, UpdateOperation[]> {
    const grouped = new Map<UpdateOperationType, UpdateOperation[]>()
    
    for (const operation of operations) {
      if (!grouped.has(operation.type)) {
        grouped.set(operation.type, [])
      }
      grouped.get(operation.type)!.push(operation)
    }
    
    return grouped
  }

  private async handleFailedOperations(operations: UpdateOperation[], result: BatchProcessResult): Promise<void> {
    const failedOperations = operations.filter((_, index) => {
      // 这里需要根据实际的处理结果来判断哪些操作失败了
      // 简化处理：假设所有在 errors 中的操作都失败了
      return result.errors.some(error => error.operationId === operations[index].id)
    })

    for (const operation of failedOperations) {
      if (operation.retryCount < operation.maxRetries) {
        operation.retryCount++
        operation.timestamp = Date.now()
        
        // 降低优先级并重新加入队列
        if (operation.priority === 'high') operation.priority = 'normal'
        else if (operation.priority === 'normal') operation.priority = 'low'
        
        this.insertByPriority(operation)
        console.log(`[BatchUpdateManager] Retrying operation ${operation.id} (attempt ${operation.retryCount}/${operation.maxRetries})`)
      } else {
        console.error(`[BatchUpdateManager] Operation ${operation.id} failed after ${operation.maxRetries} retries`)
      }
    }
  }

  private clearAllTimers(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer)
    }
    this.timers.clear()
  }
}

export default BatchUpdateManager