import { defineStore } from 'pinia'
import { ref, computed, watch, nextTick } from 'vue'

import type { Emoji, EmojiGroup, AppSettings } from '../types/emoji'
import { newStorageHelpers } from '../utils/newStorage'
import { defaultEmojiGroups, defaultSettings } from '@/types/emoji'

/* eslint-disable @typescript-eslint/no-explicit-any */
import { logger } from '@/config/buildFlags'

export const useEmojiStore = defineStore('emojiExtension', () => {
  // --- State ---
  const groups = ref<EmojiGroup[]>([])
  const settings = ref<AppSettings>(defaultSettings)
  const favorites = ref<Set<string>>(new Set())
  const activeGroupId = ref<string>('nachoneko')
  const searchQuery = ref<string>(' ')
  const isLoading = ref(true)
  const isSaving = ref(false)

  // --- Computed ---
  const activeGroup = computed(
    () => groups.value.find(g => g.id === activeGroupId.value) || groups.value[0]
  )

  const filteredEmojis = computed(() => {
    if (!activeGroup.value) return []

    let emojis = activeGroup.value.emojis

    if (searchQuery.value) {
      const query = searchQuery.value.toLowerCase().trim()
      if (query) {
        emojis = emojis.filter(emoji => emoji.name.toLowerCase().includes(query))
      }
    }

    return emojis
  })

  const sortedGroups = computed(() => {
    const allGroups = [...groups.value]
    const favoritesGroup = allGroups.find(g => g.id === 'favorites')
    const otherGroups = allGroups
      .filter(g => g.id !== 'favorites')
      .sort((a, b) => a.order - b.order)

    // Always put favorites first if it exists
    return favoritesGroup ? [favoritesGroup, ...otherGroups] : otherGroups
  })

  // --- Save control (batching) ---
  let batchDepth = 0
  const pendingSave = ref(false)

  const beginBatch = () => {
    batchDepth++
  }

  const endBatch = async () => {
    if (batchDepth > 0) batchDepth--
    if (batchDepth === 0 && pendingSave.value && !isSaving.value && !isLoading.value) {
      pendingSave.value = false
      await saveData()
    }
  }

  const maybeSave = () => {
    if (isLoading.value || isSaving.value || batchDepth > 0) {
      pendingSave.value = true
      return
    }
    // fire-and-forget; outer callers need not await persistence
    void saveData()
  }

  // --- Actions ---

  const loadData = async () => {
    logger.log('[EmojiStore] Starting loadData with new storage system')
    isLoading.value = true
    try {
      // Load data using new storage system with conflict resolution
      logger.log('[EmojiStore] Loading data from new storage system')
      const [loadedGroups, loadedSettings, loadedFavorites] = await Promise.allSettled([
        newStorageHelpers.getAllEmojiGroups(),
        newStorageHelpers.getSettings(),
        newStorageHelpers.getFavorites()
      ])

      // Extract successful results
      const groupsData = loadedGroups.status === 'fulfilled' ? loadedGroups.value : null
      const settingsData = loadedSettings.status === 'fulfilled' ? loadedSettings.value : null
      const favoritesData = loadedFavorites.status === 'fulfilled' ? loadedFavorites.value : null

      // Log any loading errors but don't fail completely
      if (loadedGroups.status === 'rejected') {
        logger.error('[EmojiStore] Failed to load groups:', loadedGroups.reason)
      }
      if (loadedSettings.status === 'rejected') {
        logger.error('[EmojiStore] Failed to load settings:', loadedSettings.reason)
      }
      if (loadedFavorites.status === 'rejected') {
        logger.error('[EmojiStore] Failed to load favorites:', loadedFavorites.reason)
      }

      // Detailed data loading debug info
      logger.log('[EmojiStore] Raw loaded data:')
      logger.log('  - loadedGroups:', groupsData)
      logger.log('  - loadedSettings:', settingsData)
      logger.log('  - loadedFavorites:', favoritesData)

      // Summarize loaded data to avoid huge console dumps
      logger.log('[EmojiStore] Data loaded summary:', {
        groupsCount: groupsData?.length || 0,
        groupsValid: Array.isArray(groupsData),
        settingsLastModified: settingsData?.lastModified,
        favoritesCount: favoritesData?.length || 0
      })

      groups.value =
        groupsData && groupsData.length > 0
          ? groupsData
          : JSON.parse(JSON.stringify(defaultEmojiGroups))
      settings.value = { ...defaultSettings, ...settingsData }
      favorites.value = new Set(favoritesData || [])

      logger.log('[EmojiStore] Final groups after assignment:', {
        count: groups.value?.length || 0,
        groupIds: groups.value?.map((g: any) => g.id) || []
      })

      // If we used default data, save it to storage for next time (with error handling)
      if (!groupsData || groupsData.length === 0) {
        logger.log('[EmojiStore] No groups loaded, saving default groups to storage')
        newStorageHelpers.setAllEmojiGroups(groups.value).catch(error => {
          logger.error('[EmojiStore] Failed to save default groups:', error)
        })
      }
      if (!settingsData || Object.keys(settingsData).length === 0) {
        logger.log('[EmojiStore] No settings loaded, saving default settings to storage')
        newStorageHelpers.setSettings(settings.value).catch(error => {
          logger.error('[EmojiStore] Failed to save default settings:', error)
        })
      }

      activeGroupId.value = settings.value.defaultGroup || 'nachoneko'

      logger.log('[EmojiStore] LoadData completed successfully')
    } catch (error) {
      const e: any = error
      logger.error('[EmojiStore] Failed to load initial data:', e?.stack || e)
      // Fallback to defaults in case of error
      groups.value = JSON.parse(JSON.stringify(defaultEmojiGroups))
      settings.value = { ...defaultSettings }
      favorites.value = new Set()
    } finally {
      isLoading.value = false
    }
  }

  const saveData = async () => {
    if (isLoading.value || isSaving.value || batchDepth > 0) {
      logger.log(
        '[EmojiStore] SaveData deferred - loading:',
        isLoading.value,
        'saving:',
        isSaving.value,
        'batch:',
        batchDepth
      )
      pendingSave.value = true
      return
    }

    logger.log('[EmojiStore] Starting saveData with new storage system')
    isSaving.value = true
    try {
      await nextTick()

      // Update timestamp for sync comparison
      const updatedSettings = { ...settings.value, lastModified: Date.now() }
      settings.value = updatedSettings

      // Avoid dumping whole data; show a concise summary
      logger.log('[EmojiStore] Saving data summary:', {
        groupsCount: groups.value.length,
        settingsLastModified: updatedSettings.lastModified,
        favoritesCount: favorites.value.size
      })

      // Use new storage system with progressive writes and better error handling
      const savePromises = [
        newStorageHelpers.setAllEmojiGroups(groups.value).catch(error => {
          logger.error('[EmojiStore] Failed to save groups:', error)
          // Don't throw, just log - partial saves are better than complete failure
        }),
        newStorageHelpers.setSettings(updatedSettings).catch(error => {
          logger.error('[EmojiStore] Failed to save settings:', error)
        }),
        newStorageHelpers.setFavorites(Array.from(favorites.value)).catch(error => {
          logger.error('[EmojiStore] Failed to save favorites:', error)
        })
      ]

      await Promise.allSettled(savePromises)
      logger.log('[EmojiStore] SaveData completed successfully')
    } catch (error) {
      const e: any = error
      logger.error('[EmojiStore] Failed to save data:', e?.stack || e)
    } finally {
      isSaving.value = false
      // Check if there's a pending save that was deferred
      if (pendingSave.value) {
        pendingSave.value = false
        setTimeout(() => saveData(), 100) // Retry after a short delay
      }
    }
  }

  // --- Group Management ---
  const createGroup = (name: string, icon: string) => {
    const newGroup: EmojiGroup = {
      id: `group-${Date.now()}`,
      name,
      icon,
      order: groups.value.length,
      emojis: []
    }
    groups.value.push(newGroup)
    logger.log('[EmojiStore] createGroup', { id: newGroup.id, name: newGroup.name })
    maybeSave()
    return newGroup
  }

  const createGroupWithoutSave = (name: string, icon: string) => {
    const newGroup: EmojiGroup = {
      id: `group-${Date.now()}`,
      name,
      icon,
      order: groups.value.length,
      emojis: []
    }
    groups.value.push(newGroup)
    logger.log('[EmojiStore] createGroupWithoutSave', { id: newGroup.id, name: newGroup.name })
    return newGroup
  }

  const updateGroup = (groupId: string, updates: Partial<EmojiGroup>) => {
    const index = groups.value.findIndex(g => g.id === groupId)
    if (index !== -1) {
      groups.value[index] = { ...groups.value[index], ...updates }
      logger.log('[EmojiStore] updateGroup', { id: groupId, updates })
      maybeSave()
    }
  }

  const deleteGroup = (groupId: string) => {
    if (groupId === 'favorites' || groupId === 'nachoneko') {
      logger.warn('Cannot delete system groups')
      return
    }

    // Remove from new storage system
    newStorageHelpers
      .removeEmojiGroup(groupId)
      .catch(error => logger.error('[EmojiStore] Failed to delete group from storage:', error))

    groups.value = groups.value.filter(g => g.id !== groupId)
    logger.log('[EmojiStore] deleteGroup', { id: groupId })
    if (activeGroupId.value === groupId) {
      activeGroupId.value = groups.value[0]?.id || 'nachoneko'
    }
    maybeSave()
  }

  const reorderGroups = async (sourceGroupId: string, targetGroupId: string) => {
    // Prevent reordering if either source or target is favorites
    if (sourceGroupId === 'favorites' || targetGroupId === 'favorites') {
      logger.warn('[EmojiStore] Cannot reorder favorites group')
      return
    }

    const sourceIndex = groups.value.findIndex(g => g.id === sourceGroupId)
    const targetIndex = groups.value.findIndex(g => g.id === targetGroupId)

    if (sourceIndex !== -1 && targetIndex !== -1) {
      const [removed] = groups.value.splice(sourceIndex, 1)
      groups.value.splice(targetIndex, 0, removed)
      groups.value.forEach((group, index) => {
        group.order = index
      })
      logger.log('[EmojiStore] reorderGroups', { from: sourceGroupId, to: targetGroupId })
      await saveData()
    }
  }

  // --- Emoji Management ---
  const addEmoji = (groupId: string, emoji: Omit<Emoji, 'id' | 'groupId'>) => {
    const group = groups.value.find(g => g.id === groupId)
    if (group) {
      const newEmoji: Emoji = {
        ...emoji,
        id: `emoji-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        groupId
      }
      group.emojis.push(newEmoji)
      logger.log('[EmojiStore] addEmoji', { id: newEmoji.id, groupId })
      maybeSave()
      return newEmoji
    }
  }

  const addEmojiWithoutSave = (groupId: string, emoji: Omit<Emoji, 'id' | 'groupId'>) => {
    const group = groups.value.find(g => g.id === groupId)
    if (group) {
      const newEmoji: Emoji = {
        ...emoji,
        id: `emoji-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        groupId
      }
      group.emojis.push(newEmoji)
      logger.log('[EmojiStore] addEmojiWithoutSave', { id: newEmoji.id, groupId })
      return newEmoji
    }
  }

  const updateEmoji = (emojiId: string, updates: Partial<Emoji>) => {
    for (const group of groups.value) {
      const index = group.emojis.findIndex(e => e.id === emojiId)
      if (index !== -1) {
        group.emojis[index] = { ...group.emojis[index], ...updates }
        logger.log('[EmojiStore] updateEmoji', { id: emojiId, updates })
        maybeSave()
        break
      }
    }
  }

  const deleteEmoji = (emojiId: string) => {
    for (const group of groups.value) {
      group.emojis = group.emojis.filter(e => e.id !== emojiId)
    }
    favorites.value.delete(emojiId)
    logger.log('[EmojiStore] deleteEmoji', { id: emojiId })
    maybeSave()
  }

  const moveEmoji = (
    sourceGroupId: string,
    sourceIndex: number,
    targetGroupId: string,
    targetIndex: number
  ) => {
    const sourceGroup = groups.value.find(g => g.id === sourceGroupId)
    const targetGroup = groups.value.find(g => g.id === targetGroupId)

    if (sourceGroup && targetGroup && sourceIndex >= 0 && sourceIndex < sourceGroup.emojis.length) {
      const [emoji] = sourceGroup.emojis.splice(sourceIndex, 1)
      emoji.groupId = targetGroupId

      if (targetIndex >= 0 && targetIndex <= targetGroup.emojis.length) {
        targetGroup.emojis.splice(targetIndex, 0, emoji)
      } else {
        targetGroup.emojis.push(emoji)
      }

      maybeSave()
      logger.log('[EmojiStore] moveEmoji', {
        from: sourceGroupId,
        to: targetGroupId,
        sourceIndex,
        targetIndex
      })
    }
  }

  const removeEmojiFromGroup = (groupId: string, index: number) => {
    const group = groups.value.find(g => g.id === groupId)
    if (group && index >= 0 && index < group.emojis.length) {
      const emoji = group.emojis[index]
      group.emojis.splice(index, 1)
      favorites.value.delete(emoji.id)
      logger.log('[EmojiStore] removeEmojiFromGroup', { groupId, index, id: emoji.id })
      maybeSave()
    }
  }

  const updateEmojiInGroup = (groupId: string, index: number, updatedEmoji: Partial<Emoji>) => {
    const group = groups.value.find(g => g.id === groupId)
    if (group && index >= 0 && index < group.emojis.length) {
      const currentEmoji = group.emojis[index]
      // Update the emoji while preserving the id and other metadata
      group.emojis[index] = { ...currentEmoji, ...updatedEmoji }
      logger.log('[EmojiStore] updateEmojiInGroup', { groupId, index, id: currentEmoji.id })
      maybeSave()
    }
  }

  // --- Favorites Management ---
  const addToFavorites = async (emoji: Emoji) => {
    // Check if emoji already exists in favorites group
    const favoritesGroup = groups.value.find(g => g.id === 'favorites')
    if (!favoritesGroup) {
      logger.warn('[EmojiStore] Favorites group not found')
      return
    }

    const now = Date.now()
    const existingEmojiIndex = favoritesGroup.emojis.findIndex(e => e.url === emoji.url)

    if (existingEmojiIndex !== -1) {
      // Emoji already exists in favorites, update usage tracking
      const existingEmoji = favoritesGroup.emojis[existingEmojiIndex]
      const lastUsed = existingEmoji.lastUsed || 0
      const timeDiff = now - lastUsed
      const twelveHours = 12 * 60 * 60 * 1000 // 12 hours in milliseconds

      if (timeDiff < twelveHours) {
        // Less than 12 hours, only increment count
        existingEmoji.usageCount = (existingEmoji.usageCount || 0) + 1
        logger.log(
          '[EmojiStore] Updated usage count for existing emoji:',
          emoji.name,
          'count:',
          existingEmoji.usageCount
        )
      } else {
        // More than 12 hours, apply decay and update timestamp
        const currentCount = existingEmoji.usageCount || 1
        existingEmoji.usageCount = Math.floor(currentCount * 0.8) + 1
        existingEmoji.lastUsed = now
        logger.log(
          '[EmojiStore] Applied usage decay and updated timestamp for emoji:',
          emoji.name,
          'new count:',
          existingEmoji.usageCount
        )
      }
    } else {
      // Add emoji to favorites group with initial usage tracking
      const favoriteEmoji: Emoji = {
        ...emoji,
        id: `fav-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        groupId: 'favorites',
        usageCount: 1,
        lastUsed: now,
        addedAt: now
      }

      favoritesGroup.emojis.push(favoriteEmoji) // Add new emoji
      logger.log('[EmojiStore] Added new emoji to favorites:', emoji.name)
    }

    // Sort favorites by lastUsed timestamp (most recent first)
    favoritesGroup.emojis.sort((a, b) => (b.lastUsed || 0) - (a.lastUsed || 0))

    maybeSave()
  }

  const toggleFavorite = (emojiId: string) => {
    if (favorites.value.has(emojiId)) {
      favorites.value.delete(emojiId)
    } else {
      favorites.value.add(emojiId)
    }
    logger.log('[EmojiStore] toggleFavorite', { id: emojiId, now: favorites.value.has(emojiId) })
    maybeSave()
  }

  const findEmojiById = (emojiId: string): Emoji | undefined => {
    for (const group of groups.value) {
      const emoji = group.emojis.find(e => e.id === emojiId)
      if (emoji) return emoji
    }
    return undefined
  }

  // --- One-click Add Emoji from Web ---
  const addEmojiFromWeb = (emojiData: { name: string; url: string }) => {
    const ungroupedGroup = groups.value.find(g => g.id === 'ungrouped')
    if (ungroupedGroup) {
      const newEmoji: Emoji = {
        id: `emoji-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        packet: Date.now(),
        name: emojiData.name,
        url: emojiData.url,
        groupId: 'ungrouped'
      }
      ungroupedGroup.emojis.push(newEmoji)
      logger.log('[EmojiStore] addEmojiFromWeb', { id: newEmoji.id, name: newEmoji.name })
      maybeSave()
      return newEmoji
    }
  }

  // --- Settings Management ---
  const updateSettings = (newSettings: Partial<AppSettings>) => {
    settings.value = { ...settings.value, ...newSettings }
    logger.log('[EmojiStore] updateSettings', { updates: newSettings })
    maybeSave()
    // attempt to notify background to sync to content scripts
    void syncSettingsToBackground()
  }

  // Notify background to sync settings across contexts (content scripts)
  // Use a separate function so we can call it after persistence if needed
  const syncSettingsToBackground = async () => {
    try {
      const chromeAPI = typeof chrome !== 'undefined' ? chrome : (globalThis as any).chrome
      if (chromeAPI && chromeAPI.runtime && chromeAPI.runtime.sendMessage) {
        chromeAPI.runtime.sendMessage({ type: 'SYNC_SETTINGS', settings: settings.value })
      }
    } catch (e) {
      // ignore
    }
  }

  // --- Import/Export ---
  const exportConfiguration = () => {
    return {
      groups: groups.value,
      settings: settings.value,
      favorites: Array.from(favorites.value),
      exportDate: new Date().toISOString(),
      version: '3.0'
    }
  }

  const importConfiguration = (config: any) => {
    if (config.groups) {
      groups.value = config.groups
    }
    if (config.settings) {
      settings.value = { ...defaultSettings, ...config.settings }
    }
    if (config.favorites) {
      favorites.value = new Set(config.favorites)
    }
    logger.log('[EmojiStore] importConfiguration', { groups: config.groups?.length })
    maybeSave()
  }

  const resetToDefaults = async () => {
    await newStorageHelpers.resetToDefaults()
    await loadData() // Reload store state from storage
  }

  const forceSync = async () => {
    try {
      await newStorageHelpers.backupToSync(
        groups.value,
        settings.value,
        Array.from(favorites.value)
      )
      return true
    } catch (error) {
      logger.error('Failed to sync to chrome:', error)
      return false
    }
  }

  // --- Synchronization and Persistence ---

  // Watch for local changes and persist them (with better debouncing)
  let saveTimeout: NodeJS.Timeout | null = null
  const SAVE_DEBOUNCE_DELAY = 500 // 500ms debounce

  watch(
    [groups, settings, favorites],
    () => {
      if (!isLoading.value && !isUpdatingFromStorage && !isSaving.value) {
        // Clear existing timeout
        if (saveTimeout) {
          clearTimeout(saveTimeout)
        }

        // Debounce saves to prevent continuous writes
        saveTimeout = setTimeout(() => {
          logger.log('[EmojiStore] Triggering debounced save')
          maybeSave()
        }, SAVE_DEBOUNCE_DELAY)
      }
    },
    { deep: true }
  )

  // Listen for changes from other extension contexts (e.g., options page)
  let isUpdatingFromStorage = false

  // Note: The new storage system handles cross-context synchronization internally
  // We'll add a simple listener for backward compatibility
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes: any, areaName: string) => {
      if (isSaving.value || isLoading.value || isUpdatingFromStorage) {
        logger.log(
          '[EmojiStore] Ignoring storage change - save:',
          isSaving.value,
          'load:',
          isLoading.value,
          'updating:',
          isUpdatingFromStorage
        )
        return // Prevent loops
      }

      logger.log('[EmojiStore] Storage change detected:', areaName, Object.keys(changes))

      // Simple reload on storage changes since new system handles conflict resolution
      if (areaName === 'local' || areaName === 'sync') {
        isUpdatingFromStorage = true
        setTimeout(async () => {
          try {
            await loadData()
          } finally {
            setTimeout(() => {
              isUpdatingFromStorage = false
              logger.log('[EmojiStore] Storage update completed')
            }, 200)
          }
        }, 100)
      }
    })
  }

  return {
    // State
    groups,
    settings,
    activeGroupId,
    searchQuery,
    isLoading,
    isSaving,
    favorites,

    // Computed
    activeGroup,
    filteredEmojis,
    sortedGroups,

    // Actions
    loadData,
    saveData,
    createGroup,
    createGroupWithoutSave,
    updateGroup,
    deleteGroup,
    reorderGroups,
    addEmoji,
    addEmojiWithoutSave,
    updateEmoji,
    deleteEmoji,
    moveEmoji,
    removeEmojiFromGroup,
    updateEmojiInGroup,
    addToFavorites,
    toggleFavorite,
    findEmojiById,
    updateSettings,
    exportConfiguration,
    importConfiguration,
    resetToDefaults,
    forceSync,
    // expose batching helpers for bulk operations
    beginBatch,
    endBatch,
    // one-click add from web
    addEmojiFromWeb
  }
})
