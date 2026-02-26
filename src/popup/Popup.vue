<script setup lang="ts">
import { ConfigProvider as AConfigProvider } from 'ant-design-vue'

import GroupTabs from './components/GroupTabs.vue'
import LazyEmojiGrid from './components/LazyEmojiGrid.vue'
import { usePopup } from './usePopup'

import ErrorBoundary from '@/components/ErrorBoundary.vue'

const { t, initI18n } = useI18n()

// 初始化 i18n
initI18n()

const {
  emojiStore,
  localScale,
  showCopyToast,
  updateScale,
  selectEmoji,
  openOptions,
  openSidebar
} = usePopup()

const setActiveHandler = (id: string) => {
  emojiStore.activeGroupId = id
  // Persist selected tab as defaultGroup so next time popup opens it remains selected
  emojiStore.updateSettings({ defaultGroup: id })
}

// 在新窗口打开设置页面
const openOptionsInNewWindow = () => {
  // Open options in new window using query params: ?type=options&tabs=groups
  const url = chrome.runtime.getURL('index.html?type=options&tabs=groups')
  chrome.tabs.create({ url })
}

const openDiscourseBrowser = () => {
  const url = chrome.runtime.getURL('discourse.html')
  chrome.tabs.create({ url })
}
</script>

<template>
  <AConfigProvider>
    <ErrorBoundary />
    <div class="popup-container">
      <!-- Header with scale control -->
      <div class="popup-header">
        <div class="popup-header-row">
          <h2 class="popup-title">
            {{ t('emojiManagement') }}
          </h2>
          <div class="popup-header-actions">
            <a-button
              @click="openOptions"
              class="popup-icon-btn"
              :title="t('settings')"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            </a-button>
            <a-button
              @click="openOptionsInNewWindow"
              class="popup-icon-btn"
              :title="t('openInNewWindow')"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                ></path>
              </svg>
            </a-button>
            <a-button
              @click="openDiscourseBrowser"
              class="popup-icon-btn"
              :title="t('openDiscourseBrowser')"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 3c4.418 0 8 2.239 8 5s-3.582 5-8 5-8-2.239-8-5 3.582-5 8-5zM4 13c0 2.761 3.582 5 8 5s8-2.239 8-5"
                ></path>
              </svg>
            </a-button>
            <a-button
              @click="openSidebar"
              class="popup-icon-btn"
              :title="t('openSidebar')"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                ></path>
              </svg>
            </a-button>
          </div>
        </div>

        <!-- Scale Control -->
        <div class="popup-scale-control">
          <span class="popup-scale-label">{{ t('zoom') }}：</span>
          <input
            v-model.number="localScale"
            type="range"
            min="5"
            max="150"
            step="5"
            :title="t('zoomTitle')"
            class="popup-scale-slider"
            @input="updateScale"
            role="slider"
            :aria-label="t('zoomControl')"
            aria-valuemin="5"
            aria-valuemax="150"
            :aria-valuenow="localScale"
          />
          <span class="popup-scale-value">{{ localScale }}%</span>
        </div>
      </div>

      <!-- Search Bar -->
      <div v-if="emojiStore.settings.showSearchBar" class="popup-search">
        <div class="popup-search-wrapper">
          <input
            v-model="emojiStore.searchQuery"
            type="text"
            :placeholder="t('searchEmojis')"
            :title="t('searchEmojisTitle')"
            class="popup-search-input"
          />
          <svg
            class="popup-search-icon"
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
        :setActive="setActiveHandler"
      />

      <!-- Lazy Emoji Grids: 只渲染当前活动分组，真正的虚拟化 -->
      <div class="popup-body">
        <!-- 搜索模式：使用过滤后的表情 -->
        <template v-if="emojiStore.searchQuery">
          <LazyEmojiGrid
            :emojis="emojiStore.filteredEmojis"
            :isLoading="emojiStore.isLoading"
            :favorites="emojiStore.favorites"
            :gridColumns="emojiStore.settings.gridColumns"
            :emptyMessage="t('noMatchingEmojis')"
            :showAddButton="false"
            groupId="search"
            isActive
            @select="selectEmoji"
            @openOptions="openOptions"
          />
        </template>

        <!-- 正常模式：只渲染当前活动分组（真正的虚拟化） -->
        <template v-else>
          <LazyEmojiGrid
            :key="emojiStore.activeGroupId"
            :emojis="emojiStore.activeGroup?.emojis || []"
            :isLoading="emojiStore.isLoading"
            :favorites="emojiStore.favorites"
            :gridColumns="emojiStore.settings.gridColumns"
            :emptyMessage="t('groupHasNoEmojis')"
            showAddButton
            :groupId="emojiStore.activeGroupId"
            isActive
            @select="selectEmoji"
            @openOptions="openOptions"
          />
        </template>
      </div>

      <!-- Copy Success Toast -->
      <div
        v-if="showCopyToast"
        class="popup-toast"
      >
        {{ t('linkCopiedToClipboard') }}
      </div>
    </div>
  </AConfigProvider>
</template>

<style>
/* Import TailwindCSS in popup */
@import '../styles/main.css';

/* Ensure page and app root fill the viewport so child 100% heights work */
html,
body,
#app {
  height: 100%;
  margin: 0;
}

/* Popup container base styles - MD3 themed */
.popup-container {
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
  background-color: var(--md3-surface);
  color: var(--md3-on-surface);
}

/* Header - MD3 themed */
.popup-header {
  padding: 0.75rem;
  border-bottom: 1px solid var(--md3-outline-variant);
  background-color: var(--md3-surface-container-low);
}

.popup-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}

.popup-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--md3-on-surface);
}

.popup-header-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.popup-icon-btn {
  padding: 0.25rem;
  color: var(--md3-on-surface-variant);
  background-color: transparent;
  border-radius: 0.25rem;
  transition: background-color 0.2s, color 0.2s;
}

.popup-icon-btn:hover {
  color: var(--md3-on-surface);
  background-color: var(--md3-surface-container-high);
}

/* Scale Control - MD3 themed */
.popup-scale-control {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
}

.popup-scale-label {
  color: var(--md3-on-surface-variant);
}

.popup-scale-slider {
  flex: 1;
  height: 0.25rem;
  background-color: var(--md3-surface-container-highest);
  border-radius: 0.25rem;
  appearance: none;
  cursor: pointer;
  outline: none;
}

.popup-scale-slider:focus {
  outline: 2px solid var(--md3-primary);
  outline-offset: 2px;
}

.popup-scale-slider::-webkit-slider-thumb {
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background-color: var(--md3-primary);
  cursor: pointer;
  border: 2px solid var(--md3-on-primary);
}

.popup-scale-slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background-color: var(--md3-primary);
  cursor: pointer;
  border: 2px solid var(--md3-on-primary);
}

.popup-scale-value {
  width: 2.5rem;
  text-align: right;
  color: var(--md3-on-surface-variant);
}

/* Search Bar - MD3 themed */
.popup-search {
  padding: 0.5rem;
  border-bottom: 1px solid var(--md3-outline-variant);
}

.popup-search-wrapper {
  position: relative;
}

.popup-search-input {
  width: 100%;
  padding: 0.375rem 0.75rem;
  padding-right: 2rem;
  font-size: 0.875rem;
  border: 1px solid var(--md3-outline);
  border-radius: 0.375rem;
  background-color: var(--md3-surface);
  color: var(--md3-on-surface);
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.popup-search-input::placeholder {
  color: var(--md3-on-surface-variant);
}

.popup-search-input:focus {
  border-color: var(--md3-primary);
  box-shadow: 0 0 0 1px var(--md3-primary-container);
}

.popup-search-icon {
  position: absolute;
  right: 0.5rem;
  top: 50%;
  transform: translateY(-50%);
  width: 1rem;
  height: 1rem;
  color: var(--md3-on-surface-variant);
}

/* Toast - MD3 themed */
.popup-toast {
  position: fixed;
  bottom: 1rem;
  right: 1rem;
  background-color: var(--md3-primary);
  color: var(--md3-on-primary);
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  box-shadow: 0 2px 8px var(--md3-shadow);
  z-index: 50;
  font-size: 0.875rem;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}

/* popup-body fills remaining space below header/tabs and enables internal scrolling */
.popup-body {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
  background-color: var(--md3-surface);
}

.popup-body > * {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
}

/* Desktop: ensure reasonable minimums but still fill available area */
@media (min-width: 768px) {
  .popup-container {
    width: 100%;
    height: 100%;
    min-width: 400px;
    min-height: 500px;
  }
}

/* Mobile: full-screen fallback */
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
    height: 100%;
    min-width: 200px;
    min-height: 200px;
  }
}

/* Enforce absolute minimum sizes */
@media screen {
  .popup-container {
    min-width: 200px !important;
    min-height: 200px !important;
  }
}
</style>
