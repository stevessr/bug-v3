<template>
  <div class="image-upload-section">
    <h4>上传要编辑的图片</h4>

    <!-- Upload Area -->
    <div
      v-if="!previewImage"
      class="upload-area"
      :class="{ 'drag-over': isDragOver }"
      @click="triggerFileInput"
      @dragover.prevent="onDragOver"
      @dragleave.prevent="onDragLeave"
      @drop.prevent="onDrop"
    >
      <div class="upload-icon">📷</div>
      <div class="upload-text">点击或拖拽图片到此处</div>
      <input
        ref="fileInput"
        type="file"
        accept="image/*"
        @change="onFileSelect"
        style="display: none"
      />
    </div>

    <!-- Image Preview -->
    <div v-else class="image-preview">
      <img :src="previewImage" alt="Preview" class="preview-img" />
      <button @click="removeImage" class="remove-btn">移除图片</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

interface Props {
  image?: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:image': [image: string | undefined]
  'image-changed': [image: string | undefined]
}>()

const fileInput = ref<HTMLInputElement>()
const previewImage = ref<string | undefined>(props.image)
const isDragOver = ref(false)

const triggerFileInput = () => {
  fileInput.value?.click()
}

const handleImageFile = (file: File) => {
  if (!file.type.startsWith('image/')) {
    alert('请选择图片文件')
    return
  }

  const reader = new FileReader()
  reader.onload = e => {
    const result = e.target?.result as string
    const base64 = result.split(',')[1] // Remove data:image/...;base64, prefix
    previewImage.value = result

    emit('update:image', base64)
    emit('image-changed', base64)
  }
  reader.readAsDataURL(file)
}

const onFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) {
    handleImageFile(file)
  }
}

const onDragOver = (event: DragEvent) => {
  event.preventDefault()
  isDragOver.value = true
}

const onDragLeave = (event: DragEvent) => {
  event.preventDefault()
  // Only set to false if we're leaving the upload area itself
  if (!event.currentTarget?.contains(event.relatedTarget as Node)) {
    isDragOver.value = false
  }
}

const onDrop = (event: DragEvent) => {
  event.preventDefault()
  isDragOver.value = false

  const file = event.dataTransfer?.files[0]
  if (file) {
    handleImageFile(file)
  }
}

const removeImage = () => {
  previewImage.value = undefined
  if (fileInput.value) {
    fileInput.value.value = ''
  }

  emit('update:image', undefined)
  emit('image-changed', undefined)
}

// Watch for external image changes
watch(
  () => props.image,
  newImage => {
    if (newImage) {
      previewImage.value = `data:image/jpeg;base64,${newImage}`
    } else {
      previewImage.value = undefined
    }
  }
)
</script>

<style scoped>
.image-upload-section {
  margin-top: 20px;
}

.image-upload-section h4 {
  margin: 0 0 10px 0;
  color: #374151;
  font-size: 14px;
  font-weight: 600;
}

.upload-area {
  border: 2px dashed #d1d5db;
  border-radius: 8px;
  padding: 20px;
  text-align: center;
  background: #f9fafb;
  cursor: pointer;
  transition: all 0.2s;
}

.upload-area:hover,
.upload-area.drag-over {
  border-color: #3b82f6;
  background: #eff6ff;
}

.upload-icon {
  font-size: 24px;
  margin-bottom: 8px;
}

.upload-text {
  color: #6b7280;
  font-size: 14px;
}

.image-preview {
  text-align: center;
}

.preview-img {
  max-width: 200px;
  max-height: 200px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  display: block;
  margin: 0 auto;
}

.remove-btn {
  display: block;
  margin: 10px auto 0;
  padding: 5px 10px;
  background: #ef4444;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: background-color 0.2s;
}

.remove-btn:hover {
  background: #dc2626;
}
</style>
