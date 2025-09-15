<script setup lang="ts">
import { ref } from 'vue'
import { DownOutlined } from '@ant-design/icons-vue'

import { useEmojiStore } from '../../stores/emojiStore'
import { importConfigurationToStore, importEmojisToStore } from '../utils/importUtils'

const emojiStore = useEmojiStore()

// Refs
const configFileInput = ref<HTMLInputElement>()
const emojiFileInput = ref<HTMLInputElement>()
const showTargetGroupSelector = ref(false)
const selectedTargetGroup = ref('')
const selectedTargetGroupForMarkdown = ref('')
const markdownText = ref('')
const isImporting = ref(false)
const importStatus = ref('')
const importResults = ref<{ success: boolean; message: string; details?: string } | null>(null)

const onSelectedTargetGroup = (info: { key: string | number }) => {
  selectedTargetGroup.value = String(info.key)
}

const onSelectedTargetGroupForMarkdown = (info: { key: string | number }) => {
  selectedTargetGroupForMarkdown.value = String(info.key)
}

// Methods
const openImportConfig = () => {
  configFileInput.value?.click()
}

const openImportEmojis = () => {
  showTargetGroupSelector.value = true
  emojiFileInput.value?.click()
}

const handleConfigFileSelect = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  isImporting.value = true
  importStatus.value = '正在读取配置文件...'
  importResults.value = null

  try {
    const text = await file.text()
    const config = JSON.parse(text)

    importStatus.value = '正在导入配置...'
    await importConfigurationToStore(config)

    importResults.value = {
      success: true,
      message: '配置导入成功',
      details: `已导入 ${config.groups?.length || 0} 个分组`
    }
  } catch (error) {
    importResults.value = {
      success: false,
      message: '配置导入失败',
      details: error instanceof Error ? error.message : '未知错误'
    }
  } finally {
    isImporting.value = false
    target.value = ''
  }
}

const handleEmojiFileSelect = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  isImporting.value = true
  importStatus.value = '正在读取表情文件...'
  importResults.value = null

  try {
    const text = await file.text()
    let data

    if (file.name.endsWith('.json')) {
      data = JSON.parse(text)
    } else {
      // Treat as markdown text
      data = text
    }

    importStatus.value = '正在导入表情...'
    await importEmojisToStore(data, selectedTargetGroup.value || undefined)

    const count = Array.isArray(data) ? data.length : data.emojis?.length || '未知数量'
    importResults.value = {
      success: true,
      message: '表情导入成功',
      details: `已导入 ${count} 个表情`
    }
  } catch (error) {
    importResults.value = {
      success: false,
      message: '表情导入失败',
      details: error instanceof Error ? error.message : '未知错误'
    }
  } finally {
    isImporting.value = false
    showTargetGroupSelector.value = false
    selectedTargetGroup.value = ''
    target.value = ''
  }
}

const importFromMarkdown = async () => {
  if (!markdownText.value.trim()) return

  isImporting.value = true
  importStatus.value = '正在解析Markdown文本...'
  importResults.value = null

  try {
    await importEmojisToStore(markdownText.value, selectedTargetGroupForMarkdown.value || undefined)

    // Count emojis in markdown
    const matches = markdownText.value.match(/!\[([^\]]*)\]\(([^)]+)\)/g)
    const count = matches?.length || 0

    importResults.value = {
      success: true,
      message: '从文本导入成功',
      details: `已导入 ${count} 个表情`
    }

    markdownText.value = ''
  } catch (error) {
    importResults.value = {
      success: false,
      message: '从文本导入失败',
      details: error instanceof Error ? error.message : '未知错误'
    }
  } finally {
    isImporting.value = false
    selectedTargetGroupForMarkdown.value = ''
  }
}
</script>

<template>
  <div class="space-y-8">
    <div class="bg-white dark:bg-gray-800 shadow rounded-lg">
      <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
  <h3 class="text-lg font-medium text-gray-900 dark:text-white">外部表情导入</h3>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">从外部来源导入表情包或配置文件</p>
      </div>
      <div class="p-6 space-y-6">
        <!-- Import Configuration Section -->
        <div class="border dark:border-gray-600 rounded-lg p-4">
          <h4 class="text-md font-medium text-gray-900 dark:text-white mb-3">导入配置文件</h4>
          <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
            导入之前导出的完整配置文件，包含所有分组、表情和设置
          </p>
          <div class="flex items-center space-x-3">
            <button
              @click="openImportConfig"
              class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              选择配置文件
            </button>
            <input
              ref="configFileInput"
              type="file"
              accept=".json"
              class="hidden"
              @change="handleConfigFileSelect"
            />
          </div>
        </div>

        <!-- Import Emojis Section -->
        <div class="border dark:border-gray-600 rounded-lg p-4">
          <h4 class="text-md font-medium text-gray-900 dark:text-white mb-3">导入表情包</h4>
          <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
            导入单个表情包文件或包含多个表情的JSON文件
          </p>
          <div class="space-y-4">
            <div class="flex items-center space-x-3">
              <button
                @click="openImportEmojis"
                class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
                选择表情文件
              </button>
              <input
                ref="emojiFileInput"
                type="file"
                accept=".json,.txt"
                class="hidden"
                @change="handleEmojiFileSelect"
              />
            </div>

            <!-- Target group selection -->
            <div v-if="showTargetGroupSelector" class="flex items-center space-x-3">
              <label class="text-sm font-medium text-gray-700">目标分组:</label>
              <a-dropdown>
                <template #overlay>
                  <a-menu @click="onSelectedTargetGroup">
                    <a-menu-item key="">自动创建分组</a-menu-item>
                    <a-menu-item
                      v-for="group in emojiStore.groups"
                      :key="group.id"
                      :value="group.id"
                    >
                      {{ group.name }}
                    </a-menu-item>
                  </a-menu>
                </template>
                <AButton>
                  {{ selectedTargetGroup || '自动创建分组' }}
                  <DownOutlined />
                </AButton>
              </a-dropdown>
            </div>
          </div>
        </div>

        <!-- Import from Text Section -->
        <div class="border dark:border-gray-600 rounded-lg p-4">
          <h4 class="text-md font-medium text-gray-900 dark:text-white mb-3">从文本导入</h4>
          <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
            从Markdown格式文本导入表情，支持 ![名称](URL) 格式
          </p>
          <div class="space-y-4">
            <textarea
              v-model="markdownText"
              placeholder="粘贴包含 ![表情名](表情URL) 格式的文本..."
              class="w-full h-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-black text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            ></textarea>
            <div class="flex items-center space-x-3">
              <button
                @click="importFromMarkdown"
                :disabled="!markdownText.trim()"
                class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                  />
                </svg>
                导入文本中的表情
              </button>
              <a-dropdown>
                <template #overlay>
                  <a-menu @click="onSelectedTargetGroupForMarkdown">
                    <a-menu-item key="">自动创建分组</a-menu-item>
                    <a-menu-item
                      v-for="group in emojiStore.groups"
                      :key="group.id"
                      :value="group.id"
                    >
                      {{ group.name }}
                    </a-menu-item>
                  </a-menu>
                </template>
                <AButton>
                  {{ selectedTargetGroupForMarkdown || '自动创建分组' }}
                  <DownOutlined />
                </AButton>
              </a-dropdown>
            </div>
          </div>
        </div>

        <!-- Import Progress -->
        <div v-if="isImporting" class="border rounded-lg p-4 bg-blue-50">
          <div class="flex items-center">
            <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500 mr-3"></div>
            <span class="text-sm text-blue-700">{{ importStatus }}</span>
          </div>
        </div>

        <!-- Import Results -->
        <div
          v-if="importResults"
          class="border rounded-lg p-4"
          :class="importResults.success ? 'bg-green-50' : 'bg-red-50'"
        >
          <div class="flex items-start">
            <svg
              v-if="importResults.success"
              class="w-5 h-5 text-green-500 mr-3 mt-0.5"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fill-rule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clip-rule="evenodd"
              />
            </svg>
            <svg
              v-else
              class="w-5 h-5 text-red-500 mr-3 mt-0.5"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fill-rule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clip-rule="evenodd"
              />
            </svg>
            <div class="flex-1">
              <p
                :class="importResults.success ? 'text-green-700' : 'text-red-700'"
                class="text-sm font-medium"
              >
                {{ importResults.message }}
              </p>
              <p
                v-if="importResults.details"
                :class="importResults.success ? 'text-green-600' : 'text-red-600'"
                class="text-sm mt-1"
              >
                {{ importResults.details }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
