<template>
  <div class="prompt-input">
    <label for="prompt" class="prompt-label">
      {{ isEditMode ? '✏️ 描述您想要对图片进行的修改' : '📝 描述您想要生成的图片' }}
    </label>

    <div class="input-group">
      <textarea
        id="prompt"
        v-model="promptText"
        @input="onPromptChange"
        :placeholder="placeholder"
        class="prompt-textarea"
        rows="4"
        required
      ></textarea>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'

interface Props {
  modelValue: string
  isEditMode?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [prompt: string]
  promptChanged: [prompt: string]
}>()

const promptText = ref(props.modelValue)

const placeholder = computed(() => {
  if (props.isEditMode) {
    return '例如：在图片中添加一只小狗，让背景变成夕阳...'
  }
  return '例如：一只可爱的橘猫坐在樱花树下，阳光透过花瓣洒在地面上，温暖的春日氛围...'
})

const onPromptChange = () => {
  emit('update:modelValue', promptText.value)
  emit('promptChanged', promptText.value)
}

// Watch for external changes
watch(
  () => props.modelValue,
  newValue => {
    promptText.value = newValue
  }
)
</script>

<style scoped>
.prompt-input {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
}

.prompt-label {
  display: block;
  margin-bottom: 10px;
  font-weight: 600;
  color: #374151;
  font-size: 16px;
}

.input-group {
  position: relative;
}

.prompt-textarea {
  width: 100%;
  padding: 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  font-family: inherit;
  line-height: 1.5;
  resize: vertical;
  min-height: 100px;
  transition: border-color 0.2s;
}

.prompt-textarea:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
}

.prompt-textarea::placeholder {
  color: #9ca3af;
}
</style>
