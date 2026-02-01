/**
 * Utility for sending messages to tabs that match a target URL origin.
 */

import { getChromeAPI } from './main'

export interface DomainTabMessage {
  type: string
  options?: Record<string, unknown>
}

export interface DomainTabResponse {
  success: boolean
  data?: unknown
  error?: string
  [key: string]: unknown
}

const getTabOrigin = (tabUrl?: string | null) => {
  if (!tabUrl) return null
  try {
    return new URL(tabUrl).origin
  } catch {
    return null
  }
}

export async function sendMessageToDomainTab<T extends { success: boolean; error?: string }>(
  targetUrl: string,
  message: DomainTabMessage,
  successCheck?: (resp: T) => boolean
): Promise<T> {
  const chromeAPI = getChromeAPI()
  if (!chromeAPI || !chromeAPI.tabs) {
    return { success: false, error: 'Chrome API not available' } as T
  }

  let targetOrigin: string
  let host: string
  try {
    const parsed = new URL(targetUrl)
    targetOrigin = parsed.origin
    host = parsed.host
  } catch {
    return { success: false, error: 'Invalid url' } as T
  }

  try {
    const pattern = `*://${host}/*`
    let tabs = await chromeAPI.tabs.query({ url: pattern })

    if (!tabs.length) {
      const allTabs = await chromeAPI.tabs.query({})
      tabs = allTabs.filter(tab => getTabOrigin(tab.url) === targetOrigin)
    }

    if (!tabs.length) {
      return { success: false, error: `No tabs found for ${host}` } as T
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
        continue
      }
    }

    return { success: false, error: `${message.type} failed on all ${host} tabs` } as T
  } catch (error) {
    console.error(`[DomainTabMessenger] Failed to send ${message.type}`, error)
    return { success: false, error: 'Unknown error' } as T
  }
}
