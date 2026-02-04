const HOST = 'https://linux.do'

type PageFetchResponse<T> = {
  success: boolean
  data?: { status: number; ok: boolean; data: T }
  error?: string
}

async function pageFetch<T>(
  url: string,
  options?: { method?: string; headers?: Record<string, string>; body?: string },
  responseType: 'json' | 'text' = 'json'
): Promise<{ status: number; ok: boolean; data: T }> {
  const chromeAPI = (globalThis as any).chrome
  if (!chromeAPI?.runtime?.sendMessage) {
    throw new Error('Page fetch unavailable: chrome.runtime is not accessible')
  }

  return await new Promise((resolve, reject) => {
    chromeAPI.runtime.sendMessage(
      {
        type: 'LINUX_DO_PAGE_FETCH',
        options: {
          url,
          method: options?.method || 'GET',
          headers: options?.headers,
          body: options?.body,
          responseType
        }
      },
      (resp: PageFetchResponse<T>) => {
        if (resp?.success && resp.data) {
          resolve({
            status: resp.data.status || 200,
            ok: resp.data.ok !== false,
            data: resp.data.data as T
          })
          return
        }
        reject(new Error(resp?.error || `Page fetch failed: ${resp?.data?.status || 'unknown'}`))
      }
    )
  })
}

async function getCurrentUsername(): Promise<string | null> {
  try {
    const chromeAPI = (globalThis as any).chrome
    if (!chromeAPI?.runtime?.sendMessage) return null

    const resp = await new Promise<any>(resolve => {
      chromeAPI.runtime.sendMessage({ type: 'GET_LINUX_DO_USER' }, resolve)
    })

    if (resp?.success && resp?.user?.username) {
      return resp.user.username as string
    }
  } catch {
    // ignore
  }
  return null
}

export type LinuxDoInvite = {
  id: number
  invite_key: string
  link: string
  description?: string | null
  email?: string | null
  domain?: string | null
  can_delete_invite?: boolean
  max_redemptions_allowed?: number
  redemption_count?: number
  created_at?: string
  updated_at?: string
  expires_at?: string
  expired?: boolean
  topics?: any[]
  groups?: any[]
}

export type LinuxDoInvitesResponse = {
  invites: LinuxDoInvite[]
  can_see_invite_details?: boolean
  counts?: {
    pending?: number
    expired?: number
    redeemed?: number
    total?: number
  }
}

export async function createInvite(options: {
  maxRedemptionsAllowed: number
  expiresAt: string
  description?: string
  email?: string
  skipEmail?: boolean
  customMessage?: string
}): Promise<LinuxDoInvite> {
  const url = `${HOST}/invites`
  const formData = new URLSearchParams()
  formData.append('max_redemptions_allowed', String(options.maxRedemptionsAllowed))
  formData.append('expires_at', options.expiresAt)
  if (options.description) formData.append('description', options.description)
  if (options.customMessage) formData.append('custom_message', options.customMessage)
  if (options.email) {
    formData.append('email', options.email)
    formData.append('skip_email', options.skipEmail ? 'true' : 'false')
  }

  const res = await pageFetch<LinuxDoInvite>(
    url,
    {
      method: 'POST',
      headers: {
        Accept: '*/*',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: formData.toString()
    },
    'json'
  )

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`)
  }

  return res.data
}

export async function updateInvite(options: {
  inviteId: number
  maxRedemptionsAllowed?: number
  expiresAt?: string
  description?: string
  email?: string
  skipEmail?: boolean
  customMessage?: string
}): Promise<LinuxDoInvite> {
  const url = `${HOST}/invites/${options.inviteId}`
  const formData = new URLSearchParams()
  if (options.description !== undefined) formData.append('description', options.description)
  if (options.customMessage !== undefined) formData.append('custom_message', options.customMessage)
  if (options.maxRedemptionsAllowed !== undefined) {
    formData.append('max_redemptions_allowed', String(options.maxRedemptionsAllowed))
  }
  if (options.expiresAt !== undefined) {
    formData.append('expires_at', options.expiresAt)
  }
  if (options.email !== undefined) {
    formData.append('email', options.email)
    formData.append('skip_email', options.skipEmail ? 'true' : 'false')
  }

  const res = await pageFetch<LinuxDoInvite>(
    url,
    {
      method: 'PUT',
      headers: {
        Accept: '*/*',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: formData.toString()
    },
    'json'
  )

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`)
  }

  return res.data
}

export async function fetchInvites(options?: {
  filter?: 'pending' | 'expired' | 'redeemed' | 'all'
  offset?: number
}): Promise<LinuxDoInvitesResponse> {
  const username = await getCurrentUsername()
  if (!username) {
    throw new Error('Failed to get current user')
  }
  const filter = options?.filter || 'pending'
  const offset = options?.offset || 0
  const url = `${HOST}/u/${encodeURIComponent(username)}/invited.json?filter=${filter}&offset=${offset}`
  const res = await pageFetch<LinuxDoInvitesResponse>(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.data
}
