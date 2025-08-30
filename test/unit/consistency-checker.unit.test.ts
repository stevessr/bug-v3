import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ConsistencyChecker, type StorageDifference, type ConsistencyResult } from '../../src/services/ConsistencyChecker'

describe('ConsistencyChecker', () => {
  let consistencyChecker: ConsistencyChecker
  let mockChrome: any
  let mockLocalStorage: any

  beforeEach(() => {
    // Mock Chrome API
    mockChrome = {
      storage: {
        local: {
          get: vi.fn(),
          set: vi.fn()
        }
      },
      runtime: {
        lastError: null
      }
    }
    global.chrome = mockChrome

    // Mock localStorage
    mockLocalStorage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      length: 0,
      key: vi.fn()
    }
    global.localStorage = mockLocalStorage

    consistencyChecker = new ConsistencyChecker()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Initialization', () => {
    it('should initialize successfully', () => {
      expect(consistencyChecker).toBeInstanceOf(ConsistencyChecker)
    })
  })

  describe('Storage Comparison', () => {
    it('should detect no differences when storages are consistent', async () => {
      const testData = {
        'emojiGroups-common': {
          UUID: 'common-emoji-group',
          displayName: '常用',
          emojis: [],
          lastUpdated: Date.now()
        }
      }

      // Mock Chrome storage
      mockChrome.storage.local.get.mockImplementation((keys, callback) => {
        callback(testData)
      })

      // Mock localStorage
      mockLocalStorage.length = 1
      mockLocalStorage.key.mockReturnValue('emojiGroups-common')
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(testData['emojiGroups-common']))

      const result = await consistencyChecker.compareStorages()

      expect(result.isConsistent).toBe(true)
      expect(result.differences).toHaveLength(0)
      expect(result.checkedKeys).toContain('emojiGroups-common')
    })

    it('should detect missing data in Chrome storage', async () => {
      const localData = {
        UUID: 'common-emoji-group',
        displayName: '常用',
        emojis: []
      }

      // Mock Chrome storage (empty)
      mockChrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({})
      })

      // Mock localStorage (has data)
      mockLocalStorage.length = 1
      mockLocalStorage.key.mockReturnValue('emojiGroups-common')
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(localData))

      const result = await consistencyChecker.compareStorages()

      expect(result.isConsistent).toBe(false)
      expect(result.differences).toHaveLength(1)
      expect(result.differences[0].type).toBe('missing-in-chrome')
      expect(result.differences[0].key).toBe('emojiGroups-common')
    })

    it('should detect missing data in localStorage', async () => {
      const chromeData = {
        'emojiGroups-common': {
          UUID: 'common-emoji-group',
          displayName: '常用',
          emojis: []
        }
      }

      // Mock Chrome storage (has data)
      mockChrome.storage.local.get.mockImplementation((keys, callback) => {
        callback(chromeData)
      })

      // Mock localStorage (empty)
      mockLocalStorage.length = 0
      mockLocalStorage.key.mockReturnValue(null)
      mockLocalStorage.getItem.mockReturnValue(null)

      const result = await consistencyChecker.compareStorages()

      expect(result.isConsistent).toBe(false)
      expect(result.differences).toHaveLength(1)
      expect(result.differences[0].type).toBe('missing-in-local')
      expect(result.differences[0].key).toBe('emojiGroups-common')
    })

    it('should detect value mismatches', async () => {
      const chromeData = {
        'emojiGroups-common': {
          UUID: 'common-emoji-group',
          displayName: '常用',
          emojis: [{ UUID: 'emoji1', displayName: 'Emoji 1' }]
        }
      }

      const localData = {
        UUID: 'common-emoji-group',
        displayName: '常用',
        emojis: [{ UUID: 'emoji2', displayName: 'Emoji 2' }]
      }

      // Mock Chrome storage
      mockChrome.storage.local.get.mockImplementation((keys, callback) => {
        callback(chromeData)
      })

      // Mock localStorage
      mockLocalStorage.length = 1
      mockLocalStorage.key.mockReturnValue('emojiGroups-common')
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(localData))

      const result = await consistencyChecker.compareStorages()

      expect(result.isConsistent).toBe(false)
      expect(result.differences).toHaveLength(1)
      expect(result.differences[0].type).toBe('value-mismatch')
    })

    it('should detect timestamp mismatches', async () => {
      const now = Date.now()
      const chromeData = {
        'emojiGroups-common': {
          UUID: 'common-emoji-group',
          displayName: '常用',
          emojis: [],
          lastUpdated: now
        }
      }

      const localData = {
        UUID: 'common-emoji-group',
        displayName: '常用',
        emojis: [],
        lastUpdated: now - 1000
      }

      // Mock Chrome storage
      mockChrome.storage.local.get.mockImplementation((keys, callback) => {
        callback(chromeData)
      })

      // Mock localStorage
      mockLocalStorage.length = 1
      mockLocalStorage.key.mockReturnValue('emojiGroups-common')
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(localData))

      const result = await consistencyChecker.compareStorages()

      expect(result.isConsistent).toBe(false)
      expect(result.differences).toHaveLength(1)
      expect(result.differences[0].type).toBe('timestamp-mismatch')
      expect(result.differences[0].chromeTimestamp).toBe(now)
      expect(result.differences[0].localTimestamp).toBe(now - 1000)
    })

    it('should handle Chrome storage errors', async () => {
      mockChrome.storage.local.get.mockImplementation((keys, callback) => {
        mockChrome.runtime.lastError = new Error('Storage error')
        callback(null)
      })

      await expect(consistencyChecker.compareStorages()).rejects.toThrow('Storage error')
    })
  })

  describe('Conflict Resolution', () => {
    let testDifference: StorageDifference

    beforeEach(() => {
      testDifference = {
        key: 'emojiGroups-common',
        type: 'value-mismatch',
        chromeValue: { emojis: ['chrome'] },
        localValue: { emojis: ['local'] },
        severity: 'high',
        description: 'Test difference'
      }
    })

    it('should resolve conflicts using chrome-wins strategy', async () => {
      mockChrome.storage.local.set.mockImplementation((items, callback) => {
        if (callback) callback()
      })

      const result = await consistencyChecker.resolveConflicts([testDifference], 'chrome-wins')

      expect(result.resolved).toBe(1)
      expect(result.failed).toBe(0)
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'emojiGroups-common',
        JSON.stringify({ emojis: ['chrome'] })
      )
    })

    it('should resolve conflicts using local-wins strategy', async () => {
      mockChrome.storage.local.set.mockImplementation((items, callback) => {
        if (callback) callback()
      })

      const result = await consistencyChecker.resolveConflicts([testDifference], 'local-wins')

      expect(result.resolved).toBe(1)
      expect(result.failed).toBe(0)
      expect(mockChrome.storage.local.set).toHaveBeenCalledWith(
        { 'emojiGroups-common': { emojis: ['local'] } },
        expect.any(Function)
      )
    })

    it('should resolve conflicts using newest-wins strategy', async () => {
      const now = Date.now()
      const timestampDifference: StorageDifference = {
        key: 'emojiGroups-common',
        type: 'timestamp-mismatch',
        chromeValue: { emojis: ['chrome'], lastUpdated: now },
        localValue: { emojis: ['local'], lastUpdated: now - 1000 },
        chromeTimestamp: now,
        localTimestamp: now - 1000,
        severity: 'medium',
        description: 'Timestamp difference'
      }

      const result = await consistencyChecker.resolveConflicts([timestampDifference], 'newest-wins')

      expect(result.resolved).toBe(1)
      expect(result.failed).toBe(0)
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'emojiGroups-common',
        JSON.stringify({ emojis: ['chrome'], lastUpdated: now })
      )
    })

    it('should merge array values using merge strategy', async () => {
      const arrayDifference: StorageDifference = {
        key: 'ungrouped-emojis',
        type: 'value-mismatch',
        chromeValue: [{ UUID: 'emoji1' }, { UUID: 'emoji2' }],
        localValue: [{ UUID: 'emoji2' }, { UUID: 'emoji3' }],
        severity: 'medium',
        description: 'Array difference'
      }

      mockChrome.storage.local.set.mockImplementation((items, callback) => {
        if (callback) callback()
      })

      const result = await consistencyChecker.resolveConflicts([arrayDifference], 'merge')

      expect(result.resolved).toBe(1)
      expect(result.failed).toBe(0)
      
      // Should merge arrays and remove duplicates
      const expectedMerged = [
        { UUID: 'emoji1' },
        { UUID: 'emoji2' },
        { UUID: 'emoji3' }
      ]
      
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'ungrouped-emojis',
        JSON.stringify(expectedMerged)
      )
    })

    it('should handle resolution errors', async () => {
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error('localStorage error')
      })

      const result = await consistencyChecker.resolveConflicts([testDifference], 'chrome-wins')

      expect(result.resolved).toBe(0)
      expect(result.failed).toBe(1)
      // The error handling is done internally, so we just check the counts
    })

    it('should handle manual resolution strategy', async () => {
      const result = await consistencyChecker.resolveConflicts([testDifference], 'manual')

      expect(result.resolved).toBe(0)
      expect(result.failed).toBe(1)
    })
  })

  describe('Data Integrity Validation', () => {
    it('should validate correct emoji group structure', () => {
      const validData = {
        'emojiGroups-common': {
          UUID: 'common-emoji-group',
          displayName: '常用',
          emojis: [
            {
              UUID: 'emoji1',
              displayName: 'Test Emoji'
            }
          ]
        }
      }

      const result = consistencyChecker.validateDataIntegrity(validData)
      expect(result).toBe(true)
    })

    it('should reject invalid emoji group structure', () => {
      const invalidData = {
        'emojiGroups-common': {
          // Missing UUID
          displayName: '常用',
          emojis: []
        }
      }

      const result = consistencyChecker.validateDataIntegrity(invalidData)
      expect(result).toBe(false)
    })

    it('should validate ungrouped emojis array', () => {
      const validData = {
        'ungrouped-emojis': [
          {
            UUID: 'emoji1',
            displayName: 'Test Emoji'
          }
        ]
      }

      const result = consistencyChecker.validateDataIntegrity(validData)
      expect(result).toBe(true)
    })

    it('should reject invalid ungrouped emojis structure', () => {
      const invalidData = {
        'ungrouped-emojis': 'not an array'
      }

      const result = consistencyChecker.validateDataIntegrity(invalidData)
      expect(result).toBe(false)
    })

    it('should validate emoji groups index', () => {
      const validData = {
        'emojiGroups-index': ['group1', 'group2', 'group3']
      }

      const result = consistencyChecker.validateDataIntegrity(validData)
      expect(result).toBe(true)
    })

    it('should reject invalid emoji groups index', () => {
      const invalidData = {
        'emojiGroups-index': 'not an array'
      }

      const result = consistencyChecker.validateDataIntegrity(invalidData)
      expect(result).toBe(false)
    })

    it('should handle validation errors gracefully', () => {
      const problematicData = {
        'emojiGroups-common': {
          get UUID() {
            throw new Error('Property access error')
          }
        }
      }

      const result = consistencyChecker.validateDataIntegrity(problematicData)
      expect(result).toBe(false)
    })
  })

  describe('Error Handling', () => {
    it('should handle localStorage access errors', async () => {
      mockLocalStorage.key.mockImplementation(() => {
        throw new Error('localStorage error')
      })

      mockChrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({})
      })

      const result = await consistencyChecker.compareStorages()

      expect(result).toBeDefined()
      // The error is handled internally and doesn't prevent the comparison from completing
      expect(result.isConsistent).toBe(true) // No differences found due to error
    })

    it('should handle JSON parse errors in localStorage', async () => {
      mockLocalStorage.length = 1
      mockLocalStorage.key.mockReturnValue('emojiGroups-common')
      mockLocalStorage.getItem.mockReturnValue('invalid json')

      mockChrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({})
      })

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const result = await consistencyChecker.compareStorages()

      expect(result).toBeDefined()
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to parse localStorage item emojiGroups-common'),
        expect.any(Error)
      )

      consoleSpy.mockRestore()
    })

    it('should handle Chrome storage update errors', async () => {
      mockChrome.storage.local.set.mockImplementation((items, callback) => {
        mockChrome.runtime.lastError = new Error('Chrome storage error')
        if (callback) callback()
      })

      const testDifference: StorageDifference = {
        key: 'test-key',
        type: 'missing-in-chrome',
        localValue: { test: 'value' },
        severity: 'medium',
        description: 'Test difference'
      }

      const result = await consistencyChecker.resolveConflicts([testDifference], 'local-wins')

      expect(result.resolved).toBe(0)
      expect(result.failed).toBe(1)
    })
  })
})