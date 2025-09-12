// 基础数据类型
export interface AddEmojiButtonData {
  name: string
  url: string
}

// 表情添加操作的响应类型
export interface EmojiAddResponse {
  success: boolean
  source?: 'uploaded' | 'opened'
  url?: string
  added?: boolean
  message?: string
  error?: string
  details?: any
}

// Canvas图片处理结果类型
export interface CanvasImageResult {
  success: true
  blob: Blob
}

export interface CanvasImageError {
  success: false
  error: any
}

export type CanvasImageResponse = CanvasImageResult | CanvasImageError

// 按钮状态枚举
export enum ButtonState {
  NORMAL = 'normal',
  LOADING = 'loading',
  SUCCESS = 'success',
  ERROR = 'error',
  OPENED = 'opened'
}

// 按钮配置类型
export interface ButtonConfig {
  className: string
  position: {
    left: string
    top: string
  }
  styles: {
    base: string
    loading: string
    success: string
    error: string
    opened: string
  }
  icons: {
    normal: string
    loading: string
    success: string
    error: string
    opened: string
  }
  texts: {
    normal: string
    loading: string
    success: string
    error: string
    opened: string
  }
}

// DOM选择器配置
export interface DomSelectors {
  pixivViewer: string
  pixivImage: string
  emojiButton: string
  presentationRole: string
}

// 日志级别
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}

// 背景脚本消息类型
export interface BackgroundMessage {
  action: 'uploadAndAddEmoji'
  payload: {
    arrayData: number[]
    filename: string
    mimeType: string
    name: string
  }
}

// 背景脚本响应类型
export interface BackgroundResponse {
  success: boolean
  url?: string
  added?: boolean
  error?: string
  details?: any
}
