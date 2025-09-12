import { newStorageHelpers } from '../../utils/newStorage'
import { getChromeAPI } from '../utils'

export async function handleAddToFavorites(emoji: any, sendResponse: any) {
  void sendResponse
  try {
    const groups = await newStorageHelpers.getAllEmojiGroups()
    const favoritesGroup = groups.find((g: any) => g.id === 'favorites')
    if (!favoritesGroup) {
      console.warn('Favorites group not found - creating one')
      const newFavorites = { id: 'favorites', name: 'Favorites', icon: '⭐', order: 0, emojis: [] }
      groups.unshift(newFavorites)
    }

    const finalGroups = groups
    const favGroup = finalGroups.find((g: any) => g.id === 'favorites') as any

    const now = Date.now()
    const existingEmojiIndex = favGroup.emojis.findIndex((e: any) => e.url === emoji.url)

    if (existingEmojiIndex !== -1) {
      const existingEmoji = favGroup.emojis[existingEmojiIndex]
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
      const favoriteEmoji = {
        ...emoji,
        id: `fav-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        groupId: 'favorites',
        usageCount: 1,
        lastUsed: now,
        addedAt: now
      }
      favGroup.emojis.push(favoriteEmoji)
    }

    favGroup.emojis.sort((a: any, b: any) => (b.lastUsed || 0) - (a.lastUsed || 0))

    await newStorageHelpers.setAllEmojiGroups(finalGroups)

    const chromeAPI = getChromeAPI()
    if (chromeAPI && chromeAPI.storage && chromeAPI.storage.local) {
      try {
        await new Promise<void>((resolve, reject) => {
          chromeAPI.storage.local.set({ emojiGroups: finalGroups }, () => {
            if (chromeAPI.runtime.lastError) reject(chromeAPI.runtime.lastError)
            else resolve()
          })
        })
      } catch (_e) {
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
