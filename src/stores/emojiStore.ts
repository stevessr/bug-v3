import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import type { Emoji, EmojiGroup, AppSettings } from '../types/emoji';
import { defaultEmojiGroups, defaultSettings } from '../types/emoji';

export const useEmojiStore = defineStore('emojiExtension', () => {
  // State
  const groups = ref<EmojiGroup[]>([]);
  const settings = ref<AppSettings>(defaultSettings);
  const activeGroupId = ref<string>('nachoneko');
  const searchQuery = ref<string>('');
  const isLoading = ref(false);
  const favorites = ref<Set<string>>(new Set());

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
  const getStorageData = (keys: string | string[]): Promise<{ [key: string]: any }> => {
    return new Promise((resolve) => {
      chrome.storage.local.get(keys, resolve);
    });
  };

  const setStorageData = (data: { [key: string]: any }): Promise<void> => {
    return new Promise((resolve) => {
      chrome.storage.local.set(data, resolve);
    });
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
    } catch (error) {
      console.error('Failed to load emoji data:', error);
      groups.value = JSON.parse(JSON.stringify(defaultEmojiGroups));
    } finally {
      isLoading.value = false;
    }
  };

  const saveData = async () => {
    try {
      await setStorageData({
        emojiGroups: groups.value,
        appSettings: settings.value,
        favorites: Array.from(favorites.value)
      });
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
    return newGroup;
  };

  const updateGroup = (groupId: string, updates: Partial<EmojiGroup>) => {
    const index = groups.value.findIndex(g => g.id === groupId);
    if (index !== -1) {
      groups.value[index] = { ...groups.value[index], ...updates };
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
  };

  // Emoji management
  const addEmoji = (groupId: string, emoji: Omit<Emoji, 'id' | 'groupId'>) => {
    const group = groups.value.find(g => g.id === groupId);
    if (group) {
      const newEmoji: Emoji = {
        ...emoji,
        id: `emoji-${Date.now()}`,
        groupId
      };
      group.emojis.push(newEmoji);
      return newEmoji;
    }
  };

  const updateEmoji = (emojiId: string, updates: Partial<Emoji>) => {
    for (const group of groups.value) {
      const index = group.emojis.findIndex(e => e.id === emojiId);
      if (index !== -1) {
        group.emojis[index] = { ...group.emojis[index], ...updates };
        break;
      }
    }
  };

  const deleteEmoji = (emojiId: string) => {
    for (const group of groups.value) {
      group.emojis = group.emojis.filter(e => e.id !== emojiId);
    }
    favorites.value.delete(emojiId);
  };

  const moveEmoji = (emojiId: string, targetGroupId: string, targetIndex?: number) => {
    let emoji: Emoji | undefined;
    let sourceGroupId: string | undefined;
    
    // Find and remove emoji from current group
    for (const group of groups.value) {
      const index = group.emojis.findIndex(e => e.id === emojiId);
      if (index !== -1) {
        emoji = group.emojis.splice(index, 1)[0];
        sourceGroupId = group.id;
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
  };

  const findEmojiById = (emojiId: string): Emoji | undefined => {
    for (const group of groups.value) {
      const emoji = group.emojis.find(e => e.id === emojiId);
      if (emoji) return emoji;
    }
  };

  // Settings management
  const updateSettings = (newSettings: Partial<AppSettings>) => {
    settings.value = { ...settings.value, ...newSettings };
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
    importConfiguration
  };
});