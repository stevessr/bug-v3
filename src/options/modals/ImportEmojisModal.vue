<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{ modelValue: boolean }>()
// reference prop to satisfy TS/linter
void props.modelValue
const emit = defineEmits(['update:modelValue', 'imported'])

const text = ref('')
const targetGroupId = ref('')

const close = () => emit('update:modelValue', false)

const handleFile = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) {
    const reader = new FileReader()
    reader.onload = e => {
      text.value = e.target?.result as string
    }
    reader.readAsText(file)
  }
}

const doImport = () => {
  try {
    const parsed = JSON.parse(text.value)
    // If parsed is an array -> normalized emit
    if (Array.isArray(parsed)) {
      emit('imported', { items: parsed, targetGroupId: targetGroupId.value || undefined })
      text.value = ''
      targetGroupId.value = ''
      close()
      return
    }

    // If parsed is an object with emojis array (wrapped format), prefer user-provided targetGroupId if set
    if (parsed && Array.isArray(parsed.emojis)) {
      if (targetGroupId.value) {
        emit('imported', { items: parsed.emojis, targetGroupId: targetGroupId.value })
      } else {
        // emit the raw payload so importUtils can infer group from payload.group
        emit('imported', parsed)
      }
      text.value = ''
      targetGroupId.value = ''
      close()
      return
    }

    // otherwise invalid
    emit('imported', null)
  } catch {
    emit('imported', null)
  }
}

const fillExample = () => {
  text.value = JSON.stringify(
    [
      {
        name: '微笑',
        url: 'https://example.com/smile.png',
        displayUrl: 'https://example.com/smile-thumb.png',
        width: 128,
        height: 128,
        groupId: '常用',
        tags: ['表情', '开心']
      },
      {
        name: '点赞',
        url: 'https://example.com/thumbs-up.png',
        width: 64,
        height: 64,
        groupId: '常用',
        tags: ['手势', '赞同'],
        customOutput: '👍'
      },
      {
        name: '爱心',
        url: 'https://example.com/heart.png',
        originUrl: 'https://source.com/original-heart.png',
        width: 256,
        height: 256,
        groupId: '红色',
        tags: ['爱', '表情']
      }
    ],
    null,
    2
  )
}
</script>

<template>
  <div
    v-if="modelValue"
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    @click="close"
  >
    <div class="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-lg" @click.stop>
      <h3 class="text-lg font-semibold mb-4 dark:text-white">批量导入表情</h3>
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-white mb-1">
            表情文件
          </label>
          <input
            ref="fileInput"
            type="file"
            accept=".json"
            @change="handleFile"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-black text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            title="选择表情 JSON 文件"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-white mb-1">
            或粘贴表情 JSON
          </label>
          <textarea
            v-model="text"
            rows="6"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-black text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="粘贴表情JSON内容..."
            title="粘贴表情 JSON 内容"
          ></textarea>
          <div class="mt-2 text-xs text-gray-500 dark:text-white">
            <div class="mb-2">
              支持的字段：name (必需), url (必需), displayUrl, originUrl, width, height, groupId, tags, customOutput, perceptualHash
            </div>
            示例：
            <a-button
              class="ml-2 text-blue-600 dark:text-blue-400 hover:underline"
              @click="fillExample"
              title="填充示例 JSON 内容"
            >
              填充示例
            </a-button>
          </div>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-white mb-1">
            目标分组（可选）
          </label>
          <input
            v-model="targetGroupId"
            placeholder="留空按 JSON 中分组创建"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-black text-gray-900 dark:text-white"
            title="导入表情的目标分组 ID (可选)"
          />
        </div>
      </div>
      <div class="flex justify-end gap-3 mt-6">
        <a-button
          @click="close"
          class="px-4 py-2 text-sm text-gray-600 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
          title="取消导入表情"
        >
          取消
        </a-button>
        <a-button
          @click="doImport"
          class="px-4 py-2 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
          title="导入表情"
        >
          导入
        </a-button>
      </div>
    </div>
  </div>
</template>
