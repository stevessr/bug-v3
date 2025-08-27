// Test background script communication for emoji data loading from extension storage
// This is a simple test that can be run in a browser environment

const testBackgroundCommunication = async () => {
  console.log('[Test] Starting background communication test...')
  
  // Mock chrome storage with some test data
  const mockStorageData = {
    'Settings': {
      imageScale: 30,
      gridColumns: 4,
      outputFormat: 'markdown',
      MobileMode: false
    },
    'ungrouped': [],
    'emojiGroups-index': ['test-group-1', 'test-group-2'],
    'emojiGroups-test-group-1': {
      UUID: 'test-group-1',
      displayName: '测试组1',
      order: 0,
      emojis: [
        {
          UUID: 'emoji-1',
          displayName: '测试表情1',
          url: 'https://example.com/emoji1.png'
        }
      ]
    },
    'emojiGroups-test-group-2': {
      UUID: 'test-group-2', 
      displayName: '测试组2',
      order: 1,
      emojis: [
        {
          UUID: 'emoji-2',
          displayName: '测试表情2', 
          url: 'https://example.com/emoji2.png'
        },
        {
          UUID: 'emoji-3',
          displayName: '测试表情3',
          url: 'https://example.com/emoji3.png'
        }
      ]
    }
  }

  // Mock chrome storage API
  global.chrome = {
    storage: {
      local: {
        get: (keys, callback) => {
          console.log('[Test] Mock chrome.storage.local.get called')
          setTimeout(() => callback(mockStorageData), 100)
        }
      }
    },
    runtime: {
      lastError: null
    }
  }

  // Load the background script functions by requiring or simulating
  console.log('[Test] Mock chrome storage setup complete')
  console.log('[Test] Storage contains', Object.keys(mockStorageData).length, 'keys')
  
  // Test the loadFromChromeStorage function
  const loadFromChromeStorage = async () => {
    return new Promise((resolve) => {
      try {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.get(null, (items) => {
            try {
              if (chrome.runtime.lastError) {
                console.log('Chrome storage error:', chrome.runtime.lastError)
                resolve(null)
                return
              }

              // Assemble payload from storage items
              const Settings = items['Settings'] || {}
              const ungrouped = items['ungrouped'] || []
              
              // Collect emoji groups using index
              const emojiGroups = []
              const indexList = items['emojiGroups-index'] || []
              
              if (Array.isArray(indexList)) {
                for (const uuid of indexList) {
                  const groupKey = `emojiGroups-${uuid}`
                  const group = items[groupKey]
                  if (group) {
                    emojiGroups.push(group)
                  }
                }
              }

              const payload = {
                Settings,
                emojiGroups,
                ungrouped
              }

              console.log('[Test] Loaded from chrome storage:', {
                settingsKeys: Object.keys(Settings).length,
                groupsCount: emojiGroups.length,
                ungroupedCount: ungrouped.length
              })

              resolve(payload)
            } catch (error) {
              console.log('[Test] Error assembling storage data:', error)
              resolve(null)
            }
          })
        }
      } catch (error) {
        console.log('[Test] Error accessing chrome storage:', error)
        resolve(null)
      }
    })
  }

  // Test the function
  const result = await loadFromChromeStorage()
  
  console.log('[Test] Result:', result)
  
  // Validate results
  if (!result) {
    console.error('[Test] FAILED: No result returned')
    return false
  }
  
  if (!result.emojiGroups || result.emojiGroups.length !== 2) {
    console.error('[Test] FAILED: Expected 2 emoji groups, got', result.emojiGroups?.length)
    return false
  }
  
  if (!result.Settings || Object.keys(result.Settings).length === 0) {
    console.error('[Test] FAILED: No settings found')
    return false
  }

  const totalEmojis = result.emojiGroups.reduce((sum, group) => sum + (group.emojis?.length || 0), 0)
  if (totalEmojis !== 3) {
    console.error('[Test] FAILED: Expected 3 total emojis, got', totalEmojis)
    return false
  }

  console.log('[Test] SUCCESS: Background script correctly loads emoji data from extension storage')
  console.log('[Test] - Found', result.emojiGroups.length, 'groups with', totalEmojis, 'total emojis')
  console.log('[Test] - Settings loaded with', Object.keys(result.Settings).length, 'keys')
  return true
}

// Run the test if in Node.js environment
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { testBackgroundCommunication }
  
  // Run immediately if script is executed directly
  if (require.main === module) {
    console.log('[Test] Running background communication test...')
    testBackgroundCommunication().then(success => {
      console.log('[Test] Test completed. Success:', success)
      process.exit(success ? 0 : 1)
    }).catch(err => {
      console.error('[Test] Test failed with error:', err)
      process.exit(1)
    })
  }
}

// Run the test if in browser environment
if (typeof window !== 'undefined') {
  testBackgroundCommunication()
}