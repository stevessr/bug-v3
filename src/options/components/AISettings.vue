<script setup lang="ts">
import { ref, watch, isRef, computed, type Ref } from 'vue'
import { message } from 'ant-design-vue'

import type { AppSettings } from '../../types/type'

const props = defineProps<{ settings: AppSettings | Ref<AppSettings> }>()
const settings = props.settings as AppSettings | Ref<AppSettings>

const emit = defineEmits([
  'update:geminiApiKey',
  'update:geminiApiUrl',
  'update:geminiLanguage',
  'update:geminiModel',
  'update:useCustomOpenAI',
  'update:customOpenAIEndpoint',
  'update:customOpenAIKey',
  'update:customOpenAIModel'
])

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
const localGeminiApiKey = ref<string>(getSetting('geminiApiKey', ''))
const localGeminiApiUrl = ref<string>(getSetting('geminiApiUrl', ''))
const localGeminiLanguage = ref<string>(getSetting('geminiLanguage', 'Chinese'))
const localGeminiModel = ref<string>(getSetting('geminiModel', 'gemini-flash-latest'))
const localUseCustomOpenAI = ref<boolean>(getSetting('useCustomOpenAI', false))
const localCustomOpenAIEndpoint = ref<string>(getSetting('customOpenAIEndpoint', ''))
const localCustomOpenAIKey = ref<string>(getSetting('customOpenAIKey', ''))
const localCustomOpenAIModel = ref<string>(getSetting('customOpenAIModel', ''))

// UI state
const isSaving = ref(false)
const hasChanges = ref(false)

// Watch for external changes (only update if no unsaved changes)
watch(
  () => getSetting('geminiApiKey', ''),
  (val: string) => {
    if (!hasChanges.value) {
      localGeminiApiKey.value = val
    }
  }
)

watch(
  () => getSetting('geminiApiUrl', ''),
  (val: string) => {
    if (!hasChanges.value) {
      localGeminiApiUrl.value = val
    }
  }
)

watch(
  () => getSetting('geminiLanguage', 'Chinese'),
  (val: string) => {
    if (!hasChanges.value) {
      localGeminiLanguage.value = val
    }
  }
)

watch(
  () => getSetting('geminiModel', 'gemini-flash-latest'),
  (val: string) => {
    if (!hasChanges.value) {
      localGeminiModel.value = val
    }
  }
)

watch(
  () => getSetting('useCustomOpenAI', false),
  (val: boolean) => {
    if (!hasChanges.value) {
      localUseCustomOpenAI.value = val
    }
  }
)

watch(
  () => getSetting('customOpenAIEndpoint', ''),
  (val: string) => {
    if (!hasChanges.value) {
      localCustomOpenAIEndpoint.value = val
    }
  }
)

watch(
  () => getSetting('customOpenAIKey', ''),
  (val: string) => {
    if (!hasChanges.value) {
      localCustomOpenAIKey.value = val
    }
  }
)

watch(
  () => getSetting('customOpenAIModel', ''),
  (val: string) => {
    if (!hasChanges.value) {
      localCustomOpenAIModel.value = val
    }
  }
)

// Watch for local changes to detect if form has been modified
watch(
  [
    localGeminiApiKey,
    localGeminiApiUrl,
    localGeminiLanguage,
    localGeminiModel,
    localUseCustomOpenAI,
    localCustomOpenAIEndpoint,
    localCustomOpenAIKey,
    localCustomOpenAIModel
  ],
  () => {
    hasChanges.value =
      localGeminiApiKey.value !== getSetting('geminiApiKey', '') ||
      localGeminiApiUrl.value !== getSetting('geminiApiUrl', '') ||
      localGeminiLanguage.value !== getSetting('geminiLanguage', 'Chinese') ||
      localGeminiModel.value !== getSetting('geminiModel', 'gemini-flash-latest') ||
      localUseCustomOpenAI.value !== getSetting('useCustomOpenAI', false) ||
      localCustomOpenAIEndpoint.value !== getSetting('customOpenAIEndpoint', '') ||
      localCustomOpenAIKey.value !== getSetting('customOpenAIKey', '') ||
      localCustomOpenAIModel.value !== getSetting('customOpenAIModel', '')
  }
)

// Validation
const isValidConfig = computed(() => {
  // If using custom OpenAI, validate those fields
  if (localUseCustomOpenAI.value) {
    const hasEndpoint = localCustomOpenAIEndpoint.value.trim().length > 0
    const hasKey = localCustomOpenAIKey.value.trim().length > 0
    const hasModel = localCustomOpenAIModel.value.trim().length > 0
    // All three fields should be filled if using custom OpenAI
    if (!hasEndpoint || !hasKey || !hasModel) {
      return false
    }
  }
  // Always valid for Gemini (fields are optional)
  return true
})

// Save handler
const handleSave = async () => {
  if (!isValidConfig.value) {
    message.error('使用自定义 OpenAI 时，请填写完整的端点、Key 和模型名称')
    return
  }

  isSaving.value = true
  try {
    emit('update:geminiApiKey', localGeminiApiKey.value)
    emit('update:geminiApiUrl', localGeminiApiUrl.value)
    emit('update:geminiLanguage', localGeminiLanguage.value)
    emit('update:geminiModel', localGeminiModel.value)
    emit('update:useCustomOpenAI', localUseCustomOpenAI.value)
    emit('update:customOpenAIEndpoint', localCustomOpenAIEndpoint.value)
    emit('update:customOpenAIKey', localCustomOpenAIKey.value)
    emit('update:customOpenAIModel', localCustomOpenAIModel.value)
    hasChanges.value = false
    message.success('AI 配置已保存')
  } catch (error) {
    console.error('Failed to save AI config:', error)
    message.error('保存失败：' + (error as Error).message)
  } finally {
    isSaving.value = false
  }
}

// Reset handler
const handleReset = () => {
  localGeminiApiKey.value = getSetting('geminiApiKey', '')
  localGeminiApiUrl.value = getSetting('geminiApiUrl', '')
  localGeminiLanguage.value = getSetting('geminiLanguage', 'Chinese')
  localGeminiModel.value = getSetting('geminiModel', 'gemini-flash-latest')
  localUseCustomOpenAI.value = getSetting('useCustomOpenAI', false)
  localCustomOpenAIEndpoint.value = getSetting('customOpenAIEndpoint', '')
  localCustomOpenAIKey.value = getSetting('customOpenAIKey', '')
  localCustomOpenAIModel.value = getSetting('customOpenAIModel', '')
  hasChanges.value = false
}
</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700">
    <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
      <h2 class="text-lg font-semibold dark:text-white">AI 配置</h2>
      <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
        配置 AI 服务用于智能命名和批量处理
      </p>
    </div>

    <div class="p-6 space-y-6">
      <!-- Gemini API Configuration -->
      <div class="space-y-4">
        <h3 class="text-md font-medium dark:text-white">Google Gemini API</h3>

        <div class="space-y-3">
          <div>
            <label class="block text-sm font-medium dark:text-white mb-2">API Key:</label>
            <a-input
              v-model:value="localGeminiApiKey"
              type="password"
              placeholder="输入你的 Gemini API Key"
              class="w-full"
            />
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
              获取 API Key:
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                class="text-blue-500 hover:underline"
              >
                Google AI Studio
              </a>
            </p>
          </div>

          <div>
            <label class="block text-sm font-medium dark:text-white mb-2">
              API Base URL (可选):
            </label>
            <a-input
              v-model:value="localGeminiApiUrl"
              placeholder="https://generativelanguage.googleapis.com"
              class="w-full"
            />
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
              自定义 API 基础地址，用于反代或企业部署
            </p>
          </div>

          <div>
            <label class="block text-sm font-medium dark:text-white mb-2">语言偏好：</label>
            <a-select v-model:value="localGeminiLanguage" class="w-full">
              <a-select-option value="English">English</a-select-option>
              <a-select-option value="Chinese">中文</a-select-option>
            </a-select>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">AI 生成命名时使用的语言</p>
          </div>

          <div>
            <label class="block text-sm font-medium dark:text-white mb-2">模型选择：</label>
            <a-select v-model:value="localGeminiModel" class="w-full">
              <a-select-option value="gemini-3-pro-preview">Gemini 3 Pro Preview</a-select-option>
              <a-select-option value="gemini-robotics-er-1.5-preview">
                Gemini Robotics (对象检测)
              </a-select-option>
              <a-select-option value="gemini-2.5-pro">Gemini 2.5 Pro (最强)</a-select-option>
              <a-select-option value="gemini-flash-latest">Gemini Flash (推荐)</a-select-option>
              <a-select-option value="gemini-flash-lite-latest">
                Gemini Flash Lite (最快)
              </a-select-option>
            </a-select>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Pro: 最强性能 | Flash: 速度与性能平衡 | Flash Lite: 最快速度
            </p>
          </div>
        </div>
      </div>

      <!-- Custom OpenAI Provider -->
      <div class="pt-4 border-t border-gray-200 dark:border-gray-700 space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-md font-medium dark:text-white">自定义 OpenAI 兼容服务</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
              使用兼容 OpenAI API 的第三方服务（如 OpenAI、Azure OpenAI、本地部署等）
            </p>
          </div>
          <a-switch v-model:checked="localUseCustomOpenAI" />
        </div>

        <div v-if="localUseCustomOpenAI" class="space-y-3 pl-4 border-l-2 border-blue-200">
          <div>
            <label class="block text-sm font-medium dark:text-white mb-2">API 端点：</label>
            <a-input
              v-model:value="localCustomOpenAIEndpoint"
              placeholder="https://api.openai.com/v1"
              class="w-full"
            />
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">OpenAI 兼容的 API 端点地址</p>
          </div>

          <div>
            <label class="block text-sm font-medium dark:text-white mb-2">API Key:</label>
            <a-input
              v-model:value="localCustomOpenAIKey"
              type="password"
              placeholder="输入 API Key"
              class="w-full"
            />
          </div>

          <div>
            <label class="block text-sm font-medium dark:text-white mb-2">模型名称：</label>
            <a-input
              v-model:value="localCustomOpenAIModel"
              placeholder="gpt-4o-mini"
              class="w-full"
            />
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
              例如：gpt-4o-mini, gpt-4, gpt-3.5-turbo
            </p>
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
