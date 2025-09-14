// Minimal shim that replaces the full IndexedDB implementation.
// The project previously had a large IndexedDB helper with buffering and flushing.
// To fully remove IndexedDB behavior while keeping callers compiling, we export
// a small no-op compatible interface: `indexedDBHelpers` and `flushBuffer`.

import type { EmojiGroup, AppSettings } from '../types/emoji'

// No-op flushBuffer for compatibility
export async function flushBuffer(_force = false): Promise<void> {
  // Intentionally empty - IndexedDB functionality removed
  return
}

export const indexedDBHelpers = {
  async getGroup(_groupId: string): Promise<EmojiGroup | undefined> {
    return undefined
  },
  async setGroup(_group: EmojiGroup): Promise<void> {
    return
  },
  async getAllGroups(): Promise<EmojiGroup[]> {
    return []
  },
  async deleteGroup(_groupId: string): Promise<void> {
    return
  },
  async setAllGroups(_groups: EmojiGroup[]): Promise<void> {
    return
  },
  async getSettings(): Promise<AppSettings | undefined> {
    return undefined
  },
  async setSettings(_settings: AppSettings): Promise<void> {
    return
  },
  async getFavorites(): Promise<string[]> {
    return []
  },
  async setFavorites(_favorites: string[]): Promise<void> {
    return
  },
  async clearAll(): Promise<void> {
    return
  },
  async isAvailable(): Promise<boolean> {
    return false
  }
}

export default indexedDBHelpers
