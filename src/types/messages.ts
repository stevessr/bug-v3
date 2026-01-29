/**
 * 严格的跨上下文消息类型定义
 * 用于 background、content scripts、popup 和 options 之间的通信
 */

import type { Emoji, EmojiGroup, AppSettings } from './type'

/**
 * 基础消息接口
 */
interface BaseMessage {
  type: string
}

/**
 * GET_EMOJI_DATA 消息
 */
export interface GetEmojiDataMessage extends BaseMessage {
  type: 'GET_EMOJI_DATA'
  sourceDomain?: string
}

/**
 * GET_EMOJI_SETTING 消息
 */
export interface GetEmojiSettingMessage extends BaseMessage {
  type: 'GET_EMOJI_SETTING'
  key: string
}

/**
 * SAVE_EMOJI_DATA 消息
 */
export interface SaveEmojiDataMessage extends BaseMessage {
  type: 'SAVE_EMOJI_DATA'
  data: {
    groups?: EmojiGroup[]
    settings?: AppSettings
    favorites?: string[]
  }
}

/**
 * SYNC_SETTINGS 消息
 */
export interface SyncSettingsMessage extends BaseMessage {
  type: 'SYNC_SETTINGS'
  settings: Partial<AppSettings>
  updates?: Partial<AppSettings>
}

/**
 * REQUEST_LINUX_DO_AUTH 消息
 */
export interface RequestLinuxDoAuthMessage extends BaseMessage {
  type: 'REQUEST_LINUX_DO_AUTH'
}

/**
 * GET_LINUX_DO_USER 消息
 */
export interface GetLinuxDoUserMessage extends BaseMessage {
  type: 'GET_LINUX_DO_USER'
}

/**
 * LINUX_DO_PAGE_FETCH 消息
 */
export interface LinuxDoPageFetchMessage extends BaseMessage {
  type: 'LINUX_DO_PAGE_FETCH'
  options: {
    url: string
    method?: string
    headers?: Record<string, string>
    body?: string
    responseType?: 'json' | 'text'
  }
}

/**
 * PROXY_FETCH 消息
 */
export interface ProxyFetchMessage extends BaseMessage {
  type: 'PROXY_FETCH'
  options: {
    url: string
    method?: string
    headers?: Record<string, string>
    body?: string
    includeCookies?: boolean
    cookieDomain?: string
    responseType?: 'json' | 'text'
  }
}

/**
 * PROXY_IMAGE 消息 - 代理图片请求绕过 CORP 限制
 */
export interface ProxyImageMessage extends BaseMessage {
  type: 'PROXY_IMAGE'
  url: string
}

/**
 * DOWNLOAD_IMAGE 消息
 */
export interface DownloadImageMessage extends BaseMessage {
  type: 'DOWNLOAD_IMAGE' | 'downloadImage'
  url: string
  filename?: string
}

/**
 * CAPTURE_SCREENSHOT 消息
 */
export interface CaptureScreenshotMessage extends BaseMessage {
  type: 'CAPTURE_SCREENSHOT'
  format?: 'png' | 'jpeg'
}

/**
 * ADD_TO_FAVORITES 操作消息
 */
export interface AddToFavoritesMessage {
  action: 'addToFavorites'
  emoji: Emoji
}

/**
 * ADD_EMOJI_FROM_WEB 操作消息
 */
export interface AddEmojiFromWebMessage {
  action: 'addEmojiFromWeb'
  emojiData: {
    url: string
    name?: string
    groupId?: string
    width?: number
    height?: number
  }
}

/**
 * UPLOAD_AND_ADD_EMOJI 操作消息
 */
export interface UploadAndAddEmojiMessage {
  action: 'uploadAndAddEmoji'
  imageData: string // base64 or blob URL
  name?: string
  groupId?: string
}

/**
 * 所有基于 type 的消息联合类型
 */
export type TypedMessage =
  | GetEmojiDataMessage
  | GetEmojiSettingMessage
  | SaveEmojiDataMessage
  | SyncSettingsMessage
  | RequestLinuxDoAuthMessage
  | GetLinuxDoUserMessage
  | LinuxDoPageFetchMessage
  | ProxyFetchMessage
  | ProxyImageMessage
  | DownloadImageMessage
  | CaptureScreenshotMessage

/**
 * 所有基于 action 的消息联合类型
 */
export type ActionMessage =
  | AddToFavoritesMessage
  | AddEmojiFromWebMessage
  | UploadAndAddEmojiMessage

/**
 * 所有消息的联合类型
 */
export type BackgroundMessage = TypedMessage | ActionMessage

/**
 * 响应类型
 */
export interface SuccessResponse<T = any> {
  success: true
  data?: T
}

export interface ErrorResponse {
  success: false
  error: string
}

export type MessageResponse<T = any> = SuccessResponse<T> | ErrorResponse

/**
 * 类型守卫函数
 */
export function isTypedMessage(message: any): message is TypedMessage {
  return typeof message === 'object' && message !== null && 'type' in message
}

export function isActionMessage(message: any): message is ActionMessage {
  return typeof message === 'object' && message !== null && 'action' in message
}

/**
 * 具体消息类型守卫
 */
export function isGetEmojiDataMessage(message: any): message is GetEmojiDataMessage {
  return isTypedMessage(message) && message.type === 'GET_EMOJI_DATA'
}

export function isGetEmojiSettingMessage(message: any): message is GetEmojiSettingMessage {
  return isTypedMessage(message) && message.type === 'GET_EMOJI_SETTING'
}

export function isSaveEmojiDataMessage(message: any): message is SaveEmojiDataMessage {
  return isTypedMessage(message) && message.type === 'SAVE_EMOJI_DATA'
}

export function isSyncSettingsMessage(message: any): message is SyncSettingsMessage {
  return isTypedMessage(message) && message.type === 'SYNC_SETTINGS'
}

export function isDownloadImageMessage(message: any): message is DownloadImageMessage {
  return (
    isTypedMessage(message) &&
    (message.type === 'DOWNLOAD_IMAGE' || message.type === 'downloadImage')
  )
}

export function isAddToFavoritesMessage(message: any): message is AddToFavoritesMessage {
  return isActionMessage(message) && message.action === 'addToFavorites'
}

export function isAddEmojiFromWebMessage(message: any): message is AddEmojiFromWebMessage {
  return isActionMessage(message) && message.action === 'addEmojiFromWeb'
}

export function isUploadAndAddEmojiMessage(message: any): message is UploadAndAddEmojiMessage {
  return isActionMessage(message) && message.action === 'uploadAndAddEmoji'
}
