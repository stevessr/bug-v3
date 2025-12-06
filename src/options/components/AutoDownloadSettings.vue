<script setup lang="ts">
import { ref, watch } from 'vue'
import type { AppSettings } from '../../types/type'

interface Props {
  settings: AppSettings
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:enableAutoDownload': [value: boolean]
  'update:autoDownloadSuffixes': [value: string[]]
}>()

// Local state
const localEnableAutoDownload = ref(props.settings.enableAutoDownload ?? false)
const localAutoDownloadSuffixes = ref<string[]>(
  props.settings.autoDownloadSuffixes ?? ['name=large', 'name=orig']
)
const newSuffix = ref('')

// Watch for external changes
watch(
  () => props.settings.enableAutoDownload,
  newVal => {
    localEnableAutoDownload.value = newVal ?? false
  }
)

watch(
  () => props.settings.autoDownloadSuffixes,
  newVal => {
    localAutoDownloadSuffixes.value = newVal ?? ['name=large', 'name=orig']
  }
)

// Emit changes
const handleEnableChange = (value: boolean) => {
  emit('update:enableAutoDownload', value)
}

const handleSuffixesChange = () => {
  emit('update:autoDownloadSuffixes', localAutoDownloadSuffixes.value)
}

const addSuffix = () => {
  const suffix = newSuffix.value.trim()
  if (suffix && !localAutoDownloadSuffixes.value.includes(suffix)) {
    localAutoDownloadSuffixes.value.push(suffix)
    newSuffix.value = ''
    handleSuffixesChange()
  }
}

const removeSuffix = (suffix: string) => {
  const index = localAutoDownloadSuffixes.value.indexOf(suffix)
  if (index > -1) {
    localAutoDownloadSuffixes.value.splice(index, 1)
    handleSuffixesChange()
  }
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <div class="flex-1">
        <h4 class="text-sm font-medium dark:text-white">启用自动下载</h4>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
          当检测到匹配后缀的图片 URL 时自动下载（仅 X.com）
        </p>
      </div>
      <a-switch
        :checked="localEnableAutoDownload"
        @change="handleEnableChange"
        checked-children="开"
        un-checked-children="关"
      />
    </div>

    <div v-if="localEnableAutoDownload" class="space-y-3 pl-4 border-l-2 border-blue-200 dark:border-blue-800">
      <div>
        <h5 class="text-sm font-medium dark:text-white mb-2">监控的 URL 后缀</h5>
        <p class="text-xs text-gray-500 dark:text-gray-400 mb-3">
          当图片 URL 包含以下任一后缀时将自动下载
        </p>

        <!-- Suffix list -->
        <div class="space-y-2 mb-3">
          <div
            v-for="suffix in localAutoDownloadSuffixes"
            :key="suffix"
            class="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700"
          >
            <code class="text-sm text-blue-600 dark:text-blue-400">{{ suffix }}</code>
            <a-button
              size="small"
              danger
              type="text"
              @click="removeSuffix(suffix)"
            >
              删除
            </a-button>
          </div>
        </div>

        <!-- Add new suffix -->
        <div class="flex space-x-2">
          <a-input
            v-model:value="newSuffix"
            placeholder="例如: name=large"
            @pressEnter="addSuffix"
            size="small"
          />
          <a-button
            type="primary"
            size="small"
            @click="addSuffix"
            :disabled="!newSuffix.trim()"
          >
            添加
          </a-button>
        </div>

        <div class="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded border border-yellow-200 dark:border-yellow-800">
          <p class="text-xs text-yellow-700 dark:text-yellow-300">
            <strong>提示：</strong>常见的 X.com 图片后缀包括：
          </p>
          <ul class="text-xs text-yellow-600 dark:text-yellow-400 mt-1 ml-4 list-disc">
            <li><code>name=large</code> - 大图</li>
            <li><code>name=orig</code> - 原图</li>
            <li><code>name=4096x4096</code> - 4K 图</li>
            <li><code>format=jpg&name=large</code> - 大图 JPG</li>
          </ul>
        </div>
      </div>

      <div class="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
        <p class="text-xs text-blue-700 dark:text-blue-300">
          <strong>说明：</strong>自动下载功能会在检测到符合条件的图片时立即触发下载。系统会记录已下载的 URL 以避免重复下载。
        </p>
      </div>
    </div>
  </div>
</template>
