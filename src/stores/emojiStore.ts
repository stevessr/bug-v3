import { defineStore } from 'pinia'
import { ref, computed, watch, nextTick } from 'vue'

import type { Emoji, EmojiGroup, AppSettings } from '../types/type'
import { newStorageHelpers, STORAGE_KEYS } from '../utils/newStorage'
import { normalizeImageUrl } from '../utils/isImageUrl'
import { cloudflareSyncService } from '../utils/cloudflareSync'
import { 
  saveSyncConfig as saveSyncConfigToStorage, 
  loadSyncConfig as loadSyncConfigFromStorage 
} from '../utils/syncConfigStorage'
import { createSyncTarget } from '../userscript/plugins/syncTargets'
import type { SyncTargetConfig } from '../userscript/plugins/syncTargets'

import { defaultSettings } from '@/types/defaultSettings'
import { loadPackagedDefaults } from '@/types/defaultEmojiGroups.loader'

// Global flag to ensure runtime message listener is only registered once across all store instances
let runtimeMessageListenerRegistered = false

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

  // helper to check if a group's emojis are currently loaded in memory
  // All groups keep their emojis loaded in memory; no lazy-load support

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
    console.log('[EmojiStore] Starting loadData with new storage system')
    isLoading.value = true
    try {
      // Initialize sync service first
      await initializeSync()

      // Load data using new storage system with conflict resolution
      console.log('[EmojiStore] Loading data from new storage system')
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
        console.error('[EmojiStore] Failed to load groups:', loadedGroups.reason)
      }
      if (loadedSettings.status === 'rejected') {
        console.error('[EmojiStore] Failed to load settings:', loadedSettings.reason)
      }
      if (loadedFavorites.status === 'rejected') {
        console.error('[EmojiStore] Failed to load favorites:', loadedFavorites.reason)
      }

      // Detailed data loading debug info
      console.log('[EmojiStore] Raw loaded data:')
      console.log('  - loadedGroups:', groupsData)
      console.log('  - loadedSettings:', settingsData)
      console.log('  - loadedFavorites:', favoritesData)

      // Summarize loaded data to avoid huge console dumps
      console.log('[EmojiStore] Data loaded summary:', {
        groupsCount: groupsData?.length || 0,
        groupsValid: Array.isArray(groupsData),
        settingsLastModified: settingsData?.lastModified,
        favoritesCount: favoritesData?.length || 0
      })

      if (groupsData && groupsData.length > 0) {
        groups.value = groupsData
      } else {
        // No groups from storage - try runtime loader first
        try {
          const packaged = await loadPackagedDefaults()
          groups.value =
            packaged && packaged.groups && packaged.groups.length > 0 ? packaged.groups : []
        } catch {
          groups.value = []
        }
      }
      // Normalize any stored image URL-like values for safe rendering
      try {
        for (const g of groups.value) {
          if (g && typeof g.icon === 'string') {
            g.icon = normalizeImageUrl(g.icon) || g.icon
          }
          if (Array.isArray(g.emojis)) {
            for (const e of g.emojis) {
              if (e && typeof e.url === 'string') {
                e.url = normalizeImageUrl(e.url) || e.url
              }
              if (e && typeof e.displayUrl === 'string') {
                e.displayUrl = normalizeImageUrl(e.displayUrl) || e.displayUrl
              }
            }
          }
        }
      } catch {
        // ignore normalization errors - not critical
      }

      // Only fetch remote defaults if local settings are missing or incomplete
      if (!settingsData || Object.keys(settingsData).length === 0) {
        // No local settings - merge with remote defaults
        try {
          const packaged = await loadPackagedDefaults()
          settings.value = { ...defaultSettings, ...(packaged?.settings || {}) }
        } catch {
          settings.value = { ...defaultSettings }
        }
      } else {
        // Local settings exist - just merge with static defaults (no network request)
        settings.value = { ...defaultSettings, ...settingsData }
      }

      favorites.value = new Set(favoritesData || [])

      console.log('[EmojiStore] Final groups after assignment:', {
        count: groups.value?.length || 0,
        groupIds: groups.value?.map((g: any) => g.id) || []
      })

      // If we used default data, save it to storage for next time (with error handling)
      if (!groupsData || groupsData.length === 0) {
        console.log('[EmojiStore] No groups loaded, saving default groups to storage')
        newStorageHelpers.setAllEmojiGroups(groups.value).catch(error => {
          console.error('[EmojiStore] Failed to save default groups:', error)
        })
      }
      // If settings were missing entirely, or if uploadMenuItems is absent, persist merged defaults so
      // future reads include the uploadMenuItems and other defaults. This ensures a single canonical
      // persisted copy of settings exists after first run.
      try {
        const missingSettings = !settingsData || Object.keys(settingsData).length === 0
        const missingUploadMenu = !(
          settingsData && Object.prototype.hasOwnProperty.call(settingsData, 'uploadMenuItems')
        )
        if (missingSettings || missingUploadMenu) {
          console.log(
            '[EmojiStore] Persisting default/merged settings (ensure uploadMenuItems present)'
          )
          await newStorageHelpers.setSettings(settings.value)
        }
      } catch (error) {
        console.error('[EmojiStore] Failed to persist default/merged settings:', error)
      }

      activeGroupId.value = settings.value.defaultGroup || 'nachoneko'

      // After initial load, keep all groups' emojis loaded in memory

      console.log('[EmojiStore] LoadData completed successfully')
    } catch (error) {
      const e: any = error
      console.error('[EmojiStore] Failed to load initial data:', e?.stack || e)
      // Fallback to runtime loader or empty
      try {
        const packaged = await loadPackagedDefaults()
        groups.value =
          packaged && packaged.groups && packaged.groups.length > 0 ? packaged.groups : []
      } catch {
        groups.value = []
      }
      try {
        const packaged = await loadPackagedDefaults()
        settings.value = { ...defaultSettings, ...(packaged?.settings || {}) }
      } catch {
        settings.value = { ...defaultSettings }
      }
      favorites.value = new Set()
    } finally {
      isLoading.value = false
    }
  }
  // No lazy-load helpers; all groups remain fully loaded

  const saveData = async () => {
    if (isLoading.value || isSaving.value || batchDepth > 0) {
      console.log(
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

    console.log('[EmojiStore] Starting saveData with new storage system')
    isSaving.value = true
    try {
      await nextTick()

      // Update timestamp for sync comparison
      const updatedSettings = { ...settings.value, lastModified: Date.now() }
      settings.value = updatedSettings

      // Avoid dumping whole data; show a concise summary
      console.log('[EmojiStore] Saving data summary:', {
        groupsCount: groups.value.length,
        settingsLastModified: updatedSettings.lastModified,
        favoritesCount: favorites.value.size
      })

      // Use new storage system with progressive writes and better error handling
      const savePromises = [
        newStorageHelpers.setAllEmojiGroups(groups.value).catch(error => {
          console.error('[EmojiStore] Failed to save groups:', error)
          // Don't throw, just log - partial saves are better than complete failure
        }),
        newStorageHelpers.setSettings(updatedSettings).catch(error => {
          console.error('[EmojiStore] Failed to save settings:', error)
        }),
        newStorageHelpers.setFavorites(Array.from(favorites.value)).catch(error => {
          console.error('[EmojiStore] Failed to save favorites:', error)
        })
      ]

      await Promise.allSettled(savePromises)
      console.log('[EmojiStore] SaveData completed successfully')
    } catch (error) {
      const e: any = error
      console.error('[EmojiStore] Failed to save data:', e?.stack || e)
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
    console.log('[EmojiStore] createGroup', { id: newGroup.id, name: newGroup.name })
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
    console.log('[EmojiStore] createGroupWithoutSave', { id: newGroup.id, name: newGroup.name })
    return newGroup
  }

  const updateGroup = (groupId: string, updates: Partial<EmojiGroup>) => {
    const index = groups.value.findIndex(g => g.id === groupId)
    if (index !== -1) {
      groups.value[index] = { ...groups.value[index], ...updates }
      console.log('[EmojiStore] updateGroup', { id: groupId, updates })
      maybeSave()
    }
  }

  const deleteGroup = (groupId: string) => {
    if (groupId === 'favorites') {
      console.warn('Cannot delete system groups')
      return
    }

    // Remove from new storage system
    newStorageHelpers
      .removeEmojiGroup(groupId)
      .catch(error => console.error('[EmojiStore] Failed to delete group from storage:', error))

    groups.value = groups.value.filter(g => g.id !== groupId)
    console.log('[EmojiStore] deleteGroup', { id: groupId })
    if (activeGroupId.value === groupId) {
      activeGroupId.value = groups.value[0]?.id || 'nachoneko'
    }
    maybeSave()
  }

  const reorderGroups = async (sourceGroupId: string, targetGroupId: string) => {
    // Prevent reordering if either source or target is favorites
    if (sourceGroupId === 'favorites' || targetGroupId === 'favorites') {
      console.warn('[EmojiStore] Cannot reorder favorites group')
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
      console.log('[EmojiStore] reorderGroups', { from: sourceGroupId, to: targetGroupId })
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
      console.log('[EmojiStore] addEmoji', { id: newEmoji.id, groupId })
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
      console.log('[EmojiStore] addEmojiWithoutSave', { id: newEmoji.id, groupId })
      return newEmoji
    }
  }

  const updateEmoji = (emojiId: string, updates: Partial<Emoji>) => {
    for (const group of groups.value) {
      const index = group.emojis.findIndex(e => e.id === emojiId)
      if (index !== -1) {
        group.emojis[index] = { ...group.emojis[index], ...updates }
        console.log('[EmojiStore] updateEmoji', { id: emojiId, updates })
        maybeSave()
        break
      }
    }
  }

  const updateEmojiNames = (nameUpdates: Record<string, string>) => {
    beginBatch()
    try {
      for (const group of groups.value) {
        for (const emoji of group.emojis) {
          if (nameUpdates[emoji.id]) {
            emoji.name = nameUpdates[emoji.id]
          }
        }
      }
      console.log('[EmojiStore] updateEmojiNames', { count: Object.keys(nameUpdates).length })
    } finally {
      endBatch()
    }
  }

  const deleteEmoji = (emojiId: string) => {
    for (const group of groups.value) {
      group.emojis = group.emojis.filter(e => e.id !== emojiId)
    }
    favorites.value.delete(emojiId)
    console.log('[EmojiStore] deleteEmoji', { id: emojiId })
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
      console.log('[EmojiStore] moveEmoji', {
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
      console.log('[EmojiStore] removeEmojiFromGroup', { groupId, index, id: emoji.id })
      maybeSave()
    }
  }

  // Remove duplicate emojis within a group based on normalized URL
  const dedupeGroup = (groupId: string) => {
    const group = groups.value.find(g => g.id === groupId)
    if (!group) return 0

    try {
      const seen = new Set<string>()
      const originalLength = group.emojis.length
      const kept: typeof group.emojis = []

      for (const e of group.emojis) {
        const url =
          e && typeof (e as any).url === 'string'
            ? normalizeImageUrl((e as any).url) || (e as any).url
            : ''
        if (!url) {
          // keep items without url (can't dedupe reliably)
          kept.push(e)
          continue
        }
        if (!seen.has(url)) {
          seen.add(url)
          kept.push(e)
        }
      }

      group.emojis = kept
      const removed = originalLength - group.emojis.length
      if (removed > 0) {
        console.log('[EmojiStore] dedupeGroup', { groupId, removed })
        maybeSave()
      }
      return removed
    } catch (err) {
      console.error('[EmojiStore] dedupeGroup error', err)
      return 0
    }
  }

  // Remove duplicate emojis within a group based on emoji name (case-insensitive)
  const dedupeGroupByName = (groupId: string) => {
    const group = groups.value.find(g => g.id === groupId)
    if (!group) return 0

    try {
      const seen = new Set<string>()
      const originalLength = group.emojis.length
      const kept: typeof group.emojis = []

      for (const e of group.emojis) {
        const name =
          e && typeof (e as any).name === 'string' ? (e as any).name.trim().toLowerCase() : ''
        if (!name) {
          // keep items without name
          kept.push(e)
          continue
        }
        if (!seen.has(name)) {
          seen.add(name)
          kept.push(e)
        }
      }

      group.emojis = kept
      const removed = originalLength - group.emojis.length
      if (removed > 0) {
        console.log('[EmojiStore] dedupeGroupByName', { groupId, removed })
        maybeSave()
      }
      return removed
    } catch (err) {
      console.error('[EmojiStore] dedupeGroupByName error', err)
      return 0
    }
  }

  // Find duplicate emojis across all groups based on perceptual hash
  const findDuplicatesAcrossGroups = async (
    similarityThreshold = 10,
    onProgress?: (progress: {
      total: number
      processed: number
      group: string
      emojiName: string
      groupTotal: number
      groupProcessed: number
    }) => void
  ) => {
    try {
      const { areSimilarImages, calculatePerceptualHash } = await import('@/utils/geminiService')

      // Calculate hashes for all emojis that don't have one
      const allEmojis: Array<{ emoji: Emoji; groupId: string; groupName: string }> = []
      let totalEmojis = 0
      for (const group of groups.value) {
        if (group.id === 'favorites') continue // Ignore favorites group
        for (const emoji of group.emojis) {
          allEmojis.push({
            emoji,
            groupId: group.id,
            groupName: group.name
          })
          totalEmojis++
        }
      }

      // Calculate missing hashes
      console.log('[EmojiStore] Calculating perceptual hashes for emojis...')
      let processedCount = 0
      let groupProcessedCount = 0
      let currentProcessingGroup = ''

      for (const item of allEmojis) {
        processedCount++

        if (item.groupName !== currentProcessingGroup) {
          currentProcessingGroup = item.groupName
          groupProcessedCount = 0
        }
        groupProcessedCount++

        if (onProgress) {
          const group = groups.value.find(g => g.id === item.groupId)
          const groupTotal = group ? group.emojis.length : 0
          onProgress({
            total: totalEmojis,
            processed: processedCount,
            group: item.groupName,
            emojiName: item.emoji.name,
            groupTotal,
            groupProcessed: groupProcessedCount
          })
        }

        if (!item.emoji.perceptualHash && item.emoji.url) {
          try {
            const hash = await calculatePerceptualHash(item.emoji.url)
            item.emoji.perceptualHash = hash
          } catch (err) {
            console.error('[EmojiStore] Failed to calculate hash for', item.emoji.id, err)
          }
        }
      }

      // Find duplicates based on similarity
      const duplicateGroups: Array<Array<(typeof allEmojis)[0]>> = []
      const processed = new Set<string>()

      for (let i = 0; i < allEmojis.length; i++) {
        const item1 = allEmojis[i]
        if (processed.has(item1.emoji.id) || !item1.emoji.perceptualHash) continue

        const duplicates: Array<(typeof allEmojis)[0]> = [item1]
        processed.add(item1.emoji.id)

        for (let j = i + 1; j < allEmojis.length; j++) {
          const item2 = allEmojis[j]
          if (processed.has(item2.emoji.id) || !item2.emoji.perceptualHash) continue

          if (
            item1.emoji.id !== item2.emoji.id &&
            areSimilarImages(
              item1.emoji.perceptualHash,
              item2.emoji.perceptualHash,
              similarityThreshold
            )
          ) {
            duplicates.push(item2)
            processed.add(item2.emoji.id)
          }
        }

        if (duplicates.length > 1) {
          duplicateGroups.push(duplicates)
        }
      }

      console.log('[EmojiStore] Found', duplicateGroups.length, 'groups of duplicates')
      return duplicateGroups
    } catch (err) {
      console.error('[EmojiStore] findDuplicatesAcrossGroups error', err)
      return []
    }
  }

  // Remove all perceptual hashes from all emojis
  const clearAllPerceptualHashes = async () => {
    try {
      beginBatch()
      for (const group of groups.value) {
        for (const emoji of group.emojis) {
          if (emoji.perceptualHash) {
            delete emoji.perceptualHash
          }
        }
      }
      console.log('[EmojiStore] Cleared all perceptual hashes')
    } finally {
      await endBatch()
    }
  }

  // Remove duplicate emojis across groups and optionally create references
  const removeDuplicatesAcrossGroups = async (
    duplicates: Array<Array<{ emoji: Emoji; groupId: string; groupName: string }>>,
    createReferences = true
  ) => {
    try {
      let totalRemoved = 0

      for (const duplicateSet of duplicates) {
        if (duplicateSet.length < 2) continue

        // Keep the first emoji (original), remove others
        const [original, ...duplicatesToRemove] = duplicateSet

        for (const duplicate of duplicatesToRemove) {
          const group = groups.value.find(g => g.id === duplicate.groupId)
          if (!group) continue

          const index = group.emojis.findIndex(e => e.id === duplicate.emoji.id)
          if (index === -1) continue

          if (createReferences) {
            // Replace with a reference instead of deleting
            group.emojis[index] = {
              ...duplicate.emoji,
              referenceId: original.emoji.id,
              url: original.emoji.url
            }
          } else {
            // Delete the duplicate
            group.emojis.splice(index, 1)
            totalRemoved++
          }
        }
      }

      if (totalRemoved > 0) {
        console.log('[EmojiStore] Removed', totalRemoved, 'duplicate emojis')
        maybeSave()
      }

      return totalRemoved
    } catch (err) {
      console.error('[EmojiStore] removeDuplicatesAcrossGroups error', err)
      return 0
    }
  }

  // Get the actual emoji for a reference (resolves referenceId)
  const resolveEmojiReference = (emoji: Emoji): Emoji | undefined => {
    if (!emoji.referenceId) return emoji

    // Find the referenced emoji
    for (const group of groups.value) {
      const referenced = group.emojis.find(e => e.id === emoji.referenceId)
      if (referenced) {
        // Return a merged object with reference's URL but current emoji's other properties
        return {
          ...emoji,
          url: referenced.url,
          displayUrl: referenced.displayUrl || referenced.url
        }
      }
    }

    // If reference not found, return original
    return emoji
  }

  const updateEmojiInGroup = (groupId: string, index: number, updatedEmoji: Partial<Emoji>) => {
    const group = groups.value.find(g => g.id === groupId)
    if (group && index >= 0 && index < group.emojis.length) {
      const currentEmoji = group.emojis[index]
      // Update the emoji while preserving the id and other metadata
      group.emojis[index] = { ...currentEmoji, ...updatedEmoji }
      console.log('[EmojiStore] updateEmojiInGroup', { groupId, index, id: currentEmoji.id })
      maybeSave()
    }
  }

  // --- Favorites Management ---
  const addToFavorites = async (emoji: Emoji) => {
    // Check if emoji already exists in favorites group
    const favoritesGroup = groups.value.find(g => g.id === 'favorites')
    if (!favoritesGroup) {
      console.warn('[EmojiStore] Favorites group not found')
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
        console.log(
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
        console.log(
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
      console.log('[EmojiStore] Added new emoji to favorites:', emoji.name)
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
    console.log('[EmojiStore] toggleFavorite', { id: emojiId, now: favorites.value.has(emojiId) })
    maybeSave()
  }

  const clearAllFavorites = () => {
    const favoritesGroup = groups.value.find(g => g.id === 'favorites')
    if (!favoritesGroup) {
      console.warn('[EmojiStore] Favorites group not found')
      return
    }

    // Clear all emojis from favorites group
    favoritesGroup.emojis = []
    // Also clear favorites index/set so persistence reflects the cleared state
    try {
      favorites.value.clear()
    } catch {
      favorites.value = new Set()
    }

    console.log(
      '[EmojiStore] clearAllFavorites - cleared all favorite emojis and cleared favorites index'
    )
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
      console.log('[EmojiStore] addEmojiFromWeb', { id: newEmoji.id, name: newEmoji.name })
      maybeSave()
      return newEmoji
    }
  }

  // --- Settings Management ---
  const updateSettings = (newSettings: Partial<AppSettings>) => {
    // Check if settings actually changed to avoid unnecessary updates
    let hasChanges = false
    for (const key in newSettings) {
      if (Object.prototype.hasOwnProperty.call(newSettings, key)) {
        const typedKey = key as keyof AppSettings
        if (settings.value[typedKey] !== newSettings[typedKey]) {
          hasChanges = true
          break
        }
      }
    }

    if (!hasChanges) {
      console.log('[EmojiStore] updateSettings - no changes detected, skipping')
      return
    }

    settings.value = { ...settings.value, ...newSettings }
    console.log('[EmojiStore] updateSettings', { updates: newSettings })
    // Don't call maybeSave() here - let the watch handle all saves with debouncing
    // This prevents duplicate saves when updating settings
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
    } catch {
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
    try {
      beginBatch()

      if (Array.isArray(config?.groups)) {
        const existingGroups = new Map(groups.value.map(g => [g.id, g]))
        const mergedGroups: EmojiGroup[] = []

        for (const incoming of config.groups as EmojiGroup[]) {
          if (!incoming || typeof incoming !== 'object') continue
          const targetId =
            incoming.id || `group-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
          const current = existingGroups.get(targetId)

          if (current) {
            const existingEmojiIds = new Set(current.emojis.map(e => e.id || e.url))
            const mergedEmojis = [...current.emojis]

            for (const incomingEmoji of incoming.emojis || []) {
              if (!incomingEmoji || typeof incomingEmoji !== 'object') continue
              const dedupeKey = incomingEmoji.id || incomingEmoji.url
              if (!dedupeKey || existingEmojiIds.has(dedupeKey)) continue
              existingEmojiIds.add(dedupeKey)
              mergedEmojis.push({
                ...incomingEmoji,
                groupId: targetId,
                id:
                  incomingEmoji.id ||
                  `emoji-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
              })
            }

            mergedGroups.push({ ...current, ...incoming, id: targetId, emojis: mergedEmojis })
            existingGroups.delete(targetId)
          } else {
            mergedGroups.push({
              ...incoming,
              id: targetId,
              emojis: (incoming.emojis || []).map(emoji => ({
                ...emoji,
                groupId: targetId,
                id: emoji.id || `emoji-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
              }))
            })
          }
        }

        // Append any remaining existing groups not touched by import
        mergedGroups.push(...existingGroups.values())

        groups.value = mergedGroups
      }

      if (config?.settings && typeof config.settings === 'object') {
        settings.value = { ...settings.value, ...config.settings }
      }

      if (Array.isArray(config?.favorites)) {
        const mergedFavorites = new Set([...favorites.value, ...config.favorites])
        favorites.value = mergedFavorites
      }

      console.log('[EmojiStore] importConfiguration merged', {
        importedGroups: config.groups?.length || 0
      })
    } finally {
      endBatch().catch(() => {
        /* ignore */
      })
      maybeSave()
    }
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
      console.error('Failed to sync to chrome:', error)
      return false
    }
  }

  // --- Cloudflare Sync Methods ---
  const initializeSync = async () => {
    // Try to load sync configuration
    await cloudflareSyncService.initialize()
  }

  const saveSyncConfig = async (config: SyncTargetConfig) => {
    // Save to general storage
    await saveSyncConfigToStorage(config)
    // Also update cloudflare service if it's a cloudflare config
    if (config.type === 'cloudflare') {
      await cloudflareSyncService.saveConfig(config)
    }
  }

  const loadSyncConfig = async () => {
    // Load from general storage (supports all sync types)
    return await loadSyncConfigFromStorage()
  }

  const testSyncConnection = async () => {
    const config = await loadSyncConfig()
    if (!config) {
      return {
        success: false,
        message: 'No sync configuration found',
        error: 'Missing configuration'
      }
    }
    try {
      const target = createSyncTarget(config)
      return await target.test()
    } catch (error) {
      return {
        success: false,
        message: `Connection test failed: ${error}`,
        error
      }
    }
  }

  const syncToCloudflare = async (
    direction: 'push' | 'pull' | 'both' = 'both',
    onProgress?: (progress: { current: number; total: number; action: string; message?: string }) => void
  ) => {
    const result = await cloudflareSyncService.sync(direction, onProgress)
    return result
  }

  const pushToCloudflare = async () => {
    return await cloudflareSyncService.pushData()
  }

  const pullFromCloudflare = async () => {
    return await cloudflareSyncService.pullData()
  }

  const isSyncConfigured = (): boolean => {
    return cloudflareSyncService.isConfigured()
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
          console.log('[EmojiStore] Triggering debounced save')
          maybeSave()
        }, SAVE_DEBOUNCE_DELAY)
      }
    },
    { deep: true }
  )

  // Message deduplication: Track recently processed emoji additions to prevent duplicates
  const processedEmojiIds = new Set<string>()
  const EMOJI_DEDUP_WINDOW_MS = 5000 // 5 seconds window for deduplication

  const applyUngroupedAddition = (payload: { emoji: Emoji; group?: EmojiGroup }) => {
    if (!payload || !payload.emoji) return

    // Deduplication check: Skip if we recently processed this emoji
    const emojiKey = `${payload.emoji.id || ''}_${payload.emoji.url || ''}_${payload.emoji.addedAt || Date.now()}`
    if (processedEmojiIds.has(emojiKey)) {
      console.log('[EmojiStore] Skipping duplicate emoji addition:', emojiKey)
      return
    }

    // Mark as processed and schedule cleanup
    processedEmojiIds.add(emojiKey)
    setTimeout(() => {
      processedEmojiIds.delete(emojiKey)
    }, EMOJI_DEDUP_WINDOW_MS)

    const targetGroupId = payload.emoji.groupId || 'ungrouped'
    let targetGroup = groups.value.find(g => g.id === targetGroupId)

    if (!targetGroup) {
      targetGroup = {
        id: targetGroupId,
        name: payload.group?.name || '未分组',
        icon: payload.group?.icon || '📦',
        order: payload.group?.order ?? groups.value.length,
        emojis: []
      }
      groups.value.push(targetGroup)
    }

    const exists = targetGroup.emojis.some(
      e => e.id === payload.emoji.id || e.url === payload.emoji.url
    )
    if (!exists) {
      targetGroup.emojis.push(payload.emoji)
      // maintain consistency of favorites if necessary
      if (payload.emoji.groupId === 'favorites') {
        favorites.value.add(payload.emoji.id)
      }
      console.log('[EmojiStore] Applied emoji addition:', payload.emoji.id || payload.emoji.name)
      // Only save if not already saving or loading
      if (!isSaving.value && !isLoading.value) {
        maybeSave()
      }
    } else {
      console.log(
        '[EmojiStore] Emoji already exists, skipping:',
        payload.emoji.id || payload.emoji.name
      )
    }
  }

  // Listen for changes from other extension contexts (e.g., options page)
  let isUpdatingFromStorage = false
  // Track most recent external change timestamp to ignore stale events
  let lastExternalChangeTs = 0
  // Debounce timer to coalesce multiple rapid change events
  let externalChangeTimer: NodeJS.Timeout | null = null
  const EXTERNAL_CHANGE_DEBOUNCE_MS = 500
  // Flag to suppress storage change events when we're processing runtime messages
  let isProcessingRuntimeMessage = false

  // Note: The new storage system handles cross-context synchronization internally
  // We'll add a conservative listener for backward compatibility but only react
  // to relevant keys and to newer changes. This avoids frequent full reloads
  // when unrelated keys or older events are received.
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes: any, areaName: string) => {
      if (
        isSaving.value ||
        isLoading.value ||
        isUpdatingFromStorage ||
        isProcessingRuntimeMessage
      ) {
        console.log(
          '[EmojiStore] Ignoring storage change - save:',
          isSaving.value,
          'load:',
          isLoading.value,
          'updating:',
          isUpdatingFromStorage,
          'processingMsg:',
          isProcessingRuntimeMessage
        )
        return // Prevent loops
      }

      // Only care about local or sync storage area; ignore other areas
      if (areaName !== 'local' && areaName !== 'sync') return

      const changedKeys = Object.keys(changes || {})
      if (!changedKeys.length) return

      // Only consider changes to settings, favorites, group index or individual group keys
      const isRelevant = changedKeys.some(
        k =>
          k === STORAGE_KEYS.SETTINGS ||
          k === STORAGE_KEYS.FAVORITES ||
          k === STORAGE_KEYS.GROUP_INDEX ||
          k.startsWith(STORAGE_KEYS.GROUP_PREFIX)
      )

      if (!isRelevant) {
        console.log('[EmojiStore] Ignored storage change - irrelevant keys:', changedKeys)
        return
      }

      // Determine newest timestamp among incoming changes (storage values use {data, timestamp})
      let maxIncomingTs = 0
      for (const k of changedKeys) {
        try {
          const newVal = changes[k] && changes[k].newValue
          const ts = newVal && typeof newVal === 'object' ? newVal.timestamp || 0 : 0
          if (ts > maxIncomingTs) maxIncomingTs = ts
        } catch {
          // ignore parsing errors
        }
      }

      // If incoming changes are older or equal to the last processed one, skip
      if (maxIncomingTs && maxIncomingTs <= lastExternalChangeTs) {
        console.log('[EmojiStore] Ignored storage change - older timestamp', {
          maxIncomingTs,
          lastExternalChangeTs
        })
        return
      }

      // Update tracked timestamp conservatively (use now if none provided)
      lastExternalChangeTs = maxIncomingTs || Date.now()

      // Debounce and coalesce multiple notifications
      if (externalChangeTimer) clearTimeout(externalChangeTimer)
      // Capture the changes for processing inside debounce
      const capturedChanges = changes
      const capturedKeys = changedKeys
      externalChangeTimer = setTimeout(async () => {
        externalChangeTimer = null
        isUpdatingFromStorage = true
        try {
          console.log(
            '[EmojiStore] Applying external storage update - processing relevant keys',
            capturedKeys
          )

          // Process each relevant key individually to avoid full reloads
          for (const k of capturedKeys) {
            try {
              // Group-level change
              if (k.startsWith(STORAGE_KEYS.GROUP_PREFIX)) {
                const groupId = k.replace(STORAGE_KEYS.GROUP_PREFIX, '')
                // Try to read new group data from change payload first
                let newGroup: any = null
                const change = capturedChanges[k]
                if (change && change.newValue && typeof change.newValue === 'object') {
                  newGroup = change.newValue.data || null
                }
                // Fallback to storage read (conflict resolution) if not present
                if (!newGroup) {
                  try {
                    newGroup = await newStorageHelpers.getEmojiGroup(groupId)
                  } catch {
                    newGroup = null
                  }
                }

                // If group deleted (null), remove locally; otherwise upsert
                if (newGroup == null) {
                  groups.value = groups.value.filter(g => g.id !== groupId)
                  console.log(
                    '[EmojiStore] Removed group from store due to external change',
                    groupId
                  )
                } else {
                  // Normalize image URLs similar to loadData
                  try {
                    if (newGroup && typeof newGroup.icon === 'string') {
                      newGroup.icon = normalizeImageUrl(newGroup.icon) || newGroup.icon
                    }
                    if (Array.isArray(newGroup.emojis)) {
                      for (const e of newGroup.emojis) {
                        if (e && typeof e.url === 'string')
                          e.url = normalizeImageUrl(e.url) || e.url
                        if (e && typeof e.displayUrl === 'string')
                          e.displayUrl = normalizeImageUrl(e.displayUrl) || e.displayUrl
                      }
                    }
                  } catch {
                    // ignore normalization errors
                  }

                  const idx = groups.value.findIndex(g => g.id === newGroup.id)
                  if (idx !== -1) {
                    // Merge existing metadata but prefer incoming data
                    const merged = { ...groups.value[idx], ...newGroup }
                    groups.value = [
                      ...groups.value.slice(0, idx),
                      merged,
                      ...groups.value.slice(idx + 1)
                    ]
                    console.log(
                      '[EmojiStore] Updated group in-place from external change',
                      newGroup.id
                    )
                  } else {
                    groups.value = [...groups.value, newGroup]
                    console.log('[EmojiStore] Inserted new group from external change', newGroup.id)
                  }
                }
              }

              // Settings change
              else if (k === STORAGE_KEYS.SETTINGS) {
                const change = capturedChanges[k]
                const data = change && change.newValue ? change.newValue.data : null
                if (data && typeof data === 'object') {
                  settings.value = { ...defaultSettings, ...data }
                  console.log('[EmojiStore] Updated settings from external storage')
                }
              }

              // Favorites change
              else if (k === STORAGE_KEYS.FAVORITES) {
                const change = capturedChanges[k]
                const data = change && change.newValue ? change.newValue.data : null
                if (Array.isArray(data)) {
                  favorites.value = new Set(data)
                  console.log('[EmojiStore] Updated favorites from external storage')
                }
              }

              // Group index (order) changed - refresh index and apply order
              else if (k === STORAGE_KEYS.GROUP_INDEX) {
                try {
                  const index = await newStorageHelpers.getEmojiGroupIndex()
                  if (Array.isArray(index) && index.length) {
                    // Map order by id
                    const orderMap = new Map(index.map((i: any) => [i.id, i.order]))
                    const reordered = [...groups.value].sort((a, b) => {
                      const oa = orderMap.has(a.id) ? orderMap.get(a.id) : (a.order ?? 0)
                      const ob = orderMap.has(b.id) ? orderMap.get(b.id) : (b.order ?? 0)
                      return oa - ob
                    })
                    groups.value = reordered.map((g, idx) => ({ ...g, order: idx }))
                    console.log('[EmojiStore] Reordered groups from external group index')
                  }
                } catch {
                  // ignore
                }
              }
            } catch (innerErr) {
              console.error('[EmojiStore] Error processing external key', k, innerErr)
            }
          }
        } catch (error) {
          console.error('[EmojiStore] Failed to process storage change', error)
        } finally {
          setTimeout(() => {
            isUpdatingFromStorage = false
            console.log('[EmojiStore] External storage processing completed')
          }, 200)
        }
      }, EXTERNAL_CHANGE_DEBOUNCE_MS)
    })
  }

  // Register runtime message listener only once globally to prevent duplicate handlers
  if (!runtimeMessageListenerRegistered) {
    try {
      const chromeAPI = typeof chrome !== 'undefined' ? chrome : (globalThis as any).chrome
      if (chromeAPI?.runtime?.onMessage) {
        chromeAPI.runtime.onMessage.addListener((message: any) => {
          if (!message || typeof message !== 'object') return
          if (message.type === 'EMOJI_EXTENSION_UNGROUPED_ADDED') {
            // Set flag to suppress storage change events during message processing
            isProcessingRuntimeMessage = true
            try {
              console.log('[EmojiStore] Processing EMOJI_EXTENSION_UNGROUPED_ADDED message')
              applyUngroupedAddition(message.payload || {})
            } finally {
              // Clear flag after a short delay to allow storage writes to complete
              setTimeout(() => {
                isProcessingRuntimeMessage = false
              }, 1000)
            }
          }
        })
        runtimeMessageListenerRegistered = true
        console.log('[EmojiStore] Runtime message listener registered')
      }
    } catch (runtimeListenerError) {
      console.warn('[EmojiStore] Failed to register runtime listener', runtimeListenerError)
    }
  } else {
    console.log('[EmojiStore] Runtime message listener already registered, skipping')
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
    updateEmojiNames,
    deleteEmoji,
    moveEmoji,
    removeEmojiFromGroup,
    updateEmojiInGroup,
    addToFavorites,
    toggleFavorite,
    clearAllFavorites,
    findEmojiById,
    updateSettings,
    exportConfiguration,
    importConfiguration,
    resetToDefaults,
    forceSync,
    dedupeGroup,
    dedupeGroupByName,
    // Cross-group duplicate detection
    findDuplicatesAcrossGroups,
    removeDuplicatesAcrossGroups,
    clearAllPerceptualHashes,
    resolveEmojiReference,
    // expose batching helpers for bulk operations
    beginBatch,
    endBatch,
    // one-click add from web
    addEmojiFromWeb,
    // Cloudflare sync methods
    initializeSync,
    saveSyncConfig,
    loadSyncConfig,
    testSyncConnection,
    syncToCloudflare,
    pushToCloudflare,
    pullFromCloudflare,
    isSyncConfigured
    // (lazy-load removed)
  }
})
