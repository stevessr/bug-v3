<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import LazyEmojiGrid from '../popup/components/LazyEmojiGrid.vue'
import { usePopup } from '../popup/usePopup'
import { useEmojiImages } from '../composables/useEmojiImages'

import Agent from './Agent.vue'

import CachedImage from '@/components/CachedImage.vue'
import { shouldUseImageCache } from '@/utils/imageCachePolicy'

const { t } = useI18n()

const { emojiStore, showCopyToast, selectEmoji, openOptions } = usePopup({ manageUrl: false })

const SIDEBAR_PANEL_KEY = 'sidebar-active-panel'

const activeView = ref<'emoji' | 'agent'>('emoji')
try {
  const stored = localStorage.getItem(SIDEBAR_PANEL_KEY)
  if (stored === 'agent' || stored === 'emoji') {
    activeView.value = stored
  }
} catch {
  // ignore storage errors
}

watch(activeView, value => {
  try {
    localStorage.setItem(SIDEBAR_PANEL_KEY, value)
  } catch {
    // ignore storage errors
  }
})

const setActiveView = (value: 'emoji' | 'agent') => {
  activeView.value = value
}

// 分组图标缓存
const groupIconSources = ref<Map<string, string>>(new Map())

// 获取搜索结果中表情的图片 URL（优先使用缓存）
const getSearchEmojiSrc = (emoji: any): string => {
  return searchImageSources.value.get(emoji.id) || getImageSrcSync(emoji)
}

// 获取分组图标 URL（优先使用缓存）
const getGroupIconSrc = (icon: string, groupId: string): string => {
  return groupIconSources.value.get(groupId) || icon
}

// 异步加载分组图标缓存
watch(
  () => emojiStore.sortedGroups,
  async groups => {
    if (!shouldUseImageCache(emojiStore.settings)) return

    const { getCachedImage } = await import('../utils/imageCache')
    const newMap = new Map<string, string>()

    for (const group of groups) {
      if (group.icon && (group.icon.startsWith('http') || group.icon.startsWith('data:'))) {
        try {
          const cachedUrl = await getCachedImage(group.icon)
          if (cachedUrl) {
            newMap.set(group.id, cachedUrl)
          }
        } catch {
          // 缓存获取失败，使用原始 URL
        }
      }
    }

    groupIconSources.value = newMap
  },
  { immediate: true }
)

const setActiveHandler = (id: string) => {
  emojiStore.activeGroupId = id
  // Note: In read-only mode (sidebar/popup), we don't persist settings changes
  // This prevents accidental data corruption
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

// 組合所有分組（虛擬 + 真實）- kept for potential future use
// @ts-expect-error kept for API compatibility
const _allGroups = computed(() => [...virtualGroups.value, ...emojiStore.sortedGroups])

// 搜索功能
const searchQuery = computed({
  get: () => emojiStore.searchQuery,
  set: (value: string) => {
    emojiStore.searchQuery = value
  }
})

// 過濾後的表情（支持按名稱和標籤搜索）
const filteredEmojis = computed(() => {
  if (!searchQuery.value.trim()) {
    return []
  }

  const query = searchQuery.value.toLowerCase()
  const allEmojis: Array<any> = []

  // 收集所有表情
  emojiStore.sortedGroups.forEach(group => {
    group.emojis?.forEach(emoji => {
      // 按名稱搜索
      const nameMatch = emoji.name.toLowerCase().includes(query)
      // 按標籤搜索
      const tagMatch = emoji.tags?.some((tag: string) => tag.toLowerCase().includes(query))

      if (nameMatch || tagMatch) {
        allEmojis.push({
          ...emoji,
          groupName: group.name
        })
      }
    })
  })

  return allEmojis
})

// 使用 useEmojiImages 处理搜索结果的图片缓存
const { imageSources: searchImageSources, getImageSrcSync } = useEmojiImages(
  () => filteredEmojis.value,
  { preload: true, preloadBatchSize: 5 }
)

// 判斷是否為虛擬分組 - kept for potential future use
// @ts-expect-error kept for API compatibility
const _isVirtualGroup = (groupId: string) => {
  return virtualGroups.value.some(g => g.id === groupId)
}

// 獲取當前分組的表情
const getCurrentGroupEmojis = (groupId: string) => {
  if (groupId === 'all-emojis') {
    // 返回所有表情
    const allEmojis = []
    for (const group of emojiStore.sortedGroups) {
      if (group.emojis) {
        allEmojis.push(...group.emojis)
      }
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

// 清空搜索
const clearSearch = () => {
  emojiStore.searchQuery = ''
}

// 處理搜索輸入
const handleSearch = () => {
  // 搜索邏輯已經由 computed 屬性處理
}
</script>

<template>
  <a-config-provider
    :theme="{
      token: {}
    }"
  >
    <div class="sidebar-container">
      <div class="sidebar-header">
        <div class="flex items-center justify-between px-3 py-2">
          <div class="flex flex-col">
            <span class="sidebar-title">Claude 助手</span>
            <span class="sidebar-subtitle">自动化任务与网页操作</span>
          </div>
          <div class="sidebar-toggle">
            <button
              class="sidebar-toggle-button"
              :class="{ active: activeView === 'agent' }"
              @click="setActiveView('agent')"
            >
              助手
            </button>
            <button
              class="sidebar-toggle-button"
              :class="{ active: activeView === 'emoji' }"
              @click="setActiveView('emoji')"
            >
              表情
            </button>
          </div>
        </div>
      </div>

      <Agent v-if="activeView === 'agent'" class="flex-1 min-h-0" />

      <template v-else>
        <!-- 搜索和分组选择 -->
        <div class="sidebar-search-section">
          <!-- 表情搜索 -->
          <div
            v-if="emojiStore.settings.showSearchBar || emojiStore.activeGroupId === 'all-emojis'"
            class="relative"
          >
            <a-input
              v-model:value="searchQuery"
              type="text"
              :placeholder="t('searchEmojiNamesOrTags')"
              :title="t('searchEmojiNamesOrTagsTitle')"
              class="sidebar-search-input"
              @input="handleSearch"
            />
            <button
              v-if="searchQuery"
              @click="clearSearch"
              class="sidebar-clear-btn"
              :title="t('clearSearch')"
            >
              ✕
            </button>
            <svg
              v-else
              class="sidebar-search-icon"
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
            :placeholder="t('selectGroupPlaceholder')"
            class="w-full"
            :filterOption="filterOption"
            @change="(value: any) => setActiveHandler(String(value || ''))"
          >
            <!-- 虛擬分組 -->
            <a-select-option v-for="g in virtualGroups" :key="g.id" :value="g.id" :label="g.name">
              <span class="inline-block mr-2">{{ g.icon }}</span>
              {{ g.name }}
              <span class="sidebar-virtual-label">{{ t('virtualGroup') }}</span>
            </a-select-option>

            <!-- 真實分組 -->
            <a-select-option
              v-for="g in emojiStore.sortedGroups"
              :key="g.id"
              :value="g.id"
              :label="g.name"
            >
              <CachedImage
                v-if="g.icon.startsWith('http') || g.icon.startsWith('data:')"
                :src="getGroupIconSrc(g.icon, g.id)"
                class="w-4 h-4 inline-block mr-2"
              />
              <span v-else class="inline-block mr-2">{{ g.icon }}</span>
              {{ g.name }}
            </a-select-option>
          </a-select>
        </div>

        <!-- 表情网格 -->
        <div class="sidebar-body">
          <!-- 搜索模式 - 顯示搜索結果 -->
          <template v-if="searchQuery">
            <div class="p-3">
              <div class="sidebar-search-result-info">
                {{ t('searchResultsFound', { query: searchQuery, count: filteredEmojis.length }) }}
              </div>
              <div v-if="filteredEmojis.length === 0" class="sidebar-empty">
                <div class="text-2xl mb-2">🔍</div>
                <div>{{ t('noMatchingEmojisFound') }}</div>
              </div>
              <div
                v-else
                class="grid gap-2"
                :style="{
                  gridTemplateColumns: `repeat(${emojiStore.settings.gridColumns || 6}, minmax(0, 1fr))`
                }"
              >
                <div
                  v-for="emoji in filteredEmojis"
                  :key="emoji.id"
                  @click="handleEmojiClick(emoji)"
                  class="sidebar-emoji-item"
                  :title="`${emoji.name} (${emoji.groupName})
${t('tagsLabel', [emoji.tags?.join(', ') || t('noTags')])}`"
                >
                  <div class="sidebar-emoji-thumb">
                    <CachedImage
                      :src="getSearchEmojiSrc(emoji)"
                      :alt="emoji.name"
                      class="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <div class="sidebar-emoji-name">
                    {{ emoji.name }}
                  </div>
                  <!-- 標籤顯示 -->
                  <div v-if="emoji.tags && emoji.tags.length > 0" class="mt-1">
                    <div class="flex flex-wrap gap-1">
                      <span
                        v-for="tag in emoji.tags.slice(0, 2)"
                        :key="tag"
                        class="sidebar-tag"
                      >
                        {{ tag }}
                      </span>
                      <span v-if="emoji.tags.length > 2" class="sidebar-tag-more">
                        +{{ emoji.tags.length - 2 }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </template>

          <!-- 虛擬分組 - 所有表情 -->
          <template v-else-if="emojiStore.activeGroupId === 'all-emojis'">
            <div class="p-3">
              <div class="sidebar-search-result-info">
                {{ t('showAllEmojis', [getCurrentGroupEmojis('all-emojis').length]) }}
              </div>
              <LazyEmojiGrid
                :emojis="getCurrentGroupEmojis('all-emojis')"
                :isLoading="emojiStore.isLoading"
                :favorites="emojiStore.favorites"
                :gridColumns="emojiStore.settings.gridColumns"
                :emptyMessage="t('noEmojisYet')"
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
              :emptyMessage="t('groupHasNoEmojisInDetail')"
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
          class="sidebar-toast"
        >
          {{ t('linkCopiedToClipboard') }}
        </div>
      </template>
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
  background-color: var(--md3-surface);
  color: var(--md3-on-surface);
}

.sidebar-header {
  flex-shrink: 0;
  border-bottom: 1px solid var(--md3-outline-variant);
  background-color: var(--md3-surface-container-low);
}

.sidebar-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--md3-on-surface);
}

.sidebar-subtitle {
  font-size: 11px;
  color: var(--md3-on-surface-variant);
}

.sidebar-toggle {
  display: inline-flex;
  border-radius: 999px;
  background: var(--md3-surface-container-highest);
  padding: 2px;
  gap: 2px;
}

.sidebar-toggle-button {
  border: none;
  background: transparent;
  padding: 4px 10px;
  font-size: 12px;
  border-radius: 999px;
  color: var(--md3-on-surface-variant);
  cursor: pointer;
  transition: all 0.2s ease;
}

.sidebar-toggle-button.active {
  background: var(--md3-primary);
  color: var(--md3-on-primary);
}

.sidebar-search-section {
  padding: 8px;
  border-bottom: 1px solid var(--md3-outline-variant);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sidebar-search-input {
  width: 100%;
  padding: 6px 12px;
  font-size: 14px;
  border: 1px solid var(--md3-outline);
  border-radius: 8px;
  background-color: var(--md3-surface);
  color: var(--md3-on-surface);
}

.sidebar-search-input:focus {
  outline: none;
  border-color: var(--md3-primary);
  box-shadow: 0 0 0 2px var(--md3-primary-container);
}

.sidebar-clear-btn {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--md3-on-surface-variant);
  background: none;
  border: none;
  cursor: pointer;
}

.sidebar-clear-btn:hover {
  color: var(--md3-on-surface);
}

.sidebar-search-icon {
  position: absolute;
  right: 8px;
  top: 6px;
  width: 16px;
  height: 16px;
  color: var(--md3-on-surface-variant);
}

.sidebar-virtual-label {
  font-size: 12px;
  color: var(--md3-on-surface-variant);
  margin-left: 8px;
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

.sidebar-search-result-info {
  font-size: 14px;
  color: var(--md3-on-surface-variant);
  margin-bottom: 12px;
}

.sidebar-empty {
  text-align: center;
  padding: 32px 0;
  color: var(--md3-on-surface-variant);
}

.sidebar-emoji-item {
  position: relative;
  cursor: pointer;
  padding: 8px;
  border-radius: 12px;
  transition: background-color 0.2s ease;
}

.sidebar-emoji-item:hover {
  background-color: var(--md3-surface-container-high);
}

.sidebar-emoji-thumb {
  aspect-ratio: 1;
  background-color: var(--md3-surface-container);
  border-radius: 8px;
  overflow: hidden;
}

.sidebar-emoji-name {
  font-size: 12px;
  text-align: center;
  color: var(--md3-on-surface);
  margin-top: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sidebar-tag {
  display: inline-block;
  padding: 2px 6px;
  font-size: 11px;
  background-color: var(--md3-primary-container);
  color: var(--md3-on-primary-container);
  border-radius: 4px;
}

.sidebar-tag-more {
  font-size: 11px;
  color: var(--md3-on-surface-variant);
}

.sidebar-toast {
  position: fixed;
  bottom: 16px;
  right: 16px;
  background-color: var(--md3-tertiary);
  color: var(--md3-on-tertiary);
  padding: 12px 16px;
  border-radius: 8px;
  box-shadow: 0 4px 12px var(--md3-shadow);
  z-index: 50;
  font-size: 14px;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
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