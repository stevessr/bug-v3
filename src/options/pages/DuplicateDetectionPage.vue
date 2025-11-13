<script setup lang="ts">
import { ref } from 'vue'
import { LoadingOutlined, DeleteOutlined, LinkOutlined, ClearOutlined } from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'

import { useEmojiStore } from '@/stores/emojiStore'
import type { Emoji } from '@/types/type'

const emojiStore = useEmojiStore()

const isScanning = ref(false)
const duplicateGroups = ref<Array<Array<{ emoji: Emoji; groupId: string; groupName: string }>>>([])
const selectedAction = ref<'delete' | 'reference'>('reference')
const similarityThreshold = ref(10)
const scanError = ref('')

// Progress indicators
const progress = ref(0)
const currentGroup = ref('')
const currentEmojiName = ref('')
const totalEmojis = ref(0)
const processedEmojis = ref(0)
const groupTotal = ref(0)
const groupProcessed = ref(0)

interface DuplicateGroup {
  emoji: Emoji
  groupId: string
  groupName: string
}

const scanForDuplicates = async () => {
  isScanning.value = true
  scanError.value = ''
  duplicateGroups.value = []
  progress.value = 0
  currentGroup.value = ''
  currentEmojiName.value = ''
  totalEmojis.value = 0
  processedEmojis.value = 0
  groupTotal.value = 0
  groupProcessed.value = 0

  const handleProgress = (p: {
    total: number
    processed: number
    group: string
    emojiName: string
    groupTotal: number
    groupProcessed: number
  }) => {
    totalEmojis.value = p.total
    processedEmojis.value = p.processed
    progress.value = p.total > 0 ? (p.processed / p.total) * 100 : 0
    currentGroup.value = p.group
    currentEmojiName.value = p.emojiName
    groupTotal.value = p.groupTotal
    groupProcessed.value = p.groupProcessed
  }

  try {
    const results = await emojiStore.findDuplicatesAcrossGroups(
      similarityThreshold.value,
      handleProgress
    )
    duplicateGroups.value = results

    if (results.length === 0) {
      scanError.value = '未找到重复的表情'
    }
  } catch (error: any) {
    scanError.value = error.message || '扫描失败'
    console.error('Scan error:', error)
  } finally {
    isScanning.value = false
  }
}

const removeDuplicates = async () => {
  if (duplicateGroups.value.length === 0) return

  const createReferences = selectedAction.value === 'reference'

  try {
    const removed = await emojiStore.removeDuplicatesAcrossGroups(
      duplicateGroups.value,
      createReferences
    )

    // Clear the duplicate groups after processing
    duplicateGroups.value = []

    const msg = createReferences
      ? `已将 ${removed} 个重复表情转换为引用`
      : `已删除 ${removed} 个重复表情`

    message.success(msg)
    console.log(msg)
  } catch (error) {
    message.error('处理重复项失败')
    console.error('Remove duplicates error:', error)
  }
}

const clearHashes = async () => {
  try {
    await emojiStore.clearAllPerceptualHashes()
    message.success('已清空所有表情的哈希值')
  } catch (error) {
    message.error('清空哈希值失败')
    console.error('Clear hashes error:', error)
  }
}

const getTotalDuplicates = () => {
  return duplicateGroups.value.reduce((sum, group) => sum + (group.length - 1), 0)
}
</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700">
    <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
      <h2 class="text-lg font-semibold dark:text-white">跨分组重复检测</h2>
      <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
        使用图片相似度检测跨分组的重复表情
      </p>
    </div>

    <div class="p-6 space-y-6">
      <!-- Similarity Threshold -->
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-white mb-2">
          相似度阈值：{{ similarityThreshold }}
        </label>
        <div class="flex items-center gap-3">
          <a-slider
            v-model:value="similarityThreshold"
            :min="0"
            :max="20"
            :step="1"
            class="flex-1"
            :disabled="isScanning"
          />
          <span class="text-sm text-gray-600 dark:text-gray-400 w-24">
            {{ similarityThreshold <= 5 ? '严格' : similarityThreshold <= 15 ? '中等' : '宽松' }}
          </span>
        </div>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
          数值越小，检测越严格；数值越大，检测越宽松
        </p>
      </div>

      <!-- Action Selection -->
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-white mb-2">处理方式</label>
        <a-radio-group v-model:value="selectedAction">
          <a-radio value="reference">
            <LinkOutlined />
            创建引用（推荐）
            <span class="text-xs text-gray-500 ml-2">
              保留第一个表情，其他转为引用，节省存储空间
            </span>
          </a-radio>
          <a-radio value="delete">
            <DeleteOutlined />
            直接删除
            <span class="text-xs text-gray-500 ml-2">保留第一个表情，删除其他重复项</span>
          </a-radio>
        </a-radio-group>
      </div>

      <!-- Scan Button -->
      <div class="flex gap-3">
        <a-button
          type="primary"
          :loading="isScanning"
          :disabled="isScanning"
          @click="scanForDuplicates"
        >
          <LoadingOutlined v-if="isScanning" />
          {{ isScanning ? '扫描中...' : '开始扫描' }}
        </a-button>

        <a-button v-if="duplicateGroups.length > 0" type="default" danger @click="removeDuplicates">
          处理重复项 ({{ getTotalDuplicates() }})
        </a-button>

        <a-button @click="clearHashes">
          <ClearOutlined />
          清空哈希值
        </a-button>
      </div>

      <!-- Progress Indicator -->
      <div v-if="isScanning" class="space-y-2">
        <div class="flex items-center gap-4">
          <a-progress type="circle" :percent="progress" :width="80" />
          <div class="flex-1 space-y-1">
            <p class="text-sm font-medium dark:text-white">
              总进度：{{ processedEmojis }} / {{ totalEmojis }}
            </p>
            <p class="text-sm text-gray-600 dark:text-gray-400">当前分组：{{ currentGroup }}</p>
            <p class="text-sm text-gray-600 dark:text-gray-400">正在处理：{{ currentEmojiName }}</p>
            <a-progress
              :percent="groupTotal > 0 ? (groupProcessed / groupTotal) * 100 : 0"
              :stroke-width="6"
              :show-info="false"
            />
            <p class="text-xs text-gray-500 dark:text-gray-500">
              {{ groupProcessed }} / {{ groupTotal }}
            </p>
          </div>
        </div>
      </div>

      <!-- Error Message -->
      <div v-if="scanError" class="bg-yellow-50 border border-yellow-200 rounded p-3">
        <p class="text-sm text-yellow-800">{{ scanError }}</p>
      </div>

      <!-- Results -->
      <div v-if="duplicateGroups.length > 0" class="space-y-4">
        <div class="bg-blue-50 border border-blue-200 rounded p-3">
          <p class="text-sm text-blue-800">
            找到 {{ duplicateGroups.length }} 组重复表情，共 {{ getTotalDuplicates() }} 个重复项
          </p>
        </div>

        <!-- Duplicate Groups -->
        <div class="space-y-4 max-h-96 overflow-y-auto">
          <div
            v-for="(group, groupIndex) in duplicateGroups"
            :key="groupIndex"
            class="border border-gray-200 dark:border-gray-700 rounded p-4"
          >
            <div class="flex items-center gap-2 mb-3">
              <span class="text-sm font-medium text-gray-700 dark:text-white">
                重复组 #{{ groupIndex + 1 }}
              </span>
              <span class="text-xs text-gray-500">{{ group.length }} 个相似表情</span>
            </div>

            <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              <div
                v-for="(item, itemIndex) in group"
                :key="item.emoji.id"
                class="border rounded p-2"
                :class="[
                  itemIndex === 0
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 dark:border-gray-700'
                ]"
              >
                <div class="relative">
                  <img
                    :src="item.emoji.displayUrl || item.emoji.url"
                    :alt="item.emoji.name"
                    class="w-full h-24 object-contain rounded"
                    loading="lazy"
                  />
                  <div
                    v-if="itemIndex === 0"
                    class="absolute top-1 right-1 bg-green-500 text-white text-xs px-1 rounded"
                  >
                    保留
                  </div>
                </div>
                <div class="mt-2">
                  <p class="text-xs font-medium text-gray-900 dark:text-white truncate">
                    {{ item.emoji.name }}
                  </p>
                  <p class="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {{ item.groupName }}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Help Text -->
      <div class="text-xs text-gray-500 dark:text-gray-400 space-y-1">
        <p>
          <strong>说明：</strong>
        </p>
        <ul class="list-disc list-inside space-y-1 ml-2">
          <li>扫描会计算所有表情的感知哈希值（首次可能需要较长时间）</li>
          <li>如果表情已经有哈希值，将会跳过计算</li>
          <li>基于图片内容相似度检测重复，而非文件名或 URL</li>
          <li>创建引用会保留第一个表情，其他重复项指向它，节省存储空间</li>
          <li>建议先使用"创建引用"方式，如需完全删除可稍后手动处理</li>
        </ul>
      </div>
    </div>
  </div>
</template>
