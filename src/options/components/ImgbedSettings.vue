<script setup lang="ts">
import { computed, type Ref } from 'vue'

import type { AppSettings } from '../../types/type'
import { useSettingsForm } from '../composables/useSettingsForm'

const props = defineProps<{ settings: AppSettings | Ref<AppSettings> }>()

const emit = defineEmits(['update:imgbedToken', 'update:imgbedApiUrl'])

// Use the settings form composable
const { localValues, hasChanges, isValid, isSaving, handleSave, handleReset } = useSettingsForm(
  props.settings,
  [
    { key: 'imgbedToken', default: '' },
    { key: 'imgbedApiUrl', default: '' }
  ],
  emit as (event: string, ...args: any[]) => void,
  {
    successMessage: '图床配置已保存',
    validate: (): { valid: boolean; error?: string } => {
      // Both fields should be filled or both should be empty
      const hasToken: boolean = (localValues.imgbedToken.value as string).trim().length > 0
      const hasUrl: boolean = (localValues.imgbedApiUrl.value as string).trim().length > 0
      const valid: boolean = (hasToken && hasUrl) || (!hasToken && !hasUrl)

      return {
        valid,
        error: valid ? undefined : '请同时填写 API URL 和 Token，或同时留空'
      }
    }
  }
)

// Destructure local values for easier access in template
const localImgbedToken = computed({
  get: () => localValues.imgbedToken.value,
  set: val => {
    localValues.imgbedToken.value = val
  }
})

const localImgbedApiUrl = computed({
  get: () => localValues.imgbedApiUrl.value,
  set: val => {
    localValues.imgbedApiUrl.value = val
  }
})
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
          :disabled="!hasChanges || !isValid"
          :title="hasChanges && isValid ? '保存配置 (Ctrl/Cmd+S)' : ''"
        >
          保存配置
        </a-button>
      </div>
    </div>
  </div>
</template>
