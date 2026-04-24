import { defineStore } from 'pinia'
import { ref, shallowRef, computed, watch, nextTick, onScopeDispose } from 'vue'

// Import sub-stores for delegation
import type { SaveControl } from './core/types'
// 导入新的独立 stores
import { useSearchIndexStore } from './searchIndexStore'
import { useTagCountStore } from './tagCountStore'
import { useStorageSync } from './core/useStorageSync'

import {
  useGroupStore,
  useEmojiCrudStore,
  useFavoritesStore,
  useTagStore,
  useSyncStore,
  useCssStore
} from './index'

import { normalizeImageUrl } from '@/utils/isImageUrl'
import * as storage from '@/utils/simpleStorage'
import { STORAGE_KEYS } from '@/utils/simpleStorage'
import type { Emoji, EmojiGroup, AppSettings } from '@/types/type'
import { loadPackagedDefaults } from '@/types/defaultEmojiGroups.loader'
import { defaultSettings } from '@/types/defaultSettings'
import { createLogger } from '@/utils/logger'
import { resolveImageCacheStrategy } from '@/utils/imageCachePolicy'
import { getChromeAPI } from '@/utils/chrome'

const log = createLogger('EmojiStore')

/** 常量定义 - 延迟时间（毫秒） */
const SEARCH_INDEX_DEBOUNCE_MS = 100
const SAVE_DEBOUNCE_MS = 100
const SYNC_SETTINGS_DEBOUNCE_MS = 300 // 设置同步防抖时间

export const useEmojiStore = defineStore('emojiExtension', () => {
  // --- State ---
  // 使用 shallowRef 优化大数组的响应式开销（减少 50-80% 内存代理开销）
  // 注意：更新时必须替换整个数组引用，而不是修改属性
  const groups = shallowRef<EmojiGroup[]>([])
  const archivedGroups = shallowRef<EmojiGroup[]>([]) // 已归档的分组
  const settings = shallowRef<AppSettings>(defaultSettings)
  const favorites = ref<Set<string>>(new Set())
  const activeGroupId = ref<string>('nachoneko')
  const searchQuery = ref<string>(' ')
  // 优化：使用 shallowRef 减少数组的深层响应式开销
  const selectedTags = shallowRef<string[]>([]) // 当前选中的标签
  const isLoading = ref(true)
  const isSaving = ref(false)
  // Flag to track if initial data has been loaded successfully at least once
  // This prevents accidental saves of empty data during initialization
  const hasLoadedOnce = ref(false)
  // Read-only mode: when true, only favorites updates are allowed
  // Used by popup/sidebar to prevent accidental data corruption
  const isReadOnlyMode = ref(false)

  const normalizeSettings = (value: AppSettings): AppSettings => {
    const { useIndexedDBForImages, ...rest } = value
    const normalized = { ...rest } as AppSettings
    if (!normalized.imageCacheStrategy) {
      normalized.imageCacheStrategy = useIndexedDBForImages === false ? 'force-source' : 'auto'
    }
    return normalized
  }

  // --- 直接保存 ---
  // 优化：返回 Promise 以支持 await 和错误处理
  const saveGroup = async (groupId: string): Promise<void> => {
    const group = groups.value.find(g => g.id === groupId)
    if (group) {
      try {
        await storage.setEmojiGroup(groupId, group)
      } catch (err) {
        log.error('Failed to save group:', groupId, err)
        throw err
      }
    }
  }

  // 直接保存 settings
  const saveSettings = async (): Promise<void> => {
    try {
      await storage.setSettings(settings.value)
    } catch (err) {
      log.error('Failed to save settings:', err)
      throw err
    }
  }

  // 直接保存 favorites
  const saveFavorites = async (): Promise<void> => {
    try {
      await storage.setFavorites(Array.from(favorites.value))
    } catch (err) {
      log.error('Failed to save favorites:', err)
      throw err
    }
  }

  // 兼容旧 API - 异步版本
  const markGroupDirty = async (groupId: string): Promise<void> => {
    return saveGroup(groupId)
  }

  const markSettingsDirty = async (): Promise<void> => {
    return saveSettings()
  }

  const markFavoritesDirty = async (): Promise<void> => {
    return saveFavorites()
  }

  // Enable or disable read-only mode
  // Call setReadOnlyMode(true) in popup/sidebar before loading data
  const setReadOnlyMode = (value: boolean) => {
    isReadOnlyMode.value = value
    log.info('Read-only mode:', value ? 'enabled' : 'disabled')
  }

  // --- Computed ---
  const activeGroup = computed(
    () => groups.value.find(g => g.id === activeGroupId.value) || groups.value[0]
  )

  // helper to check if a group's emojis are currently loaded in memory
  // All groups keep their emojis loaded in memory; no lazy-load support

  // --- Initialize Search Index Store ---
  const searchIndexStore = useSearchIndexStore()
  const tagCountStore = useTagCountStore()

  // 优化：监听分组的深层变化，而不仅仅是长度
  // 使用 flush: 'post' 确保在 DOM 更新后执行
  watch(
    () => groups.value,
    () => {
      // Rebuild search index when groups change
      if (!searchIndexStore.searchIndexValid) {
        setTimeout(() => searchIndexStore.buildSearchIndex(groups.value), SEARCH_INDEX_DEBOUNCE_MS)
      }
    },
    { immediate: true, flush: 'post' }
  )

  const filteredEmojis = computed(() => {
    if (!activeGroup.value) return []

    let emojis = activeGroup.value.emojis || []

    // 标签筛选 - 优化：使用 Set 交集
    if (selectedTags.value.length > 0) {
      const selectedTagSet = new Set(selectedTags.value)
      emojis = emojis.filter(
        emoji => emoji && emoji.tags && emoji.tags.some(tag => selectedTagSet.has(tag))
      )
    }

    // 搜索筛选 - 使用 searchIndexStore
    if (searchQuery.value) {
      const query = searchQuery.value.trim()
      if (query) {
        const matchedIds = searchIndexStore.search(query)
        if (matchedIds) {
          // 使用搜索索引结果过滤
          emojis = emojis.filter(emoji => emoji && matchedIds.has(emoji.id))
        } else {
          // 索引未准备好时的降级方案：使用原始过滤
          const queryLower = query.toLowerCase()
          emojis = emojis.filter(emoji => {
            if (!emoji) return false
            // 搜索名称
            if (emoji.name && emoji.name.toLowerCase().includes(queryLower)) {
              return true
            }
            // 搜索标签
            if (emoji.tags) {
              for (const tag of emoji.tags) {
                if (tag.toLowerCase().includes(queryLower)) {
                  return true
                }
              }
            }
            return false
          })
        }
      }
    }

    return emojis
  })

  // 优化：监听分组变化以重建标签计数
  // 使用 flush: 'post' 确保在 DOM 更新后执行
  watch(
    () => groups.value,
    () => {
      // Rebuild tag counts when groups change
      if (!tagCountStore.tagCacheValid) {
        tagCountStore.rebuildTagCounts(groups.value)
      }
    },
    { immediate: true, flush: 'post' }
  )

  // 使用 tagCountStore 的 allTags
  const allTags = computed(() => tagCountStore.allTags)

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
      log.debug('maybeSave blocked - read-only mode active')
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

  // 删除分组时直接从存储删除
  const markGroupDeleted = (groupId: string) => {
    storage.removeEmojiGroup(groupId).catch(err => {
      log.error('Failed to remove group:', groupId, err)
    })
  }

  const saveControl: SaveControl = {
    maybeSave,
    beginBatch,
    endBatch,
    saveData: async () => {
      if (_saveData) await _saveData()
    },
    // Tag count callbacks for incremental updates - 使用 tagCountStore
    onTagsAdded: tags => tagCountStore.incrementTagCounts(tags),
    onTagsRemoved: tags => tagCountStore.decrementTagCounts(tags),
    invalidateTagCache: () => tagCountStore.invalidateTagCache(),
    // Search index callbacks for incremental updates - 使用 searchIndexStore
    onEmojiAdded: emoji => searchIndexStore.addEmojiToIndex(emoji),
    onEmojiRemoved: emoji => searchIndexStore.removeEmojiFromIndex(emoji),
    onEmojiUpdated: (oldEmoji, newEmoji) => searchIndexStore.updateEmojiInIndex(oldEmoji, newEmoji),
    invalidateSearchIndex: () => searchIndexStore.invalidateSearchIndex(),
    // 直接保存回调
    markGroupDirty,
    markSettingsDirty,
    markFavoritesDirty,
    markGroupDeleted
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
    log.info('Starting loadData with new storage system')
    isLoading.value = true
    try {
      // Initialize sync service first (delegated to syncStore)
      await syncStore.initializeSync()

      // Check storage health first
      const health = await storage.checkStorageHealth()
      log.info('Storage health:', health)

      // If storage is empty, repair it
      if (!health.hasGroups && !health.hasSettings) {
        log.info('Storage appears empty, attempting repair')
        await storage.repairEmptyStorage()
        log.info('Storage repair completed')
      }

      // Load data using new storage system with conflict resolution
      log.info('Loading data from new storage system')
      const [loadedGroups, loadedSettings, loadedFavorites] = await Promise.allSettled([
        storage.getAllEmojiGroups(),
        storage.getSettings(),
        storage.getFavorites()
      ])

      // Extract successful results
      const groupsData = loadedGroups.status === 'fulfilled' ? loadedGroups.value : null
      const settingsData = loadedSettings.status === 'fulfilled' ? loadedSettings.value : null
      const favoritesData = loadedFavorites.status === 'fulfilled' ? loadedFavorites.value : null

      // Log any loading errors but don't fail completely
      if (loadedGroups.status === 'rejected') {
        log.error('Failed to load groups:', loadedGroups.reason)
      }
      if (loadedSettings.status === 'rejected') {
        log.error('Failed to load settings:', loadedSettings.reason)
      }
      if (loadedFavorites.status === 'rejected') {
        log.error('Failed to load favorites:', loadedFavorites.reason)
      }

      // Detailed data loading debug info
      log.debug('Raw loaded data:', {
        loadedGroups: groupsData,
        loadedSettings: settingsData,
        loadedFavorites: favoritesData
      })

      // Summarize loaded data to avoid huge console dumps
      log.info('Data loaded summary:', {
        groupsCount: groupsData?.length || 0,
        groupsValid: Array.isArray(groupsData),
        settingsLastModified: settingsData?.lastModified,
        favoritesCount: favoritesData?.length || 0
      })

      if (groupsData && groupsData.length > 0) {
        groups.value = groupsData
        log.info('Loaded groups from storage:', groupsData.length)
      } else {
        // No groups from storage - try runtime loader first
        log.info('No groups in storage, loading defaults')
        try {
          const packaged = await loadPackagedDefaults()
          groups.value =
            packaged && packaged.groups && packaged.groups.length > 0 ? packaged.groups : []
          log.info('Loaded default groups:', groups.value.length)
        } catch (e) {
          log.error('Failed to load default groups:', e)
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
          settings.value = normalizeSettings({
            ...defaultSettings,
            ...(packaged?.settings || {})
          })
        } catch {
          settings.value = normalizeSettings({ ...defaultSettings })
        }
      } else {
        // Local settings exist - just merge with static defaults (no network request)
        settings.value = normalizeSettings({ ...defaultSettings, ...settingsData })
      }

      // Legacy migration: if old useIndexedDBForImages exists, migrate and drop old key
      if (
        settingsData &&
        Object.prototype.hasOwnProperty.call(settingsData, 'useIndexedDBForImages')
      ) {
        const legacyEnabled = (settingsData as any).useIndexedDBForImages !== false
        const needsStrategy = !Object.prototype.hasOwnProperty.call(
          settingsData,
          'imageCacheStrategy'
        )
        const migratedAt = settings.value.imageCacheMigratedAt
        settings.value = normalizeSettings({
          ...settings.value,
          ...(needsStrategy ? { imageCacheStrategy: legacyEnabled ? 'auto' : 'force-source' } : {}),
          imageCacheMigratedAt: migratedAt || Date.now()
        })
        try {
          await storage.setSettings(settings.value)
        } catch (error) {
          log.warn('Failed to persist settings during migration', error)
        }
      }

      favorites.value = new Set(favoritesData || [])

      log.info('Final groups after assignment:', {
        count: groups.value?.length || 0,
        groupIds: groups.value?.map((g: EmojiGroup) => g.id) || []
      })

      // If we used default data, save it to storage for next time (with error handling)
      if (!groupsData || groupsData.length === 0) {
        log.info('No groups loaded, saving default groups to storage')
        storage.setAllEmojiGroups(groups.value).catch(error => {
          log.error('Failed to save default groups:', error)
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
          log.info('Persisting default/merged settings (ensure uploadMenuItems present)')
          await storage.setSettings(settings.value)
        }
      } catch (error) {
        log.error('Failed to persist default/merged settings:', error)
      }

      activeGroupId.value = settings.value.defaultGroup || 'nachoneko'

      // After initial load, keep all groups' emojis loaded in memory

      // Mark that we have successfully loaded data at least once
      // This is checked by saveData to prevent saving empty data during initialization
      if (groups.value.length > 0) {
        hasLoadedOnce.value = true
      }

      // 加载归档分组
      try {
        archivedGroups.value = await storage.getAllArchivedGroups()
        log.info('Loaded archived groups:', archivedGroups.value.length)
      } catch (err) {
        log.error('Failed to load archived groups:', err)
        archivedGroups.value = []
      }

      log.info('LoadData completed successfully')
    } catch (error) {
      const e = error as Error
      log.error('Failed to load initial data:', e?.stack || e)
      // Fallback to runtime loader or empty
      try {
        const packaged = await loadPackagedDefaults()
        groups.value =
          packaged && packaged.groups && packaged.groups.length > 0 ? packaged.groups : []
        settings.value = normalizeSettings({ ...defaultSettings, ...(packaged?.settings || {}) })
      } catch {
        groups.value = []
        settings.value = normalizeSettings({ ...defaultSettings })
      }
      favorites.value = new Set()
    } finally {
      isLoading.value = false
    }
  }
  // No lazy-load helpers; all groups remain fully loaded

  // 存储操作队列，确保顺序执行
  let saveQueue: Promise<void> = Promise.resolve()
  const enqueueSave = (operation: () => Promise<void>): Promise<void> => {
    saveQueue = saveQueue.then(operation).catch(error => {
      log.error('Queue operation failed:', error)
    })
    return saveQueue
  }

  const saveData = async () => {
    // 使用队列确保保存操作顺序执行
    return enqueueSave(async () => {
      // In read-only mode, block full saves entirely
      if (isReadOnlyMode.value) {
        log.debug('SaveData blocked - read-only mode active')
        return
      }

      if (isLoading.value || isSaving.value || batchDepth > 0) {
        log.debug(
          'SaveData deferred - loading:',
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
      if (groups.value.length === 0 && !hasLoadedOnce.value) {
        log.warn(
          'SaveData blocked - groups array is empty and no successful load has occurred yet.'
        )
        return
      }

      log.info('Starting saveData - saving all groups')

      isSaving.value = true
      try {
        await nextTick()

        // 并行保存所有数据：索引、分组、设置和收藏
        const index = groups.value.map((g, order) => ({ id: g.id, order }))

        // 优化：合并小数据（index、settings、favorites）为一次批量操作
        await Promise.all([
          // 批量保存小数据（1 次操作替代 3 次）
          storage.storageBatchSet({
            [STORAGE_KEYS.GROUP_INDEX]: index,
            [STORAGE_KEYS.SETTINGS]: { ...settings.value, lastModified: Date.now() },
            [STORAGE_KEYS.FAVORITES]: Array.from(favorites.value)
          }),
          // 并行保存所有分组
          ...groups.value.map(group => storage.setEmojiGroup(group.id, group))
        ])

        log.info('SaveData completed successfully')
      } catch (error) {
        const e = error as Error
        log.error('Failed to save data:', e?.stack || e)
      } finally {
        isSaving.value = false
        if (pendingSave.value) {
          pendingSave.value = false
          setTimeout(() => saveData(), SAVE_DEBOUNCE_MS)
        }
      }
    }) // 关闭 enqueueSave
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
        let groupModified = false
        for (const emoji of emojis) {
          if (emoji && nameUpdates[emoji.id]) {
            emoji.name = nameUpdates[emoji.id]
            groupModified = true
          }
        }
        // Mark the group as dirty if any emoji was modified
        if (groupModified) {
          markGroupDirty(group.id)
        }
      }
      log.info('updateEmojiNames', { count: Object.keys(nameUpdates).length })
    } finally {
      endBatch()
    }
  }

  // Note: deleteEmoji, moveEmoji are delegated to emojiCrudStore

  const removeEmojiFromGroup = (groupId: string, index: number) => {
    const groupIndex = groups.value.findIndex(g => g.id === groupId)
    if (groupIndex === -1) return

    const group = groups.value[groupIndex]
    const emojis = group?.emojis || []
    if (index >= 0 && index < emojis.length) {
      const emoji = emojis[index]
      if (!emoji) return

      // 优化：因为使用了 shallowRef，必须创建新的 group 对象并替换整个数组引用
      // 这样才能触发响应式更新
      const newGroup = {
        ...group,
        emojis: [...emojis.slice(0, index), ...emojis.slice(index + 1)]
      }

      // 替换整个 groups 数组，并替换修改的 group 对象
      groups.value = [
        ...groups.value.slice(0, groupIndex),
        newGroup,
        ...groups.value.slice(groupIndex + 1)
      ]

      // Mark the group as dirty for incremental save
      markGroupDirty(groupId)
      // Also mark favorites as dirty if the emoji was a favorite
      if (favorites.value.has(emoji.id)) {
        markFavoritesDirty()
      }
      favorites.value.delete(emoji.id)
      log.info('removeEmojiFromGroup', { groupId, index, id: emoji.id })
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
    // 优化：委托给专门的服务以简化 Store
    const { findDuplicatesAcrossGroups: findDuplicates } =
      await import('@/services/duplicateDetectionService')
    return findDuplicates(groups.value, { similarityThreshold, onProgress })
  }

  // Note: clearAllPerceptualHashes is delegated to emojiCrudStore
  // Note: removeDuplicatesAcrossGroups is delegated to emojiCrudStore
  // Note: resolveEmojiReference is delegated to emojiCrudStore

  const updateEmojiInGroup = (groupId: string, index: number, updatedEmoji: Partial<Emoji>) => {
    const groupIndex = groups.value.findIndex(g => g.id === groupId)
    if (groupIndex === -1) return

    const group = groups.value[groupIndex]
    const emojis = group?.emojis || []
    if (index < 0 || index >= emojis.length) return

    const currentEmoji = emojis[index]
    if (!currentEmoji) return

    // Update the emoji while preserving the id and other metadata
    const newEmoji = { ...currentEmoji, ...updatedEmoji }
    const newGroup = {
      ...group,
      emojis: [...emojis.slice(0, index), newEmoji, ...emojis.slice(index + 1)]
    }

    // 使用数组替换以触发 shallowRef 响应式更新
    groups.value = [
      ...groups.value.slice(0, groupIndex),
      newGroup,
      ...groups.value.slice(groupIndex + 1)
    ]

    log.info('updateEmojiInGroup', { groupId, index, id: currentEmoji.id })
    // Mark the group as dirty for incremental save
    markGroupDirty(groupId)
    maybeSave()
  }

  // Note: Favorites Management is delegated to favoritesStore

  // --- One-click Add Emoji from Web ---
  const addEmojiFromWeb = (emojiData: {
    name: string
    url: string
    width?: number
    height?: number
  }) => {
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
        ...(typeof emojiData.width === 'number' ? { width: emojiData.width } : {}),
        ...(typeof emojiData.height === 'number' ? { height: emojiData.height } : {}),
        groupId: 'ungrouped'
      }
      ungroupedGroup.emojis.push(newEmoji)
      log.info('addEmojiFromWeb', { id: newEmoji.id, name: newEmoji.name })
      // Mark the ungrouped group as dirty for incremental save
      markGroupDirty('ungrouped')
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
      log.debug('updateSettings - no changes detected, skipping')
      return
    }

    settings.value = normalizeSettings({ ...settings.value, ...newSettings })
    log.info('updateSettings', { updates: newSettings })
    // Mark settings as dirty for incremental save
    markSettingsDirty()
    // Don't call maybeSave() here - let the watch handle all saves with debouncing
    // This prevents duplicate saves when updating settings
    // attempt to notify background to sync to content scripts
    void syncSettingsToBackground(newSettings)
  }

  // Notify background to sync settings across contexts (content scripts)
  // 优化：添加防抖，避免用户快速调节滑块时产生大量无效的 sendMessage 调用
  let syncSettingsTimer: ReturnType<typeof setTimeout> | null = null

  // 清理定时器，防止内存泄漏
  const cleanupSyncSettingsTimer = () => {
    if (syncSettingsTimer) {
      clearTimeout(syncSettingsTimer)
      syncSettingsTimer = null
    }
  }

  // 在 store 销毁时清理定时器
  onScopeDispose(() => {
    cleanupSyncSettingsTimer()
  })

  const syncSettingsToBackground = (newSettings?: Partial<AppSettings>) => {
    // 清除之前的定时器
    if (syncSettingsTimer) {
      clearTimeout(syncSettingsTimer)
    }

    // 设置新的防抖定时器
    syncSettingsTimer = setTimeout(() => {
      try {
        const chromeAPI = getChromeAPI()
        if (chromeAPI?.runtime?.sendMessage) {
          const payload: any = { type: 'SYNC_SETTINGS', settings: settings.value }
          if (newSettings) {
            payload.updates = newSettings
          }
          chromeAPI.runtime.sendMessage(payload)
        }
      } catch {
        // ignore
      }
      syncSettingsTimer = null
    }, SYNC_SETTINGS_DEBOUNCE_MS)
  }

  // Specific setting update functions
  const updateUseIndexedDBForImages = (value: boolean) => {
    const current = resolveImageCacheStrategy(settings.value) !== 'force-source'
    if (current !== value) {
      updateSettings({
        imageCacheStrategy: value ? 'auto' : 'force-source'
      })
      log.info('updateUseIndexedDBForImages', { value })
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
          // Mark the imported/merged group as dirty
          markGroupDirty(targetId)
        }

        // Append any remaining existing groups not touched by import
        mergedGroups.push(...existingGroups.values())

        groups.value = mergedGroups
      }

      if (config?.settings && typeof config.settings === 'object') {
        settings.value = { ...settings.value, ...config.settings }
        markSettingsDirty()
      }

      if (Array.isArray(config?.favorites)) {
        const mergedFavorites = new Set([...favorites.value, ...config.favorites])
        favorites.value = mergedFavorites
        markFavoritesDirty()
      }

      log.info('importConfiguration merged', {
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
    await storage.resetToDefaults()
    await loadData() // Reload store state from storage
  }

  const forceSync = async () => {
    try {
      await storage.backupToSync(groups.value, settings.value, Array.from(favorites.value))
      return true
    } catch (error) {
      log.error('Failed to sync to chrome:', error)
      return false
    }
  }

  // --- Synchronization and Persistence ---

  // 优化：精确监听，避免全量保存
  // 只在分组数量变化时全量保存索引
  watch(
    () => groups.value.length,
    () => {
      if (!isLoading.value && !isUpdatingFromStorage() && hasLoadedOnce.value) {
        // 分组数量变化：需要更新索引
        const index = groups.value.map((g, order) => ({ id: g.id, order }))
        storage.setEmojiGroupIndex(index).catch(err => {
          log.error('Failed to save group index:', err)
        })
      }
    }
  )

  // 移除空的 watch - settings 和 favorites 已经通过各自的 save 方法处理
  // 不需要额外的 watch

  // Message deduplication: Track recently processed emoji additions to prevent duplicates
  const processedEmojiIds = new Set<string>()
  const EMOJI_DEDUP_WINDOW_MS = 5000 // 5 seconds window for deduplication

  const applyUngroupedAddition = (payload: { emoji: Emoji; group?: EmojiGroup }) => {
    if (!payload || !payload.emoji) return

    // Deduplication check: Skip if we recently processed this emoji
    const emojiKey = `${payload.emoji.id || ''}_${payload.emoji.url || ''}_${payload.emoji.addedAt || Date.now()}`
    if (processedEmojiIds.has(emojiKey)) {
      log.debug('Skipping duplicate emoji addition:', emojiKey)
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
      // Mark the new group as dirty for incremental save
      markGroupDirty(targetGroupId)
    }

    const exists = targetGroup.emojis.some(
      e => e.id === payload.emoji.id || e.url === payload.emoji.url
    )
    if (!exists) {
      targetGroup.emojis.push(payload.emoji)
      // Mark the target group as dirty for incremental save
      markGroupDirty(targetGroupId)
      // maintain consistency of favorites if necessary
      if (payload.emoji.groupId === 'favorites') {
        favorites.value.add(payload.emoji.id)
        markFavoritesDirty()
      }
      log.info('Applied emoji addition:', payload.emoji.id || payload.emoji.name)
      // Only save if not already saving or loading
      if (!isSaving.value && !isLoading.value) {
        maybeSave()
      }
    } else {
      log.debug('Emoji already exists, skipping:', payload.emoji.id || payload.emoji.name)
    }
  }

  // Listen for changes from other extension contexts (e.g., options page)
  const { isUpdatingFromStorage, setupStorageListener } = useStorageSync({
    groups,
    settings,
    favorites,
    isSaving,
    isLoading,
    applyUngroupedAddition,
    onEmojiAdded: emoji => searchIndexStore.addEmojiToIndex(emoji),
    onEmojiRemoved: emoji => searchIndexStore.removeEmojiFromIndex(emoji),
    onEmojiUpdated: (oldEmoji, newEmoji) => searchIndexStore.updateEmojiInIndex(oldEmoji, newEmoji),
    onTagsAdded: tags => tagCountStore.incrementTagCounts(tags),
    onTagsRemoved: tags => tagCountStore.decrementTagCounts(tags)
  })

  setupStorageListener()

  // --- 归档功能 ---
  // 归档分组
  const archiveGroup = async (groupId: string) => {
    const group = groups.value.find(g => g.id === groupId)
    if (!group) {
      log.error('archiveGroup: group not found', groupId)
      return
    }

    try {
      await storage.archiveGroup(group)
      // 从主列表移除
      groups.value = groups.value.filter(g => g.id !== groupId)
      // 添加到归档列表 - 使用数组替换以触发 shallowRef 响应式更新
      archivedGroups.value = [...archivedGroups.value, group]
      log.info('Group archived:', groupId)
    } catch (err) {
      log.error('Failed to archive group:', err)
    }
  }

  // 取消归档
  const unarchiveGroup = async (groupId: string) => {
    try {
      const group = await storage.unarchiveGroup(groupId)
      if (group) {
        // 从归档列表移除
        archivedGroups.value = archivedGroups.value.filter(g => g.id !== groupId)
        // 添加到主列表 - 使用数组替换以触发 shallowRef 响应式更新
        groups.value = [...groups.value, group]
        log.info('Group unarchived:', groupId)
      }
    } catch (err) {
      log.error('Failed to unarchive group:', err)
    }
  }

  // 删除归档分组
  const deleteArchivedGroup = async (groupId: string) => {
    try {
      await storage.deleteArchivedGroup(groupId)
      archivedGroups.value = archivedGroups.value.filter(g => g.id !== groupId)
      log.info('Archived group deleted:', groupId)
    } catch (err) {
      log.error('Failed to delete archived group:', err)
    }
  }

  // 刷新归档分组列表
  const refreshArchivedGroups = async () => {
    try {
      archivedGroups.value = await storage.getAllArchivedGroups()
    } catch (err) {
      log.error('Failed to refresh archived groups:', err)
    }
  }

  return {
    // State
    groups,
    archivedGroups,
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
    favoritesCount: computed(() => {
      const favoritesGroup = groups.value.find(g => g.id === 'favorites')
      return favoritesGroup?.emojis?.length || 0
    }),

    // Actions
    loadData,
    saveData,
    saveGroup,
    saveSettings,
    saveFavorites,
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
    rewriteEmojiUrls: emojiCrudStore.rewriteEmojiUrls,
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
    clearTagFilters: tagStore.clearTagFilters,

    // Archive Management
    archiveGroup,
    unarchiveGroup,
    deleteArchivedGroup,
    refreshArchivedGroups
  }
})
