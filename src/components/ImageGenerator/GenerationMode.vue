<template>
  <div class="generation-mode">
    <h3>🎯 生成模式</h3>

    <div class="mode-selection">
      <label class="mode-option">
        <input
          type="radio"
          name="mode"
          value="generate"
          v-model="selectedMode"
          @change="onModeChange"
        />
        <span>🎨 文本生成图片</span>
      </label>

      <label class="mode-option">
        <input
          type="radio"
          name="mode"
          value="edit"
          v-model="selectedMode"
          @change="onModeChange"
          :disabled="!supportsImageEditing"
        />
        <span>✏️ 图片编辑</span>
        <small v-if="!supportsImageEditing" class="disabled-hint">(仅支持 Google Gemini)</small>
      </label>
    </div>

    <!-- Image Upload Section for Edit Mode -->
    <ImageUpload
      v-if="selectedMode === 'edit'"
      v-model:image="uploadedImage"
      @image-changed="onImageChanged"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import ImageUpload from './ImageUpload.vue'
import type { ProviderManager } from '@/utils/imageProviders'

interface Props {
  providerManager: ProviderManager
  modelValue: 'generate' | 'edit'
  uploadedImage?: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [mode: 'generate' | 'edit']
  'update:uploadedImage': [image: string | undefined]
  modeChanged: [mode: 'generate' | 'edit']
  imageChanged: [image: string | undefined]
}>()

const selectedMode = ref<'generate' | 'edit'>(props.modelValue)
const uploadedImage = ref<string | undefined>(props.uploadedImage)

const supportsImageEditing = computed(() => {
  return props.providerManager.supportsImageEditing()
})

const onModeChange = () => {
  // If switching to edit mode but provider doesn't support it, switch back
  if (selectedMode.value === 'edit' && !supportsImageEditing.value) {
    selectedMode.value = 'generate'
    return
  }

  emit('update:modelValue', selectedMode.value)
  emit('modeChanged', selectedMode.value)
}

const onImageChanged = (image: string | undefined) => {
  uploadedImage.value = image
  emit('update:uploadedImage', image)
  emit('imageChanged', image)
}

// Watch for external mode changes
watch(
  () => props.modelValue,
  newMode => {
    selectedMode.value = newMode
  }
)

// Watch for external image changes
watch(
  () => props.uploadedImage,
  newImage => {
    uploadedImage.value = newImage
  }
)

// Watch for provider changes - reset to generate mode if edit is not supported
watch(supportsImageEditing, supports => {
  if (!supports && selectedMode.value === 'edit') {
    selectedMode.value = 'generate'
    onModeChange()
  }
})
</script>

<style scoped>
.generation-mode {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
}

.generation-mode h3 {
  margin: 0 0 15px 0;
  color: #374151;
  font-size: 16px;
  font-weight: 600;
}

.mode-selection {
  margin-bottom: 20px;
}

.mode-option {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
  cursor: pointer;
  font-size: 14px;
}

.mode-option input[type='radio'] {
  margin-right: 8px;
}

.mode-option input[type='radio']:disabled {
  cursor: not-allowed;
}

.mode-option span {
  color: #374151;
}

.mode-option:has(input:disabled) {
  opacity: 0.6;
  cursor: not-allowed;
}

.disabled-hint {
  color: #6b7280;
  font-size: 12px;
  margin-left: 8px;
}
</style>
