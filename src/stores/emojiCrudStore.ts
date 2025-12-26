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

  // --- Basic CRUD ---

  /**
   * Add an emoji to a group
   */
  const addEmoji = (groupId: string, emoji: Omit<Emoji, 'id' | 'groupId'>): Emoji | undefined => {
    const group = groups.value.find(g => g.id === groupId)
    if (group) {
      if (!Array.isArray(group.emojis)) {
        group.emojis = []
      }
      const newEmoji: Emoji = {
        ...emoji,
        id: generateEmojiId(),
        groupId,
        ...(emoji.tags && emoji.tags.length > 0 ? { tags: emoji.tags } : {})
      }
      group.emojis.push(newEmoji)
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
    const group = groups.value.find(g => g.id === groupId)
    if (group) {
      if (!Array.isArray(group.emojis)) {
        group.emojis = []
      }
      const newEmoji: Emoji = {
        ...emoji,
        id: generateEmojiId(),
        groupId,
        ...(emoji.tags && emoji.tags.length > 0 ? { tags: emoji.tags } : {})
      }
      group.emojis.push(newEmoji)
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
    for (const group of groups.value) {
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
        emojis[index] = newEmoji
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
          saveControl.markGroupDirty?.(group.id)
        }
      }
    } finally {
      saveControl.endBatch()
    }
  }

  /**
   * Delete an emoji by ID
   */
  const deleteEmoji = (emojiId: string): void => {
    for (const group of groups.value) {
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
        group.emojis.splice(emojiIndex, 1)
        // Mark the group as dirty for incremental save
        saveControl.markGroupDirty?.(group.id)
        // Also mark favorites as dirty if the emoji was a favorite
        if (favorites.value.has(emojiId)) {
          saveControl.markFavoritesDirty?.()
        }
      }
    }
    favorites.value.delete(emojiId)
    saveControl.maybeSave()
  }

  /**
   * Update an emoji at a specific index in a group
   */
  const updateEmojiInGroup = (
    groupId: string,
    index: number,
    updatedEmoji: Partial<Emoji>
  ): void => {
    const group = groups.value.find(g => g.id === groupId)
    const emojis = group?.emojis || []
    if (group && index >= 0 && index < emojis.length) {
      const currentEmoji = emojis[index]
      if (!currentEmoji) return
      // Handle tag changes incrementally
      if (updatedEmoji.tags !== undefined && currentEmoji.tags !== updatedEmoji.tags) {
        saveControl.onTagsRemoved?.(currentEmoji.tags)
        saveControl.onTagsAdded?.(updatedEmoji.tags)
      }
      const newEmoji = { ...currentEmoji, ...updatedEmoji }
      emojis[index] = newEmoji
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
    const group = groups.value.find(g => g.id === groupId)
    const emojis = group?.emojis || []
    if (group && index >= 0 && index < emojis.length) {
      const emoji = emojis[index]
      if (!emoji) return
      // Decrement tag counts before removal
      saveControl.onTagsRemoved?.(emoji.tags)
      emojis.splice(index, 1)
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

      // Mark both source and target groups as dirty for incremental save
      saveControl.markGroupDirty?.(sourceGroupId)
      saveControl.markGroupDirty?.(targetGroupId)
      saveControl.maybeSave()
    }
  }

  // --- Deduplication ---

  /**
   * Remove duplicate emojis within a group based on normalized URL
   */
  const dedupeGroup = (groupId: string): number => {
    const group = groups.value.find(g => g.id === groupId)
    if (!group) return 0

    if (!Array.isArray(group.emojis)) {
      group.emojis = []
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

      group.emojis = kept
      const removed = originalLength - group.emojis.length
      if (removed > 0) {
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
    const group = groups.value.find(g => g.id === groupId)
    if (!group) return 0

    if (!Array.isArray(group.emojis)) {
      group.emojis = []
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

      group.emojis = kept
      const removed = originalLength - group.emojis.length
      if (removed > 0) {
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

      for (const duplicateSet of duplicates) {
        if (duplicateSet.length < 2) continue

        const [original, ...duplicatesToRemove] = duplicateSet

        for (const duplicate of duplicatesToRemove) {
          const group = groups.value.find(g => g.id === duplicate.groupId)
          if (!group) continue

          const emojis = group.emojis || []
          const index = emojis.findIndex(e => e && e.id === duplicate.emoji.id)
          if (index === -1) continue

          if (createReferences) {
            emojis[index] = {
              ...duplicate.emoji,
              referenceId: original.emoji.id,
              url: original.emoji.url
            }
            // Mark the group as dirty for incremental save
            saveControl.markGroupDirty?.(duplicate.groupId)
          } else {
            emojis.splice(index, 1)
            // Mark the group as dirty for incremental save
            saveControl.markGroupDirty?.(duplicate.groupId)
            totalRemoved++
          }
        }
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
