<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  isGenerating: boolean
  hasResults: boolean
  canGenerate: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  generate: []
  clear: []
}>()

const onGenerate = () => {
  if (!props.isGenerating && props.canGenerate) {
    emit('generate')
  }
}

const onClear = () => {
  emit('clear')
}
</script>

<template>
  <div class="generate-section">
    <button
      @click="onGenerate"
      :disabled="isGenerating || !canGenerate"
      class="generate-btn"
      :class="{ generating: isGenerating }"
    >
      <span v-if="isGenerating" class="loading-spinner"></span>
      {{ isGenerating ? '生成中...' : '🎨 生成图片' }}
    </button>

    <button v-if="hasResults" @click="onClear" class="clear-btn">🗑️ 清空结果</button>
  </div>
</template>

<style scoped>
.generate-section {
  display: flex;
  gap: 10px;
  justify-content: center;
  margin: 20px 0;
}

.generate-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 140px;
  justify-content: center;
}

.generate-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.generate-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.generate-btn.generating {
  background: linear-gradient(135deg, #a0a0a0 0%, #808080 100%);
}

.clear-btn {
  background: #ef4444;
  color: white;
  border: none;
  padding: 12px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s;
}

.clear-btn:hover {
  background: #dc2626;
  transform: translateY(-1px);
}

.loading-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid transparent;
  border-top: 2px solid currentColor;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 768px) {
  .generate-section {
    flex-direction: column;
    align-items: center;
  }

  .generate-btn,
  .clear-btn {
    width: 100%;
    max-width: 300px;
  }
}
</style>
