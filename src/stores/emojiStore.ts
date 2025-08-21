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

  // --- Save control (batching) ---
  let batchDepth = 0;
  const pendingSave = ref(false);

  const beginBatch = () => {
    batchDepth++;
  };

  const endBatch = async () => {
    if (batchDepth > 0) batchDepth--;
    if (batchDepth === 0 && pendingSave.value && !isSaving.value && !isLoading.value) {
      pendingSave.value = false;
      await saveData();
    }
  };

  const maybeSave = () => {
    if (isLoading.value || isSaving.value || batchDepth > 0) {
      pendingSave.value = true;
      return;
    }
    // fire-and-forget; outer callers need not await persistence
    void saveData();
  };

  // --- Actions ---

  const loadData = async () => {
    isLoading.value = true;
    try {
      // 首先进行同步检查，确保数据一致性
      await storageHelpers.syncCheck();
      
      // Load from local storage first
      const [loadedGroups, loadedSettings, loadedFavorites] = await Promise.all([
        storageHelpers.getGroups(),
        storageHelpers.getSettings(),
        storageHelpers.getFavorites(),
      ]);

      groups.value = loadedGroups && loadedGroups.length > 0 ? loadedGroups : JSON.parse(JSON.stringify(defaultEmojiGroups));
      settings.value = { ...defaultSettings, ...loadedSettings };
      favorites.value = new Set(loadedFavorites || []);

      // Check if sync data is newer and should override local
      try {
        const syncData = await storageHelpers.restoreFromSync();
        if (syncData && syncData.groups && syncData.groups.length > 0) {
          // Only use sync data if it's newer or local is empty
          const localTimestamp = loadedSettings?.lastModified || 0;
          const syncTimestamp = syncData.timestamp || 0;

          if (syncTimestamp > localTimestamp || groups.value.length <= 2) { // 2 = default groups
            groups.value = syncData.groups;
            settings.value = { ...defaultSettings, ...syncData.settings, lastModified: syncTimestamp };
            favorites.value = new Set(syncData.favorites || []);

            // Update local storage with sync data using unified method
            await storageHelpers.setAllData(groups.value, settings.value, Array.from(favorites.value));
          }
        }
      } catch (syncError) {
        console.warn('Failed to load sync data, using local data:', syncError);
      }

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
    if (isLoading.value || isSaving.value || batchDepth > 0) {
      pendingSave.value = true;
      return;
    }
    
    isSaving.value = true;
    try {
      // fire-and-forget; outer callers need not await persistence
      await nextTick();

      // Update timestamp for sync comparison
      const updatedSettings = { ...settings.value, lastModified: Date.now() };
      settings.value = updatedSettings;

      // 使用统一数据设置方法，确保本地和同步存储都更新
      await storageHelpers.setAllData(
        groups.value,
        updatedSettings,
        Array.from(favorites.value)
      );
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
    maybeSave();
    return newGroup;
  };

  const createGroupWithoutSave = (name: string, icon: string) => {
    const newGroup: EmojiGroup = {
      id: `group-${Date.now()}`,
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
      maybeSave();
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
    maybeSave();
  };

  const reorderGroups = async (sourceGroupId: string, targetGroupId: string) => {
    const sourceIndex = groups.value.findIndex(g => g.id === sourceGroupId);
    const targetIndex = groups.value.findIndex(g => g.id === targetGroupId);

    if (sourceIndex !== -1 && targetIndex !== -1) {
      const [removed] = groups.value.splice(sourceIndex, 1);
      groups.value.splice(targetIndex, 0, removed);
      groups.value.forEach((group, index) => { group.order = index; });
      await saveData();
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
      maybeSave();
      return newEmoji;
    }
  };

  const addEmojiWithoutSave = (groupId: string, emoji: Omit<Emoji, 'id' | 'groupId'>) => {
    const group = groups.value.find(g => g.id === groupId);
    if (group) {
      const newEmoji: Emoji = {
        ...emoji,
        id: `emoji-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
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
        maybeSave();
        break;
      }
    }
  };

  const deleteEmoji = (emojiId: string) => {
    for (const group of groups.value) {
      group.emojis = group.emojis.filter(e => e.id !== emojiId);
    }
    favorites.value.delete(emojiId);
    maybeSave();
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

      maybeSave();
    }
  };

  const removeEmojiFromGroup = (groupId: string, index: number) => {
    const group = groups.value.find(g => g.id === groupId);
    if (group && index >= 0 && index < group.emojis.length) {
      const emoji = group.emojis[index];
      group.emojis.splice(index, 1);
      favorites.value.delete(emoji.id);
      maybeSave();
    }
  };

  // --- Favorites Management ---
  const toggleFavorite = (emojiId: string) => {
    if (favorites.value.has(emojiId)) {
      favorites.value.delete(emojiId);
    } else {
      favorites.value.add(emojiId);
    }
    maybeSave();
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
    maybeSave();
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
    maybeSave();
  };

  const resetToDefaults = async () => {
    await storageHelpers.resetToDefaults();
    await loadData(); // Reload store state from storage
  };

  const forceSync = async () => {
    try {
      await storageHelpers.backupToSync(
        groups.value,
        settings.value,
        Array.from(favorites.value)
      );
      return true;
    } catch (error) {
      console.error('Failed to sync to chrome:', error);
      return false;
    }
  };

  // --- Synchronization and Persistence ---

  // Watch for local changes and persist them to chrome.storage (respects batching)
  watch([groups, settings, favorites], () => {
    if (!isLoading.value && !isUpdatingFromStorage) {
      maybeSave();
    }
  }, { deep: true });

  // Listen for changes from other extension contexts (e.g., options page)
  let isUpdatingFromStorage = false;
  onStorageChange((changes, areaName) => {
    if (isSaving.value || isLoading.value || isUpdatingFromStorage) return; // Prevent loops

    isUpdatingFromStorage = true;
    try {
      if (areaName === 'local') {
        const groupsChange = changes[STORAGE_KEYS.GROUPS];
        if (groupsChange && groupsChange.newValue) {
          groups.value = groupsChange.newValue;
        }

        const settingsChange = changes[STORAGE_KEYS.SETTINGS];
        if (settingsChange && settingsChange.newValue) {
          settings.value = settingsChange.newValue;
        }

        const favoritesChange = changes[STORAGE_KEYS.FAVORITES];
        if (favoritesChange && favoritesChange.newValue) {
          favorites.value = new Set(favoritesChange.newValue);
        }
      } else if (areaName === 'sync') {
        // Handle sync storage changes - sync data takes priority
        const backupChange = changes['emojiExtensionBackup'];
        if (backupChange && backupChange.newValue) {
          const backup = backupChange.newValue;
          if (backup.groups) {
            groups.value = backup.groups;
          }
          if (backup.settings) {
            settings.value = { ...defaultSettings, ...backup.settings };
          }
          if (backup.favorites) {
            favorites.value = new Set(backup.favorites);
          }

          // Update local storage to match sync (without triggering save)
          setStorageData({
            [STORAGE_KEYS.GROUPS]: groups.value,
            [STORAGE_KEYS.SETTINGS]: settings.value,
            [STORAGE_KEYS.FAVORITES]: Array.from(favorites.value)
          }).catch(console.error);
        }
      }
    } finally {
      setTimeout(() => {
        isUpdatingFromStorage = false;
      }, 100);
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
    saveData,
    createGroup,
    createGroupWithoutSave,
    updateGroup,
    deleteGroup,
    reorderGroups,
    addEmoji,
    addEmojiWithoutSave,
    updateEmoji,
    deleteEmoji,
    moveEmoji,
    removeEmojiFromGroup,
    toggleFavorite,
    findEmojiById,
    updateSettings,
    exportConfiguration,
    importConfiguration,
    resetToDefaults,
    forceSync,
    // expose batching helpers for bulk operations
    beginBatch,
    endBatch
  };
});
