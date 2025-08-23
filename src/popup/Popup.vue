<template>
  <div class="popup-container bg-white">
    <!-- Header with scale control -->
    <div class="p-3 border-b border-gray-200 bg-gray-50">
      <div class="flex items-center justify-between mb-2">
        <h2 class="text-sm font-semibold text-gray-900">表情管理</h2>
        <button
          @click="openOptions"
          class="p-1 text-gray-500 hover:text-gray-700 rounded"
          title="设置"
        >
          <svg
            class="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            ></path>
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            ></path>
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
    <div
      v-if="emojiStore.settings.showSearchBar"
      class="p-2 border-b border-gray-100"
    >
      <div class="relative">
        <input
          v-model="emojiStore.searchQuery"
          type="text"
          placeholder="搜索表情..."
          class="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
        />
        <svg
          class="absolute right-2 top-1.5 w-4 h-4 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          ></path>
        </svg>
      </div>
    </div>

    <!-- Group Tabs -->
    <GroupTabs
      :groups="emojiStore.sortedGroups"
      :activeGroupId="emojiStore.activeGroupId"
      :setActive="(id: string) => (emojiStore.activeGroupId = id)"
    />

    <!-- Emoji Grid -->
    <EmojiGrid
      :emojis="emojiStore.filteredEmojis"
      :isLoading="emojiStore.isLoading"
      :favorites="emojiStore.favorites"
      :gridColumns="emojiStore.settings.gridColumns"
      :emptyMessage="
        emojiStore.searchQuery ? '没有找到匹配的表情' : '该分组还没有表情'
      "
      :showAddButton="!emojiStore.searchQuery"
      @select="selectEmoji"
      @open-options="openOptions"
    />

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
import GroupTabs from "./components/GroupTabs.vue";
import EmojiGrid from "./components/EmojiGrid.vue";
import { usePopup } from "./usePopup";

const {
  emojiStore,
  localScale,
  showCopyToast,
  updateScale,
  selectEmoji,
  openOptions,
} = usePopup();
</script>

<style>
/* Import TailwindCSS in popup */
@import "../styles/main.css";

/* Popup container base styles */
.popup-container {
  display: flex;
  flex-direction: column;
  width: 320px;
  min-width: 320px;
  max-width: 320px;
  height: 500px;
  min-height: 400px;
  max-height: 600px;
  overflow: hidden;
}

/* Desktop styles - stable dimensions with minimum size enforcement */
@media (min-width: 768px) {
  .popup-container {
    width: auto;
    min-width: 400px;
    max-width: 400px;
    height: auto;
    min-height: 500px;
    max-height: 600px;
  }
}

/* Mobile-specific styles - minimum size with full screen fallback */
@media (max-width: 767px) {
  html,
  body {
    margin: 0;
    padding: 0;
    width: 100%;
    min-width: 400px;
    height: 100%;
    min-height: 400px;
    overflow: hidden;
  }


  .popup-container {
    width: 100%;
    min-width: 200px;
    max-width: 100%;
    height: 100%;
    min-height: 200px;
    max-height: 100%;
  }
}

/* Enforce absolute minimum sizes to prevent extremely small windows */
@media screen {
  .popup-container {
    min-width: 200px !important;
    min-height: 200px !important;
  }
}
</style>
