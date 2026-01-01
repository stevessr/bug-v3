/**
 * Emoji CRUD Store
 * Handles emoji add, update, delete, move, and deduplication operations
 */

import type { Ref } from 'vue'

import type { SaveControl, DuplicateGroup } from './core/types'

import type { Emoji, EmojiGroup } from '@/types/type'
import { normalizeImageUrl } from '@/utils/isImageUrl'

export interface EmojiCrudStoreOptions {
  groups: Ref<EmojiGroup[]>
  favorites: Ref<Set<string>>
  saveControl: SaveControl
}

/**
 * Generate a unique emoji ID
 */
function generateEmojiId(): string {
  return `emoji-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function useEmojiCrudStore(options: EmojiCrudStoreOptions) {
  const { groups, favorites, saveControl } = options

  /**
   * 触发 groups 的响应式更新（用于 shallowRef）
   * 因为 groups 使用了 shallowRef，直接修改数组内容或对象属性不会触发响应式更新
   * 必须创建新的对象引用并替换整个数组
   */

  // --- Basic CRUD ---

  /**
   * Add an emoji to a group
   */
  const addEmoji = (groupId: string, emoji: Omit<Emoji, 'id' | 'groupId'>): Emoji | undefined => {
    const groupIndex = groups.value.findIndex(g => g.id === groupId)
    if (groupIndex !== -1) {
      const group = groups.value[groupIndex]
      const emojis = Array.isArray(group.emojis) ? group.emojis : []

      const newEmoji: Emoji = {
        ...emoji,
        id: generateEmojiId(),
        groupId,
        ...(emoji.tags && emoji.tags.length > 0 ? { tags: emoji.tags } : {})
      }

      // 优化：创建新的 group 对象并替换，触发 shallowRef 响应式更新
      const newGroup = {
        ...group,
        emojis: [...emojis, newEmoji]
      }

      groups.value = [
        ...groups.value.slice(0, groupIndex),
        newGroup,
        ...groups.value.slice(groupIndex + 1)
      ]

      // Update tag counts incrementally
      saveControl.onTagsAdded?.(newEmoji.tags)
      // Update search index incrementally
      saveControl.onEmojiAdded?.(newEmoji)
      // Mark the group as dirty for incremental save
      saveControl.markGroupDirty?.(groupId)
      saveControl.maybeSave()
      return newEmoji
    }
  }

  /**
   * Add an emoji without triggering save (for batch operations)
   */
  const addEmojiWithoutSave = (
    groupId: string,
    emoji: Omit<Emoji, 'id' | 'groupId'>
  ): Emoji | undefined => {
    const groupIndex = groups.value.findIndex(g => g.id === groupId)
    if (groupIndex !== -1) {
      const group = groups.value[groupIndex]
      const emojis = Array.isArray(group.emojis) ? group.emojis : []

      const newEmoji: Emoji = {
        ...emoji,
        id: generateEmojiId(),
        groupId,
        ...(emoji.tags && emoji.tags.length > 0 ? { tags: emoji.tags } : {})
      }

      // 优化：创建新的 group 对象并替换，触发 shallowRef 响应式更新
      const newGroup = {
        ...group,
        emojis: [...emojis, newEmoji]
      }

      groups.value = [
        ...groups.value.slice(0, groupIndex),
        newGroup,
        ...groups.value.slice(groupIndex + 1)
      ]

      // For batch operations, invalidate cache instead of incremental update
      saveControl.invalidateTagCache?.()
      saveControl.invalidateSearchIndex?.()
      // Mark the group as dirty for incremental save (will be saved when batch ends)
      saveControl.markGroupDirty?.(groupId)
      return newEmoji
    }
  }

  /**
   * Update an emoji by ID (searches across all groups)
   */
  const updateEmoji = (emojiId: string, updates: Partial<Emoji>): void => {
    for (let i = 0; i < groups.value.length; i++) {
      const group = groups.value[i]
      const emojis = group.emojis || []
      const index = emojis.findIndex(e => e && e.id === emojiId)
      if (index !== -1) {
        const oldEmoji = emojis[index]
        // Handle tag changes incrementally
        if (updates.tags !== undefined && oldEmoji.tags !== updates.tags) {
          saveControl.onTagsRemoved?.(oldEmoji.tags)
          saveControl.onTagsAdded?.(updates.tags)
        }
        const newEmoji = { ...emojis[index], ...updates }

        // 优化：创建新的 group 对象并替换，触发 shallowRef 响应式更新
        const newGroup = {
          ...group,
          emojis: [...emojis.slice(0, index), newEmoji, ...emojis.slice(index + 1)]
        }

        groups.value = [...groups.value.slice(0, i), newGroup, ...groups.value.slice(i + 1)]

        // Update search index incrementally
        saveControl.onEmojiUpdated?.(oldEmoji, newEmoji)
        // Mark the group as dirty for incremental save
        saveControl.markGroupDirty?.(group.id)
        saveControl.maybeSave()
        break
      }
    }
  }

  /**
   * Batch update emoji names
   */
  const updateEmojiNames = (nameUpdates: Record<string, string>): void => {
    saveControl.beginBatch()
    try {
      const groupUpdates = new Map<number, EmojiGroup>()

      for (let i = 0; i < groups.value.length; i++) {
        const group = groups.value[i]
        const emojis = group.emojis || []
        let groupModified = false
        const newEmojis = [...emojis]

        for (let j = 0; j < newEmojis.length; j++) {
          const emoji = newEmojis[j]
          if (emoji && nameUpdates[emoji.id]) {
            newEmojis[j] = { ...emoji, name: nameUpdates[emoji.id] }
            groupModified = true
          }
        }

        // 优化：创建新的 group 对象并暂存到 Map 中
        if (groupModified) {
          groupUpdates.set(i, {
            ...group,
            emojis: newEmojis
          })
          saveControl.markGroupDirty?.(group.id)
        }
      }

      // 一次性应用所有 group 更新，触发 shallowRef 响应式更新
      if (groupUpdates.size > 0) {
        groups.value = groups.value.map((g, i) => groupUpdates.get(i) || g)
      }
    } finally {
      saveControl.endBatch()
    }
  }

  /**
   * Delete an emoji by ID
   */
  const deleteEmoji = (emojiId: string): void => {
    let groupModified = false

    for (let i = 0; i < groups.value.length; i++) {
      const group = groups.value[i]
      if (!group.emojis) continue

      const emojiIndex = group.emojis.findIndex(e => e?.id === emojiId)
      if (emojiIndex !== -1) {
        const emoji = group.emojis[emojiIndex]
        // Decrement tag counts before removal
        saveControl.onTagsRemoved?.(emoji?.tags)
        // Update search index before removal
        if (emoji) {
          saveControl.onEmojiRemoved?.(emoji)
        }

        // 优化：创建新的 group 对象并替换，触发 shallowRef 响应式更新
        const newGroup = {
          ...group,
          emojis: group.emojis.filter((_, idx) => idx !== emojiIndex)
        }

        groups.value = [...groups.value.slice(0, i), newGroup, ...groups.value.slice(i + 1)]

        // Mark the group as dirty for incremental save
        saveControl.markGroupDirty?.(group.id)
        // Also mark favorites as dirty if the emoji was a favorite
        if (favorites.value.has(emojiId)) {
          saveControl.markFavoritesDirty?.()
        }
        groupModified = true
        break
      }
    }

    if (groupModified) {
      favorites.value.delete(emojiId)
      saveControl.maybeSave()
    }
  }

  /**
   * Update an emoji at a specific index in a group
   */
  const updateEmojiInGroup = (
    groupId: string,
    index: number,
    updatedEmoji: Partial<Emoji>
  ): void => {
    const groupIndex = groups.value.findIndex(g => g.id === groupId)
    if (groupIndex === -1) return

    const group = groups.value[groupIndex]
    const emojis = group?.emojis || []
    if (index >= 0 && index < emojis.length) {
      const currentEmoji = emojis[index]
      if (!currentEmoji) return

      // Handle tag changes incrementally
      if (updatedEmoji.tags !== undefined && currentEmoji.tags !== updatedEmoji.tags) {
        saveControl.onTagsRemoved?.(currentEmoji.tags)
        saveControl.onTagsAdded?.(updatedEmoji.tags)
      }

      const newEmoji = { ...currentEmoji, ...updatedEmoji }

      // 优化：创建新的 group 对象并替换，触发 shallowRef 响应式更新
      const newGroup = {
        ...group,
        emojis: [...emojis.slice(0, index), newEmoji, ...emojis.slice(index + 1)]
      }

      groups.value = [
        ...groups.value.slice(0, groupIndex),
        newGroup,
        ...groups.value.slice(groupIndex + 1)
      ]

      // Update search index incrementally
      saveControl.onEmojiUpdated?.(currentEmoji, newEmoji)
      // Mark the group as dirty for incremental save
      saveControl.markGroupDirty?.(groupId)
      saveControl.maybeSave()
    }
  }

  /**
   * Remove an emoji from a group by index
   */
  const removeEmojiFromGroup = (groupId: string, index: number): void => {
    const groupIndex = groups.value.findIndex(g => g.id === groupId)
    if (groupIndex === -1) return

    const group = groups.value[groupIndex]
    const emojis = group?.emojis || []
    if (index >= 0 && index < emojis.length) {
      const emoji = emojis[index]
      if (!emoji) return

      // Decrement tag counts before removal
      saveControl.onTagsRemoved?.(emoji.tags)

      // 优化：创建新的 group 对象并替换，触发 shallowRef 响应式更新
      const newGroup = {
        ...group,
        emojis: [...emojis.slice(0, index), ...emojis.slice(index + 1)]
      }

      groups.value = [
        ...groups.value.slice(0, groupIndex),
        newGroup,
        ...groups.value.slice(groupIndex + 1)
      ]

      // Mark the group as dirty for incremental save
      saveControl.markGroupDirty?.(groupId)
      // Also mark favorites as dirty if the emoji was a favorite
      if (favorites.value.has(emoji.id)) {
        saveControl.markFavoritesDirty?.()
      }
      favorites.value.delete(emoji.id)
      saveControl.maybeSave()
    }
  }

  // --- Move Operations ---

  /**
   * Move an emoji between groups
   */
  const moveEmoji = (
    sourceGroupId: string,
    sourceIndex: number,
    targetGroupId: string,
    targetIndex: number
  ): void => {
    const sourceGroupIndex = groups.value.findIndex(g => g.id === sourceGroupId)
    const targetGroupIndex = groups.value.findIndex(g => g.id === targetGroupId)

    if (
      sourceGroupIndex === -1 ||
      targetGroupIndex === -1 ||
      sourceIndex < 0 ||
      sourceIndex >= groups.value[sourceGroupIndex].emojis.length
    ) {
      return
    }

    const sourceGroup = groups.value[sourceGroupIndex]
    const targetGroup = groups.value[targetGroupIndex]
    const emoji = sourceGroup.emojis[sourceIndex]
    emoji.groupId = targetGroupId

    // 优化：创建新的 group 对象并替换，触发 shallowRef 响应式更新

    // 如果是同一个组，只需要更新一次
    if (sourceGroupId === targetGroupId) {
      // 先从源位置移除表情
      const emojisWithoutSource = [
        ...sourceGroup.emojis.slice(0, sourceIndex),
        ...sourceGroup.emojis.slice(sourceIndex + 1)
      ]

      // 然后在目标位置插入表情
      // 注意：如果目标位置在源位置之后，需要调整索引
      const adjustedTargetIndex = targetIndex > sourceIndex ? targetIndex - 1 : targetIndex
      const newEmojis =
        adjustedTargetIndex >= 0 && adjustedTargetIndex <= emojisWithoutSource.length
          ? [
              ...emojisWithoutSource.slice(0, adjustedTargetIndex),
              emoji,
              ...emojisWithoutSource.slice(adjustedTargetIndex)
            ]
          : [...emojisWithoutSource, emoji]

      const newGroup = {
        ...sourceGroup,
        emojis: newEmojis
      }

      groups.value = [
        ...groups.value.slice(0, sourceGroupIndex),
        newGroup,
        ...groups.value.slice(sourceGroupIndex + 1)
      ]
    } else {
      // 不同组，需要同时更新源和目标组
      // 从源分组移除
      const newSourceGroup = {
        ...sourceGroup,
        emojis: [
          ...sourceGroup.emojis.slice(0, sourceIndex),
          ...sourceGroup.emojis.slice(sourceIndex + 1)
        ]
      }

      // 添加到目标分组
      const newTargetEmojis =
        targetIndex >= 0 && targetIndex <= targetGroup.emojis.length
          ? [
              ...targetGroup.emojis.slice(0, targetIndex),
              emoji,
              ...targetGroup.emojis.slice(targetIndex)
            ]
          : [...targetGroup.emojis, emoji]

      const newTargetGroup = {
        ...targetGroup,
        emojis: newTargetEmojis
      }

      const updates = new Map([
        [sourceGroupIndex, newSourceGroup],
        [targetGroupIndex, newTargetGroup]
      ])

      groups.value = groups.value.map((g, i) => updates.get(i) || g)
    }

    // Mark both source and target groups as dirty for incremental save
    saveControl.markGroupDirty?.(sourceGroupId)
    saveControl.markGroupDirty?.(targetGroupId)
    saveControl.maybeSave()
  }

  // --- Deduplication ---

  /**
   * Remove duplicate emojis within a group based on normalized URL
   */
  const dedupeGroup = (groupId: string): number => {
    const groupIndex = groups.value.findIndex(g => g.id === groupId)
    if (groupIndex === -1) return 0

    const group = groups.value[groupIndex]
    if (!Array.isArray(group.emojis)) {
      return 0
    }

    try {
      const seen = new Set<string>()
      const originalLength = group.emojis.length
      const kept: typeof group.emojis = []

      for (const e of group.emojis) {
        if (!e) continue
        const url =
          typeof (e as Emoji).url === 'string'
            ? normalizeImageUrl((e as Emoji).url) || (e as Emoji).url
            : ''
        if (!url) {
          kept.push(e)
          continue
        }
        if (!seen.has(url)) {
          seen.add(url)
          kept.push(e)
        }
      }

      const removed = originalLength - kept.length
      if (removed > 0) {
        // 优化：创建新的 group 对象并替换，触发 shallowRef 响应式更新
        const newGroup = {
          ...group,
          emojis: kept
        }

        groups.value = [
          ...groups.value.slice(0, groupIndex),
          newGroup,
          ...groups.value.slice(groupIndex + 1)
        ]

        // Invalidate tag cache since we removed emojis
        saveControl.invalidateTagCache?.()
        // Mark the group as dirty for incremental save
        saveControl.markGroupDirty?.(groupId)
        saveControl.maybeSave()
      }
      return removed
    } catch (err) {
      console.error('[EmojiCrudStore] dedupeGroup error', err)
      return 0
    }
  }

  /**
   * Remove duplicate emojis within a group based on name (case-insensitive)
   */
  const dedupeGroupByName = (groupId: string): number => {
    const groupIndex = groups.value.findIndex(g => g.id === groupId)
    if (groupIndex === -1) return 0

    const group = groups.value[groupIndex]
    if (!Array.isArray(group.emojis)) {
      return 0
    }

    try {
      const seen = new Set<string>()
      const originalLength = group.emojis.length
      const kept: typeof group.emojis = []

      for (const e of group.emojis) {
        if (!e) continue
        const name =
          typeof (e as Emoji).name === 'string' ? (e as Emoji).name.trim().toLowerCase() : ''
        if (!name) {
          kept.push(e)
          continue
        }
        if (!seen.has(name)) {
          seen.add(name)
          kept.push(e)
        }
      }

      const removed = originalLength - kept.length
      if (removed > 0) {
        // 优化：创建新的 group 对象并替换，触发 shallowRef 响应式更新
        const newGroup = {
          ...group,
          emojis: kept
        }

        groups.value = [
          ...groups.value.slice(0, groupIndex),
          newGroup,
          ...groups.value.slice(groupIndex + 1)
        ]

        // Invalidate tag cache since we removed emojis
        saveControl.invalidateTagCache?.()
        // Mark the group as dirty for incremental save
        saveControl.markGroupDirty?.(groupId)
        saveControl.maybeSave()
      }
      return removed
    } catch (err) {
      console.error('[EmojiCrudStore] dedupeGroupByName error', err)
      return 0
    }
  }

  // --- Reference Resolution ---

  /**
   * Resolve emoji reference (for deduplicated emojis)
   */
  const resolveEmojiReference = (emoji: Emoji): Emoji | undefined => {
    if (!emoji || !emoji.referenceId) return emoji

    for (const group of groups.value) {
      const emojis = group.emojis || []
      const referenced = emojis.find(e => e && e.id === emoji.referenceId)
      if (referenced) {
        return {
          ...emoji,
          url: referenced.url,
          displayUrl: referenced.displayUrl || referenced.url
        }
      }
    }
    return emoji
  }

  // --- Lookup Helpers ---

  /**
   * Find an emoji by ID across all groups
   */
  const findEmoji = (emojiId: string): Emoji | undefined => {
    for (const group of groups.value) {
      const emoji = group.emojis?.find(e => e?.id === emojiId)
      if (emoji) return emoji
    }
    return undefined
  }

  /**
   * Find which group contains an emoji
   */
  const findEmojiGroup = (emojiId: string): EmojiGroup | undefined => {
    return groups.value.find(g => g.emojis?.some(e => e?.id === emojiId))
  }

  /**
   * Get all emojis across all groups
   */
  const getAllEmojis = (): Emoji[] => {
    const all: Emoji[] = []
    for (const group of groups.value) {
      if (group.emojis) {
        all.push(...group.emojis.filter(e => e != null))
      }
    }
    return all
  }

  /**
   * Remove duplicates across groups and optionally create references
   */
  const removeDuplicatesAcrossGroups = async (
    duplicates: Array<Array<DuplicateGroup>>,
    createReferences = true
  ): Promise<number> => {
    try {
      let totalRemoved = 0
      const groupUpdates = new Map<string, EmojiGroup>()

      for (const duplicateSet of duplicates) {
        if (duplicateSet.length < 2) continue

        const [original, ...duplicatesToRemove] = duplicateSet

        for (const duplicate of duplicatesToRemove) {
          const groupIndex = groups.value.findIndex(g => g.id === duplicate.groupId)
          if (groupIndex === -1) continue

          const group = groups.value[groupIndex]
          const emojis = group.emojis || []
          const index = emojis.findIndex(e => e && e.id === duplicate.emoji.id)
          if (index === -1) continue

          let newEmojis: Emoji[]

          if (createReferences) {
            // Replace with reference
            const referencedEmoji = {
              ...duplicate.emoji,
              referenceId: original.emoji.id,
              url: original.emoji.url
            }
            newEmojis = [...emojis.slice(0, index), referencedEmoji, ...emojis.slice(index + 1)]
          } else {
            // Remove completely
            newEmojis = [...emojis.slice(0, index), ...emojis.slice(index + 1)]
            totalRemoved++
          }

          // 优化：创建新的 group 对象并暂存到 Map 中
          groupUpdates.set(duplicate.groupId, {
            ...group,
            emojis: newEmojis
          })

          // Mark the group as dirty for incremental save
          saveControl.markGroupDirty?.(duplicate.groupId)
        }
      }

      // 一次性应用所有 group 更新，触发 shallowRef 响应式更新
      if (groupUpdates.size > 0) {
        groups.value = groups.value.map(g => groupUpdates.get(g.id) || g)
      }

      if (totalRemoved > 0) {
        // Invalidate tag cache since we removed emojis
        saveControl.invalidateTagCache?.()
        saveControl.maybeSave()
      }

      return totalRemoved
    } catch (err) {
      console.error('[EmojiCrudStore] removeDuplicatesAcrossGroups error', err)
      return 0
    }
  }

  /**
   * Clear all perceptual hashes from all emojis
   */
  const clearAllPerceptualHashes = async (): Promise<void> => {
    try {
      saveControl.beginBatch()
      for (const group of groups.value) {
        const emojis = group.emojis || []
        let groupModified = false
        for (const emoji of emojis) {
          if (emoji && emoji.perceptualHash) {
            delete emoji.perceptualHash
            groupModified = true
          }
        }
        // Mark the group as dirty if any emoji was modified
        if (groupModified) {
          saveControl.markGroupDirty?.(group.id)
        }
      }
    } finally {
      await saveControl.endBatch()
    }
  }

  return {
    // Basic CRUD
    addEmoji,
    addEmojiWithoutSave,
    updateEmoji,
    updateEmojiNames,
    deleteEmoji,
    updateEmojiInGroup,
    removeEmojiFromGroup,

    // Move
    moveEmoji,

    // Deduplication
    dedupeGroup,
    dedupeGroupByName,
    removeDuplicatesAcrossGroups,
    clearAllPerceptualHashes,

    // Reference resolution
    resolveEmojiReference,

    // Lookup helpers
    findEmoji,
    findEmojiGroup,
    getAllEmojis
  }
}

export type EmojiCrudStore = ReturnType<typeof useEmojiCrudStore>
