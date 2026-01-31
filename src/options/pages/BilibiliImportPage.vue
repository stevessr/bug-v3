<script setup lang="ts">
import { ref, computed } from 'vue'

import CachedImage from '@/components/CachedImage.vue'
import {
  fetchBilibiliEmotePackageById,
  searchBilibiliPackages,
  type BilibiliEmotePackage,
  type BilibiliEmoteIndexItem
} from '@/services/bilibiliEmoteApi'
import { useEmojiStore } from '@/stores/emojiStore'
import GroupSelector from '@/options/components/GroupSelector.vue'

const { t } = useI18n()

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
    message.error(t('pleaseSelectAtLeastOnePackage'))
    return
  }

  try {
    const selectedPackagesData = packages.value.filter(pkg =>
      selectedPackages.value.includes(pkg.id)
    )

    // 直接使用 store 的方法添加
    store.beginBatch()
    try {
      selectedPackagesData.forEach(pkg => {
        if (targetGroupId.value) {
          // 添加到指定分组
          const group = store.groups.find(g => g.id === targetGroupId.value)
          if (group) {
            pkg.emote.forEach(emote => {
              group.emojis.push({
                id: `bili_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
                packet: 0,
                name: emote.text.replace(/[[\]]/g, ''),
                url: emote.url,
                displayUrl: emote.url,
                groupId: group.id
              })
            })
          }
        } else {
          // 创建新分组
          const newGroup = {
            id: `bili_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
            name: pkg.text,
            icon: '📦',
            detail: `Bilibili 表情包 ID: ${pkg.id}`,
            order: store.groups.length,
            emojis: pkg.emote.map(emote => ({
              id: `bili_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
              packet: 0,
              name: emote.text.replace(/[[\]]/g, ''),
              url: emote.url,
              displayUrl: emote.url,
              groupId: ''
            }))
          }
          // 更新分组 ID
          newGroup.emojis.forEach(e => {
            e.groupId = newGroup.id
          })
          store.groups = [...store.groups, newGroup]
        }
      })
      store.endBatch()

      const totalEmojis = selectedPackagesData.reduce((sum, pkg) => sum + pkg.emote.length, 0)
      message.success(t('importSuccess', { count: selectedPackages.value.length, totalEmojis }))

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
    message.error(
      t('importFailed', { error: error instanceof Error ? error.message : t('unknownError') })
    )
  }
}

const importPackageById = async () => {
  const packageId = parseInt(String(packageIdInput.value).trim())

  if (!packageId || isNaN(packageId)) {
    errorMessage.value = t('pleaseEnterValidPackageId')
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
      message.info(t('packageAlreadyExists', { name: packageData.text }))
    } else {
      // 如果不存在，添加
      packages.value.push(packageData)
      message.success(
        t('packageAddSuccess', { name: packageData.text, count: packageData.emote.length })
      )
    }

    // 自动选中新添加的表情包
    if (!selectedPackages.value.includes(packageData.id)) {
      selectedPackages.value.push(packageData.id)
    }

    packageIdInput.value = ''
  } catch (error) {
    console.error('通过 ID 导入表情包失败：', error)
    errorMessage.value = t('packageImportFailed', {
      error: error instanceof Error ? error.message : t('unknownError')
    })
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
      message.info(t('noMatchingPackagesFound'))
    } else {
      message.success(t('searchSuccess', { count: results.length }))
    }
  } catch (error) {
    console.error('搜索表情包失败：', error)
    errorMessage.value = t('searchFailed')
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
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          {{ t('bilibiliImportTitle') }}
        </h1>
        <p class="text-gray-600 dark:text-gray-400">{{ t('bilibiliImportDescription') }}</p>
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
            <h4 class="font-medium text-purple-900 dark:text-purple-100 mb-3">
              {{ t('searchEmotePackages') }}
            </h4>
            <div class="flex gap-2 mb-3">
              <a-input
                v-model:value="searchInput"
                :placeholder="t('searchEmotePackagesPlaceholder')"
                @pressEnter="handleSearch"
              />
              <a-button
                type="primary"
                @click="handleSearch"
                :disabled="!searchInput || !searchInput.trim()"
                :loading="searchLoading"
              >
                {{ searchLoading ? t('searching') : t('search') }}
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
                <CachedImage :src="result.url" class="w-8 h-8 rounded object-cover" />
                <div class="flex-1 min-w-0">
                  <div class="font-medium text-sm truncate dark:text-gray-200">
                    {{ result.text }}
                  </div>
                  <div class="text-xs text-gray-500">ID: {{ result.id }}</div>
                </div>
                <a-button size="small" type="text">{{ t('select') }}</a-button>
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
              {{ t('noRelatedPackagesFound') }}
            </div>
          </div>

          <!-- ID 导入区域 -->
          <div
            class="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md"
          >
            <h4 class="font-medium text-blue-900 dark:text-blue-100 mb-3">{{ t('importById') }}</h4>

            <p class="text-sm text-blue-800 dark:text-blue-200 mb-4">
              {{ t('importByIdDescription') }}
            </p>

            <div class="flex gap-2">
              <a-input-number
                v-model:value="packageIdInput"
                :placeholder="t('packageIdPlaceholder')"
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
                {{ idImportLoading ? t('importing') : t('import') }}
              </a-button>
            </div>
          </div>
        </div>

        <!-- 已导入的表情包列表 -->
        <div v-if="packages.length > 0" class="space-y-4">
          <div class="flex justify-between items-center">
            <div class="flex items-center gap-4">
              <h4 class="font-medium text-gray-900 dark:text-white">{{ t('preparedPackages') }}</h4>
              <div class="flex gap-2">
                <a-button size="small" @click="selectAllPackages" :disabled="packages.length === 0">
                  {{ t('selectAll') }}
                </a-button>
                <a-button
                  size="small"
                  @click="deselectAllPackages"
                  :disabled="selectedPackages.length === 0"
                >
                  {{ t('deselectAll') }}
                </a-button>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-sm text-gray-600 dark:text-gray-400">
                {{ t('packagesCount', { count: packages.length }) }}
              </span>
              <span class="text-sm text-blue-600 dark:text-blue-400">
                {{ t('selectedCount', { count: selectedPackages.length }) }}
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
                <CachedImage
                  :src="pkg.url"
                  :alt="pkg.text"
                  class="w-12 h-12 rounded object-cover"
                />
                <div class="flex-1">
                  <h4 class="font-medium text-gray-900 dark:text-white">{{ pkg.text }}</h4>
                  <p class="text-sm text-gray-500 dark:text-gray-400">
                    {{ t('emotesCount', { count: pkg.emote.length }) }}
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
                    :title="t('removePackage')"
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
                  <CachedImage
                    v-for="emote in pkg.emote.slice(0, 6)"
                    :key="emote.id"
                    :src="emote.url"
                    :alt="emote.text"
                    class="w-6 h-6 rounded object-cover"
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
                  {{ t('viewAllEmojis', [pkg.emote.length]) }}
                </a-button>
              </div>
            </div>
          </div>

          <!-- 目标分组选择 -->
          <div>
            <h4 class="font-medium text-gray-900 dark:text-white mb-3">
              {{ t('selectTargetGroup') }}
            </h4>
            <div class="space-y-3">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-white mb-1">
                  {{ t('targetGroupOptional') }}
                </label>
                <GroupSelector
                  v-model="targetGroupId"
                  :groups="availableGroups"
                  :placeholder="t('selectTargetGroupOrLeaveEmpty')"
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
              {{ t('importSelectedPackages', [selectedPackages.length]) }}
            </a-button>
          </div>
        </div>

        <!-- 无表情包时的提示 -->
        <div v-else class="text-center py-12">
          <p class="text-gray-500 dark:text-gray-400 text-lg mb-2">{{ t('noPackagesAdded') }}</p>
          <p class="text-sm text-gray-400 dark:text-gray-500">
            {{ t('startAddingPackages') }}
          </p>
        </div>
      </div>
    </div>

    <!-- 表情预览模态框 -->
    <a-modal
      v-model:open="previewModalVisible"
      :title="
        t('packageDetailsWithTitle', [
          previewingPackage?.text || t('packageDetails'),
          previewingPackage?.emote.length || 0
        ])
      "
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
            <CachedImage :src="emote.url" :alt="emote.text" class="w-16 h-16 object-contain" />
            <span class="text-xs text-center text-gray-600 dark:text-gray-400 truncate w-full">
              {{ emote.text }}
            </span>
          </div>
        </div>
      </div>
    </a-modal>
  </div>
</template>
