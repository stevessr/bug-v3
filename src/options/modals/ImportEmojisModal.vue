<script setup lang="ts">
import { ref, defineEmits, defineProps } from 'vue'

const props = defineProps<{ modelValue: boolean }>()
// reference prop to satisfy TS/linter
void props.modelValue
const emit = defineEmits(['update:modelValue', 'imported'])

const text = ref('')
const targetGroupId = ref('')
const fileInput = ref<HTMLInputElement | null>(null)

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
      { name: '微笑', url: 'https://example.com/smile.png', groupId: '常用' },
      { name: '点赞', url: 'https://example.com/thumbs-up.png', groupId: '常用' },
      { name: '爱心', url: 'https://example.com/heart.png', groupId: '红色' }
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
    <div class="bg-white rounded-lg p-6 w-full max-w-lg" @click.stop>
      <h3 class="text-lg font-semibold mb-4">批量导入表情</h3>
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">表情文件</label>
          <input
            ref="fileInput"
            type="file"
            accept=".json"
            @change="handleFile"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">或粘贴表情JSON</label>
          <textarea
            v-model="text"
            rows="6"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="粘贴表情JSON内容..."
          ></textarea>
          <div class="mt-2 text-xs text-gray-500">
            示例：
            <button class="ml-2 text-blue-600 hover:underline" @click="fillExample">
              填充示例
            </button>
          </div>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">目标分组（可选）</label>
          <input
            v-model="targetGroupId"
            placeholder="留空按 JSON 中分组创建"
            class="w-full px-3 py-2 border border-gray-300 rounded-md"
          />
        </div>
      </div>
      <div class="flex justify-end gap-3 mt-6">
        <button
          @click="close"
          class="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded transition-colors"
        >
          取消
        </button>
        <button
          @click="doImport"
          class="px-4 py-2 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
        >
          导入
        </button>
      </div>
    </div>
  </div>
</template>
