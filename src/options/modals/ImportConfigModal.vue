<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{ modelValue: boolean }>()
void props.modelValue
const emit = defineEmits<{
  (_e: 'update:modelValue', _v: boolean): void
  (_e: 'imported', _config: any): void
}>()
void emit // Used in template

const text = ref('')

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
    emit('imported', parsed)
    text.value = ''
    close()
  } catch {
    emit('imported', null)
  }
}
</script>

<template>
  <div
    v-if="modelValue"
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    @click="close"
  >
    <div class="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-lg" @click.stop>
      <h3 class="text-lg font-semibold mb-4 dark:text-white">导入配置</h3>
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-white mb-1">
            配置文件
          </label>
          <input
            ref="fileInput"
            type="file"
            accept=".json"
            @change="handleFile"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-black text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            title="选择配置文件"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-white mb-1">
            或粘贴 JSON 配置
          </label>
          <textarea
            v-model="text"
            rows="6"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-black text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="粘贴JSON配置内容..."
            title="粘贴 JSON 配置内容"
          ></textarea>
        </div>
      </div>
      <div class="flex justify-end gap-3 mt-6">
        <a-button
          @click="close"
          class="px-4 py-2 text-sm text-gray-600 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
          title="取消导入配置"
        >
          取消
        </a-button>
        <a-button
          @click="doImport"
          class="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          title="导入配置"
        >
          导入
        </a-button>
      </div>
    </div>
  </div>
</template>
