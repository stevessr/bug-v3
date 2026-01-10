<script setup lang="ts">
/**
 * AI Agent Popup Window
 * A standalone popup window for the AI Agent that doesn't refresh when switching tabs.
 */
import { onMounted } from 'vue'
import { useEmojiStore } from '@/stores/emojiStore'

import AIAgent from './AIAgent.vue'

const emojiStore = useEmojiStore()

onMounted(async () => {
  // Enable read-only mode to prevent data corruption
  emojiStore.setReadOnlyMode(true)
  await emojiStore.loadData()
})
</script>

<template>
  <a-config-provider
    :theme="{
      token: {}
    }"
  >
    <div class="agent-popup-container bg-white dark:bg-gray-900">
      <AIAgent />
    </div>
  </a-config-provider>
</template>

<style>
@import '../styles/main.css';

html,
body,
#app {
  height: 100%;
  margin: 0;
  overflow: hidden;
}

.agent-popup-container {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100vh;
  min-height: 100%;
  box-sizing: border-box;
  overflow: hidden;
}

/* Make sure the AI Agent fills the container */
.agent-popup-container > * {
  flex: 1;
  min-height: 0;
}
</style>
