/**
 * Application-wide constants
 * Centralized magic numbers and configuration values
 */

// Time-related constants (milliseconds)
export const TIME = {
  // UI feedback delays
  BUTTON_FEEDBACK_DELAY: 1400,
  BUTTON_LONG_FEEDBACK_DELAY: 3000,
  BUTTON_SUCCESS_DELAY: 1500,

  // Debounce delays
  SEARCH_DEBOUNCE_DELAY: 100,
  SAVE_DEBOUNCE_DELAY: 100,

  // Animation delays
  FADE_IN_DELAY: 100,
  NOTIFICATION_REMOVE_DELAY: 300,

  // Initial scan delays
  INITIAL_SCAN_DELAY: 200,
  INITIAL_SCAN_DELAY_LONG: 300,

  // Resource cleanup
  BLOB_URL_REVOKE_DELAY: 5000
} as const

// Button text constants
export const BUTTON_TEXT = {
  LOADING: '加载中...',
  DOWNLOADING: '下载中...',
  ADDING: '添加中...',
  PARSING: '正在解析...',
  SUCCESS: '已添加',
  DOWNLOADED: '已下载',
  COPIED: '已复制',
  OPENED: '已打开',
  FAILED: '失败',
  PARSE_FAILED: '解析失败',
  PROCESSED: (count: number, total: number) => `已处理 ${count}/${total} 张图片`
} as const

// UI constants
export const UI = {
  // Grid columns
  MIN_GRID_COLUMNS: 2,
  MAX_GRID_COLUMNS: 8,
  DEFAULT_GRID_COLUMNS: 4,

  // Image scale
  MIN_IMAGE_SCALE: 5,
  MAX_IMAGE_SCALE: 150,
  DEFAULT_IMAGE_SCALE: 100,

  // File size limits
  MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
  MAX_CACHE_SIZE: 200 * 1024 * 1024, // 200MB

  // Pagination
  MAX_EMOJIS_PER_GROUP: 5000,
  MAX_TOTAL_EMOJIS: 50000
} as const

// Color gradients (button states)
export const BUTTON_GRADIENTS = {
  PRIMARY: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
  SUCCESS: 'linear-gradient(135deg, #10b981, #059669)',
  WARNING: 'linear-gradient(135deg, #f59e0b, #d97706)',
  ERROR: 'linear-gradient(135deg, #ef4444, #dc2626)',
  INFO: 'linear-gradient(135deg, #3b82f6, #2563eb)'
} as const

// Emoji defaults
export const EMOJI = {
  DEFAULT_GROUP: 'nachoneko',
  DEFAULT_PACKET: 0
} as const

// Platform detection
export const PLATFORMS = {
  DISCOURSE: ['linux.do', 'idcflare.com', 'discourse'],
  PIXIV: ['pixiv.net'],
  REDDIT: ['reddit.com'],
  X: ['twitter.com', 'x.com'],
  BILIBILI: ['bilibili.com'],
  XIAOHONGSHU: ['xiaohongshu.com']
} as const

// Sync-related constants
export const SYNC = {
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000,
  TIMEOUT: 30000
} as const


