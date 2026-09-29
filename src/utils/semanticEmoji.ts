import type { AppSettings, Emoji, EmojiGroup } from '@/types/type'

export interface SemanticSuggestion {
  id: string
  score: number
}

export const semanticEmojiId = (emoji: Pick<Emoji, 'id' | 'groupId'>): string =>
  JSON.stringify([emoji.groupId, emoji.id])

export function semanticEmojiCandidates(groups: readonly EmojiGroup[]) {
  const candidates: Array<{ id: string; text: string; usageCount?: number }> = []
  const seen = new Set<string>()
  for (const group of groups) {
    for (const emoji of group.emojis || []) {
      if (!emoji?.id || !emoji.name) continue
      const id = semanticEmojiId(emoji)
      if (seen.has(id)) continue
      seen.add(id)
      candidates.push({
        id,
        text: [emoji.name, ...(emoji.tags || []).slice(0, 12), group.name]
          .filter(Boolean).join('，').slice(0, 160),
        usageCount: emoji.usageCount || 0
      })
      if (candidates.length >= 1000) return candidates
    }
  }
  return candidates
}

/** Only called by the user-facing search box after semantic suggestions are enabled. */
export async function suggestEmojis(
  query: string,
  groups: readonly EmojiGroup[],
  settings: AppSettings
): Promise<{ matches: SemanticSuggestion[]; error?: string }> {
  if (!settings.semanticSearchEnabled || query.trim().length < 2) return { matches: [] }
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'SEMANTIC_EMOJI_SEARCH',
      query: query.trim().slice(0, 120),
      items: semanticEmojiCandidates(groups)
    })
    if (!response?.success || !Array.isArray(response.data)) {
      return { matches: [], error: response?.error || '语义联想不可用' }
    }
    return {
      matches: response.data.filter(
        (item: any) => typeof item?.id === 'string' && Number.isFinite(item.score)
      )
    }
  } catch {
    return { matches: [], error: '无法连接到语义联想服务' }
  }
}
