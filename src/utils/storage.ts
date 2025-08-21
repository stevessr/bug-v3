import type { EmojiGroup, AppSettings } from '../types/emoji';
import { defaultEmojiGroups, defaultSettings } from '../types/emoji';
import { indexedDBHelpers } from './indexedDB';

// --- Constants ---
export const STORAGE_KEYS = {
  GROUPS: 'emojiGroups',
  SETTINGS: 'appSettings',
  FAVORITES: 'favorites',
  GROUP_PREFIX: 'emojiGroup_', // For individual group storage
  GROUP_INDEX: 'emojiGroupIndex', // For group order and metadata
} as const;

export const SYNC_STORAGE_KEYS = {
  BACKUP: 'emojiExtensionBackup',
} as const;

// --- Chrome API Helper ---
function getChromeAPI() {
  if (typeof chrome !== 'undefined' && chrome.storage) {
    return chrome;
  }
  // Fallback for environments where `chrome` is not immediately available
  if (typeof window !== 'undefined' && (window as any).chrome) {
    return (window as any).chrome;
  }
  if (typeof globalThis !== 'undefined' && (globalThis as any).chrome) {
    return (globalThis as any).chrome;
  }
  return null;
}

// --- Logging Helper ---
function logStorage(operation: string, key: string, data?: any, error?: any) {
  const timestamp = new Date().toISOString();
  const logPrefix = `[Storage ${timestamp}]`;
  
  if (error) {
    console.error(`${logPrefix} ${operation} FAILED for "${key}":`, error);
  } else {
    console.log(`${logPrefix} ${operation} for "${key}"`, data ? `(${typeof data === 'object' ? JSON.stringify(data).length : data} chars)` : '');
  }
}

// --- Core Storage Functions ---

/**
 * Retrieves data from chrome.storage.local.
 * @param keys - A single key or an array of keys to retrieve.
 * @returns A promise that resolves with an object containing the retrieved key-value pairs.
 */
export async function getStorageData(keys: string | string[] | { [key: string]: any }): Promise<{ [key: string]: any }> {
  const chromeAPI = getChromeAPI();
  if (!chromeAPI?.storage?.local) {
    const error = 'Chrome Storage API is not available.';
    logStorage('GET', typeof keys === 'string' ? keys : 'multiple', undefined, error);
    return {};
  }
  
  return new Promise((resolve, reject) => {
    try {
      chromeAPI.storage.local.get(keys, (result) => {
        if (chromeAPI.runtime.lastError) {
          logStorage('GET', typeof keys === 'string' ? keys : 'multiple', undefined, chromeAPI.runtime.lastError);
          return reject(chromeAPI.runtime.lastError);
        }
        logStorage('GET', typeof keys === 'string' ? keys : 'multiple', result);
        resolve(result);
      });
    } catch (error) {
      logStorage('GET', typeof keys === 'string' ? keys : 'multiple', undefined, error);
      reject(error);
    }
  });
}

/**
 * Saves data to chrome.storage.local.
 * @param data - An object containing key-value pairs to save.
 * @returns A promise that resolves when the data is saved.
 */
export async function setStorageData(data: { [key: string]: any }): Promise<void> {
  const chromeAPI = getChromeAPI();
  if (!chromeAPI?.storage?.local) {
    const error = 'Chrome Storage API is not available.';
    logStorage('SET', Object.keys(data).join(', '), undefined, error);
    return;
  }
  
  return new Promise((resolve, reject) => {
    try {
      chromeAPI.storage.local.set(data, () => {
        if (chromeAPI.runtime.lastError) {
          logStorage('SET', Object.keys(data).join(', '), undefined, chromeAPI.runtime.lastError);
          return reject(chromeAPI.runtime.lastError);
        }
        logStorage('SET', Object.keys(data).join(', '), data);
        resolve();
      });
    } catch (error) {
      logStorage('SET', Object.keys(data).join(', '), undefined, error);
      reject(error);
    }
  });
}

/**
 * Saves data to chrome.storage.sync.
 * @param data - An object containing key-value pairs to save.
 * @returns A promise that resolves when the data is saved.
 */
export async function setSyncStorageData(data: { [key: string]: any }): Promise<void> {
  const chromeAPI = getChromeAPI();
  if (!chromeAPI?.storage?.sync) {
    const error = 'Chrome Sync Storage API is not available.';
    logStorage('SYNC_SET', Object.keys(data).join(', '), undefined, error);
    return;
  }
  
  return new Promise((resolve, reject) => {
    try {
      chromeAPI.storage.sync.set(data, () => {
        if (chromeAPI.runtime.lastError) {
          logStorage('SYNC_SET', Object.keys(data).join(', '), undefined, chromeAPI.runtime.lastError);
          return reject(chromeAPI.runtime.lastError);
        }
        logStorage('SYNC_SET', Object.keys(data).join(', '), data);
        resolve();
      });
    } catch (error) {
      logStorage('SYNC_SET', Object.keys(data).join(', '), undefined, error);
      reject(error);
    }
  });
}

/**
 * Retrieves data from chrome.storage.sync.
 * @param keys - A single key or an array of keys to retrieve.
 * @returns A promise that resolves with an object containing the retrieved key-value pairs.
 */
export async function getSyncStorageData(keys: string | string[] | { [key: string]: any }): Promise<{ [key: string]: any }> {
  const chromeAPI = getChromeAPI();
  if (!chromeAPI?.storage?.sync) {
    const error = 'Chrome Sync Storage API is not available.';
    logStorage('SYNC_GET', typeof keys === 'string' ? keys : 'multiple', undefined, error);
    return {};
  }
  
  return new Promise((resolve, reject) => {
    try {
      chromeAPI.storage.sync.get(keys, (result: any) => {
        if (chromeAPI.runtime.lastError) {
          logStorage('SYNC_GET', typeof keys === 'string' ? keys : 'multiple', undefined, chromeAPI.runtime.lastError);
          return reject(chromeAPI.runtime.lastError);
        }
        logStorage('SYNC_GET', typeof keys === 'string' ? keys : 'multiple', result);
        resolve(result);
      });
    } catch (error) {
      logStorage('SYNC_GET', typeof keys === 'string' ? keys : 'multiple', undefined, error);
      reject(error);
    }
  });
}

/**
 * Listens for changes in chrome.storage.local and sync.
 * @param callback - A function to be called with the changes object.
 */
export function onStorageChange(callback: (changes: { [key: string]: any }, areaName: string) => void) {
  const chromeAPI = getChromeAPI();
  if (chromeAPI?.storage?.onChanged) {
    chromeAPI.storage.onChanged.addListener((changes: any, areaName: string) => {
      if (areaName === 'local' || areaName === 'sync') {
        callback(changes, areaName);
      }
    });
  }
}

// --- Typed Helper Functions ---

// Debouncing for sync operations to prevent continuous writes
let syncDebounceTimer: NodeJS.Timeout | null = null;
const SYNC_DEBOUNCE_DELAY = 2000; // 2 seconds

function debouncedSync(fn: () => Promise<void>) {
  if (syncDebounceTimer) {
    clearTimeout(syncDebounceTimer);
  }
  
  syncDebounceTimer = setTimeout(async () => {
    try {
      await fn();
    } catch (error) {
      console.error('[Storage] Debounced sync failed:', error);
    }
  }, SYNC_DEBOUNCE_DELAY);
}

export const storageHelpers = {
  async getGroups(): Promise<EmojiGroup[]> {
    logStorage('READ_GROUPS', 'start');
    
    // Try IndexedDB first
    try {
      const isIndexedDBAvailable = await indexedDBHelpers.isAvailable();
      if (isIndexedDBAvailable) {
        const groups = await indexedDBHelpers.getAllGroups();
        if (groups && groups.length > 0) {
          logStorage('READ_GROUPS', 'IndexedDB', groups);
          return groups;
        }
      }
    } catch (error) {
      logStorage('READ_GROUPS', 'IndexedDB', undefined, error);
    }
    
    // Fallback to Chrome storage
    try {
      const data = await getStorageData({ [STORAGE_KEYS.GROUPS]: defaultEmojiGroups });
      const groups = data[STORAGE_KEYS.GROUPS];
      logStorage('READ_GROUPS', 'Chrome storage fallback', groups);
      return groups;
    } catch (error) {
      logStorage('READ_GROUPS', 'Chrome storage fallback', undefined, error);
      return defaultEmojiGroups;
    }
  },

  async setGroups(groups: EmojiGroup[]): Promise<void> {
    logStorage('WRITE_GROUPS', 'start', groups);
    
    try {
      // Primary: Save to IndexedDB
      const isIndexedDBAvailable = await indexedDBHelpers.isAvailable();
      if (isIndexedDBAvailable) {
        await indexedDBHelpers.setAllGroups(groups);
        logStorage('WRITE_GROUPS', 'IndexedDB success');
      }
      
      // Secondary: Save to Chrome storage for content script access
      await setStorageData({ [STORAGE_KEYS.GROUPS]: groups });
      logStorage('WRITE_GROUPS', 'Chrome storage success');
      
      // Debounced sync to prevent continuous writes
      debouncedSync(async () => {
        const settings = await this.getSettings();
        const favorites = await this.getFavorites();
        await this.backupToSync(groups, settings, favorites);
      });
      
    } catch (error) {
      logStorage('WRITE_GROUPS', 'failed', undefined, error);
      throw error;
    }
  },

  async getSettings(): Promise<AppSettings> {
    logStorage('READ_SETTINGS', 'start');
    
    // Try IndexedDB first
    try {
      const isIndexedDBAvailable = await indexedDBHelpers.isAvailable();
      if (isIndexedDBAvailable) {
        const settings = await indexedDBHelpers.getSettings();
        if (settings) {
          logStorage('READ_SETTINGS', 'IndexedDB', settings);
          return settings;
        }
      }
    } catch (error) {
      logStorage('READ_SETTINGS', 'IndexedDB', undefined, error);
    }
    
    // Fallback to Chrome storage
    try {
      const data = await getStorageData({ [STORAGE_KEYS.SETTINGS]: defaultSettings });
      const settings = data[STORAGE_KEYS.SETTINGS];
      logStorage('READ_SETTINGS', 'Chrome storage fallback', settings);
      return settings;
    } catch (error) {
      logStorage('READ_SETTINGS', 'Chrome storage fallback', undefined, error);
      return defaultSettings;
    }
  },

  async setSettings(settings: AppSettings): Promise<void> {
    logStorage('WRITE_SETTINGS', 'start', settings);
    
    try {
      // Primary: Save to IndexedDB
      const isIndexedDBAvailable = await indexedDBHelpers.isAvailable();
      if (isIndexedDBAvailable) {
        await indexedDBHelpers.setSettings(settings);
        logStorage('WRITE_SETTINGS', 'IndexedDB success');
      }
      
      // Secondary: Save to Chrome storage for content script access
      await setStorageData({ [STORAGE_KEYS.SETTINGS]: settings });
      logStorage('WRITE_SETTINGS', 'Chrome storage success');
      
      // Debounced sync to prevent continuous writes
      debouncedSync(async () => {
        const groups = await this.getGroups();
        const favorites = await this.getFavorites();
        await this.backupToSync(groups, settings, favorites);
      });
      
    } catch (error) {
      logStorage('WRITE_SETTINGS', 'failed', undefined, error);
      throw error;
    }
  },

  async getFavorites(): Promise<string[]> {
    logStorage('READ_FAVORITES', 'start');
    
    // Try IndexedDB first
    try {
      const isIndexedDBAvailable = await indexedDBHelpers.isAvailable();
      if (isIndexedDBAvailable) {
        const favorites = await indexedDBHelpers.getFavorites();
        if (favorites) {
          logStorage('READ_FAVORITES', 'IndexedDB', favorites);
          return favorites;
        }
      }
    } catch (error) {
      logStorage('READ_FAVORITES', 'IndexedDB', undefined, error);
    }
    
    // Fallback to Chrome storage
    try {
      const data = await getStorageData({ [STORAGE_KEYS.FAVORITES]: [] });
      const favorites = data[STORAGE_KEYS.FAVORITES];
      logStorage('READ_FAVORITES', 'Chrome storage fallback', favorites);
      return favorites;
    } catch (error) {
      logStorage('READ_FAVORITES', 'Chrome storage fallback', undefined, error);
      return [];
    }
  },

  async setFavorites(favorites: string[]): Promise<void> {
    logStorage('WRITE_FAVORITES', 'start', favorites);
    
    try {
      // Primary: Save to IndexedDB
      const isIndexedDBAvailable = await indexedDBHelpers.isAvailable();
      if (isIndexedDBAvailable) {
        await indexedDBHelpers.setFavorites(favorites);
        logStorage('WRITE_FAVORITES', 'IndexedDB success');
      }
      
      // Secondary: Save to Chrome storage for content script access
      await setStorageData({ [STORAGE_KEYS.FAVORITES]: favorites });
      logStorage('WRITE_FAVORITES', 'Chrome storage success');
      
      // Debounced sync to prevent continuous writes
      debouncedSync(async () => {
        const groups = await this.getGroups();
        const settings = await this.getSettings();
        await this.backupToSync(groups, settings, favorites);
      });
      
    } catch (error) {
      logStorage('WRITE_FAVORITES', 'failed', undefined, error);
      throw error;
    }
  },

  // Individual setters without automatic sync (for internal use)
  async setGroupsOnly(groups: EmojiGroup[]): Promise<void> {
    logStorage('WRITE_GROUPS_ONLY', 'start', groups);
    
    try {
      // Primary: Save to IndexedDB
      const isIndexedDBAvailable = await indexedDBHelpers.isAvailable();
      if (isIndexedDBAvailable) {
        await indexedDBHelpers.setAllGroups(groups);
        logStorage('WRITE_GROUPS_ONLY', 'IndexedDB success');
      }
      
      // Secondary: Save to Chrome storage
      await setStorageData({ [STORAGE_KEYS.GROUPS]: groups });
      logStorage('WRITE_GROUPS_ONLY', 'Chrome storage success');
      
    } catch (error) {
      logStorage('WRITE_GROUPS_ONLY', 'failed', undefined, error);
      throw error;
    }
  },

  async setSettingsOnly(settings: AppSettings): Promise<void> {
    logStorage('WRITE_SETTINGS_ONLY', 'start', settings);
    
    try {
      // Primary: Save to IndexedDB
      const isIndexedDBAvailable = await indexedDBHelpers.isAvailable();
      if (isIndexedDBAvailable) {
        await indexedDBHelpers.setSettings(settings);
        logStorage('WRITE_SETTINGS_ONLY', 'IndexedDB success');
      }
      
      // Secondary: Save to Chrome storage
      await setStorageData({ [STORAGE_KEYS.SETTINGS]: settings });
      logStorage('WRITE_SETTINGS_ONLY', 'Chrome storage success');
      
    } catch (error) {
      logStorage('WRITE_SETTINGS_ONLY', 'failed', undefined, error);
      throw error;
    }
  },

  async setFavoritesOnly(favorites: string[]): Promise<void> {
    logStorage('WRITE_FAVORITES_ONLY', 'start', favorites);
    
    try {
      // Primary: Save to IndexedDB
      const isIndexedDBAvailable = await indexedDBHelpers.isAvailable();
      if (isIndexedDBAvailable) {
        await indexedDBHelpers.setFavorites(favorites);
        logStorage('WRITE_FAVORITES_ONLY', 'IndexedDB success');
      }
      
      // Secondary: Save to Chrome storage
      await setStorageData({ [STORAGE_KEYS.FAVORITES]: favorites });
      logStorage('WRITE_FAVORITES_ONLY', 'Chrome storage success');
      
    } catch (error) {
      logStorage('WRITE_FAVORITES_ONLY', 'failed', undefined, error);
      throw error;
    }
  },

  async resetToDefaults(): Promise<void> {
    logStorage('RESET_DEFAULTS', 'start');
    
    try {
      // Reset IndexedDB
      const isIndexedDBAvailable = await indexedDBHelpers.isAvailable();
      if (isIndexedDBAvailable) {
        await indexedDBHelpers.clearAll();
        await indexedDBHelpers.setAllGroups(defaultEmojiGroups);
        await indexedDBHelpers.setSettings(defaultSettings);
        await indexedDBHelpers.setFavorites([]);
        logStorage('RESET_DEFAULTS', 'IndexedDB success');
      }
      
      // Reset Chrome storage
      await setStorageData({
        [STORAGE_KEYS.GROUPS]: defaultEmojiGroups,
        [STORAGE_KEYS.SETTINGS]: defaultSettings,
        [STORAGE_KEYS.FAVORITES]: [],
      });
      logStorage('RESET_DEFAULTS', 'Chrome storage success');
      
      // Reset sync storage
      await this.backupToSync(defaultEmojiGroups, defaultSettings, []);
      
    } catch (error) {
      logStorage('RESET_DEFAULTS', 'failed', undefined, error);
      throw error;
    }
  },

  // 统一数据设置方法 - 不再直接调用 backupToSync 以防止连续写入
  async setAllData(groups: EmojiGroup[], settings: AppSettings, favorites: string[]): Promise<void> {
    logStorage('SET_ALL_DATA', 'start', { groups: groups.length, settings, favorites: favorites.length });
    
    try {
      // Primary: Save to IndexedDB
      const isIndexedDBAvailable = await indexedDBHelpers.isAvailable();
      if (isIndexedDBAvailable) {
        await indexedDBHelpers.setAllGroups(groups);
        await indexedDBHelpers.setSettings(settings);
        await indexedDBHelpers.setFavorites(favorites);
        logStorage('SET_ALL_DATA', 'IndexedDB success');
      }
      
      // Secondary: Save to Chrome storage
      await setStorageData({
        [STORAGE_KEYS.GROUPS]: groups,
        [STORAGE_KEYS.SETTINGS]: settings,
        [STORAGE_KEYS.FAVORITES]: favorites,
      });
      logStorage('SET_ALL_DATA', 'Chrome storage success');
      
      // Debounced sync to prevent continuous writes
      debouncedSync(async () => {
        await this.backupToSync(groups, settings, favorites);
      });
      
    } catch (error) {
      logStorage('SET_ALL_DATA', 'failed', undefined, error);
      throw error;
    }
  },

  // Sync storage helpers - 添加防止连续写入的逻辑
  async backupToSync(groups: EmojiGroup[], settings: AppSettings, favorites: string[]): Promise<void> {
    logStorage('BACKUP_TO_SYNC', 'start', { groups: groups.length, favorites: favorites.length });
    
    try {
      const backupData = {
        groups,
        settings,
        favorites,
        timestamp: Date.now(),
        version: '2.0'
      };
      await setSyncStorageData({ [SYNC_STORAGE_KEYS.BACKUP]: backupData });
      logStorage('BACKUP_TO_SYNC', 'success');
    } catch (error) {
      // 如果同步存储失败，不影响本地存储
      logStorage('BACKUP_TO_SYNC', 'failed', undefined, error);
    }
  },

  async restoreFromSync(): Promise<{ groups?: EmojiGroup[], settings?: AppSettings, favorites?: string[], timestamp?: number } | null> {
    logStorage('RESTORE_FROM_SYNC', 'start');
    
    try {
      const data = await getSyncStorageData({ [SYNC_STORAGE_KEYS.BACKUP]: null });
      const backup = data[SYNC_STORAGE_KEYS.BACKUP];
      if (backup && backup.groups) {
        logStorage('RESTORE_FROM_SYNC', 'found backup', backup);
        
        // Use individual setters to avoid triggering automatic sync
        await this.setGroupsOnly(backup.groups);
        await this.setSettingsOnly(backup.settings || defaultSettings);
        await this.setFavoritesOnly(backup.favorites || []);
        
        return {
          groups: backup.groups,
          settings: backup.settings || defaultSettings,
          favorites: backup.favorites || [],
          timestamp: backup.timestamp || 0
        };
      }
      logStorage('RESTORE_FROM_SYNC', 'no backup found');
      return null;
    } catch (error) {
      logStorage('RESTORE_FROM_SYNC', 'failed', undefined, error);
      return null;
    }
  },

  async getSyncBackup(): Promise<any> {
    logStorage('GET_SYNC_BACKUP', 'start');
    
    try {
      const data = await getSyncStorageData({ [SYNC_STORAGE_KEYS.BACKUP]: null });
      const backup = data[SYNC_STORAGE_KEYS.BACKUP];
      logStorage('GET_SYNC_BACKUP', backup ? 'found' : 'not found', backup);
      return backup;
    } catch (error) {
      logStorage('GET_SYNC_BACKUP', 'failed', undefined, error);
      return null;
    }
  },

  // 同步检查和修复方法 - 防止连续同步
  async syncCheck(): Promise<void> {
    logStorage('SYNC_CHECK', 'start');
    
    try {
      // 获取本地数据
      const [localGroups, localSettings, localFavorites] = await Promise.all([
        this.getGroups(),
        this.getSettings(),
        this.getFavorites()
      ]);
      logStorage('SYNC_CHECK', 'local data loaded', { 
        groups: localGroups.length, 
        lastModified: localSettings.lastModified 
      });
      
      const syncBackup = await this.getSyncBackup();
      
      if (syncBackup && syncBackup.timestamp) {
        const localTimestamp = localSettings.lastModified || 0;
        const syncTimestamp = syncBackup.timestamp || 0;
        
        logStorage('SYNC_CHECK', 'comparing timestamps', { local: localTimestamp, sync: syncTimestamp });
        
        // 如果同步数据更新，更新本地数据
        if (syncTimestamp > localTimestamp) {
          logStorage('SYNC_CHECK', 'updating local from sync');
          // Use individual setters to avoid triggering automatic sync
          await this.setGroupsOnly(syncBackup.groups || defaultEmojiGroups);
          await this.setSettingsOnly(syncBackup.settings ? { ...syncBackup.settings, lastModified: syncTimestamp } : defaultSettings);
          await this.setFavoritesOnly(syncBackup.favorites || []);
        } else if (localTimestamp > syncTimestamp) {
          // 如果本地数据更新，更新同步数据（使用防抖）
          logStorage('SYNC_CHECK', 'updating sync from local');
          debouncedSync(async () => {
            await this.backupToSync(localGroups, localSettings, localFavorites);
          });
        } else {
          logStorage('SYNC_CHECK', 'data in sync');
        }
      } else {
        // 如果没有同步数据，备份当前本地数据（使用防抖）
        logStorage('SYNC_CHECK', 'no sync data, backing up local');
        debouncedSync(async () => {
          await this.backupToSync(localGroups, localSettings, localFavorites);
        });
      }
    } catch (error) {
      logStorage('SYNC_CHECK', 'failed', undefined, error);
    }
  },

  // Enhanced group storage with individual keys for better performance
  async getGroupsSplit(): Promise<EmojiGroup[]> {
    logStorage('READ_GROUPS_SPLIT', 'start');
    
    try {
      // First try to get group index from Chrome storage
      const indexData = await getStorageData({ [STORAGE_KEYS.GROUP_INDEX]: null });
      const groupIndex = indexData[STORAGE_KEYS.GROUP_INDEX];
      
      if (groupIndex && Array.isArray(groupIndex)) {
        logStorage('READ_GROUPS_SPLIT', 'found group index', groupIndex);
        
        // Load each group individually
        const groupPromises = groupIndex.map(async (groupInfo: { id: string, order: number }) => {
          try {
            const groupData = await getStorageData({ [STORAGE_KEYS.GROUP_PREFIX + groupInfo.id]: null });
            const group = groupData[STORAGE_KEYS.GROUP_PREFIX + groupInfo.id];
            if (group) {
              return { ...group, order: groupInfo.order };
            }
          } catch (error) {
            logStorage('READ_GROUPS_SPLIT', `group ${groupInfo.id}`, undefined, error);
          }
          return null;
        });
        
        const groups = (await Promise.all(groupPromises))
          .filter(group => group !== null)
          .sort((a, b) => a.order - b.order);
        
        if (groups.length > 0) {
          logStorage('READ_GROUPS_SPLIT', 'split storage success', { count: groups.length });
          return groups;
        }
      }
    } catch (error) {
      logStorage('READ_GROUPS_SPLIT', 'split storage failed', undefined, error);
    }
    
    // Fallback to regular groups storage
    return this.getGroups();
  },

  async setGroupsSplit(groups: EmojiGroup[]): Promise<void> {
    logStorage('WRITE_GROUPS_SPLIT', 'start', { count: groups.length });
    
    try {
      // Create group index for order tracking
      const groupIndex = groups.map((group, index) => ({
        id: group.id,
        order: index
      }));
      
      // Save group index
      await setStorageData({ [STORAGE_KEYS.GROUP_INDEX]: groupIndex });
      
      // Save each group individually
      const savePromises = groups.map(async (group) => {
        const groupData = { [STORAGE_KEYS.GROUP_PREFIX + group.id]: group };
        return setStorageData(groupData);
      });
      
      await Promise.all(savePromises);
      
      // Also save to regular groups key for backward compatibility
      await setStorageData({ [STORAGE_KEYS.GROUPS]: groups });
      
      logStorage('WRITE_GROUPS_SPLIT', 'success', { count: groups.length });
      
      // Debounced sync
      debouncedSync(async () => {
        const settings = await this.getSettings();
        const favorites = await this.getFavorites();
        await this.backupToSync(groups, settings, favorites);
      });
      
    } catch (error) {
      logStorage('WRITE_GROUPS_SPLIT', 'failed', undefined, error);
      throw error;
    }
  },

  async deleteGroupSplit(groupId: string): Promise<void> {
    logStorage('DELETE_GROUP_SPLIT', groupId);
    
    try {
      // Remove individual group storage
      const chromeAPI = getChromeAPI();
      if (chromeAPI?.storage?.local) {
        chromeAPI.storage.local.remove([STORAGE_KEYS.GROUP_PREFIX + groupId]);
      }
      
      // Update group index
      const indexData = await getStorageData({ [STORAGE_KEYS.GROUP_INDEX]: [] });
      const groupIndex = indexData[STORAGE_KEYS.GROUP_INDEX].filter((info: any) => info.id !== groupId);
      await setStorageData({ [STORAGE_KEYS.GROUP_INDEX]: groupIndex });
      
      // Update regular groups storage for compatibility
      const groups = await this.getGroupsSplit();
      await setStorageData({ [STORAGE_KEYS.GROUPS]: groups });
      
      logStorage('DELETE_GROUP_SPLIT', 'success');
    } catch (error) {
      logStorage('DELETE_GROUP_SPLIT', 'failed', undefined, error);
      throw error;
    }
  }
};

// Default export for convenience if needed elsewhere
export default storageHelpers;