/**
 * Utility for sending messages to linux.do tabs
 * Consolidates common tab discovery and message passing logic
 */

import { getChromeAPI } from './main'

export interface LinuxDoTabMessage {
  type: string
  options?: Record<string, unknown>
}

export interface LinuxDoTabResponse {
  success: boolean
  data?: unknown
  error?: string
  [key: string]: unknown
}

/**
 * Send a message to an available linux.do tab
 * Tries each tab until one responds successfully
 *
 * @param message - The message to send to the content script
 * @param successCheck - Optional function to validate if response is successful
 * @returns The response from the first successful tab, or an error response
 */
export async function sendMessageToLinuxDoTab<T extends { success: boolean; error?: string }>(
  message: LinuxDoTabMessage,
  successCheck?: (resp: T) => boolean
): Promise<T> {
  const chromeAPI = getChromeAPI()
  if (!chromeAPI || !chromeAPI.tabs) {
    return { success: false, error: 'Chrome API not available' } as T
  }

  try {
    const tabs = await chromeAPI.tabs.query({ url: 'https://linux.do/*' })
    if (!tabs.length) {
      return { success: false, error: 'No linux.do tabs found' } as T
    }

    for (const tab of tabs) {
      if (!tab.id) continue
      try {
        const resp = await chromeAPI.tabs.sendMessage(tab.id, message)
        const isSuccess = successCheck ? successCheck(resp) : resp?.success
        if (isSuccess) {
          return resp as T
        }
      } catch {
        // Try next tab
        continue
      }
    }

    return { success: false, error: `${message.type} failed on all linux.do tabs` } as T
  } catch (error) {
    console.error(`[LinuxDoTabMessenger] Failed to send ${message.type}`, error)
    return { success: false, error: 'Unknown error' } as T
  }
}
