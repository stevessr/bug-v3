import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import type { Emoji, EmojiGroup, AppSettings } from '../types/emoji';
import { defaultEmojiGroups, defaultSettings } from '../types/emoji';
import { emojiStorage, storageHelpers } from '../utils/storage';

export const useEmojiStore = defineStore('emojiExtension', () => {
  // State
  const groups = ref<EmojiGroup[]>([]);
  const settings = ref<AppSettings>(defaultSettings);
  const activeGroupId = ref<string>('nachoneko');
  const searchQuery = ref<string>('');
  const isLoading = ref(false);
  const favorites = ref<Set<string>>(new Set());

  // Cross-context sync (popup <-> options) using BroadcastChannel
  const sourceId = Math.random().toString(36).slice(2);
  const channel: BroadcastChannel | null = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('emoji-store') : null;
  const isSyncing = ref(false);

  const postState = (reason: string = 'update') => {
    if (!channel) return;
    try {
      channel.postMessage({
        type: 'state:update',
        reason,
        sourceId,
        payload: {
          groups: groups.value,
          settings: settings.value,
          favorites: Array.from(favorites.value),
          activeGroupId: activeGroupId.value,
          searchQuery: searchQuery.value,
        }
      });
    } catch (e) {
      // no-op
    }
  };

  if (channel) {
    channel.onmessage = (ev: MessageEvent) => {
      const data = ev.data as any;
      if (!data || data.type !== 'state:update' || data.sourceId === sourceId) return;
      try {
        isSyncing.value = true;
        const p = data.payload || {};
        if (p.settings) settings.value = { ...defaultSettings, ...p.settings };
        if (p.groups) groups.value = p.groups;
        if (p.favorites) favorites.value = new Set(p.favorites);
        if (p.activeGroupId) activeGroupId.value = p.activeGroupId;
        if (typeof p.searchQuery === 'string') searchQuery.value = p.searchQuery;
      } finally {
        // small nextTick-like delay could be added, but simple timeout is enough
        setTimeout(() => { isSyncing.value = false; }, 0);
      }
    };
  }

  // Computed
  const activeGroup = computed(() => 
    groups.value.find(g => g.id === activeGroupId.value) || groups.value[0]
  );

  const filteredEmojis = computed(() => {
    if (!activeGroup.value) return [];
    
    let emojis = activeGroup.value.emojis;
    
    if (searchQuery.value) {
      const query = searchQuery.value.toLowerCase();
      emojis = emojis.filter(emoji => 
        emoji.name.toLowerCase().includes(query)
      );
    }
    
    return emojis;
  });

  const sortedGroups = computed(() => 
    [...groups.value].sort((a, b) => a.order - b.order)
  );

  // Chrome storage helpers
  const getStorageData = async (keys: string | string[]): Promise<{ [key: string]: any }> => {
    // Use IndexedDB instead of Chrome storage as primary
    if (typeof keys === 'string') {
      keys = [keys]
    }
    
    const result: { [key: string]: any } = {}
    
    for (const key of keys) {
      switch (key) {
        case 'emojiGroups':
          result[key] = await storageHelpers.getGroups()
          break
        case 'appSettings':
          result[key] = await storageHelpers.getSettings()
          break
        case 'favorites':
          result[key] = await storageHelpers.getFavorites()
          break
      }
    }
    
    return result
  };

  const setStorageData = async (data: { [key: string]: any }): Promise<void> => {
    try {
      // Save to IndexedDB
      if (data.emojiGroups) {
        await storageHelpers.setGroups(data.emojiGroups)
      }
      if (data.appSettings) {
        await storageHelpers.setSettings(data.appSettings)
      }
      if (data.favorites) {
        await storageHelpers.setFavorites(data.favorites)
      }
      
      console.log('Data saved successfully to IndexedDB:', data);
    } catch (error) {
      console.error('Failed to save to IndexedDB:', error);
      throw error;
    }
  };

  // Actions
  const loadData = async () => {
    if (isLoading.value) return;
    
    isLoading.value = true;
    try {
      const data = await getStorageData(['emojiGroups', 'appSettings', 'favorites']);
      
      // Load groups
      if (data.emojiGroups && data.emojiGroups.length > 0) {
        groups.value = data.emojiGroups;
      } else {
        groups.value = JSON.parse(JSON.stringify(defaultEmojiGroups));
      }
      
      // Load settings
      if (data.appSettings) {
        settings.value = { ...defaultSettings, ...data.appSettings };
      }
      
      // Load favorites
      if (data.favorites) {
        favorites.value = new Set(data.favorites);
      }
      
      // Set active group
      activeGroupId.value = settings.value.defaultGroup;
  // Broadcast initial state so other contexts align when opened later
  postState('load');
    } catch (error) {
      console.error('Failed to load emoji data:', error);
      groups.value = JSON.parse(JSON.stringify(defaultEmojiGroups));
    } finally {
      isLoading.value = false;
    }
  };

  const saveData = async () => {
    if (isSyncing.value) return; // avoid echo during incoming sync
    try {
      await setStorageData({
        emojiGroups: groups.value,
        appSettings: settings.value,
        favorites: Array.from(favorites.value)
      });
      postState('save');
    } catch (error) {
      console.error('Failed to save emoji data:', error);
    }
  };

  // Group management
  const createGroup = (name: string, icon: string) => {
    const id = `group-${Date.now()}`;
    const newGroup: EmojiGroup = {
      id,
      name,
      icon,
      order: groups.value.length,
      emojis: []
    };
    groups.value.push(newGroup);
  // persist via watcher, but also broadcast quickly for UX
  postState('createGroup');
    return newGroup;
  };

  const updateGroup = (groupId: string, updates: Partial<EmojiGroup>) => {
    const index = groups.value.findIndex(g => g.id === groupId);
    if (index !== -1) {
      groups.value[index] = { ...groups.value[index], ...updates };
  postState('updateGroup');
    }
  };

  const deleteGroup = (groupId: string) => {
    if (groupId === 'favorites' || groupId === 'nachoneko') {
      throw new Error('Cannot delete system groups');
    }
    groups.value = groups.value.filter(g => g.id !== groupId);
    if (activeGroupId.value === groupId) {
      activeGroupId.value = groups.value[0]?.id || 'nachoneko';
    }
  postState('deleteGroup');
  };

  const reorderGroups = (groupIds: string[]) => {
    const reorderedGroups = groupIds.map((id, index) => {
      const group = groups.value.find(g => g.id === id);
      if (group) {
        return { ...group, order: index };
      }
      return null;
    }).filter(Boolean) as EmojiGroup[];
    
    groups.value = reorderedGroups;
  postState('reorderGroups');
  };

  // Emoji management
  const addEmoji = (groupId: string, emoji: Omit<Emoji, 'id' | 'groupId'>) => {
    const group = groups.value.find(g => g.id === groupId);
    if (group) {
      const newEmoji: Emoji = {
        ...emoji,
        id: `emoji-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        groupId
      };
      group.emojis.push(newEmoji);
      postState('addEmoji');
      return newEmoji;
    }
  };

  const updateEmoji = (emojiId: string, updates: Partial<Emoji>) => {
    for (const group of groups.value) {
      const index = group.emojis.findIndex(e => e.id === emojiId);
      if (index !== -1) {
        group.emojis[index] = { ...group.emojis[index], ...updates };
  postState('updateEmoji');
        break;
      }
    }
  };

  const deleteEmoji = (emojiId: string) => {
    for (const group of groups.value) {
      group.emojis = group.emojis.filter(e => e.id !== emojiId);
    }
    favorites.value.delete(emojiId);
  postState('deleteEmoji');
  };

  const moveEmoji = (emojiId: string, targetGroupId: string, targetIndex?: number) => {
    let emoji: Emoji | undefined;
    
    // Find and remove emoji from current group
    for (const group of groups.value) {
      const index = group.emojis.findIndex(e => e.id === emojiId);
      if (index !== -1) {
        emoji = group.emojis.splice(index, 1)[0];
        break;
      }
    }
    
    // Add to target group
    if (emoji) {
      const targetGroup = groups.value.find(g => g.id === targetGroupId);
      if (targetGroup) {
        emoji.groupId = targetGroupId;
        
        // Insert at specific position if index provided
        if (typeof targetIndex === 'number' && targetIndex >= 0) {
          targetGroup.emojis.splice(targetIndex, 0, emoji);
        } else {
          targetGroup.emojis.push(emoji);
        }
      }
    }
  postState('moveEmoji');
  };

  // Favorites management
  const toggleFavorite = (emojiId: string) => {
    if (favorites.value.has(emojiId)) {
      favorites.value.delete(emojiId);
      // Remove from favorites group
      const favGroup = groups.value.find(g => g.id === 'favorites');
      if (favGroup) {
        favGroup.emojis = favGroup.emojis.filter(e => e.id !== emojiId);
      }
    } else {
      favorites.value.add(emojiId);
      // Add to favorites group
      const favGroup = groups.value.find(g => g.id === 'favorites');
      const sourceEmoji = findEmojiById(emojiId);
      if (favGroup && sourceEmoji) {
        favGroup.emojis.push({ ...sourceEmoji, groupId: 'favorites' });
      }
    }
  postState('toggleFavorite');
  };

  const findEmojiById = (emojiId: string): Emoji | undefined => {
    for (const group of groups.value) {
      const emoji = group.emojis.find(e => e.id === emojiId);
      if (emoji) return emoji;
    }
  };

  // Settings management
  const updateSettings = async (newSettings: Partial<AppSettings>) => {
    settings.value = { ...settings.value, ...newSettings };
    // Force immediate save for settings changes
    await saveData();
  postState('updateSettings');
  };

  // Export/Import
  const exportConfiguration = () => {
    return {
      groups: groups.value,
      settings: settings.value,
      favorites: Array.from(favorites.value),
      exportDate: new Date().toISOString(),
      version: '1.0'
    };
  };

  const importConfiguration = (config: any) => {
    try {
      if (config.groups) {
        groups.value = config.groups;
      }
      if (config.settings) {
        settings.value = { ...defaultSettings, ...config.settings };
      }
      if (config.favorites) {
        favorites.value = new Set(config.favorites);
      }
      return true;
    } catch (error) {
      console.error('Failed to import configuration:', error);
      return false;
    }
  };

  // Backup/Sync functionality
  const backupToChrome = async () => {
    try {
      return await emojiStorage.syncToChrome();
    } catch (error) {
      console.error('Failed to backup to Chrome:', error);
      return false;
    }
  };

  const restoreFromChrome = async () => {
    try {
      const success = await emojiStorage.restoreFromChrome();
      if (success) {
        // Reload data after restore
        await loadData();
      }
      return success;
    } catch (error) {
      console.error('Failed to restore from Chrome:', error);
      return false;
    }
  };

  const resetToDefaults = async () => {
    try {
      const success = await emojiStorage.resetToDefaults();
      if (success) {
        // Reload default data
        groups.value = JSON.parse(JSON.stringify(defaultEmojiGroups));
        settings.value = { ...defaultSettings };
        favorites.value = new Set();
        activeGroupId.value = settings.value.defaultGroup;
      }
      return success;
    } catch (error) {
      console.error('Failed to reset to defaults:', error);
      return false;
    }
  };

  // Watch for changes and auto-save
  watch([groups, settings, favorites], () => {
    saveData();
  }, { deep: true });

  return {
    // State
    groups,
    settings,
    activeGroupId,
    searchQuery,
    isLoading,
    favorites,
    
    // Computed
    activeGroup,
    filteredEmojis,
    sortedGroups,
    
    // Actions
    loadData,
    saveData,
    createGroup,
    updateGroup,
    deleteGroup,
    reorderGroups,
    addEmoji,
    updateEmoji,
    deleteEmoji,
    moveEmoji,
    toggleFavorite,
    findEmojiById,
    updateSettings,
    exportConfiguration,
    importConfiguration,
    backupToChrome,
    restoreFromChrome,
    resetToDefaults
  };
});