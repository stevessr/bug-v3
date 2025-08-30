// 存储一致性检查器
import type { EmojiGroup, Emoji } from './communication'

// Chrome Storage API 声明
declare const chrome: {
  storage?: {
    local?: {
      get?(keys: string[] | string | null, callback: (items: any) => void): void
      set?(items: Record<string, any>, callback?: () => void): void
    }
  }
  runtime?: {
    lastError?: any
  }
}

// 存储差异接口
export interface StorageDifference {
  key: string
  type: 'missing-in-chrome' | 'missing-in-local' | 'value-mismatch' | 'timestamp-mismatch'
  chromeValue?: any
  localValue?: any
  chromeTimestamp?: number
  localTimestamp?: number
  severity: 'low' | 'medium' | 'high'
  description: string
}

// 一致性检查结果接口
export interface ConsistencyResult {
  isConsistent: boolean
  differences: StorageDifference[]
  checkedKeys: string[]
  timestamp: number
  summary: {
    total: number
    missing: number
    mismatched: number
    resolved: number
  }
}

// 冲突解决策略
export type ConflictResolutionStrategy = 'chrome-wins' | 'local-wins' | 'newest-wins' | 'merge' | 'manual'

// 存储一致性检查器类
export class ConsistencyChecker {
  private readonly STORAGE_KEYS = [
    'emojiGroups-common',
    'ungrouped-emojis',
    'emoji-order-cache',
    'emojiGroups-index'
  ]

  constructor() {
    console.log('[ConsistencyChecker] Consistency checker initialized')
  }

  /**
   * 比较 Chrome Storage 和 localStorage 中的数据
   */
  async compareStorages(): Promise<ConsistencyResult> {
    console.log('[ConsistencyChecker] Starting storage comparison')
    
    const result: ConsistencyResult = {
      isConsistent: true,
      differences: [],
      checkedKeys: [],
      timestamp: Date.now(),
      summary: {
        total: 0,
        missing: 0,
        mismatched: 0,
        resolved: 0
      }
    }

    try {
      // 获取 Chrome Storage 数据
      const chromeData = await this.getChromeStorageData()
      
      // 获取 localStorage 数据
      const localData = this.getLocalStorageData()
      
      // 检查每个关键存储键
      for (const key of this.STORAGE_KEYS) {
        result.checkedKeys.push(key)
        const differences = this.compareKeyData(key, chromeData[key], localData[key])
        result.differences.push(...differences)
      }

      // 检查额外的表情组键
      const additionalKeys = this.findAdditionalEmojiGroupKeys(chromeData, localData)
      for (const key of additionalKeys) {
        if (!result.checkedKeys.includes(key)) {
          result.checkedKeys.push(key)
          const differences = this.compareKeyData(key, chromeData[key], localData[key])
          result.differences.push(...differences)
        }
      }

      // 更新结果统计
      result.isConsistent = result.differences.length === 0
      result.summary.total = result.differences.length
      result.summary.missing = result.differences.filter(d => d.type.includes('missing')).length
      result.summary.mismatched = result.differences.filter(d => d.type.includes('mismatch')).length

      console.log(`[ConsistencyChecker] Comparison completed. Found ${result.differences.length} differences`)
      
    } catch (error) {
      console.error('[ConsistencyChecker] Error during storage comparison:', error)
      throw error
    }

    return result
  }

  /**
   * 比较单个键的数据
   */
  private compareKeyData(key: string, chromeValue: any, localValue: any): StorageDifference[] {
    const differences: StorageDifference[] = []

    // 检查是否缺失
    if (chromeValue === undefined && localValue !== undefined) {
      differences.push({
        key,
        type: 'missing-in-chrome',
        localValue,
        severity: this.getSeverityForKey(key),
        description: `Key "${key}" exists in localStorage but missing in Chrome storage`
      })
    } else if (chromeValue !== undefined && localValue === undefined) {
      differences.push({
        key,
        type: 'missing-in-local',
        chromeValue,
        severity: this.getSeverityForKey(key),
        description: `Key "${key}" exists in Chrome storage but missing in localStorage`
      })
    } else if (chromeValue !== undefined && localValue !== undefined) {
      // 两者都存在，比较内容
      const contentDifferences = this.compareContent(key, chromeValue, localValue)
      differences.push(...contentDifferences)
    }

    return differences
  }

  /**
   * 比较内容
   */
  private compareContent(key: string, chromeValue: any, localValue: any): StorageDifference[] {
    const differences: StorageDifference[] = []

    try {
      // 深度比较对象
      if (typeof chromeValue === 'object' && typeof localValue === 'object') {
        if (!this.deepEqual(chromeValue, localValue)) {
          // 检查时间戳差异
          const chromeTimestamp = this.extractTimestamp(chromeValue)
          const localTimestamp = this.extractTimestamp(localValue)

          if (chromeTimestamp && localTimestamp && chromeTimestamp !== localTimestamp) {
            differences.push({
              key,
              type: 'timestamp-mismatch',
              chromeValue,
              localValue,
              chromeTimestamp,
              localTimestamp,
              severity: 'medium',
              description: `Key "${key}" has different timestamps (Chrome: ${new Date(chromeTimestamp).toISOString()}, Local: ${new Date(localTimestamp).toISOString()})`
            })
          } else {
            differences.push({
              key,
              type: 'value-mismatch',
              chromeValue,
              localValue,
              severity: this.getSeverityForKey(key),
              description: `Key "${key}" has different values between Chrome storage and localStorage`
            })
          }
        }
      } else {
        // 简单值比较
        if (chromeValue !== localValue) {
          differences.push({
            key,
            type: 'value-mismatch',
            chromeValue,
            localValue,
            severity: this.getSeverityForKey(key),
            description: `Key "${key}" has different values (Chrome: ${JSON.stringify(chromeValue)}, Local: ${JSON.stringify(localValue)})`
          })
        }
      }
    } catch (error) {
      console.error(`[ConsistencyChecker] Error comparing content for key ${key}:`, error)
      differences.push({
        key,
        type: 'value-mismatch',
        chromeValue,
        localValue,
        severity: 'high',
        description: `Key "${key}" comparison failed due to error: ${error}`
      })
    }

    return differences
  }

  /**
   * 解决数据冲突
   */
  async resolveConflicts(
    differences: StorageDifference[], 
    strategy: ConflictResolutionStrategy = 'newest-wins'
  ): Promise<{ resolved: number; failed: number; errors: string[] }> {
    console.log(`[ConsistencyChecker] Resolving ${differences.length} conflicts using strategy: ${strategy}`)
    
    let resolved = 0
    let failed = 0
    const errors: string[] = []

    for (const difference of differences) {
      try {
        const success = await this.resolveConflict(difference, strategy)
        if (success) {
          resolved++
        } else {
          failed++
        }
      } catch (error) {
        failed++
        const errorMessage = `Failed to resolve conflict for key ${difference.key}: ${error}`
        errors.push(errorMessage)
        console.error('[ConsistencyChecker]', errorMessage)
      }
    }

    console.log(`[ConsistencyChecker] Conflict resolution completed. Resolved: ${resolved}, Failed: ${failed}`)
    return { resolved, failed, errors }
  }

  /**
   * 解决单个冲突
   */
  private async resolveConflict(
    difference: StorageDifference, 
    strategy: ConflictResolutionStrategy
  ): Promise<boolean> {
    try {
      switch (strategy) {
        case 'chrome-wins':
          return await this.applyChromeValue(difference)
        
        case 'local-wins':
          return await this.applyLocalValue(difference)
        
        case 'newest-wins':
          return await this.applyNewestValue(difference)
        
        case 'merge':
          return await this.mergeValues(difference)
        
        case 'manual':
          console.log(`[ConsistencyChecker] Manual resolution required for key: ${difference.key}`)
          return false
        
        default:
          console.warn(`[ConsistencyChecker] Unknown resolution strategy: ${strategy}`)
          return false
      }
    } catch (error) {
      console.error(`[ConsistencyChecker] Error resolving conflict for key ${difference.key}:`, error)
      return false
    }
  }

  /**
   * 应用 Chrome Storage 的值
   */
  private async applyChromeValue(difference: StorageDifference): Promise<boolean> {
    if (difference.type === 'missing-in-local' || difference.type === 'value-mismatch' || difference.type === 'timestamp-mismatch') {
      return this.updateLocalStorage(difference.key, difference.chromeValue)
    }
    return false
  }

  /**
   * 应用 localStorage 的值
   */
  private async applyLocalValue(difference: StorageDifference): Promise<boolean> {
    if (difference.type === 'missing-in-chrome' || difference.type === 'value-mismatch' || difference.type === 'timestamp-mismatch') {
      return await this.updateChromeStorage(difference.key, difference.localValue)
    }
    return false
  }

  /**
   * 应用最新的值（基于时间戳）
   */
  private async applyNewestValue(difference: StorageDifference): Promise<boolean> {
    if (difference.type === 'timestamp-mismatch') {
      const chromeTimestamp = difference.chromeTimestamp || 0
      const localTimestamp = difference.localTimestamp || 0
      
      if (chromeTimestamp > localTimestamp) {
        return this.updateLocalStorage(difference.key, difference.chromeValue)
      } else {
        return await this.updateChromeStorage(difference.key, difference.localValue)
      }
    } else if (difference.type === 'missing-in-chrome') {
      return await this.updateChromeStorage(difference.key, difference.localValue)
    } else if (difference.type === 'missing-in-local') {
      return this.updateLocalStorage(difference.key, difference.chromeValue)
    } else {
      // 对于值不匹配但没有时间戳的情况，默认使用 Chrome 的值
      return this.updateLocalStorage(difference.key, difference.chromeValue)
    }
  }

  /**
   * 合并值（适用于数组和对象）
   */
  private async mergeValues(difference: StorageDifference): Promise<boolean> {
    try {
      let mergedValue: any

      if (Array.isArray(difference.chromeValue) && Array.isArray(difference.localValue)) {
        // 合并数组，去重
        mergedValue = this.mergeArrays(difference.chromeValue, difference.localValue)
      } else if (
        typeof difference.chromeValue === 'object' && 
        typeof difference.localValue === 'object' &&
        difference.chromeValue !== null && 
        difference.localValue !== null
      ) {
        // 合并对象
        mergedValue = this.mergeObjects(difference.chromeValue, difference.localValue)
      } else {
        // 无法合并，使用最新值策略
        return await this.applyNewestValue(difference)
      }

      // 同时更新两个存储
      const chromeSuccess = await this.updateChromeStorage(difference.key, mergedValue)
      const localSuccess = this.updateLocalStorage(difference.key, mergedValue)
      
      return chromeSuccess && localSuccess
    } catch (error) {
      console.error(`[ConsistencyChecker] Error merging values for key ${difference.key}:`, error)
      return false
    }
  }

  /**
   * 验证数据完整性
   */
  validateDataIntegrity(data: any): boolean {
    try {
      // 验证常用表情组
      if (data['emojiGroups-common']) {
        if (!this.validateEmojiGroup(data['emojiGroups-common'])) {
          console.warn('[ConsistencyChecker] Invalid common emoji group structure')
          return false
        }
      }

      // 验证未分组表情
      if (data['ungrouped-emojis']) {
        if (!Array.isArray(data['ungrouped-emojis'])) {
          console.warn('[ConsistencyChecker] Ungrouped emojis should be an array')
          return false
        }
        
        for (const emoji of data['ungrouped-emojis']) {
          if (!this.validateEmoji(emoji)) {
            console.warn('[ConsistencyChecker] Invalid emoji in ungrouped emojis')
            return false
          }
        }
      }

      // 验证表情组索引
      if (data['emojiGroups-index']) {
        if (!Array.isArray(data['emojiGroups-index'])) {
          console.warn('[ConsistencyChecker] Emoji groups index should be an array')
          return false
        }
      }

      console.log('[ConsistencyChecker] Data integrity validation passed')
      return true
    } catch (error) {
      console.error('[ConsistencyChecker] Error during data integrity validation:', error)
      return false
    }
  }

  /**
   * 获取 Chrome Storage 数据
   */
  private getChromeStorageData(): Promise<any> {
    return new Promise((resolve, reject) => {
      try {
        if (chrome.storage && chrome.storage.local && chrome.storage.local.get) {
          chrome.storage.local.get(null, (items) => {
            if (chrome.runtime && chrome.runtime.lastError) {
              reject(chrome.runtime.lastError)
            } else {
              resolve(items || {})
            }
          })
        } else {
          resolve({})
        }
      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * 获取 localStorage 数据
   */
  private getLocalStorageData(): any {
    const data: any = {}
    
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && (this.STORAGE_KEYS.includes(key) || key.startsWith('emojiGroups-'))) {
          try {
            const value = localStorage.getItem(key)
            if (value) {
              data[key] = JSON.parse(value)
            }
          } catch (parseError) {
            console.warn(`[ConsistencyChecker] Failed to parse localStorage item ${key}:`, parseError)
          }
        }
      }
    } catch (error) {
      console.error('[ConsistencyChecker] Failed to read localStorage:', error)
    }
    
    return data
  }

  /**
   * 查找额外的表情组键
   */
  private findAdditionalEmojiGroupKeys(chromeData: any, localData: any): string[] {
    const keys = new Set<string>()
    
    // 从 Chrome Storage 中查找
    Object.keys(chromeData).forEach(key => {
      if (key.startsWith('emojiGroups-') && !this.STORAGE_KEYS.includes(key)) {
        keys.add(key)
      }
    })
    
    // 从 localStorage 中查找
    Object.keys(localData).forEach(key => {
      if (key.startsWith('emojiGroups-') && !this.STORAGE_KEYS.includes(key)) {
        keys.add(key)
      }
    })
    
    return Array.from(keys)
  }

  /**
   * 更新 localStorage
   */
  private updateLocalStorage(key: string, value: any): boolean {
    try {
      localStorage.setItem(key, JSON.stringify(value))
      console.log(`[ConsistencyChecker] Updated localStorage key: ${key}`)
      return true
    } catch (error) {
      console.error(`[ConsistencyChecker] Failed to update localStorage key ${key}:`, error)
      return false
    }
  }

  /**
   * 更新 Chrome Storage
   */
  private updateChromeStorage(key: string, value: any): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        if (chrome.storage && chrome.storage.local && chrome.storage.local.set) {
          chrome.storage.local.set({ [key]: value }, () => {
            if (chrome.runtime && chrome.runtime.lastError) {
              console.error(`[ConsistencyChecker] Failed to update Chrome storage key ${key}:`, chrome.runtime.lastError)
              resolve(false)
            } else {
              console.log(`[ConsistencyChecker] Updated Chrome storage key: ${key}`)
              resolve(true)
            }
          })
        } else {
          resolve(false)
        }
      } catch (error) {
        console.error(`[ConsistencyChecker] Failed to update Chrome storage key ${key}:`, error)
        resolve(false)
      }
    })
  }

  // 辅助方法
  private getSeverityForKey(key: string): StorageDifference['severity'] {
    if (key === 'emojiGroups-common') return 'high'
    if (key.startsWith('emojiGroups-')) return 'medium'
    return 'low'
  }

  private extractTimestamp(value: any): number | null {
    if (value && typeof value === 'object') {
      return value.lastUpdated || value.timestamp || null
    }
    return null
  }

  private deepEqual(obj1: any, obj2: any): boolean {
    try {
      return JSON.stringify(obj1) === JSON.stringify(obj2)
    } catch {
      return false
    }
  }

  private mergeArrays(arr1: any[], arr2: any[]): any[] {
    const merged = [...arr1]
    for (const item of arr2) {
      if (!merged.some(existing => this.deepEqual(existing, item))) {
        merged.push(item)
      }
    }
    return merged
  }

  private mergeObjects(obj1: any, obj2: any): any {
    return {
      ...obj1,
      ...obj2,
      lastUpdated: Math.max(obj1.lastUpdated || 0, obj2.lastUpdated || 0) || Date.now()
    }
  }

  private validateEmojiGroup(group: any): boolean {
    return group && 
           typeof group.UUID === 'string' && 
           typeof group.displayName === 'string' && 
           Array.isArray(group.emojis)
  }

  private validateEmoji(emoji: any): boolean {
    return emoji && 
           typeof emoji.UUID === 'string' && 
           typeof emoji.displayName === 'string'
  }
}

export default ConsistencyChecker