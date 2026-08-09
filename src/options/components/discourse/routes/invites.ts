import type { ComputedRef, Ref } from 'vue'

import type { BrowserTab, Invite, InviteCounts } from '../types'
import { pageFetch, extractData } from '../utils'

export type InviteFilter = 'pending' | 'redeemed' | 'expired'

export type CreateInvitePayload = {
  email?: string
  groupNames?: string[]
  topicId?: number
  maxRedemptionsAllowed?: number | null
  expiresAt?: string | null
  customMessage?: string
  description?: string
  skipEmail?: boolean
}

const parseErrorMessage = (data: any, fallback: string) => {
  if (Array.isArray(data?.errors) && data.errors.length > 0) {
    return String(data.errors[0])
  }
  if (typeof data?.error === 'string' && data.error.trim()) return data.error
  if (typeof data?.message === 'string' && data.message.trim()) return data.message
  return fallback
}

const normalizeInvite = (value: any): Invite => ({ ...(value as Invite) })

const normalizeCounts = (value: any): InviteCounts => {
  if (!value || typeof value !== 'object') return {}
  const counts: InviteCounts = {}
  if (typeof value.pending === 'number') counts.pending = value.pending
  if (typeof value.expired === 'number') counts.expired = value.expired
  if (typeof value.redeemed === 'number') counts.redeemed = value.redeemed
  if (typeof value.total === 'number') counts.total = value.total
  return counts
}

export async function loadInvites(
  tab: BrowserTab,
  username: string,
  filter: InviteFilter,
  baseUrl: Ref<string>,
  reset = true
) {
  if (!tab.invitesState) {
    tab.invitesState = {
      filter,
      invites: [],
      offset: 0,
      hasMore: true,
      loading: false,
      creating: false,
      errorMessage: '',
      counts: {},
      canSeeInviteDetails: false
    }
  }

  const state = tab.invitesState
  if (state.loading) return

  if (reset) {
    state.filter = filter
    state.offset = 0
    state.hasMore = true
    state.invites = []
  }

  state.loading = true
  state.errorMessage = ''

  try {
    const encodedUsername = encodeURIComponent(username)
    const url = `${baseUrl.value}/u/${encodedUsername}/invited.json?filter=${filter}${
      state.offset > 0 ? `&offset=${state.offset}` : ''
    }`
    const result = await pageFetch<any>(url)
    const data = extractData(result)
    if (!result.ok) {
      throw new Error(parseErrorMessage(data, '加载邀请列表失败'))
    }

    const invites: Invite[] = (data?.invites || []).map(normalizeInvite)
    if (reset) {
      state.invites = invites
    } else {
      const existingIds = new Set(state.invites.map(item => item.id))
      const fresh = invites.filter(item => !existingIds.has(item.id))
      state.invites = [...state.invites, ...fresh]
    }

    state.canSeeInviteDetails = data?.can_see_invite_details !== false
    state.counts = normalizeCounts(data?.counts)
    state.hasMore = invites.length >= 50
    state.offset += invites.length
  } catch (error) {
    state.errorMessage = error instanceof Error ? error.message : String(error)
    state.hasMore = false
  } finally {
    state.loading = false
  }
}

export async function loadMoreInvites(
  activeTab: ComputedRef<BrowserTab | undefined>,
  baseUrl: Ref<string>,
  isLoadingMore: Ref<boolean>
) {
  const tab = activeTab.value
  if (!tab?.invitesState || isLoadingMore.value) return
  if (!tab.invitesState.hasMore || tab.invitesState.loading) return
  if (!tab.currentUser?.username) return

  isLoadingMore.value = true
  try {
    await loadInvites(tab, tab.currentUser.username, tab.invitesState.filter, baseUrl, false)
  } finally {
    isLoadingMore.value = false
  }
}

export async function createInvite(
  tab: BrowserTab,
  baseUrl: Ref<string>,
  payload: CreateInvitePayload
): Promise<Invite | null> {
  const state = tab.invitesState
  if (!state) return null
  state.creating = true
  state.errorMessage = ''

  try {
    const body: Record<string, any> = {}
    if (payload.email) body.email = payload.email
    if (payload.groupNames?.length) body.group_names = payload.groupNames.join(',')
    if (payload.topicId) body.topic_id = payload.topicId
    if (payload.maxRedemptionsAllowed != null) {
      body.max_redemptions_allowed = payload.maxRedemptionsAllowed
    }
    if (payload.expiresAt) body.expires_at = payload.expiresAt
    if (payload.customMessage) body.custom_message = payload.customMessage
    if (payload.description) body.description = payload.description
    if (payload.skipEmail) body.skip_email = true

    let lastError: string | null = null
    let data: any = null

    const attempts = [
      {
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      },
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
        body: new URLSearchParams(
          Object.entries(body).filter(([, v]) => v !== undefined && v !== null) as [
            string,
            string
          ][]
        ).toString()
      }
    ]

    for (const request of attempts) {
      try {
        const result = await pageFetch<any>(`${baseUrl.value}/invites`, {
          method: 'POST',
          headers: request.headers,
          body: request.body
        })
        data = extractData(result)
        if (result.ok) {
          const invite = data?.invite || data
          if (invite && typeof invite.id === 'number') {
            const normalized = normalizeInvite(invite)
            if (state.filter === 'pending') {
              state.invites = [normalized, ...state.invites]
            }
            return normalized
          }
          lastError = '邀请已创建，但未返回邀请数据'
          continue
        }
        lastError = parseErrorMessage(data, '创建邀请失败')
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error)
      }
    }

    throw new Error(lastError || '创建邀请失败')
  } catch (error) {
    state.errorMessage = error instanceof Error ? error.message : String(error)
    return null
  } finally {
    state.creating = false
  }
}

export async function deleteInvite(
  tab: BrowserTab,
  baseUrl: Ref<string>,
  inviteId: number
): Promise<boolean> {
  const state = tab.invitesState
  if (!state) return false
  state.errorMessage = ''

  try {
    const result = await pageFetch<any>(`${baseUrl.value}/invites`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
      body: new URLSearchParams({ id: String(inviteId) }).toString()
    })
    const data = extractData(result)
    if (!result.ok) {
      throw new Error(parseErrorMessage(data, '删除邀请失败'))
    }
    state.invites = state.invites.filter(item => item.id !== inviteId)
    return true
  } catch (error) {
    state.errorMessage = error instanceof Error ? error.message : String(error)
    return false
  }
}

export async function resendInvite(
  tab: BrowserTab,
  baseUrl: Ref<string>,
  email: string
): Promise<boolean> {
  const state = tab.invitesState
  if (!state) return false
  state.errorMessage = ''

  try {
    const result = await pageFetch<any>(`${baseUrl.value}/invites/reinvite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
      body: new URLSearchParams({ email }).toString()
    })
    const data = extractData(result)
    if (!result.ok) {
      throw new Error(parseErrorMessage(data, '重发邀请失败'))
    }
    return true
  } catch (error) {
    state.errorMessage = error instanceof Error ? error.message : String(error)
    return false
  }
}
