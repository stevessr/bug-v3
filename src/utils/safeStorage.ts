/**
 * SafeStorage - 统一的本地存储抽象层
 * 提供类型安全、错误处理和统一的存储接口
 */

export type StorageType = 'local' | 'session'

export interface StorageOptions {
  /** 存储前缀，用于避免命名冲突 */
  prefix?: string
  /** 是否在错误时静默失败（不抛出异常） */
  silentFail?: boolean
}

/**
 * SafeStorage 类 - 封装 localStorage 和 sessionStorage
 */
export class SafeStorage {
  private storage: Storage
  private prefix: string
  private silentFail: boolean

  constructor(type: StorageType = 'local', options: StorageOptions = {}) {
    this.storage = type === 'local' ? localStorage : sessionStorage
    this.prefix = options.prefix || ''
    this.silentFail = options.silentFail !== false // 默认为 true
  }

  /**
   * 获取完整的 key（带前缀）
   */
  private getFullKey(key: string): string {
    return this.prefix ? `${this.prefix}:${key}` : key
  }

  /**
   * 获取存储的值
   * @param key 存储键
   * @param defaultValue 默认值
   * @returns 存储的值或默认值
   */
  get<T>(key: string, defaultValue: T): T {
    try {
      const fullKey = this.getFullKey(key)
      const value = this.storage.getItem(fullKey)

      if (value === null) {
        return defaultValue
      }

      // 尝试解析 JSON
      try {
        return JSON.parse(value) as T
      } catch {
        // 如果不是 JSON，直接返回字符串
        return value as unknown as T
      }
    } catch (error) {
      console.warn(`[SafeStorage] Failed to get "${key}":`, error)
      if (!this.silentFail) {
        throw error
      }
      return defaultValue
    }
  }

  /**
   * 设置存储的值
   * @param key 存储键
   * @param value 要存储的值
   * @returns 是否成功
   */
  set<T>(key: string, value: T): boolean {
    try {
      const fullKey = this.getFullKey(key)
      const serialized = JSON.stringify(value)
      this.storage.setItem(fullKey, serialized)
      return true
    } catch (error) {
      // 可能是 QuotaExceededError 或序列化错误
      console.warn(`[SafeStorage] Failed to set "${key}":`, error)
      if (!this.silentFail) {
        throw error
      }
      return false
    }
  }

  /**
   * 删除存储的值
   * @param key 存储键
   * @returns 是否成功
   */
  remove(key: string): boolean {
    try {
      const fullKey = this.getFullKey(key)
      this.storage.removeItem(fullKey)
      return true
    } catch (error) {
      console.warn(`[SafeStorage] Failed to remove "${key}":`, error)
      if (!this.silentFail) {
        throw error
      }
      return false
    }
  }

  /**
   * 检查键是否存在
   * @param key 存储键
   */
  has(key: string): boolean {
    try {
      const fullKey = this.getFullKey(key)
      return this.storage.getItem(fullKey) !== null
    } catch (error) {
      console.warn(`[SafeStorage] Failed to check "${key}":`, error)
      return false
    }
  }

  /**
   * 清空所有存储（带前缀的情况下只清空带前缀的项）
   */
  clear(): boolean {
    try {
      if (!this.prefix) {
        // 没有前缀，清空所有
        this.storage.clear()
        return true
      }

      // 有前缀，只清空带前缀的项
      const keysToRemove: string[] = []
      for (let i = 0; i < this.storage.length; i++) {
        const key = this.storage.key(i)
        if (key && key.startsWith(`${this.prefix}:`)) {
          keysToRemove.push(key)
        }
      }

      keysToRemove.forEach(key => this.storage.removeItem(key))
      return true
    } catch (error) {
      console.warn('[SafeStorage] Failed to clear storage:', error)
      if (!this.silentFail) {
        throw error
      }
      return false
    }
  }

  /**
   * 获取所有键（不含前缀）
   */
  keys(): string[] {
    try {
      const keys: string[] = []
      const prefixLength = this.prefix ? this.prefix.length + 1 : 0

      for (let i = 0; i < this.storage.length; i++) {
        const key = this.storage.key(i)
        if (key) {
          if (this.prefix) {
            // 只返回带前缀的键，并去除前缀
            if (key.startsWith(`${this.prefix}:`)) {
              keys.push(key.substring(prefixLength))
            }
          } else {
            keys.push(key)
          }
        }
      }

      return keys
    } catch (error) {
      console.warn('[SafeStorage] Failed to get keys:', error)
      return []
    }
  }

  /**
   * 获取存储的大小（字节）
   */
  getSize(): number {
    try {
      let size = 0
      for (let i = 0; i < this.storage.length; i++) {
        const key = this.storage.key(i)
        if (key) {
          const value = this.storage.getItem(key)
          if (value) {
            // 计算键和值的字节数（UTF-16）
            size += (key.length + value.length) * 2
          }
        }
      }
      return size
    } catch (error) {
      console.warn('[SafeStorage] Failed to get size:', error)
      return 0
    }
  }
}

/**
 * 便捷导出：预配置的实例
 */
export const safeLocalStorage = new SafeStorage('local')
export const safeSessionStorage = new SafeStorage('session')

/**
 * 创建带前缀的存储实例
 */
export function createPrefixedStorage(
  type: StorageType,
  prefix: string,
  options?: Omit<StorageOptions, 'prefix'>
): SafeStorage {
  return new SafeStorage(type, { ...options, prefix })
}
