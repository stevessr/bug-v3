import { getChromeAPI } from '../utils/main.ts'

import * as storage from '@/utils/simpleStorage'
import type { Emoji, EmojiGroup } from '@/types/type'

export async function handleAddToFavorites(
  emoji: Partial<Emoji>,
  sendResponse: (response: { success: boolean; message?: string; error?: string }) => void
) {
  // mark callback as referenced to avoid unused-var lint
  void sendResponse
  try {
    const favoritesGroup =
      (await storage.getEmojiGroup('favorites')) ||
      ({ id: 'favorites', name: '常用表情', icon: '⭐', order: 0, emojis: [] } as EmojiGroup)

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
        ...(emoji.tags && emoji.tags.length > 0 ? { tags: emoji.tags } : {}),
        usageCount: 1,
        lastUsed: now,
        addedAt: now
      }
      favoritesGroup.emojis.push(favoriteEmoji)
    }

    favoritesGroup.emojis.sort((a: Emoji, b: Emoji) => (b.lastUsed || 0) - (a.lastUsed || 0))

    const currentIndex = await storage.getEmojiGroupIndex()
    const favoritesIndex = currentIndex.findIndex(entry => entry.id === 'favorites')
    if (favoritesIndex === -1) {
      const updatedIndex = [
        { id: 'favorites', order: 0 },
        ...currentIndex.map((entry, idx) => ({ ...entry, order: idx + 1 }))
      ]
      await storage.setEmojiGroupIndex(updatedIndex)
    } else if (favoritesIndex !== 0) {
      const reordered = currentIndex.filter(entry => entry.id !== 'favorites')
      const updatedIndex = [
        { id: 'favorites', order: 0 },
        ...reordered.map((entry, idx) => ({ ...entry, order: idx + 1 }))
      ]
      await storage.setEmojiGroupIndex(updatedIndex)
    }

    await storage.setEmojiGroup('favorites', favoritesGroup)

    const favoriteIds = favoritesGroup.emojis.reduce((acc, e) => {
      if (e.id) acc.push(e.id)
      return acc
    }, [] as string[])
    await storage.setFavorites(favoriteIds)

    const chromeAPI = getChromeAPI()
    if (chromeAPI && chromeAPI.runtime && chromeAPI.runtime.sendMessage) {
      try {
        const payload = {
          favoritesGroup,
          timestamp: Date.now()
        }

        const tabs = await chromeAPI.tabs.query({})
        for (const tab of tabs) {
          try {
            await chromeAPI.tabs.sendMessage(tab.id, {
              type: 'FAVORITES_UPDATED',
              payload
            })
          } catch (e) {
            void e
          }
        }

        await chromeAPI.runtime.sendMessage({
          type: 'FAVORITES_UPDATED',
          payload
        })
      } catch (e) {
        console.warn('Failed to send favorites update notification:', e)
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
