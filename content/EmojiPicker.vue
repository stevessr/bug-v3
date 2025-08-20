<template>
  <div class="emoji-picker-container">
    <div class="emoji-picker">
      <div class="emoji-grid">
        <button
          class="emoji-button"
          v-for="emoji in emojiSet"
          :key="emoji.name"
          @click="selectEmoji(emoji)"
        >
          <img :src="emoji.url" :alt="emoji.name" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { emojiSet, Emoji } from "../store/emoji-data";

defineProps<{
  visible: boolean;
}>();

const emit = defineEmits(["select", "close"]);

const selectEmoji = (emoji: Emoji) => {
  const textarea = document.querySelector(
    ".d-editor-input"
  ) as HTMLTextAreaElement;
  if (textarea) {
    const emojiMarkdown = `![${emoji.name}|${emoji.width || 'auto'}x${emoji.height || 'auto'}](${emoji.url}) `;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    textarea.value =
      textarea.value.substring(0, start) +
      emojiMarkdown +
      textarea.value.substring(end);
    textarea.selectionStart = textarea.selectionEnd = start + emojiMarkdown.length;
    textarea.focus();
  }
  emit("select", emoji);
  emit("close");
};
</script>

<style scoped>
.emoji-picker-container {
  position: absolute;
  z-index: 10001;
  border: 1px solid #ddd;
  border-radius: 8px;
  background-color: #fff;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  width: 320px;
  height: 250px;
  overflow-y: auto;
  padding: 8px;
}

.emoji-picker {
  display: flex;
  flex-direction: column;
}

.emoji-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(40px, 1fr));
  gap: 4px;
}

.emoji-button {
  background: none;
  border: 1px solid transparent;
  padding: 2px;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 40px;
}

.emoji-button:hover {
  background-color: #f0f0f0;
  border-color: #ccc;
}

.emoji-button img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}
</style>
