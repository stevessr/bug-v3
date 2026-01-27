const HOST = 'https://linux.do'

type PageFetchResponse<T> = {
  success: boolean
  status?: number
  ok?: boolean
  data?: T
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
        if (resp?.success) {
          resolve({
            status: resp.status || 200,
            ok: resp.ok !== false,
            data: resp.data as T
          })
          return
        }
        reject(new Error(resp?.error || `Page fetch failed: ${resp?.status || 'unknown'}`))
      }
    )
  })
}

async function getCsrfToken(): Promise<string | null> {
  try {
    const chromeAPI = (globalThis as any).chrome
    if (!chromeAPI?.runtime?.sendMessage) return null

    const resp = await new Promise<any>(resolve => {
      chromeAPI.runtime.sendMessage({ type: 'REQUEST_LINUX_DO_AUTH' }, resolve)
    })

    if (resp?.success && resp?.csrfToken) {
      return resp.csrfToken as string
    }
  } catch {
    return null
  }
  return null
}

export type LinuxDoGroupSummary = {
  id: number
  name: string
  full_name?: string | null
  title?: string | null
  user_count?: number
  is_group_user?: boolean
  is_group_owner?: boolean
  can_edit_group?: boolean
  public_admission?: boolean
  public_exit?: boolean
  visibility_level?: number
  bio_excerpt?: string
  flair_url?: string | null
}

export type LinuxDoGroupDetail = {
  group: LinuxDoGroupSummary & {
    can_see_members?: boolean
    is_group_owner_display?: boolean
  }
}

export async function fetchGroupList(): Promise<LinuxDoGroupSummary[]> {
  const url = `${HOST}/g.json`
  const res = await pageFetch<{ groups?: LinuxDoGroupSummary[] }>(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.data.groups || []
}

export async function fetchGroupDetail(groupName: string): Promise<LinuxDoGroupDetail> {
  const url = `${HOST}/g/${groupName}.json`
  const res = await pageFetch<LinuxDoGroupDetail>(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.data
}

export async function addGroupMembers(options: {
  groupIdentifier: string
  usernames: string[]
  notifyUsers: boolean
}) {
  const csrfToken = await getCsrfToken()
  if (!csrfToken) {
    throw new Error('Failed to get CSRF token')
  }

  const url = `${HOST}/groups/${options.groupIdentifier}/members.json`
  const formData = new URLSearchParams()
  formData.append('usernames', options.usernames.join(','))
  formData.append('emails', '')
  formData.append('notify_users', options.notifyUsers ? 'true' : 'false')

  const res = await pageFetch<any>(
    url,
    {
      method: 'PUT',
      headers: {
        Accept: '*/*',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Discourse-Logged-In': 'true',
        'Discourse-Present': 'true',
        'X-Csrf-Token': csrfToken,
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
