import { defineStore } from 'pinia';
import { ref, computed, watch, nextTick } from 'vue';
import type { Emoji, EmojiGroup, AppSettings } from '../types/emoji';
import { defaultEmojiGroups, defaultSettings } from '../types/emoji';
import { setStorageData, onStorageChange, storageHelpers, STORAGE_KEYS } from '../utils/storage';

export const useEmojiStore = defineStore('emojiExtension', () => {
  // --- State ---
  const groups = ref<EmojiGroup[]>([]);
  const settings = ref<AppSettings>(defaultSettings);
  const favorites = ref<Set<string>>(new Set());
  const activeGroupId = ref<string>('nachoneko');
  const searchQuery = ref<string>(' ');
  const isLoading = ref(true);
  const isSaving = ref(false);

  // --- Computed ---
  const activeGroup = computed(() => 
    groups.value.find(g => g.id === activeGroupId.value) || groups.value[0]
  );

  const filteredEmojis = computed(() => {
    if (!activeGroup.value) return [];
    
    let emojis = activeGroup.value.emojis;
    
    if (searchQuery.value) {
      const query = searchQuery.value.toLowerCase().trim();
      if (query) {
        emojis = emojis.filter(emoji => 
          emoji.name.toLowerCase().includes(query)
        );
      }
    }
    
    return emojis;
  });

  const sortedGroups = computed(() => 
    [...groups.value].sort((a, b) => a.order - b.order)
  );

  // --- Actions ---

  const loadData = async () => {
    isLoading.value = true;
    try {
      const [loadedGroups, loadedSettings, loadedFavorites] = await Promise.all([
        storageHelpers.getGroups(),
        storageHelpers.getSettings(),
        storageHelpers.getFavorites(),
      ]);

      groups.value = loadedGroups && loadedGroups.length > 0 ? loadedGroups : JSON.parse(JSON.stringify(defaultEmojiGroups));
      settings.value = { ...defaultSettings, ...loadedSettings };
      favorites.value = new Set(loadedFavorites || []);
      activeGroupId.value = settings.value.defaultGroup || 'nachoneko';

    } catch (error) {
      console.error('Failed to load initial data:', error);
      // Fallback to defaults in case of error
      groups.value = JSON.parse(JSON.stringify(defaultEmojiGroups));
      settings.value = { ...defaultSettings };
      favorites.value = new Set();
    } finally {
      isLoading.value = false;
    }
  };

  const saveData = async () => {
    if (isLoading.value || isSaving.value) return;
    isSaving.value = true;
    try {
      // Use nextTick to batch multiple synchronous changes into one save operation
      await nextTick();
      await setStorageData({
        [STORAGE_KEYS.GROUPS]: groups.value,
        [STORAGE_KEYS.SETTINGS]: settings.value,
        [STORAGE_KEYS.FAVORITES]: Array.from(favorites.value)
      });
    } catch (error) {
      console.error('Failed to save data:', error);
    } finally {
      isSaving.value = false;
    }
  };

  // --- Group Management ---
  const createGroup = (name: string, icon: string) => {
    const newGroup: EmojiGroup = {
      id: `group-${Date.now()}`,
      name,
      icon,
      order: groups.value.length,
      emojis: []
    };
    groups.value.push(newGroup);
    saveData(); // Added
    return newGroup;
  };

  const updateGroup = (groupId: string, updates: Partial<EmojiGroup>) => {
    const index = groups.value.findIndex(g => g.id === groupId);
    if (index !== -1) {
      groups.value[index] = { ...groups.value[index], ...updates };
      saveData(); // Added
    }
  };

  const deleteGroup = (groupId: string) => {
    if (groupId === 'favorites' || groupId === 'nachoneko') {
      console.warn('Cannot delete system groups');
      return;
    }
    groups.value = groups.value.filter(g => g.id !== groupId);
    if (activeGroupId.value === groupId) {
      activeGroupId.value = groups.value[0]?.id || 'nachoneko';
    }
  };

  const reorderGroups = (sourceGroupId: string, targetGroupId: string) => {
    const sourceIndex = groups.value.findIndex(g => g.id === sourceGroupId);
    const targetIndex = groups.value.findIndex(g => g.id === targetGroupId);
    
    if (sourceIndex !== -1 && targetIndex !== -1) {
      const [removed] = groups.value.splice(sourceIndex, 1);
      groups.value.splice(targetIndex, 0, removed);
      groups.value.forEach((group, index) => { group.order = index; });
      saveData();
    }
  };

  // --- Emoji Management ---
  const addEmoji = (groupId: string, emoji: Omit<Emoji, 'id' | 'groupId'>) => {
    const group = groups.value.find(g => g.id === groupId);
    if (group) {
      const newEmoji: Emoji = {
        ...emoji,
        id: `emoji-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        groupId
      };
      group.emojis.push(newEmoji);
      saveData(); // Explicitly save after adding
      return newEmoji;
    }
  };

  const updateEmoji = (emojiId: string, updates: Partial<Emoji>) => {
    for (const group of groups.value) {
      const index = group.emojis.findIndex(e => e.id === emojiId);
      if (index !== -1) {
        group.emojis[index] = { ...group.emojis[index], ...updates };
        saveData(); // Explicitly save after updating
        break;
      }
    }
  };

  const deleteEmoji = (emojiId: string) => {
    for (const group of groups.value) {
      group.emojis = group.emojis.filter(e => e.id !== emojiId);
    }
    favorites.value.delete(emojiId);
    saveData(); // Explicitly save after deleting
  };

  const moveEmoji = (sourceGroupId: string, sourceIndex: number, targetGroupId: string, targetIndex: number) => {
    const sourceGroup = groups.value.find(g => g.id === sourceGroupId);
    const targetGroup = groups.value.find(g => g.id === targetGroupId);
    
    if (sourceGroup && targetGroup && sourceIndex >= 0 && sourceIndex < sourceGroup.emojis.length) {
      const [emoji] = sourceGroup.emojis.splice(sourceIndex, 1);
      emoji.groupId = targetGroupId;
      
      if (targetIndex >= 0 && targetIndex <= targetGroup.emojis.length) {
        targetGroup.emojis.splice(targetIndex, 0, emoji);
      } else {
        targetGroup.emojis.push(emoji);
      }
      
      saveData(); // Explicitly save after moving
    }
  };

  const removeEmojiFromGroup = (groupId: string, index: number) => {
    const group = groups.value.find(g => g.id === groupId);
    if (group && index >= 0 && index < group.emojis.length) {
      const emoji = group.emojis[index];
      group.emojis.splice(index, 1);
      favorites.value.delete(emoji.id);
      saveData(); // Explicitly save after removing
    }
  };

  // --- Favorites Management ---
  const toggleFavorite = (emojiId: string) => {
    if (favorites.value.has(emojiId)) {
      favorites.value.delete(emojiId);
    } else {
      favorites.value.add(emojiId);
    }
    saveData();
  };

  const findEmojiById = (emojiId: string): Emoji | undefined => {
    for (const group of groups.value) {
      const emoji = group.emojis.find(e => e.id === emojiId);
      if (emoji) return emoji;
    }
  };

  // --- Settings Management ---
  const updateSettings = (newSettings: Partial<AppSettings>) => {
    settings.value = { ...settings.value, ...newSettings };
    saveData();
  };

  // --- Import/Export ---
  const exportConfiguration = () => {
    return {
      [STORAGE_KEYS.GROUPS]: groups.value,
      [STORAGE_KEYS.SETTINGS]: settings.value,
      [STORAGE_KEYS.FAVORITES]: Array.from(favorites.value),
      exportDate: new Date().toISOString(),
      version: '2.0'
    };
  };

  const importConfiguration = (config: any) => {
    if (config[STORAGE_KEYS.GROUPS]) {
      groups.value = config[STORAGE_KEYS.GROUPS];
    }
    if (config[STORAGE_KEYS.SETTINGS]) {
      settings.value = { ...defaultSettings, ...config[STORAGE_KEYS.SETTINGS] };
    }
    if (config[STORAGE_KEYS.FAVORITES]) {
      favorites.value = new Set(config[STORAGE_KEYS.FAVORITES]);
    }
    saveData();
  };

  const resetToDefaults = async () => {
    await storageHelpers.resetToDefaults();
    await loadData(); // Reload store state from storage
  };

  // --- Synchronization and Persistence ---

  // Watch for local changes and persist them to chrome.storage
  watch([groups, settings, favorites], saveData, { deep: true });

  // Listen for changes from other extension contexts (e.g., options page)
  onStorageChange((changes) => {
    if (isSaving.value) return; // Ignore changes made by this instance

    const groupsChange = changes[STORAGE_KEYS.GROUPS];
    if (groupsChange) {
      groups.value = groupsChange.newValue;
    }

    const settingsChange = changes[STORAGE_KEYS.SETTINGS];
    if (settingsChange) {
      settings.value = settingsChange.newValue;
    }

    const favoritesChange = changes[STORAGE_KEYS.FAVORITES];
    if (favoritesChange) {
      favorites.value = new Set(favoritesChange.newValue);
    }
  });

  return {
    // State
    groups,
    settings,
    activeGroupId,
    searchQuery,
    isLoading,
    isSaving,
    favorites,
    
    // Computed
    activeGroup,
    filteredEmojis,
    sortedGroups,
    
    // Actions
    loadData,
    createGroup,
    updateGroup,
    deleteGroup,
    reorderGroups,
    addEmoji,
    updateEmoji,
    deleteEmoji,
    toggleFavorite,
    findEmojiById,
    updateSettings,
    exportConfiguration,
    importConfiguration,
    resetToDefaults
  };
});
