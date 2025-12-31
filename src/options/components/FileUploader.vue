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

<style scoped src="./FileUploader.css" />
