<script setup lang="ts">
import { ref } from 'vue'
import { CheckCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons-vue'

import type { OptionsInject } from '../types'
import { formatDate } from '../pages/utils/settings'

import CachedImage from '@/components/CachedImage.vue'

const props = defineProps<{
  options: OptionsInject
  isConfigured: boolean
}>()

const { emojiStore } = props.options

// UI state
const isPreviewing = ref(false)
const previewResult = ref<{ success: boolean; data?: any; message: string } | null>(null)
const cloudData = ref<any>(null)
const showPreviewDialog = ref(false)

// State for group details modal
const showGroupDetailsModal = ref(false)
const selectedGroup = ref<any>(null)
const groupDetails = ref<any>(null)
const isLoadingGroupDetails = ref(false)

// Preview cloud data
const previewCloudData = async () => {
  if (!props.isConfigured) {
    props.options.showError('请先配置同步参数')
    return
  }

  isPreviewing.value = true
  previewResult.value = null
  cloudData.value = null

  try {
    // 传递进度回调函数
    const result = await emojiStore.previewCloudConfig(progress => {
      console.log('[CloudDataPreview] Preview progress update:', progress)
    })

    previewResult.value = result

    if (result.success && result.config) {
      console.log('[CloudDataPreview] Preview config data:', result.config)
      cloudData.value = result.config
      showPreviewDialog.value = true
      props.options.showSuccess('云端配置预览成功')
    } else {
      console.error('[CloudDataPreview] Preview failed:', result)
      props.options.showError('预览云端配置失败：' + result.message)
    }
  } catch (error) {
    const errorMessage = `预览失败：${(error as Error).message}`
    previewResult.value = { success: false, message: errorMessage }
    props.options.showError(errorMessage)
  } finally {
    isPreviewing.value = false
  }
}

// Load group details (lazy loading)
const loadGroupDetails = async (group: any) => {
  if (!group || !group.name) {
    props.options.showError('无效的分组信息')
    return
  }

  if (group.emojis) {
    selectedGroup.value = group
    groupDetails.value = group
    showGroupDetailsModal.value = true
    isLoadingGroupDetails.value = false
    return
  }

  selectedGroup.value = group
  showGroupDetailsModal.value = true
  isLoadingGroupDetails.value = true
  groupDetails.value = null

  try {
    const result = await emojiStore.loadGroupDetails(group.name, progress => {
      console.log('[CloudDataPreview] Loading group details progress:', progress)
    })

    if (result.success && result.group) {
      // Update the group in cloudData with the full details
      const groupIndex = cloudData.value.emojiGroups.findIndex((g: any) => g.name === group.name)
      if (groupIndex !== -1) {
        cloudData.value.emojiGroups[groupIndex] = { ...group, ...result.group }
      }
      groupDetails.value = result.group
      showGroupDetailsModal.value = true
    } else {
      props.options.showError('加载分组详情失败：' + result.message)
    }
  } catch (error) {
    const errorMessage = `加载分组详情失败：${(error as Error).message}`
    props.options.showError(errorMessage)
  } finally {
    isLoadingGroupDetails.value = false
  }
}

// Close group details modal
const closeGroupDetailsModal = () => {
  showGroupDetailsModal.value = false
  selectedGroup.value = null
  groupDetails.value = null
}

// Expose methods
defineExpose({
  previewCloudData
})
</script>

<template>
  <div>
    <!-- Cloud Data Preview Modal -->
    <a-modal v-model:open="showPreviewDialog" title="云端配置预览" width="800px">
      <template #footer>
        <a-button @click="showPreviewDialog = false">关闭</a-button>
      </template>
      <div v-if="previewResult && cloudData" class="space-y-6">
        <!-- Preview Status -->
        <div
          class="p-4 rounded-lg border"
          :class="
            previewResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
          "
        >
          <div class="flex items-center space-x-2">
            <CheckCircleOutlined v-if="previewResult.success" class="text-green-600" />
            <ExclamationCircleOutlined v-else class="text-red-600" />
            <span
              class="font-medium"
              :class="previewResult.success ? 'text-green-700' : 'text-red-700'"
            >
              {{ previewResult.success ? '云端配置获取成功' : '云端配置获取失败' }}
            </span>
          </div>
          <p class="text-sm text-gray-600 mt-1">{{ previewResult.message }}</p>
        </div>

        <!-- Cloud Data Statistics -->
        <div v-if="previewResult.success && cloudData" class="space-y-4">
          <h4 class="text-lg font-semibold text-gray-800 dark:text白">配置概览</h4>

          <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div
              class="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800"
            >
              <div class="text-2xl font-bold text-blue-600 dark:text-blue-400">
                <CheckCircleOutlined
                  v-if="typeof cloudData.connectionTest === 'boolean' && cloudData.connectionTest"
                />
                <ExclamationCircleOutlined v-else />
              </div>
              <div class="text-sm text-blue-700 dark:text-blue-300">连接状态</div>
            </div>

            <div
              class="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg border border-green-200 dark:border-green-800"
            >
              <div class="text-2xl font-bold text-green-600 dark:text-green-400">
                {{ cloudData.metadata?.totalGroups || 0 }}
              </div>
              <div class="text-sm text-green-700 dark:text-green-300">分组数量</div>
            </div>

            <div
              class="bg-orange-50 dark:bg-orange-900/20 p-3 rounded-lg border border-orange-200 dark:border-orange-800"
            >
              <div class="text-lg font-bold text-orange-600 dark:text-orange-400">
                {{
                  typeof cloudData.timestamp === 'object'
                    ? 'Invalid Date'
                    : formatDate(cloudData.timestamp)
                }}
              </div>
              <div class="text-sm text-orange-700 dark:text-orange-300">检查时间</div>
            </div>
          </div>

          <!-- Settings/Metadata Info -->
          <div v-if="cloudData.settings && Object.keys(cloudData.settings).length > 0">
            <h5 class="text-md font-semibold text灰色-700 dark:text白 mb-3">设置信息</h5>
            <div class="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div class="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                <div class="text-gray-500 dark:text-gray-400">版本</div>
                <div class="font-medium text-gray-800 dark:text白">
                  {{ typeof cloudData.version === 'object' ? 'N/A' : cloudData.version || 'N/A' }}
                </div>
              </div>
              <div class="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                <div class="text-gray-500 dark:text灰色-400">收藏数量</div>
                <div class="font-medium text-gray-800 dark:text白">
                  {{ cloudData.metadata?.favoritesCount || 0 }}
                </div>
              </div>
              <div class="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                <div class="text-gray-500 dark:text灰色-400">最后修改</div>
                <div class="font-medium text-gray-800 dark:text白">
                  {{
                    cloudData.metadata?.lastModified
                      ? formatDate(cloudData.metadata.lastModified)
                      : 'N/A'
                  }}
                </div>
              </div>
            </div>
          </div>

          <!-- Emoji Groups Details -->
          <div v-if="cloudData.emojiGroups && cloudData.emojiGroups.length > 0">
            <h5 class="text-md font-semibold text灰色-700 dark:text白 mb-3">表情分组</h5>
            <div class="space-y-2 max-h-60 overflow-y-auto">
              <div
                v-for="group in cloudData.emojiGroups"
                :key="group.id"
                class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                @click="loadGroupDetails(group)"
              >
                <div class="flex items-center space-x-3">
                  <div
                    class="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text白 text-xs font-bold"
                  >
                    {{ group.name.charAt(0).toUpperCase() }}
                  </div>
                  <div class="font-medium text-gray-800 dark:text白">{{ group.name }}</div>
                </div>
                <div class="flex items-center space-x-2">
                  <div class="text-blue-500 dark:text-blue-400">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M9 5l7 7-7 7"
                      ></path>
                    </svg>
                  </div>
                </div>
              </div>
            </div>
            <div class="mt-2 text-xs text-gray-500 dark:text灰色-400 text-center">
              点击分组查看详细信息
            </div>
          </div>

          <!-- Connection Info -->
          <div>
            <h5 class="text-md font-semibold text灰色-700 dark:text白 mb-3">连接信息</h5>
            <div class="grid grid-cols-2 gap-4 text-sm">
              <div class="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                <div class="text-gray-500 dark:text灰色-400">数据可用性</div>
                <div class="font-medium text-gray-800 dark:text白">
                  {{
                    typeof cloudData.hasData === 'boolean'
                      ? cloudData.hasData
                        ? '可用'
                        : '无数据'
                      : '未知'
                  }}
                </div>
              </div>
              <div class="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                <div class="text-gray-500 dark:text灰色-400">同步服务</div>
                <div class="font-medium text-gray-800 dark:text白">
                  <!-- We'll need to pass syncType as a prop or get it from the store -->
                  Cloudflare
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-else-if="isPreviewing" class="flex items-center justify-center py-8">
        <a-spin size="large" />
        <span class="ml-3 text-gray-600 dark:text灰色-400">正在检查云端配置...</span>
      </div>

      <div v-else class="text-center py-8 text-gray-500 dark:text灰色-400">暂无配置可预览</div>
    </a-modal>

    <!-- Group Details Modal -->
    <a-modal
      v-model:open="showGroupDetailsModal"
      :title="selectedGroup?.name ? `分组详情：${selectedGroup.name}` : '分组详情'"
      width="720px"
      @cancel="closeGroupDetailsModal"
    >
      <template #footer>
        <a-button @click="closeGroupDetailsModal">关闭</a-button>
      </template>

      <div v-if="isLoadingGroupDetails" class="flex items-center justify-center py-8">
        <a-spin size="large" />
        <span class="ml-3 text-gray-600 dark:text-gray-400">正在加载分组详情...</span>
      </div>

      <div v-else-if="groupDetails" class="space-y-6">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div class="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
            <div class="text-gray-500 dark:text-gray-400">表情数量</div>
            <div class="text-xl font-semibold text-gray-800 dark:text-white">
              {{ groupDetails.emojis?.length || 0 }}
            </div>
          </div>
          <div class="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
            <div class="text-gray-500 dark:text-gray-400">更新时间</div>
            <div class="font-medium text-gray-800 dark:text-white">
              {{ formatDate(groupDetails.lastModified || groupDetails.createdAt) }}
            </div>
          </div>
        </div>

        <div
          v-if="groupDetails.description"
          class="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800"
        >
          <div class="text-sm text-gray-600 dark:text-gray-300">分组备注</div>
          <p class="mt-1 text-gray-800 dark:text-white whitespace-pre-line">
            {{ groupDetails.description }}
          </p>
        </div>

        <div v-if="groupDetails.emojis?.length" class="space-y-4">
          <h5 class="text-md font-semibold text-gray-700 dark:text-white">表情列表</h5>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-80 overflow-y-auto">
            <div
              v-for="(emoji, index) in groupDetails.emojis"
              :key="emoji.id || emoji.name || index"
              class="flex items-center space-x-3 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
            >
              <div
                class="w-12 h-12 flex items-center justify-center bg-gray-50 dark:bg-gray-700 rounded-lg overflow-hidden"
              >
                <CachedImage
                  v-if="emoji.displayUrl || emoji.url"
                  :src="emoji.displayUrl || emoji.url"
                  :alt="emoji.name || `emoji-${index}`"
                  class="w-full h-full object-contain"
                />
                <span v-else class="text-xs text-gray-400">无预览</span>
              </div>
              <div class="flex-1 min-w-0">
                <div class="font-medium text-gray-800 dark:text-white truncate">
                  {{ emoji.name || `表情 ${(index as number) + 1}` }}
                </div>
                <div class="text-xs text-gray-500 dark:text-gray-400 break-all">
                  {{ emoji.url || emoji.displayUrl || '无 URL' }}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="text-center py-6 text-gray-500 dark:text-gray-400">该分组暂无表情</div>
      </div>

      <div v-else class="text-center py-8 text-gray-500 dark:text-gray-400">暂无分组详情可展示</div>
    </a-modal>
  </div>
</template>
