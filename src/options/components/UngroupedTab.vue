<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue'
import { DownOutlined, QuestionCircleOutlined } from '@ant-design/icons-vue'

import type { EmojiGroup, Emoji } from '../../types/type'
import { useEmojiStore } from '../../stores/emojiStore'
import { emojiPreviewUploader } from '../utils/emojiPreviewUploader'
import { getEmojiImageUrlWithLoading, getEmojiImageUrlSync } from '../../utils/imageUrlHelper'

import GroupSelector from './GroupSelector.vue'
import CreateGroupModal from './CreateGroupModal.vue'

defineEmits(['remove', 'edit', 'addEmoji'])

// use store instance directly
const emojiStore = useEmojiStore()

// 获取未分组
const ungroup = computed(() => emojiStore.groups.find((g: EmojiGroup) => g.id === 'ungrouped'))

// 图片缓存状态管理
const imageSources = ref<Map<string, string>>(new Map())
const loadingStates = ref<Map<string, boolean>>(new Map())

// 初始化图片缓存
const initializeImageSources = async () => {
  if (!ungroup.value?.emojis) return

  console.log(
    '[UngroupedTab] Initializing image sources for ungrouped:',
    ungroup.value.emojis.length
  )
  console.log('[UngroupedTab] Cache enabled:', emojiStore.settings.useIndexedDBForImages)

  const newSources = new Map<string, string>()
  const newLoadingStates = new Map<string, boolean>()

  for (const emoji of ungroup.value.emojis) {
    try {
      if (emojiStore.settings.useIndexedDBForImages) {
        // 使用缓存优先的加载函数
        const result = await getEmojiImageUrlWithLoading(emoji, { preferCache: true })
        newSources.set(emoji.id, result.url)
        newLoadingStates.set(emoji.id, result.isLoading)
        console.log(
          `[UngroupedTab] Image source for ${emoji.name}:`,
          result.url,
          'from cache:',
          result.isFromCache
        )
      } else {
        // 直接 URL 模式
        const fallbackSrc = emoji.displayUrl || emoji.url
        newSources.set(emoji.id, fallbackSrc)
        console.log(`[UngroupedTab] Direct URL for ${emoji.name}:`, fallbackSrc)
      }
    } catch (error) {
      console.warn(`[UngroupedTab] Failed to get image source for ${emoji.name}:`, error)
      // 回退到直接 URL
      const fallbackSrc = emoji.displayUrl || emoji.url
      newSources.set(emoji.id, fallbackSrc)
    }
  }

  imageSources.value = newSources
  loadingStates.value = newLoadingStates
  console.log('[UngroupedTab] Image sources initialized:', imageSources.value.size)
}

// 监听未分组表情变化
watch(
  () => ungroup.value?.emojis,
  () => {
    console.log('[UngroupedTab] Ungrouped emojis changed, reinitializing image sources')
    initializeImageSources()
  },
  { deep: true }
)

// 组件挂载时初始化
onMounted(() => {
  console.log('[UngroupedTab] Component mounted')
  initializeImageSources()
})

// 多选功能相关状态
const isMultiSelectMode = ref(false)
const selectedEmojis = ref(new Set<number>())
const targetGroupId = ref('')

// 全选状态
const totalCount = computed(() => ungroup.value?.emojis?.length || 0)
const checkedCount = computed(() => selectedEmojis.value.size)
const checkAll = computed<boolean>({
  get: () => totalCount.value > 0 && checkedCount.value === totalCount.value,
  set: (val: boolean) => {
    if (!ungroup.value) return
    if (val) {
      selectedEmojis.value = new Set(ungroup.value.emojis.map((_, i) => i))
    } else {
      clearSelection()
    }
  }
})

const indeterminate = computed(
  () => checkedCount.value > 0 && checkedCount.value < totalCount.value
)

const onCheckAllChange = (e: any) => {
  const checked = !!(e && e.target && e.target.checked)
  if (!ungroup.value) return
  if (checked) {
    selectedEmojis.value = new Set(ungroup.value.emojis.map((_, i) => i))
  } else {
    clearSelection()
  }
}

// Upload functionality
const uploadingEmojiIds = ref(new Set<number>())

const onTargetGroupSelect = (info: { key: string | number }) => {
  targetGroupId.value = String(info.key)
}
const showCreateGroupDialog = ref(false)
const copyButtonLabel = ref('复制为 markdown')

// 可用的分组列表（排除未分组）
const availableGroups = computed(
  () => emojiStore.groups.filter((g: EmojiGroup) => g.id !== 'ungrouped') || []
)

// Check if we should show upload buttons (not on linux.do)
const shouldShowUploadButton = computed(() => {
  return !window.location.href.includes('linux.do')
})

// Upload single emoji to linux.do
const uploadSingleEmoji = async (emoji: Emoji, index: number) => {
  // Skip if no url, already uploading, or already hosted on linux.do
  if (!emoji.url || uploadingEmojiIds.value.has(index) || emoji.url.includes('linux.do')) return

  uploadingEmojiIds.value.add(index)

  try {
    // Convert image URL to blob
    const response = await fetch(emoji.url)
    const blob = await response.blob()

    // Create file with proper name
    const fileName = `${emoji.name}.${blob.type.split('/')[1] || 'png'}`
    const file = new File([blob], fileName, { type: blob.type })

    // Upload to linux.do and replace url on success
    try {
      const resp = await emojiPreviewUploader.uploadEmojiImage(file, emoji.name || 'emoji')
      if (resp && resp.url) {
        // Update emoji url in store (ungrouped group)
        emojiStore.updateEmojiInGroup('ungrouped', index, { url: resp.url })
      }
    } finally {
      // Show upload progress dialog (always)
      emojiPreviewUploader.showProgressDialog()
    }
  } catch (error) {
    console.error('Upload failed:', error)
  } finally {
    uploadingEmojiIds.value.delete(index)
  }
}

// Reference uploadSingleEmoji to avoid TS 'declared but its value is never read' when template uses $emit
void uploadSingleEmoji

// Upload selected emojis in batch
const uploadSelectedEmojis = async () => {
  if (selectedEmojis.value.size === 0 || !ungroup.value) return

  const emojisToUpload = Array.from(selectedEmojis.value)
    .map(index => ({ emoji: ungroup.value!.emojis[index], index }))
    .filter(({ emoji }) => emoji && emoji.url && !emoji.url.includes('linux.do'))

  if (emojisToUpload.length === 0) return

  // Mark all as uploading
  emojisToUpload.forEach(({ index }) => uploadingEmojiIds.value.add(index))

  try {
    // Show upload progress dialog
    emojiPreviewUploader.showProgressDialog()

    // Upload all selected emojis
    const uploadPromises = emojisToUpload.map(async ({ emoji, index }) => {
      try {
        const response = await fetch(emoji.url!)
        const blob = await response.blob()
        const fileName = `${emoji.name}.${blob.type.split('/')[1] || 'png'}`
        const file = new File([blob], fileName, { type: blob.type })
        const resp = await emojiPreviewUploader.uploadEmojiImage(file, emoji.name || 'emoji')
        if (resp && resp.url) {
          // Find this emoji in ungrouped and update its url
          emojiStore.updateEmojiInGroup('ungrouped', index, { url: resp.url })
        }
        return resp
      } catch (error) {
        console.error('Failed to upload emoji:', emoji.name, error)
        throw error
      }
    })

    await Promise.allSettled(uploadPromises)
  } finally {
    // Clear uploading state
    emojisToUpload.forEach(({ index }) => uploadingEmojiIds.value.delete(index))
  }
}

// Upload all ungrouped emojis
const uploadAllEmojis = async () => {
  if (!ungroup.value || ungroup.value.emojis.length === 0) return

  const emojisToUpload = ungroup.value.emojis
    .map((emoji, index) => ({ emoji, index }))
    .filter(({ emoji }) => emoji && emoji.url && !emoji.url.includes('linux.do'))

  if (emojisToUpload.length === 0) return

  // Mark all as uploading
  emojisToUpload.forEach(({ index }) => uploadingEmojiIds.value.add(index))

  try {
    // Show upload progress dialog
    emojiPreviewUploader.showProgressDialog()

    // Upload all emojis
    const uploadPromises = emojisToUpload.map(async ({ emoji, index }) => {
      try {
        const response = await fetch(emoji.url!)
        const blob = await response.blob()
        const fileName = `${emoji.name}.${blob.type.split('/')[1] || 'png'}`
        const file = new File([blob], fileName, { type: blob.type })
        const resp = await emojiPreviewUploader.uploadEmojiImage(file, emoji.name || 'emoji')
        if (resp && resp.url) {
          emojiStore.updateEmojiInGroup('ungrouped', index, { url: resp.url })
        }
        return resp
      } catch (error) {
        console.error('Failed to upload emoji:', emoji.name, error)
        throw error
      }
    })

    await Promise.allSettled(uploadPromises)
  } finally {
    // Clear uploading state
    emojisToUpload.forEach(({ index }) => uploadingEmojiIds.value.delete(index))
  }
}

// 多选模式变化处理
const onMultiSelectModeChange = () => {
  if (!isMultiSelectMode.value) {
    clearSelection()
  }
}

// 切换表情选择状态
const toggleEmojiSelection = (idx: number) => {
  if (selectedEmojis.value.has(idx)) {
    selectedEmojis.value.delete(idx)
  } else {
    selectedEmojis.value.add(idx)
  }
  // 触发响应式更新
  selectedEmojis.value = new Set(selectedEmojis.value)
}

// 处理点击行为：在多选模式下切换选择，非多选模式不作处理
const handleEmojiClick = (idx: number) => {
  if (isMultiSelectMode.value) toggleEmojiSelection(idx)
}

// 清空选择
const clearSelection = () => {
  selectedEmojis.value.clear()
  selectedEmojis.value = new Set()
  targetGroupId.value = ''
}

// 移动选中的表情
const moveSelectedEmojis = async () => {
  if (!targetGroupId.value || selectedEmojis.value.size === 0) return

  try {
    // 如果选择创建新分组
    if (targetGroupId.value === '__create_new__') {
      showCreateGroupDialog.value = true
      return
    }

    const targetGroup = emojiStore.groups.find((g: EmojiGroup) => g.id === targetGroupId.value)
    if (!targetGroup) return

    // 获取选中的表情索引（按降序排列，避免删除时索引变化）
    const sortedIndices = Array.from(selectedEmojis.value).sort((a, b) => b - a)

    // 开始批量操作
    emojiStore.beginBatch()

    try {
      // 逐个移动表情
      for (const index of sortedIndices) {
        if (ungroup.value && index < ungroup.value.emojis.length) {
          // 使用store的moveEmoji方法移动表情
          emojiStore.moveEmoji(
            'ungrouped',
            index,
            targetGroupId.value,
            -1 // -1表示添加到目标分组的末尾
          )
        }
      }
    } finally {
      // 结束批量操作，触发保存
      await emojiStore.endBatch()
    }

    // 清空选择
    clearSelection()
  } catch {
    // ignore errors during move
  }
}

// 复制选中的表情为 markdown 格式到剪贴板
const copySelectedAsMarkdown = async () => {
  if (selectedEmojis.value.size === 0 || !ungroup.value) return

  const lines = Array.from(selectedEmojis.value)
    .map(idx => {
      const e = ungroup.value!.emojis[idx]
      return e && e.url ? `![](${e.url})` : null
    })
    .filter((v): v is string => !!v)

  if (lines.length === 0) return

  const markdown = lines.join('\n')

  try {
    if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(markdown)
    } else {
      // fallback
      const ta = document.createElement('textarea')
      ta.value = markdown
      // Avoid visible flash
      ta.style.position = 'fixed'
      ta.style.left = '-9999px'
      document.body.appendChild(ta)
      ta.select()
      try {
        document.execCommand('copy')
      } catch (e) {
        // ignore
      }
      document.body.removeChild(ta)
    }
  } catch (err) {
    console.error('Failed to copy markdown to clipboard', err)
  }
}

// Avoid TS "declared but its value is never read" if template uses the function via $emit or similar
void copySelectedAsMarkdown

// 确认创建新分组
const handleCreateGroup = async (data: { name: string; icon: string; detail: string }) => {
  try {
    // 创建新分组
    const newGroup = emojiStore.createGroup(data.name, data.icon)

    // 如果有详细信息，可以在这里保存（需要扩展 emojiStore 的 createGroup 方法）
    if (data.detail) {
      // TODO: 保存详细信息到分组
      console.log('Group detail:', data.detail)
    }

    // 设置目标分组 ID
    targetGroupId.value = newGroup.id

    // 立即执行移动操作
    await moveSelectedEmojis()
  } catch {
    // ignore errors during group creation
  }
}

// 取消创建分组
const cancelCreateGroup = () => {
  showCreateGroupDialog.value = false
}
</script>

<template>
  <div class="space-y-8">
    <div class="bg-white rounded-lg shadow-sm border dark:border-gray-700 dark:bg-gray-800">
      <div class="px-6 py-4 border-b border-gray-200">
        <div class="flex justify-between items-center">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white">未分组表情</h2>
          <div class="flex items-center gap-4">
            <!-- 批量操作控制 -->
            <div v-if="isMultiSelectMode" class="flex items-center gap-2">
              <!-- 全选复选框 -->
              <a-checkbox
                v-model:checked="checkAll"
                :indeterminate="indeterminate"
                @change="onCheckAllChange"
                class="text-sm"
                title="全选所有未分组表情"
              >
                全选
              </a-checkbox>
              <span class="text-sm text-gray-600 dark:text-white">
                已选择 {{ selectedEmojis.size }} 个
              </span>
              <div class="flex items-center gap-2">
                <GroupSelector
                  v-model="targetGroupId"
                  :groups="availableGroups"
                  placeholder="选择目标分组"
                  class="flex-1"
                />
                <a-button @click="showCreateGroupDialog = true" size="small" title="创建新分组">
                  + 新建
                </a-button>
              </div>
              <a-button
                @click="moveSelectedEmojis"
                :disabled="!targetGroupId"
                class="text-sm px-3 py-1 bg-blue-500 dark:bg-blue-600 text-white rounded hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                title="移动选中的表情到目标分组"
              >
                移动
              </a-button>
              <a-button
                @click="copySelectedAsMarkdown"
                :disabled="selectedEmojis.size === 0"
                class="text-sm px-3 py-1 bg-indigo-500 dark:bg-indigo-600 text-white rounded hover:bg-indigo-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                title="复制选中的表情为 Markdown 格式"
              >
                {{ copyButtonLabel }}
              </a-button>
              <a-button
                @click="clearSelection"
                class="text-sm px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600"
                title="清空所有表情选择"
              >
                清空选择
              </a-button>
            </div>
            <!-- 多选模式开关 -->
            <a-checkbox
              v-model:checked="isMultiSelectMode"
              @change="onMultiSelectModeChange"
              title="切换多选模式"
            >
              <span class="text-sm text-gray-700 dark:text-white">多选模式</span>
            </a-checkbox>
          </div>
        </div>
      </div>
      <div class="px-6 py-3 border-b border-gray-100 flex items-center justify-between">
        <!-- 左侧：添加表情按钮 -->
        <div class="flex items-center gap-2">
          <a-button
            @click="$emit('addEmoji', 'ungrouped')"
            class="text-sm px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center gap-2"
            title="添加表情到未分组"
          >
            ➕ 添加表情
          </a-button>
        </div>

        <!-- 右侧：上传按钮 -->
        <div class="flex items-center gap-2">
          <!-- Upload all button when not on linux.do -->
          <a-button
            v-if="shouldShowUploadButton && ungroup && ungroup.emojis?.length > 0"
            @click="uploadAllEmojis"
            class="text-sm px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 flex items-center gap-2"
            title="上传所有未分组表情到 linux.do"
          >
            📤 上传全部
          </a-button>

          <!-- Upload selected button when in multi-select mode -->
          <a-button
            v-if="shouldShowUploadButton && isMultiSelectMode && selectedEmojis.size > 0"
            @click="uploadSelectedEmojis"
            class="text-sm px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center gap-2"
            title="上传选中的表情到 linux.do"
          >
            📤 上传选中 ({{ selectedEmojis.size }})
          </a-button>
        </div>
      </div>

      <div class="p-6">
        <div
          v-if="ungroup && ungroup.emojis?.length"
          class="grid gap-3"
          :style="{
            gridTemplateColumns: `repeat(${emojiStore.settings.gridColumns}, minmax(0, 1fr))`
          }"
        >
          <div
            v-for="(emoji, idx) in ungroup.emojis"
            :key="`ung-${emoji.id || idx}`"
            class="emoji-item relative"
          >
            <div
              class="aspect-square bg-gray-50 rounded-lg overflow-hidden dark:bg-gray-700 relative"
              :class="{
                'cursor-pointer': isMultiSelectMode,
                'ring-2 ring-blue-500': isMultiSelectMode && selectedEmojis.has(idx)
              }"
              @click="handleEmojiClick(idx)"
            >
              <img
                :src="imageSources.get(emoji.id) || getEmojiImageUrlSync(emoji)"
                :alt="emoji.name"
                class="w-full h-full object-cover"
              />
              <div
                v-if="loadingStates.get(emoji.id)"
                class="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-75"
              >
                <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
              </div>
            </div>

            <!-- 多选模式下的选择框 -->
            <div v-if="isMultiSelectMode" class="absolute bottom-1 right-1">
              <a-checkbox
                :checked="selectedEmojis.has(idx)"
                @change="toggleEmojiSelection(idx)"
                class="w-4 h-4 text-blue-600 bg-white dark:bg-black dark:text-white border-2 rounded focus:ring-blue-500"
                :title="'选择表情 ' + emoji.name"
              />
            </div>

            <!-- 非多选模式下的编辑/删除/上传按钮 -->
            <div v-if="!isMultiSelectMode" class="absolute top-1 right-1 flex gap-1">
              <!-- Upload button when not on linux.do -->
              <a-button
                @click="$emit('edit', emoji, ungroup.id, idx)"
                title="编辑"
                class="text-xs px-1 py-0.5 bg-white bg-opacity-80 dark:bg-black dark:text-white rounded"
              >
                编辑
              </a-button>
              <a-popconfirm title="确认移除此表情？" @confirm="$emit('remove', ungroup.id, idx)">
                <template #icon>
                  <QuestionCircleOutlined style="color: red" />
                </template>
                <a-button
                  title="移除"
                  class="text-xs px-1 py-0.5 bg-white bg-opacity-80 rounded hover:bg-opacity-100 dark:bg-black dark:text-white"
                >
                  移除
                </a-button>
              </a-popconfirm>
            </div>

            <div class="text-xs text-center text-gray-600 mt-1 truncate dark:text-white">
              {{ emoji.name }}
            </div>
          </div>
        </div>
        <div v-else class="text-sm text-gray-500 dark:text-white">未分组表情为空。</div>
      </div>
    </div>

    <!-- 创建新分组对话框 -->
    <CreateGroupModal v-model:visible="showCreateGroupDialog" @create="handleCreateGroup" />
  </div>
</template>

<style scoped>
.emoji-item {
  width: 80px;
}
</style>
