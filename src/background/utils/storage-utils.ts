// background/utils/storage-utils.ts - 存储相关工具函数

declare const chrome: any

function log(...args: any[]) {
  try {
    console.log('[background:storage-utils]', ...args)
  } catch (_) {}
}

/**
 * 从Chrome Storage直接加载表情数据
 * @returns Promise<any> 返回加载的数据负载
 */
export async function loadFromChromeStorage(): Promise<any> {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      return new Promise((resolve) => {
        chrome.storage.local.get(null, (items: any) => {
          try {
            if (chrome.runtime.lastError) {
              log('Chrome storage error:', chrome.runtime.lastError)
              resolve(null)
              return
            }

            // Assemble payload from storage items
            const Settings = items['Settings'] || {}
            const ungrouped = items['ungrouped'] || []

            // Collect emoji groups using index
            const emojiGroups: any[] = []
            const indexList = items['emojiGroups-index'] || []

            // 首先添加常用表情组（使用正确的存储键）
            const commonGroup = items['emojiGroups-common']
            if (commonGroup) {
              emojiGroups.push(commonGroup)
            }

            if (Array.isArray(indexList)) {
              for (const uuid of indexList) {
                // 跳过常用表情组，因为已经添加了
                if (uuid === 'common') continue
                
                const groupKey = `emojiGroups-${uuid}`
                const group = items[groupKey]
                if (group) {
                  emojiGroups.push(group)
                }
              }
            }

            // If no groups found via index, scan for all emojiGroups-* keys
            if (emojiGroups.length === 0 || !commonGroup) {
              Object.keys(items).forEach((key) => {
                if (key.startsWith('emojiGroups-') && key !== 'emojiGroups-index') {
                  const group = items[key]
                  if (group && !emojiGroups.some(g => g.UUID === group.UUID)) {
                    emojiGroups.push(group)
                  }
                }
              })
            }

            const payload = {
              Settings,
              emojiGroups,
              ungrouped,
            }

            log('Loaded from chrome storage:', {
              settingsKeys: Object.keys(Settings).length,
              groupsCount: emojiGroups.length,
              ungroupedCount: ungrouped.length,
              hasCommonGroup: emojiGroups.some(g => g.UUID === 'common-emoji-group')
            })

            resolve(payload)
          } catch (error) {
            log('Error assembling storage data:', error)
            resolve(null)
          }
        })
      })
    }
  } catch (error) {
    log('Error accessing chrome storage:', error)
  }
  return null
}

/**
 * 确保常用表情组在Chrome Storage中存在
 */
export async function ensureCommonEmojiGroupInStorage(): Promise<void> {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['emojiGroups-common'], (result: any) => {
        if (chrome.runtime.lastError) {
          log('Error checking common emoji group:', chrome.runtime.lastError)
          return
        }
        
        if (!result['emojiGroups-common']) {
          const commonGroup = {
            UUID: 'common-emoji-group',
            id: 'common-emoji-group', 
            displayName: '常用',
            icon: '⭐',
            order: 0,
            emojis: [],
            originalId: 'favorites'
          }
          
          chrome.storage.local.set({ 'emojiGroups-common': commonGroup }, () => {
            if (chrome.runtime.lastError) {
              log('Error creating common emoji group:', chrome.runtime.lastError)
            } else {
              log('Successfully created common emoji group in storage')
            }
          })
        }
      })
    }
  } catch (error) {
    log('Error ensuring common emoji group in storage:', error)
  }
}

/**
 * 向Chrome Storage保存表情组数据
 * @param groups 表情组数组
 */
export function saveEmojiGroupsToStorage(groups: any[]): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const saveData: any = {}
        
        groups.forEach((group: any) => {
          // 使用正确的存储键名
          if (group.UUID === 'common-emoji-group') {
            saveData['emojiGroups-common'] = group
          } else {
            saveData[`emojiGroups-${group.UUID}`] = group
          }
        })
        
        chrome.storage.local.set(saveData, () => {
          if (chrome.runtime.lastError) {
            log('Error saving emoji groups to storage:', chrome.runtime.lastError)
            reject(chrome.runtime.lastError)
          } else {
            log('Successfully saved emoji groups to storage')
            resolve()
          }
        })
      } else {
        reject(new Error('Chrome storage not available'))
      }
    } catch (error) {
      log('Error in saveEmojiGroupsToStorage:', error)
      reject(error)
    }
  })
}

/**
 * 添加遥测数据到存储
 * @param ev 事件数据
 */
export function appendTelemetry(ev: any) {
  try {
    const item = { ts: Date.now(), ...ev }
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['sync_telemetry'], (res: any) => {
        try {
          const arr = Array.isArray(res?.sync_telemetry) ? res.sync_telemetry : []
          arr.push(item)
          // keep telemetry short
          if (arr.length > 200) arr.splice(0, arr.length - 200)
          chrome.storage.local.set({ sync_telemetry: arr })
        } catch (_) {}
      })
    }
  } catch (_) {}
}

/**
 * 获取存储使用统计
 */
export async function getStorageUsageStats(): Promise<any> {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      return new Promise((resolve) => {
        chrome.storage.local.getBytesInUse(null, (bytesInUse: number) => {
          if (chrome.runtime.lastError) {
            log('Error getting storage usage:', chrome.runtime.lastError)
            resolve({ error: chrome.runtime.lastError.message })
          } else {
            chrome.storage.local.get(null, (items: any) => {
              if (chrome.runtime.lastError) {
                resolve({ bytesInUse, error: chrome.runtime.lastError.message })
              } else {
                const stats = {
                  bytesInUse,
                  totalKeys: Object.keys(items).length,
                  emojiGroups: Object.keys(items).filter(k => k.startsWith('emojiGroups-')).length,
                  hasSettings: !!items.Settings,
                  hasUngrouped: !!items.ungrouped,
                }
                resolve(stats)
              }
            })
          }
        })
      })
    }
  } catch (error) {
    log('Error getting storage usage stats:', error)
    return { error: error instanceof Error ? error.message : String(error) }
  }
  return { error: 'Chrome storage not available' }
}