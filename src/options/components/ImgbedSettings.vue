<script setup lang="ts">
import { ref, watch, isRef, computed, type Ref } from 'vue'
import { message } from 'ant-design-vue'

import type { AppSettings } from '../../types/type'

const props = defineProps<{ settings: AppSettings | Ref<AppSettings> }>()
const settings = props.settings as AppSettings | Ref<AppSettings>

const emit = defineEmits(['update:imgbedToken', 'update:imgbedApiUrl'])

// Helper function to get setting value
const getSetting = (key: keyof AppSettings, defaultValue: any = '') => {
  try {
    if (isRef(settings)) return (settings.value && settings.value[key]) ?? defaultValue
    return (settings && (settings as AppSettings)[key]) ?? defaultValue
  } catch {
    return defaultValue
  }
}

// Local state for form fields
const localImgbedToken = ref<string>(getSetting('imgbedToken', ''))
const localImgbedApiUrl = ref<string>(getSetting('imgbedApiUrl', ''))

// UI state
const isSaving = ref(false)
const hasChanges = ref(false)

// Watch for external changes
watch(
  () => getSetting('imgbedToken', ''),
  (val: string) => {
    if (!hasChanges.value) {
      localImgbedToken.value = val
    }
  }
)

watch(
  () => getSetting('imgbedApiUrl', ''),
  (val: string) => {
    if (!hasChanges.value) {
      localImgbedApiUrl.value = val
    }
  }
)

// Watch for local changes to detect if form has been modified
watch([localImgbedToken, localImgbedApiUrl], () => {
  hasChanges.value =
    localImgbedToken.value !== getSetting('imgbedToken', '') ||
    localImgbedApiUrl.value !== getSetting('imgbedApiUrl', '')
})

// Validation
const isValidConfig = computed(() => {
  // Both fields should be filled or both should be empty
  const hasToken = localImgbedToken.value.trim().length > 0
  const hasUrl = localImgbedApiUrl.value.trim().length > 0
  return (hasToken && hasUrl) || (!hasToken && !hasUrl)
})

// Save handler
const handleSave = async () => {
  if (!isValidConfig.value) {
    message.error('请同时填写 API URL 和 Token，或同时留空')
    return
  }

  isSaving.value = true
  try {
    emit('update:imgbedToken', localImgbedToken.value)
    emit('update:imgbedApiUrl', localImgbedApiUrl.value)
    hasChanges.value = false
    message.success('图床配置已保存')
  } catch (error) {
    console.error('Failed to save imgbed config:', error)
    message.error('保存失败：' + (error as Error).message)
  } finally {
    isSaving.value = false
  }
}

// Reset handler
const handleReset = () => {
  localImgbedToken.value = getSetting('imgbedToken', '')
  localImgbedApiUrl.value = getSetting('imgbedApiUrl', '')
  hasChanges.value = false
}
</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700">
    <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
      <h2 class="text-lg font-semibold dark:text-white">图床 API 配置</h2>
      <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">配置图床服务用于图片上传和托管</p>
    </div>

    <div class="p-6 space-y-6">
      <!-- Imgbed Configuration -->
      <div class="space-y-4">
        <h3 class="text-md font-medium dark:text-white">Imgbed API</h3>
        <div class="space-y-3">
          <div>
            <label class="block text-sm font-medium dark:text-white mb-2">API URL:</label>
            <a-input
              v-model:value="localImgbedApiUrl"
              placeholder="输入你的 Imgbed API URL"
              class="w-full"
            />
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">图床服务的 API 地址</p>
          </div>
          <div>
            <label class="block text-sm font-medium dark:text-white mb-2">Token:</label>
            <a-input
              v-model:value="localImgbedToken"
              type="password"
              placeholder="输入你的 Imgbed Token"
              class="w-full"
            />
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">用于认证的访问令牌</p>
          </div>
        </div>
      </div>

      <!-- Action Buttons -->
      <div
        class="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700"
      >
        <a-button @click="handleReset" :disabled="!hasChanges || isSaving">重置</a-button>
        <a-button
          type="primary"
          @click="handleSave"
          :loading="isSaving"
          :disabled="!hasChanges || !isValidConfig"
        >
          保存配置
        </a-button>
      </div>
    </div>
  </div>
</template>
