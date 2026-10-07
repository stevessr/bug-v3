import { normalizeDiscourseUploadOrigin } from '@/utils/discourseInstance'
import {
  DEFAULT_UPLOAD_RETRY_MS,
  getUploadRetryDelay,
  isUploadChallenge
} from '@/utils/uploadRetry'
import type { Emoji, EmojiGroup } from '@/types/type'
import { normalizeDiscourseUploadUrl } from '@/utils/discourseUpload'
import {
  getEmojiGroup,
  getEmojiGroupIndex,
  getSettings,
  storageBatchSet,
  STORAGE_KEYS
} from '@/utils/simpleStorage'

type UploadFlowError = Error & {
  status?: number
  isRateLimitError?: boolean
  isLinuxDoChallengeError?: boolean
  waitTime?: number
  shouldTerminateUploadFlow?: boolean
  details?: unknown
}

export interface UploadService {
  name: string
  uploadFileDetailed?(
    file: File,
    onProgress?: (percent: number) => void,
    onRateLimitWait?: (waitTime: number) => Promise<void>
  ): Promise<UploadServiceResult>
  uploadFile(
    file: File,
    onProgress?: (percent: number) => void,
    onRateLimitWait?: (waitTime: number) => Promise<void>
  ): Promise<string>
}

export interface UploadServiceResult {
  url: string
  short_url?: string
  short_path?: string
  width?: number
  height?: number
  original_filename?: string
  filesize?: number
  extension?: string
  human_filesize?: string
}

export interface UploadOptions {
  groupId?: string
  groupName?: string
  onProgress?: (percent: number) => void
  onRateLimitWait?: (waitTime: number) => Promise<void>
}

let emojiPersistenceQueue: Promise<void> = Promise.resolve()

function enqueueEmojiPersistence<T>(task: () => Promise<T>): Promise<T> {
  const result = emojiPersistenceQueue.then(task, task)
  emojiPersistenceQueue = result.then(
    () => undefined,
    () => undefined
  )
  return result
}

async function persistUploadedEmoji(
  targetGroupId: string,
  groupName: string | undefined,
  emoji: Omit<Emoji, 'id' | 'groupId'>
): Promise<{ emoji: Emoji; group: EmojiGroup }> {
  return enqueueEmojiPersistence(async () => {
    const [storedGroup, storedIndex] = await Promise.all([
      getEmojiGroup(targetGroupId),
      getEmojiGroupIndex()
    ])
    const existingIndex = storedIndex.find(entry => entry.id === targetGroupId)
    const order =
      existingIndex?.order ??
      storedGroup?.order ??
      storedIndex.reduce((max, entry) => Math.max(max, entry.order), -1) + 1
    const baseGroup: EmojiGroup = storedGroup ?? {
      id: targetGroupId,
      name: groupName || (targetGroupId === 'ungrouped' ? '未分组' : targetGroupId),
      icon: '📦',
      order,
      emojis: []
    }
    const newEmoji: Emoji = {
      ...emoji,
      id: `emoji-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      groupId: targetGroupId
    }
    const group: EmojiGroup = {
      ...baseGroup,
      emojis: [...(Array.isArray(baseGroup.emojis) ? baseGroup.emojis : []), newEmoji]
    }
    const index = existingIndex
      ? storedIndex
      : [...storedIndex, { id: targetGroupId, order }].sort((a, b) => a.order - b.order)

    await storageBatchSet({
      [STORAGE_KEYS.GROUP_PREFIX + targetGroupId]: group,
      [STORAGE_KEYS.GROUP_INDEX]: index
    })

    return { emoji: newEmoji, group }
  })
}

// Hardcoded map for discourse forum domains and their client IDs
const DISCOURSE_UPLOAD_CONFIGS: Record<string, { domain: string; clientId: string }> = {
  'linux.do': {
    domain: 'linux.do',
    clientId: 'f06cb5577ba9410d94b9faf94e48c2d8'
  },
  'idcflare.com': {
    domain: 'idcflare.com',
    clientId: '1b4186493e084a11955dd3cab51b5062'
  }
}

function createRateLimitError(payload: unknown, retryAfter?: unknown): UploadFlowError {
  const error = new Error('上传请求过于频繁，等待后重试') as UploadFlowError
  error.status = 429
  error.isRateLimitError = true
  error.waitTime = getUploadRetryDelay(payload, retryAfter) ?? DEFAULT_UPLOAD_RETRY_MS
  error.details = payload
  return error
}

function createLinuxDoChallengeError(payload: unknown, status = 403): UploadFlowError {
  const error = new Error('linux.do 返回验证页面，等待正常访问恢复后重试上传。') as UploadFlowError
  error.status = status
  error.isLinuxDoChallengeError = true
  error.details = payload
  return error
}

let linuxDoChallengeRecoveryPromise: Promise<void> | null = null

async function requestLinuxDoChallengeRecovery() {
  if (linuxDoChallengeRecoveryPromise) {
    return linuxDoChallengeRecoveryPromise
  }

  linuxDoChallengeRecoveryPromise = (async () => {
    const chromeAPI = (globalThis as any).chrome
    if (!chromeAPI?.runtime?.sendMessage) {
      throw new Error('Cannot recover linux.do challenge: chrome.runtime is not accessible')
    }

    await new Promise<void>((resolve, reject) => {
      chromeAPI.runtime.sendMessage(
        {
          type: 'LINUX_DO_RECOVER_CHALLENGE',
          options: {
            url: 'https://linux.do/challenge',
            expectedText: '糟糕！该页面不存在或者是一个不公开页面。'
          }
        },
        (resp: any) => {
          const lastError = chromeAPI.runtime.lastError
          if (lastError?.message) {
            reject(new Error(lastError.message))
            return
          }
          if (resp?.success) {
            resolve()
            return
          }
          reject(new Error(resp?.error || 'linux.do challenge recovery failed'))
        }
      )
    })
  })().finally(() => {
    linuxDoChallengeRecoveryPromise = null
  })

  return linuxDoChallengeRecoveryPromise
}

async function readResponseErrorPayload(response: Response) {
  const text = await response.text().catch(() => '')
  if (!text) return null

  try {
    return JSON.parse(text)
  } catch {
    return { message: text }
  }
}

function normalizeUploadResult(baseUrl: string, data: any): UploadServiceResult {
  const payload = data && typeof data === 'object' ? data : {}
  const finalUrl = normalizeDiscourseUploadUrl(baseUrl, payload)
  if (!finalUrl) {
    throw new Error(`Invalid response from ${baseUrl}: missing URL`)
  }

  return {
    ...payload,
    url: finalUrl,
    short_url: typeof payload?.short_url === 'string' ? payload.short_url : undefined,
    short_path: typeof payload?.short_path === 'string' ? payload.short_path : undefined,
    width: typeof payload?.width === 'number' ? payload.width : undefined,
    height: typeof payload?.height === 'number' ? payload.height : undefined,
    original_filename:
      typeof payload?.original_filename === 'string' ? payload.original_filename : undefined,
    filesize: typeof payload?.filesize === 'number' ? payload.filesize : undefined,
    extension: typeof payload?.extension === 'string' ? payload.extension : undefined,
    human_filesize: typeof payload?.human_filesize === 'string' ? payload.human_filesize : undefined
  }
}

/**
 * Upload a file using Discourse's built-in appEvents mechanism.
 *
 * This only works when running on a Discourse page where the Ember application
 * is initialized (e.g. from a content script on a Discourse forum page).
 * It triggers Discourse's own composer upload pipeline and provides progress
 * via the standard onProgress callback.
 *
 * @returns A promise that resolves with the upload result from Discourse.
 * @throws If Discourse runtime is not available in the current context.
 */
export function uploadViaDiscourseAppEvents(
  file: File,
  onProgress?: (percent: number) => void
): Promise<UploadServiceResult> {
  return new Promise((resolve, reject) => {
    let cleanup = () => {}

    try {
      const win = globalThis as any
      const discourse = win.Discourse
      if (!discourse?.__container__) {
        reject(new Error('Discourse runtime not available in this context'))
        return
      }

      const appEvents = discourse.__container__.lookup('service:app-events')
      if (!appEvents) {
        reject(new Error('Discourse appEvents service not found'))
        return
      }
      if (typeof appEvents.has === 'function' && !appEvents.has('composer:add-files')) {
        reject(new Error('Discourse composer uploader is not ready'))
        return
      }

      let settled = false

      const onSuccess = (fileName: string, upload: any) => {
        if (settled || fileName !== file.name) return
        settled = true
        cleanup()
        onProgress?.(100)
        const baseUrl = win.location?.origin || `https://${win.location?.host || ''}`
        try {
          resolve(normalizeUploadResult(baseUrl, upload))
        } catch (error) {
          reject(error)
        }
      }

      const onError = (uppyFile: any) => {
        const failedFileName = uppyFile?.name || uppyFile?.data?.name
        if (settled || failedFileName !== file.name) return
        settled = true
        cleanup()
        const error = uppyFile?.meta?.error || uppyFile?.error || uppyFile
        const msg =
          typeof error === 'string'
            ? error
            : error?.message || error?.toString() || 'Discourse upload failed'
        reject(new Error(msg))
      }

      const onStarted = (fileName: string) => {
        if (fileName !== file.name) return
        onProgress?.(10)
      }

      const onAborted = () => {
        if (settled) return
        settled = true
        cleanup()
        reject(new Error(`Discourse rejected ${file.name} before upload`))
      }

      const timeout = setTimeout(
        () => {
          if (settled) return
          settled = true
          cleanup()
          reject(new Error(`Timed out waiting for Discourse to upload ${file.name}`))
        },
        5 * 60 * 1000
      )

      cleanup = () => {
        clearTimeout(timeout)
        appEvents.off('composer:upload-success', onSuccess)
        appEvents.off('composer:upload-error', onError)
        appEvents.off('composer:upload-started', onStarted)
        appEvents.off('composer:uploads-aborted', onAborted)
      }

      appEvents.on('composer:upload-success', onSuccess)
      appEvents.on('composer:upload-error', onError)
      appEvents.on('composer:upload-started', onStarted)
      appEvents.on('composer:uploads-aborted', onAborted)

      // Let Discourse validate/preprocess/transport the file, but keep insertion
      // under the caller's control so the composer does not receive duplicates.
      appEvents.trigger('composer:add-files', file, { skipPlaceholder: true })
    } catch (e) {
      cleanup()
      reject(e)
    }
  })
}

export class DiscourseUploadService implements UploadService {
  private domain: string
  private clientId?: string
  private origin: string

  constructor(domain: string, clientId?: string) {
    const parsed = new URL(domain.includes('://') ? domain : `https://${domain}`)
    if (
      !['http:', 'https:'].includes(parsed.protocol) ||
      parsed.username ||
      parsed.password ||
      parsed.pathname !== '/' ||
      parsed.search ||
      parsed.hash
    ) {
      throw new Error('Invalid Discourse instance URL')
    }
    this.origin = parsed.origin
    this.domain = parsed.host
    this.clientId = clientId
  }

  get name() {
    return this.domain
  }

  /** Check whether we are running in a Discourse page with Ember initialized */
  private isDiscoursePageContext(): boolean {
    try {
      return (
        (globalThis as any).location?.hostname?.toLowerCase() ===
          new URL(this.origin).hostname.toLowerCase() &&
        !!(globalThis as any).Discourse?.__container__
      )
    } catch {
      return false
    }
  }

  async computeSHA1OfArrayBuffer(buffer: ArrayBuffer): Promise<string | null> {
    if (typeof crypto === 'undefined' || !crypto.subtle) return null
    try {
      const hash = await crypto.subtle.digest('SHA-1', buffer)
      const arr = Array.from(new Uint8Array(hash))
      return arr.map(b => b.toString(16).padStart(2, '0')).join('')
    } catch {
      return null
    }
  }

  async uploadFile(
    file: File,
    onProgress?: (percent: number) => void,
    onRateLimitWait?: (waitTime: number) => Promise<void>
  ): Promise<string> {
    const result = await this.uploadFileDetailed(file, onProgress, onRateLimitWait)
    return result.url
  }

  async uploadFileDetailed(
    file: File,
    onProgress?: (percent: number) => void,
    onRateLimitWait?: (waitTime: number) => Promise<void>
  ): Promise<UploadServiceResult> {
    const maxChallengeRecoveries = 2
    let attempt = 0
    let challengeRecoveries = 0

    // A rate limit is a cooldown, not a terminal upload failure. Keep the same
    // file until the server accepts it or the consumer cancels its wait.
    while (true) {
      try {
        return await this.attemptUploadDetailed(file, onProgress)
      } catch (error: any) {
        if (
          this.domain === 'linux.do' &&
          error?.isLinuxDoChallengeError &&
          challengeRecoveries < maxChallengeRecoveries
        ) {
          challengeRecoveries++
          console.warn(
            `linux.do challenge detected for ${file.name}. Visiting /challenge before retry ${challengeRecoveries}/${maxChallengeRecoveries}...`
          )
          try {
            await requestLinuxDoChallengeRecovery()
          } catch (recoveryError) {
            const failure = recoveryError as UploadFlowError
            failure.shouldTerminateUploadFlow = true
            throw failure
          }
          continue
        }

        // If the error indicates a 429 status, wait and retry
        if (error.isRateLimitError) {
          const waitTime = Math.max(1000, error.waitTime || DEFAULT_UPLOAD_RETRY_MS)
          const waitStarted = Date.now()
          if (onRateLimitWait) {
            await onRateLimitWait(waitTime)
          }
          console.warn(`Attempt ${attempt + 1} failed with 429. Retrying in ${waitTime / 1000}s...`)
          // Some consumers show a countdown by awaiting the callback; do not wait twice.
          const remaining = Math.max(0, waitTime - (Date.now() - waitStarted))
          if (remaining > 0) await new Promise(resolve => setTimeout(resolve, remaining))
          attempt++
        } else {
          if (error.isLinuxDoChallengeError) {
            error.shouldTerminateUploadFlow = true
          }
          // Do not endlessly retry authentication, network or verification failures.
          console.error(`${this.domain} upload failed after ${attempt + 1} attempts:`, error)
          throw error
        }
      }
    }
  }

  private async attemptUploadDetailed(
    file: File,
    onProgress?: (percent: number) => void
  ): Promise<UploadServiceResult> {
    try {
      // When running on a Discourse page, use the native appEvents upload
      if (this.isDiscoursePageContext()) {
        return await uploadViaDiscourseAppEvents(file, onProgress)
      }

      if (this.shouldUseLinuxDoPageProxy()) {
        return await this.uploadViaLinuxDoProxyDetailed(file, onProgress)
      }

      // Get cookies and CSRF token from an open tab on this exact Discourse instance.
      const { cookies, csrfToken } = await this.getAuth()

      // Build form data
      const arrayBuffer = await file.arrayBuffer()
      const sha1 = await this.computeSHA1OfArrayBuffer(arrayBuffer)

      const form = new FormData()
      form.append('upload_type', 'composer')
      form.append('relativePath', 'null')
      form.append('name', file.name)
      form.append('type', file.type)
      if (sha1) form.append('sha1_checksum', sha1)
      form.append('file', file, file.name)

      const headers: Record<string, string> = {}
      if (csrfToken) headers['X-Csrf-Token'] = csrfToken
      if (cookies) headers['Cookie'] = cookies

      const uploadUrl = `${this.origin}/uploads.json${this.clientId ? `?client_id=${encodeURIComponent(this.clientId)}` : ''}`

      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers,
        body: form,
        credentials: 'include'
      })

      if (response.ok) {
        const data = await response.json()
        const result = normalizeUploadResult(this.origin, data)
        if (onProgress) onProgress(100)
        return result
      } else {
        const errorData = await readResponseErrorPayload(response)
        if (
          this.domain === 'linux.do' &&
          isUploadChallenge(
            response.status,
            errorData,
            response.headers.get('cf-mitigated') || undefined
          )
        ) {
          throw createLinuxDoChallengeError(errorData, response.status)
        }
        if (response.status === 429) {
          throw createRateLimitError(errorData, response.headers.get('retry-after'))
        }
        throw new Error(
          `Upload failed: ${response.status} ${
            errorData?.message || errorData?.errors?.join(', ') || 'Unknown error'
          }`
        )
      }
    } catch (error) {
      console.error(`${this.domain} upload failed:`, error)
      throw error
    }
  }

  private async getAuth(): Promise<{ cookies: string; csrfToken: string }> {
    let cookies = ''
    let csrfToken = ''

    try {
      // Get cookies from chrome API if available
      if (typeof chrome !== 'undefined' && chrome.cookies) {
        const cookieList = await chrome.cookies.getAll({ domain: new URL(this.origin).hostname })
        cookies = cookieList.map(c => `${c.name}=${c.value}`).join('; ')
      }

      // Get CSRF token from tabs
      if (typeof chrome !== 'undefined' && chrome.tabs) {
        const tabs = await chrome.tabs.query({ url: `${this.origin}/*` })
        for (const tab of tabs) {
          if (tab.id) {
            try {
              const resp = await chrome.tabs.sendMessage(tab.id, { type: 'GET_CSRF_TOKEN' })
              if (resp && resp.csrfToken) {
                csrfToken = resp.csrfToken
                break
              }
            } catch {
              continue
            }
          }
        }
      }
    } catch (error) {
      console.warn(`Failed to get ${this.domain} auth:`, error)
    }

    return { cookies, csrfToken }
  }

  private shouldUseLinuxDoPageProxy(): boolean {
    if (this.domain !== 'linux.do') return false
    try {
      return globalThis?.location?.protocol === 'chrome-extension:'
    } catch {
      return false
    }
  }

  private async uploadViaLinuxDoProxyDetailed(
    file: File,
    onProgress?: (percent: number) => void
  ): Promise<UploadServiceResult> {
    const chromeAPI = (globalThis as any).chrome
    if (!chromeAPI?.runtime?.sendMessage) {
      throw new Error('Page proxy unavailable: chrome.runtime is not accessible')
    }

    const arrayBuffer = await file.arrayBuffer()
    const sha1 = await this.computeSHA1OfArrayBuffer(arrayBuffer)

    onProgress?.(20)

    const uploadUrl = `${this.origin}/uploads.json${this.clientId ? `?client_id=${encodeURIComponent(this.clientId)}` : ''}`
    const response = await new Promise<any>((resolve, reject) => {
      chromeAPI.runtime.sendMessage(
        {
          type: 'LINUX_DO_UPLOAD',
          options: {
            url: uploadUrl,
            fileData: Array.from(new Uint8Array(arrayBuffer)),
            fileName: file.name,
            mimeType: file.type,
            sha1
          }
        },
        (resp: any) => {
          if (resp?.success) {
            resolve(resp)
            return
          }
          reject(new Error(resp?.error || 'Page upload failed'))
        }
      )
    })

    const proxyPayload = (response as any)?.data?.data ?? (response as any)?.data
    const proxyOk = (response as any)?.data?.ok ?? (response as any)?.ok
    const proxyStatus = (response as any)?.data?.status ?? (response as any)?.status

    if (proxyOk) {
      const result = normalizeUploadResult(this.origin, proxyPayload)
      onProgress?.(100)
      return result
    }

    const errorData = proxyPayload
    const proxyHeaders = (response as any)?.data?.headers ?? (response as any)?.headers ?? {}
    if (isUploadChallenge(proxyStatus, errorData, proxyHeaders['cf-mitigated'])) {
      throw createLinuxDoChallengeError(errorData, proxyStatus)
    }
    if (proxyStatus === 429) {
      throw createRateLimitError(errorData, proxyHeaders['retry-after'])
    }

    throw new Error(
      `Upload failed: ${proxyStatus || 'unknown'} ${
        errorData?.message || errorData?.errors?.join(', ') || 'Unknown error'
      }`
    )
  }
}

class ImgbedUploadService implements UploadService {
  get name() {
    return 'imgbed'
  }

  async uploadFile(file: File, onProgress?: (percent: number) => void): Promise<string> {
    const result = await this.uploadFileDetailed(file, onProgress)
    return result.url
  }

  async uploadFileDetailed(file: File, onProgress?: (percent: number) => void) {
    const settings = await getSettings()
    const token = settings?.imgbedToken
    const apiUrl = settings?.imgbedApiUrl

    if (!token) {
      throw new Error('Imgbed token is not set in settings')
    }
    if (!apiUrl) {
      throw new Error('Imgbed API URL is not set in settings')
    }

    const form = new FormData()
    form.append('file', file)

    onProgress?.(50)

    const response = await fetch(`${apiUrl}/upload?authCode=${token}`, {
      method: 'POST',
      body: form
    })

    if (response.ok) {
      const data = await response.json()
      if (Array.isArray(data) && data[0] && data[0].src) {
        onProgress?.(100)
        // src does not contain domain, so we need to prepend it
        const url = new URL(apiUrl)
        return { url: `${url.origin}${data[0].src}` }
      }
      throw new Error('Invalid response from imgbed')
    } else {
      const errorData = await response.text().catch(() => 'Unknown error')
      throw new Error(`Upload failed: ${response.status} ${errorData}`)
    }
  }
}

// Create upload services using the unified DiscourseUploadService
export const uploadServices: Record<string, UploadService> = {
  imgbed: new ImgbedUploadService()
}
for (const [key, config] of Object.entries(DISCOURSE_UPLOAD_CONFIGS)) {
  uploadServices[key] = new DiscourseUploadService(config.domain, config.clientId)
}

export function createDiscourseUploadService(instanceUrl: string): UploadService {
  const origin = normalizeDiscourseUploadOrigin(instanceUrl)
  const parsed = new URL(origin)
  const builtIn = DISCOURSE_UPLOAD_CONFIGS[parsed.host]
  return new DiscourseUploadService(origin, builtIn?.clientId)
}

// Universal upload function that can be used for any group
export async function uploadAndAddEmoji(
  arrayData: number[],
  filename: string,
  mimeType: string,
  name?: string,
  originUrl?: string,
  options: UploadOptions = {}
): Promise<{
  success: boolean
  url?: string
  short_url?: string
  short_path?: string
  error?: string
  added?: boolean
}> {
  try {
    // Reconstruct blob
    const uint8 = new Uint8Array(arrayData)
    const blob = new Blob([uint8], { type: mimeType || 'application/octet-stream' })
    const file = new File([blob], filename || 'image', { type: blob.type })

    // Try to upload to linux.do first
    let finalUrl: string | null = null
    let shortUrl: string | undefined
    let shortPath: string | undefined
    try {
      const linuxDoService = uploadServices['linux.do']
      const result = linuxDoService.uploadFileDetailed
        ? await linuxDoService.uploadFileDetailed(file, options.onProgress, options.onRateLimitWait)
        : {
            url: await linuxDoService.uploadFile(file, options.onProgress, options.onRateLimitWait)
          }
      finalUrl = result.url
      shortUrl = result.short_url
      shortPath = result.short_path
    } catch (e) {
      console.warn('Upload to linux.do failed, will fallback to data/object URL', e)
    }

    // Fallback to data URL/object URL if upload failed
    if (!finalUrl) {
      const dataUrl: string | null = await new Promise(resolve => {
        try {
          const reader = new FileReader()
          reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null)
          reader.onerror = () => resolve(null)
          reader.readAsDataURL(blob)
        } catch (e) {
          console.warn('Failed to create dataURL from blob', e)
          resolve(null)
        }
      })
      finalUrl = dataUrl || URL.createObjectURL(blob)
    }

    // Determine target group
    const targetGroupId = options.groupId || 'ungrouped'

    // Add emoji to group
    const { emoji: newEmoji, group } = await persistUploadedEmoji(
      targetGroupId,
      options.groupName,
      {
        packet: Date.now(),
        name: name || filename || 'image',
        url: finalUrl,
        ...(shortUrl && { short_url: shortUrl }),
        ...(shortPath && { short_path: shortPath }),
        displayUrl: finalUrl,
        originUrl: originUrl || undefined,
        addedAt: Date.now()
      }
    )

    // Broadcast addition if not in buffer group
    if (targetGroupId !== 'buffer' && typeof chrome !== 'undefined' && chrome.runtime) {
      try {
        chrome.runtime.sendMessage({
          type: 'EMOJI_EXTENSION_EMOJI_ADDED',
          payload: {
            emoji: newEmoji,
            group: {
              id: group.id,
              name: group.name,
              icon: group.icon,
              order: group.order
            }
          }
        })
      } catch (broadcastError) {
        console.warn('Failed to broadcast emoji addition', broadcastError)
      }
    }

    console.log(`Added emoji to ${targetGroupId}`, newEmoji.name)
    return {
      success: true,
      url: finalUrl,
      ...(shortUrl && { short_url: shortUrl }),
      ...(shortPath && { short_path: shortPath }),
      added: true
    }
  } catch (error) {
    console.error('Upload and add emoji failed', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}
