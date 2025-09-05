import { defaultEmojiGroups } from '../types/defaultEmojiGroups'

// 返回由 src/config/default.json 生成的默认分组的表情列表。
// 优先返回 id 为 'nachoneko' 的分组，以保持原有默认体验；没有找到时回退到第一个有效分组。
export function getDefaultEmojis() {
  if (!defaultEmojiGroups || defaultEmojiGroups.length === 0) return []

  const preferredId = 'nachoneko'
  let group = defaultEmojiGroups.find(g => g.id === preferredId)
  if (!group) {
    // 尝试找到第一个不是收藏 (favorites) 的分组
    group = defaultEmojiGroups.find(g => g.id !== 'favorites') || defaultEmojiGroups[0]
  }

  return (group && group.emojis) || []
}
