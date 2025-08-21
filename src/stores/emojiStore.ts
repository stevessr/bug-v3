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
    console.log('[EmojiStore] Starting loadData');
    isLoading.value = true;
    try {
      // 首先进行同步检查，确保数据一致性（使用防抖机制）
      console.log('[EmojiStore] Performing sync check');
      await storageHelpers.syncCheck();
      
      // Load from storage using the new split helpers for better performance
      console.log('[EmojiStore] Loading data from split storage');
      const [loadedGroups, loadedSettings, loadedFavorites] = await Promise.all([
        storageHelpers.getGroupsSplit(),
        storageHelpers.getSettings(),
        storageHelpers.getFavorites(),
      ]);

      // Detailed data loading debug info
      console.log('[EmojiStore] Raw loaded data:');
      console.log('  - loadedGroups:', loadedGroups);
      console.log('  - loadedSettings:', loadedSettings);
      console.log('  - loadedFavorites:', loadedFavorites);

      // Summarize loaded data to avoid huge console dumps
      console.log('[EmojiStore] Data loaded summary:', {
        groupsCount: loadedGroups?.length || 0,
        groupsValid: Array.isArray(loadedGroups),
        settingsLastModified: loadedSettings?.lastModified,
        favoritesCount: loadedFavorites?.length || 0
      });

      groups.value = loadedGroups && loadedGroups.length > 0 ? loadedGroups : JSON.parse(JSON.stringify(defaultEmojiGroups));
      settings.value = { ...defaultSettings, ...loadedSettings };
      favorites.value = new Set(loadedFavorites || []);

      console.log('[EmojiStore] Final groups after assignment:', {
        count: groups.value?.length || 0,
        groupIds: groups.value?.map(g => g.id) || []
      });

      // If we used default data, save it to storage for next time
      if (!loadedGroups || loadedGroups.length === 0) {
        console.log('[EmojiStore] No groups loaded, saving default groups to storage');
        await storageHelpers.setGroups(groups.value);
      }
      if (!loadedSettings || Object.keys(loadedSettings).length === 0) {
        console.log('[EmojiStore] No settings loaded, saving default settings to storage');
        await storageHelpers.setSettings(settings.value);
      }

      activeGroupId.value = settings.value.defaultGroup || 'nachoneko';

      console.log('[EmojiStore] LoadData completed successfully');
    } catch (error) {
      const e: any = error;
      console.error('[EmojiStore] Failed to load initial data:', e?.stack || e);
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
      console.log('[EmojiStore] SaveData deferred - loading:', isLoading.value, 'saving:', isSaving.value, 'batch:', batchDepth);
      pendingSave.value = true;
      return;
    }
    
    console.log('[EmojiStore] Starting saveData');
    isSaving.value = true;
    try {
      await nextTick();

      // Update timestamp for sync comparison
      const updatedSettings = { ...settings.value, lastModified: Date.now() };
      settings.value = updatedSettings;

      // Avoid dumping whole data; show a concise summary
      console.log('[EmojiStore] Saving data summary:', {
        groupsCount: groups.value.length,
        settingsLastModified: updatedSettings.lastModified,
        favoritesCount: favorites.value.size
      });

      // 使用分割存储方法以提高性能，确保本地和同步存储都更新
      await Promise.all([
        storageHelpers.setGroupsSplit(groups.value),
        storageHelpers.setSettings(updatedSettings),
        storageHelpers.setFavorites(Array.from(favorites.value))
      ]);
      
      console.log('[EmojiStore] SaveData completed successfully');
    } catch (error) {
      const e: any = error;
      console.error('[EmojiStore] Failed to save data:', e?.stack || e);
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
  console.log('[EmojiStore] createGroup', { id: newGroup.id, name: newGroup.name });
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
  console.log('[EmojiStore] createGroupWithoutSave', { id: newGroup.id, name: newGroup.name });
  return newGroup;
  };

  const updateGroup = (groupId: string, updates: Partial<EmojiGroup>) => {
    const index = groups.value.findIndex(g => g.id === groupId);
    if (index !== -1) {
      groups.value[index] = { ...groups.value[index], ...updates };
  console.log('[EmojiStore] updateGroup', { id: groupId, updates });
  maybeSave();
    }
  };

  const deleteGroup = (groupId: string) => {
    if (groupId === 'favorites' || groupId === 'nachoneko') {
      console.warn('Cannot delete system groups');
      return;
    }
    
    // Remove from split storage
    storageHelpers.deleteGroupSplit(groupId).catch(error => 
      console.error('[EmojiStore] Failed to delete group from split storage:', error)
    );
    
  groups.value = groups.value.filter(g => g.id !== groupId);
  console.log('[EmojiStore] deleteGroup', { id: groupId });
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
  console.log('[EmojiStore] reorderGroups', { from: sourceGroupId, to: targetGroupId });
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
  console.log('[EmojiStore] addEmoji', { id: newEmoji.id, groupId });
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
  console.log('[EmojiStore] addEmojiWithoutSave', { id: newEmoji.id, groupId });
  return newEmoji;
    }
  };

  const updateEmoji = (emojiId: string, updates: Partial<Emoji>) => {
    for (const group of groups.value) {
      const index = group.emojis.findIndex(e => e.id === emojiId);
      if (index !== -1) {
        group.emojis[index] = { ...group.emojis[index], ...updates };
  console.log('[EmojiStore] updateEmoji', { id: emojiId, updates });
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
  console.log('[EmojiStore] deleteEmoji', { id: emojiId });
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
  console.log('[EmojiStore] moveEmoji', { from: sourceGroupId, to: targetGroupId, sourceIndex, targetIndex });
    }
  };

  const removeEmojiFromGroup = (groupId: string, index: number) => {
    const group = groups.value.find(g => g.id === groupId);
    if (group && index >= 0 && index < group.emojis.length) {
      const emoji = group.emojis[index];
      group.emojis.splice(index, 1);
      favorites.value.delete(emoji.id);
  console.log('[EmojiStore] removeEmojiFromGroup', { groupId, index, id: emoji.id });
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
  console.log('[EmojiStore] toggleFavorite', { id: emojiId, now: favorites.value.has(emojiId) });
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
  console.log('[EmojiStore] updateSettings', { updates: newSettings });
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
  console.log('[EmojiStore] importConfiguration', { groups: config[STORAGE_KEYS.GROUPS]?.length });
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

  // Watch for local changes and persist them (with better debouncing)
  let saveTimeout: NodeJS.Timeout | null = null;
  const SAVE_DEBOUNCE_DELAY = 500; // 500ms debounce
  
  watch([groups, settings, favorites], () => {
    if (!isLoading.value && !isUpdatingFromStorage && !isSaving.value) {
      // Clear existing timeout
      if (saveTimeout) {
        clearTimeout(saveTimeout);
      }
      
      // Debounce saves to prevent continuous writes
      saveTimeout = setTimeout(() => {
        console.log('[EmojiStore] Triggering debounced save');
        maybeSave();
      }, SAVE_DEBOUNCE_DELAY);
    }
  }, { deep: true });

  // Listen for changes from other extension contexts (e.g., options page)
  let isUpdatingFromStorage = false;
  onStorageChange((changes, areaName) => {
    if (isSaving.value || isLoading.value || isUpdatingFromStorage) {
      console.log('[EmojiStore] Ignoring storage change - save:', isSaving.value, 'load:', isLoading.value, 'updating:', isUpdatingFromStorage);
      return; // Prevent loops
    }

    console.log('[EmojiStore] Storage change detected:', areaName, Object.keys(changes));
    isUpdatingFromStorage = true;
    try {
      if (areaName === 'local') {
        const groupsChange = changes[STORAGE_KEYS.GROUPS];
        if (groupsChange && groupsChange.newValue) {
          console.log('[EmojiStore] Updating groups from storage change - count:', groupsChange.newValue?.length || 0);
          groups.value = groupsChange.newValue;
        }

        const settingsChange = changes[STORAGE_KEYS.SETTINGS];
        if (settingsChange && settingsChange.newValue) {
          console.log('[EmojiStore] Updating settings from storage change - lastModified:', (settingsChange.newValue as any)?.lastModified);
          settings.value = settingsChange.newValue;
        }

        const favoritesChange = changes[STORAGE_KEYS.FAVORITES];
        if (favoritesChange && favoritesChange.newValue) {
          console.log('[EmojiStore] Updating favorites from storage change - count:', favoritesChange.newValue?.length || 0);
          favorites.value = new Set(favoritesChange.newValue);
        }
      } else if (areaName === 'sync') {
        // Handle sync storage changes - sync data takes priority (but avoid loops)
        const backupChange = changes['emojiExtensionBackup'];
        if (backupChange && backupChange.newValue) {
          const backup = backupChange.newValue;
          console.log('[EmojiStore] Updating from sync storage change - summary:', { groups: backup.groups?.length, favorites: backup.favorites?.length, timestamp: backup.timestamp });
          
          if (backup.groups) {
            groups.value = backup.groups;
          }
          if (backup.settings) {
            settings.value = { ...defaultSettings, ...backup.settings };
          }
          if (backup.favorites) {
            favorites.value = new Set(backup.favorites);
          }

          // Update local storage to match sync (without triggering save to prevent loops)
          setStorageData({
            [STORAGE_KEYS.GROUPS]: groups.value,
            [STORAGE_KEYS.SETTINGS]: settings.value,
            [STORAGE_KEYS.FAVORITES]: Array.from(favorites.value)
          }).catch(error => console.error('[EmojiStore] Failed to update local storage from sync:', error));
        }
      }
    } finally {
      setTimeout(() => {
        isUpdatingFromStorage = false;
        console.log('[EmojiStore] Storage update completed');
      }, 200); // Increased timeout to ensure stability
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
