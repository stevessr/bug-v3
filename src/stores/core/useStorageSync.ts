import { type ShallowRef, type Ref } from 'vue'

import { STORAGE_KEYS } from '@/utils/simpleStorage'
import * as storage from '@/utils/simpleStorage'
import type { EmojiGroup, AppSettings, Emoji } from '@/types/type'
import { normalizeImageUrl } from '@/utils/isImageUrl'
import { defaultSettings } from '@/types/defaultSettings'

interface StorageSyncOptions {
  groups: ShallowRef<EmojiGroup[]>
  settings: Ref<AppSettings>
  favorites: Ref<Set<string>>
  isSaving: Ref<boolean>
  isLoading: Ref<boolean>
  applyUngroupedAddition: (payload: { emoji: Emoji; group?: EmojiGroup }) => void
}

export function useStorageSync({
  groups,
  settings,
  favorites,
  isSaving,
  isLoading,
  applyUngroupedAddition
}: StorageSyncOptions) {
  // Listen for changes from other extension contexts (e.g., options page)
  let isUpdatingFromStorage = false
  // Track most recent external change timestamp to ignore stale events
  let lastExternalChangeTs = 0
  // Debounce timer to coalesce multiple rapid change events
  let externalChangeTimer: NodeJS.Timeout | null = null
  const EXTERNAL_CHANGE_DEBOUNCE_MS = 500
  // Flag to suppress storage change events when we're processing runtime messages
  let isProcessingRuntimeMessage = false
  let runtimeMessageListenerRegistered = false

  /**
   * 处理 legacy emojiGroups key 的变更
   */
  const handleLegacyGroupsChange = (change: chrome.storage.StorageChange) => {
    const legacyGroups = change?.newValue
    if (!Array.isArray(legacyGroups)) return

    console.log('[EmojiStore] Processing legacy emojiGroups change')
    const legacyFavorites = legacyGroups.find((g: any) => g.id === 'favorites')
    if (!legacyFavorites) return

    const idx = groups.value.findIndex(g => g.id === 'favorites')
    if (idx !== -1) {
      const updatedGroups = [...groups.value]
      updatedGroups[idx] = legacyFavorites
      groups.value = updatedGroups
      console.log('[EmojiStore] Updated favorites group from legacy data')
    } else {
      groups.value = [...groups.value, legacyFavorites]
      console.log('[EmojiStore] Added favorites group from legacy data')
    }
  }

  /**
   * 处理单个分组的变更
   */
  const handleGroupChange = async (
    groupId: string,
    change: chrome.storage.StorageChange
  ): Promise<void> => {
    // 尝试从 change payload 获取新数据
    let newGroup: EmojiGroup | null = null
    if (change?.newValue && typeof change.newValue === 'object') {
      newGroup = (change.newValue as { data?: EmojiGroup }).data || null
    }

    // 如果 payload 中没有，回退到存储读取
    if (!newGroup) {
      try {
        newGroup = await storage.getEmojiGroup(groupId)
      } catch {
        newGroup = null
      }
    }

    // 分组被删除
    if (newGroup == null) {
      groups.value = groups.value.filter(g => g.id !== groupId)
      console.log('[EmojiStore] Removed group from store due to external change', groupId)
      return
    }

    // 规范化图片 URL
    try {
      if (typeof newGroup.icon === 'string') {
        newGroup.icon = normalizeImageUrl(newGroup.icon) || newGroup.icon
      }
      if (Array.isArray(newGroup.emojis)) {
        for (const e of newGroup.emojis) {
          if (e?.url) e.url = normalizeImageUrl(e.url) || e.url
          if (e?.displayUrl) e.displayUrl = normalizeImageUrl(e.displayUrl) || e.displayUrl
        }
      }
    } catch {
      // 忽略规范化错误
    }

    // 更新或插入分组
    if (newGroup) {
      const targetId = newGroup.id
      const idx = groups.value.findIndex(g => g.id === targetId)
      if (idx !== -1) {
        const merged = { ...groups.value[idx], ...newGroup }
        groups.value = [...groups.value.slice(0, idx), merged, ...groups.value.slice(idx + 1)]
        console.log('[EmojiStore] Updated group in-place from external change', targetId)
      } else {
        groups.value = [...groups.value, newGroup]
        console.log('[EmojiStore] Inserted new group from external change', targetId)
      }
    }
  }

  /**
   * 处理设置变更
   */
  const handleSettingsChange = (change: chrome.storage.StorageChange) => {
    const data = change?.newValue ? (change.newValue as { data?: AppSettings }).data : null
    if (data && typeof data === 'object') {
      // Check if settings actually changed before updating
      const hasChanges = Object.keys(data).some(key => {
        const k = key as keyof AppSettings
        const oldValue = settings.value[k]
        const newValue = data[k]

        // Deep comparison for arrays
        if (Array.isArray(oldValue) && Array.isArray(newValue)) {
          if (oldValue.length !== newValue.length) return true
          return !oldValue.every((item, index) => {
            if (typeof item !== 'object' || item === null) {
              return item === newValue[index]
            }
            return JSON.stringify(item) === JSON.stringify(newValue[index])
          })
        }

        return oldValue !== newValue
      })

      if (hasChanges) {
        settings.value = { ...defaultSettings, ...data }
        console.log('[EmojiStore] Updated settings from external storage')
      } else {
        console.log('[EmojiStore] Settings unchanged, skipping update')
      }
    }
  }

  /**
   * 处理收藏夹变更
   */
  const handleFavoritesChange = (change: chrome.storage.StorageChange) => {
    const data = change?.newValue ? (change.newValue as { data?: string[] }).data : null
    if (Array.isArray(data)) {
      favorites.value = new Set(data)
      console.log('[EmojiStore] Updated favorites from external storage')
    }
  }

  /**
   * 处理分组索引变更
   */
  const handleGroupIndexChange = async (): Promise<void> => {
    try {
      const index = await storage.getEmojiGroupIndex()
      console.log('[EmojiStore] Processing GROUP_INDEX change:', index)

      if (!Array.isArray(index) || !index.length) return

      // 检查是否有新分组需要加载
      const existingIds = new Set(groups.value.map(g => g.id))
      const newGroupIds = index.filter(entry => !existingIds.has(entry.id))

      // 加载新分组
      if (newGroupIds.length > 0) {
        console.log(
          '[EmojiStore] Loading new groups from index:',
          newGroupIds.map(e => e.id)
        )
        for (const entry of newGroupIds) {
          try {
            const newGroup = await storage.getEmojiGroup(entry.id)
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

      // 按索引重新排序
      const orderMap = new Map(index.map((i: { id: string; order: number }) => [i.id, i.order]))
      const reordered = [...groups.value].sort((a, b) => {
        const oa = orderMap.get(a.id) ?? a.order ?? 0
        const ob = orderMap.get(b.id) ?? b.order ?? 0
        return oa - ob
      })
      groups.value = reordered.map((g, idx) => ({ ...g, order: idx }))
      console.log('[EmojiStore] Reordered groups from external group index')
    } catch {
      // 忽略错误
    }
  }

  /**
   * 处理存储变更事件的分派器
   */
  const processStorageChanges = async (
    changes: { [key: string]: chrome.storage.StorageChange },
    keys: string[]
  ): Promise<void> => {
    // 处理 legacy key
    if (keys.includes('emojiGroups')) {
      handleLegacyGroupsChange(changes['emojiGroups'])
    }

    // 按 key 类型分派处理
    for (const key of keys) {
      try {
        if (key === 'emojiGroups') continue // 已处理

        if (key.startsWith(STORAGE_KEYS.GROUP_PREFIX)) {
          const groupId = key.replace(STORAGE_KEYS.GROUP_PREFIX, '')
          await handleGroupChange(groupId, changes[key])
        } else if (key === STORAGE_KEYS.SETTINGS) {
          handleSettingsChange(changes[key])
        } else if (key === STORAGE_KEYS.FAVORITES) {
          handleFavoritesChange(changes[key])
        } else if (key === STORAGE_KEYS.GROUP_INDEX) {
          await handleGroupIndexChange()
        }
      } catch (err) {
        console.error('[EmojiStore] Error processing external key', key, err)
      }
    }
  }

  const setupStorageListener = () => {
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
          // Also check for legacy emojiGroups key for backward compatibility
          const isRelevant = changedKeys.some(
            k =>
              k === STORAGE_KEYS.SETTINGS ||
              k === STORAGE_KEYS.FAVORITES ||
              k === STORAGE_KEYS.GROUP_INDEX ||
              k.startsWith(STORAGE_KEYS.GROUP_PREFIX) ||
              k === 'emojiGroups' // Legacy support
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
              await processStorageChanges(capturedChanges, capturedKeys)
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
            (message: {
              type?: string
              payload?: {
                emoji: Emoji
                group?: EmojiGroup
                favoritesGroup?: EmojiGroup
                timestamp?: number
              }
            }) => {
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

              // 处理收藏夹更新通知
              if (message.type === 'FAVORITES_UPDATED') {
                isProcessingRuntimeMessage = true
                try {
                  console.log('[EmojiStore] Processing FAVORITES_UPDATED message')
                  if (message.payload && message.payload.favoritesGroup) {
                    // 更新本地收藏夹分组
                    const favoritesGroupIndex = groups.value.findIndex(g => g.id === 'favorites')
                    if (favoritesGroupIndex !== -1) {
                      // 使用数组替换确保 shallowRef 响应式更新
                      const updatedGroups = [...groups.value]
                      updatedGroups[favoritesGroupIndex] = message.payload.favoritesGroup
                      groups.value = updatedGroups
                      console.log('[EmojiStore] Updated favorites group from runtime message')
                    }
                  }
                } finally {
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
  }

  return {
    isUpdatingFromStorage: () => isUpdatingFromStorage,
    setupStorageListener
  }
}
