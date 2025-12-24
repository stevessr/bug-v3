/**
 * Store Modules Index
 * Re-exports all sub-stores for easy importing
 */

// Core types
export * from './core/types'

// Sub-stores
export { useGroupStore, type GroupStore, type GroupStoreOptions } from './groupStore'
export {
  useEmojiCrudStore,
  type EmojiCrudStore,
  type EmojiCrudStoreOptions
} from './emojiCrudStore'
export {
  useFavoritesStore,
  type FavoritesStore,
  type FavoritesStoreOptions
} from './favoritesStore'
export { useTagStore, type TagStore, type TagStoreOptions } from './tagStore'
export { useSyncStore, type SyncStore, type SyncStoreOptions, type SyncResult } from './syncStore'
export { useCssStore, type CssStore, type CssStoreOptions } from './cssStore'

// Main store (still the primary entry point for components)
export { useEmojiStore } from './emojiStore'
