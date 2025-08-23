<template>
  <div class="generation-config">
    <div class="config-grid">
      <div class="config-item">
        <label for="imageCount">生成数量</label>
        <select 
          id="imageCount" 
          v-model="imageCount"
          @change="onImageCountChange"
          class="form-select"
        >
          <option 
            v-for="count in IMAGE_COUNTS" 
            :key="count.value" 
            :value="count.value"
          >
            {{ count.label }}
          </option>
        </select>
      </div>

      <div class="config-item">
        <label for="aspectRatio">宽高比</label>
        <select 
          id="aspectRatio" 
          v-model="aspectRatio"
          @change="onAspectRatioChange"
          class="form-select"
        >
          <option 
            v-for="ratio in ASPECT_RATIOS" 
            :key="ratio.value" 
            :value="ratio.value"
          >
            {{ ratio.label }}
          </option>
        </select>
      </div>

      <div class="config-item">
        <label for="style">艺术风格</label>
        <select 
          id="style" 
          v-model="style"
          @change="onStyleChange"
          class="form-select"
        >
          <option 
            v-for="styleOption in ART_STYLES" 
            :key="styleOption.value" 
            :value="styleOption.value"
          >
            {{ styleOption.label }}
          </option>
        </select>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { ASPECT_RATIOS, ART_STYLES, IMAGE_COUNTS } from '@/types/imageGenerator';

interface Props {
  modelValue: {
    imageCount: number;
    aspectRatio: string;
    style: string;
  };
}

const props = defineProps<Props>();

const emit = defineEmits<{
  'update:modelValue': [config: {
    imageCount: number;
    aspectRatio: string;
    style: string;
  }];
  configChanged: [config: {
    imageCount: number;
    aspectRatio: string;
    style: string;
  }];
}>();

const imageCount = ref(props.modelValue.imageCount);
const aspectRatio = ref(props.modelValue.aspectRatio);
const style = ref(props.modelValue.style);

const emitChange = () => {
  const config = {
    imageCount: imageCount.value,
    aspectRatio: aspectRatio.value,
    style: style.value
  };
  
  emit('update:modelValue', config);
  emit('configChanged', config);
};

const onImageCountChange = () => {
  emitChange();
};

const onAspectRatioChange = () => {
  emitChange();
};

const onStyleChange = () => {
  emitChange();
};

// Watch for external changes
watch(() => props.modelValue, (newValue) => {
  imageCount.value = newValue.imageCount;
  aspectRatio.value = newValue.aspectRatio;
  style.value = newValue.style;
}, { deep: true });
</script>

<style scoped>
.generation-config {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
}

.config-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 15px;
}

.config-item {
  display: flex;
  flex-direction: column;
}

.config-item label {
  margin-bottom: 5px;
  font-weight: 600;
  color: #374151;
  font-size: 14px;
}

.form-select {
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  background: white;
  transition: border-color 0.2s;
}

.form-select:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
}

@media (max-width: 768px) {
  .config-grid {
    grid-template-columns: 1fr;
  }
}
</style>
