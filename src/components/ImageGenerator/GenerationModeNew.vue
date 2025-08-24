<template>
  <div class="generation-mode">
    <h3>生成模式</h3>
    <div class="mode-options">
      <label class="mode-option">
        <input
          type="radio"
          value="generate"
          v-model="selectedMode"
          @change="onModeChange"
        />
        <span class="mode-label">
          <span>🎨 文字生成图片</span>
          <small>根据描述生成全新图片</small>
        </span>
      </label>

      <label class="mode-option" :class="{ disabled: !supportsImageEditing }">
        <input
          type="radio"
          value="edit"
          v-model="selectedMode"
          @change="onModeChange"
          :disabled="!supportsImageEditing"
        />
        <span class="mode-label">
          <span>✏️ 图片编辑</span>
          <small v-if="!supportsImageEditing" style="color: #6b7280; font-size: 12px; margin-left: 8px;">
            (仅支持 Google Gemini)
          </small>
        </span>
      </label>
    </div>
    
    <!-- Image Upload for Edit Mode -->
    <div v-if="selectedMode === 'edit'" class="image-upload-section">
      <h4>上传要编辑的图片</h4>
      <div class="upload-area" @click="openFileDialog">
        <input
          ref="fileInput"
          type="file"
          accept="image/*"
          @change="handleFileSelect"
          style="display: none"
        />
        <div v-if="!uploadedImage" class="upload-placeholder">
          <div class="upload-icon">📷</div>
          <div class="upload-text">点击选择图片</div>
        </div>
        <div v-else class="image-preview">
          <img :src="uploadedImage" alt="Preview" class="preview-img" />
          <button @click.stop="removeImage" class="remove-btn">移除图片</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import type { ProviderManager } from './providerManager';

interface Props {
  modelValue: 'generate' | 'edit';
  providerManager: ProviderManager;
  uploadedImage?: string;
}

interface Emits {
  (e: 'update:modelValue', value: 'generate' | 'edit'): void;
  (e: 'mode-changed', mode: 'generate' | 'edit'): void;
  (e: 'image-changed', image: string | undefined): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const selectedMode = ref<'generate' | 'edit'>(props.modelValue);
const uploadedImage = ref(props.uploadedImage);
const fileInput = ref<HTMLInputElement>();

const supportsImageEditing = computed(() => {
  const currentProvider = props.providerManager.getCurrentProviderName();
  console.log('Current provider for image editing check:', currentProvider);
  return props.providerManager.supportsImageEditing();
});

const onModeChange = () => {
  if (selectedMode.value === 'edit' && !supportsImageEditing.value) {
    selectedMode.value = 'generate';
    return;
  }
  
  emit('update:modelValue', selectedMode.value);
  emit('mode-changed', selectedMode.value);
  
  if (selectedMode.value !== 'edit') {
    uploadedImage.value = undefined;
    emit('image-changed', undefined);
  }
};

const openFileDialog = () => {
  fileInput.value?.click();
};

const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      uploadedImage.value = result;
      emit('image-changed', result);
    };
    reader.readAsDataURL(file);
  }
};

const removeImage = () => {
  uploadedImage.value = undefined;
  emit('image-changed', undefined);
  if (fileInput.value) {
    fileInput.value.value = '';
  }
};

watch(() => props.modelValue, (newValue) => {
  selectedMode.value = newValue;
});

watch(() => props.uploadedImage, (newValue) => {
  uploadedImage.value = newValue;
});

// Watch for provider changes and reset edit mode if not supported
watch(() => props.providerManager.getCurrentProviderName(), (newProvider) => {
  console.log('Provider changed to:', newProvider);
  if (selectedMode.value === 'edit' && !supportsImageEditing.value) {
    console.log('Switching from edit mode due to provider change');
    selectedMode.value = 'generate';
    onModeChange();
  }
});
</script>

<style scoped>
.generation-mode {
  margin-bottom: 24px;
}

.generation-mode h3 {
  font-size: 1.2rem;
  margin-bottom: 16px;
  color: #374151;
  font-weight: 600;
}

.mode-options {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 20px;
}

.mode-option {
  display: flex;
  align-items: flex-start;
  cursor: pointer;
  padding: 16px;
  border: 2px solid #e5e7eb;
  border-radius: 12px;
  background: white;
  transition: all 0.2s ease;
  flex: 1;
  min-width: 200px;
}

.mode-option:hover:not(.disabled) {
  border-color: #3b82f6;
  background: #f8faff;
}

.mode-option.disabled {
  opacity: 0.6;
  cursor: not-allowed;
  background: #f9fafb;
}

.mode-option input[type="radio"] {
  margin-right: 12px;
  margin-top: 2px;
  cursor: pointer;
}

.mode-option.disabled input[type="radio"] {
  cursor: not-allowed;
}

.mode-label {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.mode-label > span:first-child {
  font-weight: 500;
  color: #1f2937;
}

.mode-label small {
  color: #6b7280;
  font-size: 12px;
}

.mode-option input[type="radio"]:checked + .mode-label {
  color: #3b82f6;
}

.mode-option input[type="radio"]:checked + .mode-label > span:first-child {
  color: #3b82f6;
  font-weight: 600;
}

.image-upload-section {
  margin-top: 20px;
}

.image-upload-section h4 {
  margin-bottom: 12px;
  color: #374151;
  font-weight: 500;
}

.upload-area {
  border: 2px dashed #d1d5db;
  border-radius: 12px;
  padding: 20px;
  text-align: center;
  background: #fefefe;
  cursor: pointer;
  transition: all 0.3s ease;
  min-height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.upload-area:hover {
  border-color: #3b82f6;
  background: #f8faff;
}

.upload-placeholder {
  color: #6b7280;
}

.upload-icon {
  font-size: 32px;
  margin-bottom: 8px;
}

.upload-text {
  font-size: 14px;
}

.image-preview {
  position: relative;
}

.preview-img {
  max-width: 200px;
  max-height: 200px;
  border-radius: 8px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.remove-btn {
  margin-top: 8px;
  background: #ef4444;
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s ease;
}

.remove-btn:hover {
  background: #dc2626;
}
</style>