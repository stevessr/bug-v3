// Emoji validation function
export function validateEmojiArray(data: any[]): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (!Array.isArray(data)) {
    return { valid: false, errors: ['数据必须是数组格式'] }
  }

  if (data.length === 0) {
    return { valid: false, errors: ['数组不能为空'] }
  }

  data.forEach((emoji, index) => {
    const prefix = `第${index + 1}个表情`

    // 检查必需字段
    if (!emoji.id || typeof emoji.id !== 'string') {
      errors.push(`${prefix}: id 字段必须是非空字符串`)
    }

    if (!emoji.name || typeof emoji.name !== 'string') {
      errors.push(`${prefix}: name 字段必须是非空字符串`)
    }

    if (!emoji.url || typeof emoji.url !== 'string') {
      errors.push(`${prefix}: url 字段必须是非空字符串`)
    } else if (!isValidUrl(emoji.url)) {
      errors.push(`${prefix}: url 格式无效`)
    }

    if (!emoji.groupId || typeof emoji.groupId !== 'string') {
      errors.push(`${prefix}: groupId 字段必须是非空字符串`)
    }

    // 检查 packet 字段
    if (emoji.packet !== undefined && (!Number.isInteger(emoji.packet) || emoji.packet < 0)) {
      errors.push(`${prefix}: packet 字段必须是非负整数`)
    }

    // 检查可选的 width 和 height 字段
    if (emoji.width !== undefined && (!Number.isInteger(emoji.width) || emoji.width <= 0)) {
      errors.push(`${prefix}: width 字段必须是正整数`)
    }

    if (emoji.height !== undefined && (!Number.isInteger(emoji.height) || emoji.height <= 0)) {
      errors.push(`${prefix}: height 字段必须是正整数`)
    }
  })

  return { valid: errors.length === 0, errors }
}

function isValidUrl(string: string): boolean {
  try {
    new URL(string)
    return true
  } catch {
    return false
  }
}
