
import { getDefaultEmojisAsync } from '../../data/default'
import { cachedState } from '../../data/state'

export function ensureDefaultIfEmpty() {
  if (!Array.isArray(cachedState.emojiGroups) || cachedState.emojiGroups.length === 0) {
    const defaultEmojis = getDefaultEmojisAsync()
    cachedState.emojiGroups = [
      { id: 'default', name: '默认表情', icon: '😀', order: 0, emojis: defaultEmojis }
    ]
  }
}

export { cachedState };