// background/utils/common-group-utils.ts - 常用表情组相关工具

function log(...args: any[]) {
  try {
    console.log('[background:common-group-utils]', ...args)
  } catch (_) {}
}

/**
 * 确保常用表情组存在的函数
 * @param payload 表情数据负载
 * @returns {any} 确保包含常用表情组的负载
 */
export function ensureCommonEmojiGroup(payload: any): any {
  if (!payload) {
    payload = { emojiGroups: [] }
  }
  if (!payload.emojiGroups) {
    payload.emojiGroups = []
  }

  const commonGroupExists = payload.emojiGroups.some(
    (g: any) => g.UUID === 'common-emoji-group'
  )

  if (!commonGroupExists) {
    const commonGroup = {
      UUID: 'common-emoji-group',
      id: 'common-emoji-group',
      displayName: '常用',
      icon: '⭐',
      order: 0,
      emojis: [],
      originalId: 'favorites'
    }
    payload.emojiGroups.unshift(commonGroup)
    log('创建了常用表情组')
  }

  return payload
}

/**
 * 创建默认的常用表情组
 * @returns 默认的常用表情组对象
 */
export function createDefaultCommonGroup(): any {
  return {
    UUID: 'common-emoji-group',
    id: 'common-emoji-group',
    displayName: '常用',
    icon: '⭐',
    order: 0,
    emojis: [],
    originalId: 'favorites'
  }
}

/**
 * 检查数据中是否包含常用表情组
 * @param data 数据对象
 * @returns boolean 是否包含常用表情组
 */
export function hasCommonEmojiGroup(data: any): boolean {
  if (!data || !data.emojiGroups || !Array.isArray(data.emojiGroups)) {
    return false
  }
  
  return data.emojiGroups.some((g: any) => g.UUID === 'common-emoji-group')
}

/**
 * 从数据中获取常用表情组
 * @param data 数据对象
 * @returns 常用表情组对象或null
 */
export function getCommonEmojiGroup(data: any): any | null {
  if (!data || !data.emojiGroups || !Array.isArray(data.emojiGroups)) {
    return null
  }
  
  return data.emojiGroups.find((g: any) => g.UUID === 'common-emoji-group') || null
}

/**
 * 更新数据中的常用表情组
 * @param data 数据对象
 * @param commonGroup 新的常用表情组
 * @returns 更新后的数据
 */
export function updateCommonEmojiGroup(data: any, commonGroup: any): any {
  if (!data) {
    data = { emojiGroups: [] }
  }
  if (!data.emojiGroups) {
    data.emojiGroups = []
  }

  const index = data.emojiGroups.findIndex((g: any) => g.UUID === 'common-emoji-group')
  
  if (index >= 0) {
    // 更新现有的常用表情组
    data.emojiGroups[index] = commonGroup
  } else {
    // 在开头添加新的常用表情组
    data.emojiGroups.unshift(commonGroup)
  }

  return data
}

/**
 * 将常用表情组移动到第一位
 * @param data 数据对象
 * @returns 更新后的数据
 */
export function moveCommonGroupToFirst(data: any): any {
  if (!data || !data.emojiGroups || !Array.isArray(data.emojiGroups)) {
    return data
  }

  const commonGroupIndex = data.emojiGroups.findIndex((g: any) => g.UUID === 'common-emoji-group')
  
  if (commonGroupIndex > 0) {
    // 将常用表情组移动到第一位
    const commonGroup = data.emojiGroups.splice(commonGroupIndex, 1)[0]
    data.emojiGroups.unshift(commonGroup)
    log('将常用表情组移动到第一位')
  }

  return data
}

/**
 * 验证常用表情组的数据结构
 * @param group 常用表情组对象
 * @returns boolean 是否为有效的常用表情组
 */
export function isValidCommonGroup(group: any): boolean {
  if (!group || typeof group !== 'object') {
    return false
  }

  return (
    group.UUID === 'common-emoji-group' &&
    typeof group.displayName === 'string' &&
    Array.isArray(group.emojis) &&
    typeof group.order === 'number'
  )
}

/**
 * 清理常用表情组中的无效表情
 * @param commonGroup 常用表情组对象
 * @returns 清理后的常用表情组
 */
export function cleanupCommonGroup(commonGroup: any): any {
  if (!commonGroup || !Array.isArray(commonGroup.emojis)) {
    return commonGroup
  }

  // 过滤掉无效的表情
  commonGroup.emojis = commonGroup.emojis.filter((emoji: any) => {
    return (
      emoji &&
      typeof emoji === 'object' &&
      emoji.UUID &&
      emoji.displayName &&
      (emoji.realUrl || emoji.displayUrl)
    )
  })

  // 按使用时间倒序排序，并限制数量
  commonGroup.emojis.sort((a: any, b: any) => {
    const aTime = a.lastUsed || 0
    const bTime = b.lastUsed || 0
    return bTime - aTime
  })

  // 最多保留100个常用表情
  if (commonGroup.emojis.length > 100) {
    commonGroup.emojis = commonGroup.emojis.slice(0, 100)
  }

  return commonGroup
}