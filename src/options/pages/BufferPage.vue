<script setup lang="ts">
import { ref, computed, onMounted, watch, inject } from 'vue'
import { QuestionCircleOutlined, DownOutlined } from '@ant-design/icons-vue'

import type { OptionsInject } from '../types'

import { uploadServices } from '@/utils/uploadServices'

const options = inject<OptionsInject>('options')!
const { emojiStore, openEditEmoji } = options

// State
const uploadService = ref<'linux.do' | 'idcflare.com'>('linux.do')
const selectedFiles = ref<File[]>([])
const isDragging = ref(false)
const isUploading = ref(false)
const uploadProgress = ref<Array<{ fileName: string; percent: number; error?: string }>>([])
const fileInput = ref<HTMLInputElement>()

// 多选功能相关状态
const isMultiSelectMode = ref(false)
const selectedEmojis = ref(new Set<number>())
const targetGroupId = ref('')
const showCreateGroupDialog = ref(false)
const newGroupName = ref('')
const newGroupIcon = ref('')
// Computed
const bufferGroup = computed(() =>
  emojiStore.groups.find(g => g.id === 'buffer' || g.name === '缓冲区')
)

// 可用的分组列表（排除缓冲区）
const availableGroups = computed(
  () => emojiStore.groups.filter((g: EmojiGroup) => g.id !== 'buffer') || []
)

// 全选状态
const totalCount = computed(() => bufferGroup.value?.emojis?.length || 0)
const checkedCount = computed(() => selectedEmojis.value.size)
const checkAll = computed<boolean>({
  get: () => totalCount.value > 0 && checkedCount.value === totalCount.value,
  set: (val: boolean) => {
    if (!bufferGroup.value) return
    if (val) {
      selectedEmojis.value = new Set(bufferGroup.value.emojis.map((_, i) => i))
    } else {
      clearSelection()
    }
  }
})

const indeterminate = computed(
  () => checkedCount.value > 0 && checkedCount.value < totalCount.value
)

// Debug: Watch for changes
watch(
  bufferGroup,
  (newGroup, oldGroup) => {
    console.log('[BufferPage] Buffer group changed:', {
      oldCount: oldGroup?.emojis.length || 0,
      newCount: newGroup?.emojis.length || 0,
      groupId: newGroup?.id,
      groupName: newGroup?.name
    })
  },
  { deep: true }
)

// Debug: Watch all groups
watch(
  () => emojiStore.groups,
  groups => {
    const buffer = groups.find(g => g.id === 'buffer' || g.name === '缓冲区')
    console.log(
      '[BufferPage] Groups updated, buffer group emoji count:',
      buffer?.emojis.length || 0
    )
  },
  { deep: true }
)

// Methods
const handleDragOver = () => {
  isDragging.value = true
}

const handleDragLeave = () => {
  isDragging.value = false
}

const handleDrop = (event: DragEvent) => {
  isDragging.value = false
  const files = Array.from(event.dataTransfer?.files || [])
  addFiles(files)
}

const triggerFileInput = () => {
  fileInput.value?.click()
}

const handleFileChange = (event: Event) => {
  const files = Array.from((event.target as HTMLInputElement).files || [])
  addFiles(files)
}

const addFiles = (files: File[]) => {
  const imageFiles = files.filter(file => file.type.startsWith('image/'))

  // Filter out existing files
  const existingNames = bufferGroup.value?.emojis.map(e => e.name) || []
  const newFiles = imageFiles.filter(file => !existingNames.includes(file.name))

  selectedFiles.value = [...selectedFiles.value, ...newFiles]
}

const removeFile = (index: number) => {
  selectedFiles.value.splice(index, 1)
}

const removeEmoji = (index: number) => {
  if (bufferGroup.value) {
    emojiStore.removeEmojiFromGroup(bufferGroup.value.id || 'buffer', index)
  }
}

const editEmoji = (emoji: any, index: number) => {
  openEditEmoji(emoji, bufferGroup.value?.id || 'buffer', index)
}

// 多选模式相关函数
const onCheckAllChange = (e: any) => {
  const checked = !!(e && e.target && e.target.checked)
  if (!bufferGroup.value) return
  if (checked) {
    selectedEmojis.value = new Set(bufferGroup.value.emojis.map((_, i) => i))
  } else {
    clearSelection()
  }
}

const onMultiSelectModeChange = () => {
  if (!isMultiSelectMode.value) {
    clearSelection()
  }
}

const toggleEmojiSelection = (idx: number) => {
  if (selectedEmojis.value.has(idx)) {
    selectedEmojis.value.delete(idx)
  } else {
    selectedEmojis.value.add(idx)
  }
  selectedEmojis.value = new Set(selectedEmojis.value)
}

const handleEmojiClick = (idx: number) => {
  if (isMultiSelectMode.value) toggleEmojiSelection(idx)
}

const clearSelection = () => {
  selectedEmojis.value.clear()
  selectedEmojis.value = new Set()
  targetGroupId.value = ''
}

const onTargetGroupSelect = (info: { key: string | number }) => {
  targetGroupId.value = String(info.key)
}

// 移动选中的表情到目标分组
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
        if (bufferGroup.value && index < bufferGroup.value.emojis.length) {
          emojiStore.moveEmoji('buffer', index, targetGroupId.value, -1)
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

// 复制选中的表情为 markdown 格式
const copySelectedAsMarkdown = async () => {
  if (selectedEmojis.value.size === 0 || !bufferGroup.value) return

  const lines = Array.from(selectedEmojis.value)
    .map(idx => {
      const e = bufferGroup.value!.emojis[idx]
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

// 确认创建新分组
const confirmCreateGroup = async () => {
  if (!newGroupName.value.trim()) return

  try {
    // 创建新分组
    const newGroup = emojiStore.createGroup(newGroupName.value.trim(), newGroupIcon.value || '📁')

    // 设置目标分组 ID 并关闭对话框
    targetGroupId.value = newGroup.id
    showCreateGroupDialog.value = false

    // 重置表单
    newGroupName.value = ''
    newGroupIcon.value = ''

    // 立即执行移动操作
    await moveSelectedEmojis()
  } catch {
    // ignore errors during group creation
  }
}

// 取消创建分组
const cancelCreateGroup = () => {
  showCreateGroupDialog.value = false
  newGroupName.value = ''
  newGroupIcon.value = ''
  targetGroupId.value = ''
}

// 移动所有表情到未分组
const moveAllToUngrouped = async () => {
  if (!bufferGroup.value || bufferGroup.value.emojis.length === 0) return

  try {
    // 确保未分组存在
    let ungroupedGroup = emojiStore.groups.find(g => g.id === 'ungrouped')
    if (!ungroupedGroup) {
      emojiStore.createGroup('未分组', '📝')
      ungroupedGroup = emojiStore.groups.find(g => g.name === '未分组')
      if (ungroupedGroup) {
        ungroupedGroup.id = 'ungrouped'
      }
    }

    if (!ungroupedGroup) {
      console.error('Failed to create ungrouped group')
      return
    }

    // 开始批量操作
    emojiStore.beginBatch()

    try {
      // 从后往前移动，避免索引变化
      const count = bufferGroup.value.emojis.length
      for (let i = count - 1; i >= 0; i--) {
        emojiStore.moveEmoji('buffer', i, 'ungrouped', -1)
      }
    } finally {
      // 结束批量操作，触发保存
      await emojiStore.endBatch()
    }

    console.log('[BufferPage] Moved all emojis to ungrouped')
  } catch (error) {
    console.error('[BufferPage] Failed to move emojis to ungrouped:', error)
  }
}

const uploadFiles = async () => {
  if (selectedFiles.value.length === 0) return

  isUploading.value = true
  uploadProgress.value = selectedFiles.value.map(file => ({
    fileName: file.name,
    percent: 0
  }))

  // Ensure buffer group exists
  let group = bufferGroup.value
  if (!group) {
    emojiStore.createGroup('缓冲区', '📦')
    // Find and update the group ID
    group = emojiStore.groups.find(g => g.name === '缓冲区')
    if (group) {
      group.id = 'buffer'
    }
  }

  if (!group) {
    console.error('Failed to create buffer group')
    isUploading.value = false
    return
  }

  try {
    const service = uploadServices[uploadService.value]

    for (let i = 0; i < selectedFiles.value.length; i++) {
      const file = selectedFiles.value[i]

      try {
        const updateProgress = (percent: number) => {
          uploadProgress.value[i].percent = percent
        }

        // Upload file using the selected service
        const uploadUrl = await service.uploadFile(file, updateProgress)

        // Add emoji to buffer group
        const newEmoji = {
          name: file.name,
          url: uploadUrl,
          displayUrl: uploadUrl
        }

        emojiStore.addEmojiWithoutSave(group.id || 'buffer', newEmoji)
        uploadProgress.value[i].percent = 100
      } catch (error) {
        console.error(`Failed to upload ${file.name}:`, error)
        uploadProgress.value[i].error = error instanceof Error ? error.message : String(error)
      }
    }

    // Save data directly instead of using maybeSave
    await emojiStore.saveData()

    // Clear selected files
    selectedFiles.value = []

    // Clear progress after a delay
    setTimeout(() => {
      uploadProgress.value = []
    }, 3000)
  } finally {
    isUploading.value = false
  }
}
// Initialize buffer group on mount
onMounted(() => {
  const existingBuffer = emojiStore.groups.find(g => g.id === 'buffer' || g.name === '缓冲区')
  console.log(
    '[BufferPage] Component mounted, buffer group found:',
    !!existingBuffer,
    existingBuffer?.emojis.length || 0
  )

  if (!existingBuffer) {
    emojiStore.createGroup('缓冲区', '📦')
    // Find and update the group ID
    const buffer = emojiStore.groups.find(g => g.name === '缓冲区')
    if (buffer) {
      buffer.id = 'buffer'
      console.log('[BufferPage] Buffer group created:', buffer.id)
    }
  }
})
</script>

<template>
  <div class="buffer-page">
    <div class="page-header">
      <h2 class="text-xl font-bold dark:text-white">缓冲区</h2>
      <p class="text-gray-600 dark:text-gray-400">
        上传图片到 linux.do 或 idcflare.com，并自动添加到此分组
      </p>
    </div>

    <!-- Upload Service Selection -->
    <div class="mt-6 p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
      <h3 class="text-lg font-semibold dark:text-white mb-4">选择上传服务</h3>
      <div class="flex space-x-4">
        <a-radio-group v-model:value="uploadService">
          <a-radio-button value="linux.do">linux.do</a-radio-button>
          <a-radio-button value="idcflare.com">idcflare.com</a-radio-button>
        </a-radio-group>
      </div>
    </div>

    <!-- File Upload Area -->
    <div class="mt-6 p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
      <h3 class="text-lg font-semibold dark:text-white mb-4">上传图片</h3>
      <div
        class="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center hover:border-gray-400 dark:hover:border-gray-500 transition-colors cursor-pointer"
        @dragover.prevent="handleDragOver"
        @dragleave.prevent="handleDragLeave"
        @drop.prevent="handleDrop"
        @click="triggerFileInput"
      >
        <input
          ref="fileInput"
          type="file"
          multiple
          accept="image/*"
          class="hidden"
          @change="handleFileChange"
        />
        <div v-if="!isDragging">
          <p class="text-gray-600 dark:text-gray-400">拖拽文件到此处或点击选择文件</p>
          <p class="text-sm text-gray-500 dark:text-gray-500 mt-2">
            支持批量选择，会自动过滤已存在的文件
          </p>
        </div>
        <div v-else>
          <p class="text-blue-600 dark:text-blue-400">松开以上传文件</p>
        </div>
      </div>

      <!-- File List -->
      <div v-if="selectedFiles.length > 0" class="mt-4">
        <h4 class="font-medium dark:text-white mb-2">待上传文件：</h4>
        <ul class="space-y-2">
          <li
            v-for="(file, index) in selectedFiles"
            :key="index"
            class="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded"
          >
            <span class="text-sm dark:text-gray-300">{{ file.name }}</span>
            <a-button
              type="text"
              size="small"
              danger
              @click="removeFile(index)"
            >
              移除
            </a-button>
          </li>
        </ul>
      </div>

      <!-- Upload Button -->
      <div class="mt-4 flex justify-end">
        <a-button
          type="primary"
          @click="uploadFiles"
          :disabled="selectedFiles.length === 0 || isUploading"
          :loading="isUploading"
        >
          {{ isUploading ? '上传中...' : `上传 ${selectedFiles.length} 个文件` }}
        </a-button>
      </div>
    </div>

    <!-- Upload Progress -->
    <div
      v-if="uploadProgress.length > 0"
      class="mt-6 p-4 bg-white dark:bg-gray-800 rounded-lg shadow"
    >
      <h3 class="text-lg font-semibold dark:text-white mb-4">上传进度</h3>
      <div class="space-y-2">
        <div
          v-for="(progress, index) in uploadProgress"
          :key="index"
          class="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded"
        >
          <span class="text-sm dark:text-gray-300">{{ progress.fileName }}</span>
          <div class="flex items-center space-x-2">
            <div class="w-32 bg-gray-200 rounded-full h-2">
              <div
                class="bg-blue-600 h-2 rounded-full transition-all duration-300"
                :style="{ width: `${progress.percent}%` }"
              ></div>
            </div>
            <span class="text-xs text-gray-600 dark:text-gray-400 w-12 text-right">
              {{ progress.percent }}%
            </span>
          </div>
          <div v-if="progress.error" class="text-xs text-red-500 max-w-xs truncate">
            {{ progress.error }}
          </div>
        </div>
      </div>
    </div>

    <!-- Buffer Group Emojis -->
    <div class="mt-6">
      <div
        v-if="bufferGroup && bufferGroup.emojis.length > 0"
        class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700"
      >
        <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div class="flex justify-between items-center">
            <h3 class="text-lg font-semibold dark:text-white">缓冲区表情</h3>
            <div class="flex items-center gap-4">
              <!-- 批量操作控制 -->
              <div v-if="isMultiSelectMode" class="flex items-center gap-2">
                <!-- 全选复选框 -->
                <a-checkbox
                  v-model:checked="checkAll"
                  :indeterminate="indeterminate"
                  @change="onCheckAllChange"
                  class="text-sm"
                  title="全选所有缓冲区表情"
                >
                  全选
                </a-checkbox>
                <span class="text-sm text-gray-600 dark:text-white">
                  已选择 {{ selectedEmojis.size }} 个
                </span>
                <a-dropdown>
                  <template #overlay>
                    <a-menu @click="onTargetGroupSelect">
                      <a-menu-item key="">选择目标分组</a-menu-item>
                      <a-menu-item
                        v-for="group in availableGroups"
                        :key="group.id"
                        :value="group.id"
                      >
                        {{ group.name }}
                      </a-menu-item>
                      <a-menu-item key="__create_new__">+ 创建新分组</a-menu-item>
                    </a-menu>
                  </template>
                  <a-button>
                    {{
                      targetGroupId
                        ? availableGroups.find(g => g.id === targetGroupId)?.name || '选择目标分组'
                        : '选择目标分组'
                    }}
                    <DownOutlined />
                  </a-button>
                </a-dropdown>
                <a-button
                  type="primary"
                  @click="moveSelectedEmojis"
                  :disabled="!targetGroupId"
                  size="small"
                  title="移动选中的表情到目标分组"
                >
                  移动
                </a-button>
                <a-button
                  type="default"
                  @click="copySelectedAsMarkdown"
                  :disabled="selectedEmojis.size === 0"
                  size="small"
                  class="bg-indigo-500 border-indigo-500 text-white hover:bg-indigo-600"
                  title="复制选中的表情为 Markdown 格式"
                >
                  复制为 Markdown
                </a-button>
                <a-button
                  @click="clearSelection"
                  size="small"
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
              <!-- 移动全部到未分组按钮 -->
              <a-button
                v-if="!isMultiSelectMode"
                type="default"
                @click="moveAllToUngrouped"
                class="bg-green-500 border-green-500 text-white hover:bg-green-600"
                title="将所有缓冲区表情移动到未分组"
              >
                📤 移动全部到未分组
              </a-button>
            </div>
          </div>
        </div>
        <div class="p-6">
          <div
            class="grid gap-3"
            :style="{
              gridTemplateColumns: `repeat(${emojiStore.settings.gridColumns}, minmax(0, 1fr))`
            }"
          >
            <div
              v-for="(emoji, idx) in bufferGroup.emojis"
              :key="`buffer-${emoji.id || idx}`"
              class="emoji-item relative"
            >
              <div
                class="aspect-square bg-gray-50 rounded-lg overflow-hidden dark:bg-gray-700"
                :class="{
                  'cursor-pointer': isMultiSelectMode,
                  'ring-2 ring-blue-500': isMultiSelectMode && selectedEmojis.has(idx)
                }"
                @click="handleEmojiClick(idx)"
              >
                <img :src="emoji.url" :alt="emoji.name" class="w-full h-full object-cover" />
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

              <!-- 非多选模式下的编辑/删除按钮 -->
              <div v-if="!isMultiSelectMode" class="absolute top-1 right-1 flex gap-1">
                <a-button
                  type="text"
                  size="small"
                  @click="editEmoji(emoji, idx)"
                  title="编辑"
                  class="bg-white bg-opacity-80 dark:bg-black dark:text-white"
                >
                  编辑
                </a-button>
                <a-popconfirm title="确认移除此表情？" @confirm="removeEmoji(idx)">
                  <template #icon>
                    <QuestionCircleOutlined style="color: red" />
                  </template>
                  <a-button
                    type="text"
                    size="small"
                    title="移除"
                    class="bg-white bg-opacity-80 hover:bg-opacity-100 dark:bg-black dark:text-white"
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
        </div>
      </div>
      <div
        v-else
        class="bg-white dark:bg-gray-800 rounded-lg shadow p-4 text-center text-gray-500 dark:text-gray-400"
      >
        缓冲区暂无表情
      </div>
    </div>

    <!-- 创建新分组对话框 -->
    <a-modal
      v-model:open="showCreateGroupDialog"
      title="创建新分组"
      @ok="confirmCreateGroup"
      @cancel="cancelCreateGroup"
      :ok-button-props="{ disabled: !newGroupName.trim() }"
      cancel-text="取消"
      ok-text="创建"
    >
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1 dark:text-white">
            分组名称
          </label>
          <AInput
            v-model:value="newGroupName"
            placeholder="输入分组名称"
            @press-enter="confirmCreateGroup"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1 dark:text-white">
            分组图标
          </label>
          <AInput
            v-model:value="newGroupIcon"
            placeholder="输入图标 URL 或 emoji"
          />
        </div>
      </div>
    </a-modal>
  </div>
</template>

<style scoped>
.buffer-page {
  max-width: 4xl;
  margin: 0 auto;
}

.emoji-item {
  width: 80px;
}
</style>
