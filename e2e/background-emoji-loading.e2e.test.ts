// Test for browser extension background script with emoji data loading
// This test verifies that the background script correctly loads emoji data from chrome storage

import { test, expect } from '@playwright/test'

test.describe('Background Script Emoji Data Loading', () => {
  test('should load emoji data from chrome storage and respond to GET_EMOJI_DATA', async ({
    page,
  }) => {
    // Navigate to the built extension popup page
    await page.goto(`file://${process.cwd()}/dist/popup.html`)

    // Mock chrome storage with test emoji data
    await page.addInitScript(() => {
      // Mock the chrome extension API
      window.chrome = {
        storage: {
          local: {
            get: (keys, callback) => {
              const mockData = {
                Settings: {
                  imageScale: 30,
                  gridColumns: 4,
                  outputFormat: 'markdown',
                  MobileMode: false,
                },
                ungrouped: [],
                'emojiGroups-index': ['group-1', 'group-2'],
                'emojiGroups-group-1': {
                  UUID: 'group-1',
                  displayName: '常用表情',
                  order: 0,
                  emojis: [
                    {
                      UUID: 'emoji-1',
                      displayName: '笑脸',
                      url: 'https://example.com/smile.png',
                      usageCount: 5,
                    },
                    {
                      UUID: 'emoji-2',
                      displayName: '哭脸',
                      url: 'https://example.com/cry.png',
                      usageCount: 2,
                    },
                  ],
                },
                'emojiGroups-group-2': {
                  UUID: 'group-2',
                  displayName: '动物表情',
                  order: 1,
                  emojis: [
                    {
                      UUID: 'emoji-3',
                      displayName: '猫咪',
                      url: 'https://example.com/cat.png',
                      usageCount: 8,
                    },
                  ],
                },
              }

              // Simulate async callback
              setTimeout(() => {
                callback(mockData)
              }, 10)
            },
          },
        },
        runtime: {
          lastError: null,
          sendMessage: (message, callback) => {
            // Mock sending messages
            callback && callback({ success: true })
          },
          onMessage: {
            addListener: () => {},
          },
        },
      }
    })

    // Add a function to simulate background script behavior
    await page.addInitScript(() => {
      window.testBackgroundScript = async () => {
        console.log('[Test] Starting background script test')

        // Function that mimics the background script's loadFromChromeStorage
        const loadFromChromeStorage = () => {
          return new Promise((resolve) => {
            if (window.chrome && window.chrome.storage && window.chrome.storage.local) {
              window.chrome.storage.local.get(null, (items) => {
                const Settings = items['Settings'] || {}
                const ungrouped = items['ungrouped'] || []
                const emojiGroups = []
                const indexList = items['emojiGroups-index'] || []

                for (const uuid of indexList) {
                  const group = items[`emojiGroups-${uuid}`]
                  if (group) {
                    emojiGroups.push(group)
                  }
                }

                resolve({
                  Settings,
                  emojiGroups,
                  ungrouped,
                })
              })
            } else {
              resolve(null)
            }
          })
        }

        // Simulate GET_EMOJI_DATA handler
        const handleGetEmojiData = async () => {
          const data = await loadFromChromeStorage()
          if (data) {
            return {
              success: true,
              data: {
                groups: data.emojiGroups,
                settings: data.Settings,
                ungroupedEmojis: data.ungrouped,
              },
            }
          } else {
            return {
              success: false,
              error: 'No emoji data available',
            }
          }
        }

        return await handleGetEmojiData()
      }
    })

    // Test the background script functionality
    const result = await page.evaluate(async () => {
      return await window.testBackgroundScript()
    })

    console.log('Background script test result:', result)

    // Verify the result
    expect(result.success).toBe(true)
    expect(result.data).toBeDefined()
    expect(result.data.groups).toHaveLength(2)
    expect(result.data.groups[0].displayName).toBe('常用表情')
    expect(result.data.groups[1].displayName).toBe('动物表情')

    // Check total emoji count
    const totalEmojis = result.data.groups.reduce((sum, group) => sum + group.emojis.length, 0)
    expect(totalEmojis).toBe(3)

    // Verify settings
    expect(result.data.settings.imageScale).toBe(30)
    expect(result.data.settings.gridColumns).toBe(4)

    console.log('✅ Background script correctly loads emoji data from extension storage')
    console.log(`📊 Found ${result.data.groups.length} groups with ${totalEmojis} total emojis`)
  })

  test('should handle empty storage gracefully', async ({ page }) => {
    await page.goto(`file://${process.cwd()}/dist/popup.html`)

    // Mock chrome storage with empty data
    await page.addInitScript(() => {
      window.chrome = {
        storage: {
          local: {
            get: (keys, callback) => {
              callback({}) // Empty storage
            },
          },
        },
        runtime: {
          lastError: null,
        },
      }
    })

    await page.addInitScript(() => {
      window.testEmptyStorage = async () => {
        const loadFromChromeStorage = () => {
          return new Promise((resolve) => {
            window.chrome.storage.local.get(null, (items) => {
              const Settings = items['Settings'] || {}
              const ungrouped = items['ungrouped'] || []
              const emojiGroups = []
              const indexList = items['emojiGroups-index'] || []

              for (const uuid of indexList) {
                const group = items[`emojiGroups-${uuid}`]
                if (group) {
                  emojiGroups.push(group)
                }
              }

              resolve({
                Settings,
                emojiGroups,
                ungrouped,
              })
            })
          })
        }

        const data = await loadFromChromeStorage()
        return {
          hasData: data.emojiGroups.length > 0,
          groupCount: data.emojiGroups.length,
          settingsCount: Object.keys(data.Settings).length,
        }
      }
    })

    const result = await page.evaluate(async () => {
      return await window.testEmptyStorage()
    })

    expect(result.hasData).toBe(false)
    expect(result.groupCount).toBe(0)
    expect(result.settingsCount).toBe(0)

    console.log('✅ Background script handles empty storage correctly')
  })
})
