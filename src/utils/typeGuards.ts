/**
 * Runtime Type Guards for Storage Data Validation
 * 确保从存储加载的数据符合预期的类型结构
 */

import type { Emoji, EmojiGroup, AppSettings } from '@/types/type'

/**
 * Check if a value is a valid Emoji object
 */
export function isEmoji(data: unknown): data is Emoji {
  if (typeof data !== 'object' || data === null) return false

  const emoji = data as Partial<Emoji>

  return (
    typeof emoji.id === 'string' &&
    typeof emoji.name === 'string' &&
    typeof emoji.url === 'string' &&
    typeof emoji.groupId === 'string'
  )
}

/**
 * Check if an array contains valid Emoji objects
 */
export function isEmojiArray(data: unknown): data is Emoji[] {
  if (!Array.isArray(data)) return false
  return data.every(item => isEmoji(item))
}

/**
 * Check if a value is a valid EmojiGroup object
 */
export function isEmojiGroup(data: unknown): data is EmojiGroup {
  if (typeof data !== 'object' || data === null) return false

  const group = data as Partial<EmojiGroup>

  return (
    typeof group.id === 'string' &&
    typeof group.name === 'string' &&
    Array.isArray(group.emojis) &&
    group.emojis.every(emoji => emoji === null || isEmoji(emoji))
  )
}

/**
 * Check if an array contains valid EmojiGroup objects
 */
export function isEmojiGroupArray(data: unknown): data is EmojiGroup[] {
  if (!Array.isArray(data)) return false
  return data.every(item => isEmojiGroup(item))
}

/**
 * Check if a value is a valid Settings object
 */
export function isSettings(data: unknown): data is AppSettings {
  if (typeof data !== 'object' || data === null) return false

  const settings = data as Partial<AppSettings>

  // 基本字段验证 - 检查实际存在的必需字段
  if (typeof settings.imageScale !== 'number') return false
  if (typeof settings.defaultGroup !== 'string') return false
  if (typeof settings.showSearchBar !== 'boolean') return false
  if (typeof settings.gridColumns !== 'number') return false
  if (
    settings.outputFormat !== undefined &&
    settings.outputFormat !== 'markdown' &&
    settings.outputFormat !== 'html'
  )
    return false

  return true
}

/**
 * Check if a value is a Set of strings (favorites)
 */
export function isFavoritesSet(data: unknown): data is Set<string> {
  if (!(data instanceof Set)) return false
  for (const item of data) {
    if (typeof item !== 'string') return false
  }
  return true
}

/**
 * Validate and sanitize storage data
 * Returns sanitized data or undefined if validation fails
 */
export function validateAndSanitize<T>(
  data: unknown,
  validator: (data: unknown) => data is T,
  fallback?: T
): T | undefined {
  if (validator(data)) {
    return data
  }

  console.warn('[TypeGuard] Validation failed for data:', data)
  return fallback
}

/**
 * Sanitize EmojiGroup by filtering out invalid emojis
 */
export function sanitizeEmojiGroup(group: unknown): EmojiGroup | undefined {
  if (typeof group !== 'object' || group === null) return undefined

  const g = group as Partial<EmojiGroup>

  if (typeof g.id !== 'string' || typeof g.name !== 'string') return undefined

  const validEmojis = Array.isArray(g.emojis) ? g.emojis.filter(e => e && isEmoji(e)) : []

  return {
    id: g.id,
    name: g.name,
    emojis: validEmojis,
    order: typeof g.order === 'number' ? g.order : 0,
    icon: typeof g.icon === 'string' ? g.icon : undefined
  }
}

/**
 * Sanitize EmojiGroup array by filtering out invalid groups and emojis
 */
export function sanitizeEmojiGroupArray(data: unknown): EmojiGroup[] {
  if (!Array.isArray(data)) return []

  return data
    .map(item => sanitizeEmojiGroup(item))
    .filter((group): group is EmojiGroup => group !== undefined)
}
