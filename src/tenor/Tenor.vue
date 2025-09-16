<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { DownOutlined } from '@ant-design/icons-vue'

import { useEmojiStore } from '../stores/emojiStore'

import { loadPackagedDefaults } from '@/types/defaultEmojiGroups.loader'

type TenorGif = {
  id: string
  content_description?: string
  media_formats: {
    tinygif?: { url: string }
    gif?: { url: string }
  }
}

const emojiStore = useEmojiStore()

// State
const tenorApiKey = ref('')
const inputApiKey = ref('')
const searchQuery = ref('')
const searchResults = ref<TenorGif[]>([])
const selectedGifs = ref(new Set<string>())
const isSearching = ref(false)
const isLoadingMore = ref(false)
const isImporting = ref(false)
const hasSearched = ref(false)
const hasMore = ref(false)
const nextPos = ref('')

// Search options
const searchLimit = ref(12)
const contentFilter = ref('high')

const onSearchLimitSelect = (info: { key: string | number }) => {
  searchLimit.value = Number(String(info.key))
}

const onContentFilterSelect = (info: { key: string | number }) => {
  contentFilter.value = String(info.key)
}

// Group selection
const showGroupModal = ref(false)
const selectedGroupId = ref('')

// Messages
const message = ref({ text: '', type: 'success' as 'success' | 'error' })

// Computed
const availableGroups = computed(() => {
  return emojiStore.groups.filter(g => g.id !== 'favorites')
})

// Load API key from storage
onMounted(async () => {
  await emojiStore.loadData()

  try {
    const result = await chrome.storage.local.get(['tenorApiKey'])
    if (result.tenorApiKey) {
      tenorApiKey.value = result.tenorApiKey
    } else {
      // 运行时从打包的默认配置 JSON 获取回退值（不会把 default.json 静态打包进此模块）
      try {
        const packaged = await loadPackagedDefaults()
        if (packaged?.settings?.tenorApiKey) tenorApiKey.value = packaged.settings.tenorApiKey
      } catch (e) {
        // ignore
      }
    }
  } catch (error) {
    console.error('Failed to load Tenor API key:', error)
    // still try runtime packaged defaults
    try {
      const packaged = await loadPackagedDefaults()
      if (packaged?.settings?.tenorApiKey) tenorApiKey.value = packaged.settings.tenorApiKey
    } catch (e) {
      // ignore
    }
  }
})

// Methods
const saveApiKey = async () => {
  if (!inputApiKey.value.trim()) return

  try {
    await chrome.storage.local.set({ tenorApiKey: inputApiKey.value.trim() })
    tenorApiKey.value = inputApiKey.value.trim()
    inputApiKey.value = ''
    showMessage('API Key 已保存', 'success')
  } catch (error) {
    console.error('Failed to save API key:', error)
    showMessage('API Key 保存失败', 'error')
  }
}

const clearApiKey = async () => {
  try {
    await chrome.storage.local.remove(['tenorApiKey'])
    tenorApiKey.value = ''
    searchResults.value = []
    selectedGifs.value.clear()
    hasSearched.value = false
    showMessage('API Key 已清除', 'success')
  } catch (error) {
    console.error('Failed to clear API key:', error)
    showMessage('API Key 清除失败', 'error')
  }
}

const searchGifs = async () => {
  if (!searchQuery.value.trim() || !tenorApiKey.value || isSearching.value) return

  isSearching.value = true
  hasSearched.value = true
  searchResults.value = []
  selectedGifs.value.clear()
  nextPos.value = ''

  try {
    const url = new URL('https://tenor.googleapis.com/v2/search')
    url.searchParams.set('q', searchQuery.value.trim())
    url.searchParams.set('key', tenorApiKey.value)
    url.searchParams.set('limit', searchLimit.value.toString())
    url.searchParams.set('contentfilter', contentFilter.value)
    url.searchParams.set('media_filter', 'tinygif,gif')

    const response = await fetch(url.toString())

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const data = await response.json()

    if (data.results && Array.isArray(data.results)) {
      searchResults.value = data.results
      nextPos.value = data.next || ''
      hasMore.value = !!data.next
    } else {
      searchResults.value = []
      hasMore.value = false
    }
  } catch (error) {
    console.error('Search failed:', error)
    showMessage('搜索失败，请检查 API Key 或网络连接', 'error')
    searchResults.value = []
    hasMore.value = false
  } finally {
    isSearching.value = false
  }
}

const loadMore = async () => {
  if (!nextPos.value || isLoadingMore.value) return

  isLoadingMore.value = true

  try {
    const url = new URL('https://tenor.googleapis.com/v2/search')
    url.searchParams.set('q', searchQuery.value.trim())
    url.searchParams.set('key', tenorApiKey.value)
    url.searchParams.set('limit', searchLimit.value.toString())
    url.searchParams.set('contentfilter', contentFilter.value)
    url.searchParams.set('media_filter', 'tinygif,gif')
    url.searchParams.set('pos', nextPos.value)

    const response = await fetch(url.toString())

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const data = await response.json()

    if (data.results && Array.isArray(data.results)) {
      searchResults.value.push(...data.results)
      nextPos.value = data.next || ''
      hasMore.value = !!data.next
    }
  } catch (error) {
    console.error('Load more failed:', error)
    showMessage('加载更多失败', 'error')
  } finally {
    isLoadingMore.value = false
  }
}

const toggleSelection = (gif: TenorGif) => {
  if (selectedGifs.value.has(gif.id)) {
    selectedGifs.value.delete(gif.id)
  } else {
    selectedGifs.value.add(gif.id)
  }
}

const importSelected = () => {
  if (selectedGifs.value.size === 0) return
  if (availableGroups.value.length > 0) {
    // Prefer adding to the explicit 'ungrouped' group when available
    const ungroup = availableGroups.value.find(g => g.id === 'ungrouped')
    selectedGroupId.value = ungroup ? 'ungrouped' : availableGroups.value[0].id
  }
  showGroupModal.value = true
}

const confirmImport = async () => {
  if (!selectedGroupId.value || selectedGifs.value.size === 0) return

  isImporting.value = true

  try {
    const gifsToImport = searchResults.value.filter(gif => selectedGifs.value.has(gif.id))
    let successCount = 0

    for (const gif of gifsToImport) {
      try {
        const emoji = {
          packet: Date.now(),
          name: gif.content_description || `tenor-${gif.id}`,
          url:
            (gif.media_formats.gif && gif.media_formats.gif.url) ||
            (gif.media_formats.tinygif && gif.media_formats.tinygif.url) ||
            ''
        }

        emojiStore.addEmoji(selectedGroupId.value, emoji)
        successCount++
      } catch (error) {
        console.error('Failed to import GIF:', gif.id, error)
      }
    }

    if (successCount > 0) {
      showMessage(`成功导入 ${successCount} 个 GIF`, 'success')
      selectedGifs.value.clear()
      showGroupModal.value = false
    } else {
      showMessage('导入失败', 'error')
    }
  } catch (error) {
    console.error('Import failed:', error)
    showMessage('导入失败', 'error')
  } finally {
    isImporting.value = false
  }
}

const showMessage = (text: string, type: 'success' | 'error' = 'success') => {
  message.value = { text, type }
  setTimeout(() => {
    message.value.text = ''
  }, 3000)
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <!-- Header -->
    <header class="bg-white shadow-sm border-b dark:bg-gray-800">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center py-6">
          <div>
            <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Tenor GIF 搜索</h1>
            <p class="text-sm text-gray-600 dark:text-white">搜索并导入 Tenor GIF 表情到你的收藏</p>
          </div>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 dark:text-white">
      <!-- API Key Setup -->
      <div
        v-if="!tenorApiKey"
        class="bg-white rounded-lg shadow-sm border p-6 mb-8 dark:bg-gray-800"
      >
        <h2 class="text-lg font-semibold text-gray-900 mb-4 dark:text-white">配置 Tenor API</h2>
        <p class="text-sm text-gray-600 mb-4 dark:text-white">
          请先设置你的 Tenor API Key。你可以在
          <a
            href="https://developers.google.com/tenor/guides/quickstart"
            target="_blank"
            class="text-blue-600 hover:text-blue-800 underline"
          >
            Tenor 开发者中心
          </a>
          申请免费的 API Key。
        </p>

        <div class="space-y-4">
          <div>
            <label for="api-key" class="block text-sm font-medium text-gray-700">
              Tenor API Key
            </label>
            <input
              id="api-key"
              v-model="inputApiKey"
              type="text"
              class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              placeholder="输入你的 Tenor API Key"
            />
          </div>
          <button
            @click="saveApiKey"
            :disabled="!inputApiKey.trim()"
            class="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            保存 API Key
          </button>
        </div>
      </div>

      <!-- Search Interface -->
      <div v-else class="space-y-6">
        <!-- API Key Management -->
        <div class="bg-white rounded-lg shadow-sm border p-4 dark:bg-gray-800">
          <div class="flex justify-between items-center">
            <div>
              <h3 class="text-sm font-medium text-gray-900 dark:text-white">API Key 已配置</h3>
              <p class="text-xs text-gray-500 dark:text-white">
                Key: {{ tenorApiKey.substring(0, 8) }}...
              </p>
            </div>
            <button
              @click="clearApiKey"
              class="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded transition-colors"
            >
              重新配置
            </button>
          </div>
        </div>

        <!-- Search Bar -->
        <div class="bg-white rounded-lg shadow-sm border p-6 dark:bg-gray-800">
          <div class="flex gap-4">
            <input
              v-model="searchQuery"
              @keyup.enter="searchGifs"
              type="text"
              placeholder="搜索 GIF..."
              class="flex-1 border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
            <button
              @click="searchGifs"
              :disabled="isSearching || !searchQuery.trim()"
              class="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {{ isSearching ? '搜索中...' : '搜索' }}
            </button>
          </div>

          <!-- Advanced Options -->
          <div class="mt-4 flex gap-4 text-sm text-gray-700 dark:text-white">
            <div class="flex items-center gap-2 dark:text-white">
              <a-dropdown>
                <template #overlay>
                  <a-menu @click="(info: { key: string | number }) => onSearchLimitSelect(info)">
                    <a-menu-item key="12">12 个结果</a-menu-item>
                    <a-menu-item key="24">24 个结果</a-menu-item>
                    <a-menu-item key="48">48 个结果</a-menu-item>
                  </a-menu>
                </template>
                <AButton>
                  {{ searchLimit }} 个结果
                  <DownOutlined />
                </AButton>
              </a-dropdown>
            </div>

            <div class="flex items-center">
              <a-dropdown>
                <template #overlay>
                  <a-menu @click="(info: { key: string | number }) => onContentFilterSelect(info)">
                    <a-menu-item key="high">高安全级别</a-menu-item>
                    <a-menu-item key="medium">中等安全级别</a-menu-item>
                    <a-menu-item key="low">低安全级别</a-menu-item>
                    <a-menu-item key="off">关闭过滤</a-menu-item>
                  </a-menu>
                </template>
                <AButton>
                  {{ contentFilter }}
                  <DownOutlined />
                </AButton>
              </a-dropdown>
            </div>
          </div>
        </div>

        <!-- Search Results -->
        <div v-if="searchResults.length > 0" class="bg-white rounded-lg shadow-sm border p-6">
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-lg font-semibold text-gray-900">搜索结果</h3>
            <div v-if="selectedGifs.size > 0" class="flex gap-2">
              <span class="text-sm text-gray-600">已选择 {{ selectedGifs.size }} 个</span>
              <button
                @click="importSelected"
                class="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
              >
                导入选中
              </button>
            </div>
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <div
              v-for="gif in searchResults"
              :key="gif.id"
              class="relative group cursor-pointer"
              @click="toggleSelection(gif)"
            >
              <div
                class="aspect-square bg-gray-100 rounded-lg overflow-hidden"
                :class="{
                  'ring-2 ring-blue-500': selectedGifs.has(gif.id),
                  'ring-1 ring-gray-200': !selectedGifs.has(gif.id)
                }"
              >
                <img
                  :src="gif.media_formats?.tinygif?.url || gif.media_formats?.gif?.url || ''"
                  :alt="gif.content_description"
                  class="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>

              <!-- Selection indicator -->
              <div
                v-if="selectedGifs.has(gif.id)"
                class="absolute top-2 right-2 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs"
              >
                ✓
              </div>

              <!-- GIF info -->
              <div class="mt-2">
                <p class="text-xs text-gray-600 truncate" :title="gif.content_description">
                  {{ gif.content_description || 'Untitled' }}
                </p>
              </div>
            </div>
          </div>

          <!-- Load More -->
          <div v-if="hasMore" class="mt-6 text-center">
            <button
              @click="loadMore"
              :disabled="isLoadingMore"
              class="px-6 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors"
            >
              {{ isLoadingMore ? '加载中...' : '加载更多' }}
            </button>
          </div>
        </div>

        <!-- No Results -->
        <div
          v-else-if="hasSearched && !isSearching"
          class="bg-white rounded-lg shadow-sm border p-6 text-center"
        >
          <p class="text-gray-500">未找到相关 GIF，请尝试其他关键词</p>
        </div>
      </div>
    </main>

    <!-- Group Selection Modal -->
    <div
      v-if="showGroupModal"
      class="fixed inset-0 z-50 overflow-y-auto"
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true"
    >
      <div
        class="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0"
      >
        <div
          class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          @click="showGroupModal = false"
        ></div>

        <div
          class="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6"
        >
          <div>
            <h3 class="text-lg leading-6 font-medium text-gray-900 mb-4">选择目标分组</h3>

            <div class="space-y-2 max-h-60 overflow-y-auto">
              <label
                v-for="group in availableGroups"
                :key="group.id"
                class="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
              >
                <input type="radio" :value="group.id" v-model="selectedGroupId" class="mr-3" />
                <div class="flex items-center gap-2">
                  <span class="text-lg">{{ group.icon }}</span>
                  <span class="font-medium">{{ group.name }}</span>
                  <span class="text-sm text-gray-500">
                    ({{ group.emojis?.length || 0 }} 个表情)
                  </span>
                </div>
              </label>
            </div>

            <div class="mt-6 flex gap-3">
              <button
                @click="confirmImport"
                :disabled="!selectedGroupId || isImporting"
                class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {{ isImporting ? '导入中...' : `导入 ${selectedGifs.size} 个 GIF` }}
              </button>
              <button
                @click="showGroupModal = false"
                class="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Success/Error Messages -->
    <div
      v-if="message.text"
      class="fixed top-4 right-4 max-w-sm w-full bg-white border border-gray-200 rounded-lg shadow-lg z-50"
      :class="{
        'border-green-200 bg-green-50': message.type === 'success',
        'border-red-200 bg-red-50': message.type === 'error'
      }"
    >
      <div class="p-4">
        <div class="flex">
          <div class="flex-shrink-0">
            <span
              class="w-5 h-5 flex items-center justify-center rounded-full text-sm"
              :class="{
                'bg-green-100 text-green-600': message.type === 'success',
                'bg-red-100 text-red-600': message.type === 'error'
              }"
            >
              {{ message.type === 'success' ? '✓' : '✕' }}
            </span>
          </div>
          <div class="ml-3">
            <p
              class="text-sm font-medium"
              :class="{
                'text-green-800': message.type === 'success',
                'text-red-800': message.type === 'error'
              }"
            >
              {{ message.text }}
            </p>
          </div>
          <div class="ml-auto pl-3">
            <button
              @click="message.text = ''"
              class="inline-flex text-gray-400 hover:text-gray-600"
            >
              <span class="sr-only">关闭</span>
              ✕
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
