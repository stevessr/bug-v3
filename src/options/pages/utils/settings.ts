export const formatDate = (timestamp: number | string | undefined): string => {
  if (!timestamp) return 'N/A'

  // 处理对象类型的情况
  if (typeof timestamp === 'object') {
    console.warn('[SettingsPage] formatDate received object:', timestamp)
    return 'Invalid Date'
  }

  try {
    const date = new Date(typeof timestamp === 'string' ? parseInt(timestamp) : timestamp)

    // 检查日期是否有效
    if (isNaN(date.getTime())) {
      console.warn('[SettingsPage] Invalid date created from timestamp:', timestamp)
      return 'Invalid Date'
    }

    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch (error) {
    console.error('[SettingsPage] Error formatting date:', error, 'timestamp:', timestamp)
    return 'N/A'
  }
}
