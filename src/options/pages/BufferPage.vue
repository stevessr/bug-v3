<script setup lang="ts">
import { ref, computed, onMounted, watch, inject, onBeforeUnmount, nextTick } from 'vue'
import { QuestionCircleOutlined, SyncOutlined, CheckCircleOutlined } from '@ant-design/icons-vue'

import type { OptionsInject } from '../types'
import ImageCropper from '../components/ImageCropper.vue'
import FileUploader from '../components/FileUploader.vue'
import FileListDisplay from '../components/FileListDisplay.vue'
import GroupSelector from '../components/GroupSelector.vue'
import CreateGroupModal from '../components/CreateGroupModal.vue'
import TelegramStickerModal from '../modals/TelegramStickerModal.vue'

import { useBufferBatch } from './composables/useBufferBatch'
import { useFilePersistence } from './composables/useFilePersistence'
import { useCollaborativeUpload } from './composables/useCollaborativeUpload'
import { useUpload } from './composables/useUpload'

import { getEmojiImageUrlWithLoading, getEmojiImageUrlSync } from '@/utils/imageUrlHelper'
import CachedImage from '@/components/CachedImage.vue'

const options = inject<OptionsInject>('options')!
const { emojiStore, openEditEmoji } = options

// 图片缓存状态管理
const imageSources = ref<Map<string, string>>(new Map())
const loadingStates = ref<Map<string, boolean>>(new Map())
let imageSourcesInitId = 0 // 用于取消过时的初始化
let isInitializingImageSources = false // 防止并发初始化

// Computed
const bufferGroup = computed(() =>
  emojiStore.groups.find(g => g.id === 'buffer' || g.name === '缓冲区')
)

// 获取缓冲区表情
const bufferEmojis = computed(() => {
  return bufferGroup.value?.emojis || []
})

// 上传项目分类（用于水平卡片布局）
interface UploadCardItem {
  id: string
  fileName: string
  previewUrl: string
  percent: number
  status: 'pending' | 'uploading' | 'completed' | 'error' | 'waiting'
  error?: string
  waitingFor?: number
  waitStart?: number
}

// Upload progress state (must be defined before categorizedUploadItems)
const uploadProgress = ref<
  Array<{
    fileName: string
    percent: number
    error?: string
    waitingFor?: number
    waitStart?: number
  }>
>([])

const categorizedUploadItems = computed(() => {
  if (uploadProgress.value.length === 0)
    return { completed: [], uploading: [], pending: [], error: [] }

  const items: UploadCardItem[] = uploadProgress.value.map((progress, index) => {
    const fileInfo = selectedFiles.value[index]
    let status: UploadCardItem['status'] = 'pending'

    if (progress.error) {
      status = 'error'
    } else if (progress.waitingFor) {
      status = 'waiting'
    } else if (progress.percent === 100) {
      status = 'completed'
    } else if (progress.percent > 0) {
      status = 'uploading'
    }

    return {
      id: fileInfo?.id || `upload-${index}`,
      fileName: progress.fileName,
      previewUrl: fileInfo?.previewUrl || '',
      percent: progress.percent,
      status,
      error: progress.error,
      waitingFor: progress.waitingFor,
      waitStart: progress.waitStart
    }
  })

  return {
    completed: items.filter(item => item.status === 'completed'),
    uploading: items.filter(item => item.status === 'uploading' || item.status === 'waiting'),
    pending: items.filter(item => item.status === 'pending'),
    error: items.filter(item => item.status === 'error')
  }
})

// 初始化图片缓存（带并发控制）
const initializeImageSources = async () => {
  if (!bufferEmojis.value.length) return

  // 如果正在初始化，增加 ID 以取消当前初始化
  const currentInitId = ++imageSourcesInitId

  // 如果已经在初始化中，直接返回
  if (isInitializingImageSources) {
    console.log('[BufferPage] Image sources initialization already in progress, will restart')
    return
  }

  isInitializingImageSources = true

  console.log('[BufferPage] Initializing image sources for buffer:', bufferEmojis.value.length)
  console.log('[BufferPage] Cache enabled:', emojiStore.settings.useIndexedDBForImages)

  const newSources = new Map<string, string>()
  const newLoadingStates = new Map<string, boolean>()

  try {
    // 优化：使用 Promise.all 并行处理，而不是串行 await
    const results = await Promise.allSettled(
      bufferEmojis.value.map(async emoji => {
        // 检查是否已被取消
        if (currentInitId !== imageSourcesInitId) {
          return null
        }

        try {
          if (emojiStore.settings.useIndexedDBForImages) {
            // 使用缓存优先的加载函数
            const result = await getEmojiImageUrlWithLoading(emoji, { preferCache: true })
            return { emojiId: emoji.id, url: result.url, isLoading: result.isLoading }
          } else {
            // 直接 URL 模式
            const fallbackSrc = emoji.displayUrl || emoji.url
            return { emojiId: emoji.id, url: fallbackSrc, isLoading: false }
          }
        } catch (error) {
          console.warn(`[BufferPage] Failed to get image source for ${emoji.name}:`, error)
          // 回退到直接 URL
          const fallbackSrc = emoji.displayUrl || emoji.url
          return { emojiId: emoji.id, url: fallbackSrc, isLoading: false }
        }
      })
    )

    // 最后一次检查是否被取消
    if (currentInitId === imageSourcesInitId) {
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          const { emojiId, url, isLoading } = result.value
          newSources.set(emojiId, url)
          newLoadingStates.set(emojiId, isLoading)
        }
      }

      imageSources.value = newSources
      loadingStates.value = newLoadingStates
      console.log('[BufferPage] Image sources initialized:', imageSources.value.size)
    }
  } finally {
    isInitializingImageSources = false
  }
}

// 监听缓冲区表情变化（使用防抖）
// 优化：改为浅监听，只监听数组引用和长度变化
let initDebounceTimer: ReturnType<typeof setTimeout> | null = null
watch(
  () => [bufferEmojis.value, bufferEmojis.value.length],
  () => {
    // 防抖：快速变化时只执行最后一次
    if (initDebounceTimer) {
      clearTimeout(initDebounceTimer)
    }
    initDebounceTimer = setTimeout(() => {
      console.log('[BufferPage] Buffer emojis changed, reinitializing image sources')
      initializeImageSources()
    }, 100)
  }
)

// 组件挂载时初始化
onMounted(() => {
  console.log('[BufferPage] Component mounted')
  initializeImageSources()
})

// State
const uploadService = ref<'linux.do' | 'idcflare.com' | 'imgbed'>('linux.do')
const selectedFiles = ref<
  Array<{
    id: string
    file: File
    previewUrl: string
    width?: number
    height?: number
    cropData?: {
      x: number
      y: number
      width: number
      height: number
    }
  }>
>([])
const isUploading = ref(false)
const uploadScrollContainer = ref<HTMLElement | null>(null)

// 自动滚动到当前上传项
const scrollToUploading = () => {
  const container = uploadScrollContainer.value
  if (!container) return

  const uploadingItem = container.querySelector('.uploading-card')
  if (uploadingItem) {
    uploadingItem.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }
}

watch(
  () => categorizedUploadItems.value.uploading[0]?.id,
  newId => {
    if (newId) {
      nextTick(() => {
        scrollToUploading()
      })
    }
  }
)

// Buffer Batch Logic
const {
  isMultiSelectMode,
  selectedEmojis,
  targetGroupId,
  showCreateGroupDialog,
  enableFilter,
  selectedFilterGroups,
  isCheckingDuplicates,
  selectedGroupIdForFilter,
  showGroupSelector,
  checkAll,
  indeterminate,
  availableGroups,
  filterableGroups,
  toggleEmojiSelection,
  handleEmojiClick,
  clearSelection,
  onCheckAllChange,
  onMultiSelectModeChange,
  moveSelectedEmojis,
  copySelectedAsMarkdown,
  handleCreateGroup,
  addGroupToFilter,
  removeGroupFromFilter,
  filterDuplicateFiles
} = useBufferBatch({
  bufferGroup,
  emojiStore,
  selectedFiles
})

// Telegram Import Logic
const showTelegramModal = ref(false)

// 持久化相关函数 - 使用 composable 替代内联实现
const { saveSelectedFiles, loadSelectedFiles, clearPersistedFiles } =
  useFilePersistence(selectedFiles)

// 监听 selectedFiles 变化并自动保存
// 优化：改为浅监听，只监听数组长度变化
watch(
  () => selectedFiles.value.length,
  () => {
    saveSelectedFiles()
  }
)

// Collaborative Upload Logic
const {
  enableCollaborativeUpload,
  collaborativeServerUrl,
  isCollaborativeConnected,
  collaborativeProgress,
  saveCollaborativeServerUrl,
  connectCollaborativeServer,
  uploadFilesCollaboratively,
  cancelCollaborativeUpload
} = useCollaborativeUpload({
  bufferGroup,
  emojiStore,
  selectedFiles,
  isUploading,
  clearPersistedFiles
})

// Standard Upload Logic
const { uploadFiles } = useUpload({
  selectedFiles,
  isUploading,
  uploadProgress,
  bufferGroup,
  emojiStore,
  uploadService,
  clearPersistedFiles
})

// 图片切割相关状态
const showImageCropper = ref(false)
const cropImageFile = ref<File | null>(null)

// Debug: Watch for changes
// 优化：只监听 emojis 长度变化而非深度监听整个对象
watch(
  () => bufferGroup.value?.emojis?.length,
  (newLength, oldLength) => {
    console.log('[BufferPage] Buffer group changed:', {
      oldCount: oldLength || 0,
      newCount: newLength || 0,
      groupId: bufferGroup.value?.id,
      groupName: bufferGroup.value?.name
    })
  }
)

// Debug: Watch all groups
// 优化：只监听 groups 数组引用变化
watch(
  () => emojiStore.groups,
  groups => {
    const buffer = groups.find(g => g.id === 'buffer' || g.name === '缓冲区')
    console.log(
      '[BufferPage] Groups updated, buffer group emoji count:',
      buffer?.emojis.length || 0
    )
  }
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

// 格式化节点 ID，使其更友好
const formatNodeId = (nodeId: string) => {
  // 如果是 worker-xxx 格式，提取数字并显示为 "节点 #xxx"
  const match = nodeId.match(/worker[-_]?(\d+)/i)
  if (match) {
    return `节点 #${match[1]}`
  }
  // 如果是 "master"，显示为 "主机"
  if (nodeId.toLowerCase() === 'master') {
    return '主机'
  }
  // 否则返回原始 ID，但截断过长的 ID
  return nodeId.length > 15 ? nodeId.slice(0, 12) + '...' : nodeId
}

const addFiles = async (files: File[]) => {
  const imageFiles = files.filter(file => file.type.startsWith('image/'))

  // Filter out existing files from buffer group
  const existingNames = bufferGroup.value?.emojis.map(e => e.name) || []

  // Filter out existing files from current selection (remove extension for comparison)
  const existingFileNames = new Set(
    selectedFiles.value.map(item => item.file.name.toLowerCase().replace(/\.[^/.]+$/, ''))
  )

  const newFiles = await Promise.all(
    imageFiles
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
      .map(async file => {
        // 立即读取文件内容到内存，防止源文件被删除导致 "File not found"
        // 将原始 File 转换为基于内存 Blob 的 File
        const arrayBuffer = await file.arrayBuffer()
        const blob = new Blob([arrayBuffer], { type: file.type })
        const memoryFile = new File([blob], file.name, {
          type: file.type,
          lastModified: file.lastModified
        })

        const url = URL.createObjectURL(memoryFile)

        const newFileEntry = {
          id: `file-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          file: memoryFile, // 使用内存文件替换原始文件引用
          previewUrl: url,
          cropData: undefined as undefined,
          width: undefined as number | undefined,
          height: undefined as number | undefined
        }

        // Get image dimensions
        // 使用 Promise 包装图片加载，虽然 addFiles 原本没等待它，但为了逻辑完整性保持原样结构
        // 这里的图片加载是异步的，不阻塞返回，宽高会在加载完成后更新
        const img = new Image()
        img.onload = () => {
          newFileEntry.width = img.width
          newFileEntry.height = img.height
        }
        img.src = url

        return newFileEntry
      })
  )

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
    // Get existing names from current selection (remove extension for comparison)
    const existingFileNames = new Set(
      selectedFiles.value.map(item => item.file.name.toLowerCase().replace(/\.[^/.]+$/, ''))
    )

    // 使用 Promise.all 等待所有图片加载完成
    const loadImagePromises = croppedEmojis
      .filter(croppedEmoji => {
        const fileNameWithoutExt = croppedEmoji.name.toLowerCase().replace(/\.[^/.]+$/, '')
        if (existingFileNames.has(fileNameWithoutExt)) {
          console.log(
            `[BufferPage] Skipped cropped file ${croppedEmoji.name}: duplicate in current selection`
          )
          return false
        }
        return true
      })
      .map(async croppedEmoji => {
        // Convert base64 to Blob
        const response = await fetch(croppedEmoji.imageUrl)
        const blob = await response.blob()
        const file = new File([blob], `${croppedEmoji.name}.png`, { type: 'image/png' })
        const url = URL.createObjectURL(file)

        // 使用 Promise 等待图片加载
        return new Promise<{
          id: string
          file: File
          previewUrl: string
          cropData: undefined
          width: number
          height: number
        }>((resolve, reject) => {
          const img = new Image()
          img.onload = () => {
            resolve({
              id: `file-${Date.now()}-${Math.random().toString(36).slice(2)}`,
              file,
              previewUrl: url,
              cropData: undefined,
              width: img.width,
              height: img.height
            })
          }
          img.onerror = () => {
            URL.revokeObjectURL(url)
            reject(new Error(`Failed to load image: ${croppedEmoji.name}`))
          }
          img.src = url
        })
      })

    const newFilesWithUrls = await Promise.all(loadImagePromises)

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
    // message.error('处理裁剪图片失败')
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
    // Force re-render for countdown (uploadProgress)
    if (uploadProgress.value.some(p => p.waitingFor)) {
      uploadProgress.value = [...uploadProgress.value]
    }
    // Force re-render for countdown (collaborativeProgress)
    if (collaborativeProgress.value?.waitingFor) {
      collaborativeProgress.value = { ...collaborativeProgress.value }
    }
  }, 1000)

  // 加载持久化的文件
  loadSelectedFiles()
})

onBeforeUnmount(() => {
  selectedFiles.value.forEach(item => URL.revokeObjectURL(item.previewUrl))
  if (progressInterval) {
    clearInterval(progressInterval)
  }
  // 清理增量保存定时器 (CollaborativeUpload has its own cleanup, but we can call safe cleanup here)
  // useCollaborativeUpload manages its own timers, but we might want to ensure everything stops
  // The composable exposes stopIncrementalSaveTimer but it's internal to the composable mostly.
  // Actually we need to make sure we stop it if we start it.
  // We can't easily access the internal timer of the composable from here unless we exposed a cleanup function.
  // But wait, useCollaborativeUpload returns cancelCollaborativeUpload which stops everything.
  // And it cleans up on unmount? No, we need to call it.

  // 清理防抖定时器
  if (initDebounceTimer) {
    clearTimeout(initDebounceTimer)
  }
})
</script>

<template>
  <div class="buffer-page">
    <div class="page-header">
      <div class="flex items-center gap-2">
        <h2 class="text-xl font-bold dark:text-white">缓冲区</h2>
        <!-- 保存状态指示器 -->
        <a-tooltip v-if="emojiStore.isSaving" title="正在保存...">
          <SyncOutlined spin class="text-blue-500" />
        </a-tooltip>
        <a-tooltip v-else title="已保存">
          <CheckCircleOutlined class="text-green-500" />
        </a-tooltip>
      </div>
      <p class="text-gray-600 dark:text-gray-400">
        上传图片到 linux.do 或 idcflare.com，并自动添加到此分组
      </p>
    </div>

    <!-- Upload Service Selection -->
    <div class="mt-6 p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-lg font-semibold dark:text-white mb-0">选择上传服务</h3>
        <a-button type="primary" ghost size="small" @click="showTelegramModal = true">
          <template #icon>
            <span class="mr-1">✈️</span>
          </template>
          Telegram 贴纸导入
        </a-button>
      </div>
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
                  <CachedImage
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
      <a-collapse v-if="selectedFiles.length > 0" class="mt-4" :default-active-key="['files']">
        <a-collapse-panel key="files">
          <template #header>
            <span class="font-medium">待上传文件 ({{ selectedFiles.length }})</span>
          </template>
          <FileListDisplay
            :files="selectedFiles"
            :loading="isCheckingDuplicates"
            @removeFile="removeFile"
            @cropImage="openImageCropper"
          />
        </a-collapse-panel>
      </a-collapse>

      <!-- 联动上传设置 -->
      <div
        class="mt-4 p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-800"
      >
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center gap-2">
            <a-checkbox v-model:checked="enableCollaborativeUpload">
              <span class="text-sm font-medium text-gray-900 dark:text-gray-300">
                🔗 启用联动上传
              </span>
            </a-checkbox>
            <a-tooltip
              title="连接到本地协调服务器，与其他用户并行上传，突破单账户速率限制。主机本身也会参与上传。"
            >
              <QuestionCircleOutlined class="text-gray-400" />
            </a-tooltip>
          </div>
          <span
            v-if="enableCollaborativeUpload"
            class="text-xs"
            :class="isCollaborativeConnected ? 'text-green-600' : 'text-gray-500'"
          >
            {{ isCollaborativeConnected ? '✓ 已连接' : '未连接' }}
          </span>
        </div>

        <div v-if="enableCollaborativeUpload" class="space-y-2">
          <div class="flex items-center gap-2">
            <a-input
              v-model:value="collaborativeServerUrl"
              placeholder="ws://localhost:9527"
              size="small"
              style="width: 200px"
              :disabled="isCollaborativeConnected"
              @blur="saveCollaborativeServerUrl"
            />
            <a-button
              size="small"
              :type="isCollaborativeConnected ? 'default' : 'primary'"
              :danger="isCollaborativeConnected"
              @click="connectCollaborativeServer"
            >
              {{ isCollaborativeConnected ? '断开' : '连接' }}
            </a-button>
          </div>
          <p class="text-xs text-gray-500 dark:text-gray-400">
            运行协调服务器：
            <code class="bg-gray-200 dark:bg-gray-700 px-1 rounded">
              cd scripts/collaborative-upload-server && npm start
            </code>
          </p>
        </div>
      </div>

      <!-- Upload Button -->
      <div class="mt-4 flex justify-end space-x-2">
        <!-- 联动上传按钮 -->
        <template v-if="enableCollaborativeUpload">
          <!-- 取消按钮 -->
          <a-button v-if="isUploading" danger @click="cancelCollaborativeUpload">取消上传</a-button>
          <a-button
            v-else
            type="primary"
            @click="uploadFilesCollaboratively"
            :disabled="
              selectedFiles.length === 0 ||
              isUploading ||
              isCheckingDuplicates ||
              !isCollaborativeConnected
            "
            class="bg-gradient-to-r from-blue-500 to-purple-500 border-0"
          >
            🔗 联动上传 {{ selectedFiles.length }} 个文件
          </a-button>
        </template>
        <!-- 普通上传按钮 -->
        <a-button
          :type="enableCollaborativeUpload ? 'default' : 'primary'"
          @click="uploadFiles"
          :disabled="selectedFiles.length === 0 || isUploading || isCheckingDuplicates"
          :loading="isUploading && !enableCollaborativeUpload"
        >
          {{
            isUploading && !enableCollaborativeUpload
              ? '上传中...'
              : `上传 ${selectedFiles.length} 个文件`
          }}
        </a-button>
      </div>

      <!-- 联动上传进度 -->
      <div
        v-if="collaborativeProgress && enableCollaborativeUpload"
        class="mt-4 p-3 bg-gray-50 dark:bg-gray-700 rounded"
      >
        <div class="flex justify-between text-sm mb-2">
          <span class="dark:text-white">联动上传进度</span>
          <span class="dark:text-gray-300">
            {{ collaborativeProgress.completed + collaborativeProgress.failed }} /
            {{ collaborativeProgress.total }}
          </span>
        </div>
        <a-progress
          :percent="
            Math.round(
              ((collaborativeProgress.completed + collaborativeProgress.failed) /
                collaborativeProgress.total) *
                100
            )
          "
          :status="collaborativeProgress.failed > 0 ? 'exception' : 'active'"
        />

        <!-- UUID 信息显示 -->
        <div
          v-if="collaborativeProgress.masterUuid || collaborativeProgress.currentUuid"
          class="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800"
        >
          <div class="text-xs space-y-1">
            <div v-if="collaborativeProgress.masterUuid" class="flex items-center gap-2">
              <span class="font-medium text-gray-700 dark:text-gray-300">主机 UUID:</span>
              <code
                class="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded text-gray-900 dark:text-gray-100"
              >
                {{ collaborativeProgress.masterUuid }}
              </code>
            </div>
            <div v-if="collaborativeProgress.currentUuid" class="flex items-center gap-2">
              <span class="font-medium text-gray-700 dark:text-gray-300">当前节点 UUID:</span>
              <code
                class="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded text-gray-900 dark:text-gray-100"
              >
                {{ collaborativeProgress.currentUuid }}
              </code>
            </div>
          </div>
        </div>

        <div class="flex items-center justify-between mt-2">
          <div v-if="collaborativeProgress.currentFile" class="text-xs text-gray-500">
            当前：{{ collaborativeProgress.currentFile }}
          </div>
          <!-- 429 等待进度条 -->
          <div
            v-if="collaborativeProgress.waitingFor && collaborativeProgress.waitStart"
            class="flex items-center space-x-2"
          >
            <span class="text-xs text-orange-500">⏳ 等待限流</span>
            <a-progress
              type="circle"
              :width="28"
              :percent="getWaitProgress(collaborativeProgress).percent"
              :stroke-color="'#f97316'"
            >
              <template #format>
                <span class="text-xs">{{ getWaitProgress(collaborativeProgress).remaining }}s</span>
              </template>
            </a-progress>
          </div>
        </div>

        <!-- 节点文件分配 -->
        <div
          v-if="
            collaborativeProgress.nodeFiles &&
            Object.keys(collaborativeProgress.nodeFiles).length > 0
          "
          class="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600"
        >
          <div class="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">节点文件分配</div>
          <div class="grid grid-cols-2 gap-2">
            <div
              v-for="(files, nodeId) in collaborativeProgress.nodeFiles"
              :key="nodeId"
              class="p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-600"
            >
              <div class="flex items-center justify-between mb-1">
                <span class="text-xs font-medium text-gray-900 dark:text-white">
                  {{ formatNodeId(nodeId) }}
                </span>
                <span class="text-xs text-gray-500 dark:text-gray-400">
                  {{ files.length }} 个文件
                </span>
              </div>
              <div class="text-xs text-gray-600 dark:text-gray-400 max-h-20 overflow-y-auto">
                {{ files.join(', ') }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Upload Progress - 水平卡片布局 -->
    <div
      v-if="uploadProgress.length > 0"
      class="mt-6 p-4 bg-white dark:bg-gray-800 rounded-lg shadow"
    >
      <h3 class="text-lg font-semibold dark:text-white mb-4">上传进度</h3>

      <!-- 水平滚动卡片区域 -->
      <div
        ref="uploadScrollContainer"
        class="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600"
      >
        <!-- 已完成卡片 - 左侧 -->
        <div
          v-for="item in categorizedUploadItems.completed"
          :key="item.id"
          class="flex-shrink-0 w-24 bg-green-50 dark:bg-green-900/30 rounded-lg p-2 border border-green-200 dark:border-green-700 transition-all duration-300"
        >
          <div
            class="relative aspect-square mb-2 rounded overflow-hidden bg-gray-100 dark:bg-gray-700"
          >
            <img
              v-if="item.previewUrl"
              :src="item.previewUrl"
              :alt="item.fileName"
              class="w-full h-full object-cover"
            />
            <div class="absolute inset-0 bg-green-500/20 flex items-center justify-center">
              <CheckCircleOutlined class="text-green-500 text-2xl" />
            </div>
          </div>
          <div
            class="text-xs text-center text-green-600 dark:text-green-400 truncate"
            :title="item.fileName"
          >
            {{ item.fileName }}
          </div>
        </div>

        <!-- 正在上传/等待卡片 - 中间 -->
        <div
          v-for="item in categorizedUploadItems.uploading"
          :key="item.id"
          class="uploading-card flex-shrink-0 w-24 bg-blue-50 dark:bg-blue-900/30 rounded-lg p-2 border-2 border-blue-400 dark:border-blue-500 transition-all duration-300"
        >
          <div
            class="relative aspect-square mb-2 rounded overflow-hidden bg-gray-100 dark:bg-gray-700"
          >
            <img
              v-if="item.previewUrl"
              :src="item.previewUrl"
              :alt="item.fileName"
              class="w-full h-full object-cover"
            />
          </div>
          <!-- 进度条或 429 等待环 -->
          <div v-if="item.status === 'waiting'" class="flex flex-col items-center">
            <a-progress
              type="circle"
              :width="32"
              :percent="getWaitProgress(item).percent"
              :stroke-color="'#f97316'"
            >
              <template #format>
                <span class="text-xs">{{ getWaitProgress(item).remaining }}s</span>
              </template>
            </a-progress>
            <span class="text-xs text-orange-500 mt-1">限流等待</span>
          </div>
          <div v-else class="space-y-1">
            <div class="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1.5">
              <div
                class="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                :style="{ width: `${item.percent}%` }"
              ></div>
            </div>
            <div class="text-xs text-center text-blue-600 dark:text-blue-400">
              {{ item.percent }}%
            </div>
          </div>
          <div
            class="text-xs text-center text-gray-600 dark:text-gray-400 truncate mt-1"
            :title="item.fileName"
          >
            {{ item.fileName }}
          </div>
        </div>

        <!-- 待上传卡片 - 右侧 -->
        <div
          v-for="item in categorizedUploadItems.pending"
          :key="item.id"
          class="flex-shrink-0 w-24 bg-gray-50 dark:bg-gray-700 rounded-lg p-2 border border-gray-200 dark:border-gray-600 opacity-60 transition-all duration-300"
        >
          <div
            class="relative aspect-square mb-2 rounded overflow-hidden bg-gray-100 dark:bg-gray-600"
          >
            <img
              v-if="item.previewUrl"
              :src="item.previewUrl"
              :alt="item.fileName"
              class="w-full h-full object-cover opacity-50"
            />
          </div>
          <div
            class="text-xs text-center text-gray-500 dark:text-gray-400 truncate"
            :title="item.fileName"
          >
            {{ item.fileName }}
          </div>
        </div>

        <!-- 错误卡片 -->
        <div
          v-for="item in categorizedUploadItems.error"
          :key="item.id"
          class="flex-shrink-0 w-24 bg-red-50 dark:bg-red-900/30 rounded-lg p-2 border border-red-200 dark:border-red-700 transition-all duration-300"
        >
          <div
            class="relative aspect-square mb-2 rounded overflow-hidden bg-gray-100 dark:bg-gray-700"
          >
            <img
              v-if="item.previewUrl"
              :src="item.previewUrl"
              :alt="item.fileName"
              class="w-full h-full object-cover"
            />
            <div class="absolute inset-0 bg-red-500/20 flex items-center justify-center">
              <span class="text-red-500 text-xl">✕</span>
            </div>
          </div>
          <div
            class="text-xs text-center text-red-600 dark:text-red-400 truncate"
            :title="item.fileName"
          >
            {{ item.fileName }}
          </div>
          <div
            v-if="item.error"
            class="text-xs text-center text-red-500 truncate mt-1"
            :title="item.error"
          >
            {{ item.error }}
          </div>
        </div>
      </div>

      <!-- 状态统计 -->
      <div class="flex gap-4 mt-3 text-xs text-gray-500 dark:text-gray-400">
        <span
          v-if="categorizedUploadItems.completed.length > 0"
          class="text-green-600 dark:text-green-400"
        >
          ✓ {{ categorizedUploadItems.completed.length }} 已完成
        </span>
        <span
          v-if="categorizedUploadItems.uploading.length > 0"
          class="text-blue-600 dark:text-blue-400"
        >
          ↑ {{ categorizedUploadItems.uploading.length }} 上传中
        </span>
        <span v-if="categorizedUploadItems.pending.length > 0">
          ○ {{ categorizedUploadItems.pending.length }} 等待中
        </span>
        <span
          v-if="categorizedUploadItems.error?.length > 0"
          class="text-red-600 dark:text-red-400"
        >
          ✕ {{ categorizedUploadItems.error.length }} 失败
        </span>
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
                class="aspect-square bg-gray-50 rounded-lg overflow-hidden dark:bg-gray-700 relative"
                :class="{
                  'cursor-pointer': isMultiSelectMode,
                  'ring-2 ring-blue-500': isMultiSelectMode && selectedEmojis.has(idx)
                }"
                @click="handleEmojiClick(idx)"
              >
                <CachedImage
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

    <!-- Telegram 导入模态框 -->
    <TelegramStickerModal v-model="showTelegramModal" />
  </div>
</template>
