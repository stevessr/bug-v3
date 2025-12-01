<script setup lang="ts">
import { ref } from 'vue'
import { InboxOutlined } from '@ant-design/icons-vue'

interface Props {
  multiple?: boolean
  accept?: string
  disabled?: boolean
}

interface Emits {
  (e: 'filesSelected', files: File[]): void
}

const props = withDefaults(defineProps<Props>(), {
  multiple: true,
  accept: 'image/*',
  disabled: false
})

const emit = defineEmits<Emits>()

const fileInputRef = ref<HTMLInputElement>()
const isDragOver = ref(false)

const triggerFileSelect = () => {
  if (props.disabled) return
  fileInputRef.value?.click()
}

const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement
  const files = target.files
  if (files && files.length > 0) {
    emit('filesSelected', Array.from(files))
  }
  // 重置 input 以允许重复选择相同文件
  target.value = ''
}

const handleDrop = (event: DragEvent) => {
  event.preventDefault()
  event.stopPropagation()
  isDragOver.value = false

  if (props.disabled) return

  const files = event.dataTransfer?.files
  if (files && files.length > 0) {
    emit('filesSelected', Array.from(files))
  }
}

const handleDragOver = (event: DragEvent) => {
  event.preventDefault()
  event.stopPropagation()
  if (!props.disabled) {
    isDragOver.value = true
  }
}

const handleDragLeave = (event: DragEvent) => {
  event.preventDefault()
  event.stopPropagation()
  isDragOver.value = false
}
</script>

<template>
  <div
    class="custom-upload-dragger"
    :class="{
      dragover: isDragOver,
      disabled: disabled
    }"
    @click="triggerFileSelect"
    @drop="handleDrop"
    @dragover="handleDragOver"
    @dragleave="handleDragLeave"
  >
    <input
      ref="fileInputRef"
      type="file"
      :multiple="multiple"
      :accept="accept"
      :disabled="disabled"
      style="display: none"
      @change="handleFileSelect"
    />
    <p class="upload-drag-icon">
      <InboxOutlined />
    </p>
    <p class="upload-text">拖拽文件到此处或点击选择文件</p>
    <p class="upload-hint">支持批量选择，会自动过滤已存在的文件</p>
  </div>
</template>

<style scoped>
.custom-upload-dragger {
  box-sizing: border-box;
  padding: 20px;
  background: #fafafa;
  border: 1px dashed #d9d9d9;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.3s;
  text-align: center;
}

.custom-upload-dragger:hover:not(.disabled) {
  border-color: #4096ff;
}

.custom-upload-dragger.dragover:not(.disabled) {
  border-color: #4096ff;
  background: #f0f8ff;
}

.custom-upload-dragger.disabled {
  cursor: not-allowed;
  opacity: 0.6;
  background: #f5f5f5;
}

.upload-drag-icon {
  margin-bottom: 8px;
  font-size: 48px;
  color: #4096ff;
}

.upload-text {
  margin: 8px 0 4px;
  color: rgba(0, 0, 0, 0.85);
  font-size: 16px;
}

.upload-hint {
  color: rgba(0, 0, 0, 0.45);
  font-size: 14px;
}

/* 暗色模式适配 */
@media (prefers-color-scheme: dark) {
  .custom-upload-dragger {
    background: #1f1f1f;
    border-color: #424242;
    color: #fff;
  }

  .custom-upload-dragger:hover:not(.disabled) {
    border-color: #4096ff;
  }

  .custom-upload-dragger.dragover:not(.disabled) {
    border-color: #4096ff;
    background: #111827;
  }

  .custom-upload-dragger.disabled {
    background: #2a2a2a;
  }

  .upload-text {
    color: rgba(255, 255, 255, 0.85);
  }

  .upload-hint {
    color: rgba(255, 255, 255, 0.45);
  }
}

.dark .custom-upload-dragger {
  background: #1f1f1f;
  border-color: #424242;
  color: #fff;
}

.dark .custom-upload-dragger:hover:not(.disabled) {
  border-color: #4096ff;
}

.dark .custom-upload-dragger.dragover:not(.disabled) {
  border-color: #4096ff;
  background: #111827;
}

.dark .custom-upload-dragger.disabled {
  background: #2a2a2a;
}

.dark .upload-text {
  color: rgba(255, 255, 255, 0.85);
}

.dark .upload-hint {
  color: rgba(255, 255, 255, 0.45);
}
</style>
