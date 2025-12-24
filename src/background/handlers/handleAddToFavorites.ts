import { getChromeAPI } from '../utils/main.ts'

import { newStorageHelpers } from '@/utils/newStorage'
import type { Emoji, EmojiGroup } from '@/types/type'

export async function handleAddToFavorites(
  emoji: Partial<Emoji>,
  sendResponse: (response: { success: boolean; message?: string; error?: string }) => void
) {
  // mark callback as referenced to avoid unused-var lint
  void sendResponse
  try {
    // Use the unified newStorageHelpers to read/update groups for consistency
    const groups = await newStorageHelpers.getAllEmojiGroups()
    let favoritesGroup = groups.find((g: EmojiGroup) => g.id === 'favorites')
    if (!favoritesGroup) {
      console.warn('Favorites group not found - creating one')
      favoritesGroup = { id: 'favorites', name: '常用表情', icon: '⭐', order: 0, emojis: [] }
      groups.unshift(favoritesGroup)
    }

    // Ensure emojis array exists
    if (!Array.isArray(favoritesGroup.emojis)) {
      favoritesGroup.emojis = []
    }

    const now = Date.now()
    const existingEmojiIndex = favoritesGroup.emojis.findIndex((e: Emoji) => e.url === emoji.url)

    if (existingEmojiIndex !== -1) {
      const existingEmoji = favoritesGroup.emojis[existingEmojiIndex]
      const lastUsed = existingEmoji.lastUsed || 0
      const timeDiff = now - lastUsed
      const twelveHours = 12 * 60 * 60 * 1000

      if (timeDiff < twelveHours) {
        existingEmoji.usageCount = (existingEmoji.usageCount || 0) + 1
      } else {
        const currentCount = existingEmoji.usageCount || 1
        existingEmoji.usageCount = Math.floor(currentCount * 0.8) + 1
        existingEmoji.lastUsed = now
      }
    } else {
      const favoriteEmoji: Emoji = {
        ...emoji,
        id: `fav-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        packet: emoji.packet ?? 0,
        name: emoji.name ?? '',
        url: emoji.url ?? '',
        groupId: 'favorites',
        tags: emoji.tags ?? [],
        usageCount: 1,
        lastUsed: now,
        addedAt: now
      }
      favoritesGroup.emojis.push(favoriteEmoji)
    }

    favoritesGroup.emojis.sort((a: Emoji, b: Emoji) => (b.lastUsed || 0) - (a.lastUsed || 0))

    // Persist via newStorageHelpers which updates group index and individual groups
    await newStorageHelpers.setAllEmojiGroups(groups)

    // Notify content scripts by updating chrome.storage (legacy compatibility)
    const chromeAPI = getChromeAPI()
    if (chromeAPI && chromeAPI.storage && chromeAPI.storage.local) {
      try {
        await new Promise<void>((resolve, reject) => {
          chromeAPI.storage.local.set({ emojiGroups: groups }, () => {
            if (chromeAPI.runtime.lastError) reject(chromeAPI.runtime.lastError)
            else resolve()
          })
        })
      } catch (_e) {
        // ignored intentionally
        void _e
      }
    }

    sendResponse({ success: true, message: 'Added to favorites' })
  } catch (error) {
    console.error('Failed to add emoji to favorites:', error)
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
