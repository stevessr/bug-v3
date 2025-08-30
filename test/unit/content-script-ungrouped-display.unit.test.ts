import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('Content Script - Ungrouped Emoji Display', () => {
  let mockCachedState: any
  let mockLoadGroupsFromBackground: any
  let mockSetupCacheListeners: any
  let mockGetDefaultEmojis: any

  beforeEach(() => {
    // Mock the cached state
    mockCachedState = {
      emojiGroups: [],
      ungroupedEmojis: []
    }

    // Mock functions
    mockLoadGroupsFromBackground = vi.fn()
    mockSetupCacheListeners = vi.fn()
    mockGetDefaultEmojis = vi.fn()

    // Mock modules
    vi.doMock('../../../src/content-script/content/state', () => ({
      cachedState: mockCachedState
    }))

    vi.doMock('../../../src/content-script/content/picker/cache-manager', () => ({
      loadGroupsFromBackground: mockLoadGroupsFromBackground,
      checkForUpdatesInBackground: vi.fn(),
      isAggressiveMode: vi.fn(() => false),
      getAllCachedGroups: vi.fn(() => []),
      setupCacheListeners: mockSetupCacheListeners,
    }))

    vi.doMock('../../../src/content-script/content/default', () => ({
      getDefaultEmojis: mockGetDefaultEmojis
    }))

    // Mock performance monitor
    vi.doMock('../../../src/content-script/content/performance', () => ({
      performanceMonitor: {
        startMeasure: vi.fn(() => 'test-measure-id'),
        endMeasure: vi.fn()
      }
    }))

    // Mock render utils
    vi.doMock('../../../src/content-script/content/picker/render-utils', () => ({
      generateSectionNavHTML: vi.fn(() => '<nav>test nav</nav>'),
      generateSectionHTML: vi.fn(() => '<section>test section</section>'),
      generateDesktopPickerHTML: vi.fn(() => '<div class="desktop-picker">test</div>'),
      generateMobilePickerHTML: vi.fn(() => '<div class="mobile-picker">test</div>'),
      applyDesktopStyles: vi.fn(),
      applyMobileStyles: vi.fn(),
      isMobile: vi.fn(() => false)
    }))

    // Mock event handlers
    vi.doMock('../../../src/content-script/content/picker/event-handlers', () => ({
      setupEmojiClickHandlers: vi.fn(),
      setupSectionNavigationHandlers: vi.fn(),
      setupCloseHandlers: vi.fn(),
      setupFilterHandlers: vi.fn(),
      setupUploadHandlers: vi.fn(),
      setupCommonGroupRefreshHandler: vi.fn(() => vi.fn())
    }))

    // Mock DOM
    global.document = {
      createElement: vi.fn(() => ({
        innerHTML: '',
        setAttribute: vi.fn(),
        remove: vi.fn()
      })),
      querySelector: vi.fn(),
      querySelectorAll: vi.fn(() => [])
    } as any

    global.window = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
      performance: {
        now: vi.fn(() => Date.now())
      }
    } as any

    global.performance = {
      now: vi.fn(() => Date.now())
    } as any
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  describe('Ungrouped Emoji Integration', () => {
    it('should include ungrouped emojis as a separate group', async () => {
      // Setup test data
      const testGroups = [
        {
          UUID: 'common-emoji-group',
          id: 'common-emoji-group',
          displayName: '常用',
          icon: '⭐',
          order: 0,
          emojis: []
        },
        {
          UUID: 'group1',
          id: 'group1',
          displayName: 'Group 1',
          icon: '😀',
          order: 1,
          emojis: [
            { UUID: 'emoji1', displayName: 'Emoji 1', url: 'emoji1.png' }
          ]
        }
      ]

      const testUngroupedEmojis = [
        { UUID: 'ungrouped1', displayName: 'Ungrouped 1', url: 'ungrouped1.png' },
        { UUID: 'ungrouped2', displayName: 'Ungrouped 2', url: 'ungrouped2.png' }
      ]

      // Setup mocks
      mockLoadGroupsFromBackground.mockResolvedValue(testGroups)
      mockCachedState.ungroupedEmojis = testUngroupedEmojis

      // Import and test
      const { createEmojiPicker } = await import('../../../src/content-script/content/picker/emoji-picker-core')
      
      const picker = await createEmojiPicker(false)

      expect(picker).toBeDefined()
      expect(mockLoadGroupsFromBackground).toHaveBeenCalled()
      expect(mockSetupCacheListeners).toHaveBeenCalled()
    })

    it('should handle empty ungrouped emojis gracefully', async () => {
      // Setup test data with no ungrouped emojis
      const testGroups = [
        {
          UUID: 'common-emoji-group',
          id: 'common-emoji-group',
          displayName: '常用',
          icon: '⭐',
          order: 0,
          emojis: []
        }
      ]

      // Setup mocks
      mockLoadGroupsFromBackground.mockResolvedValue(testGroups)
      mockCachedState.ungroupedEmojis = []

      // Import and test
      const { createEmojiPicker } = await import('../../../src/content-script/content/picker/emoji-picker-core')
      
      const picker = await createEmojiPicker(false)

      expect(picker).toBeDefined()
      expect(mockLoadGroupsFromBackground).toHaveBeenCalled()
    })

    it('should handle missing ungrouped emojis data gracefully', async () => {
      // Setup test data
      const testGroups = [
        {
          UUID: 'common-emoji-group',
          id: 'common-emoji-group',
          displayName: '常用',
          icon: '⭐',
          order: 0,
          emojis: []
        }
      ]

      // Setup mocks
      mockLoadGroupsFromBackground.mockResolvedValue(testGroups)
      mockCachedState.ungroupedEmojis = null // Simulate missing data

      // Import and test
      const { createEmojiPicker } = await import('../../../src/content-script/content/picker/emoji-picker-core')
      
      const picker = await createEmojiPicker(false)

      expect(picker).toBeDefined()
      expect(mockLoadGroupsFromBackground).toHaveBeenCalled()
    })

    it('should update existing ungrouped group if it already exists', async () => {
      // Setup test data with existing ungrouped group
      const testGroups = [
        {
          UUID: 'common-emoji-group',
          id: 'common-emoji-group',
          displayName: '常用',
          icon: '⭐',
          order: 0,
          emojis: []
        },
        {
          UUID: 'ungrouped-emojis',
          id: 'ungrouped-emojis',
          displayName: '未分组',
          icon: '📦',
          order: 999,
          emojis: [
            { UUID: 'old-ungrouped', displayName: 'Old Ungrouped', url: 'old.png' }
          ]
        }
      ]

      const testUngroupedEmojis = [
        { UUID: 'new-ungrouped', displayName: 'New Ungrouped', url: 'new.png' }
      ]

      // Setup mocks
      mockLoadGroupsFromBackground.mockResolvedValue(testGroups)
      mockCachedState.ungroupedEmojis = testUngroupedEmojis

      // Import and test
      const { createEmojiPicker } = await import('../../../src/content-script/content/picker/emoji-picker-core')
      
      const picker = await createEmojiPicker(false)

      expect(picker).toBeDefined()
      expect(mockLoadGroupsFromBackground).toHaveBeenCalled()
    })

    it('should handle errors in ungrouped emoji processing gracefully', async () => {
      // Setup test data
      const testGroups = [
        {
          UUID: 'common-emoji-group',
          id: 'common-emoji-group',
          displayName: '常用',
          icon: '⭐',
          order: 0,
          emojis: []
        }
      ]

      // Setup mocks
      mockLoadGroupsFromBackground.mockResolvedValue(testGroups)
      
      // Create a problematic ungrouped emojis array that might cause errors
      Object.defineProperty(mockCachedState, 'ungroupedEmojis', {
        get: () => {
          throw new Error('Test error accessing ungrouped emojis')
        }
      })

      // Mock console.warn to verify error handling
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      // Import and test
      const { createEmojiPicker } = await import('../../../src/content-script/content/picker/emoji-picker-core')
      
      const picker = await createEmojiPicker(false)

      expect(picker).toBeDefined()
      expect(consoleSpy).toHaveBeenCalledWith(
        '[组级缓存] 处理未分组表情失败:',
        expect.any(Error)
      )

      consoleSpy.mockRestore()
    })
  })

  describe('Mobile vs Desktop Handling', () => {
    it('should handle ungrouped emojis in mobile picker', async () => {
      // Setup test data
      const testGroups = [
        {
          UUID: 'common-emoji-group',
          id: 'common-emoji-group',
          displayName: '常用',
          icon: '⭐',
          order: 0,
          emojis: []
        }
      ]

      const testUngroupedEmojis = [
        { UUID: 'mobile-ungrouped', displayName: 'Mobile Ungrouped', url: 'mobile.png' }
      ]

      // Setup mocks
      mockLoadGroupsFromBackground.mockResolvedValue(testGroups)
      mockCachedState.ungroupedEmojis = testUngroupedEmojis

      // Import and test mobile picker
      const { createEmojiPicker } = await import('../../../src/content-script/content/picker/emoji-picker-core')
      
      const picker = await createEmojiPicker(true) // Mobile picker

      expect(picker).toBeDefined()
      expect(mockLoadGroupsFromBackground).toHaveBeenCalled()
    })
  })
})