import type { EmojiGroup, AppSettings } from '../types/emoji';
import { defaultEmojiGroups, defaultSettings } from '../types/emoji';

// --- Constants ---
export const STORAGE_KEYS = {
  GROUPS: 'emojiGroups',
  SETTINGS: 'appSettings',
  FAVORITES: 'favorites',
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
 * Listens for changes in chrome.storage.local.
 * @param callback - A function to be called with the changes object.
 */
export function onStorageChange(callback: (changes: { [key: string]: chrome.storage.StorageChange }) => void) {
  const chromeAPI = getChromeAPI();
  if (chromeAPI?.storage?.onChanged) {
    chromeAPI.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local') {
        callback(changes);
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
    return setStorageData({ [STORAGE_KEYS.GROUPS]: groups });
  },

  async getSettings(): Promise<AppSettings> {
    const data = await getStorageData({ [STORAGE_KEYS.SETTINGS]: defaultSettings });
    return data[STORAGE_KEYS.SETTINGS];
  },

  async setSettings(settings: AppSettings): Promise<void> {
    return setStorageData({ [STORAGE_KEYS.SETTINGS]: settings });
  },

  async getFavorites(): Promise<string[]> {
    const data = await getStorageData({ [STORAGE_KEYS.FAVORITES]: [] });
    return data[STORAGE_KEYS.FAVORITES];
  },

  async setFavorites(favorites: string[]): Promise<void> {
    return setStorageData({ [STORAGE_KEYS.FAVORITES]: favorites });
  },

  async resetToDefaults(): Promise<void> {
    return setStorageData({
      [STORAGE_KEYS.GROUPS]: defaultEmojiGroups,
      [STORAGE_KEYS.SETTINGS]: defaultSettings,
      [STORAGE_KEYS.FAVORITES]: [],
    });
  },
};

// Default export for convenience if needed elsewhere
export default storageHelpers;