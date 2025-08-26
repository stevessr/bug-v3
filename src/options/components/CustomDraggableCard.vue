<template>
  <div class="custom-card">
    <div class="card-header">
      <span>{{ group.displayName }}</span>
    </div>
    <div class="card-cover">
      <img v-if="isLikelyUrl(group.icon.toString())" :src="group.icon.toString()" alt="Group Icon" class="cover-image" />
      <div v-else class="cover-text">
        {{ group.icon }}
      </div>
    </div>
    <div class="card-meta">
      <span>UUID: {{ group.UUID }}</span>
      <span>Emojis: {{ group.emojis.length }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { isLikelyUrl } from '../utils/isLikelyUrl';
import type { EmojiGroup } from '../../data/type/emoji/emoji';

defineProps<{
  group: EmojiGroup;
}>();
</script>

<style scoped>
.custom-card {
  border: 1px solid #d9d9d9;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.09);
  transition: box-shadow 0.3s;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  cursor: grab;
}

.custom-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.card-header {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  font-weight: 500;
  border-bottom: 1px solid #f0f0f0;
}


.card-cover {
  height: 150px;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: #f5f5f5;
}

.cover-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-text {
  font-size: 48px;
}

.card-meta {
  padding: 12px 16px;
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #888;
  border-top: 1px solid #f0f0f0;
}
</style>