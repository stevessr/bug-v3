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

  // Helper to format a safe preview of the data (avoid huge dumps or circular refs)
  function formatPreview(d: any) {
    try {
      const s = JSON.stringify(d);
      const size = s.length;
      if (size > 2000) {
        return { preview: s.slice(0, 500) + '... (truncated)', size };
      }
      return { preview: JSON.parse(s), size };
    } catch (e) {
      try {
        // Fallback to toString
        return { preview: String(d) };
      } catch {
        return { preview: '[unserializable data]' };
      }
    }
  }

  if (error) {
    console.error(`${logPrefix} ${operation} FAILED in "${store}"${key ? ` for key "${key}"` : ''}:`, error);
  } else {
    if (typeof data !== 'undefined') {
      const p = formatPreview(data as any);
      // Print structured output: summary and preview
      console.log(`${logPrefix} ${operation} in "${store}"${key ? ` for key "${key}"` : ''} - size: ${p.size ?? 'unknown'}`, p.preview);
    } else {
      console.log(`${logPrefix} ${operation} in "${store}"${key ? ` for key "${key}"` : ''}`);
    }
  }
}

// Database connection management
let dbInstance: IDBDatabase | null = null;

// --- In-memory buffer between app and IndexedDB ---
const bufferState = {
  groups: new Map<string, any>(),
  settings: undefined as any,
  favorites: undefined as string[] | undefined,
  dirty: {
    groups: false,
    settings: false,
    favorites: false
  }
};

let flushTimer: any = null;
const FLUSH_DEBOUNCE_MS = 1500; // buffer debounce before flushing to IDB

function scheduleFlush() {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => void flushBuffer(false), FLUSH_DEBOUNCE_MS);
}

async function flushBuffer(force = false) {
  try {
    // If nothing dirty and not forced, skip
    if (!force && !bufferState.dirty.groups && !bufferState.dirty.settings && !bufferState.dirty.favorites) {
      logDB('FLUSH_SKIP', 'buffer', undefined, { reason: 'no changes' });
      return;
    }

    const db = await getDB();

    // Flush groups
    if (bufferState.dirty.groups || force) {
      const tx = db.transaction([STORES.GROUPS], 'readwrite');
      const store = tx.objectStore(STORES.GROUPS);

      // Clear then put all buffered groups to ensure consistency
      const clearReq = store.clear();
      await new Promise<void>((resolve, reject) => {
        clearReq.onsuccess = () => resolve();
        clearReq.onerror = () => reject(clearReq.error);
      });

      for (const [id, value] of bufferState.groups.entries()) {
        // Clean the data before storing in IndexedDB
        const cleanedValue = cleanDataForStorage(value);
        const req = store.put({ id, value: cleanedValue });
        await new Promise<void>((resolve, reject) => {
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        });
      }

      bufferState.dirty.groups = false;
      logDB('FLUSH', STORES.GROUPS, undefined, { count: bufferState.groups.size });
    }

    // Flush settings
    if (bufferState.dirty.settings || force) {
      const tx = db.transaction([STORES.SETTINGS], 'readwrite');
      const store = tx.objectStore(STORES.SETTINGS);
      const cleanedSettings = cleanDataForStorage(bufferState.settings);
      const req = store.put({ id: 'app', value: cleanedSettings });
      await new Promise<void>((resolve, reject) => {
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
      bufferState.dirty.settings = false;
      logDB('FLUSH', STORES.SETTINGS, 'app', cleanedSettings);
    }

    // Flush favorites
    if (bufferState.dirty.favorites || force) {
      const tx = db.transaction([STORES.FAVORITES], 'readwrite');
      const store = tx.objectStore(STORES.FAVORITES);
      const cleanedFavorites = cleanDataForStorage(bufferState.favorites || []);
      const req = store.put({ id: 'list', value: cleanedFavorites });
      await new Promise<void>((resolve, reject) => {
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
      bufferState.dirty.favorites = false;
      logDB('FLUSH', STORES.FAVORITES, 'list', cleanedFavorites);
    }
  } catch (error) {
    logDB('FLUSH', 'buffer', undefined, undefined, error);
    throw error;
  }
}

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
    // If groups are buffered, return from buffer first
    if (storeName === STORES.GROUPS) {
      if (bufferState.groups.has(key)) {
        const v = bufferState.groups.get(key);
        logDB('GET_BUFFER', storeName, key, v);
        return v as T;
      }
    }

    if (storeName === STORES.SETTINGS && key === 'app' && typeof bufferState.settings !== 'undefined') {
      logDB('GET_BUFFER', storeName, key, bufferState.settings);
      return bufferState.settings as T;
    }

    if (storeName === STORES.FAVORITES && key === 'list' && typeof bufferState.favorites !== 'undefined') {
      logDB('GET_BUFFER', storeName, key, bufferState.favorites);
      return bufferState.favorites as T;
    }

    const db = await getDB();
    const transaction = db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);

    return new Promise((resolve, reject) => {
      const request = store.get(key);

      request.onsuccess = () => {
        const result = request.result?.value;
        
        // Populate buffer with fetched data for future reads
        if (storeName === STORES.GROUPS && result) {
          bufferState.groups.set(key, result);
        } else if (storeName === STORES.SETTINGS && key === 'app' && result) {
          bufferState.settings = result;
        } else if (storeName === STORES.FAVORITES && key === 'list' && result) {
          bufferState.favorites = result;
        }
        
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

// Helper function to clean data for IndexedDB storage
function cleanDataForStorage<T>(data: T): T {
  try {
    // Deep clone and clean the data to ensure it's serializable
    return JSON.parse(JSON.stringify(data));
  } catch (error) {
    logDB('CLEAN_DATA', 'failed', undefined, error);
    // Fallback: try to extract only basic properties
    if (typeof data === 'object' && data !== null) {
      const cleaned: any = {};
      for (const [key, value] of Object.entries(data)) {
        try {
          JSON.stringify(value);
          cleaned[key] = value;
        } catch {
          // Skip unserializable properties
          logDB('CLEAN_DATA', `skipped property: ${key}`, undefined, 'unserializable');
        }
      }
      return cleaned as T;
    }
    return data;
  }
}

async function setValue<T>(storeName: string, key: string, value: T): Promise<void> {
  try {
    // Clean the data to ensure it's serializable for IndexedDB
    const cleanedValue = cleanDataForStorage(value);
    
    // Write to buffer first for groups/settings/favorites
    if (storeName === STORES.GROUPS) {
      bufferState.groups.set(key, cleanedValue);
      bufferState.dirty.groups = true;
      scheduleFlush();
      logDB('PUT_BUFFER', storeName, key, cleanedValue);
      return;
    }

    if (storeName === STORES.SETTINGS) {
      bufferState.settings = cleanedValue;
      bufferState.dirty.settings = true;
      scheduleFlush();
      logDB('PUT_BUFFER', storeName, key, cleanedValue);
      return;
    }

    if (storeName === STORES.FAVORITES) {
      bufferState.favorites = cleanedValue as any;
      bufferState.dirty.favorites = true;
      scheduleFlush();
      logDB('PUT_BUFFER', storeName, key, cleanedValue);
      return;
    }

    const db = await getDB();
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);

    return new Promise((resolve, reject) => {
      const request = store.put({ id: key, value: cleanedValue });

      request.onsuccess = () => {
        logDB('PUT', storeName, key, cleanedValue);
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
    // If buffered, remove from buffer and mark dirty
    if (storeName === STORES.GROUPS) {
      bufferState.groups.delete(key);
      bufferState.dirty.groups = true;
      scheduleFlush();
      logDB('DELETE_BUFFER', storeName, key);
      return;
    }

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
    // For groups: if buffer has data, use buffer; otherwise fetch from DB
    if (storeName === STORES.GROUPS) {
      if (bufferState.groups.size > 0) {
        const local = Array.from(bufferState.groups.values());
        logDB('GET_ALL_BUFFER', storeName, undefined, { count: local.length });
        return local as T[];
      }
      // Buffer empty, fetch from DB and populate buffer
      const db = await getDB();
      const transaction = db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);

      return new Promise((resolve, reject) => {
        const request = store.getAll();

        request.onsuccess = () => {
          const results = request.result.map((item: any) => item.value);
          // Populate buffer with DB data for future reads
          bufferState.groups.clear();
          request.result.forEach((item: any) => {
            bufferState.groups.set(item.id, item.value);
          });
          logDB('GET_ALL_DB', storeName, undefined, results);
          resolve(results);
        };

        request.onerror = () => {
          logDB('GET_ALL', storeName, undefined, undefined, request.error);
          reject(request.error);
        };
      });
    }

    if (storeName === STORES.SETTINGS && typeof bufferState.settings !== 'undefined') {
      logDB('GET_ALL_BUFFER', storeName, undefined, bufferState.settings);
      return [bufferState.settings] as unknown as T[];
    }

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
    // Clear buffer if applicable
    if (storeName === STORES.GROUPS) {
      bufferState.groups.clear();
      bufferState.dirty.groups = true;
      logDB('CLEAR_BUFFER', storeName);
    }

    if (storeName === STORES.SETTINGS) {
      bufferState.settings = undefined;
      bufferState.dirty.settings = true;
    }

    if (storeName === STORES.FAVORITES) {
      bufferState.favorites = undefined;
      bufferState.dirty.favorites = true;
    }

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

// Export buffer control for other modules
export { flushBuffer };

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
    
    // Update buffer first
    bufferState.groups.clear();
    for (const group of groups) {
      bufferState.groups.set(group.id, group);
      await setValue(STORES.GROUPS, group.id, group);
    }
    bufferState.dirty.groups = true;
    // Force immediate flush since this is a bulk operation
    await flushBuffer(true);
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