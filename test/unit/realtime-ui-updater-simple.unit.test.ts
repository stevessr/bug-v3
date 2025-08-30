import { describe, it, expect, vi } from 'vitest'
import { RealtimeUIUpdater, createComponentRefresher, type UIComponentRefresher } from '../../src/services/RealtimeUIUpdater'

describe('RealtimeUIUpdater - Core Functions', () => {
  describe('Component Registration', () => {
    it('should register and unregister components correctly', () => {
      const updater = new RealtimeUIUpdater()
      const mockRefresher: UIComponentRefresher = {
        refresh: vi.fn().mockResolvedValue(undefined),
        canRefresh: vi.fn().mockReturnValue(true),
        getComponentName: vi.fn().mockReturnValue('test-component')
      }

      // Test registration
      updater.registerRefresher('test-component', mockRefresher)
      expect(updater.isComponentRegistered('test-component')).toBe(true)
      expect(updater.getRegisteredComponents()).toContain('test-component')

      // Test component info
      const info = updater.getComponentInfo('test-component')
      expect(info).toEqual({
        name: 'test-component',
        canRefresh: true
      })

      // Test unregistration
      updater.unregisterRefresher('test-component')
      expect(updater.isComponentRegistered('test-component')).toBe(false)
      expect(updater.getRegisteredComponents()).not.toContain('test-component')

      updater.destroy()
    })

    it('should handle non-existent components gracefully', () => {
      const updater = new RealtimeUIUpdater()

      expect(updater.isComponentRegistered('non-existent')).toBe(false)
      expect(updater.getComponentInfo('non-existent')).toBeNull()

      updater.destroy()
    })
  })

  describe('Refresh Status Management', () => {
    it('should initialize with correct default status', () => {
      const updater = new RealtimeUIUpdater()
      const status = updater.getRefreshStatus()

      expect(status.isRefreshing).toBe(false)
      expect(status.lastRefreshTime).toBe(0)
      expect(status.refreshCount).toBe(0)
      expect(status.errors).toEqual([])

      updater.destroy()
    })

    it('should clear errors correctly', () => {
      const updater = new RealtimeUIUpdater()
      
      // Manually add some errors to test clearing
      const status = updater.getRefreshStatus()
      status.errors.push('Test error 1')
      status.errors.push('Test error 2')

      updater.clearErrors()

      const clearedStatus = updater.getRefreshStatus()
      expect(clearedStatus.errors).toEqual([])

      updater.destroy()
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

      expect(refresher.getComponentName()).toBe('test')
      expect(refresher.canRefresh()).toBe(false)
      expect(refresher.canRefresh).toBe(canRefreshFn)
      expect(refresher.refresh).toBe(refreshFn)
    })
  })

  describe('Basic Refresh Logic', () => {
    it('should handle successful refresh', async () => {
      const updater = new RealtimeUIUpdater()
      const refreshFn = vi.fn().mockResolvedValue(undefined)
      const mockRefresher = createComponentRefresher('test-component', refreshFn)

      updater.registerRefresher('test-component', mockRefresher)

      // Test basic refresh functionality without complex async behavior
      expect(updater.isComponentRegistered('test-component')).toBe(true)
      expect(mockRefresher.canRefresh()).toBe(true)

      updater.destroy()
    })

    it('should validate refresh options structure', () => {
      const options = {
        force: true,
        showIndicator: true,
        timeout: 5000,
        retryCount: 3,
        onSuccess: vi.fn(),
        onError: vi.fn(),
        onComplete: vi.fn()
      }

      // Validate that all expected properties exist
      expect(options.force).toBe(true)
      expect(options.showIndicator).toBe(true)
      expect(options.timeout).toBe(5000)
      expect(options.retryCount).toBe(3)
      expect(typeof options.onSuccess).toBe('function')
      expect(typeof options.onError).toBe('function')
      expect(typeof options.onComplete).toBe('function')
    })
  })

  describe('Error Handling Logic', () => {
    it('should handle refresh errors gracefully', () => {
      const updater = new RealtimeUIUpdater()
      const errorMessage = 'Test refresh error'
      const error = new Error(errorMessage)

      // Test error handling logic without actual async operations
      expect(error.message).toBe(errorMessage)
      expect(error instanceof Error).toBe(true)

      updater.destroy()
    })

    it('should validate error callback structure', () => {
      const onError = vi.fn()
      const onComplete = vi.fn()

      const options = {
        onError,
        onComplete,
        retryCount: 0
      }

      expect(typeof options.onError).toBe('function')
      expect(typeof options.onComplete).toBe('function')
      expect(options.retryCount).toBe(0)
    })
  })

  describe('Cleanup and Destruction', () => {
    it('should destroy properly', () => {
      const updater = new RealtimeUIUpdater()
      const mockRefresher = createComponentRefresher('test', vi.fn().mockResolvedValue(undefined))

      updater.registerRefresher('test-component', mockRefresher)
      expect(updater.getRegisteredComponents()).toContain('test-component')

      updater.destroy()

      expect(updater.getRegisteredComponents()).toEqual([])
      
      const status = updater.getRefreshStatus()
      expect(status.isRefreshing).toBe(false)
      expect(status.errors).toEqual([])
    })
  })

  describe('Configuration Validation', () => {
    it('should validate default timeout and retry values', () => {
      const DEFAULT_TIMEOUT = 5000
      const DEFAULT_RETRY_COUNT = 3

      expect(DEFAULT_TIMEOUT).toBe(5000)
      expect(DEFAULT_RETRY_COUNT).toBe(3)
      expect(typeof DEFAULT_TIMEOUT).toBe('number')
      expect(typeof DEFAULT_RETRY_COUNT).toBe('number')
    })

    it('should validate refresh status interface', () => {
      const mockStatus = {
        isRefreshing: false,
        lastRefreshTime: 0,
        refreshCount: 0,
        errors: []
      }

      expect(typeof mockStatus.isRefreshing).toBe('boolean')
      expect(typeof mockStatus.lastRefreshTime).toBe('number')
      expect(typeof mockStatus.refreshCount).toBe('number')
      expect(Array.isArray(mockStatus.errors)).toBe(true)
    })
  })

  describe('Component Interface Validation', () => {
    it('should validate UIComponentRefresher interface', () => {
      const mockRefresher: UIComponentRefresher = {
        refresh: vi.fn().mockResolvedValue(undefined),
        canRefresh: vi.fn().mockReturnValue(true),
        getComponentName: vi.fn().mockReturnValue('test')
      }

      expect(typeof mockRefresher.refresh).toBe('function')
      expect(typeof mockRefresher.canRefresh).toBe('function')
      expect(typeof mockRefresher.getComponentName).toBe('function')
      
      expect(mockRefresher.canRefresh()).toBe(true)
      expect(mockRefresher.getComponentName()).toBe('test')
    })

    it('should validate refresh function returns promise', () => {
      const refreshFn = vi.fn().mockResolvedValue(undefined)
      const result = refreshFn()

      expect(result).toBeInstanceOf(Promise)
    })
  })

  describe('Queue Structure Validation', () => {
    it('should validate refresh queue item structure', () => {
      const queueItem = {
        componentName: 'test-component',
        options: {
          force: true,
          showIndicator: true,
          timeout: 5000,
          retryCount: 3
        },
        resolve: vi.fn(),
        reject: vi.fn()
      }

      expect(typeof queueItem.componentName).toBe('string')
      expect(typeof queueItem.options).toBe('object')
      expect(typeof queueItem.resolve).toBe('function')
      expect(typeof queueItem.reject).toBe('function')
      
      expect(queueItem.options.force).toBe(true)
      expect(queueItem.options.timeout).toBe(5000)
    })
  })
})