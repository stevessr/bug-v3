export const emailLevelOptions = [
  { value: 0, label: '始终' },
  { value: 1, label: '仅离线时' },
  { value: 2, label: '从不' }
]

export const emailPreviousRepliesOptions = [
  { value: 0, label: '始终包含' },
  { value: 1, label: '除非已邮件' },
  { value: 2, label: '从不包含' }
]

export const digestFrequencyOptions = [
  { value: 30, label: '每 30 分钟' },
  { value: 60, label: '每小时' },
  { value: 1440, label: '每天' },
  { value: 10080, label: '每周' },
  { value: 43200, label: '每月' },
  { value: 259200, label: '每半年' }
]

export const mailingListModeOptions = [
  { value: 1, label: '每日汇总' },
  { value: 2, label: '逐条邮件（不回显）' }
]

export const likeNotificationOptions = [
  { value: 0, label: '始终' },
  { value: 1, label: '首次 + 每日' },
  { value: 2, label: '仅首次' },
  { value: 3, label: '从不' }
]

export const autoTrackOptions = [
  { value: -1, label: '从不' },
  { value: 0, label: '立即' },
  { value: 30000, label: '30 秒' },
  { value: 60000, label: '1 分钟' },
  { value: 120000, label: '2 分钟' },
  { value: 180000, label: '3 分钟' },
  { value: 240000, label: '4 分钟' },
  { value: 300000, label: '5 分钟' },
  { value: 600000, label: '10 分钟' }
]

export const newTopicDurationOptions = [
  { value: -1, label: '从未阅读过' },
  { value: 60 * 24, label: '1 天' },
  { value: 60 * 48, label: '2 天' },
  { value: 7 * 60 * 24, label: '1 周' },
  { value: 2 * 7 * 60 * 24, label: '2 周' },
  { value: -2, label: '上次访问以来' }
]

export const notificationLevelOptions = [
  { value: 3, label: '关注' },
  { value: 2, label: '追踪' },
  { value: 1, label: '不处理' }
]

export const titleCountModeOptions = [
  { value: 'notifications', label: '通知数' },
  { value: 'contextual', label: '上下文' }
]

export const textSizeOptions = [
  { value: 'smallest', label: '最小' },
  { value: 'smaller', label: '更小' },
  { value: 'normal', label: '默认' },
  { value: 'larger', label: '更大' },
  { value: 'largest', label: '最大' }
]

export const homepageOptions = [
  { value: 1, label: '最新' },
  { value: 2, label: '分类' },
  { value: 3, label: '未读' },
  { value: 4, label: '新话题' },
  { value: 5, label: '精华' },
  { value: 6, label: '书签' },
  { value: 7, label: '未看' },
  { value: 8, label: '热帖' }
]

export const chatQuickReactionTypeOptions = [
  { value: 'frequent', label: '常用' },
  { value: 'custom', label: '自定义' }
]
