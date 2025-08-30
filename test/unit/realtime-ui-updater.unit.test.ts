import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { RealtimeUIUpdater, createComponentRefresher, type UIComponentRefresher } from '../../src/services/RealtimeUIUpdater'

describe('RealtimeUIUpdater', () => {
  let updater: RealtimeUIUpdater
  let mockRefresher: UIComponentRefresher

  beforeEach(() => {
    updater = new RealtimeUIUpdater()
    
    mockRefresher = {
      refresh: vi.fn().mockResolvedValue(undefined),
      canRefresh: vi.fn().mockReturnValue(true),
      getComponentName: vi.fn().mockReturnValue('test-component')
    }

    // Mock console methods
    global.console = {
      ...global.console,
      log: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    }

    // Mock timers
    vi.useFakeTimers()
  })

  afterEach(() => {
    updater.destroy()
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  describe('Initialization', () => {
    it('should initialize with default state', () => {
      const status = updater.getRefreshStatus()
      
      expect(status.isRefreshing).toBe(false)
      expect(status.lastRefreshTime).toBe(0)
      expect(status.refreshCount).toBe(0)
      expect(status.errors).toEqual([])
    })

    it('should have empty registered components initially', () => {
      const components = updater.getRegisteredComponents()
      expect(components).toEqual([])
    })
  })

  describe('Component Registration', () => {
    it('should register component refresher', () => {
      updater.registerRefresher('test-component', mockRefresher)
      
      expect(updater.isComponentRegistered('test-component')).toBe(true)
      expect(updater.getRegisteredComponents()).toContain('test-component')
    })

    it('should unregister component refresher', () => {
      updater.registerRefresher('test-component', mockRefresher)
      updater.unregisterRefresher('test-component')
      
      expect(updater.isComponentRegistered('test-component')).toBe(false)
      expect(updater.getRegisteredComponents()).not.toContain('test-component')
    })

    it('should get component info', () => {
      updater.registerRefresher('test-component', mockRefresher)
      
      const info = updater.getComponentInfo('test-component')
      expect(info).toEqual({
        name: 'test-component',
        canRefresh: true
      })
    })

    it('should return null for non-existent component info', () => {
      const info = updater.getComponentInfo('non-existent')
      expect(info).toBeNull()
    })
  })

  describe('Force Refresh', () => {
    beforeEach(() => {
      updater.registerRefresher('test-component', mockRefresher)
    })

    it('should successfully refresh component', async () => {
      const result = await updater.forceRefresh('test-component')
      
      expect(result).toBe(true)
      expect(mockRefresher.refresh).toHaveBeenCalled()
      
      const status = updater.getRefreshStatus()
      expect(status.refreshCount).toBe(1)
      expect(status.lastRefreshTime).toBeGreaterThan(0)
    })

    it('should handle non-existent component', async () => {
      await expect(updater.forceRefresh('non-existent')).rejects.toThrow('未找到组件 non-existent 的刷新器')
    })

    it('should handle component that cannot refresh', async () => {
      mockRefresher.canRefresh = vi.fn().mockReturnValue(false)
      
      await expect(updater.forceRefresh('test-component', { force: false })).rejects.toThrow('组件 test-component 当前不可刷新')
    })

    it('should force refresh even when component cannot refresh', async () => {
      mockRefresher.canRefresh = vi.fn().mockReturnValue(false)
      
      const result = await updater.forceRefresh('test-component', { force: true })
      expect(result).toBe(true)
      expect(mockRefresher.refresh).toHaveBeenCalled()
    })

    it('should handle refresh timeout', async () => {
      mockRefresher.refresh = vi.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 10000)) // 10 second delay
      )
      
      const refreshPromise = updater.forceRefresh('test-component', { timeout: 1000 })
      
      // Fast-forward time to trigger timeout
      vi.advanceTimersByTime(1000)
      
      await expect(refreshPromise).rejects.toThrow('刷新超时 (1000ms)')
    })

    it('should call success callback on successful refresh', async () => {
      const onSuccess = vi.fn()
      const onComplete = vi.fn()
      
      await updater.forceRefresh('test-component', { onSuccess, onComplete })
      
      expect(onSuccess).toHaveBeenCalled()
      expect(onComplete).toHaveBeenCalled()
    })

    it('should call error callback on failed refresh', async () => {
      const refreshError = new Error('Refresh failed')
      mockRefresher.refresh = vi.fn().mockRejectedValue(refreshError)
      
      const onError = vi.fn()
      const onComplete = vi.fn()
      
      await expect(updater.forceRefresh('test-component', { 
        onError, 
        onComplete, 
        retryCount: 0 
      })).rejects.toThrow('Refresh failed')
      
      expect(onError).toHaveBeenCalledWith(refreshError)
      expect(onComplete).toHaveBeenCalled()
    })
  })

  describe('Retry Mechanism', () => {
    beforeEach(() => {
      updater.registerRefresher('test-component', mockRefresher)
    })

    it('should retry on failure', async () => {
      let callCount = 0
      mockRefresher.refresh = vi.fn().mockImplementation(() => {
        callCount++
        if (callCount < 3) {
          return Promise.reject(new Error('Temporary failure'))
        }
        return Promise.resolve()
      })
      
      const refreshPromise = updater.forceRefresh('test-component', { retryCount: 3 })
      
      // Fast-forward time for retries
      vi.advanceTimersByTime(3000)
      
      const result = await refreshPromise
      expect(result).toBe(true)
      expect(mockRefresher.refresh).toHaveBeenCalledTimes(3)
    })

    it('should fail after max retries', async () => {
      mockRefresher.refresh = vi.fn().mockRejectedValue(new Error('Persistent failure'))
      
      const refreshPromise = updater.forceRefresh('test-component', { retryCount: 2 })
      
      // Fast-forward time for retries
      vi.advanceTimersByTime(3000)
      
      await expect(refreshPromise).rejects.toThrow('Persistent failure')
      expect(mockRefresher.refresh).toHaveBeenCalledTimes(3) // Initial + 2 retries
    })
  })

  describe('Refresh All', () => {
    it('should refresh all registered components', async () => {
      const mockRefresher1 = createComponentRefresher('component1', vi.fn().mockResolvedValue(undefined))
      const mockRefresher2 = createComponentRefresher('component2', vi.fn().mockResolvedValue(undefined))
      
      updater.registerRefresher('component1', mockRefresher1)
      updater.registerRefresher('component2', mockRefresher2)
      
      const result = await updater.refreshAll()
      
      expect(result.success).toBe(2)
      expect(result.failed).toBe(0)
      expect(result.errors).toEqual([])
    })

    it('should handle mixed success and failure', async () => {
      const mockRefresher1 = createComponentRefresher('component1', vi.fn().mockResolvedValue(undefined))
      const mockRefresher2 = createComponentRefresher('component2', vi.fn().mockRejectedValue(new Error('Failed')))
      
      updater.registerRefresher('component1', mockRefresher1)
      updater.registerRefresher('component2', mockRefresher2)
      
      const result = await updater.refreshAll({ retryCount: 0 })
      
      expect(result.success).toBe(1)
      expect(result.failed).toBe(1)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]).toContain('component2')
    })
  })

  describe('Error Handling', () => {
    it('should track errors in refresh status', async () => {
      mockRefresher.refresh = vi.fn().mockRejectedValue(new Error('Test error'))
      updater.registerRefresher('test-component', mockRefresher)
      
      await expect(updater.forceRefresh('test-component', { retryCount: 0 })).rejects.toThrow()
      
      const status = updater.getRefreshStatus()
      expect(status.errors).toHaveLength(1)
      expect(status.errors[0]).toContain('Test error')
    })

    it('should limit error history', async () => {
      updater.registerRefresher('test-component', mockRefresher)
      
      // Generate more than 10 errors
      for (let i = 0; i < 15; i++) {
        mockRefresher.refresh = vi.fn().mockRejectedValue(new Error(`Error ${i}`))
        try {
          await updater.forceRefresh('test-component', { retryCount: 0 })
        } catch (error) {
          // Expected to fail
        }
      }
      
      const status = updater.getRefreshStatus()
      expect(status.errors).toHaveLength(10) // Should be limited to 10
    })

    it('should clear errors', async () => {
      mockRefresher.refresh = vi.fn().mockRejectedValue(new Error('Test error'))
      updater.registerRefresher('test-component', mockRefresher)
      
      await expect(updater.forceRefresh('test-component', { retryCount: 0 })).rejects.toThrow()
      
      updater.clearErrors()
      
      const status = updater.getRefreshStatus()
      expect(status.errors).toEqual([])
    })
  })

  describe('Component Refresher Factory', () => {
    it('should create component refresher with default canRefresh', () => {
      const refreshFn = vi.fn().mockResolvedValue(undefined)
      const refresher = createComponentRefresher('test', refreshFn)
      
      expect(refresher.getComponentName()).toBe('test')
      expect(refresher.canRefresh()).toBe(true)
      expect(refresher.refresh).toBe(refreshFn)
    })

    it('should create component refresher with custom canRefresh', () => {
      const refreshFn = vi.fn().mockResolvedValue(undefined)
      const canRefreshFn = vi.fn().mockReturnValue(false)
      const refresher = createComponentRefresher('test', refreshFn, canRefreshFn)
      
      expect(refresher.canRefresh()).toBe(false)
      expect(refresher.canRefresh).toBe(canRefreshFn)
    })
  })

  describe('Queue Processing', () => {
    it('should process refresh queue sequentially', async () => {
      const refreshOrder: string[] = []
      
      const mockRefresher1 = createComponentRefresher('component1', async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
        refreshOrder.push('component1')
      })
      
      const mockRefresher2 = createComponentRefresher('component2', async () => {
        await new Promise(resolve => setTimeout(resolve, 50))
        refreshOrder.push('component2')
      })
      
      updater.registerRefresher('component1', mockRefresher1)
      updater.registerRefresher('component2', mockRefresher2)
      
      // Start both refreshes simultaneously
      const promise1 = updater.forceRefresh('component1')
      const promise2 = updater.forceRefresh('component2')
      
      // Fast-forward time
      vi.advanceTimersByTime(200)
      
      await Promise.all([promise1, promise2])
      
      // Should be processed in queue order, not completion order
      expect(refreshOrder).toEqual(['component1', 'component2'])
    })
  })

  describe('Cleanup', () => {
    it('should destroy properly', () => {
      updater.registerRefresher('test-component', mockRefresher)
      
      updater.destroy()
      
      expect(updater.getRegisteredComponents()).toEqual([])
      
      const status = updater.getRefreshStatus()
      expect(status.isRefreshing).toBe(false)
      expect(status.errors).toEqual([])
    })
  })
})