import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import type { Emoji } from './emoji-data';

export const useEmojiStore = defineStore('emoji', () => {
  const emojis = ref<Emoji[]>([]);
  const areEmojisLoaded = ref(false);
  const isLoading = ref(false);

  // Promise wrapper for chrome.storage.sync.get
  const getStorageData = (keys: string | string[]): Promise<{ [key: string]: any }> => {
    return new Promise((resolve) => {
      chrome.storage.sync.get(keys, resolve);
    });
  };

  // Promise wrapper for chrome.storage.sync.set
  const setStorageData = (data: { [key: string]: any }): Promise<void> => {
    return new Promise((resolve) => {
      chrome.storage.sync.set(data, resolve);
    });
  };

  // Load emojis from storage or dynamically import default set
  const loadEmojis = async () => {
    if (areEmojisLoaded.value || isLoading.value) {
      return;
    }

    isLoading.value = true;
    try {
      const data = await getStorageData('emojis');
      if (data.emojis && data.emojis.length > 0) {
        emojis.value = data.emojis;
      } else {
        // Dynamically import default emoji set only when needed
        const { emojiSet: defaultEmojiSet } = await import('./emoji-data');
        emojis.value = defaultEmojiSet;
      }
      areEmojisLoaded.value = true;
    } catch (error) {
      console.error('Failed to load emojis:', error);
      // Fallback to empty array if everything fails
      emojis.value = [];
      areEmojisLoaded.value = true;
    } finally {
      isLoading.value = false;
    }
  };

  // Watch for changes and save to storage
  watch(emojis, async (newEmojis) => {
    try {
      await setStorageData({ emojis: newEmojis });
    } catch (error) {
      console.error('Failed to save emojis:', error);
    }
  }, { deep: true });

  function addEmoji(emoji: Omit<Emoji, 'packet'>) {
    const newPacket = emojis.value.length > 0 ? Math.max(...emojis.value.map(e => e.packet)) + 1 : 1;
    emojis.value.push({ ...emoji, packet: newPacket });
  }

  function updateEmoji(updatedEmoji: Emoji) {
    const index = emojis.value.findIndex(e => e.packet === updatedEmoji.packet);
    if (index !== -1) {
      emojis.value[index] = updatedEmoji;
    }
  }

  function deleteEmoji(packet: number) {
    emojis.value = emojis.value.filter(e => e.packet !== packet);
  }

  return {
    emojis,
    areEmojisLoaded,
    isLoading,
    loadEmojis,
    addEmoji,
    updateEmoji,
    deleteEmoji
  };
});
