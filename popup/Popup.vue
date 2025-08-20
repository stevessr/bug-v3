<template>
  <div class="container">
    <h1>Emoji Extension</h1>
    <div class="emoji-grid">
      <img
        v-for="emoji in emojiStore.emojis"
        :key="emoji.packet"
        :src="emoji.url"
        :alt="emoji.name"
        :title="emoji.name"
        @click="handleEmojiClick(emoji)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useEmojiStore } from '../store/useEmojiStore';
import { Emoji } from '../store/emoji-data';

const emojiStore = useEmojiStore();

function handleEmojiClick(emoji: Emoji) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0] && tabs[0].id) {
      chrome.tabs.sendMessage(tabs[0].id, {
        type: 'INSERT_EMOJI',
        emoji: emoji,
      });
      window.close(); // Close the popup after selection
    }
  });
}
</script>

<style scoped>
.container {
  width: 300px;
  max-height: 400px;
  padding: 10px;
  overflow-y: auto;
}

.emoji-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}

.emoji-grid img {
  cursor: pointer;
  width: 100%;
  height: auto;
  border-radius: 5px;
  transition: transform 0.2s;
}

.emoji-grid img:hover {
  transform: scale(1.1);
}
</style>
