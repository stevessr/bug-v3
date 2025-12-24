import { defineStore } from 'pinia'
import { ref, computed, watch, nextTick } from 'vue'

// Import sub-stores for delegation
import { useGroupStore } from './groupStore'
import { useEmojiCrudStore } from './emojiCrudStore'
import { useFavoritesStore } from './favoritesStore'
import { useTagStore } from './tagStore'
import { useSyncStore } from './syncStore'
import { useCssStore } from './cssStore'
import type { SaveControl } from './core/types'

import { normalizeImageUrl } from '@/utils/isImageUrl'
import { newStorageHelpers, STORAGE_KEYS } from '@/utils/newStorage'
import type { Emoji, EmojiGroup, AppSettings } from '@/types/type'
import { loadPackagedDefaults } from '@/types/defaultEmojiGroups.loader'
import { defaultSettings } from '@/types/defaultSettings'

// Global flag to ensure runtime message listener is only registered once across all store instances
let runtimeMessageListenerRegistered = false

export const useEmojiStore = defineStore('emojiExtension', () => {
  // --- State ---
  const groups = ref<EmojiGroup[]>([])
  const settings = ref<AppSettings>(defaultSettings)
  const favorites = ref<Set<string>>(new Set())
  const activeGroupId = ref<string>('nachoneko')
  const searchQuery = ref<string>(' ')
  const selectedTags = ref<string[]>([]) // 当前选中的标签
  const isLoading = ref(true)
  const isSaving = ref(false)
  // Flag to track if initial data has been loaded successfully at least once
  // This prevents accidental saves of empty data during initialization
  const hasLoadedOnce = ref(false)
  // Read-only mode: when true, only favorites updates are allowed
  // Used by popup/sidebar to prevent accidental data corruption
  const isReadOnlyMode = ref(false)

  // Enable or disable read-only mode
  // Call setReadOnlyMode(true) in popup/sidebar before loading data
  const setReadOnlyMode = (value: boolean) => {
    isReadOnlyMode.value = value
    console.log('[EmojiStore] Read-only mode:', value ? 'enabled' : 'disabled')
  }

  // --- Computed ---
  const activeGroup = computed(
    () => groups.value.find(g => g.id === activeGroupId.value) || groups.value[0]
  )

  // helper to check if a group's emojis are currently loaded in memory
  // All groups keep their emojis loaded in memory; no lazy-load support

  // 搜索索引缓存 - 用于加速搜索
  const searchIndexCache = ref<Map<string, Set<string>>>(new Map())
  const lastSearchableGroupVersion = ref(0)

  // 构建搜索索引（在后台构建，不阻塞主线程）
  const buildSearchIndex = () => {
    const index = new Map<string, Set<string>>()

    for (const group of groups.value) {
      const emojis = group.emojis || []
      for (const emoji of emojis) {
        if (!emoji) continue
        const emojiId = emoji.id

        // 索引名称的每个单词
        const nameLower = (emoji.name || '').toLowerCase()
        const words = nameLower.split(/\s+/)
        for (const word of words) {
          if (!index.has(word)) {
            index.set(word, new Set())
          }
          index.get(word)!.add(emojiId)
        }

        // 索引标签
        if (emoji.tags) {
          for (const tag of emoji.tags) {
            const tagLower = tag.toLowerCase()
            if (!index.has(tagLower)) {
              index.set(tagLower, new Set())
            }
            index.get(tagLower)!.add(emojiId)
          }
        }
      }
    }

    searchIndexCache.value = index
    lastSearchableGroupVersion.value = groups.value.length
  }

  // 在数据加载后构建索引
  watch(
    () => groups.value.length,
    () => {
      // 延迟构建索引，不阻塞主线程
      setTimeout(buildSearchIndex, 100)
    },
    { immediate: true }
  )

  const filteredEmojis = computed(() => {
    if (!activeGroup.value) return []

    let emojis = activeGroup.value.emojis || []

    // 标签筛选
    if (selectedTags.value.length > 0) {
      const selectedTagSet = new Set(selectedTags.value)
      emojis = emojis.filter(
        emoji => emoji && emoji.tags && emoji.tags.some(tag => selectedTagSet.has(tag))
      )
    }

    // 搜索筛选 - 使用优化的搜索
    if (searchQuery.value) {
      const query = searchQuery.value.toLowerCase().trim()
      if (query) {
        emojis = emojis.filter(emoji => {
          if (!emoji) return false
          // 搜索名称 - 使用 includes 进行模糊匹配
          if (emoji.name && emoji.name.toLowerCase().includes(query)) {
            return true
          }
          // 搜索标签
          if (emoji.tags) {
            for (const tag of emoji.tags) {
              if (tag.toLowerCase().includes(query)) {
                return true
              }
            }
          }
          return false
        })
      }
    }

    return emojis
  })

  // 获取所有标签及其使用次数 - 使用缓存优化
  // 缓存标签计算结果，避免每次重新遍历所有分组
  const tagCacheVersion = ref(0)
  const cachedTags = ref<Array<{ name: string; count: number }>>([])

  const allTags = computed(() => {
    // 触发响应式依赖
    const _ = tagCacheVersion.value
    const groupsSnapshot = groups.value

    // 如果缓存有效，直接返回
    if (cachedTags.value.length > 0 && _ === tagCacheVersion.value) {
      return cachedTags.value
    }

    const tagMap = new Map<string, number>()

    for (const group of groupsSnapshot) {
      const emojis = group.emojis || []
      for (let i = 0; i < emojis.length; i++) {
        const emoji = emojis[i]
        if (emoji && emoji.tags) {
          const tags = emoji.tags
          for (let j = 0; j < tags.length; j++) {
            const tag = tags[j]
            tagMap.set(tag, (tagMap.get(tag) || 0) + 1)
          }
        }
      }
    }

    const result = Array.from(tagMap.entries())
      .map(([name, count]) => ({ name, count: Number(count) }))
      .sort((a, b) => b.count - a.count)

    cachedTags.value = result
    return result
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
  // Simplified: localStorage writes are now synchronous, so no debouncing needed
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
    // In read-only mode, only saveFavoritesOnly is allowed, not full saves
    if (isReadOnlyMode.value) {
      console.log('[EmojiStore] maybeSave blocked - read-only mode active')
      return
    }
    if (isLoading.value || isSaving.value || batchDepth > 0) {
      pendingSave.value = true
      return
    }

    // Direct save - localStorage is synchronous, extension storage is async but fire-and-forget
    void saveData()
  }

  // --- SaveControl for sub-stores ---
  // Forward reference container - saveData is assigned after its definition
  let _saveData: (() => Promise<void>) | null = null
  const saveControl: SaveControl = {
    maybeSave,
    beginBatch,
    endBatch,
    saveData: async () => {
      if (_saveData) await _saveData()
    }
  }

  // --- Initialize Sub-stores ---
  // These provide modular functionality while sharing the core state

  const groupStore = useGroupStore({
    groups,
    activeGroupId,
    saveControl
  })

  const emojiCrudStore = useEmojiCrudStore({
    groups,
    favorites,
    saveControl
  })

  const favoritesStore = useFavoritesStore({
    groups,
    favorites,
    isLoading,
    hasLoadedOnce,
    isReadOnlyMode,
    saveControl
  })

  const tagStore = useTagStore({
    groups,
    selectedTags,
    saveControl
  })

  const syncStore = useSyncStore({
    groups,
    settings,
    favorites
  })

  const cssStore = useCssStore({
    settings,
    saveControl
  })

  // --- Actions ---

  const loadData = async () => {
    console.log('[EmojiStore] Starting loadData with new storage system')
    isLoading.value = true
    try {
      // Initialize sync service first (delegated to syncStore)
      await syncStore.initializeSync()

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
      // Also ensure every group has an emojis array to prevent runtime errors
      try {
        for (const g of groups.value) {
          if (!g) continue
          // Ensure emojis array exists
          if (!Array.isArray(g.emojis)) {
            g.emojis = []
          }
          if (typeof g.icon === 'string') {
            g.icon = normalizeImageUrl(g.icon) || g.icon
          }
          for (const e of g.emojis) {
            if (e && typeof e.url === 'string') {
              e.url = normalizeImageUrl(e.url) || e.url
            }
            if (e && typeof e.displayUrl === 'string') {
              e.displayUrl = normalizeImageUrl(e.displayUrl) || e.displayUrl
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

      // Migrate legacy customCss to customCssBlocks if needed (delegated to cssStore)
      cssStore.migrateLegacyCustomCss()

      favorites.value = new Set(favoritesData || [])

      console.log('[EmojiStore] Final groups after assignment:', {
        count: groups.value?.length || 0,
        groupIds: groups.value?.map((g: EmojiGroup) => g.id) || []
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

      // Mark that we have successfully loaded data at least once
      // This is checked by saveData to prevent saving empty data during initialization
      if (groups.value.length > 0) {
        hasLoadedOnce.value = true
      }

      console.log('[EmojiStore] LoadData completed successfully')
    } catch (error) {
      const e = error as Error
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
    // In read-only mode, block full saves entirely
    if (isReadOnlyMode.value) {
      console.log('[EmojiStore] SaveData blocked - read-only mode active')
      return
    }

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

    // CRITICAL: Prevent saving empty groups if we haven't loaded data successfully yet
    // This protects against accidental data loss during initialization or load failures
    if (groups.value.length === 0 && !hasLoadedOnce.value) {
      console.warn(
        '[EmojiStore] SaveData blocked - groups array is empty and no successful load has occurred yet.',
        'This is likely an initialization race condition. Skipping save to prevent data loss.'
      )
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

      // Use sync versions to ensure data is fully persisted to extensionStorage before returning
      // This prevents data loss when the page is immediately refreshed after save
      const savePromises = [
        newStorageHelpers.setAllEmojiGroupsSync(groups.value).catch(error => {
          console.error('[EmojiStore] Failed to save groups:', error)
          // Don't throw, just log - partial saves are better than complete failure
        }),
        newStorageHelpers.setSettingsSync(updatedSettings).catch(error => {
          console.error('[EmojiStore] Failed to save settings:', error)
        }),
        newStorageHelpers.setFavoritesSync(Array.from(favorites.value)).catch(error => {
          console.error('[EmojiStore] Failed to save favorites:', error)
        })
      ]

      await Promise.allSettled(savePromises)
      console.log('[EmojiStore] SaveData completed successfully')
    } catch (error) {
      const e = error as Error
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

  // Assign saveData to forward reference for sub-stores
  _saveData = saveData

  // Note: Group Management is now delegated to groupStore
  // Note: addEmoji, addEmojiWithoutSave, updateEmoji are delegated to emojiCrudStore

  // --- Local Emoji Operations (not delegated) ---
  const updateEmojiNames = (nameUpdates: Record<string, string>) => {
    beginBatch()
    try {
      for (const group of groups.value) {
        const emojis = group.emojis || []
        for (const emoji of emojis) {
          if (emoji && nameUpdates[emoji.id]) {
            emoji.name = nameUpdates[emoji.id]
          }
        }
      }
      console.log('[EmojiStore] updateEmojiNames', { count: Object.keys(nameUpdates).length })
    } finally {
      endBatch()
    }
  }

  // Note: deleteEmoji, moveEmoji are delegated to emojiCrudStore

  const removeEmojiFromGroup = (groupId: string, index: number) => {
    const group = groups.value.find(g => g.id === groupId)
    const emojis = group?.emojis || []
    if (group && index >= 0 && index < emojis.length) {
      const emoji = emojis[index]
      if (!emoji) return
      emojis.splice(index, 1)
      favorites.value.delete(emoji.id)
      console.log('[EmojiStore] removeEmojiFromGroup', { groupId, index, id: emoji.id })
      maybeSave()
    }
  }

  // Note: dedupeGroup, dedupeGroupByName are delegated to emojiCrudStore

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
      // Initialize the optimized hash service for better performance
      const { optimizedHashService } = await import('@/utils/optimizedHashService')
      await optimizedHashService.initializeWorkers()

      // Collect all emojis with their URLs
      const allEmojis: Array<{ emoji: Emoji; groupId: string; groupName: string }> = []
      const emojiUrls: string[] = []

      for (const group of groups.value) {
        if (group.id === 'favorites') continue // Ignore favorites group
        const emojis = group.emojis || []
        for (const emoji of emojis) {
          if (!emoji) continue
          allEmojis.push({
            emoji,
            groupId: group.id,
            groupName: group.name
          })
          if (emoji.url && !emoji.perceptualHash) {
            emojiUrls.push(emoji.url)
          }
        }
      }

      const totalEmojis = allEmojis.length
      console.log(`[EmojiStore] Processing ${totalEmojis} emojis for duplicate detection...`)

      // Batch calculate missing hashes using the optimized service
      if (emojiUrls.length > 0) {
        console.log(`[EmojiStore] Calculating hashes for ${emojiUrls.length} emojis...`)

        const hashResults = await optimizedHashService.calculateBatchHashes(emojiUrls, {
          useCache: true,
          batchSize: 20,
          quality: 'medium',
          onProgress: (processed, _total) => {
            // Map progress back to the original progress callback format
            const processedEmoji = allEmojis.find(e => e.emoji.url === emojiUrls[processed - 1])
            if (processedEmoji && onProgress) {
              const group = groups.value.find(g => g.id === processedEmoji.groupId)
              const groupEmojis = group?.emojis || []
              const groupTotal = groupEmojis.length
              onProgress({
                total: totalEmojis,
                processed: processed, // This is hash calculation progress
                group: processedEmoji.groupName,
                emojiName: processedEmoji.emoji.name,
                groupTotal,
                groupProcessed:
                  groupEmojis.findIndex(e => e && e.id === processedEmoji.emoji.id) + 1
              })
            }
          }
        })

        // Update emojis with calculated hashes
        for (const result of hashResults) {
          const emoji = allEmojis.find(e => e.emoji.url === result.url)
          if (emoji && result.hash && !result.error) {
            emoji.emoji.perceptualHash = result.hash
          }
        }
      }

      // Find duplicates using optimized batch processing
      console.log('[EmojiStore] Finding duplicates...')
      const allHashes = allEmojis
        .filter(item => item.emoji.perceptualHash)
        .map(item => ({
          item,
          hash: item.emoji.perceptualHash!
        }))

      const duplicateGroups: Array<Array<(typeof allEmojis)[0]>> = []
      const processed = new Set<string>()

      // Use optimized comparison for better performance
      for (let i = 0; i < allHashes.length; i++) {
        const { item: item1, hash: hash1 } = allHashes[i]
        if (processed.has(item1.emoji.id)) continue

        const duplicates: Array<(typeof allEmojis)[0]> = [item1]
        processed.add(item1.emoji.id)

        // Compare with remaining items using Hamming distance
        for (let j = i + 1; j < allHashes.length; j++) {
          const { item: item2, hash: hash2 } = allHashes[j]
          if (processed.has(item2.emoji.id)) continue

          if (
            item1.emoji.id !== item2.emoji.id &&
            optimizedHashService.hammingDistance(hash1, hash2) <= similarityThreshold
          ) {
            duplicates.push(item2)
            processed.add(item2.emoji.id)
          }
        }

        if (duplicates.length > 1) {
          duplicateGroups.push(duplicates)
        }
      }

      console.log(`[EmojiStore] Found ${duplicateGroups.length} groups of duplicates`)

      // Log cache statistics
      const cacheStats = optimizedHashService.getCacheStats()
      console.log('[EmojiStore] Cache stats:', cacheStats)

      return duplicateGroups
    } catch (err) {
      console.error('[EmojiStore] findDuplicatesAcrossGroups error', err)
      return []
    }
  }

  // Note: clearAllPerceptualHashes is delegated to emojiCrudStore
  // Note: removeDuplicatesAcrossGroups is delegated to emojiCrudStore
  // Note: resolveEmojiReference is delegated to emojiCrudStore

  const updateEmojiInGroup = (groupId: string, index: number, updatedEmoji: Partial<Emoji>) => {
    const group = groups.value.find(g => g.id === groupId)
    const emojis = group?.emojis || []
    if (group && index >= 0 && index < emojis.length) {
      const currentEmoji = emojis[index]
      if (!currentEmoji) return
      // Update the emoji while preserving the id and other metadata
      emojis[index] = { ...currentEmoji, ...updatedEmoji }
      console.log('[EmojiStore] updateEmojiInGroup', { groupId, index, id: currentEmoji.id })
      maybeSave()
    }
  }

  // Note: Favorites Management is delegated to favoritesStore

  // --- One-click Add Emoji from Web ---
  const addEmojiFromWeb = (emojiData: { name: string; url: string }) => {
    const ungroupedGroup = groups.value.find(g => g.id === 'ungrouped')
    if (ungroupedGroup) {
      // Ensure emojis array exists
      if (!Array.isArray(ungroupedGroup.emojis)) {
        ungroupedGroup.emojis = []
      }
      const newEmoji: Emoji = {
        id: `emoji-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        packet: Date.now(),
        name: emojiData.name,
        url: emojiData.url,
        groupId: 'ungrouped',
        tags: [] // 确保新表情有空标签数组
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
      const chromeAPI =
        typeof chrome !== 'undefined'
          ? chrome
          : ((globalThis as Record<string, unknown>).chrome as typeof chrome | undefined)
      if (chromeAPI?.runtime?.sendMessage) {
        chromeAPI.runtime.sendMessage({ type: 'SYNC_SETTINGS', settings: settings.value })
      }
    } catch {
      // ignore
    }
  }

  // Specific setting update functions
  const updateUseIndexedDBForImages = (value: boolean) => {
    if (settings.value.useIndexedDBForImages !== value) {
      updateSettings({ useIndexedDBForImages: value })
      console.log('[EmojiStore] updateUseIndexedDBForImages', { value })
    }
  }

  // Note: CSS Block Management is delegated to cssStore

  // Note: Tag Management (add, remove, set, getEmojiTags, findEmojisByTag, etc.)
  // is delegated to tagStore. Local allTags is kept for optimized {name, count} format.

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

  const importConfiguration = (config: {
    groups?: EmojiGroup[]
    settings?: Partial<AppSettings>
    favorites?: string[]
    version?: string
    exportDate?: string
  }) => {
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

  // --- Synchronization and Persistence ---

  // Watch for local changes and persist them
  // Simplified: localStorage writes are synchronous, so minimal debouncing needed
  watch(
    [groups, settings, favorites],
    () => {
      // Don't trigger saves until we've successfully loaded data at least once
      // This prevents accidental saves of empty data during initialization
      if (!isLoading.value && !isUpdatingFromStorage && !isSaving.value && hasLoadedOnce.value) {
        console.log('[EmojiStore] Triggering save from watch')
        maybeSave()
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
    chrome.storage.onChanged.addListener(
      (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
        console.log('[EmojiStore] Storage change detected:', {
          areaName,
          keys: Object.keys(changes || {}),
          isSaving: isSaving.value,
          isLoading: isLoading.value,
          isUpdatingFromStorage,
          isProcessingRuntimeMessage
        })

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
            const ts =
              newVal && typeof newVal === 'object'
                ? (newVal as { timestamp?: number }).timestamp || 0
                : 0
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
                  let newGroup: EmojiGroup | null = null
                  const change = capturedChanges[k]
                  if (change && change.newValue && typeof change.newValue === 'object') {
                    newGroup = (change.newValue as { data?: EmojiGroup }).data || null
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
                      console.log(
                        '[EmojiStore] Inserted new group from external change',
                        newGroup.id
                      )
                    }
                  }
                }

                // Settings change
                else if (k === STORAGE_KEYS.SETTINGS) {
                  const change = capturedChanges[k]
                  const data =
                    change && change.newValue
                      ? (change.newValue as { data?: AppSettings }).data
                      : null
                  if (data && typeof data === 'object') {
                    settings.value = { ...defaultSettings, ...data }
                    console.log('[EmojiStore] Updated settings from external storage')
                  }
                }

                // Favorites change
                else if (k === STORAGE_KEYS.FAVORITES) {
                  const change = capturedChanges[k]
                  const data =
                    change && change.newValue ? (change.newValue as { data?: string[] }).data : null
                  if (Array.isArray(data)) {
                    favorites.value = new Set(data)
                    console.log('[EmojiStore] Updated favorites from external storage')
                  }
                }

                // Group index (order) changed - refresh index and apply order
                // Also load any newly added groups
                else if (k === STORAGE_KEYS.GROUP_INDEX) {
                  try {
                    const index = await newStorageHelpers.getEmojiGroupIndex()
                    console.log('[EmojiStore] Processing GROUP_INDEX change:', index)

                    if (Array.isArray(index) && index.length) {
                      // Check for new groups that need to be loaded
                      const existingIds = new Set(groups.value.map(g => g.id))
                      const newGroupIds = index.filter(entry => !existingIds.has(entry.id))

                      // Load any new groups
                      if (newGroupIds.length > 0) {
                        console.log(
                          '[EmojiStore] Loading new groups from index:',
                          newGroupIds.map(e => e.id)
                        )
                        for (const entry of newGroupIds) {
                          try {
                            const newGroup = await newStorageHelpers.getEmojiGroup(entry.id)
                            if (newGroup) {
                              groups.value.push({ ...newGroup, order: entry.order })
                              console.log(
                                '[EmojiStore] Loaded new group:',
                                entry.id,
                                'emojis:',
                                newGroup.emojis?.length ?? 0
                              )
                            }
                          } catch {
                            console.warn('[EmojiStore] Failed to load new group:', entry.id)
                          }
                        }
                      }

                      // Map order by id and reorder
                      const orderMap = new Map(
                        index.map((i: { id: string; order: number }) => [i.id, i.order])
                      )
                      const reordered = [...groups.value].sort((a, b) => {
                        const oa = orderMap.get(a.id) ?? a.order ?? 0
                        const ob = orderMap.get(b.id) ?? b.order ?? 0
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
      }
    )
  }

  // Register runtime message listener only once globally to prevent duplicate handlers
  if (!runtimeMessageListenerRegistered) {
    try {
      const chromeAPI =
        typeof chrome !== 'undefined'
          ? chrome
          : ((globalThis as Record<string, unknown>).chrome as typeof chrome | undefined)
      if (chromeAPI?.runtime?.onMessage) {
        chromeAPI.runtime.onMessage.addListener(
          (message: { type?: string; payload?: { emoji: Emoji; group?: EmojiGroup } }) => {
            if (!message || typeof message !== 'object') return
            if (message.type === 'EMOJI_EXTENSION_UNGROUPED_ADDED') {
              // Set flag to suppress storage change events during message processing
              isProcessingRuntimeMessage = true
              try {
                console.log('[EmojiStore] Processing EMOJI_EXTENSION_UNGROUPED_ADDED message')
                if (message.payload) {
                  applyUngroupedAddition(message.payload)
                }
              } finally {
                // Clear flag after a short delay to allow storage writes to complete
                setTimeout(() => {
                  isProcessingRuntimeMessage = false
                }, 1000)
              }
            }
          }
        )
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
    isReadOnlyMode,

    // Computed
    activeGroup: groupStore.activeGroup,
    filteredEmojis,
    sortedGroups, // Keep local version

    // Actions
    loadData,
    saveData,
    setReadOnlyMode,
    // Group operations (delegated to groupStore)
    createGroup: groupStore.createGroup,
    createGroupWithoutSave: groupStore.createGroupWithoutSave,
    updateGroup: groupStore.updateGroup,
    deleteGroup: groupStore.deleteGroup,
    reorderGroups: groupStore.reorderGroups,
    // Emoji operations (delegated to emojiCrudStore)
    addEmoji: emojiCrudStore.addEmoji,
    addEmojiWithoutSave: emojiCrudStore.addEmojiWithoutSave,
    updateEmoji: emojiCrudStore.updateEmoji,
    updateEmojiNames,
    deleteEmoji: emojiCrudStore.deleteEmoji,
    moveEmoji: emojiCrudStore.moveEmoji,
    removeEmojiFromGroup,
    updateEmojiInGroup,
    // Favorites (delegated to favoritesStore)
    addToFavorites: favoritesStore.addToFavorites,
    toggleFavorite: favoritesStore.toggleFavorite,
    clearAllFavorites: favoritesStore.clearAllFavorites,
    findEmojiById: emojiCrudStore.findEmoji,
    updateSettings,
    updateUseIndexedDBForImages,
    exportConfiguration,
    importConfiguration,
    resetToDefaults,
    forceSync,
    // Dedupe operations (delegated to emojiCrudStore)
    dedupeGroup: emojiCrudStore.dedupeGroup,
    dedupeGroupByName: emojiCrudStore.dedupeGroupByName,
    // Cross-group duplicate detection (kept in main store for now - complex logic)
    findDuplicatesAcrossGroups,
    removeDuplicatesAcrossGroups: emojiCrudStore.removeDuplicatesAcrossGroups,
    clearAllPerceptualHashes: emojiCrudStore.clearAllPerceptualHashes,
    resolveEmojiReference: emojiCrudStore.resolveEmojiReference,
    // expose batching helpers for bulk operations
    beginBatch,
    endBatch,
    maybeSave,
    // one-click add from web
    addEmojiFromWeb,
    // Cloudflare sync methods (delegated to syncStore)
    initializeSync: syncStore.initializeSync,
    saveSyncConfig: syncStore.saveSyncConfig,
    loadSyncConfig: syncStore.loadSyncConfig,
    testSyncConnection: syncStore.testSyncConnection,
    syncToCloudflare: syncStore.syncToCloudflare,
    previewCloudData: syncStore.previewCloudData,
    previewCloudConfig: syncStore.previewCloudConfig,
    loadGroupDetails: syncStore.loadGroupDetails,
    pushToCloudflare: syncStore.pushToCloudflare,
    pullFromCloudflare: syncStore.pullFromCloudflare,
    isSyncConfigured: syncStore.isSyncConfigured,
    // CSS Block Management (delegated to cssStore)
    getCustomCssBlocks: cssStore.getCustomCssBlocks,
    saveCustomCssBlock: cssStore.saveCustomCssBlock,
    deleteCustomCssBlock: cssStore.deleteCustomCssBlock,
    toggleCustomCssBlock: cssStore.toggleCustomCssBlock,
    getCombinedCustomCss: cssStore.getCombinedCustomCss,

    // Tag Management (delegated to tagStore, except allTags which uses local optimized version)
    allTags, // Keep local version with {name, count} format
    selectedTags,
    addTagToEmoji: tagStore.addTagToEmoji,
    removeTagFromEmoji: tagStore.removeTagFromEmoji,
    setEmojiTags: tagStore.setEmojiTags,
    addTagToMultipleEmojis: tagStore.addTagToMultipleEmojis,
    removeTagFromMultipleEmojis: tagStore.removeTagFromMultipleEmojis,
    getEmojiTags: tagStore.getEmojiTags,
    findEmojisByTag: tagStore.findEmojisByTag,
    setSelectedTags: tagStore.setSelectedTags,
    toggleTagFilter: tagStore.toggleTagFilter,
    clearTagFilters: tagStore.clearTagFilters
  }
})
