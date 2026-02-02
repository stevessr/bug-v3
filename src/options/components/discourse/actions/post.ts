import { pageFetch, extractData } from '../utils'

export interface BookmarkPayload {
  postId: number
  bookmarked: boolean
  bookmark_id?: number | null
  reminder_at?: string | null
  name?: string | null
  auto_delete_preference?: number | null
}

export async function updateBookmark(baseUrl: string, payload: BookmarkPayload) {
  if (!payload.bookmark_id) {
    throw new Error('bookmark_id is required for update')
  }

  const params = new URLSearchParams()
  params.append('id', String(payload.bookmark_id))
  params.append('bookmarkable_id', String(payload.postId))
  params.append('bookmarkable_type', 'Post')
  params.append('auto_delete_preference', String(payload.auto_delete_preference ?? 3))

  if (payload.reminder_at !== undefined) {
    params.append('reminder_at', payload.reminder_at)
  }
  if (payload.name) {
    params.append('name', payload.name)
  } else {
    params.append('name', '')
  }

  const url = `${baseUrl}/bookmarks/${payload.bookmark_id}.json`
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
    const message = data?.errors?.join(', ') || data?.error || '更新书签失败'
    throw new Error(message)
  }
  return data
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
  const params = new URLSearchParams()
  params.append('bookmarkable_id', String(payload.postId))
  params.append('bookmarkable_type', 'Post')
  params.append('auto_delete_preference', '3')

  if (payload.bookmarked) {
    // 添加书签或更新提醒
    const url = `${baseUrl}/bookmarks.json`
    if (payload.reminder_at) {
      params.append('reminder_at', payload.reminder_at)
    } else {
      params.append('reminder_at', '')
    }
    const result = await pageFetch<any>(url, {
      method: 'POST',
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Discourse-Logged-In': 'true'
      },
      body: params.toString()
    })
    const data = extractData(result)
    if (result.ok === false) {
      const message = data?.errors?.join(', ') || data?.error || '添加书签失败'
      throw new Error(message)
    }
    return data
  } else {
    // 删除书签 - 使用 bookmark_id
    if (!payload.bookmark_id) {
      throw new Error('bookmark_id is required to delete bookmark')
    }

    const url = `${baseUrl}/bookmarks/${payload.bookmark_id}.json`
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
      const message = data?.errors?.join(', ') || data?.error || '删除书签失败'
      throw new Error(message)
    }
    return data
  }
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
