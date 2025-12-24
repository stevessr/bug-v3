<script setup lang="ts">
import { DeleteOutlined, ScissorOutlined } from '@ant-design/icons-vue'

interface FileItem {
  id: string
  file: File
  previewUrl: string
  cropData?: {
    x: number
    y: number
    width: number
    height: number
  }
}

interface Props {
  files: FileItem[]
  loading?: boolean
}

interface Emits {
  (e: 'removeFile', id: string): void
  (e: 'cropImage', id: string): void
}

withDefaults(defineProps<Props>(), {
  loading: false
})

const emit = defineEmits<Emits>()

const confirmRemove = (id: string) => {
  emit('removeFile', id)
}

const cropImage = (id: string) => {
  emit('cropImage', id)
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}
</script>

<template>
  <div v-if="files.length > 0" class="file-list-display">
    <h4 class="text-lg font-medium mb-3 text-gray-900 dark:text-white">
      待上传文件 ({{ files.length }})
    </h4>

    <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
      <a-card
        v-for="fileItem in files"
        :key="fileItem.id"
        hoverable
        size="small"
        class="file-card group relative overflow-hidden"
        :class="{ cropped: fileItem.cropData }"
      >
        <!-- 图片预览区域 -->
        <template #cover>
          <div class="relative overflow-hidden bg-gray-50 dark:bg-gray-800">
            <a-image
              :src="fileItem.previewUrl"
              :alt="fileItem.file.name"
              class="w-full h-full object-cover"
              preview
            />

            <!-- 裁剪标记 -->
            <div
              v-if="fileItem.cropData"
              class="absolute top-1 left-1 bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded"
            >
              已裁剪
            </div>
          </div>
        </template>

        <!-- 文件信息区域 -->
        <template #actions>
          <div class="w-full space-y-2">
            <!-- 文件名和大小 -->
            <div class="text-center">
              <div
                class="text-xs font-medium text-gray-900 dark:text-white truncate w-full"
                :title="fileItem.file.name"
              >
                {{ fileItem.file.name }}
              </div>
              <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {{ formatFileSize(fileItem.file.size) }}
              </div>
            </div>

            <!-- 功能按钮 -->
            <div class="flex justify-center gap-1">
              <a-button
                type="primary"
                size="small"
                @click="cropImage(fileItem.id)"
                title="裁剪图片"
              >
                <ScissorOutlined />
              </a-button>
              <a-popconfirm
                title="确定要删除这个文件吗？"
                ok-text="确定"
                cancel-text="取消"
                @confirm="confirmRemove(fileItem.id)"
              >
                <a-button type="primary" danger size="small" title="删除文件">
                  <DeleteOutlined />
                </a-button>
              </a-popconfirm>
            </div>
          </div>
        </template>
      </a-card>
    </div>
  </div>
</template>

<style scoped>
.file-list-display {
  margin-top: 1rem;
}

.file-card {
  transition: all 0.2s ease;
}

.file-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.file-card.cropped {
  border-color: #1890ff;
  box-shadow: 0 0 0 1px rgba(24, 144, 255, 0.2);
}

/* 暗色模式适配 */
@media (prefers-color-scheme: dark) {
  .file-card {
    background-color: #1f1f1f;
    border-color: #424242;
  }

  .file-card:hover {
    background-color: #262626;
  }
}

.dark .file-card {
  background-color: #1f1f1f;
  border-color: #424242;
}

.dark .file-card:hover {
  background-color: #262626;
}
</style>
