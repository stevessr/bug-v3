import { getChromeAPI } from '../utils/main.ts'

import * as storage from '@/utils/simpleStorage'
import type { Emoji, EmojiGroup } from '@/types/type'
import { recordFavoriteUse } from '@/utils/favoriteReferences'

async function addToFavorites(
  emoji: Partial<Emoji>,
  sendResponse: (response: { success: boolean; message?: string; error?: string }) => void
) {
  // mark callback as referenced to avoid unused-var lint
  void sendResponse
  try {
    const groups = await storage.getAllEmojiGroups()
    const favoritesGroup = recordFavoriteUse(
      groups.find(group => group.id === 'favorites') ||
        ({ id: 'favorites', name: '常用表情', icon: '⭐', order: 0, emojis: [] } as EmojiGroup),
      emoji as Emoji,
      groups
    )

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

let favoriteQueue: Promise<void> = Promise.resolve()
export function handleAddToFavorites(
  emoji: Partial<Emoji>,
  sendResponse: (response: { success: boolean; message?: string; error?: string }) => void
): Promise<void> {
  const pending = favoriteQueue.then(() => addToFavorites(emoji, sendResponse))
  favoriteQueue = pending.catch(() => {})
  return pending
}
