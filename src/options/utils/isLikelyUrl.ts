export const isLikelyUrl = (str: string): boolean => {
  if (!str) return false
  return (
    str.startsWith('http://') ||
    str.startsWith('https://') ||
    str.startsWith('data:image') ||
    str.startsWith('blob:')
  )
}

/**
 * 检测字符串是否为 Base64 图片格式
 */
export const isBase64Image = (str: string): boolean => {
  if (!str) return false
  return str.startsWith('data:image/') || str.includes(';base64,')
}

/**
 * 检测字符串是否为任何形式的图片URL（包括Base64）
 */
export const isImageUrl = (str: string): boolean => {
  return isLikelyUrl(str) || isBase64Image(str)
}
