export interface UploadService {
  name: string
  uploadFile(
    file: File,
    onProgress?: (percent: number) => void,
    onRateLimitWait?: (waitTime: number) => Promise<void>
  ): Promise<string>
}

export interface UploadOptions {
  groupId?: string
  groupName?: string
  onProgress?: (percent: number) => void
  onRateLimitWait?: (waitTime: number) => Promise<void>
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

class DiscourseUploadService implements UploadService {
  private domain: string
  private clientId: string

  constructor(domain: string, clientId: string) {
    this.domain = domain
    this.clientId = clientId
  }

  get name() {
    return this.domain
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
    const maxRetries = 3
    let attempt = 0
    let delay = 1000 // 1 second

    while (attempt < maxRetries) {
      try {
        return await this.attemptUpload(file, onProgress)
      } catch (error: any) {
        // If the error indicates a 429 status, wait and retry
        if (error.isRateLimitError && attempt < maxRetries - 1) {
          const waitTime = error.waitTime || delay
          if (onRateLimitWait) {
            await onRateLimitWait(waitTime)
          }
          console.warn(`Attempt ${attempt + 1} failed with 429. Retrying in ${waitTime / 1000}s...`)
          await new Promise(resolve => setTimeout(resolve, waitTime))
          delay *= 2 // Exponential backoff for subsequent fallbacks
          attempt++
        } else {
          // For other errors or if max retries reached, rethrow
          console.error(`${this.domain} upload failed after ${attempt + 1} attempts:`, error)
          throw error
        }
      }
    }
    // This part should not be reachable if maxRetries > 0, but is here for type safety
    throw new Error('Upload failed after multiple retries.')
  }

  private async attemptUpload(file: File, onProgress?: (percent: number) => void): Promise<string> {
    try {
      // Get cookies and CSRF token
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

      const uploadUrl = `https://${this.domain}/uploads.json?client_id=${this.clientId}`

      try {
        const response = await fetch(uploadUrl, {
          method: 'POST',
          headers,
          body: form
        })

        if (response.ok) {
          const data = await response.json()
          if (data && data.url) {
            if (onProgress) onProgress(100)
            return data.url
          }
          throw new Error(`Invalid response from ${this.domain}: missing URL`)
        } else {
          const errorData = await response.json().catch(() => null)
          if (response.status === 429 && errorData?.extras?.wait_seconds) {
            const waitTime = errorData.extras.wait_seconds * 1000
            const rateLimitError = new Error(
              `Upload failed: 429 Too Many Requests. Please wait ${
                errorData.extras.wait_seconds
              } seconds.`
            ) as any
            rateLimitError.isRateLimitError = true
            rateLimitError.waitTime = waitTime
            throw rateLimitError
          }
          throw new Error(
            `Upload failed: ${response.status} ${
              errorData?.message || errorData?.errors?.join(', ') || 'Unknown error'
            }`
          )
        }
      } catch (fetchError) {
        throw fetchError
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
        const cookieList = await chrome.cookies.getAll({ domain: this.domain })
        cookies = cookieList.map(c => `${c.name}=${c.value}`).join('; ')
      }

      // Get CSRF token from tabs
      if (typeof chrome !== 'undefined' && chrome.tabs) {
        const tabs = await chrome.tabs.query({ url: `https://${this.domain}/*` })
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
}

class ImgbedUploadService implements UploadService {
  get name() {
    return 'imgbed'
  }

  async uploadFile(file: File, onProgress?: (percent: number) => void): Promise<string> {
    const { useEmojiStore } = await import('@/stores/emojiStore')
    const emojiStore = useEmojiStore()
    const token = emojiStore.settings.imgbedToken
    const apiUrl = emojiStore.settings.imgbedApiUrl

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
        return `${url.origin}${data[0].src}`
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

// Universal upload function that can be used for any group
export async function uploadAndAddEmoji(
  arrayData: number[],
  filename: string,
  mimeType: string,
  name?: string,
  originUrl?: string,
  options: UploadOptions = {}
): Promise<{ success: boolean; url?: string; error?: string; added?: boolean }> {
  try {
    // Reconstruct blob
    const uint8 = new Uint8Array(arrayData)
    const blob = new Blob([uint8], { type: mimeType || 'application/octet-stream' })
    const file = new File([blob], filename || 'image', { type: blob.type })

    // Try to upload to linux.do first
    let finalUrl: string | null = null
    try {
      finalUrl = await uploadServices['linux.do'].uploadFile(
        file,
        options.onProgress,
        options.onRateLimitWait
      )
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

    // Import store dynamically to avoid circular dependencies
    const { useEmojiStore } = await import('@/stores/emojiStore')
    const emojiStore = useEmojiStore()

    // Determine target group
    const targetGroupId = options.groupId || 'ungrouped'

    // Ensure group exists
    let group = emojiStore.groups.find(g => g.id === targetGroupId)
    if (!group && options.groupName) {
      group = emojiStore.createGroupWithoutSave(options.groupName, '📦')
      group.id = targetGroupId
    } else if (!group) {
      // Create ungrouped if it doesn't exist
      group = emojiStore.groups.find(g => g.id === 'ungrouped')
      if (!group) {
        group = emojiStore.createGroupWithoutSave('未分组', '📦')
        group.id = 'ungrouped'
      }
    }

    // Add emoji to group
    const newEmoji = {
      packet: Date.now(),
      name: name || filename || 'image',
      url: finalUrl,
      displayUrl: finalUrl,
      originUrl: originUrl || undefined,
      addedAt: Date.now()
    }

    emojiStore.addEmojiWithoutSave(targetGroupId, newEmoji)
    emojiStore.maybeSave()

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
    return { success: true, url: finalUrl, added: true }
  } catch (error) {
    console.error('Upload and add emoji failed', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}
