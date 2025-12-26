/**
 * Tag Store
 * Handles tag management for emojis including add, remove, search
 */

import type { Ref, ComputedRef } from 'vue'
import { computed } from 'vue'

import type { SaveControl } from './core/types'

import type { Emoji, EmojiGroup } from '@/types/type'

export interface TagStoreOptions {
  groups: Ref<EmojiGroup[]>
  selectedTags: Ref<string[]>
  saveControl: SaveControl
}

/**
 * Clean and normalize a tag
 */
function cleanTag(tag: string): string {
  return tag.trim().toLowerCase()
}

export function useTagStore(options: TagStoreOptions) {
  const { groups, selectedTags, saveControl } = options

  // --- Helper to find emoji by ID ---
  const findEmojiInGroups = (emojiId: string): Emoji | undefined => {
    for (const group of groups.value) {
      const emojis = group.emojis || []
      const emoji = emojis.find(e => e && e.id === emojiId)
      if (emoji) return emoji
    }
    return undefined
  }

  // --- Tag Operations ---

  /**
   * Add a tag to an emoji
   */
  const addTagToEmoji = (emojiId: string, tag: string): boolean => {
    const cleaned = cleanTag(tag)
    if (!cleaned) return false

    const emoji = findEmojiInGroups(emojiId)
    if (!emoji) return false

    if (!emoji.tags) {
      emoji.tags = []
    }

    if (!emoji.tags.includes(cleaned)) {
      emoji.tags.push(cleaned)
      saveControl.maybeSave()
      return true
    }
    return false
  }

  /**
   * Remove a tag from an emoji
   */
  const removeTagFromEmoji = (emojiId: string, tag: string): boolean => {
    const cleaned = cleanTag(tag)
    const emoji = findEmojiInGroups(emojiId)

    if (emoji?.tags) {
      const index = emoji.tags.indexOf(cleaned)
      if (index !== -1) {
        emoji.tags.splice(index, 1)
        saveControl.maybeSave()
        return true
      }
    }
    return false
  }

  /**
   * Set all tags for an emoji
   */
  const setEmojiTags = (emojiId: string, tags: string[]): boolean => {
    const cleanedTags = tags.map(cleanTag).filter(t => t)
    const emoji = findEmojiInGroups(emojiId)

    if (emoji) {
      emoji.tags = cleanedTags
      saveControl.maybeSave()
      return true
    }
    return false
  }

  /**
   * Add a tag to multiple emojis
   */
  const addTagToMultipleEmojis = (emojiIds: string[], tag: string): number => {
    const cleaned = cleanTag(tag)
    if (!cleaned) return 0

    saveControl.beginBatch()
    try {
      let changedCount = 0
      for (const emojiId of emojiIds) {
        if (addTagToEmoji(emojiId, cleaned)) {
          changedCount++
        }
      }
      return changedCount
    } finally {
      saveControl.endBatch()
    }
  }

  /**
   * Remove a tag from multiple emojis
   */
  const removeTagFromMultipleEmojis = (emojiIds: string[], tag: string): number => {
    const cleaned = cleanTag(tag)

    saveControl.beginBatch()
    try {
      let changedCount = 0
      for (const emojiId of emojiIds) {
        if (removeTagFromEmoji(emojiId, cleaned)) {
          changedCount++
        }
      }
      return changedCount
    } finally {
      saveControl.endBatch()
    }
  }

  /**
   * Get tags for an emoji
   */
  const getEmojiTags = (emojiId: string): string[] => {
    const emoji = findEmojiInGroups(emojiId)
    return emoji?.tags || []
  }

  /**
   * Find all emojis with a specific tag
   */
  const findEmojisByTag = (tag: string): Emoji[] => {
    const cleaned = cleanTag(tag)
    const result: Emoji[] = []

    for (const group of groups.value) {
      const emojis = group.emojis || []
      for (const emoji of emojis) {
        if (emoji?.tags?.includes(cleaned)) {
          result.push(emoji)
        }
      }
    }

    return result
  }

  // --- Tag Filtering ---

  /**
   * Set selected tags for filtering
   */
  const setSelectedTags = (tags: string[]): void => {
    selectedTags.value = tags
  }

  /**
   * Toggle a tag in the filter
   */
  const toggleTagFilter = (tag: string): void => {
    const index = selectedTags.value.indexOf(tag)
    if (index === -1) {
      selectedTags.value.push(tag)
    } else {
      selectedTags.value.splice(index, 1)
    }
  }

  /**
   * Clear all tag filters
   */
  const clearTagFilters = (): void => {
    selectedTags.value = []
  }

  // --- Computed ---

  /**
   * Get all unique tags across all emojis
   */
  const allTags: ComputedRef<string[]> = computed(() => {
    const tagSet = new Set<string>()

    for (const group of groups.value) {
      const emojis = group.emojis || []
      for (const emoji of emojis) {
        if (emoji?.tags) {
          for (const tag of emoji.tags) {
            tagSet.add(tag)
          }
        }
      }
    }

    return Array.from(tagSet).sort()
  })

  /**
   * Get tag usage counts
   */
  const tagUsageCounts: ComputedRef<Record<string, number>> = computed(() => {
    const counts: Record<string, number> = {}

    for (const group of groups.value) {
      const emojis = group.emojis || []
      for (const emoji of emojis) {
        if (emoji?.tags) {
          for (const tag of emoji.tags) {
            counts[tag] = (counts[tag] || 0) + 1
          }
        }
      }
    }

    return counts
  })

  return {
    // Tag operations
    addTagToEmoji,
    removeTagFromEmoji,
    setEmojiTags,
    addTagToMultipleEmojis,
    removeTagFromMultipleEmojis,
    getEmojiTags,
    findEmojisByTag,

    // Filtering
    setSelectedTags,
    toggleTagFilter,
    clearTagFilters,

    // Computed
    allTags,
    tagUsageCounts
  }
}

export type TagStore = ReturnType<typeof useTagStore>
