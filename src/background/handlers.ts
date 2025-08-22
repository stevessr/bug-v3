import { getChromeAPI } from './utils';

export function setupMessageListener() {
  const chromeAPI = getChromeAPI();
  if (chromeAPI && chromeAPI.runtime && chromeAPI.runtime.onMessage) {
    chromeAPI.runtime.onMessage.addListener((message: any, _sender: any, sendResponse: any) => {
      console.log('Background received message:', message);

      switch (message.type) {
        case 'GET_EMOJI_DATA':
          handleGetEmojiData(sendResponse);
          return true;

        case 'SAVE_EMOJI_DATA':
          handleSaveEmojiData(message.data, sendResponse);
          return true;

        case 'SYNC_SETTINGS':
          handleSyncSettings(message.settings, sendResponse);
          return true;

        default:
          console.log('Unknown message type:', message.type);
          sendResponse({ success: false, error: 'Unknown message type' });
      }

      if (message.action) {
        switch (message.action) {
          case 'addToFavorites':
            handleAddToFavorites(message.emoji, sendResponse);
            return true;

          default:
            console.log('Unknown action:', message.action);
            sendResponse({ success: false, error: 'Unknown action' });
        }
      }
    });
  }
}

export async function handleAddToFavorites(emoji: any, sendResponse: (response: any) => void) {
  const chromeAPI = getChromeAPI();
  if (!chromeAPI || !chromeAPI.storage) {
    sendResponse({ success: false, error: 'Chrome storage API not available' });
    return;
  }

  try {
    const data = await chromeAPI.storage.local.get(['emojiGroups']);
    const groups = data.emojiGroups || [];
    const favoritesGroup = groups.find((g: any) => g.id === 'favorites');
    if (!favoritesGroup) {
      console.warn('Favorites group not found');
      sendResponse({ success: false, error: 'Favorites group not found' });
      return;
    }

    const now = Date.now();
    const existingEmojiIndex = favoritesGroup.emojis.findIndex((e: any) => e.url === emoji.url);

    if (existingEmojiIndex !== -1) {
      const existingEmoji = favoritesGroup.emojis[existingEmojiIndex];
      const lastUsed = existingEmoji.lastUsed || 0;
      const timeDiff = now - lastUsed;
      const twelveHours = 12 * 60 * 60 * 1000;

      if (timeDiff < twelveHours) {
        existingEmoji.usageCount = (existingEmoji.usageCount || 0) + 1;
        console.log('Updated usage count for existing emoji:', emoji.name, 'count:', existingEmoji.usageCount);
      } else {
        const currentCount = existingEmoji.usageCount || 1;
        existingEmoji.usageCount = Math.floor(currentCount * 0.8) + 1;
        existingEmoji.lastUsed = now;
        console.log('Applied usage decay and updated timestamp for emoji:', emoji.name, 'new count:', existingEmoji.usageCount);
      }
    } else {
      const favoriteEmoji = {
        ...emoji,
        id: `fav-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        groupId: 'favorites',
        usageCount: 1,
        lastUsed: now,
        addedAt: now
      };

      favoritesGroup.emojis.push(favoriteEmoji);
      console.log('Added new emoji to favorites:', emoji.name);
    }

    favoritesGroup.emojis.sort((a: any, b: any) => (b.lastUsed || 0) - (a.lastUsed || 0));

    await chromeAPI.storage.local.set({ emojiGroups: groups });

    sendResponse({ success: true, message: 'Added to favorites' });
  } catch (error) {
    console.error('Failed to add emoji to favorites:', error);
    sendResponse({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

export async function handleGetEmojiData(sendResponse: (response: any) => void) {
  const chromeAPI = getChromeAPI();
  if (!chromeAPI || !chromeAPI.storage) {
    sendResponse({ success: false, error: 'Chrome storage API not available' });
    return;
  }

  try {
    const data = await chromeAPI.storage.local.get(['emojiGroups', 'appSettings', 'favorites']);
    sendResponse({
      success: true,
      data: {
        groups: data.emojiGroups || [],
        settings: data.appSettings || {},
        favorites: data.favorites || []
      }
    });
  } catch (error: any) {
    console.error('Failed to get emoji data:', error);
    sendResponse({ success: false, error: error.message });
  }
}

export async function handleSaveEmojiData(data: any, sendResponse: (response: any) => void) {
  const chromeAPI = getChromeAPI();
  if (!chromeAPI || !chromeAPI.storage) {
    sendResponse({ success: false, error: 'Chrome storage API not available' });
    return;
  }

  try {
    await chromeAPI.storage.local.set(data);
    sendResponse({ success: true });
  } catch (error: any) {
    console.error('Failed to save emoji data:', error);
    sendResponse({ success: false, error: error.message });
  }
}

export async function handleSyncSettings(settings: any, sendResponse: (response: any) => void) {
  const chromeAPI = getChromeAPI();
  if (!chromeAPI || !chromeAPI.storage || !chromeAPI.tabs) {
    sendResponse({ success: false, error: 'Chrome API not available' });
    return;
  }

  try {
    await chromeAPI.storage.local.set({ appSettings: settings });

    const tabs = await chromeAPI.tabs.query({});
    for (const tab of tabs) {
      if (tab.id) {
        chromeAPI.tabs.sendMessage(tab.id, {
          type: 'SETTINGS_UPDATED',
          settings: settings
        }).catch(() => {
          // Ignore errors for tabs that don't have content script
        });
      }
    }

    sendResponse({ success: true });
  } catch (error: any) {
    console.error('Failed to sync settings:', error);
    sendResponse({ success: false, error: error.message });
  }
}

export function setupStorageChangeListener() {
  const chromeAPI = getChromeAPI();
  if (chromeAPI && chromeAPI.storage && chromeAPI.storage.onChanged) {
    chromeAPI.storage.onChanged.addListener((changes: any, namespace: any) => {
      console.log('Storage changed:', changes, namespace);
      // Placeholder for cloud sync or other reactions
    });
  }
}

export function setupContextMenu() {
  const chromeAPI = getChromeAPI();
  if (chromeAPI && chromeAPI.runtime && chromeAPI.runtime.onInstalled && chromeAPI.contextMenus) {
    chromeAPI.runtime.onInstalled.addListener(() => {
      if (chromeAPI.contextMenus && chromeAPI.contextMenus.create) {
        chromeAPI.contextMenus.create({
          id: 'open-emoji-options',
          title: '表情管理',
          contexts: ['page']
        });
      }
    });

    if (chromeAPI.contextMenus.onClicked) {
      chromeAPI.contextMenus.onClicked.addListener((info: any, _tab: any) => {
        if (info.menuItemId === 'open-emoji-options' && chromeAPI.runtime && chromeAPI.runtime.openOptionsPage) {
          chromeAPI.runtime.openOptionsPage();
        }
      });
    }
  }
}

export function setupPeriodicCleanup() {
  setInterval(async () => {
    const chromeAPI = getChromeAPI();
    if (!chromeAPI || !chromeAPI.storage) return;

    try {
      const data = await chromeAPI.storage.local.get(['emojiGroups']);
      if (data.emojiGroups) {
        console.log('Storage cleanup check completed');
      }
    } catch (error) {
      console.error('Storage cleanup error:', error);
    }
  }, 24 * 60 * 60 * 1000);
}
