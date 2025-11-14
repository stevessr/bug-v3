<script setup lang="ts">
import { ref, watch, isRef, type Ref } from 'vue'

import type { AppSettings } from '../../types/type'

const props = defineProps<{ settings: AppSettings | Ref<AppSettings> }>()
const settings = props.settings as AppSettings | Ref<AppSettings>

const emit = defineEmits([
  'update:geminiApiKey',
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
const localGeminiLanguage = ref<string>(getSetting('geminiLanguage', 'Chinese'))
const localGeminiModel = ref<string>(getSetting('geminiModel', 'gemini-flash-latest'))
const localUseCustomOpenAI = ref<boolean>(getSetting('useCustomOpenAI', false))
const localCustomOpenAIEndpoint = ref<string>(getSetting('customOpenAIEndpoint', ''))
const localCustomOpenAIKey = ref<string>(getSetting('customOpenAIKey', ''))
const localCustomOpenAIModel = ref<string>(getSetting('customOpenAIModel', ''))

// Watch for external changes
watch(
  () => getSetting('geminiApiKey', ''),
  (val: string) => {
    localGeminiApiKey.value = val
  }
)

watch(
  () => getSetting('geminiLanguage', 'Chinese'),
  (val: string) => {
    localGeminiLanguage.value = val
  }
)

watch(
  () => getSetting('geminiModel', 'gemini-flash-latest'),
  (val: string) => {
    localGeminiModel.value = val
  }
)

watch(
  () => getSetting('useCustomOpenAI', false),
  (val: boolean) => {
    localUseCustomOpenAI.value = val
  }
)

watch(
  () => getSetting('customOpenAIEndpoint', ''),
  (val: string) => {
    localCustomOpenAIEndpoint.value = val
  }
)

watch(
  () => getSetting('customOpenAIKey', ''),
  (val: string) => {
    localCustomOpenAIKey.value = val
  }
)

watch(
  () => getSetting('customOpenAIModel', ''),
  (val: string) => {
    localCustomOpenAIModel.value = val
  }
)

// Update handlers
const handleGeminiApiKeyChange = () => {
  emit('update:geminiApiKey', localGeminiApiKey.value)
}

const handleGeminiLanguageChange = (value: string) => {
  localGeminiLanguage.value = value
  emit('update:geminiLanguage', value)
}

const handleGeminiModelChange = (value: string) => {
  localGeminiModel.value = value
  emit('update:geminiModel', value)
}

const handleUseCustomOpenAIChange = (checked: boolean) => {
  localUseCustomOpenAI.value = checked
  emit('update:useCustomOpenAI', checked)
}

const handleCustomOpenAIEndpointChange = () => {
  emit('update:customOpenAIEndpoint', localCustomOpenAIEndpoint.value)
}

const handleCustomOpenAIKeyChange = () => {
  emit('update:customOpenAIKey', localCustomOpenAIKey.value)
}

const handleCustomOpenAIModelChange = () => {
  emit('update:customOpenAIModel', localCustomOpenAIModel.value)
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
              @change="handleGeminiApiKeyChange"
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
            <label class="block text-sm font-medium dark:text-white mb-2">语言偏好：</label>
            <a-select
              v-model:value="localGeminiLanguage"
              @change="handleGeminiLanguageChange"
              class="w-full"
            >
              <a-select-option value="English">English</a-select-option>
              <a-select-option value="Chinese">中文</a-select-option>
            </a-select>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">AI 生成命名时使用的语言</p>
          </div>

          <div>
            <label class="block text-sm font-medium dark:text-white mb-2">模型选择：</label>
            <a-select
              v-model:value="localGeminiModel"
              @change="handleGeminiModelChange"
              class="w-full"
            >
              <a-select-option value="gemini-2.5-pro">Gemini 2.5 Pro (最强)</a-select-option>
              <a-select-option value="gemini-flash-latest">Gemini Flash (推荐)</a-select-option>
              <a-select-option value="gemini-flash-lite-latest">Gemini Flash Lite (最快)</a-select-option>
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
          <a-switch v-model:checked="localUseCustomOpenAI" @change="handleUseCustomOpenAIChange" />
        </div>

        <div v-if="localUseCustomOpenAI" class="space-y-3 pl-4 border-l-2 border-blue-200">
          <div>
            <label class="block text-sm font-medium dark:text-white mb-2">API 端点：</label>
            <a-input
              v-model:value="localCustomOpenAIEndpoint"
              placeholder="https://api.openai.com/v1"
              @change="handleCustomOpenAIEndpointChange"
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
              @change="handleCustomOpenAIKeyChange"
              class="w-full"
            />
          </div>

          <div>
            <label class="block text-sm font-medium dark:text-white mb-2">模型名称：</label>
            <a-input
              v-model:value="localCustomOpenAIModel"
              placeholder="gpt-4o-mini"
              @change="handleCustomOpenAIModelChange"
              class="w-full"
            />
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
              例如：gpt-4o-mini, gpt-4, gpt-3.5-turbo
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
