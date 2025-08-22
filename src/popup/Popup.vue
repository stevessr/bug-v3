<template>
  <div class="w-80 max-h-96 bg-white">
    <!-- Header with scale control -->
    <div class="p-3 border-b border-gray-200 bg-gray-50">
      <div class="flex items-center justify-between mb-2">
        <h2 class="text-sm font-semibold text-gray-900">表情管理</h2>
        <button 
          @click="openOptions"
          class="p-1 text-gray-500 hover:text-gray-700 rounded"
          title="设置"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
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
    <div v-if="emojiStore.settings.showSearchBar" class="p-2 border-b border-gray-100">
      <div class="relative">
        <input
          v-model="emojiStore.searchQuery"
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
    <div class="flex border-b border-gray-100 overflow-x-auto">
  <button
        v-for="group in emojiStore.sortedGroups"
        :key="group.id"
        @click="emojiStore.activeGroupId = group.id"
        :class="[
          'flex-shrink-0 px-3 py-2 text-xs font-medium border-b-2 transition-colors',
          emojiStore.activeGroupId === group.id
            ? 'border-blue-500 text-blue-600 bg-blue-50'
            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
        ]"
      >
        <span class="mr-1">
          <template v-if="isImageUrl(group.icon)">
            <img :src="group.icon" alt="group icon" class="w-4 h-4 object-contain inline-block" />
          </template>
          <template v-else>
            {{ group.icon }}
          </template>
        </span>
        {{ group.name }}
      </button>
    </div>

    <!-- Loading State -->
    <div v-if="emojiStore.isLoading" class="flex items-center justify-center py-8">
      <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
      <span class="ml-2 text-sm text-gray-600">加载中...</span>
    </div>

    <!-- Emoji Grid -->
    <div v-else-if="emojiStore.filteredEmojis.length > 0" class="p-2">
      <div 
        class="grid gap-1 max-h-64 overflow-y-auto"
        :style="{ gridTemplateColumns: `repeat(${emojiStore.settings.gridColumns}, minmax(0, 1fr))` }"
      >
        <button
          v-for="emoji in emojiStore.filteredEmojis"
          :key="emoji.id"
          @click="selectEmoji(emoji)"
          class="relative p-1 rounded hover:bg-gray-100 transition-colors group"
          :title="emoji.name"
        >
          <div class="w-10 h-10 rounded overflow-hidden mx-auto">
            <img
              :src="emoji.url"
              :alt="emoji.name"
              class="w-full h-full object-cover"
              loading="lazy"
            />
          </div>
          <!-- Favorite indicator -->
          <div 
            v-if="emojiStore.favorites.has(emoji.id)"
            class="absolute top-0 right-0 w-3 h-3 bg-yellow-400 rounded-full flex items-center justify-center"
          >
            <svg class="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path>
            </svg>
          </div>
        </button>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="flex flex-col items-center justify-center py-8 text-center">
      <svg class="w-12 h-12 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2M4 13h2m8-8v2m0 6v2"></path>
      </svg>
      <p class="text-sm text-gray-600">{{ emojiStore.searchQuery ? '没有找到匹配的表情' : '该分组还没有表情' }}</p>
      <button 
        v-if="!emojiStore.searchQuery"
        @click="openOptions"
        class="mt-2 text-xs text-blue-600 hover:text-blue-800"
      >
        去添加表情
      </button>
    </div>

    <!-- Copy Success Toast -->
    <div
      v-if="showCopyToast"
      class="fixed bottom-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 text-sm animate-pulse"
    >
      链接已复制到剪贴板
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useEmojiStore } from '../stores/emojiStore';
import type { Emoji } from '../types/emoji';
import { isImageUrl } from '../utils/isImageUrl'

const emojiStore = useEmojiStore();
const localScale = ref(100);
const showCopyToast = ref(false);

// ...use shared isImageUrl from utils

onMounted(async () => {
  await emojiStore.loadData();
  localScale.value = emojiStore.settings.imageScale;
});

watch(() => emojiStore.settings.imageScale, (newScale) => {
  localScale.value = newScale;
});

const updateScale = () => {
  emojiStore.updateSettings({ imageScale: localScale.value });
};

const selectEmoji = (emoji: Emoji) => {
  // Copy to clipboard - use stored scale, not popup display scale
  const scale = emojiStore.settings.imageScale;
  const match = emoji.url.match(/_(\d{3,})x(\d{3,})\./);
  let width = '500';
  let height = '500';
  if (match) {
    width = match[1];
    height = match[2];
  } else if (emoji.width && emoji.height) {
    width = emoji.width.toString();
    height = emoji.height.toString();
  }
  
  const emojiMarkdown = `![${emoji.name}|${width}x${height},${scale}%](${emoji.url}) `;
  
  // Try to copy to clipboard
  navigator.clipboard.writeText(emojiMarkdown).then(() => {
    console.log('Emoji copied to clipboard');
    // 显示复制成功提示，不关闭弹窗
    showCopyToast.value = true;
    setTimeout(() => {
      showCopyToast.value = false;
    }, 2000);
  }).catch(() => {
    // Fallback: send message to content script
    const chromeApi = (window as any).chrome;
    if (chromeApi && chromeApi.tabs) {
      chromeApi.tabs.query({ active: true, currentWindow: true }, (tabs: any) => {
        if (tabs[0] && tabs[0].id) {
          chromeApi.tabs.sendMessage(tabs[0].id, {
            type: 'INSERT_EMOJI',
            emoji: emoji,
            scale: scale
          });
          // 显示插入成功提示
          showCopyToast.value = true;
          setTimeout(() => {
            showCopyToast.value = false;
          }, 2000);
        }
      });
    }
  });

  // Add to favorites using smart tracking
  emojiStore.addToFavorites(emoji);

  // 不要立即关闭弹窗，让用户可以继续选择表情
  // window.close();  // 注释掉这行
};

const openOptions = () => {
  const chromeApi = (window as any).chrome;
  if (chromeApi && chromeApi.runtime) {
    chromeApi.runtime.openOptionsPage();
  }
};
</script>

<style>
/* Import TailwindCSS in popup */
@import '../styles/main.css';
</style>
