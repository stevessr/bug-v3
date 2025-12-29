<script setup lang="ts">
import { ref, computed } from 'vue'
import { message } from 'ant-design-vue'

import {
  fetchBilibiliEmotePackageById,
  convertBilibiliEmotesToPluginFormat,
  searchBilibiliPackages,
  type BilibiliEmotePackage,
  type BilibiliEmoteIndexItem
} from '@/services/bilibiliEmoteApi'
import { useEmojiStore } from '@/stores/emojiStore'
import GroupSelector from '@/options/components/GroupSelector.vue'

const store = useEmojiStore()

// --- 状态 ---
const packages = ref<BilibiliEmotePackage[]>([])
const selectedPackages = ref<number[]>([])
const targetGroupId = ref('')
const errorMessage = ref('')
const packageIdInput = ref('')
const searchInput = ref('')
const searchResults = ref<BilibiliEmoteIndexItem[]>([])
const idImportLoading = ref(false)
const searchLoading = ref(false)
const previewModalVisible = ref(false)
const previewingPackage = ref<BilibiliEmotePackage | null>(null)

const isLoading = computed(() => idImportLoading.value || searchLoading.value)

// 可用分组列表
const availableGroups = computed(() => {
  return store.groups
})

// --- 方法 ---

// 打开预览模态框
const openPreview = (pkg: BilibiliEmotePackage) => {
  previewingPackage.value = pkg
  previewModalVisible.value = true
}

// 关闭预览模态框
const closePreview = () => {
  previewModalVisible.value = false
  previewingPackage.value = null
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
    message.error('请至少选择一个表情包')
    return
  }

  try {
    const selectedPackagesData = packages.value.filter(pkg =>
      selectedPackages.value.includes(pkg.id)
    )

    const convertedEmotes = convertBilibiliEmotesToPluginFormat(
      selectedPackagesData,
      targetGroupId.value || undefined
    )

    // 直接使用 store 的方法添加
    store.beginBatch()
    try {
      convertedEmotes.forEach(item => {
        if (targetGroupId.value) {
          // 添加到指定分组
          const group = store.groups.find(g => g.id === targetGroupId.value)
          if (group) {
            group.emojis.push(...item.emojis)
          }
        } else {
          // 创建新分组
          const newGroup = {
            id: `bili_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
            name: item.name,
            icon: item.icon || '📦',
            detail: `Bilibili 表情包 ID: ${item.sourceId || ''}`,
            order: store.groups.length,
            emojis: item.emojis
          }
          store.groups = [...store.groups, newGroup]
        }
      })
      store.endBatch()

      message.success(
        `成功导入 ${selectedPackages.value.length} 个表情包，共 ${convertedEmotes.reduce((sum, item) => sum + item.emojis.length, 0)} 个表情`
      )

      // 重置状态
      selectedPackages.value = []
      packages.value = []
      targetGroupId.value = ''
      errorMessage.value = ''
    } catch (error) {
      store.endBatch()
      throw error
    }
  } catch (error) {
    console.error('导入失败：', error)
    message.error(`导入失败：${error instanceof Error ? error.message : '未知错误'}`)
  }
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
      message.info(`表情包「${packageData.text}」已存在，已更新`)
    } else {
      // 如果不存在，添加
      packages.value.push(packageData)
      message.success(`成功添加表情包「${packageData.text}」（${packageData.emote.length} 个表情）`)
    }

    // 自动选中新添加的表情包
    if (!selectedPackages.value.includes(packageData.id)) {
      selectedPackages.value.push(packageData.id)
    }

    packageIdInput.value = ''
  } catch (error) {
    console.error('通过 ID 导入表情包失败：', error)
    errorMessage.value = `导入失败：${error instanceof Error ? error.message : '未知错误'}`
    message.error(errorMessage.value)
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
      message.info('未找到匹配的表情包')
    } else {
      message.success(`找到 ${results.length} 个匹配的表情包`)
    }
  } catch (error) {
    console.error('搜索表情包失败：', error)
    errorMessage.value = '搜索失败，请稍后重试'
    message.error(errorMessage.value)
  } finally {
    searchLoading.value = false
  }
}

const selectSearchResult = async (result: BilibiliEmoteIndexItem) => {
  // 填充 ID 到输入框并自动触发导入
  packageIdInput.value = String(result.id)
  await importPackageById()
  // 清空搜索结果
  searchResults.value = []
  searchInput.value = ''
}
</script>

<template>
  <div class="p-6">
    <div class="max-w-6xl mx-auto">
      <!-- 页面标题 -->
      <div class="mb-6">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">Bilibili 表情导入</h1>
        <p class="text-gray-600 dark:text-gray-400">通过表情包 ID 从 Bilibili 导入表情包到插件中</p>
      </div>

      <!-- 错误信息 -->
      <div
        v-if="errorMessage"
        class="mb-6 p-4 bg-red-100 dark:bg-red-900 border border-red-300 dark:border-red-700 rounded-md"
      >
        <p class="text-red-800 dark:text-red-200">{{ errorMessage }}</p>
      </div>

      <!-- 主要内容区域 -->
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 space-y-6">
        <!-- 搜索与 ID 导入区域 -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <!-- 搜索区域 -->
          <div
            class="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-md p-4"
          >
            <h4 class="font-medium text-purple-900 dark:text-purple-100 mb-3">1️⃣ 搜索表情包</h4>
            <div class="flex gap-2 mb-3">
              <a-input
                v-model:value="searchInput"
                placeholder="输入关键词搜索 (如: 小黄脸)"
                @pressEnter="handleSearch"
              />
              <a-button
                type="primary"
                @click="handleSearch"
                :disabled="!searchInput || !searchInput.trim()"
                :loading="searchLoading"
              >
                搜索
              </a-button>
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
                <a-button size="small" type="text">选择</a-button>
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
            <h4 class="font-medium text-blue-900 dark:text-blue-100 mb-3">2️⃣ 通过 ID 导入</h4>

            <p class="text-sm text-blue-800 dark:text-blue-200 mb-4">
              直接输入 Bilibili 表情包 ID 导入。
            </p>

            <div class="flex gap-2">
              <a-input-number
                v-model:value="packageIdInput"
                placeholder="输入表情包ID (如: 237)"
                class="flex-1"
                :controls="false"
                @pressEnter="importPackageById"
              />
              <a-button
                type="primary"
                @click="importPackageById"
                :disabled="!packageIdInput || !String(packageIdInput).trim()"
                :loading="idImportLoading"
              >
                导入
              </a-button>
            </div>
          </div>
        </div>

        <!-- 已导入的表情包列表 -->
        <div v-if="packages.length > 0" class="space-y-4">
          <div class="flex justify-between items-center">
            <div class="flex items-center gap-4">
              <h4 class="font-medium text-gray-900 dark:text-white">3️⃣ 已准备导入的表情包</h4>
              <div class="flex gap-2">
                <a-button size="small" @click="selectAllPackages" :disabled="packages.length === 0">
                  全选
                </a-button>
                <a-button
                  size="small"
                  @click="deselectAllPackages"
                  :disabled="selectedPackages.length === 0"
                >
                  取消全选
                </a-button>
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
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div
              v-for="pkg in packages"
              :key="pkg.id"
              class="border rounded-lg p-4 transition-all cursor-pointer"
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
                  <a-button
                    type="text"
                    danger
                    size="small"
                    @click.stop="removePackage(pkg.id)"
                    title="移除表情包"
                  >
                    <template #icon>
                      <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fill-rule="evenodd"
                          d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                          clip-rule="evenodd"
                        />
                      </svg>
                    </template>
                  </a-button>
                </div>
              </div>

              <!-- 表情预览 -->
              <div class="mt-3">
                <div class="flex flex-wrap gap-1 mb-2">
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
                <a-button
                  size="small"
                  type="link"
                  @click.stop="openPreview(pkg)"
                  class="p-0 h-auto"
                >
                  查看全部表情 ({{ pkg.emote.length }})
                </a-button>
              </div>
            </div>
          </div>

          <!-- 目标分组选择 -->
          <div>
            <h4 class="font-medium text-gray-900 dark:text-white mb-3">4️⃣ 选择目标分组</h4>
            <div class="space-y-3">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-white mb-1">
                  目标分组（可选，留空将按表情包名称创建新分组）
                </label>
                <GroupSelector
                  v-model="targetGroupId"
                  :groups="availableGroups"
                  placeholder="选择目标分组或留空创建新分组"
                />
              </div>
            </div>
          </div>

          <!-- 导入按钮 -->
          <div class="flex justify-end">
            <a-button
              type="primary"
              size="large"
              @click="doImport"
              :disabled="selectedPackages.length === 0 || isLoading"
              :loading="isLoading"
            >
              导入选中的表情包 ({{ selectedPackages.length }})
            </a-button>
          </div>
        </div>

        <!-- 无表情包时的提示 -->
        <div v-else class="text-center py-12">
          <p class="text-gray-500 dark:text-gray-400 text-lg mb-2">还没有添加任何表情包</p>
          <p class="text-sm text-gray-400 dark:text-gray-500">
            在上方通过搜索或输入 ID 开始添加表情包
          </p>
        </div>
      </div>
    </div>

    <!-- 表情预览模态框 -->
    <a-modal
      v-model:open="previewModalVisible"
      :title="`${previewingPackage?.text || '表情包'} (${previewingPackage?.emote.length || 0} 个表情)`"
      width="80%"
      :footer="null"
      @cancel="closePreview"
    >
      <div class="max-h-[70vh] overflow-y-auto">
        <div class="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4 p-4">
          <div
            v-for="emote in previewingPackage?.emote"
            :key="emote.id"
            class="flex flex-col items-center gap-2 p-2 border border-gray-200 dark:border-gray-700 rounded hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <img
              :src="emote.url"
              :alt="emote.text"
              class="w-16 h-16 object-contain"
              @error="
                e => {
                  ;(e.target as HTMLImageElement).src =
                    'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0zMiA0OEMyMS42OTEgNDggMTMuMzMzIDM5LjY0MiAxMy4zMzMgMjkuMzMzQzEzLjMzMyAxOS4wMjQgMjEuNjkxIDEwLjY2NyAzMiAxMC42NjdDNDIuMzA5IDEwLjY2NyA1MC42NjcgMTkuMDI0IDUwLjY2NyAyOS4zMzNDNTAuNjY3IDM5LjY0MiA0Mi4zMDkgNDggMzIgNDhaIiBmaWxsPSIjOUNBM0FGIi8+Cjwvc3ZnPgo='
                }
              "
            />
            <span class="text-xs text-center text-gray-600 dark:text-gray-400 truncate w-full">
              {{ emote.text }}
            </span>
          </div>
        </div>
      </div>
    </a-modal>
  </div>
</template>
