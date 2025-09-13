<script setup lang="ts">
import { ref } from 'vue'



interface Props {
  isLoading: boolean
  error: string | null
  images: string[]
}

// props are defined for template typing but not used directly in script
defineProps<Props>()

const emit = defineEmits<{
  downloadImage: [url: string, filename: string]
  copyImageUrl: [url: string]
}>()

const loadedImages = ref(new Set<string>())

const onImageLoad = (event: Event) => {
  const img = event.target as HTMLImageElement
  loadedImages.value.add(img.src)
}

const onImageError = (event: Event) => {
  const img = event.target as HTMLImageElement
  console.error('Failed to load image:', img.src)
}

const downloadImage = (url: string, index: number) => {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '')
  const filename = `generated-image-${timestamp}-${index + 1}.png`
  emit('downloadImage', url, filename)
}

const copyImageUrl = (url: string) => {
  emit('copyImageUrl', url)
}
</script>

<template>
  <div class="result-display">
    <!-- Loading State -->
    <div v-if="isLoading" class="loading-state">
      <div class="loading-spinner"></div>
      <p>正在生成图片，请稍候...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error-state">
      <div class="error-icon">❌</div>
      <p class="error-message">{{ error }}</p>
    </div>

    <!-- Results -->
    <div v-else-if="images.length > 0" class="results">
      <h3>✨ 生成结果</h3>
      <div class="image-grid">
        <div v-for="(image, index) in images" :key="index" class="image-item">
          <img
            :src="image"
            :alt="`Generated image ${index + 1}`"
            class="generated-image"
            @load="onImageLoad"
            @error="onImageError"
          />
          <div class="image-actions">
            <button
              @click="downloadImage(image, index)"
              class="action-btn download-btn"
              title="下载图片"
            >
              📥
            </button>
            <button @click="copyImageUrl(image)" class="action-btn copy-btn" title="复制链接">
              📋
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.result-display {
  margin-top: 20px;
}

.loading-state,
.error-state {
  text-align: center;
  padding: 40px 20px;
  background: white;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f4f6;
  border-top: 4px solid #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 16px;
}

.loading-state p {
  color: #6b7280;
  margin: 0;
}

.error-state {
  background: #fef2f2;
  border-color: #fecaca;
}

.error-icon {
  font-size: 32px;
  margin-bottom: 12px;
}

.error-message {
  color: #dc2626;
  margin: 0;
  font-weight: 500;
}

.results {
  background: white;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  padding: 20px;
}

.results h3 {
  margin: 0 0 20px 0;
  color: #374151;
  font-size: 18px;
  font-weight: 600;
}

.image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 20px;
}

.image-item {
  position: relative;
  background: #f9fafb;
  border-radius: 8px;
  overflow: hidden;
  transition: transform 0.2s;
}

.image-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.generated-image {
  width: 100%;
  height: auto;
  display: block;
  border-radius: 8px;
}

.image-actions {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.2s;
}

.image-item:hover .image-actions {
  opacity: 1;
}

.action-btn {
  background: rgba(0, 0, 0, 0.7);
  color: white;
  border: none;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s;
}

.action-btn:hover {
  background: rgba(0, 0, 0, 0.9);
}

.download-btn:hover {
  background: #059669;
}

.copy-btn:hover {
  background: #3b82f6;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 768px) {
  .image-grid {
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 15px;
  }

  .image-actions {
    opacity: 1; /* Always show on mobile */
  }
}
</style>
