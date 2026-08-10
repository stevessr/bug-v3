import { sendMessageToDomainTabDetailed } from '../utils/domainTabMessenger'
import { getChromeAPI } from '../utils/main'

import type { PageFetchMessage, MessageResponse } from '@/types/messages'

const LINUX_DO_RELOAD_COOLDOWN_MS = 30_000
const linuxDoReloadedAt = new Map<string, number>()
const linuxDoReloadInFlight = new Map<number, Promise<void>>()

const wait = (delay: number) => new Promise(resolve => setTimeout(resolve, delay))

const isLinuxDoRequest = (input: string) => {
  try {
    const url = new URL(input)
    return (
      (url.hostname === 'linux.do' || url.hostname.endsWith('.linux.do')) &&
      url.pathname !== '/message-bus' &&
      !url.pathname.startsWith('/message-bus/')
    )
  } catch {
    return false
  }
}

const getResponseStatus = (response: MessageResponse) => {
  const data = 'data' in response ? response.data : undefined
  const status = Number((data as { status?: unknown } | undefined)?.status)
  return Number.isFinite(status) ? status : null
}

async function reloadLinuxDoTab(tabId: number) {
  const pending = linuxDoReloadInFlight.get(tabId)
  if (pending) return pending

  const task = (async () => {
    const chromeAPI = getChromeAPI()
    if (!chromeAPI?.tabs?.reload) return
    await chromeAPI.tabs.reload(tabId, { bypassCache: true })

    // Wait for the page and its content script to be ready before retrying.
    if (chromeAPI.tabs.get) {
      for (let attempt = 0; attempt < 40; attempt += 1) {
        try {
          const tab = await chromeAPI.tabs.get(tabId)
          if (tab?.status === 'complete') break
        } catch {
          break
        }
        await wait(250)
      }
    } else {
      await wait(1200)
    }
    await wait(500)
  })().finally(() => linuxDoReloadInFlight.delete(tabId))

  linuxDoReloadInFlight.set(tabId, task)
  return task
}

export async function handlePageFetchRequest(
  opts: PageFetchMessage['options'],
  sendResponse: (resp: MessageResponse) => void
) {
  if (!opts?.url) {
    sendResponse({ success: false, error: 'Missing url' })
    return
  }

  const message = {
    type: 'PAGE_FETCH',
    options: {
      url: opts.url,
      method: opts.method,
      headers: opts.headers,
      body: opts.body,
      responseType: opts.responseType,
      passHeaders: opts.passHeaders
    }
  }
  let dispatched = await sendMessageToDomainTabDetailed<MessageResponse>(opts.url, message)

  if (
    getResponseStatus(dispatched.response) === 429 &&
    opts.responseType !== 'blob' &&
    isLinuxDoRequest(opts.url)
  ) {
    let origin = 'https://linux.do'
    try {
      origin = new URL(opts.url).origin
    } catch {
      // URL was already validated by the domain messenger.
    }
    const now = Date.now()
    const canReload = now - (linuxDoReloadedAt.get(origin) || 0) >= LINUX_DO_RELOAD_COOLDOWN_MS
    try {
      if (dispatched.tabId && canReload) {
        linuxDoReloadedAt.set(origin, now)
        await reloadLinuxDoTab(dispatched.tabId)
      } else if (dispatched.tabId) {
        await linuxDoReloadInFlight.get(dispatched.tabId)
      }
    } catch (error) {
      console.warn('[PageFetch] Failed to refresh Linux DO tab after HTTP 429:', error)
    }

    // A reload temporarily detaches the content script. Retry the same
    // authenticated request in the refreshed real forum tab without making
    // the extension page itself reload.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      if (attempt > 0) await wait(350 * attempt)
      dispatched = await sendMessageToDomainTabDetailed<MessageResponse>(opts.url, message)
      if (dispatched.response.success && getResponseStatus(dispatched.response) !== 429) {
        break
      }
    }
  }

  sendResponse(dispatched.response)
}
