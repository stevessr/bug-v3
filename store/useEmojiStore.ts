import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import { Emoji, emojiSet as defaultEmojiSet } from './emoji-data';

export const useEmojiStore = defineStore('emoji', () => {
  const emojis = ref<Emoji[]>([]);

  // Load emojis from storage or use default set
  chrome.storage.sync.get('emojis', (data) => {
    if (data.emojis) {
      emojis.value = data.emojis;
    } else {
      emojis.value = defaultEmojiSet;
    }
  });

  // Watch for changes and save to storage
  watch(emojis, (newEmojis) => {
    chrome.storage.sync.set({ emojis: newEmojis });
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

  return { emojis, addEmoji, updateEmoji, deleteEmoji };
});
