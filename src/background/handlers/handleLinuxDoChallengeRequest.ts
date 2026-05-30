import { getChromeAPI } from '../utils/main'

import type { LinuxDoRecoverChallengeMessage, MessageResponse } from '@/types/messages'

const DEFAULT_CHALLENGE_URL = 'https://linux.do/challenge'
const DEFAULT_EXPECTED_TEXT = '糟糕！该页面不存在或者是一个不公开页面。'
const CHALLENGE_DONE_XPATH = '/html/body/section/div/div[1]/div[1]/div[2]/h1'
const DEFAULT_TIMEOUT_MS = 120_000
const DEFAULT_POLL_INTERVAL_MS = 1500

interface ChallengeProbeResult {
  href: string
  title: string
  readyState: string
  h1Text: string
  matched: boolean
}

let recoveryPromise: Promise<MessageResponse<ChallengeProbeResult>> | null = null

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const clampNumber = (value: unknown, fallback: number, min: number, max: number) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return fallback
  return Math.min(max, Math.max(min, Math.floor(numeric)))
}

async function focusWindow(chromeAPI: any, windowId?: number) {
  if (!windowId || !chromeAPI?.windows?.update) return
  try {
    await chromeAPI.windows.update(windowId, { focused: true })
  } catch {
    // Ignore focus failures; the tab can still load and be probed.
  }
}

async function getOrCreateChallengeTab(chromeAPI: any, challengeUrl: string) {
  const existingTabs = await chromeAPI.tabs.query({ url: 'https://linux.do/challenge*' })
  const existingTab = existingTabs.find((tab: chrome.tabs.Tab) => tab.id)

  if (existingTab?.id) {
    const updatedTab = await chromeAPI.tabs.update(existingTab.id, {
      url: challengeUrl,
      active: true
    })
    await focusWindow(chromeAPI, updatedTab?.windowId || existingTab.windowId)
    return updatedTab || existingTab
  }

  const createdTab = await chromeAPI.tabs.create({
    url: challengeUrl,
    active: true
  })
  await focusWindow(chromeAPI, createdTab?.windowId)
  return createdTab
}

async function probeChallengeTab(
  chromeAPI: any,
  tabId: number,
  expectedText: string
): Promise<ChallengeProbeResult | null> {
  if (!chromeAPI?.scripting?.executeScript) {
    throw new Error('chrome.scripting.executeScript is not available')
  }

  const results = await chromeAPI.scripting.executeScript({
    target: { tabId },
    args: [CHALLENGE_DONE_XPATH, expectedText],
    func: (xpath: string, expected: string): ChallengeProbeResult => {
      const normalize = (value: string | null | undefined) =>
        (value || '').replace(/\s+/g, ' ').trim()
      const xpathNode = document.evaluate(
        xpath,
        document,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
      ).singleNodeValue as HTMLElement | null
      const h1 = xpathNode || (document.querySelector('h1.title') as HTMLElement | null)
      const h1Text = normalize(h1?.textContent)
      const expectedText = normalize(expected)

      return {
        href: location.href,
        title: document.title,
        readyState: document.readyState,
        h1Text,
        matched: Boolean(h1Text && (h1Text === expectedText || h1Text.includes(expectedText)))
      }
    }
  })

  return (results?.[0]?.result as ChallengeProbeResult | undefined) || null
}

async function runLinuxDoChallengeRecovery(
  opts: LinuxDoRecoverChallengeMessage['options'] = {}
): Promise<MessageResponse<ChallengeProbeResult>> {
  const chromeAPI = getChromeAPI()
  if (!chromeAPI?.tabs) {
    return { success: false, error: 'Chrome tabs API not available' }
  }

  const challengeUrl = opts.url || DEFAULT_CHALLENGE_URL
  const expectedText = opts.expectedText || DEFAULT_EXPECTED_TEXT
  const timeoutMs = clampNumber(opts.timeoutMs, DEFAULT_TIMEOUT_MS, 5000, 300_000)
  const pollIntervalMs = clampNumber(opts.pollIntervalMs, DEFAULT_POLL_INTERVAL_MS, 500, 10_000)

  try {
    const tab = await getOrCreateChallengeTab(chromeAPI, challengeUrl)
    if (!tab?.id) {
      return { success: false, error: 'Failed to open linux.do challenge tab' }
    }

    const deadline = Date.now() + timeoutMs
    let lastProbe: ChallengeProbeResult | null = null

    while (Date.now() < deadline) {
      try {
        const currentTab = await chromeAPI.tabs.get(tab.id)
        if (!currentTab?.id) {
          return { success: false, error: 'linux.do challenge tab was closed' }
        }

        lastProbe = await probeChallengeTab(chromeAPI, tab.id, expectedText)
        if (lastProbe?.matched) {
          return { success: true, data: lastProbe }
        }
      } catch (error) {
        console.debug('[LinuxDoChallenge] Probe failed, will retry', error)
      }

      await sleep(pollIntervalMs)
    }

    return {
      success: false,
      error: `Timed out waiting for linux.do challenge page. Last h1: ${
        lastProbe?.h1Text || 'not found'
      }`
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

export async function handleLinuxDoChallengeRequest(
  opts: LinuxDoRecoverChallengeMessage['options'],
  sendResponse: (resp: MessageResponse<ChallengeProbeResult>) => void
) {
  if (!recoveryPromise) {
    recoveryPromise = runLinuxDoChallengeRecovery(opts).finally(() => {
      recoveryPromise = null
    })
  }

  sendResponse(await recoveryPromise)
}
