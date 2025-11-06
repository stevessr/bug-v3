import { cachedState } from '../../data/state'

// Removed ensureDefaultIfEmpty() - it was redundant since loadDataFromStorage()
// is already called in initializeEmojiFeature() before any injection happens.
// The function also had a bug where getDefaultEmojisAsync() was called without await.

export { cachedState }
