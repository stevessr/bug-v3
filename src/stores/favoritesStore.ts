/**
 * Favorites Store
 * Handles favorites management including add, remove, usage tracking
 */

import type { Ref } from 'vue'

import type { SaveControl } from './core/types'

import type { Emoji, EmojiGroup } from '@/types/type'
import { newStorageHelpers } from '@/utils/newStorage'

export interface FavoritesStoreOptions {
  groups: Ref<EmojiGroup[]>
  favorites: Ref<Set<string>>
  isLoading: Ref<boolean>
  hasLoadedOnce: Ref<boolean>
  isReadOnlyMode: Ref<boolean>
  saveControl: SaveControl
}

/**
 * Ensure favorites group exists and return it
 */
function ensureFavoritesGroup(groups: Ref<EmojiGroup[]>): EmojiGroup {
  let favoritesGroup = groups.value.find(g => g.id === 'favorites')

  if (!favoritesGroup) {
    console.log('[FavoritesStore] Creating favorites group')
    favoritesGroup = {
      id: 'favorites',
      name: '常用表情',
      icon: '⭐',
      order: 0,
      emojis: []
    } as EmojiGroup
    groups.value.unshift(favoritesGroup)
  }

  if (!Array.isArray(favoritesGroup.emojis)) {
    favoritesGroup.emojis = []
  }

  return favoritesGroup
}

export function useFavoritesStore(options: FavoritesStoreOptions) {
  const { groups, favorites, isLoading, hasLoadedOnce, isReadOnlyMode, saveControl } = options

  // --- Save Operations ---

  /**
   * Save only the favorites group (for read-only mode in popup/sidebar)
   */
  const saveFavoritesOnly = async (): Promise<void> => {
    if (!hasLoadedOnce.value) {
      console.warn('[FavoritesStore] saveFavoritesOnly blocked - data not loaded yet')
      return
    }

    if (isLoading.value) {
      console.warn('[FavoritesStore] saveFavoritesOnly blocked - still loading')
      return
    }

    const favoritesGroup = ensureFavoritesGroup(groups)

    try {
      console.log(
        '[FavoritesStore] Saving favorites group only, emojis count:',
        favoritesGroup.emojis.length
      )

      // Ensure favorites group is in the index
      const currentIndex = await newStorageHelpers.getEmojiGroupIndex()
      const favoritesInIndex = currentIndex.some(entry => entry.id === 'favorites')

      if (!favoritesInIndex) {
        const newIndex = [
          { id: 'favorites', order: 0 },
          ...currentIndex.map((e, i) => ({ ...e, order: i + 1 }))
        ]
        await newStorageHelpers.setEmojiGroupIndexSync(newIndex)
        console.log('[FavoritesStore] Added favorites to group index')
      }

      await newStorageHelpers.setEmojiGroupSync(favoritesGroup.id, favoritesGroup)

      const favoriteIds = favoritesGroup.emojis.map(e => e.id).filter(Boolean)
      await newStorageHelpers.setFavoritesSync(favoriteIds)
      console.log('[FavoritesStore] Favorites saved successfully, ids:', favoriteIds.length)
    } catch (error) {
      console.error('[FavoritesStore] Failed to save favorites:', error)
    }
  }

  // --- Favorites Operations ---

  /**
   * Add an emoji to favorites with usage tracking
   */
  const addToFavorites = async (emoji: Emoji): Promise<void> => {
    if (!hasLoadedOnce.value || isLoading.value) {
      console.warn('[FavoritesStore] addToFavorites blocked - data not ready')
      return
    }

    const favoritesGroup = ensureFavoritesGroup(groups)
    const now = Date.now()
    const existingEmojiIndex = favoritesGroup.emojis.findIndex(e => e && e.url === emoji.url)

    if (existingEmojiIndex !== -1) {
      // Update usage tracking for existing emoji
      const existingEmoji = favoritesGroup.emojis[existingEmojiIndex]
      const lastUsed = existingEmoji.lastUsed || 0
      const timeDiff = now - lastUsed
      const twelveHours = 12 * 60 * 60 * 1000

      if (timeDiff < twelveHours) {
        existingEmoji.usageCount = (existingEmoji.usageCount || 0) + 1
        console.log('[FavoritesStore] Updated usage count:', emoji.name, existingEmoji.usageCount)
      } else {
        // Apply decay for old usage
        const currentCount = existingEmoji.usageCount || 1
        existingEmoji.usageCount = Math.floor(currentCount * 0.8) + 1
        existingEmoji.lastUsed = now
        console.log('[FavoritesStore] Applied decay:', emoji.name, existingEmoji.usageCount)
      }
    } else {
      // Add new emoji to favorites
      const favoriteEmoji: Emoji = {
        ...emoji,
        id: `fav-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        groupId: 'favorites',
        usageCount: 1,
        lastUsed: now,
        addedAt: now,
        tags: emoji.tags || []
      }
      favoritesGroup.emojis.push(favoriteEmoji)
      console.log('[FavoritesStore] Added to favorites:', emoji.name)
    }

    // Sort by lastUsed (most recent first)
    favoritesGroup.emojis.sort((a, b) => (b.lastUsed || 0) - (a.lastUsed || 0))

    if (isReadOnlyMode.value) {
      await saveFavoritesOnly()
    } else {
      saveControl.maybeSave()
    }
  }

  /**
   * Toggle favorite status for an emoji
   */
  const toggleFavorite = (emojiId: string): void => {
    if (favorites.value.has(emojiId)) {
      favorites.value.delete(emojiId)
    } else {
      favorites.value.add(emojiId)
    }
    console.log('[FavoritesStore] toggleFavorite', {
      id: emojiId,
      isFavorite: favorites.value.has(emojiId)
    })
    saveControl.maybeSave()
  }

  /**
   * Remove an emoji from favorites
   */
  const removeFromFavorites = (emojiId: string): void => {
    const favoritesGroup = groups.value.find(g => g.id === 'favorites')
    if (!favoritesGroup) return

    const index = favoritesGroup.emojis.findIndex(e => e.id === emojiId)
    if (index !== -1) {
      favoritesGroup.emojis.splice(index, 1)
      favorites.value.delete(emojiId)
      console.log('[FavoritesStore] Removed from favorites:', emojiId)
      saveControl.maybeSave()
    }
  }

  /**
   * Clear all favorites
   */
  const clearAllFavorites = (): void => {
    const favoritesGroup = groups.value.find(g => g.id === 'favorites')
    if (!favoritesGroup) {
      console.warn('[FavoritesStore] Favorites group not found')
      return
    }

    favoritesGroup.emojis = []
    try {
      favorites.value.clear()
    } catch {
      favorites.value = new Set()
    }

    console.log('[FavoritesStore] Cleared all favorites')
    saveControl.maybeSave()
  }

  /**
   * Check if an emoji is in favorites
   */
  const isFavorite = (emojiId: string): boolean => {
    return favorites.value.has(emojiId)
  }

  /**
   * Get favorites group
   */
  const getFavoritesGroup = (): EmojiGroup | undefined => {
    return groups.value.find(g => g.id === 'favorites')
  }

  /**
   * Get favorite emojis sorted by usage
   */
  const getFavoriteEmojis = (): Emoji[] => {
    const favoritesGroup = groups.value.find(g => g.id === 'favorites')
    if (!favoritesGroup?.emojis) return []
    return [...favoritesGroup.emojis].sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0))
  }

  /**
   * Get favorites count
   */
  const favoritesCount = (): number => {
    const favoritesGroup = groups.value.find(g => g.id === 'favorites')
    return favoritesGroup?.emojis?.length || 0
  }

  return {
    // Save
    saveFavoritesOnly,

    // Favorites operations
    addToFavorites,
    toggleFavorite,
    removeFromFavorites,
    clearAllFavorites,

    // Queries
    isFavorite,
    getFavoritesGroup,
    getFavoriteEmojis,
    favoritesCount
  }
}

export type FavoritesStore = ReturnType<typeof useFavoritesStore>
