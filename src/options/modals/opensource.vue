<script setup lang="ts">
import { ref } from 'vue'
import {
  GithubOutlined,
  CloudUploadOutlined,
  DownloadOutlined,
  SwapOutlined,
  ExportOutlined,
  FileAddOutlined,
  FileImageOutlined,
  ClearOutlined,
  FileTextOutlined,
  DownOutlined
} from '@ant-design/icons-vue'

import { useEmojiStore } from '../../stores/emojiStore'
import { importConfigurationToStore, importEmojisToStore } from '../utils/importUtils'

const emojiStore = useEmojiStore()

const emit = defineEmits([
  'resetSettings',
  'syncToChrome',
  'forceLocalToExtension',
  'exportConfiguration'
])
void emit // Used in template

const handleClick = () => {
  try {
    window.open('https://github.com/stevessr/bug-v3/', '_blank')
  } catch {
    window.location.href = 'https://github.com/stevessr/bug-v3/'
  }
}

// Import functionality
const configFileInput = ref<HTMLInputElement>()
const emojiFileInput = ref<HTMLInputElement>()
const showTargetGroupSelector = ref(false)
const showMarkdownDialog = ref(false)
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

// Import config file
const openImportConfig = () => {
  configFileInput.value?.click()
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

    // Auto-hide after 3 seconds
    setTimeout(() => {
      importResults.value = null
    }, 3000)
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

// Import emoji file
const openImportEmojis = () => {
  showTargetGroupSelector.value = true
  emojiFileInput.value?.click()
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

    // Auto-hide after 3 seconds
    setTimeout(() => {
      importResults.value = null
    }, 3000)
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

// Import from markdown text
const openMarkdownDialog = () => {
  showMarkdownDialog.value = true
  markdownText.value = ''
  selectedTargetGroupForMarkdown.value = ''
  importResults.value = null
}

const closeMarkdownDialog = () => {
  showMarkdownDialog.value = false
  markdownText.value = ''
  selectedTargetGroupForMarkdown.value = ''
}

const importFromMarkdown = async () => {
  if (!markdownText.value.trim()) return

  isImporting.value = true
  importStatus.value = '正在解析 Markdown 文本...'
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

    // Auto-close and hide after 2 seconds
    setTimeout(() => {
      importResults.value = null
      showMarkdownDialog.value = false
    }, 2000)
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

// Cloud sync functionality methods
const uploadToCloudSync = async () => {
  try {
    // Check if sync is configured
    if (!emojiStore.isSyncConfigured()) {
      importResults.value = {
        success: false,
        message: '同步未配置',
        details: '请先在设置页面配置云同步参数'
      }
      setTimeout(() => {
        importResults.value = null
      }, 5000)
      return
    }

    isImporting.value = true
    importStatus.value = '正在上传配置到云端...'
    importResults.value = null

    const result = await emojiStore.pushToCloudflare()

    if (result.success) {
      importResults.value = {
        success: true,
        message: '上传成功',
        details: result.message || '配置已成功上传到云端'
      }
    } else {
      importResults.value = {
        success: false,
        message: '上传失败',
        details: result.message || '上传到云端时发生错误'
      }
    }
  } catch (error) {
    importResults.value = {
      success: false,
      message: '上传失败',
      details: error instanceof Error ? error.message : '未知错误'
    }
  } finally {
    isImporting.value = false
    setTimeout(() => {
      importResults.value = null
    }, 3000)
  }
}

const pullFromCloudSync = async () => {
  try {
    // Check if sync is configured
    if (!emojiStore.isSyncConfigured()) {
      importResults.value = {
        success: false,
        message: '同步未配置',
        details: '请先在设置页面配置云同步参数'
      }
      setTimeout(() => {
        importResults.value = null
      }, 5000)
      return
    }

    isImporting.value = true
    importStatus.value = '正在从云端拉取配置...'
    importResults.value = null

    const result = await emojiStore.pullFromCloudflare()

    if (result.success) {
      importResults.value = {
        success: true,
        message: '拉取成功',
        details: result.message || '配置已成功从云端拉取'
      }
    } else {
      importResults.value = {
        success: false,
        message: '拉取失败',
        details: result.message || '从云端拉取时发生错误'
      }
    }
  } catch (error) {
    importResults.value = {
      success: false,
      message: '拉取失败',
      details: error instanceof Error ? error.message : '未知错误'
    }
  } finally {
    isImporting.value = false
    setTimeout(() => {
      importResults.value = null
    }, 3000)
  }
}
</script>

<template>
  <div class="opensource-root">
    <!-- Hidden file inputs -->
    <input
      ref="configFileInput"
      type="file"
      accept=".json"
      class="hidden"
      @change="handleConfigFileSelect"
    />
    <input
      ref="emojiFileInput"
      type="file"
      accept=".json,.txt"
      class="hidden"
      @change="handleEmojiFileSelect"
    />

    <!-- Floating buttons -->
    <a-float-button-group trigger="hover" type="primary">
      <a-float-button type="default" tooltip="开源地址" @click="handleClick">
        <template #icon>
          <GithubOutlined />
        </template>
      </a-float-button>
      <a-float-button tooltip="导入配置" type="default" @click="openImportConfig">
        <template #icon>
          <FileAddOutlined />
        </template>
      </a-float-button>
      <a-float-button tooltip="导入表情" type="default" @click="openImportEmojis">
        <template #icon>
          <FileImageOutlined />
        </template>
      </a-float-button>
      <a-float-button tooltip="从文本导入" type="default" @click="openMarkdownDialog">
        <template #icon>
          <FileTextOutlined />
        </template>
      </a-float-button>
      <a-float-button tooltip="重置设置" type="default" @click="$emit('resetSettings')">
        <template #icon>
          <ClearOutlined />
        </template>
      </a-float-button>
      <a-float-button tooltip="上传到云端同步" type="default" @click="uploadToCloudSync">
        <template #icon>
          <CloudUploadOutlined />
        </template>
      </a-float-button>
      <a-float-button tooltip="从云端拉取" type="default" @click="pullFromCloudSync">
        <template #icon>
          <DownloadOutlined />
        </template>
      </a-float-button>
      <a-float-button
        tooltip="强制本地同步到扩展存储"
        type="default"
        @click="$emit('forceLocalToExtension')"
      >
        <template #icon>
          <SwapOutlined />
        </template>
      </a-float-button>
      <a-float-button tooltip="导出配置" type="default" @click="$emit('exportConfiguration')">
        <template #icon>
          <ExportOutlined />
        </template>
      </a-float-button>
    </a-float-button-group>

    <!-- Target group selector for emoji file import -->
    <a-modal
      v-model:open="showTargetGroupSelector"
      title="选择目标分组"
      @ok="showTargetGroupSelector = false"
      @cancel="showTargetGroupSelector = false"
    >
      <div class="p-4">
        <label class="block text-sm font-medium text-gray-700 dark:text-white mb-2">
          导入表情到哪个分组？
        </label>
        <a-dropdown>
          <template #overlay>
            <a-menu @click="onSelectedTargetGroup">
              <a-menu-item key="">自动创建分组</a-menu-item>
              <a-menu-item v-for="group in emojiStore.groups" :key="group.id" :value="group.id">
                {{ group.name }}
              </a-menu-item>
            </a-menu>
          </template>
          <a-button class="w-full">
            {{ selectedTargetGroup || '自动创建分组' }}
            <DownOutlined />
          </a-button>
        </a-dropdown>
      </div>
    </a-modal>

    <!-- Markdown import dialog -->
    <a-modal
      v-model:open="showMarkdownDialog"
      title="从文本导入表情"
      width="700px"
      @cancel="closeMarkdownDialog"
    >
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-white mb-2">
            粘贴包含表情的文本
          </label>
          <p class="text-xs text-gray-500 dark:text-gray-400 mb-2">
            支持 Markdown 格式：![表情名](表情 URL)
          </p>
          <textarea
            v-model="markdownText"
            placeholder="粘贴包含 ![表情名](表情URL) 格式的文本..."
            class="w-full h-48 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-black text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          ></textarea>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-white mb-2">
            选择目标分组
          </label>
          <a-dropdown>
            <template #overlay>
              <a-menu @click="onSelectedTargetGroupForMarkdown">
                <a-menu-item key="">自动创建分组</a-menu-item>
                <a-menu-item v-for="group in emojiStore.groups" :key="group.id" :value="group.id">
                  {{ group.name }}
                </a-menu-item>
              </a-menu>
            </template>
            <a-button class="w-full">
              {{ selectedTargetGroupForMarkdown || '自动创建分组' }}
              <DownOutlined />
            </a-button>
          </a-dropdown>
        </div>
      </div>
      <template #footer>
        <a-button @click="closeMarkdownDialog">取消</a-button>
        <a-button type="primary" :disabled="!markdownText.trim()" @click="importFromMarkdown">
          导入
        </a-button>
      </template>
    </a-modal>

    <!-- Import Progress Toast -->
    <div
      v-if="isImporting"
      class="fixed top-4 right-4 z-[9999] bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded-lg shadow-lg p-4 max-w-md"
    >
      <div class="flex items-center">
        <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500 mr-3"></div>
        <span class="text-sm text-blue-700 dark:text-blue-200">{{ importStatus }}</span>
      </div>
    </div>

    <!-- Import Results Toast -->
    <div
      v-if="importResults"
      class="fixed top-4 right-4 z-[9999] border rounded-lg shadow-lg p-4 max-w-md"
      :class="
        importResults.success
          ? 'bg-green-50 dark:bg-green-900 border-green-200 dark:border-green-700'
          : 'bg-red-50 dark:bg-red-900 border-red-200 dark:border-red-700'
      "
    >
      <div class="flex items-start">
        <svg
          v-if="importResults.success"
          class="w-5 h-5 text-green-500 dark:text-green-300 mr-3 mt-0.5 flex-shrink-0"
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
          class="w-5 h-5 text-red-500 dark:text-red-300 mr-3 mt-0.5 flex-shrink-0"
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
            :class="
              importResults.success
                ? 'text-green-700 dark:text-green-200'
                : 'text-red-700 dark:text-red-200'
            "
            class="text-sm font-medium"
          >
            {{ importResults.message }}
          </p>
          <p
            v-if="importResults.details"
            :class="
              importResults.success
                ? 'text-green-600 dark:text-green-300'
                : 'text-red-600 dark:text-red-300'
            "
            class="text-sm mt-1"
          >
            {{ importResults.details }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.hidden {
  display: none;
}
</style>
