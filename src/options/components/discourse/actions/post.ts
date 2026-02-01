import { pageFetch, extractData } from '../utils'

export interface BookmarkPayload {
  postId: number
  bookmarked: boolean
  reminder_at?: string | null
  name?: string | null
}

export interface FlagPayload {
  postId: number
  flagType: string
  message?: string
}

export interface AssignPayload {
  postId: number
  assigneeId: number
}

export interface EditPostPayload {
  postId: number
  raw: string
  editReason?: string
}

export async function togglePostLike(baseUrl: string, postId: number, reactionId = 'heart') {
  const url = `${baseUrl}/discourse-reactions/posts/${postId}/custom-reactions/${reactionId}/toggle.json`
  const result = await pageFetch<any>(url, {
    method: 'PUT',
    headers: {
      'X-Requested-With': 'XMLHttpRequest',
      'Content-Type': 'application/json',
      'Discourse-Logged-In': 'true'
    }
  })
  const data = extractData(result)
  if (result.ok === false) {
    const message = data?.errors?.join(', ') || data?.error || '点赞失败'
    throw new Error(message)
  }
  return data
}

export async function toggleBookmark(baseUrl: string, payload: BookmarkPayload) {
  const url = `${baseUrl}/bookmark`
  const result = await pageFetch<any>(url, {
    method: 'POST',
    headers: {
      'X-Requested-With': 'XMLHttpRequest',
      'Content-Type': 'application/json',
      'Discourse-Logged-In': 'true'
    },
    body: JSON.stringify({
      post_id: payload.postId,
      bookmarked: payload.bookmarked,
      reminder_at: payload.reminder_at,
      name: payload.name
    })
  })
  const data = extractData(result)
  if (result.ok === false) {
    const message = data?.errors?.join(', ') || data?.error || '书签操作失败'
    throw new Error(message)
  }
  return data
}

export async function flagPost(baseUrl: string, payload: FlagPayload) {
  const url = `${baseUrl}/post_actions`
  const result = await pageFetch<any>(url, {
    method: 'POST',
    headers: {
      'X-Requested-With': 'XMLHttpRequest',
      'Content-Type': 'application/json',
      'Discourse-Logged-In': 'true'
    },
    body: JSON.stringify({
      id: payload.postId,
      post_action_type_id: parseInt(payload.flagType, 10),
      message: payload.message || ''
    })
  })
  const data = extractData(result)
  if (result.ok === false) {
    const message = data?.errors?.join(', ') || data?.error || '举报失败'
    throw new Error(message)
  }
  return data
}

export async function assignPost(baseUrl: string, payload: AssignPayload) {
  const url = `${baseUrl}/assign/assign`
  const result = await pageFetch<any>(url, {
    method: 'PUT',
    headers: {
      'X-Requested-With': 'XMLHttpRequest',
      'Content-Type': 'application/json',
      'Discourse-Logged-In': 'true'
    },
    body: JSON.stringify({
      target_id: payload.assigneeId,
      target_type: 'User',
      post_id: payload.postId
    })
  })
  const data = extractData(result)
  if (result.ok === false) {
    const message = data?.errors?.join(', ') || data?.error || '指定失败'
    throw new Error(message)
  }
  return data
}

export async function editPost(baseUrl: string, payload: EditPostPayload) {
  const url = `${baseUrl}/posts/${payload.postId}`
  const params = new URLSearchParams()
  params.append('post[raw]', payload.raw)
  if (payload.editReason) {
    params.append('post[edit_reason]', payload.editReason)
  }

  const result = await pageFetch<any>(url, {
    method: 'PUT',
    headers: {
      'X-Requested-With': 'XMLHttpRequest',
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'Discourse-Logged-In': 'true'
    },
    body: params.toString()
  })
  const data = extractData(result)
  if (result.ok === false) {
    const message = data?.errors?.join(', ') || data?.error || '编辑失败'
    throw new Error(message)
  }
  return data
}

export async function deletePost(baseUrl: string, postId: number) {
  const url = `${baseUrl}/posts/${postId}`
  const result = await pageFetch<any>(url, {
    method: 'DELETE',
    headers: {
      'X-Requested-With': 'XMLHttpRequest',
      'Content-Type': 'application/json',
      'Discourse-Logged-In': 'true'
    }
  })
  const data = extractData(result)
  if (result.ok === false) {
    const message = data?.errors?.join(', ') || data?.error || '删除失败'
    throw new Error(message)
  }
  return data
}

export async function recoverPost(baseUrl: string, postId: number) {
  const url = `${baseUrl}/posts/${postId}/recover`
  const result = await pageFetch<any>(url, {
    method: 'PUT',
    headers: {
      'X-Requested-With': 'XMLHttpRequest',
      'Content-Type': 'application/json',
      'Discourse-Logged-In': 'true'
    }
  })
  const data = extractData(result)
  if (result.ok === false) {
    const message = data?.errors?.join(', ') || data?.error || '恢复失败'
    throw new Error(message)
  }
  return data
}

export async function toggleWiki(baseUrl: string, postId: number, wiki: boolean) {
  const url = `${baseUrl}/posts/${postId}/wiki`
  const result = await pageFetch<any>(url, {
    method: 'PUT',
    headers: {
      'X-Requested-With': 'XMLHttpRequest',
      'Content-Type': 'application/json',
      'Discourse-Logged-In': 'true'
    },
    body: JSON.stringify({ wiki })
  })
  const data = extractData(result)
  if (result.ok === false) {
    const message = data?.errors?.join(', ') || data?.error || 'Wiki 操作失败'
    throw new Error(message)
  }
  return data
}
