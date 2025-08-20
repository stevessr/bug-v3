<template>
  <div class="container">
    <h1>Emoji Extension</h1>

    <!-- Loading state -->
    <div v-if="emojiStore.isLoading" class="loading">
      <div class="loading-spinner"></div>
      <p>加载表情数据中...</p>
    </div>

    <!-- Emoji grid -->
    <div v-else-if="emojiStore.areEmojisLoaded" class="emoji-grid">
      <img
        v-for="emoji in emojiStore.emojis"
        :key="emoji.packet"
        :src="emoji.url"
        :alt="emoji.name"
        :title="emoji.name"
        @click="handleEmojiClick(emoji)"
      />
    </div>

    <!-- Error state (if no emojis loaded and not loading) -->
    <div v-else class="error">
      <p>加载表情数据失败</p>
      <button @click="emojiStore.loadEmojis()">重试</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useEmojiStore } from '../store/useEmojiStore';
import { Emoji } from '../store/emoji-data';

const emojiStore = useEmojiStore();

// Load emojis when component is mounted
onMounted(async () => {
  await emojiStore.loadEmojis();
});

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

/* Loading state styles */
.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  text-align: center;
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #f3f3f3;
  border-top: 3px solid #3498db;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.loading p {
  margin: 0;
  color: #666;
  font-size: 14px;
}

/* Error state styles */
.error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  text-align: center;
}

.error p {
  margin: 0 0 16px 0;
  color: #e74c3c;
  font-size: 14px;
}

.error button {
  background-color: #3498db;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.2s;
}

.error button:hover {
  background-color: #2980b9;
}
</style>
