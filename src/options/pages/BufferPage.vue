<script setup lang="ts">
import { ref, computed, onMounted, watch, inject, onBeforeUnmount } from 'vue'
import {
  QuestionCircleOutlined,
  DownOutlined,
  ScissorOutlined,
  InboxOutlined
} from '@ant-design/icons-vue'

import type { OptionsInject } from '../types'
import ImageCropper from '../components/ImageCropper.vue'
import FileUploader from '../components/FileUploader.vue'
import FileListDisplay from '../components/FileListDisplay.vue'
import GroupSelector from '../components/GroupSelector.vue'
import CreateGroupModal from '../components/CreateGroupModal.vue'

import type { EmojiGroup } from '@/types/type'
import { uploadServices } from '@/utils/uploadServices'

const options = inject<OptionsInject>('options')!
const { emojiStore, openEditEmoji } = options

// State
const uploadService = ref<'linux.do' | 'idcflare.com' | 'imgbed'>('linux.do')
const selectedFiles = ref<
  Array<{
    id: string
    file: File
    previewUrl: string
    cropData?: {
      x: number
      y: number
      width: number
      height: number
    }
  }>
>([])
const isUploading = ref(false)
const uploadProgress = ref<
  Array<{
    fileName: string
    percent: number
    error?: string
    waitingFor?: number
    waitStart?: number
  }>
>([])

// 图片切割相关状态
const showImageCropper = ref(false)
const cropImageFile = ref<File | null>(null)

// 多选功能相关状态
const isMultiSelectMode = ref(false)
const selectedEmojis = ref(new Set<number>())
const targetGroupId = ref('')
const showCreateGroupDialog = ref(false)

// 过滤器相关状态
const enableFilter = ref(false)
const selectedFilterGroups = ref<
  Array<{ id: string; name: string; icon: string; emojiNames: Set<string> }>
>([])
const duplicateCheckResults = ref<Array<{ name: string; existingGroups: string[] }>>([])
const showDuplicateResults = ref(false)
const isCheckingDuplicates = ref(false)
const selectedGroupIdForFilter = ref('')
const showGroupSelector = ref(false)
// Computed
const bufferGroup = computed(() =>
  emojiStore.groups.find(g => g.id === 'buffer' || g.name === '缓冲区')
)

// 可用的分组列表（排除缓冲区）
const availableGroups = computed(
  () => emojiStore.groups.filter((g: EmojiGroup) => g.id !== 'buffer') || []
)

// 可用于过滤的分组列表
const filterableGroups = computed(() => {
  return emojiStore.groups.filter(
    g =>
      g.id !== 'buffer' &&
      g.id !== 'favorites' &&
      g.emojis.length > 0 &&
      !selectedFilterGroups.value.some(fg => fg.id === g.id)
  )
})

// 分组选择器的过滤选项
const filterOption = (input: string, option: any) => {
  return option.label.toLowerCase().includes(input.toLowerCase())
}

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
const getWaitProgress = (progressItem: any) => {
  if (!progressItem.waitingFor || !progressItem.waitStart) {
    return { percent: 0, remaining: 0 }
  }
  const elapsed = (Date.now() - progressItem.waitStart) / 1000
  const remaining = Math.max(0, progressItem.waitingFor - elapsed)
  const percent = Math.min(100, (elapsed / progressItem.waitingFor) * 100)
  return { percent: 100 - percent, remaining: Math.ceil(remaining) }
}

const addFiles = async (files: File[]) => {
  const imageFiles = files.filter(file => file.type.startsWith('image/'))

  // Filter out existing files from buffer group
  const existingNames = bufferGroup.value?.emojis.map(e => e.name) || []

  // Filter out existing files from current selection (remove extension for comparison)
  const existingFileNames = new Set(
    selectedFiles.value.map(item => item.file.name.toLowerCase().replace(/\.[^/.]+$/, ''))
  )

  const newFiles = imageFiles
    .filter(file => {
      const fileName = file.name
      const fileNameWithoutExt = fileName.toLowerCase().replace(/\.[^/.]+$/, '')

      // Check if file already exists in buffer group
      if (existingNames.includes(fileName)) {
        console.log(`[BufferPage] Skipped ${fileName}: already exists in buffer group`)
        return false
      }

      // Check if file already exists in current selection
      if (existingFileNames.has(fileNameWithoutExt)) {
        console.log(`[BufferPage] Skipped ${fileName}: duplicate in current selection`)
        return false
      }

      return true
    })
    .map(file => {
      const url = URL.createObjectURL(file)
      const newFileEntry = {
        id: `file-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        previewUrl: url,
        cropData: undefined as undefined
      }

      // Get image dimensions (optional, can be added to cropData if needed)
      const img = new Image()
      img.onload = () => {
        // Store dimensions if needed for cropping
        // newFileEntry.width = img.width
        // newFileEntry.height = img.height
      }
      img.src = url

      return newFileEntry
    })

  selectedFiles.value = [...selectedFiles.value, ...newFiles]

  // 如果启用了过滤器，自动检测重复项
  if (enableFilter.value && selectedFilterGroups.value.length > 0) {
    setTimeout(() => {
      filterDuplicateFiles()
    }, 1000) // 延迟执行，确保图片加载完成
  }
}

// 图片切割相关方法
const openImageCropper = (id: string) => {
  const fileItem = selectedFiles.value.find(f => f.id === id)
  if (fileItem) {
    cropImageFile.value = fileItem.file
    showImageCropper.value = true
  }
}

const closeImageCropper = () => {
  showImageCropper.value = false
  cropImageFile.value = null
}

const handleCroppedEmojis = async (croppedEmojis: any[]) => {
  try {
    const newFilesWithUrls: any[] = []

    // Get existing names from current selection (remove extension for comparison)
    const existingFileNames = new Set(
      selectedFiles.value.map(item => item.file.name.toLowerCase().replace(/\.[^/.]+$/, ''))
    )

    for (const croppedEmoji of croppedEmojis) {
      // Convert base64 to Blob
      const response = await fetch(croppedEmoji.imageUrl)
      const blob = await response.blob()
      const file = new File([blob], `${croppedEmoji.name}.png`, { type: 'image/png' })

      // Check if cropped file already exists in current selection
      const fileNameWithoutExt = croppedEmoji.name.toLowerCase().replace(/\.[^/.]+$/, '')
      if (existingFileNames.has(fileNameWithoutExt)) {
        console.log(
          `[BufferPage] Skipped cropped file ${croppedEmoji.name}: duplicate in current selection`
        )
        continue
      }

      const url = URL.createObjectURL(file)

      // Get image dimensions
      const img = new Image()
      img.onload = () => {
        newFilesWithUrls.push({
          id: `file-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          file,
          previewUrl: url,
          cropData: undefined
        })
      }
      img.src = url
    }

    // This is now an async loop, so we need to wait for all images to load.
    // A simple approach is to use a Promise.all, but that complicates the loop.
    // Awaiting a small delay is a pragmatic alternative to ensure dimensions are likely set.
    // A more robust solution might involve a different async pattern if this proves unreliable.
    await new Promise(resolve => setTimeout(resolve, 100)) // Wait for image loading

    // Remove the original file that was cropped
    const originalFile = cropImageFile.value
    if (originalFile) {
      const indexToRemove = selectedFiles.value.findIndex(item => item.file === originalFile)
      if (indexToRemove > -1) {
        URL.revokeObjectURL(selectedFiles.value[indexToRemove].previewUrl)
        selectedFiles.value.splice(indexToRemove, 1)
      }
    }

    // Add the new cropped files to the list
    selectedFiles.value.push(...newFilesWithUrls)

    // Close the cropper
    closeImageCropper()
  } catch (error) {
    console.error('Failed to process cropped emojis:', error)
    // You can add user-facing error notifications here
  }
}

const removeFile = (id: string) => {
  const fileIndex = selectedFiles.value.findIndex(f => f.id === id)
  if (fileIndex !== -1) {
    const fileToRemove = selectedFiles.value[fileIndex]
    URL.revokeObjectURL(fileToRemove.previewUrl)
    selectedFiles.value.splice(fileIndex, 1)
  }
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
      return e && e.url ? `![${e.name}|${e.height}x${e.width}](${e.url})` : null
    })
    .filter((v): v is string => !!v)

  if (lines.length === 0) return

  const markdown = '>[!summary]-\n>[grid]\n>' + lines.join('\n>') + '\n>[/grid]'

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

// 过滤已选文件中的重复项
const filterDuplicateFiles = async () => {
  if (
    !enableFilter.value ||
    selectedFilterGroups.value.length === 0 ||
    selectedFiles.value.length === 0
  ) {
    return
  }

  isCheckingDuplicates.value = true

  try {
    // 收集所有过滤器分组中的表情名称（小写化并去除扩展名）
    const filterEmojiNames = new Set<string>()
    for (const filterGroup of selectedFilterGroups.value) {
      for (const emojiName of filterGroup.emojiNames) {
        const normalizedName = emojiName.toLowerCase().replace(/\.[^/.]+$/, '')
        filterEmojiNames.add(normalizedName)
      }
    }

    // 过滤重复文件
    const filteredFiles: typeof selectedFiles.value = []
    const originalLength = selectedFiles.value.length

    for (const fileItem of selectedFiles.value) {
      const fileName = fileItem.file.name.toLowerCase()
      // 移除文件扩展名进行比较
      const nameWithoutExt = fileName.replace(/\.[^/.]+$/, '')

      if (!filterEmojiNames.has(nameWithoutExt)) {
        filteredFiles.push(fileItem)
      } else {
        console.log(`[BufferPage] Filtered out duplicate file: ${fileItem.file.name}`)
        URL.revokeObjectURL(fileItem.url) // 清理重复项的 URL
      }
    }

    selectedFiles.value = filteredFiles

    const filteredCount = originalLength - filteredFiles.length
    if (filteredCount > 0) {
      console.log(`[BufferPage] Filtered out ${filteredCount} duplicate files`)
    }
  } catch (error) {
    console.error('[BufferPage] Failed to filter duplicate files:', error)
  } finally {
    isCheckingDuplicates.value = false
  }
}

// 添加分组到过滤器
const addGroupToFilter = () => {
  if (!selectedGroupIdForFilter.value) return

  const group = emojiStore.groups.find(g => g.id === selectedGroupIdForFilter.value)
  if (!group) return

  // 创建表情名称集合
  const emojiNames = new Set<string>()
  for (const emoji of group.emojis) {
    emojiNames.add(emoji.name)
  }

  selectedFilterGroups.value.push({
    id: group.id,
    name: group.name,
    icon: group.icon || '📁',
    emojiNames
  })

  selectedGroupIdForFilter.value = ''
  showGroupSelector.value = false

  console.log(`[BufferPage] Added group "${group.name}" to filter with ${emojiNames.size} emojis`)
}

// 从过滤器中移除分组
const removeGroupFromFilter = (groupId: string) => {
  const index = selectedFilterGroups.value.findIndex(fg => fg.id === groupId)
  if (index > -1) {
    const removedGroup = selectedFilterGroups.value[index]
    selectedFilterGroups.value.splice(index, 1)
    console.log(`[BufferPage] Removed group "${removedGroup.name}" from filter`)
  }
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
  uploadProgress.value = selectedFiles.value.map(item => ({
    fileName: item.file.name,
    percent: 0
  }))

  // Ensure buffer group exists
  let group = bufferGroup.value
  if (!group) {
    emojiStore.createGroup('缓冲区', '📦')
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

  const newEmojis: any[] = []
  const writeNewEmojis = async () => {
    if (newEmojis.length === 0) return
    console.log(`Writing batch of ${newEmojis.length} emojis.`)
    emojiStore.beginBatch()
    try {
      for (const newEmoji of newEmojis) {
        emojiStore.addEmojiWithoutSave(group!.id || 'buffer', newEmoji)
      }
    } finally {
      await emojiStore.endBatch()
      newEmojis.length = 0 // Clear the array after writing
    }
  }

  try {
    const service = uploadServices[uploadService.value]

    for (let i = 0; i < selectedFiles.value.length; i++) {
      const { file, width, height } = selectedFiles.value[i]

      try {
        const updateProgress = (percent: number) => {
          uploadProgress.value[i].percent = percent
          if (uploadProgress.value[i].waitingFor) {
            uploadProgress.value[i].waitingFor = undefined
            uploadProgress.value[i].waitStart = undefined
          }
        }

        const onRateLimitWait = async (waitTime: number) => {
          console.log('Rate limit hit. Writing existing batch before waiting.')
          await writeNewEmojis()
          uploadProgress.value[i].waitingFor = waitTime / 1000
          uploadProgress.value[i].waitStart = Date.now()
        }

        const uploadUrl = await service.uploadFile(file, updateProgress, onRateLimitWait)

        newEmojis.push({
          name: file.name,
          url: uploadUrl,
          displayUrl: uploadUrl,
          packet: 0,
          width,
          height
        })
        uploadProgress.value[i].percent = 100
      } catch (error) {
        console.error(`Failed to upload ${file.name}:`, error)
        uploadProgress.value[i].error = error instanceof Error ? error.message : String(error)
      }
    }

    // After the loop, write any remaining emojis.
    await writeNewEmojis()

    // Keep failed files in the list for retry
    selectedFiles.value = selectedFiles.value.filter((_, i) => uploadProgress.value[i].error)

    setTimeout(() => {
      uploadProgress.value = []
    }, 3000)
  } finally {
    isUploading.value = false
  }
}
// Initialize buffer group on mount
let progressInterval: NodeJS.Timeout | null = null
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

  progressInterval = setInterval(() => {
    // Force re-render for countdown
    if (uploadProgress.value.some(p => p.waitingFor)) {
      uploadProgress.value = [...uploadProgress.value]
    }
  }, 1000)
})

onBeforeUnmount(() => {
  selectedFiles.value.forEach(item => URL.revokeObjectURL(item.previewUrl))
  if (progressInterval) {
    clearInterval(progressInterval)
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
          <a-radio-button value="imgbed">imgbed</a-radio-button>
        </a-radio-group>
      </div>
    </div>

    <!-- File Upload Area -->
    <div class="mt-6 p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
      <h3 class="text-lg font-semibold dark:text-white mb-4">上传图片</h3>

      <!-- 重复过滤器设置 -->
      <div
        class="mb-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600"
      >
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center">
            <a-checkbox v-model:checked="enableFilter" class="mr-2">
              <span class="text-sm font-medium text-gray-900 dark:text-gray-300">
                启用重复过滤器
              </span>
            </a-checkbox>
            <a-tooltip title="选择表情分组作为过滤器，按名称过滤重复的图片">
              <QuestionCircleOutlined class="text-gray-400" />
            </a-tooltip>
          </div>
        </div>

        <div v-if="enableFilter" class="space-y-3">
          <!-- 已选择的过滤器分组 -->
          <div v-if="selectedFilterGroups.length > 0">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              过滤器分组
            </label>
            <div class="space-y-2">
              <div
                v-for="filterGroup in selectedFilterGroups"
                :key="filterGroup.id"
                class="flex items-center justify-between p-2 bg-white dark:bg-gray-600 rounded border border-gray-200 dark:border-gray-500"
              >
                <div class="flex items-center">
                  <img
                    v-if="
                      filterGroup.icon &&
                      (filterGroup.icon.startsWith('http') || filterGroup.icon.startsWith('data:'))
                    "
                    :src="filterGroup.icon"
                    class="w-4 h-4 mr-2"
                  />
                  <span v-else class="mr-2">{{ filterGroup.icon }}</span>
                  <span class="text-sm font-medium">{{ filterGroup.name }}</span>
                  <span class="ml-2 text-xs text-gray-500 dark:text-gray-400">
                    ({{ filterGroup.emojiNames.size }} 个表情)
                  </span>
                </div>
                <a-button
                  type="text"
                  size="small"
                  danger
                  @click="removeGroupFromFilter(filterGroup.id)"
                  title="移除分组"
                >
                  移除
                </a-button>
              </div>
            </div>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-2">
              共 {{ selectedFilterGroups.length }} 个分组，{{
                selectedFilterGroups.reduce((sum, g) => sum + g.emojiNames.size, 0)
              }}
              个表情
            </p>
          </div>

          <!-- 添加分组按钮 -->
          <div class="flex items-center gap-2">
            <a-button
              type="dashed"
              size="small"
              @click="showGroupSelector = true"
              :disabled="filterableGroups.length === 0"
            >
              <template #icon>
                <span>+</span>
              </template>
              添加分组到过滤器
            </a-button>
            <span v-if="filterableGroups.length === 0" class="text-xs text-gray-500">
              没有可用的分组
            </span>
          </div>

          <!-- 分组选择器模态框 -->
          <a-modal
            v-model:open="showGroupSelector"
            title="选择要添加到过滤器的分组"
            @ok="addGroupToFilter"
            @cancel="
              () => {
                showGroupSelector = false
                selectedGroupIdForFilter = ''
              }
            "
            ok-text="添加"
            cancel-text="取消"
            :ok-button-props="{ disabled: !selectedGroupIdForFilter }"
          >
            <div class="py-2">
              <GroupSelector
                v-model="selectedGroupIdForFilter"
                :groups="filterableGroups"
                placeholder="搜索并选择分组"
              />
            </div>
          </a-modal>
        </div>
      </div>

      <!-- 自定义文件上传区域 -->
      <FileUploader @filesSelected="addFiles" />

      <!-- File List -->
      <div v-if="selectedFiles.length > 0" class="mt-4">
        <FileListDisplay
          :files="selectedFiles"
          :loading="isCheckingDuplicates"
          @removeFile="removeFile"
          @cropImage="openImageCropper"
        />
      </div>

      <!-- Upload Button -->
      <div class="mt-4 flex justify-end space-x-2">
        <a-button
          type="primary"
          @click="uploadFiles"
          :disabled="selectedFiles.length === 0 || isUploading || isCheckingDuplicates"
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
            <div v-if="!progress.waitingFor" class="w-32 bg-gray-200 rounded-full h-2">
              <div
                class="bg-blue-600 h-2 rounded-full transition-all duration-300"
                :style="{ width: `${progress.percent}%` }"
              ></div>
            </div>
            <a-progress
              v-else
              type="circle"
              :width="24"
              :percent="getWaitProgress(progress).percent"
            >
              <template #format>
                <span class="text-xs">{{ getWaitProgress(progress).remaining }}s</span>
              </template>
            </a-progress>
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
                <GroupSelector
                  v-model="targetGroupId"
                  :groups="availableGroups"
                  placeholder="选择目标分组"
                  class="flex-1"
                />
                <a-button
                  type="primary"
                  @click="moveSelectedEmojis"
                  :disabled="!targetGroupId"
                  size="small"
                  title="移动选中的表情到目标分组"
                >
                  移动
                </a-button>
                <a-button @click="showCreateGroupDialog = true" size="small" title="创建新分组">
                  + 新建
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
                <a-button @click="clearSelection" size="small" title="清空所有表情选择">
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
    <CreateGroupModal v-model:visible="showCreateGroupDialog" @create="handleCreateGroup" />

    <!-- 图片切割器 -->
    <ImageCropper
      v-if="showImageCropper && cropImageFile"
      :image-file="cropImageFile"
      :ai-settings="emojiStore.settings"
      @close="closeImageCropper"
      @upload="handleCroppedEmojis"
    />
  </div>
</template>
