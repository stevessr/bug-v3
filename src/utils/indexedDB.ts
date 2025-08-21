// IndexedDB utility for emoji extension
import type { EmojiGroup, AppSettings } from '../types/emoji';

const DB_NAME = 'EmojiExtensionDB';
const DB_VERSION = 1;

// Store names
const STORES = {
  GROUPS: 'groups',
  SETTINGS: 'settings',
  FAVORITES: 'favorites',
} as const;

// Logging helper
function logDB(operation: string, store: string, key?: string, data?: any, error?: any) {
  const timestamp = new Date().toISOString();
  const logPrefix = `[IndexedDB ${timestamp}]`;
  
  if (error) {
    console.error(`${logPrefix} ${operation} FAILED in "${store}"${key ? ` for key "${key}"` : ''}:`, error);
  } else {
    console.log(`${logPrefix} ${operation} in "${store}"${key ? ` for key "${key}"` : ''}`, data ? `(${typeof data === 'object' ? JSON.stringify(data).length : data} chars)` : '');
  }
}

// Database connection management
let dbInstance: IDBDatabase | null = null;

async function getDB(): Promise<IDBDatabase> {
  if (dbInstance) {
    return dbInstance;
  }

  return new Promise((resolve, reject) => {
    logDB('OPEN', 'database');
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      const error = request.error;
      logDB('OPEN', 'database', undefined, undefined, error);
      reject(error);
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      logDB('OPEN', 'database', undefined, 'success');
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      logDB('UPGRADE', 'database', undefined, `version ${event.newVersion}`);
      const db = request.result;

      // Create object stores
      if (!db.objectStoreNames.contains(STORES.GROUPS)) {
        const groupStore = db.createObjectStore(STORES.GROUPS, { keyPath: 'id' });
        groupStore.createIndex('order', 'order', { unique: false });
        logDB('CREATE_STORE', STORES.GROUPS);
      }

      if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
        db.createObjectStore(STORES.SETTINGS, { keyPath: 'id' });
        logDB('CREATE_STORE', STORES.SETTINGS);
      }

      if (!db.objectStoreNames.contains(STORES.FAVORITES)) {
        db.createObjectStore(STORES.FAVORITES, { keyPath: 'id' });
        logDB('CREATE_STORE', STORES.FAVORITES);
      }
    };
  });
}

// Generic IndexedDB operations
async function getValue<T>(storeName: string, key: string): Promise<T | undefined> {
  try {
    const db = await getDB();
    const transaction = db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    
    return new Promise((resolve, reject) => {
      const request = store.get(key);
      
      request.onsuccess = () => {
        const result = request.result?.value;
        logDB('GET', storeName, key, result);
        resolve(result);
      };
      
      request.onerror = () => {
        logDB('GET', storeName, key, undefined, request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    logDB('GET', storeName, key, undefined, error);
    return undefined;
  }
}

async function setValue<T>(storeName: string, key: string, value: T): Promise<void> {
  try {
    const db = await getDB();
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    
    return new Promise((resolve, reject) => {
      const request = store.put({ id: key, value });
      
      request.onsuccess = () => {
        logDB('PUT', storeName, key, value);
        resolve();
      };
      
      request.onerror = () => {
        logDB('PUT', storeName, key, undefined, request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    logDB('PUT', storeName, key, undefined, error);
    throw error;
  }
}

async function deleteValue(storeName: string, key: string): Promise<void> {
  try {
    const db = await getDB();
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    
    return new Promise((resolve, reject) => {
      const request = store.delete(key);
      
      request.onsuccess = () => {
        logDB('DELETE', storeName, key);
        resolve();
      };
      
      request.onerror = () => {
        logDB('DELETE', storeName, key, undefined, request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    logDB('DELETE', storeName, key, undefined, error);
    throw error;
  }
}

async function getAllValues<T>(storeName: string): Promise<T[]> {
  try {
    const db = await getDB();
    const transaction = db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      
      request.onsuccess = () => {
        const results = request.result.map((item: any) => item.value);
        logDB('GET_ALL', storeName, undefined, results);
        resolve(results);
      };
      
      request.onerror = () => {
        logDB('GET_ALL', storeName, undefined, undefined, request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    logDB('GET_ALL', storeName, undefined, undefined, error);
    return [];
  }
}

async function clearStore(storeName: string): Promise<void> {
  try {
    const db = await getDB();
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    
    return new Promise((resolve, reject) => {
      const request = store.clear();
      
      request.onsuccess = () => {
        logDB('CLEAR', storeName);
        resolve();
      };
      
      request.onerror = () => {
        logDB('CLEAR', storeName, undefined, undefined, request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    logDB('CLEAR', storeName, undefined, undefined, error);
    throw error;
  }
}

// Exported helpers for emoji extension
export const indexedDBHelpers = {
  // Groups
  async getGroup(groupId: string): Promise<EmojiGroup | undefined> {
    return getValue<EmojiGroup>(STORES.GROUPS, groupId);
  },

  async setGroup(group: EmojiGroup): Promise<void> {
    return setValue(STORES.GROUPS, group.id, group);
  },

  async getAllGroups(): Promise<EmojiGroup[]> {
    const groups = await getAllValues<EmojiGroup>(STORES.GROUPS);
    return groups.sort((a, b) => a.order - b.order);
  },

  async deleteGroup(groupId: string): Promise<void> {
    return deleteValue(STORES.GROUPS, groupId);
  },

  async setAllGroups(groups: EmojiGroup[]): Promise<void> {
    // Clear existing groups and set new ones
    await clearStore(STORES.GROUPS);
    
    for (const group of groups) {
      await setValue(STORES.GROUPS, group.id, group);
    }
  },

  // Settings
  async getSettings(): Promise<AppSettings | undefined> {
    return getValue<AppSettings>(STORES.SETTINGS, 'app');
  },

  async setSettings(settings: AppSettings): Promise<void> {
    return setValue(STORES.SETTINGS, 'app', settings);
  },

  // Favorites
  async getFavorites(): Promise<string[]> {
    const favorites = await getValue<string[]>(STORES.FAVORITES, 'list');
    return favorites || [];
  },

  async setFavorites(favorites: string[]): Promise<void> {
    return setValue(STORES.FAVORITES, 'list', favorites);
  },

  // Utility methods
  async clearAll(): Promise<void> {
    await Promise.all([
      clearStore(STORES.GROUPS),
      clearStore(STORES.SETTINGS),
      clearStore(STORES.FAVORITES),
    ]);
  },

  async isAvailable(): Promise<boolean> {
    try {
      await getDB();
      return true;
    } catch {
      return false;
    }
  }
};

export default indexedDBHelpers;