<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

import { useEmojiStore } from '@/stores/emojiStore'
import { uploadServices } from '@/utils/uploadServices'

const emojiStore = useEmojiStore()

// State
const uploadService = ref<'linux.do' | 'idcflare.com'>('linux.do')
const selectedFiles = ref<File[]>([])
const isDragging = ref(false)
const isUploading = ref(false)
const uploadProgress = ref<Array<{ fileName: string; percent: number; error?: string }>>([])
const fileInput = ref<HTMLInputElement>()

// Computed
const bufferGroup = computed(() => emojiStore.groups.find(g => g.id === 'buffer' || g.name === '缓冲区'))

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
        emojiStore.addEmojiWithoutSave(
          {
            name: file.name,
            url: uploadUrl,
            displayUrl: uploadUrl
          },
          group.id || 'buffer'
        )

        uploadProgress.value[i].percent = 100
      } catch (error) {
        console.error(`Failed to upload ${file.name}:`, error)
        uploadProgress.value[i].error = error instanceof Error ? error.message : String(error)
      }
    }

    // Save all changes at once
    emojiStore.maybeSave()

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
  if (!bufferGroup.value) {
    emojiStore.createGroup('缓冲区', '📦')
    // Update the group ID to be consistent
    const buffer = emojiStore.groups.find(g => g.name === '缓冲区')
    if (buffer) {
      buffer.id = 'buffer'
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
        <label class="flex items-center">
          <input type="radio" v-model="uploadService" value="linux.do" class="mr-2" />
          <span>linux.do</span>
        </label>
        <label class="flex items-center">
          <input type="radio" v-model="uploadService" value="idcflare.com" class="mr-2" />
          <span>idcflare.com</span>
        </label>
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
            <button @click="removeFile(index)" class="text-red-500 hover:text-red-700 text-sm">
              移除
            </button>
          </li>
        </ul>
      </div>

      <!-- Upload Button -->
      <div class="mt-4 flex justify-end">
        <button
          @click="uploadFiles"
          :disabled="selectedFiles.length === 0 || isUploading"
          class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {{ isUploading ? '上传中...' : `上传 ${selectedFiles.length} 个文件` }}
        </button>
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
        class="bg-white dark:bg-gray-800 rounded-lg shadow p-4"
      >
        <h3 class="text-lg font-semibold dark:text-white mb-4">缓冲区表情</h3>
        <div class="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4">
          <div v-for="(emoji, index) in bufferGroup.emojis" :key="emoji.id" class="relative group">
            <img
              :src="emoji.url"
              :alt="emoji.name"
              class="w-full h-20 object-cover rounded border dark:border-gray-600"
            />
            <div
              class="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1 text-center truncate"
            >
              {{ emoji.name }}
            </div>
            <button
              @click="removeEmoji(index)"
              class="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
            >
              ×
            </button>
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
  </div>
</template>

<style scoped>
.buffer-page {
  max-width: 4xl;
  margin: 0 auto;
}
</style>
