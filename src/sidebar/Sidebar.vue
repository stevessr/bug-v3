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

// 虛擬分組配置
const virtualGroups = computed(() => [
  {
    id: 'all-emojis',
    name: '所有表情',
    icon: '🔍',
    isVirtual: true
  }
])

// 組合所有分組（虛擬 + 真實）
const allGroups = computed(() => [
  ...virtualGroups.value,
  ...emojiStore.sortedGroups
])

// 判斷是否為虛擬分組
const isVirtualGroup = (groupId: string) => {
  return virtualGroups.value.some(g => g.id === groupId)
}

// 獲取當前分組的表情
const getCurrentGroupEmojis = (groupId: string) => {
  if (groupId === 'all-emojis') {
    // 返回所有表情
    const allEmojis = []
    for (const group of emojiStore.sortedGroups) {
      allEmojis.push(...(group.emojis || []))
    }
    return allEmojis
  }
  const group = emojiStore.sortedGroups.find(g => g.id === groupId)
  return group ? group.emojis || [] : []
}

// 處理表情點擊
const handleEmojiClick = (emoji: any) => {
  selectEmoji(emoji)
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
          <!-- 虛擬分組 -->
          <a-select-option
            v-for="g in virtualGroups"
            :key="g.id"
            :value="g.id"
            :label="g.name"
          >
            <span class="inline-block mr-2">{{ g.icon }}</span>
            {{ g.name }}
            <span class="text-xs text-gray-400 ml-2">（虛擬分組）</span>
          </a-select-option>

          <!-- 真實分組 -->
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
        <!-- 搜索模式 -->
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

        <!-- 虛擬分組 - 所有表情 -->
        <template v-else-if="emojiStore.activeGroupId === 'all-emojis'">
          <div class="p-3">
            <div class="text-sm text-gray-500 dark:text-gray-400 mb-3">
              🔍 展示所有分組的表情，支持按名稱或標籤搜索
            </div>
            <LazyEmojiGrid
              :emojis="getCurrentGroupEmojis('all-emojis')"
              :isLoading="emojiStore.isLoading"
              :favorites="emojiStore.favorites"
              :gridColumns="emojiStore.settings.gridColumns"
              :emptyMessage="'暫無表情'"
              :showAddButton="false"
              groupId="all-emojis"
              isActive
              @select="selectEmoji"
              @openOptions="openOptions"
            />
          </div>
        </template>

        <!-- 普通分組 -->
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
            isActive
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
