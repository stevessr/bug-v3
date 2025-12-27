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
        ...(emoji.tags && emoji.tags.length > 0 ? { tags: emoji.tags } : {}),
        usageCount: 1,
        lastUsed: now,
        addedAt: now
      }
      favoritesGroup.emojis.push(favoriteEmoji)
    }

    favoritesGroup.emojis.sort((a: Emoji, b: Emoji) => (b.lastUsed || 0) - (a.lastUsed || 0))

    // Persist via newStorageHelpers which updates group index and individual groups
    await newStorageHelpers.setAllEmojiGroups(groups)

    // 确保 localStorage 也被更新 - 直接操作 localStorage 作为备用
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(
          'emojiGroups',
          JSON.stringify({
            data: groups,
            timestamp: Date.now()
          })
        )
        console.log('[handleAddToFavorites] localStorage updated directly')
      }
    } catch (e) {
      console.warn('[handleAddToFavorites] Failed to update localStorage directly:', e)
    }

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
        console.log('[handleAddToFavorites] chrome.storage.local updated')
      } catch (_e) {
        console.warn('[handleAddToFavorites] Failed to update chrome.storage.local:', _e)
      }
    }

    // 发送收藏夹更新通知到所有上下文，特别是 Options 页面
    if (chromeAPI && chromeAPI.runtime && chromeAPI.runtime.sendMessage) {
      try {
        // 向所有标签页发送消息
        const tabs = await chromeAPI.tabs.query({})
        for (const tab of tabs) {
          try {
            await chromeAPI.tabs.sendMessage(tab.id, {
              type: 'FAVORITES_UPDATED',
              payload: {
                favoritesGroup: favoritesGroup,
                timestamp: Date.now()
              }
            })
          } catch (e) {
            // 忽略无法发送消息的标签页
            void e
          }
        }

        // 向扩展的 runtime 发送消息（通知 Options 页面）
        await chromeAPI.runtime.sendMessage({
          type: 'FAVORITES_UPDATED',
          payload: {
            favoritesGroup: favoritesGroup,
            timestamp: Date.now()
          }
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
