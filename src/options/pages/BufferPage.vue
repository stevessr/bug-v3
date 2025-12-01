<script setup lang="ts">
import { ref, computed, onMounted, watch, inject, onBeforeUnmount } from 'vue'
import { encode } from 'libavif-wasm'
import {
  QuestionCircleOutlined,
  DownOutlined,
  ScissorOutlined,
  InboxOutlined
} from '@ant-design/icons-vue'

import type { OptionsInject } from '../types'
import ImageCropper from '../components/ImageCropper.vue'

import type { EmojiGroup } from '@/types/type'
import { uploadServices } from '@/utils/uploadServices'

const options = inject<OptionsInject>('options')!
const { emojiStore, openEditEmoji } = options

// State
const uploadService = ref<'linux.do' | 'idcflare.com' | 'imgbed'>('linux.do')
const convertToAvif = ref(false)
const avifQuality = ref(50)
const avifSpeed = ref(6)
const selectedFiles = ref<{ file: File; url: string; width?: number; height?: number }[]>([])
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
const hasAlpha = (data: Uint8ClampedArray) => {
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 255) return true
  }
  return false
}

const removeAlphaChannel = (data: Uint8ClampedArray) => {
  const newData = new Uint8Array((data.length / 4) * 3)
  let j = 0
  for (let i = 0; i < data.length; i += 4) {
    newData[j++] = data[i]
    newData[j++] = data[i + 1]
    newData[j++] = data[i + 2]
  }
  return newData
}

const getWaitProgress = (progressItem: any) => {
  if (!progressItem.waitingFor || !progressItem.waitStart) {
    return { percent: 0, remaining: 0 }
  }
  const elapsed = (Date.now() - progressItem.waitStart) / 1000
  const remaining = Math.max(0, progressItem.waitingFor - elapsed)
  const percent = Math.min(100, (elapsed / progressItem.waitingFor) * 100)
  return { percent: 100 - percent, remaining: Math.ceil(remaining) }
}

const convertImageToAvif = async (file: File): Promise<File> => {
  try {
    const imageBitmap = await createImageBitmap(file)

    if (imageBitmap.width === 0 || imageBitmap.height === 0) {
      throw new Error('Image has zero dimensions, skipping AVIF conversion.')
    }

    const canvas = document.createElement('canvas')
    canvas.width = imageBitmap.width
    canvas.height = imageBitmap.height
    const ctx = canvas.getContext('2d', { colorSpace: 'srgb' })
    if (!ctx) throw new Error('Could not get canvas context')

    ctx.drawImage(imageBitmap, 0, 0)
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)

    const isTransparent = hasAlpha(imageData.data)

    console.log('[AVIF Conversion]', {
      name: file.name,
      width: imageData.width,
      height: imageData.height,
      hasAlpha: isTransparent
    })

    // 1. Try native browser AVIF encoding first (much faster and more stable)
    try {
      const nativeBlob = await new Promise<Blob | null>(resolve => {
        canvas.toBlob(
          blob => {
            if (blob && blob.type === 'image/avif') {
              resolve(blob)
            } else {
              resolve(null) // Browser doesn't support AVIF encoding
            }
          },
          'image/avif',
          avifQuality.value / 100
        )
      })

      if (nativeBlob) {
        console.log('[AVIF Conversion] Used native browser encoder')
        const newFileName = file.name.substring(0, file.name.lastIndexOf('.')) + '.avif'
        return new File([nativeBlob], newFileName, { type: 'image/avif' })
      }
    } catch (e) {
      console.warn('[AVIF Conversion] Native encoding failed, falling back to WASM', e)
    }

    // 2. Fallback to libavif-wasm
    console.log('[AVIF Conversion] Falling back to WASM encoder')
    let encodeData: Uint8Array
    let channels: number

    if (isTransparent) {
      encodeData = new Uint8Array(imageData.data)
      channels = 4
    } else {
      encodeData = removeAlphaChannel(imageData.data)
      channels = 3
    }

    // Map 0-100 quality to 63-0 quantizer (approximate)
    // 100 -> 0 (Lossless/High)
    // 0 -> 63 (Low quality)
    const targetQuantizer = Math.round(63 * (1 - avifQuality.value / 100))
    // Create a small range around the target
    const minQ = Math.max(0, targetQuantizer - 5)
    const maxQ = Math.min(63, targetQuantizer + 5)

    const avifBuffer = await encode(encodeData, imageData.width, imageData.height, channels, {
      maxThreads: 1,
      speed: avifSpeed.value,
      avifPixelFormat: 3, // YUV420
      minQuantizer: minQ,
      maxQuantizer: maxQ,
      minQuantizerAlpha: minQ,
      maxQuantizerAlpha: maxQ
    })
    if (!avifBuffer) throw new Error('AVIF encoding failed')

    const avifBlob = new Blob([avifBuffer.slice().buffer], { type: 'image/avif' })
    const newFileName = file.name.substring(0, file.name.lastIndexOf('.')) + '.avif'
    return new File([avifBlob], newFileName, { type: 'image/avif' })
  } catch (error) {
    console.error('Failed to convert image to AVIF:', error)
    // Return original file if conversion fails
    return file
  }
}

const beforeUpload = (_file: File, fileList: File[]) => {
  addFiles(fileList)
  return false // 阻止 antdv 的默认上传行为
}

const addFiles = async (files: File[]) => {
  let imageFiles = files.filter(file => file.type.startsWith('image/'))

  if (convertToAvif.value) {
    try {
      imageFiles = await Promise.all(imageFiles.map(file => convertImageToAvif(file)))
    } catch (error) {
      console.error('An error occurred during AVIF conversion:', error)
      // Fallback to original files if conversion fails
    }
  }

  // Filter out existing files
  const existingNames = bufferGroup.value?.emojis.map(e => e.name) || []
  const newFiles = imageFiles
    .filter(file => !existingNames.includes(file.name))
    .map(file => {
      const url = URL.createObjectURL(file)
      const newFileEntry = { file, url, width: 0, height: 0 }

      // Get image dimensions
      const img = new Image()
      img.onload = () => {
        newFileEntry.width = img.width
        newFileEntry.height = img.height
      }
      img.src = url

      return newFileEntry
    })

  selectedFiles.value = [...selectedFiles.value, ...newFiles]
}

// 图片切割相关方法
const openImageCropper = (file: File) => {
  cropImageFile.value = file
  showImageCropper.value = true
}

const closeImageCropper = () => {
  showImageCropper.value = false
  cropImageFile.value = null
}

const handleCroppedEmojis = async (croppedEmojis: any[]) => {
  try {
    const newFilesWithUrls: any[] = []
    for (const croppedEmoji of croppedEmojis) {
      // Convert base64 to Blob
      const response = await fetch(croppedEmoji.imageUrl)
      const blob = await response.blob()
      const file = new File([blob], `${croppedEmoji.name}.png`, { type: 'image/png' })
      const url = URL.createObjectURL(file)

      // Get image dimensions
      const img = new Image()
      img.onload = () => {
        newFilesWithUrls.push({ file, url, width: img.width, height: img.height })
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
        URL.revokeObjectURL(selectedFiles.value[indexToRemove].url)
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

const removeFile = (index: number) => {
  const fileToRemove = selectedFiles.value[index]
  if (fileToRemove) {
    URL.revokeObjectURL(fileToRemove.url)
  }
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
        let fileToUpload = file
        if (convertToAvif.value) {
          try {
            fileToUpload = await convertImageToAvif(file)
          } catch (conversionError) {
            console.error(
              `Failed to convert ${file.name} to AVIF, uploading original file.`,
              conversionError
            )
          }
        }

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

        const uploadUrl = await service.uploadFile(fileToUpload, updateProgress, onRateLimitWait)

        newEmojis.push({
          name: fileToUpload.name,
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
  selectedFiles.value.forEach(item => URL.revokeObjectURL(item.url))
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
      <a-upload-dragger
        name="file"
        multiple
        accept="image/*"
        :before-upload="beforeUpload"
        :show-upload-list="false"
      >
        <p class="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p class="ant-upload-text">拖拽文件到此处或点击选择文件</p>
        <p class="ant-upload-hint">支持批量选择，会自动过滤已存在的文件</p>
      </a-upload-dragger>

      <!-- AVIF Conversion Switch -->
      <div class="mt-4 flex flex-col items-end">
        <div class="flex items-center">
          <label
            for="avif-switch"
            class="mr-2 text-sm font-medium text-gray-900 dark:text-gray-300"
          >
            转换为 AVIF 格式
          </label>
          <a-switch id="avif-switch" v-model:checked="convertToAvif" />
        </div>

        <!-- AVIF Settings -->
        <div
          v-if="convertToAvif"
          class="mt-4 w-full p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 transition-all duration-300"
        >
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- Quality Control -->
            <div>
              <div class="flex justify-between mb-2">
                <label class="text-sm font-medium text-gray-700 dark:text-gray-300">
                  压缩质量 ({{ avifQuality }}%)
                </label>
              </div>
              <a-slider v-model:value="avifQuality" :min="1" :max="100" />
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                值越小文件越小。推荐 30-50 以获得比 JPEG 更好的压缩率。
              </p>
            </div>

            <!-- Speed Control -->
            <div>
              <div class="flex justify-between mb-2">
                <label class="text-sm font-medium text-gray-700 dark:text-gray-300">
                  编码速度 ({{ avifSpeed }})
                </label>
              </div>
              <a-slider v-model:value="avifSpeed" :min="0" :max="10" />
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                0 (最慢/最小) - 10 (最快/最大)。推荐 6 平衡速度与体积。
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- File List -->
      <div v-if="selectedFiles.length > 0" class="mt-4">
        <h4 class="font-medium dark:text-white mb-2">待上传文件：</h4>
        <ul class="space-y-2">
          <li
            v-for="(item, index) in selectedFiles"
            :key="index"
            class="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded"
          >
            <div class="flex items-center space-x-2">
              <a-image :src="item.url" width="32px" height="32px" style="object-fit: cover" />
              <span class="text-sm dark:text-gray-300">{{ item.file.name }}</span>
            </div>
            <div class="flex items-center space-x-2">
              <a-button
                type="text"
                size="small"
                @click="openImageCropper(item.file)"
                title="切割图片"
              >
                <template #icon><ScissorOutlined /></template>
              </a-button>
              <a-button type="text" size="small" danger @click="removeFile(index)">移除</a-button>
            </div>
          </li>
        </ul>
      </div>

      <!-- Upload Button -->
      <div class="mt-4 flex justify-end space-x-2">
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
          <AInput v-model:value="newGroupIcon" placeholder="输入图标 URL 或 emoji" />
        </div>
      </div>
    </a-modal>

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

<style scoped>
.buffer-page {
  max-width: 4xl;
  margin: 0 auto;
}

.emoji-item {
  width: 80px;
}
</style>
