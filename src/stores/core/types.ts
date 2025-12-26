/**
 * Shared types for store modules
 */

import type { EmojiGroup, Emoji, AppSettings } from '@/types/type'

// Re-export for convenience
export type { EmojiGroup, Emoji, AppSettings }

/**
 * Core state that is shared across multiple stores
 */
export interface CoreState {
  groups: EmojiGroup[]
  settings: AppSettings
  favorites: Set<string>
  isLoading: boolean
  isSaving: boolean
  hasLoadedOnce: boolean
}

/**
 * Save control interface for batching operations
 */
export interface SaveControl {
  beginBatch: () => void
  endBatch: () => Promise<void>
  maybeSave: () => void
  saveData: () => Promise<void>
  // Optional tag count callbacks for incremental updates
  onTagsAdded?: (tags: string[] | undefined) => void
  onTagsRemoved?: (tags: string[] | undefined) => void
  invalidateTagCache?: () => void
  // Optional search index callbacks for incremental updates
  onEmojiAdded?: (emoji: Emoji) => void
  onEmojiRemoved?: (emoji: Emoji) => void
  onEmojiUpdated?: (oldEmoji: Emoji, newEmoji: Emoji) => void
  invalidateSearchIndex?: () => void
  // Dirty tracking callbacks for incremental saves
  markGroupDirty?: (groupId: string) => void
  markSettingsDirty?: () => void
  markFavoritesDirty?: () => void
  markGroupDeleted?: (groupId: string) => void
}

/**
 * Progress callback for long-running operations
 */
export interface ProgressCallback {
  (progress: { current: number; total: number; action: string; message?: string }): void
}

/**
 * Duplicate detection result
 */
export interface DuplicateGroup {
  emoji: Emoji
  groupId: string
  groupName: string
}
