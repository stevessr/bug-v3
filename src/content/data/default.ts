// Content scripts need a reliable, synchronous copy of defaults because they
// may run in environments where fetching runtime assets is unreliable.
import type { EmojiGroup } from '@/types/type'
// Small, content-specific local copy. Keep minimal to avoid huge bundles.
// This ensures content has a dependable fallback when async loading fails.
const contentDefaultEmojiGroups: EmojiGroup[] = [
  {
    id: 'nachoneko',
    name: '默认',
    icon: '😺',
    order: 0,
    emojis: []
  }
]
// Async loader: attempts to fetch packaged defaults at runtime and returns the
// preferred group's emojis; on error falls back to the synchronous content copy.
export async function getDefaultEmojisAsync(): Promise<any[]> {
  return contentDefaultEmojiGroups
}
