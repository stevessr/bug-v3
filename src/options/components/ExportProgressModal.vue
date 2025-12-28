<script setup lang="ts">
import { toRefs, computed, ref } from 'vue'

const props = defineProps({
  show: { type: Boolean, required: true },
  percent: { type: Number, required: true },
  currentName: { type: String, required: false },
  currentPreview: { type: String, required: false },
  previews: { type: Array as any, required: false, default: () => [] },
  names: { type: Array as any, required: false, default: () => [] }
})

const { show, percent, currentName, currentPreview, previews, names } = toRefs(props)
// carousel removed: no index tracking required

const emit = defineEmits(['close', 'cancel', 'update:show'])

const onClose = () => {
  emit('update:show', false)
  emit('close')
}
const onCancel = () => {
  emit('update:show', false)
  emit('cancel')
}

const previewList = computed(() => (previews.value || []).slice())
const nameList = computed(() => (names.value || []).slice())

const currentDisplayName = computed(() => {
  // prefer explicit currentName prop, then first item from nameList, else placeholder
  if (currentName && currentName.value) return currentName.value
  if (nameList.value && nameList.value.length > 0 && nameList.value[0]) return nameList.value[0]
  return '正在准备...'
})

const currentDisplayPreview = computed(() => {
  if (currentPreview && currentPreview.value) return currentPreview.value
  if (previewList.value && previewList.value.length > 0 && previewList.value[0])
    return previewList.value[0]
  return ''
})

const visible = ref(false)
</script>

<template>
  <div v-if="show" class="fixed inset-0 flex items-center justify-center z-50">
    <div class="bg-black/40 absolute inset-0" @click="onCancel"></div>
    <div
      class="bg-white dark:bg-gray-800 rounded shadow-lg p-4 w-96 z-10 border dark:border-gray-700"
    >
      <!-- Single preview image at the top -->
      <div>
        <div
          class="w-full max-h-64 flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded overflow-hidden p-2"
        >
          <a-image
            v-if="currentDisplayPreview"
            :src="currentDisplayPreview"
            :preview="{ visible: false }"
            @click="visible = true"
            style="max-width: 100%; max-height: 100%"
          />
          <div v-else class="text-sm text-gray-500 text-center px-2">无预览</div>
        </div>
        <div class="mt-3 text-center">
          <div class="font-medium text-gray-900 truncate">{{ currentDisplayName }}</div>
        </div>
      </div>

      <!-- Circular progress below -->
      <div class="mt-4 flex flex-col items-center justify-center">
        <a-progress type="circle" :percent="percent" :width="96" />
        <div class="mt-2 text-sm text-gray-500">{{ percent }}%</div>
      </div>

      <div class="mt-4 flex justify-end gap-2">
        <a-button class="px-3 py-1 rounded text-sm border" @click="onCancel">取消</a-button>
        <a-button class="px-3 py-1 rounded text-sm bg-blue-600 text-white" @click="onClose">
          完成
        </a-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* minimal styling; uses tailwind in project */
/* ensure ant-design image renders fully without cropping */
:deep(.ant-image-img) {
  object-fit: contain !important;
  max-width: 100% !important;
  max-height: 100% !important;
}
</style>
