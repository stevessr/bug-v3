// Storage adapter for userscript environment using localStorage
import { getDefaultEmojis } from '../content/default';

export interface UserscriptStorage {
  emojiGroups: any[];
  settings: {
    imageScale: number;
    gridColumns: number;
    outputFormat: 'markdown' | 'html';
    forceMobileMode: boolean;
    defaultGroup: string;
    showSearchBar: boolean;
  };
}

const STORAGE_KEY = 'emoji_extension_userscript_data';
const SETTINGS_KEY = 'emoji_extension_userscript_settings';

export function loadDataFromLocalStorage(): UserscriptStorage {
  try {
    // Load emoji groups
    const groupsData = localStorage.getItem(STORAGE_KEY);
    let emojiGroups: any[] = [];
    
    if (groupsData) {
      try {
        const parsed = JSON.parse(groupsData);
        if (Array.isArray(parsed) && parsed.length > 0) {
          emojiGroups = parsed;
        }
      } catch (e) {
        console.warn('[Userscript] Failed to parse stored emoji groups:', e);
      }
    }
    
    // If no valid groups, use defaults
    if (emojiGroups.length === 0) {
      const defaultEmojis = getDefaultEmojis();
      emojiGroups = [{ 
        id: 'default', 
        name: '默认表情', 
        icon: '😀', 
        order: 0, 
        emojis: defaultEmojis 
      }];
    }

    // Load settings
    const settingsData = localStorage.getItem(SETTINGS_KEY);
    let settings = {
      imageScale: 30,
      gridColumns: 4,
      outputFormat: 'markdown' as const,
      forceMobileMode: false,
      defaultGroup: 'nachoneko',
      showSearchBar: true
    };

    if (settingsData) {
      try {
        const parsed = JSON.parse(settingsData);
        if (parsed && typeof parsed === 'object') {
          settings = { ...settings, ...parsed };
        }
      } catch (e) {
        console.warn('[Userscript] Failed to parse stored settings:', e);
      }
    }

    console.log('[Userscript] Loaded data from localStorage:', {
      groupsCount: emojiGroups.length,
      emojisCount: emojiGroups.reduce((acc, g) => acc + (g.emojis?.length || 0), 0),
      settings
    });

    return { emojiGroups, settings };
  } catch (error) {
    console.error('[Userscript] Failed to load from localStorage:', error);
    
    // Return defaults on error
    const defaultEmojis = getDefaultEmojis();
    return {
      emojiGroups: [{ 
        id: 'default', 
        name: '默认表情', 
        icon: '😀', 
        order: 0, 
        emojis: defaultEmojis 
      }],
      settings: {
        imageScale: 30,
        gridColumns: 4,
        outputFormat: 'markdown',
        forceMobileMode: false,
        defaultGroup: 'nachoneko',
        showSearchBar: true
      }
    };
  }
}

export function saveDataToLocalStorage(data: Partial<UserscriptStorage>): void {
  try {
    if (data.emojiGroups) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data.emojiGroups));
    }
    if (data.settings) {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(data.settings));
    }
  } catch (error) {
    console.error('[Userscript] Failed to save to localStorage:', error);
  }
}

export function addEmojiToUserscript(emojiData: { name: string; url: string }): void {
  try {
    const data = loadDataFromLocalStorage();
    
    // Find or create "用户添加" group
    let userGroup = data.emojiGroups.find(g => g.id === 'user_added');
    if (!userGroup) {
      userGroup = {
        id: 'user_added',
        name: '用户添加',
        icon: '⭐',
        order: 999,
        emojis: []
      };
      data.emojiGroups.push(userGroup);
    }

    // Check if emoji already exists
    const exists = userGroup.emojis.some((e: any) => 
      e.url === emojiData.url || e.name === emojiData.name
    );

    if (!exists) {
      userGroup.emojis.push({
        packet: Date.now(),
        name: emojiData.name,
        url: emojiData.url
      });

      saveDataToLocalStorage({ emojiGroups: data.emojiGroups });
      console.log('[Userscript] Added emoji to user group:', emojiData.name);
    } else {
      console.log('[Userscript] Emoji already exists:', emojiData.name);
    }
  } catch (error) {
    console.error('[Userscript] Failed to add emoji:', error);
  }
}

export function exportUserscriptData(): string {
  try {
    const data = loadDataFromLocalStorage();
    return JSON.stringify(data, null, 2);
  } catch (error) {
    console.error('[Userscript] Failed to export data:', error);
    return '';
  }
}

export function importUserscriptData(jsonData: string): boolean {
  try {
    const data = JSON.parse(jsonData);
    
    if (data.emojiGroups && Array.isArray(data.emojiGroups)) {
      saveDataToLocalStorage({ emojiGroups: data.emojiGroups });
    }
    
    if (data.settings && typeof data.settings === 'object') {
      saveDataToLocalStorage({ settings: data.settings });
    }
    
    console.log('[Userscript] Data imported successfully');
    return true;
  } catch (error) {
    console.error('[Userscript] Failed to import data:', error);
    return false;
  }
}

export function syncFromManager(): boolean {
  try {
    // Try to load data from manager keys
    const managerGroups = localStorage.getItem('emoji_extension_manager_groups');
    const managerSettings = localStorage.getItem('emoji_extension_manager_settings');
    
    let updated = false;
    
    if (managerGroups) {
      const groups = JSON.parse(managerGroups);
      if (Array.isArray(groups)) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(groups));
        updated = true;
      }
    }
    
    if (managerSettings) {
      const settings = JSON.parse(managerSettings);
      if (typeof settings === 'object') {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
        updated = true;
      }
    }
    
    if (updated) {
      console.log('[Userscript] Synced data from manager');
    }
    
    return updated;
  } catch (error) {
    console.error('[Userscript] Failed to sync from manager:', error);
    return false;
  }
}