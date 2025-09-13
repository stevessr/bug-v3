/**
 * Bilibili Autonomous Content Script Configuration
 * 集中管理所有配置项和常量
 */

import type { ButtonConfig, DomSelectors } from './types'

// DOM选择器配置
export const DOM_SELECTORS: DomSelectors = {
  // 图片容器选择器
  imageContainers: [
    '.bili-album__watch__content',
    '.opus-module-content img',
    '.bili-dyn-item img'
  ],
  
  // 大图选择器 (包括PhotoSwipe)
  largeImages: [
    '.pswp__img'
  ],
  
  // 头像过滤选择器
  avatarFilters: [
    '.b-avatar__layer__res',
    '.bili-avatar',
    '.user-avatar',
    '.avatar',
    '.user-face',
    '.bili-avatar img'
  ],
  
  // 控制区域选择器
  controlAreas: [
    '.bili-album__watch__control'
  ]
}

// 按钮配置
export const BUTTON_CONFIG: ButtonConfig = {
  className: 'bilibili-emoji-add-btn',
  position: {
    top: '8px',
    right: '8px'
  },
  styles: {
    idle: `
      position: absolute;
      top: 8px;
      right: 8px;
      z-index: 9999;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      border: none;
      border-radius: 6px;
      padding: 6px 8px;
      cursor: pointer;
      font-size: 14px;
      font-weight: bold;
      opacity: 0;
      transition: opacity 0.2s;
      backdrop-filter: blur(4px);
      box-shadow: rgba(0, 0, 0, 0.3) 0px 2px 8px;
      min-width: 28px;
      min-height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
    `,
    loading: 'background: linear-gradient(135deg,#f59e0b,#d97706);',
    success: 'background: linear-gradient(135deg,#10b981,#059669);',
    error: 'background: linear-gradient(135deg,#ef4444,#dc2626);'
  },
  text: {
    idle: '➕',
    loading: '⏳',
    success: '✅',
    error: '❌'
  }
}

// 常量配置
export const CONSTANTS = {
  // 哔哩哔哩域名
  BILIBILI_DOMAINS: {
    MAIN: 'bilibili.com',
    IMAGE: 'hdslb.com',
    CDN: 'i0.hdslb.com'
  },

  // 默认值
  DEFAULTS: {
    EMOJI_NAME: '表情',
    BUTTON_TIMEOUT: 3000,
    SCAN_DELAY: 100,
    OBSERVER_DELAY: 120
  },

  // 日志前缀
  LOG_PREFIX: '[BilibiliAddEmoji]',

  // 文件扩展名
  IMAGE_EXTENSIONS: ['webp', 'jpg', 'jpeg', 'png', 'gif', 'avif'],

  // 网络请求配置
  FETCH_CONFIG: {
    headers: {
      'Accept': 'image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'Cache-Control': 'max-age=0',
      'sec-ch-ua': '"Not;A=Brand";v="99", "Microsoft Edge";v="139", "Chromium";v="139"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      'Sec-Fetch-Dest': 'image',
      'Sec-Fetch-Mode': 'no-cors',
      'Sec-Fetch-Site': 'cross-site',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    },
    credentials: 'omit' as const
  }
}

// 用于生成唯一ID的计数器
let buttonIdCounter = 0

export function generateButtonId(): string {
  return `bilibili-emoji-btn-${++buttonIdCounter}`
}
