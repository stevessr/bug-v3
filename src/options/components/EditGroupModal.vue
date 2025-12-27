<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { message } from 'ant-design-vue'

import CachedImage from '@/components/CachedImage.vue'

interface Props {
  visible: boolean
  groupId: string
  initialName: string
  initialIcon: string
  initialDetail?: string
}

interface Emits {
  (e: 'update:visible', value: boolean): void
  (e: 'save', data: { id: string; name: string; icon: string; detail: string }): void
}

const props = withDefaults(defineProps<Props>(), {
  initialDetail: ''
})

const emit = defineEmits<Emits>()

const groupName = ref(props.initialName)
const groupIcon = ref(props.initialIcon)
const groupDetail = ref(props.initialDetail || '')

const isValid = computed(() => {
  return groupName.value.trim().length > 0
})

// Watch for prop changes to reset form data
watch(
  () => props.initialName,
  newName => {
    groupName.value = newName
  }
)

watch(
  () => props.initialIcon,
  newIcon => {
    groupIcon.value = newIcon
  }
)

watch(
  () => props.initialDetail,
  newDetail => {
    groupDetail.value = newDetail || ''
  }
)

const handleSave = () => {
  if (!isValid.value) {
    message.error('请输入分组名称')
    return
  }

  emit('save', {
    id: props.groupId,
    name: groupName.value.trim(),
    icon: groupIcon.value.trim() || '📁',
    detail: groupDetail.value.trim()
  })

  emit('update:visible', false)
}

const handleCancel = () => {
  // Reset to original values
  groupName.value = props.initialName
  groupIcon.value = props.initialIcon
  groupDetail.value = props.initialDetail || ''
  emit('update:visible', false)
}

const isImageUrl = (url: string): boolean => {
  if (!url.trim()) return false
  return url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:image/')
}

const imagePreviewUrl = computed(() => {
  if (!isImageUrl(groupIcon.value)) return ''
  return groupIcon.value.trim()
})

const handleImageError = () => {
  message.warning('图标加载失败，请检查图片 URL')
}
</script>

<template>
  <a-modal
    :open="visible"
    title="编辑分组"
    @ok="handleSave"
    @cancel="handleCancel"
    :ok-button-props="{ disabled: !isValid }"
    cancel-text="取消"
    ok-text="保存"
    width="600px"
  >
    <div class="space-y-4">
      <!-- 分组名称 -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2 dark:text-white">
          分组名称
          <span class="text-red-500">*</span>
        </label>
        <a-input
          v-model:value="groupName"
          placeholder="输入分组名称"
          @press-enter="handleSave"
          :maxlength="50"
          show-count
        />
      </div>

      <!-- 分组图标 -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2 dark:text-white">分组图标</label>
        <a-input
          v-model:value="groupIcon"
          placeholder="输入图标 URL 或 emoji（例如：😀 或 https://...）"
          :maxlength="200"
        />

        <!-- 图标预览 -->
        <div v-if="groupIcon.trim()" class="mt-2 flex items-center gap-3">
          <div class="text-sm text-gray-600 dark:text-gray-400">预览：</div>
          <div class="flex items-center gap-2">
            <CachedImage
              v-if="isImageUrl(groupIcon)"
              :src="imagePreviewUrl"
              alt="图标预览"
              class="w-8 h-8 object-contain border border-gray-200 rounded"
              @error="handleImageError"
            />
            <span v-else class="text-2xl">{{ groupIcon || '📁' }}</span>
          </div>
        </div>
      </div>

      <!-- 详细信息 -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2 dark:text-white">
          详细信息（支持 Markdown 格式）
        </label>
        <a-textarea
          v-model:value="groupDetail"
          :rows="6"
          placeholder="输入分组的详细描述信息，支持 Markdown 格式&#10;例如：&#10;- 这是一个示例分组&#10;- **重要**的表情集合&#10;- 支持链接：[示例](https://example.com)"
          :maxlength="1000"
          show-count
        />

        <!-- Markdown 预览提示 -->
        <div class="mt-2 text-xs text-gray-500 dark:text-gray-400">
          💡 支持 Markdown 语法：**粗体**、*斜体*、`代码`、[链接](url)、- 列表等
        </div>
      </div>
    </div>
  </a-modal>
</template>

<style scoped>
.space-y-4 > * + * {
  margin-top: 1rem;
}

/* 暗色模式适配 */
@media (prefers-color-scheme: dark) {
  .text-gray-700 {
    color: #e5e7eb;
  }
}

.dark .text-gray-700 {
  color: #e5e7eb;
}
</style>
