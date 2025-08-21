import type { EmojiGroup, AppSettings } from '../types/emoji';
import { defaultEmojiGroups, defaultSettings } from '../types/emoji';

// --- Constants ---
export const STORAGE_KEYS = {
  GROUPS: 'emojiGroups',
  SETTINGS: 'appSettings',
  FAVORITES: 'favorites',
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

// --- Core Storage Functions ---

/**
 * Retrieves data from chrome.storage.local.
 * @param keys - A single key or an array of keys to retrieve.
 * @returns A promise that resolves with an object containing the retrieved key-value pairs.
 */
export async function getStorageData(keys: string | string[] | { [key: string]: any }): Promise<{ [key: string]: any }> {
  const chromeAPI = getChromeAPI();
  if (!chromeAPI?.storage?.local) {
    console.warn('Chrome Storage API is not available.');
    return {};
  }
  return new Promise((resolve, reject) => {
    try {
      chromeAPI.storage.local.get(keys, (result) => {
        if (chromeAPI.runtime.lastError) {
          return reject(chromeAPI.runtime.lastError);
        }
        resolve(result);
      });
    } catch (error) {
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
    console.warn('Chrome Storage API is not available.');
    return;
  }
  return new Promise((resolve, reject) => {
    try {
      chromeAPI.storage.local.set(data, () => {
        if (chromeAPI.runtime.lastError) {
          return reject(chromeAPI.runtime.lastError);
        }
        resolve();
      });
    } catch (error) {
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
    console.warn('Chrome Sync Storage API is not available.');
    return;
  }
  return new Promise((resolve, reject) => {
    try {
      chromeAPI.storage.sync.set(data, () => {
        if (chromeAPI.runtime.lastError) {
          return reject(chromeAPI.runtime.lastError);
        }
        resolve();
      });
    } catch (error) {
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
    console.warn('Chrome Sync Storage API is not available.');
    return {};
  }
  return new Promise((resolve, reject) => {
    try {
      chromeAPI.storage.sync.get(keys, (result: any) => {
        if (chromeAPI.runtime.lastError) {
          return reject(chromeAPI.runtime.lastError);
        }
        resolve(result);
      });
    } catch (error) {
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

export const storageHelpers = {
  async getGroups(): Promise<EmojiGroup[]> {
    const data = await getStorageData({ [STORAGE_KEYS.GROUPS]: defaultEmojiGroups });
    return data[STORAGE_KEYS.GROUPS];
  },

  async setGroups(groups: EmojiGroup[]): Promise<void> {
    // 双重存储：本地存储和同步存储都更新
    await setStorageData({ [STORAGE_KEYS.GROUPS]: groups });
    // 同时备份到同步存储
    const settings = await this.getSettings();
    const favorites = await this.getFavorites();
    await this.backupToSync(groups, settings, favorites);
  },

  async getSettings(): Promise<AppSettings> {
    const data = await getStorageData({ [STORAGE_KEYS.SETTINGS]: defaultSettings });
    return data[STORAGE_KEYS.SETTINGS];
  },

  async setSettings(settings: AppSettings): Promise<void> {
    // 双重存储：本地存储和同步存储都更新
    await setStorageData({ [STORAGE_KEYS.SETTINGS]: settings });
    // 同时备份到同步存储
    const groups = await this.getGroups();
    const favorites = await this.getFavorites();
    await this.backupToSync(groups, settings, favorites);
  },

  async getFavorites(): Promise<string[]> {
    const data = await getStorageData({ [STORAGE_KEYS.FAVORITES]: [] });
    return data[STORAGE_KEYS.FAVORITES];
  },

  async setFavorites(favorites: string[]): Promise<void> {
    // 双重存储：本地存储和同步存储都更新
    await setStorageData({ [STORAGE_KEYS.FAVORITES]: favorites });
    // 同时备份到同步存储
    const groups = await this.getGroups();
    const settings = await this.getSettings();
    await this.backupToSync(groups, settings, favorites);
  },

  async resetToDefaults(): Promise<void> {
    // 重置时同时更新本地和同步存储
    await setStorageData({
      [STORAGE_KEYS.GROUPS]: defaultEmojiGroups,
      [STORAGE_KEYS.SETTINGS]: defaultSettings,
      [STORAGE_KEYS.FAVORITES]: [],
    });
    // 同时备份到同步存储
    await this.backupToSync(defaultEmojiGroups, defaultSettings, []);
  },

  // 统一数据设置方法
  async setAllData(groups: EmojiGroup[], settings: AppSettings, favorites: string[]): Promise<void> {
    // 同时更新本地存储和同步存储
    await Promise.all([
      setStorageData({
        [STORAGE_KEYS.GROUPS]: groups,
        [STORAGE_KEYS.SETTINGS]: settings,
        [STORAGE_KEYS.FAVORITES]: favorites,
      }),
      this.backupToSync(groups, settings, favorites)
    ]);
  },

  // Sync storage helpers
  async backupToSync(groups: EmojiGroup[], settings: AppSettings, favorites: string[]): Promise<void> {
    try {
      const backupData = {
        groups,
        settings,
        favorites,
        timestamp: Date.now(),
        version: '2.0'
      };
      await setSyncStorageData({ [SYNC_STORAGE_KEYS.BACKUP]: backupData });
    } catch (error) {
      // 如果同步存储失败，不影响本地存储
      console.warn('Failed to backup to sync storage:', error);
    }
  },

  async restoreFromSync(): Promise<{ groups?: EmojiGroup[], settings?: AppSettings, favorites?: string[], timestamp?: number } | null> {
    try {
      const data = await getSyncStorageData({ [SYNC_STORAGE_KEYS.BACKUP]: null });
      const backup = data[SYNC_STORAGE_KEYS.BACKUP];
      if (backup && backup.groups) {
        // 恢复时同时更新本地存储
        await setStorageData({
          [STORAGE_KEYS.GROUPS]: backup.groups,
          [STORAGE_KEYS.SETTINGS]: backup.settings || defaultSettings,
          [STORAGE_KEYS.FAVORITES]: backup.favorites || [],
        });
        
        return {
          groups: backup.groups,
          settings: backup.settings || defaultSettings,
          favorites: backup.favorites || [],
          timestamp: backup.timestamp || 0
        };
      }
      return null;
    } catch (error) {
      console.error('Failed to restore from sync:', error);
      return null;
    }
  },

  async getSyncBackup(): Promise<any> {
    try {
      const data = await getSyncStorageData({ [SYNC_STORAGE_KEYS.BACKUP]: null });
      return data[SYNC_STORAGE_KEYS.BACKUP];
    } catch (error) {
      console.error('Failed to get sync backup:', error);
      return null;
    }
  },

  // 同步检查和修复方法
  async syncCheck(): Promise<void> {
    try {
      // 获取本地和同步存储的数据
      const [localGroups, localSettings, localFavorites] = await Promise.all([
        this.getGroups(),
        this.getSettings(),
        this.getFavorites()
      ]);
      
      const syncBackup = await this.getSyncBackup();
      
      if (syncBackup && syncBackup.timestamp) {
        const localTimestamp = localSettings.lastModified || 0;
        const syncTimestamp = syncBackup.timestamp || 0;
        
        // 如果同步数据更新，更新本地数据
        if (syncTimestamp > localTimestamp) {
          await this.setAllData(
            syncBackup.groups || defaultEmojiGroups,
            syncBackup.settings ? { ...syncBackup.settings, lastModified: syncTimestamp } : defaultSettings,
            syncBackup.favorites || []
          );
        } else if (localTimestamp > syncTimestamp) {
          // 如果本地数据更新，更新同步数据
          await this.backupToSync(localGroups, localSettings, localFavorites);
        }
      } else {
        // 如果没有同步数据，备份当前本地数据
        await this.backupToSync(localGroups, localSettings, localFavorites);
      }
    } catch (error) {
      console.error('Sync check failed:', error);
    }
  }
};

// Default export for convenience if needed elsewhere
export default storageHelpers;