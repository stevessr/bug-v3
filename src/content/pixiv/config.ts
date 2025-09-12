import type { ButtonConfig, DomSelectors } from './types'

// DOM选择器配置
export const DOM_SELECTORS: DomSelectors = {
  pixivViewer: '[role="presentation"]',
  pixivImage: 'img[src*="i.pximg.net"]',
  emojiButton: '.emoji-add-link-pixiv',
  presentationRole: '[role="presentation"]'
}

// 按钮配置
export const BUTTON_CONFIG: ButtonConfig = {
  className: 'emoji-add-link-pixiv',
  position: {
    left: '12px',
    top: '12px'
  },
  styles: {
    base: `
      position: absolute;
      left: 12px;
      top: 12px;
      z-index: 100000;
      color: #ffffff;
      background: linear-gradient(135deg, #8b5cf6, #7c3aed);
      border: 2px solid rgba(255,255,255,0.95);
      border-radius: 6px;
      padding: 6px 10px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      pointer-events: auto;
    `,
    loading: 'background: linear-gradient(135deg, #f59e0b, #d97706)',
    success: `
      background: linear-gradient(135deg, #10b981, #059669);
      color: #ffffff;
      border: 2px solid #ffffff;
      box-shadow: 0 2px 4px rgba(16, 185, 129, 0.3);
    `,
    error: `
      background: linear-gradient(135deg, #ef4444, #dc2626);
      color: #ffffff;
      border: 2px solid #ffffff;
      box-shadow: 0 2px 4px rgba(239, 68, 68, 0.3);
    `,
    opened: 'background: linear-gradient(135deg, #3b82f6, #2563eb)'
  },
  icons: {
    normal: `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
      </svg>
    `,
    loading: `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style="animation: spin 1s linear infinite;">
        <style>
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        </style>
        <path d="M12,4V2A10,10 0 0,0 2,12H4A8,8 0 0,1 12,4Z"/>
      </svg>
    `,
    success: `
      <svg class="fa d-icon d-icon-check svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width: 1em; height: 1em; fill: currentColor; margin-right: 4px;">
        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
      </svg>
    `,
    error: `
      <svg class="fa d-icon d-icon-times svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width: 1em; height: 1em; fill: currentColor; margin-right: 4px;">
        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
      </svg>
    `,
    opened: `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M14,3V5H17.59L7.76,14.83L9.17,16.24L19,6.41V10H21V3M19,19H5V5H12V3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V12H19V19Z"/>
      </svg>
    `
  },
  texts: {
    normal: '添加表情',
    loading: '添加中...',
    success: '已添加',
    error: '失败',
    opened: '已打开'
  }
}

// 常量配置
export const CONSTANTS = {
  // Pixiv域名
  PIXIV_DOMAINS: {
    MAIN: 'pixiv.net',
    IMAGE: 'i.pximg.net',
    CDN: 'pximg.net'
  },

  // 默认值
  DEFAULTS: {
    EMOJI_NAME: '表情',
    BUTTON_TIMEOUT: 3000,
    SCAN_DELAY: 100,
    OBSERVER_DELAY: 120
  },

  // 日志前缀
  LOG_PREFIX: '[PixivAddEmoji]',

  // 文件扩展名
  IMAGE_EXTENSIONS: ['webp', 'jpg', 'jpeg', 'png', 'gif'],

  // 网络请求配置
  FETCH_CONFIG: {
    headers: {
      Referer: 'https://www.pixiv.net/',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    },
    credentials: 'omit' as const
  }
}

// 用于生成唯一ID的计数器
let buttonIdCounter = 0

export function generateButtonId(): string {
  return `pixiv-emoji-btn-${++buttonIdCounter}`
}
