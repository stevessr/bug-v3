/**
 * 严格的跨上下文消息类型定义
 * 用于 background、content scripts、popup 和 options 之间的通信
 */

import type { Emoji, EmojiGroup, AppSettings } from './type'

import type { AgentAction } from '@/agent/types'

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
 * GET_EMOJI_SETTINGS_BATCH 消息 - 批量获取设置
 */
export interface GetEmojiSettingsBatchMessage extends BaseMessage {
  type: 'GET_EMOJI_SETTINGS_BATCH'
  keys: string[]
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
    responseType?: 'json' | 'text' | 'blob'
  }
}

/**
 * LINUX_DO_UPLOAD 消息
 */
export interface LinuxDoUploadMessage extends BaseMessage {
  type: 'LINUX_DO_UPLOAD'
  options: {
    url: string
    fileData: number[]
    fileName: string
    mimeType?: string
    sha1?: string | null
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
    responseType?: 'json' | 'text' | 'blob'
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
  tabId?: number
}

/**
 * AGENT_ACTION 消息
 */
export interface AgentActionMessage extends BaseMessage {
  type: 'AGENT_ACTION'
  action: AgentAction
}

/**
 * DOM_QUERY 消息
 */
export interface DomQueryMessage extends BaseMessage {
  type: 'DOM_QUERY'
  kind: 'tree' | 'at-point'
  selector?: string
  x?: number
  y?: number
  options?: any
}

/**
 * GET_CSRF_TOKEN 消息
 */
export interface GetCsrfTokenMessage extends BaseMessage {
  type: 'GET_CSRF_TOKEN'
}

/**
 * PAGE_FETCH 消息
 */
export interface PageFetchMessage extends BaseMessage {
  type: 'PAGE_FETCH'
  options: LinuxDoPageFetchMessage['options']
}

/**
 * PAGE_UPLOAD 消息
 */
export interface PageUploadMessage extends BaseMessage {
  type: 'PAGE_UPLOAD'
  options: LinuxDoUploadMessage['options']
}

/**
 * FETCH_IMAGE 消息
 */
export interface FetchImageMessage extends BaseMessage {
  type: 'FETCH_IMAGE'
  url: string
}

/**
 * SETTINGS_UPDATED 消息
 */
export interface SettingsUpdatedMessage extends BaseMessage {
  type: 'SETTINGS_UPDATED'
  updates?: any
}

/**
 * MCP 消息
 */
export interface McpBridgeSetDisabledMessage extends BaseMessage {
  type: 'MCP_BRIDGE_SET_DISABLED'
  disabled: boolean
}

export interface McpBridgeTestMessage extends BaseMessage {
  type: 'MCP_BRIDGE_TEST'
}

export interface McpServerTestMessage extends BaseMessage {
  type: 'MCP_SERVER_TEST'
  options?: any
}

/**
 * ADD_TO_FAVORITES 消息
 */
export interface AddToFavoritesTypedMessage extends BaseMessage {
  type: 'ADD_TO_FAVORITES'
  payload: {
    emoji: Partial<Emoji>
  }
}

/**
 * ADD_EMOJI_FROM_WEB 消息
 */
export interface AddEmojiFromWebTypedMessage extends BaseMessage {
  type: 'ADD_EMOJI_FROM_WEB'
  payload: {
    emojiData: {
      url: string
      name?: string
      groupId?: string
      width?: number
      height?: number
      displayUrl?: string
      customOutput?: string
      sourceDomain?: string
      targetGroupId?: string
      targetGroupName?: string
    }
  }
}

/**
 * UPLOAD_AND_ADD_EMOJI 消息
 */
export interface UploadAndAddEmojiTypedMessage extends BaseMessage {
  type: 'UPLOAD_AND_ADD_EMOJI'
  payload: {
    arrayData: number[]
    filename: string
    mimeType: string
    name: string
    originUrl?: string
  }
}

/**
 * FAVORITES_UPDATED 消息
 */
export interface FavoritesUpdatedMessage extends BaseMessage {
  type: 'FAVORITES_UPDATED'
  payload: {
    favoritesGroup: EmojiGroup
    timestamp?: number
  }
}

/**
 * ADD_TO_FAVORITES legacy 操作消息（兼容）
 */
export interface AddToFavoritesMessage {
  action: 'addToFavorites'
  emoji: Emoji
}

/**
 * ADD_EMOJI_FROM_WEB legacy 操作消息（兼容）
 */
export interface AddEmojiFromWebMessage {
  action: 'addEmojiFromWeb'
  emojiData: {
    url: string
    name?: string
    groupId?: string
    width?: number
    height?: number
    displayUrl?: string
    customOutput?: string
    sourceDomain?: string
    targetGroupId?: string
    targetGroupName?: string
  }
}

/**
 * UPLOAD_AND_ADD_EMOJI legacy 操作消息（兼容）
 */
export interface UploadAndAddEmojiMessage {
  action: 'uploadAndAddEmoji'
  payload: {
    arrayData: number[]
    filename: string
    mimeType: string
    name: string
    originUrl?: string
  }
}

/**
 * 所有基于 type 的消息联合类型
 */
export type TypedMessage =
  | GetEmojiDataMessage
  | GetEmojiSettingMessage
  | GetEmojiSettingsBatchMessage
  | SaveEmojiDataMessage
  | SyncSettingsMessage
  | RequestLinuxDoAuthMessage
  | GetLinuxDoUserMessage
  | LinuxDoPageFetchMessage
  | LinuxDoUploadMessage
  | ProxyFetchMessage
  | ProxyImageMessage
  | DownloadImageMessage
  | CaptureScreenshotMessage
  | AgentActionMessage
  | DomQueryMessage
  | GetCsrfTokenMessage
  | PageFetchMessage
  | PageUploadMessage
  | FetchImageMessage
  | SettingsUpdatedMessage
  | McpBridgeSetDisabledMessage
  | McpBridgeTestMessage
  | McpServerTestMessage
  | AddToFavoritesTypedMessage
  | AddEmojiFromWebTypedMessage
  | UploadAndAddEmojiTypedMessage
  | FavoritesUpdatedMessage

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
 * Content Script 接收的消息联合类型
 */
export type ContentMessage =
  | AgentActionMessage
  | DomQueryMessage
  | GetCsrfTokenMessage
  | GetLinuxDoUserMessage
  | PageFetchMessage
  | PageUploadMessage
  | FetchImageMessage
  | SettingsUpdatedMessage

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
 * 专用响应类型定义
 */
export interface CsrfTokenResponse {
  csrfToken: string
}

export interface LinuxDoUserResponse {
  success: boolean
  user?: any
  error?: string
}

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

export function isAddToFavoritesTypedMessage(message: any): message is AddToFavoritesTypedMessage {
  return isTypedMessage(message) && message.type === 'ADD_TO_FAVORITES'
}

export function isAddEmojiFromWebTypedMessage(
  message: any
): message is AddEmojiFromWebTypedMessage {
  return isTypedMessage(message) && message.type === 'ADD_EMOJI_FROM_WEB'
}

export function isUploadAndAddEmojiTypedMessage(
  message: any
): message is UploadAndAddEmojiTypedMessage {
  return isTypedMessage(message) && message.type === 'UPLOAD_AND_ADD_EMOJI'
}

export function isFavoritesUpdatedMessage(message: any): message is FavoritesUpdatedMessage {
  return isTypedMessage(message) && message.type === 'FAVORITES_UPDATED'
}
