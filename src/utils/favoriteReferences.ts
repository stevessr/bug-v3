import type { Emoji, EmojiGroup } from '@/types/type'

/** Resolve historical copied favorites and lightweight references against their owner group. */
export function resolveFavoriteGroup(group: EmojiGroup, groups: EmojiGroup[]): EmojiGroup {
  const sources = groups.filter(value => value.id !== 'favorites')
  const byKey = new Map<string, Emoji>()
  const byId = new Map<string, { emoji: Emoji; groupId: string }>()
  const byUrl = new Map<string, { emoji: Emoji; groupId: string }>()
  for (const source of sources)
    for (const emoji of source.emojis || []) {
      byKey.set(`${source.id}\0${emoji.id}`, emoji)
      byId.set(emoji.id, { emoji, groupId: source.id })
      if (!byUrl.has(emoji.url)) byUrl.set(emoji.url, { emoji, groupId: source.id })
    }
  const resolved = new Map<string, Emoji>()
  for (const entry of group.emojis || []) {
    if (!entry) continue
    const referenced = entry.sourceGroupId && entry.sourceEmojiId
    const source = referenced
      ? {
          emoji: byKey.get(`${entry.sourceGroupId}\0${entry.sourceEmojiId}`),
          groupId: entry.sourceGroupId || ''
        }
      : byId.get(entry.id) || byUrl.get(entry.url)
    // Deleted/archived references do not render broken tiles. Unmatched historical
    // copies are retained so upgrading never silently loses user-owned images.
    if (referenced && !source?.emoji) continue
    const emoji: Emoji = source?.emoji
      ? {
          ...source.emoji,
          groupId: source.groupId,
          sourceGroupId: source.groupId,
          sourceEmojiId: source.emoji.id,
          usageCount: entry.usageCount || 0,
          lastUsed: entry.lastUsed || 0,
          addedAt: entry.addedAt
        }
      : { ...entry }
    if (!emoji.url || !emoji.name) continue
    const key = emoji.sourceGroupId ? `${emoji.sourceGroupId}\0${emoji.sourceEmojiId}` : emoji.url
    const previous = resolved.get(key)
    if (previous) {
      previous.usageCount = (previous.usageCount || 0) + (emoji.usageCount || 0)
      previous.lastUsed = Math.max(previous.lastUsed || 0, emoji.lastUsed || 0)
    } else resolved.set(key, emoji)
  }
  return {
    ...group,
    emojis: [...resolved.values()].sort(
      (a, b) => (b.usageCount || 0) - (a.usageCount || 0) || (b.lastUsed || 0) - (a.lastUsed || 0)
    )
  }
}

/** Only store references/counters for known owners; never persist a second image copy. */
export function packFavoriteGroup(value: unknown): unknown {
  const group = value as EmojiGroup | null
  if (!group || !Array.isArray(group.emojis)) return value
  return {
    ...group,
    emojis: group.emojis.map(emoji =>
      emoji.sourceGroupId && emoji.sourceEmojiId
        ? {
            id: emoji.id,
            sourceGroupId: emoji.sourceGroupId,
            sourceEmojiId: emoji.sourceEmojiId,
            usageCount: emoji.usageCount || 0,
            lastUsed: emoji.lastUsed || 0
          }
        : emoji
    )
  }
}

export function recordFavoriteUse(
  group: EmojiGroup,
  emoji: Emoji,
  groups: EmojiGroup[],
  now = Date.now()
): EmojiGroup {
  const normalized = resolveFavoriteGroup(group, groups)
  const candidate = resolveFavoriteGroup(
    {
      ...group,
      emojis: [
        {
          ...emoji,
          id: emoji.id || `fav-${now}-${Math.random().toString(36).slice(2, 8)}`,
          name: emoji.name || '表情',
          groupId: emoji.groupId || 'favorites',
          usageCount: 0
        }
      ]
    },
    groups
  ).emojis[0]
  if (!candidate) return normalized
  const existing = normalized.emojis.find(item =>
    candidate.sourceGroupId
      ? item.sourceGroupId === candidate.sourceGroupId &&
        item.sourceEmojiId === candidate.sourceEmojiId
      : item.url === candidate.url
  )
  if (existing) {
    existing.usageCount = (existing.usageCount || 0) + 1
    existing.lastUsed = now
  } else normalized.emojis.push({ ...candidate, usageCount: 1, lastUsed: now })
  normalized.emojis.sort(
    (a, b) => (b.usageCount || 0) - (a.usageCount || 0) || (b.lastUsed || 0) - (a.lastUsed || 0)
  )
  return normalized
}
