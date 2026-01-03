<script setup lang="ts">
import { computed, type Ref } from 'vue'

import type { AppSettings } from '../../types/type'
import { useSettingsForm } from '../composables/useSettingsForm'

const props = defineProps<{ settings: AppSettings | Ref<AppSettings> }>()

const emit = defineEmits([
  'update:geminiApiKey',
  'update:geminiApiUrl',
  'update:geminiLanguage',
  'update:geminiModel',
  'update:useCustomOpenAI',
  'update:customOpenAIEndpoint',
  'update:customOpenAIKey',
  'update:customOpenAIModel',
  'update:aiConcurrency'
])

// Use the settings form composable
const { localValues, hasChanges, isValid, isSaving, handleSave, handleReset } = useSettingsForm(
  props.settings,
  [
    { key: 'geminiApiKey', default: '' },
    { key: 'geminiApiUrl', default: '' },
    { key: 'geminiLanguage', default: 'Chinese' },
    { key: 'geminiModel', default: 'gemini-flash-latest' },
    { key: 'useCustomOpenAI', default: false },
    { key: 'customOpenAIEndpoint', default: '' },
    { key: 'customOpenAIKey', default: '' },
    { key: 'customOpenAIModel', default: '' },
    { key: 'aiConcurrency', default: 5 }
  ],
  emit as (event: string, ...args: any[]) => void,
  {
    successMessage: 'AI 配置已保存',
    validate: () => {
      // If using custom OpenAI, validate those fields
      if (localValues.useCustomOpenAI.value) {
        const hasEndpoint = (localValues.customOpenAIEndpoint.value as string).trim().length > 0
        const hasKey = (localValues.customOpenAIKey.value as string).trim().length > 0
        const hasModel = (localValues.customOpenAIModel.value as string).trim().length > 0

        if (!hasEndpoint || !hasKey || !hasModel) {
          return {
            valid: false,
            error: '使用自定义 OpenAI 时，请填写完整的端点、Key 和模型名称'
          }
        }
      }
      return { valid: true }
    }
  }
)

// Create computed properties for easier template access
const localGeminiApiKey = computed({
  get: () => localValues.geminiApiKey.value as string,
  set: val => {
    localValues.geminiApiKey.value = val
  }
})

const localGeminiApiUrl = computed({
  get: () => localValues.geminiApiUrl.value as string,
  set: val => {
    localValues.geminiApiUrl.value = val
  }
})

const localGeminiLanguage = computed({
  get: () => localValues.geminiLanguage.value as string,
  set: val => {
    localValues.geminiLanguage.value = val
  }
})

const localGeminiModel = computed({
  get: () => localValues.geminiModel.value as string,
  set: val => {
    localValues.geminiModel.value = val
  }
})

const localUseCustomOpenAI = computed({
  get: () => localValues.useCustomOpenAI.value as boolean,
  set: val => {
    localValues.useCustomOpenAI.value = val
  }
})

const localCustomOpenAIEndpoint = computed({
  get: () => localValues.customOpenAIEndpoint.value as string,
  set: val => {
    localValues.customOpenAIEndpoint.value = val
  }
})

const localCustomOpenAIKey = computed({
  get: () => localValues.customOpenAIKey.value as string,
  set: val => {
    localValues.customOpenAIKey.value = val
  }
})

const localCustomOpenAIModel = computed({
  get: () => localValues.customOpenAIModel.value as string,
  set: val => {
    localValues.customOpenAIModel.value = val
  }
})

const localAiConcurrency = computed({
  get: () => localValues.aiConcurrency.value as number,
  set: val => {
    localValues.aiConcurrency.value = val
  }
})
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

      <!-- Concurrency Settings -->
      <div class="pt-4 border-t border-gray-200 dark:border-gray-700 space-y-4">
        <h3 class="text-md font-medium dark:text-white">请求设置</h3>
        <div>
          <label class="block text-sm font-medium dark:text-white mb-2">并发数：</label>
          <div class="flex items-center gap-4">
            <a-slider
              v-model:value="localAiConcurrency"
              :min="1"
              :max="100"
              :step="1"
              class="flex-1"
            />
            <span class="w-8 text-center font-medium dark:text-white">
              {{ localAiConcurrency }}
            </span>
          </div>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
            同时发送的 AI 请求数量（1-10），数值越大速度越快，但可能触发 API 限流
          </p>
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
