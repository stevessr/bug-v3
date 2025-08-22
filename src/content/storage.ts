import { ContentStorageAdapter } from "./ContentStorageAdapter";
import { cachedState } from "./state";
import { getDefaultEmojis } from "./default";

const contentStorage = new ContentStorageAdapter();

export async function loadDataFromStorage(): Promise<void> {
  try {
    console.log('[Emoji Extension] Loading data using new storage system (module)');
    const groups = await contentStorage.getAllEmojiGroups();
    console.log('[Emoji Extension] Loaded groups from storage:', groups?.length || 0);

    if (Array.isArray(groups) && groups.length > 0) {
      let validGroups = 0;
      let totalEmojis = 0;
      groups.forEach((group: any) => {
        if (group && group.emojis && Array.isArray(group.emojis)) {
          validGroups++;
          totalEmojis += group.emojis.length;
        }
      });

      if (validGroups > 0 && totalEmojis > 0) {
        cachedState.emojiGroups = groups;
        console.log(`[Emoji Extension] Successfully loaded ${validGroups} valid groups with ${totalEmojis} total emojis (module)`);
      } else {
        console.warn('[Emoji Extension] Groups exist but contain no valid emojis, using defaults (module)');
        cachedState.emojiGroups = [];
      }
    } else {
      console.warn('[Emoji Extension] No valid emoji groups found, using defaults (module)');
      cachedState.emojiGroups = [];
    }

    const settings = await contentStorage.getSettings();
    if (settings && typeof settings === 'object') {
      cachedState.settings = { ...cachedState.settings, ...settings };
      console.log('[Emoji Extension] Loaded settings (module):', cachedState.settings);
    }

    let finalEmojisCount = 0;
    cachedState.emojiGroups.forEach((g: any) => { if (g?.emojis?.length) finalEmojisCount += g.emojis.length; });

    console.log('[Emoji Extension] Final cache state (module):', {
      groupsCount: cachedState.emojiGroups.length,
      emojisCount: finalEmojisCount,
      settings: cachedState.settings,
    });
  } catch (error) {
    console.error('[Emoji Extension] Failed to load from storage (module):', error);
    cachedState.emojiGroups = [];
    cachedState.settings = { imageScale: 30, gridColumns: 4 };
  }
}

export function ensureDefaultIfEmpty() {
  if (!Array.isArray(cachedState.emojiGroups) || cachedState.emojiGroups.length === 0) {
    const defaultEmojis = getDefaultEmojis();
    cachedState.emojiGroups = [{ id: 'default', name: '默认表情', icon: '😀', order: 0, emojis: defaultEmojis }];
  }
}
