/**
 * 忽略（ignore）内容过滤的共享工具。
 *
 * 约定：当帖子/话题/消息/活动/通知/搜索结果的作者名落在被屏蔽集合中时，
 * 该内容在当前视图中隐藏；但例外情况是——当前正在查看被屏蔽用户本人的
 * 主页（exemptUsername === 作者），此时该作者的内容仍然显示
 * （对应"一旦用户被忽略，那么不再显示，除非在此用户首页"）。
 */

export const normalizeBlockUsername = (username?: string | null): string =>
  (username || '').trim().toLowerCase()

type TopicPosterLike = {
  user_id?: unknown
  username?: unknown
  primary?: unknown
  description?: unknown
}

/**
 * 从 Discourse 话题列表项中解析原始发帖人的用户名。
 * 列表接口通常只返回 `posters[].user_id`，并把原始发帖人放在首位，
 * 因此需要结合用户缓存解析；部分接口则直接返回 username/author。
 */
export const getTopicAuthorUsername = (
  topic: unknown,
  resolveUsername?: (userId: number) => string | undefined
): string | undefined => {
  if (!topic || typeof topic !== 'object') return undefined
  const value = topic as Record<string, unknown>

  const directCandidates = [
    value.author_username,
    value.username,
    (value.author as Record<string, unknown> | null | undefined)?.username,
    (value.user as Record<string, unknown> | null | undefined)?.username
  ]
  for (const candidate of directCandidates) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim()
  }

  const posters = Array.isArray(value.posters)
    ? (value.posters as TopicPosterLike[]).filter(Boolean)
    : []
  const originalPoster =
    posters.find(poster => {
      if (poster.primary === true) return true
      const description = typeof poster.description === 'string' ? poster.description : ''
      return /original|原始发帖人|原始發帖人/i.test(description)
    }) || posters[0]
  if (!originalPoster) return undefined

  if (typeof originalPoster.username === 'string' && originalPoster.username.trim()) {
    return originalPoster.username.trim()
  }

  const userId =
    typeof originalPoster.user_id === 'number'
      ? originalPoster.user_id
      : typeof originalPoster.user_id === 'string' && originalPoster.user_id.trim()
        ? Number(originalPoster.user_id)
        : NaN
  if (!Number.isFinite(userId) || !resolveUsername) return undefined
  return resolveUsername(userId)
}

/**
 * 判断一条由 authorUsername 出版的、被视为被屏蔽集合 blockedUsernames
 * 之一的内容，是否应当被过滤掉。
 *
 * @param blockedUsernames  当前登录用户已忽略的用户名集合
 * @param authorUsername    内容作者
 * @param exemptUsername    当前正在浏览其主页的用户的用户名；若是作者本人则豁免
 */
export const shouldFilterBlockedContent = (
  blockedUsernames: string[],
  authorUsername?: string | null,
  exemptUsername?: string | null
): boolean => {
  if (!authorUsername) return false
  const author = normalizeBlockUsername(authorUsername)
  if (!author) return false
  if (exemptUsername && author === normalizeBlockUsername(exemptUsername)) return false
  return blockedUsernames.some(name => normalizeBlockUsername(name) === author)
}
