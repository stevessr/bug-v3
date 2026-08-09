import type { ComputedRef, Ref } from 'vue'

import type {
  BrowserTab,
  DiscourseUser,
  Reviewable,
  ReviewPerformResult,
  ReviewStatus
} from '../types'
import { pageFetch, extractData } from '../utils'

const REVIEW_ENDPOINTS = ['/review']

const parseErrorMessage = (data: any, fallback: string) => {
  if (Array.isArray(data?.errors) && data.errors.length > 0) {
    return String(data.errors[0])
  }
  if (typeof data?.error === 'string' && data.error.trim()) return data.error
  if (typeof data?.message === 'string' && data.message.trim()) return data.message
  return fallback
}

const normalizeReviewable = (value: any): Reviewable => {
  const reviewable = { ...(value as Reviewable) }
  if (reviewable.status === undefined && typeof value?.status_for_database === 'number') {
    reviewable.status = value.status_for_database
  }
  if (!Array.isArray(reviewable.reviewable_scores)) {
    reviewable.reviewable_scores = []
  }
  if (!Array.isArray(reviewable.bundled_actions)) {
    reviewable.bundled_actions = []
  }
  if (!Array.isArray(reviewable.editable_fields)) {
    reviewable.editable_fields = []
  }
  return reviewable
}

const registerUsers = (
  users: Ref<Map<number, DiscourseUser>>,
  data: any,
  reviewables: Reviewable[]
) => {
  const rawUsers = data?.users
  if (Array.isArray(rawUsers)) {
    rawUsers.forEach((u: DiscourseUser) => {
      if (u && typeof u.id === 'number') users.value.set(u.id, u)
    })
  }
  reviewables.forEach(reviewable => {
    const candidates = [
      reviewable.created_by,
      reviewable.target_created_by,
      reviewable.target_deleted_by,
      ...(reviewable.reviewable_scores || []).map(score => score.user),
      ...(reviewable.reviewable_scores || []).map(score => score.reviewed_by),
      reviewable.claimed_by?.user
    ]
    candidates.forEach(user => {
      if (user && typeof user.id === 'number') {
        users.value.set(user.id, user)
      }
    })
  })
}

export async function loadReview(
  tab: BrowserTab,
  status: ReviewStatus,
  baseUrl: Ref<string>,
  users: Ref<Map<number, DiscourseUser>>,
  reset = true
) {
  if (!tab.reviewState) {
    tab.reviewState = {
      status,
      typeFilter: '',
      reviewables: [],
      offset: 0,
      hasMore: true,
      loading: false,
      performingId: null,
      errorMessage: '',
      totalRows: 0,
      reviewableCount: 0,
      unseenReviewableCount: 0,
      types: []
    }
  }

  const state = tab.reviewState
  if (state.loading) return

  if (reset) {
    state.status = status
    state.offset = 0
    state.hasMore = true
    state.reviewables = []
  }

  state.loading = true
  state.errorMessage = ''

  try {
    const params = new URLSearchParams()
    params.set('status', state.status)
    if (state.typeFilter) {
      params.set('type', state.typeFilter)
    }
    if (state.offset > 0) {
      params.set('offset', String(state.offset))
    }

    let lastError: string | null = null
    let data: any = null
    for (const path of REVIEW_ENDPOINTS) {
      try {
        const result = await pageFetch<any>(`${baseUrl.value}${path}?${params.toString()}`)
        data = extractData(result)
        if (result.ok) {
          break
        }
        lastError = parseErrorMessage(data, '加载审核队列失败')
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error)
      }
    }

    if (!data) {
      throw new Error(lastError || '加载审核队列失败')
    }

    const reviewables: Reviewable[] = (data.reviewables || []).map(normalizeReviewable)
    registerUsers(users, data, reviewables)

    if (reset) {
      state.reviewables = reviewables
    } else {
      const existingIds = new Set(state.reviewables.map(item => item.id))
      const fresh = reviewables.filter(item => !existingIds.has(item.id))
      state.reviewables = [...state.reviewables, ...fresh]
    }

    const meta = data.meta || {}
    state.totalRows = Number(meta.total_rows_reviewables ?? state.totalRows)
    state.reviewableCount = Number(meta.reviewable_count ?? state.reviewableCount)
    state.unseenReviewableCount = Number(
      meta.unseen_reviewable_count ?? state.unseenReviewableCount
    )
    if (Array.isArray(meta.reviewable_types)) {
      state.types = meta.reviewable_types
    }
    state.hasMore = reviewables.length >= 50
    state.offset += reviewables.length
  } catch (error) {
    state.errorMessage = error instanceof Error ? error.message : String(error)
    state.hasMore = false
  } finally {
    state.loading = false
  }
}

export async function loadMoreReviewables(
  activeTab: ComputedRef<BrowserTab | undefined>,
  baseUrl: Ref<string>,
  users: Ref<Map<number, DiscourseUser>>,
  isLoadingMore: Ref<boolean>
) {
  const tab = activeTab.value
  if (!tab?.reviewState || isLoadingMore.value) return
  if (!tab.reviewState.hasMore || tab.reviewState.loading) return

  isLoadingMore.value = true
  try {
    await loadReview(tab, tab.reviewState.status, baseUrl, users, false)
  } finally {
    isLoadingMore.value = false
  }
}

export async function performReviewableAction(
  tab: BrowserTab,
  baseUrl: Ref<string>,
  reviewableId: number,
  version: number,
  serverAction: string,
  extra: Record<string, any> = {}
): Promise<ReviewPerformResult | null> {
  const state = tab.reviewState
  if (!state) return null

  state.performingId = reviewableId
  state.errorMessage = ''

  try {
    const params = new URLSearchParams({ version: String(version) })
    const url = `${baseUrl.value}/review/${reviewableId}/perform/${encodeURIComponent(serverAction)}?${params.toString()}`

    let lastError: string | null = null
    let data: any = null
    let ok = false

    // Try JSON first, then form-encoded (some plugins require form data)
    const attempts = [
      {
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(extra)
      },
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
        body: new URLSearchParams(
          Object.entries(extra).filter(([, v]) => v !== undefined && v !== null) as [
            string,
            string
          ][]
        ).toString()
      }
    ]

    for (const request of attempts) {
      try {
        const result = await pageFetch<any>(url, {
          method: 'PUT',
          headers: request.headers,
          body: request.body
        })
        data = extractData(result)
        if (result.ok) {
          ok = true
          break
        }
        lastError = parseErrorMessage(data, '执行审核操作失败')
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error)
      }
    }

    if (!ok) {
      throw new Error(lastError || '执行审核操作失败')
    }

    const payload = data?.reviewable_perform_result || data
    const result: ReviewPerformResult = {
      success: payload?.success !== false,
      created_post_id: payload?.created_post_id,
      created_post_topic_id: payload?.created_post_topic_id,
      remove_reviewable_ids: payload?.remove_reviewable_ids,
      reviewable_updates: payload?.reviewable_updates,
      version: payload?.version,
      reviewable_count: payload?.reviewable_count,
      unseen_reviewable_count: payload?.unseen_reviewable_count
    }

    applyReviewPerformResult(state, reviewableId, result)
    return result
  } catch (error) {
    state.errorMessage = error instanceof Error ? error.message : String(error)
    return null
  } finally {
    state.performingId = null
  }
}

export function applyReviewPerformResult(
  state: NonNullable<BrowserTab['reviewState']>,
  reviewableId: number,
  result: ReviewPerformResult
) {
  const removeIds = new Set((result.remove_reviewable_ids || []).map(Number))
  if (reviewableId > 0) removeIds.add(reviewableId)

  if (removeIds.size > 0) {
    state.reviewables = state.reviewables.filter(item => !removeIds.has(item.id))
  }

  if (result.reviewable_updates) {
    state.reviewables = state.reviewables.map(item => {
      const update = result.reviewable_updates?.[item.id]
      if (!update) return item
      const statusMap: Record<string, number> = {
        pending: 0,
        approved: 1,
        rejected: 2,
        ignored: 3,
        deleted: 4
      }
      const status = statusMap[update.status]
      if (status === undefined) return item
      return { ...item, status }
    })
  }

  if (typeof result.reviewable_count === 'number') {
    state.reviewableCount = result.reviewable_count
  }
  if (typeof result.unseen_reviewable_count === 'number') {
    state.unseenReviewableCount = result.unseen_reviewable_count
  }
  state.totalRows = Math.max(0, state.totalRows - (removeIds.size > 0 ? 1 : 0))
}

export async function updateReviewable(
  tab: BrowserTab,
  baseUrl: Ref<string>,
  reviewableId: number,
  version: number,
  updates: Record<string, any>
): Promise<Reviewable | null> {
  const state = tab.reviewState
  if (!state) return null
  state.errorMessage = ''

  try {
    const params = new URLSearchParams({ version: String(version) })
    const url = `${baseUrl.value}/review/${reviewableId}?${params.toString()}`
    const result = await pageFetch<any>(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewable: updates })
    })
    const data = extractData(result)
    if (!result.ok) {
      throw new Error(parseErrorMessage(data, '更新审核项失败'))
    }

    const index = state.reviewables.findIndex(item => item.id === reviewableId)
    if (index === -1) return null
    const updated = normalizeReviewable({ ...state.reviewables[index], ...data })
    state.reviewables[index] = updated
    return updated
  } catch (error) {
    state.errorMessage = error instanceof Error ? error.message : String(error)
    return null
  }
}

export async function deleteReviewable(
  tab: BrowserTab,
  baseUrl: Ref<string>,
  reviewableId: number,
  version: number
): Promise<boolean> {
  const state = tab.reviewState
  if (!state) return false
  state.errorMessage = ''

  try {
    const params = new URLSearchParams({ version: String(version) })
    const url = `${baseUrl.value}/review/${reviewableId}?${params.toString()}`
    const result = await pageFetch<any>(url, { method: 'DELETE' })
    if (!result.ok) {
      const data = extractData(result)
      throw new Error(parseErrorMessage(data, '删除审核项失败'))
    }
    state.reviewables = state.reviewables.filter(item => item.id !== reviewableId)
    state.totalRows = Math.max(0, state.totalRows - 1)
    return true
  } catch (error) {
    state.errorMessage = error instanceof Error ? error.message : String(error)
    return false
  }
}
