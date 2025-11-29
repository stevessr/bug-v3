<script setup lang="ts">
import { computed } from 'vue'

import LazyEmojiGrid from '../popup/components/LazyEmojiGrid.vue'
import { usePopup } from '../popup/usePopup'

const { emojiStore, showCopyToast, selectEmoji, openOptions } = usePopup({ manageUrl: false })

const setActiveHandler = (id: string) => {
  emojiStore.activeGroupId = id
  emojiStore.updateSettings({ defaultGroup: id })
}

const activeGroup = computed(() => {
  return emojiStore.sortedGroups.find(g => g.id === emojiStore.activeGroupId)
})

const filterOption = (input: string, option: any) => {
  return option.label.toLowerCase().includes(input.toLowerCase())
}
</script>

<template>
  <a-config-provider
    :theme="{
      token: {}
    }"
  >
    <div class="sidebar-container bg-white dark:bg-gray-900">
      <!-- 搜索和分组选择 -->
      <div class="p-2 border-b border-gray-100 dark:border-gray-700 space-y-2">
        <!-- 表情搜索 -->
        <div v-if="emojiStore.settings.showSearchBar" class="relative">
          <a-input
            v-model:value="emojiStore.searchQuery"
            type="text"
            placeholder="搜索表情..."
            title="搜索表情"
            class="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 dark:bg-black dark:text-white dark:border-gray-600"
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
        <!-- 分组选择 -->
        <a-select
          v-model:value="emojiStore.activeGroupId"
          showSearch
          placeholder="选择分组"
          class="w-full"
          :filterOption="filterOption"
          @change="setActiveHandler"
        >
          <a-select-option
            v-for="g in emojiStore.sortedGroups"
            :key="g.id"
            :value="g.id"
            :label="g.name"
          >
            <img
              v-if="g.icon.startsWith('http') || g.icon.startsWith('data:')"
              :src="g.icon"
              class="w-4 h-4 inline-block mr-2"
            />
            <span v-else class="inline-block mr-2">{{ g.icon }}</span>
            {{ g.name }}
          </a-select-option>
        </a-select>
      </div>

      <!-- 表情网格 -->
      <div class="sidebar-body">
        <template v-if="emojiStore.searchQuery">
          <LazyEmojiGrid
            :emojis="emojiStore.filteredEmojis"
            :isLoading="emojiStore.isLoading"
            :favorites="emojiStore.favorites"
            :gridColumns="emojiStore.settings.gridColumns"
            :emptyMessage="'没有找到匹配的表情'"
            :showAddButton="false"
            groupId="search"
            isActive
            @select="selectEmoji"
            @openOptions="openOptions"
          />
        </template>
        <template v-else-if="activeGroup">
          <LazyEmojiGrid
            :key="activeGroup.id"
            :emojis="activeGroup.emojis || []"
            :isLoading="emojiStore.isLoading"
            :favorites="emojiStore.favorites"
            :gridColumns="emojiStore.settings.gridColumns"
            :emptyMessage="'该分组还没有表情'"
            showAddButton
            :groupId="activeGroup.id"
            :isActive="true"
            @select="selectEmoji"
            @openOptions="openOptions"
          />
        </template>
      </div>

      <!-- 复制成功提示 -->
      <div
        v-if="showCopyToast"
        class="fixed bottom-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 text-sm animate-pulse"
      >
        链接已复制到剪贴板
      </div>
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
}

.sidebar-container {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 100vh;
  max-width: 100%;
  max-height: 100%;
  min-width: 200px;
  min-height: 200px;
  box-sizing: border-box;
  overflow: auto;
}

.sidebar-body {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
}

.sidebar-body > * {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
}

@media (min-width: 768px) {
  .sidebar-container {
    width: 100%;
    height: 100%;
    min-width: 400px;
    min-height: 500px;
  }
}

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

  .sidebar-container {
    width: 100%;
    height: 100%;
    min-width: 200px;
    min-height: 200px;
  }
}

@media screen {
  .sidebar-container {
    min-width: 200px !important;
    min-height: 200px !important;
  }
}
</style>
