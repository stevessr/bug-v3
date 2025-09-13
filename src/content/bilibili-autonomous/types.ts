/**
 * Bilibili Autonomous Content Script Types
 * TypeScript type definitions for bilibili emoji functionality
 */

// 基础表情按钮数据接口
export interface AddEmojiButtonData {
  name: string
  url: string
}

// 按钮状态枚举
export enum ButtonState {
  IDLE = 'idle',
  LOADING = 'loading',
  SUCCESS = 'success',
  ERROR = 'error'
}

// 按钮配置接口
export interface ButtonConfig {
  className: string
  position: {
    top: string
    right: string
  }
  styles: {
    idle: string
    loading: string
    success: string
    error: string
  }
  text: {
    idle: string
    loading: string
    success: string
    error: string
  }
}

// DOM选择器配置
export interface DomSelectors {
  // 图片容器选择器
  imageContainers: string[]
  // 大图选择器
  largeImages: string[]
  // 头像过滤选择器
  avatarFilters: string[]
  // 控制区域选择器
  controlAreas: string[]
}

// 页面检测结果
export interface PageDetectionResult {
  isBilibiliPage: boolean
  isOpusPage: boolean
  pageType: 'opus' | 'dynamic' | 'unknown'
}

// URL处理结果
export interface UrlProcessResult {
  originalUrl: string
  normalizedUrl: string | null
  displayUrl: string
  isValid: boolean
}

// 图片处理结果
export interface ImageProcessResult {
  element: Element
  url: string
  name: string
  container: Element
}

// 上传响应接口
export interface UploadResponse {
  success: boolean
  url?: string
  error?: string
  details?: any
}

// 后台消息接口
export interface BackgroundMessage {
  action: string
  payload: any
}

// 日志级别
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}
