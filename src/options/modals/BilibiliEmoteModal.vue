<script setup lang="ts">
import { ref, computed } from 'vue'

import {
  fetchBilibiliEmotePackageById,
  convertBilibiliEmotesToPluginFormat,
  searchBilibiliPackages,
  type BilibiliEmotePackage,
  type BilibiliEmoteIndexItem
} from '@/services/bilibiliEmoteApi'
import { useEmojiStore } from '@/stores/emojiStore'

const props = defineProps<{ modelValue: boolean }>()
// reference prop to satisfy TS/linter
void props.modelValue
const emit = defineEmits(['update:modelValue', 'imported'])

const store = useEmojiStore()
const packages = ref<BilibiliEmotePackage[]>([])
const selectedPackages = ref<number[]>([])
const targetGroupId = ref('')
const errorMessage = ref('')
const packageIdInput = ref('')
const searchInput = ref('')
const searchResults = ref<BilibiliEmoteIndexItem[]>([])
const idImportLoading = ref(false)
const searchLoading = ref(false)

// Alias for template compatibility
const isLoading = computed(() => idImportLoading.value || searchLoading.value)

const close = () => {
  emit('update:modelValue', false)
  // 重置状态
  packages.value = []
  selectedPackages.value = []
  targetGroupId.value = ''
  errorMessage.value = ''
  packageIdInput.value = ''
  searchInput.value = ''
  searchResults.value = []
}

// @ts-expect-error kept for API compatibility
const _togglePackage = (packageId: number) => {
  const index = selectedPackages.value.indexOf(packageId)
  if (index > -1) {
    selectedPackages.value.splice(index, 1)
  } else {
    selectedPackages.value.push(packageId)
  }
}

const isPackageSelected = (packageId: number) => {
  return selectedPackages.value.includes(packageId)
}

// 切换表情包选择状态
const togglePackage = (packageId: number) => {
  const index = selectedPackages.value.indexOf(packageId)
  if (index > -1) {
    selectedPackages.value.splice(index, 1)
  } else {
    selectedPackages.value.push(packageId)
  }
}

// 全选所有表情包
const selectAllPackages = () => {
  selectedPackages.value = packages.value.map(pkg => pkg.id)
}

// 取消选择所有表情包
const deselectAllPackages = () => {
  selectedPackages.value = []
}

// 移除单个表情包
const removePackage = (packageId: number) => {
  const index = packages.value.findIndex(pkg => pkg.id === packageId)
  if (index > -1) {
    packages.value.splice(index, 1)
  }
  // 同时从选中列表中移除
  const selectedIndex = selectedPackages.value.indexOf(packageId)
  if (selectedIndex > -1) {
    selectedPackages.value.splice(selectedIndex, 1)
  }
}

const doImport = () => {
  if (selectedPackages.value.length === 0) {
    errorMessage.value = '请至少导入一个表情包'

    return
  }

  const selectedPackagesData = packages.value.filter(pkg => selectedPackages.value.includes(pkg.id))

  const convertedEmotes = convertBilibiliEmotesToPluginFormat(
    selectedPackagesData,

    targetGroupId.value || undefined
  )

  emit('imported', {
    items: convertedEmotes,

    targetGroupId: targetGroupId.value || undefined
  })

  selectedPackages.value = []

  targetGroupId.value = ''

  errorMessage.value = ''

  close()
}

const importPackageById = async () => {
  const packageId = parseInt(String(packageIdInput.value).trim())

  if (!packageId || isNaN(packageId)) {
    errorMessage.value = '请输入有效的表情包 ID'
    return
  }
  idImportLoading.value = true
  errorMessage.value = ''

  try {
    const packageData = await fetchBilibiliEmotePackageById(packageId)

    // 将获取到的表情包添加到列表中
    const existingIndex = packages.value.findIndex(pkg => pkg.id === packageData.id)
    if (existingIndex > -1) {
      // 如果已存在，替换
      packages.value[existingIndex] = packageData
    } else {
      // 如果不存在，添加
      packages.value.push(packageData)
    }

    // 自动选中新添加的表情包
    selectedPackages.value.push(packageData.id)

    packageIdInput.value = ''
  } catch (error) {
    console.error('通过 ID 导入表情包失败：', error)
    errorMessage.value = `导入失败：${error instanceof Error ? error.message : '未知错误'}`
  } finally {
    idImportLoading.value = false
  }
}

const handleSearch = async () => {
  if (!searchInput.value || !searchInput.value.trim()) {
    searchResults.value = []
    return
  }

  searchLoading.value = true
  errorMessage.value = ''

  try {
    const results = await searchBilibiliPackages(
      searchInput.value,
      store.settings.cloudMarketDomain
    )
    searchResults.value = results

    if (results.length === 0) {
      errorMessage.value = '未找到匹配的表情包'
    }
  } catch (error) {
    console.error('搜索表情包失败：', error)
    errorMessage.value = '搜索失败，请稍后重试'
  } finally {
    searchLoading.value = false
  }
}

const selectSearchResult = async (result: BilibiliEmoteIndexItem) => {
  // 填充 ID 到输入框并自动触发导入
  packageIdInput.value = String(result.id)
  await importPackageById()
}
</script>

<template>
  <div
    v-if="modelValue"
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    @click="close"
  >
    <div
      class="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
      @click.stop
    >
      <div class="flex-shrink-0 mb-4">
        <h3 class="text-xl font-semibold mb-4 dark:text-white">导入 Bilibili 表情包</h3>

        <!-- 错误信息 -->
        <div
          v-if="errorMessage"
          class="mb-4 p-3 bg-red-100 dark:bg-red-900 border border-red-300 dark:border-red-700 rounded-md"
        >
          <p class="text-sm text-red-800 dark:text-red-200">{{ errorMessage }}</p>
        </div>

        <!-- 搜索与 ID 导入 Tab 区域 -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <!-- 搜索区域 -->
          <div
            class="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-md p-4"
          >
            <h4 class="font-medium text-purple-900 dark:text-purple-100 mb-3">搜索表情包</h4>
            <div class="flex gap-2 mb-3">
              <input
                v-model="searchInput"
                type="text"
                placeholder="输入关键词搜索 (如: 小黄脸)"
                class="flex-1 px-3 py-2 border border-purple-300 dark:border-purple-600 rounded-md bg-white dark:bg-black text-purple-900 dark:text-purple-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
                @keyup.enter="handleSearch"
              />
              <button
                @click="handleSearch"
                :disabled="!searchInput || !searchInput.trim() || searchLoading"
                class="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span v-if="searchLoading">搜索中...</span>
                <span v-else>搜索</span>
              </button>
            </div>

            <!-- 搜索结果列表 -->
            <div
              v-if="searchResults.length > 0"
              class="max-h-40 overflow-y-auto border border-purple-200 dark:border-purple-700 rounded bg-white dark:bg-black/20"
            >
              <div
                v-for="result in searchResults"
                :key="result.id"
                class="flex items-center gap-3 p-2 hover:bg-purple-100 dark:hover:bg-purple-900/40 cursor-pointer border-b last:border-b-0 border-purple-100 dark:border-purple-800"
                @click="selectSearchResult(result)"
              >
                <img :src="result.url" class="w-8 h-8 rounded object-cover" />
                <div class="flex-1 min-w-0">
                  <div class="font-medium text-sm truncate dark:text-gray-200">
                    {{ result.text }}
                  </div>
                  <div class="text-xs text-gray-500">ID: {{ result.id }}</div>
                </div>
                <button
                  class="text-xs px-2 py-1 bg-purple-100 dark:bg-purple-800 text-purple-700 dark:text-purple-200 rounded"
                >
                  选择
                </button>
              </div>
            </div>
            <div
              v-else-if="
                searchInput &&
                !searchLoading &&
                searchResults.length === 0 &&
                errorMessage === '未找到匹配的表情包'
              "
              class="text-center py-4 text-sm text-gray-500"
            >
              未找到相关表情包
            </div>
          </div>

          <!-- ID 导入区域 -->
          <div
            class="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md"
          >
            <h4 class="font-medium text-blue-900 dark:text-blue-100 mb-3">通过 ID 导入</h4>

            <p class="text-sm text-blue-800 dark:text-blue-200 mb-4">
              直接输入 Bilibili 表情包 ID 导入。
            </p>

            <div class="flex gap-2">
              <input
                v-model="packageIdInput"
                type="number"
                placeholder="输入表情包ID (如: 237)"
                class="flex-1 px-3 py-2 border border-blue-300 dark:border-blue-600 rounded-md bg-white dark:bg-black text-blue-900 dark:text-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                @keyup.enter="importPackageById"
              />

              <button
                @click="importPackageById"
                :disabled="!packageIdInput || !String(packageIdInput).trim() || idImportLoading"
                class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span v-if="idImportLoading">导入中...</span>

                <span v-else>导入</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 已导入的表情包列表 -->
      <div class="flex-1 overflow-hidden flex flex-col min-h-0">
        <div v-if="packages.length > 0" class="flex flex-col h-full">
          <div class="flex justify-between items-center mb-4 flex-shrink-0">
            <div class="flex items-center gap-4">
              <h4 class="font-medium text-gray-900 dark:text-white">已准备导入的表情包</h4>
              <div class="flex gap-2">
                <button
                  @click="selectAllPackages"
                  :disabled="packages.length === 0"
                  class="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-200 rounded hover:bg-blue-200 dark:hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  全选
                </button>
                <button
                  @click="deselectAllPackages"
                  :disabled="selectedPackages.length === 0"
                  class="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  取消全选
                </button>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-sm text-gray-600 dark:text-gray-400">
                {{ packages.length }} 个表情包
              </span>
              <span class="text-sm text-blue-600 dark:text-blue-400">
                (已选 {{ selectedPackages.length }})
              </span>
            </div>
          </div>

          <!-- 表情包网格 -->
          <div
            class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto flex-1 p-1"
          >
            <div
              v-for="pkg in packages"
              :key="pkg.id"
              class="border rounded-lg p-4 transition-all h-fit cursor-pointer"
              :class="
                isPackageSelected(pkg.id)
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
              "
              @click="togglePackage(pkg.id)"
            >
              <div class="flex items-center space-x-3">
                <img
                  :src="pkg.url"
                  :alt="pkg.text"
                  class="w-12 h-12 rounded object-cover"
                  @error="
                    e => {
                      ;(e.target as HTMLImageElement).src =
                        'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCA0OCA0OCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQ4IiBoZWlnaHQ9IjQ4IiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0yNCAzMkMxNi4yNjggMzIgMTAgMjUuNzMyIDEwIDE4QzEwIDEwLjI2OCAxNi4yNjggNCAyNCA0QzMxLjczMiA0IDM4IDEwLjI2OCAzOCAxOEMzOCAyNS43MzIgMzEuNzMyIDMyIDI0IDMyWiIgZmlsbD0iIzlDQTNBRiIvPgo8L3N2Zz4K'
                    }
                  "
                />
                <div class="flex-1">
                  <h4 class="font-medium text-gray-900 dark:text-white">{{ pkg.text }}</h4>
                  <p class="text-sm text-gray-500 dark:text-gray-400">
                    {{ pkg.emote.length }} 个表情
                  </p>
                </div>
                <div class="flex items-center gap-2">
                  <div
                    class="w-5 h-5 rounded border-2 border-gray-300 dark:border-gray-600 flex items-center justify-center transition-colors"
                    :class="
                      isPackageSelected(pkg.id)
                        ? 'border-blue-500 bg-blue-500'
                        : 'hover:border-blue-400'
                    "
                  >
                    <div
                      v-if="isPackageSelected(pkg.id)"
                      class="w-3 h-3 bg-white rounded-full"
                    ></div>
                  </div>
                  <button
                    @click.stop="removePackage(pkg.id)"
                    class="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                    title="移除表情包"
                  >
                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fill-rule="evenodd"
                        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                        clip-rule="evenodd"
                      />
                    </svg>
                  </button>
                </div>
              </div>

              <!-- 表情预览 -->
              <div class="mt-3 flex flex-wrap gap-1">
                <img
                  v-for="emote in pkg.emote.slice(0, 6)"
                  :key="emote.id"
                  :src="emote.url"
                  :alt="emote.text"
                  class="w-6 h-6 rounded object-cover"
                  @error="
                    e => {
                      ;(e.target as HTMLImageElement).style.display = 'none'
                    }
                  "
                />
                <span
                  v-if="pkg.emote.length > 6"
                  class="text-xs text-gray-500 dark:text-gray-400 self-center"
                >
                  +{{ pkg.emote.length - 6 }}
                </span>
              </div>
            </div>
          </div>

          <!-- 目标分组输入 -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-white mb-1">
              目标分组（可选）
            </label>
            <input
              v-model="targetGroupId"
              placeholder="留空按表情包名称创建分组"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-black text-gray-900 dark:text-white"
              title="导入表情的目标分组 ID (可选)"
            />
          </div>
        </div>

        <!-- 无表情包时的提示 -->
        <div v-else class="text-center py-8">
          <p class="text-gray-500 dark:text-gray-400">还没有导入任何表情包</p>
          <p class="text-sm text-gray-400 dark:text-gray-500 mt-2">在上方输入表情包 ID 开始导入</p>
        </div>

        <!-- 底部按钮 -->
        <div class="flex justify-end gap-3 mt-6">
          <button
            @click="close"
            class="px-4 py-2 text-sm text-gray-600 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
          >
            取消
          </button>
          <button
            @click="doImport"
            :disabled="selectedPackages.length === 0 || isLoading"
            class="px-4 py-2 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            导入选中的表情包 ({{ selectedPackages.length }})
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
