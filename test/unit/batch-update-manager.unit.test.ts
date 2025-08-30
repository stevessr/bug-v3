import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { BatchUpdateManager, type UpdateOperation, type BatchProcessResult } from '../../src/services/BatchUpdateManager'

describe('BatchUpdateManager', () => {
  let batchUpdateManager: BatchUpdateManager
  let mockHandler: any

  beforeEach(() => {
    // Mock timers
    vi.useFakeTimers()
    
    batchUpdateManager = new BatchUpdateManager({
      immediate: 0,
      high: 50,
      normal: 200,
      low: 1000,
      maxBatchSize: 5
    })

    mockHandler = vi.fn().mockResolvedValue(true)
  })

  afterEach(() => {
    batchUpdateManager.destroy()
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  describe('Initialization', () => {
    it('should initialize with default config', () => {
      const manager = new BatchUpdateManager()
      expect(manager).toBeInstanceOf(BatchUpdateManager)
    })

    it('should initialize with custom config', () => {
      const customConfig = {
        immediate: 10,
        high: 100,
        normal: 500,
        low: 2000,
        maxBatchSize: 20
      }
      
      const manager = new BatchUpdateManager(customConfig)
      expect(manager).toBeInstanceOf(BatchUpdateManager)
      manager.destroy()
    })
  })

  describe('Handler Registration', () => {
    it('should register operation handlers', () => {
      batchUpdateManager.registerHandler('common-emoji', mockHandler)
      
      // Handler registration is internal, so we test it indirectly through operation processing
      expect(() => {
        batchUpdateManager.registerHandler('emoji-order', mockHandler)
      }).not.toThrow()
    })
  })

  describe('Queue Operations', () => {
    beforeEach(() => {
      batchUpdateManager.registerHandler('common-emoji', mockHandler)
      batchUpdateManager.registerHandler('emoji-order', mockHandler)
    })

    it('should queue update operations', () => {
      const operationId = batchUpdateManager.queueUpdate({
        type: 'common-emoji',
        priority: 'normal',
        data: { test: 'data' },
        maxRetries: 3
      })

      expect(operationId).toMatch(/^op_\d+_[a-z0-9]+$/)
      
      const status = batchUpdateManager.getQueueStatus()
      expect(status.length).toBe(1)
      expect(status.byType['common-emoji']).toBe(1)
      expect(status.byPriority['normal']).toBe(1)
    })

    it('should prioritize operations correctly', () => {
      // Add operations in reverse priority order
      batchUpdateManager.queueUpdate({
        type: 'common-emoji',
        priority: 'low',
        data: { priority: 'low' },
        maxRetries: 3
      })

      batchUpdateManager.queueUpdate({
        type: 'emoji-order',
        priority: 'high',
        data: { priority: 'high' },
        maxRetries: 3
      })

      // This will be merged with the first common-emoji operation
      batchUpdateManager.queueUpdate({
        type: 'common-emoji',
        priority: 'normal',
        data: { priority: 'normal' },
        maxRetries: 3
      })

      const status = batchUpdateManager.getQueueStatus()
      expect(status.length).toBe(2) // One merged common-emoji and one emoji-order
      expect(status.byType['common-emoji']).toBe(1)
      expect(status.byType['emoji-order']).toBe(1)
    })

    it('should merge similar operations', () => {
      const firstId = batchUpdateManager.queueUpdate({
        type: 'common-emoji',
        priority: 'normal',
        data: { emojis: ['emoji1'] },
        maxRetries: 3
      })

      // Add similar operation shortly after
      const secondId = batchUpdateManager.queueUpdate({
        type: 'common-emoji',
        priority: 'normal',
        data: { emojis: ['emoji2'] },
        maxRetries: 3
      })

      const status = batchUpdateManager.getQueueStatus()
      // Should still have only 1 operation due to merging
      expect(status.length).toBe(1)
    })

    it('should clear queue', () => {
      batchUpdateManager.queueUpdate({
        type: 'common-emoji',
        priority: 'normal',
        data: { test: 'data' },
        maxRetries: 3
      })

      let status = batchUpdateManager.getQueueStatus()
      expect(status.length).toBe(1)

      batchUpdateManager.clearQueue()
      
      status = batchUpdateManager.getQueueStatus()
      expect(status.length).toBe(0)
    })
  })

  describe('Immediate Processing', () => {
    beforeEach(() => {
      batchUpdateManager.registerHandler('common-emoji', mockHandler)
    })

    it('should process immediate operations', async () => {
      const result = await batchUpdateManager.processImmediate({
        type: 'common-emoji',
        priority: 'immediate',
        data: { test: 'immediate' },
        maxRetries: 1
      })

      expect(result).toBe(true)
      expect(mockHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'common-emoji',
          priority: 'immediate',
          data: { test: 'immediate' }
        })
      )
    })

    it('should handle immediate operation failures', async () => {
      mockHandler.mockRejectedValueOnce(new Error('Handler failed'))

      const result = await batchUpdateManager.processImmediate({
        type: 'common-emoji',
        priority: 'immediate',
        data: { test: 'immediate' },
        maxRetries: 1
      })

      expect(result).toBe(false)
    })

    it('should call operation callback for immediate operations', async () => {
      const callback = vi.fn()

      await batchUpdateManager.processImmediate({
        type: 'common-emoji',
        priority: 'immediate',
        data: { test: 'immediate' },
        maxRetries: 1,
        callback
      })

      expect(callback).toHaveBeenCalledWith(true)
    })
  })

  describe('Batch Processing', () => {
    beforeEach(() => {
      batchUpdateManager.registerHandler('common-emoji', mockHandler)
      batchUpdateManager.registerHandler('emoji-order', mockHandler)
    })

    it('should process batch operations', async () => {
      // Queue multiple operations
      batchUpdateManager.queueUpdate({
        type: 'common-emoji',
        priority: 'normal',
        data: { test: 'data1' },
        maxRetries: 3
      })

      batchUpdateManager.queueUpdate({
        type: 'emoji-order',
        priority: 'normal',
        data: { test: 'data2' },
        maxRetries: 3
      })

      const result = await batchUpdateManager.processBatch()

      expect(result.processed).toBe(2)
      expect(result.succeeded).toBe(2)
      expect(result.failed).toBe(0)
      expect(mockHandler).toHaveBeenCalledTimes(2)
    })

    it('should handle batch processing with failures', async () => {
      mockHandler
        .mockResolvedValueOnce(true)  // First operation succeeds
        .mockRejectedValueOnce(new Error('Second operation fails'))  // Second operation fails

      batchUpdateManager.queueUpdate({
        type: 'common-emoji',
        priority: 'normal',
        data: { test: 'data1' },
        maxRetries: 3
      })

      batchUpdateManager.queueUpdate({
        type: 'emoji-order',
        priority: 'normal',
        data: { test: 'data2' },
        maxRetries: 3
      })

      const result = await batchUpdateManager.processBatch()

      expect(result.processed).toBe(2)
      expect(result.succeeded).toBe(1)
      expect(result.failed).toBe(1)
      expect(result.errors).toHaveLength(1)
    })

    it('should respect maxBatchSize', async () => {
      // Queue operations of different types to avoid merging
      for (let i = 0; i < 7; i++) {
        batchUpdateManager.queueUpdate({
          type: i % 2 === 0 ? 'common-emoji' : 'emoji-order',
          priority: 'normal',
          data: { test: `data${i}` },
          maxRetries: 3
        })
      }

      const result = await batchUpdateManager.processBatch()

      // Should only process maxBatchSize operations
      expect(result.processed).toBe(5)
      
      // Should still have 2 operations in queue
      const status = batchUpdateManager.getQueueStatus()
      expect(status.length).toBe(2)
    })

    it('should return empty result when queue is empty', async () => {
      const result = await batchUpdateManager.processBatch()

      expect(result.processed).toBe(0)
      expect(result.succeeded).toBe(0)
      expect(result.failed).toBe(0)
      expect(result.errors).toHaveLength(0)
    })

    it('should not process when already processing', async () => {
      batchUpdateManager.queueUpdate({
        type: 'common-emoji',
        priority: 'normal',
        data: { test: 'data' },
        maxRetries: 3
      })

      // Start first batch processing (don't await)
      const firstBatch = batchUpdateManager.processBatch()
      
      // Try to start second batch processing immediately
      const secondBatch = await batchUpdateManager.processBatch()

      // Second batch should return empty result
      expect(secondBatch.processed).toBe(0)

      // Wait for first batch to complete
      const firstResult = await firstBatch
      expect(firstResult.processed).toBe(1)
    })
  })

  describe('Retry Logic', () => {
    beforeEach(() => {
      batchUpdateManager.registerHandler('common-emoji', mockHandler)
    })

    it('should retry failed operations', async () => {
      mockHandler
        .mockRejectedValueOnce(new Error('First attempt fails'))
        .mockResolvedValueOnce(true)  // Second attempt succeeds

      batchUpdateManager.queueUpdate({
        type: 'common-emoji',
        priority: 'normal',
        data: { test: 'retry-data' },
        maxRetries: 2
      })

      // First batch - operation fails
      const firstResult = await batchUpdateManager.processBatch()
      expect(firstResult.failed).toBe(1)

      // Operation should be back in queue for retry
      const status = batchUpdateManager.getQueueStatus()
      expect(status.length).toBe(1)

      // Second batch - operation succeeds
      const secondResult = await batchUpdateManager.processBatch()
      expect(secondResult.succeeded).toBe(1)
    })

    it('should give up after max retries', async () => {
      mockHandler.mockRejectedValue(new Error('Always fails'))

      batchUpdateManager.queueUpdate({
        type: 'common-emoji',
        priority: 'normal',
        data: { test: 'retry-data' },
        maxRetries: 2
      })

      // Process multiple times to exhaust retries
      await batchUpdateManager.processBatch() // First attempt
      await batchUpdateManager.processBatch() // First retry
      await batchUpdateManager.processBatch() // Second retry

      // Queue should be empty after max retries
      const status = batchUpdateManager.getQueueStatus()
      expect(status.length).toBe(0)
    })
  })

  describe('Scheduling and Throttling', () => {
    beforeEach(() => {
      batchUpdateManager.registerHandler('common-emoji', mockHandler)
    })

    it('should schedule processing based on priority', () => {
      batchUpdateManager.queueUpdate({
        type: 'common-emoji',
        priority: 'high',
        data: { test: 'high-priority' },
        maxRetries: 3
      })

      // Fast-forward time by the high priority delay (50ms)
      vi.advanceTimersByTime(50)

      expect(mockHandler).toHaveBeenCalled()
    })

    it('should debounce similar operations', () => {
      // Queue multiple operations quickly
      batchUpdateManager.queueUpdate({
        type: 'common-emoji',
        priority: 'normal',
        data: { test: 'data1' },
        maxRetries: 3
      })

      batchUpdateManager.queueUpdate({
        type: 'common-emoji',
        priority: 'normal',
        data: { test: 'data2' },
        maxRetries: 3
      })

      // Should have merged into single operation
      const status = batchUpdateManager.getQueueStatus()
      expect(status.length).toBe(1)
    })
  })

  describe('Error Handling', () => {
    it('should handle missing handlers gracefully', async () => {
      // Don't register handler for this type
      batchUpdateManager.queueUpdate({
        type: 'group-icon',
        priority: 'normal',
        data: { test: 'data' },
        maxRetries: 3
      })

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const result = await batchUpdateManager.processBatch()

      expect(result.processed).toBe(1)
      expect(result.failed).toBe(1)
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('No handler for operation type: group-icon')
      )

      consoleSpy.mockRestore()
    })

    it('should handle batch processing errors', async () => {
      batchUpdateManager.registerHandler('common-emoji', mockHandler)
      
      batchUpdateManager.queueUpdate({
        type: 'common-emoji',
        priority: 'normal',
        data: { test: 'data' },
        maxRetries: 3
      })

      // Mock an error in the batch processing itself by making the handler throw
      mockHandler.mockImplementation(() => {
        throw new Error('Handler processing error')
      })

      const result = await batchUpdateManager.processBatch()

      expect(result.errors).toHaveLength(1)
      expect(result.failed).toBe(1)
    })
  })

  describe('Status and Monitoring', () => {
    beforeEach(() => {
      batchUpdateManager.registerHandler('common-emoji', mockHandler)
      batchUpdateManager.registerHandler('emoji-order', mockHandler)
    })

    it('should provide accurate queue status', () => {
      batchUpdateManager.queueUpdate({
        type: 'common-emoji',
        priority: 'high',
        data: { test: 'data1' },
        maxRetries: 3
      })

      batchUpdateManager.queueUpdate({
        type: 'emoji-order',
        priority: 'normal',
        data: { test: 'data2' },
        maxRetries: 3
      })

      // This will be merged with the first common-emoji operation
      batchUpdateManager.queueUpdate({
        type: 'common-emoji',
        priority: 'low',
        data: { test: 'data3' },
        maxRetries: 3
      })

      const status = batchUpdateManager.getQueueStatus()

      expect(status.length).toBe(2) // One merged common-emoji and one emoji-order
      expect(status.processing).toBe(false)
      expect(status.byType).toEqual({
        'common-emoji': 1,
        'emoji-order': 1
      })
    })

    it('should show processing status during batch processing', async () => {
      batchUpdateManager.queueUpdate({
        type: 'common-emoji',
        priority: 'normal',
        data: { test: 'data' },
        maxRetries: 3
      })

      // Start processing but don't await
      const processingPromise = batchUpdateManager.processBatch()

      // Check status during processing
      const statusDuringProcessing = batchUpdateManager.getQueueStatus()
      expect(statusDuringProcessing.processing).toBe(true)

      // Wait for processing to complete
      await processingPromise

      // Check status after processing
      const statusAfterProcessing = batchUpdateManager.getQueueStatus()
      expect(statusAfterProcessing.processing).toBe(false)
    })
  })
})