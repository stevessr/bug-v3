<script setup lang="ts">
import { ref, isRef, type Ref } from 'vue'

import type { AppSettings } from '../../types/type'

const props = defineProps<{ settings: AppSettings | Ref<AppSettings> }>()
const emit = defineEmits(['update:customCss'])

const showCustomCssEditor = ref(false)
const localCustomCss = ref('')

const openCustomCssEditor = () => {
  const currentSettings = isRef(props.settings) ? props.settings.value : props.settings
  localCustomCss.value = (currentSettings as any).customCss || ''
  showCustomCssEditor.value = true
}

const saveCustomCss = () => {
  emit('update:customCss', localCustomCss.value)
  showCustomCssEditor.value = false
}

const cancelCustomCss = () => {
  const currentSettings = isRef(props.settings) ? props.settings.value : props.settings
  localCustomCss.value = (currentSettings as any).customCss || ''
  showCustomCssEditor.value = false
}
</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700">
    <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
      <h2 class="text-lg font-semibold dark:text-white">自定义 CSS</h2>
    </div>
    <div class="p-6 space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <label class="text-sm font-medium text-gray-900 dark:text-white">自定义 CSS</label>
          <p class="text-sm text-gray-500 dark:text-white">
            向页面注入自定义 CSS（仅在支持的平台注入）
          </p>
        </div>
        <div>
          <a-button @click="openCustomCssEditor" title="打开自定义 CSS 编辑器">
            管理自定义 CSS
          </a-button>
        </div>
      </div>

      <!-- Custom CSS editor modal -->
      <div v-if="showCustomCssEditor" class="fixed inset-0 flex items-center justify-center z-50">
        <div
          class="fixed inset-0 bg-black bg-opacity-50"
          @click="cancelCustomCss"
          title="点击关闭"
        ></div>
        <div
          class="bg-white dark:bg-gray-800 rounded-lg shadow-lg w-3/4 max-w-3xl p-4 relative z-10"
        >
          <h3 class="text-lg font-semibold dark:text-white mb-2">编辑自定义 CSS</h3>
          <textarea
            v-model="localCustomCss"
            rows="10"
            class="w-full p-2 border rounded dark:bg-gray-900 dark:text-white font-mono"
            title="自定义 CSS 内容"
          ></textarea>
          <div class="mt-3 flex justify-end gap-2">
            <a-button @click="cancelCustomCss" title="取消自定义 CSS 更改">取消</a-button>
            <a-button type="primary" @click="saveCustomCss" title="保存并注入自定义 CSS">
              保存并注入
            </a-button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
