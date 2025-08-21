<template>
  <div class="emoji-picker-container bg-white border border-gray-200 rounded-lg shadow-lg w-80 max-h-96">
    <!-- Header -->
    <div class="p-3 border-b border-gray-200 bg-gray-50">
      <div class="flex items-center justify-between mb-2">
        <h3 class="text-sm font-semibold text-gray-900">表情选择器</h3>
        <button 
          @click="$emit('close')"
          class="p-1 text-gray-500 hover:text-gray-700 rounded"
          title="关闭"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>
      
      <!-- Scale Control -->
      <div class="flex items-center gap-2 text-xs">
        <span class="text-gray-600">缩放:</span>
        <input
          v-model.number="localScale"
          type="range"
          min="5"
          max="150"
          step="5"
          class="flex-1 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          @input="updateScale"
        />
        <span class="w-10 text-right text-gray-600">{{ localScale }}%</span>
      </div>
    </div>

    <!-- Search Bar -->
    <div class="p-2 border-b border-gray-100">
      <div class="relative">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="搜索表情..."
          class="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
        />
        <svg class="absolute right-2 top-1.5 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
        </svg>
      </div>
    </div>

    <!-- Group Tabs -->
    <div class="flex border-b border-gray-100 overflow-x-auto emoji-picker__sections-nav py-1 px-1">
      <button
        v-for="group in sortedGroups"
        :key="group.id"
        @click="activeGroupId = group.id"
        :class="[
          'btn no-text btn-flat emoji-picker__section-btn',
          activeGroupId === group.id ? 'active border-blue-500 bg-blue-50' : 'border-transparent',
          'flex-shrink-0 w-10 h-10 flex items-center justify-center rounded transition-colors mx-1'
        ]"
        :tabindex="activeGroupId === group.id ? 0 : -1"
        :data-section="group.id"
        type="button"
      >
        <template v-if="group.icon && group.icon.startsWith('http')">
          <img :src="group.icon" width="24" height="24" class="emoji" :alt="group.name" />
        </template>
        <template v-else>
          <span class="text-xl">{{ group.icon }}</span>
        </template>
      </button>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="flex items-center justify-center py-8">
      <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
      <span class="ml-2 text-sm text-gray-600">加载中...</span>
    </div>

    <!-- Emoji Grid -->
    <div v-else-if="filteredEmojis.length > 0" class="p-2">
      <div class="grid grid-cols-4 gap-1 max-h-64 overflow-y-auto emoji-picker__section-emojis">
        <button
          v-for="emoji in filteredEmojis"
          :key="emoji.id"
          @click="selectEmoji(emoji)"
          class="relative p-1 rounded hover:bg-gray-100 transition-colors group"
          :title="emoji.name"
        >
          <img
            :src="emoji.url"
            :alt="emoji.name"
            width="32"
            height="32"
            class="object-contain mx-auto emoji"
            loading="lazy"
          />
        </button>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="flex flex-col items-center justify-center py-8 text-center">
      <svg class="w-12 h-12 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2M4 13h2m8-8v2m0 6v2"></path>
      </svg>
      <p class="text-sm text-gray-600">{{ searchQuery ? '没有找到匹配的表情' : '该分组还没有表情' }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useEmojiStore } from '../src/stores/emojiStore';
import type { Emoji } from '../src/types/emoji';

// Props and emits
defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  select: [emoji: Emoji];
  close: [];
}>();

// Store
const emojiStore = useEmojiStore();

// Local state
const localScale = ref(100);
const searchQuery = ref('');
const activeGroupId = ref('nachoneko');
const isLoading = ref(true);

// Computed
const activeGroup = computed(() => 
  emojiStore.groups.find(g => g.id === activeGroupId.value) || emojiStore.groups[0]
);

const filteredEmojis = computed(() => {
  if (!activeGroup.value) return [];
  
  let emojis = activeGroup.value.emojis;
  
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    emojis = emojis.filter(emoji => 
      emoji.name.toLowerCase().includes(query)
    );
  }
  
  return emojis;
});

const sortedGroups = computed(() => 
  [...emojiStore.groups].sort((a, b) => a.order - b.order)
);

// Methods
const updateScale = () => {
  emojiStore.updateSettings({ imageScale: localScale.value });
};

const selectEmoji = (emoji: Emoji) => {
  emit('select', emoji);
  emit('close');
};

// Lifecycle
onMounted(async () => {
  isLoading.value = true;
  await emojiStore.loadData();
  localScale.value = emojiStore.settings.imageScale;
  activeGroupId.value = emojiStore.settings.defaultGroup;
  isLoading.value = false;
});

// Watch for settings changes
watch(() => emojiStore.settings.imageScale, (newScale) => {
  localScale.value = newScale;
});
</script>

<style>
/* Import TailwindCSS for content script */
@import '../src/styles/main.css';

/* Additional emoji picker specific styles */
.emoji-picker-container {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
</style>
