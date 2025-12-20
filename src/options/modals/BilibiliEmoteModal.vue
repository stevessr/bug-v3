<script setup lang="ts">
import { ref, onMounted } from 'vue'

import {
  fetchBilibiliEmotePackageById,
  convertBilibiliEmotesToPluginFormat,
  type BilibiliEmotePackage
} from '@/services/bilibiliEmoteApi'

const props = defineProps<{ modelValue: boolean }>()
// reference prop to satisfy TS/linter
void props.modelValue
const emit = defineEmits(['update:modelValue', 'imported'])

const packages = ref<BilibiliEmotePackage[]>([])
const selectedPackages = ref<number[]>([])
const targetGroupId = ref('')
const errorMessage = ref('')
const packageIdInput = ref('')
const idImportLoading = ref(false)

const close = () => emit('update:modelValue', false)

const togglePackage = (packageId: number) => {
  const index = selectedPackages.value.indexOf(packageId)
  if (index > -1) {
    selectedPackages.value.splice(index, 1)
  } else {
    selectedPackages.value.push(packageId)
  }
}

const isPackageSelected = (packageId: number) => {
  return selectedPackages.value.includes(packageId)
}

const doImport = () => {
  if (selectedPackages.value.length === 0) {
    errorMessage.value = '请至少导入一个表情包'

    return
  }

  const selectedPackagesData = packages.value.filter(pkg => selectedPackages.value.includes(pkg.id))

  const convertedEmotes = convertBilibiliEmotesToPluginFormat(
    selectedPackagesData,

    targetGroupId.value || undefined
  )

  emit('imported', {
    items: convertedEmotes,

    targetGroupId: targetGroupId.value || undefined
  })

  selectedPackages.value = []

  targetGroupId.value = ''

  errorMessage.value = ''

  close()
}

const importPackageById = async () => {
  const packageId = parseInt(String(packageIdInput.value).trim())

  if (!packageId || isNaN(packageId)) {
    errorMessage.value = '请输入有效的表情包ID'
    return
  }
  idImportLoading.value = true
  errorMessage.value = ''

  try {
    const packageData = await fetchBilibiliEmotePackageById(packageId)

    // 将获取到的表情包添加到列表中
    const existingIndex = packages.value.findIndex(pkg => pkg.id === packageData.id)
    if (existingIndex > -1) {
      // 如果已存在，替换
      packages.value[existingIndex] = packageData
    } else {
      // 如果不存在，添加
      packages.value.push(packageData)
    }

    // 自动选中新添加的表情包
    selectedPackages.value.push(packageData.id)

    packageIdInput.value = ''
  } catch (error) {
    console.error('通过ID导入表情包失败:', error)
    errorMessage.value = `导入失败: ${error instanceof Error ? error.message : '未知错误'}`
  } finally {
    idImportLoading.value = false
  }
}
</script>

<template>
  <div
    v-if="modelValue"
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    @click="close"
  >
    <div
      class="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-4xl max-h-[80vh] overflow-hidden"
      @click.stop
    >
      <h3 class="text-xl font-semibold mb-4 dark:text-white">通过ID导入Bilibili表情包</h3>

      <!-- 错误信息 -->
      <div
        v-if="errorMessage"
        class="mb-4 p-3 bg-red-100 dark:bg-red-900 border border-red-300 dark:border-red-700 rounded-md"
      >
        <p class="text-sm text-red-800 dark:text-red-200">{{ errorMessage }}</p>
      </div>

      <!-- ID导入区域 -->

      <div
        class="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md"
      >
        <h4 class="font-medium text-blue-900 dark:text-blue-100 mb-3">通过ID导入表情包</h4>

        <p class="text-sm text-blue-800 dark:text-blue-200 mb-4">
          输入Bilibili表情包的ID来导入特定的表情包。
        </p>

        <div class="flex gap-2">
          <input
            v-model="packageIdInput"
            type="number"
            placeholder="输入表情包ID (如: 237)"
            class="flex-1 px-3 py-2 border border-blue-300 dark:border-blue-600 rounded-md bg-white dark:bg-black text-blue-900 dark:text-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            @keyup.enter="importPackageById"
          />

          <button
            @click="importPackageById"
            :disabled="!packageIdInput || !String(packageIdInput).trim() || idImportLoading"
            class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span v-if="idImportLoading">导入中...</span>

            <span v-else>导入</span>
          </button>
        </div>
      </div>

      <!-- 已导入的表情包列表 -->
      <div v-if="packages.length > 0" class="space-y-4">
        <div class="flex justify-between items-center mb-4">
          <h4 class="font-medium text-gray-900 dark:text-white">已导入的表情包</h4>
          <span class="text-sm text-gray-600 dark:text-gray-400">
            {{ packages.length }} 个表情包
          </span>
        </div>

        <!-- 表情包网格 -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-64 overflow-y-auto">
          <div
            v-for="pkg in packages"
            :key="pkg.id"
            class="border rounded-lg p-4 transition-all"
            :class="
              isPackageSelected(pkg.id)
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-300 dark:border-gray-600'
            "
          >
            <div class="flex items-center space-x-3">
              <img
                :src="pkg.url"
                :alt="pkg.text"
                class="w-12 h-12 rounded object-cover"
                @error="
                  e => {
                    ;(e.target as HTMLImageElement).src =
                      'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCA0OCA0OCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQ4IiBoZWlnaHQ9IjQ4IiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0yNCAzMkMxNi4yNjggMzIgMTAgMjUuNzMyIDEwIDE4QzEwIDEwLjI2OCAxNi4yNjggNCAyNCA0QzMxLjczMiA0IDM4IDEwLjI2OCAzOCAxOEMzOCAyNS43MzIgMzEuNzMyIDMyIDI0IDMyWiIgZmlsbD0iIzlDQTNBRiIvPgo8L3N2Zz4K'
                  }
                "
              />
              <div class="flex-1">
                <h4 class="font-medium text-gray-900 dark:text-white">{{ pkg.text }}</h4>
                <p class="text-sm text-gray-500 dark:text-gray-400">
                  {{ pkg.emote.length }} 个表情
                </p>
              </div>
              <div
                class="w-5 h-5 rounded border-2 border-gray-300 dark:border-gray-600 flex items-center justify-center"
              >
                <div
                  v-if="isPackageSelected(pkg.id)"
                  class="w-3 h-3 bg-blue-600 rounded-full"
                ></div>
              </div>
            </div>

            <!-- 表情预览 -->
            <div class="mt-3 flex flex-wrap gap-1">
              <img
                v-for="emote in pkg.emote.slice(0, 6)"
                :key="emote.id"
                :src="emote.url"
                :alt="emote.text"
                class="w-6 h-6 rounded object-cover"
                @error="
                  e => {
                    ;(e.target as HTMLImageElement).style.display = 'none'
                  }
                "
              />
              <span
                v-if="pkg.emote.length > 6"
                class="text-xs text-gray-500 dark:text-gray-400 self-center"
              >
                +{{ pkg.emote.length - 6 }}
              </span>
            </div>
          </div>
        </div>

        <!-- 目标分组输入 -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-white mb-1">
            目标分组（可选）
          </label>
          <input
            v-model="targetGroupId"
            placeholder="留空按表情包名称创建分组"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-black text-gray-900 dark:text-white"
            title="导入表情的目标分组 ID (可选)"
          />
        </div>
      </div>

      <!-- 无表情包时的提示 -->
      <div v-else class="text-center py-8">
        <p class="text-gray-500 dark:text-gray-400">还没有导入任何表情包</p>
        <p class="text-sm text-gray-400 dark:text-gray-500 mt-2">在上方输入表情包ID开始导入</p>
      </div>

      <!-- 底部按钮 -->
      <div class="flex justify-end gap-3 mt-6">
        <button
          @click="close"
          class="px-4 py-2 text-sm text-gray-600 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
        >
          取消
        </button>
        <button
          @click="doImport"
          :disabled="selectedPackages.length === 0 || isLoading"
          class="px-4 py-2 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          导入选中表情包 ({{ selectedPackages.length }})
        </button>
      </div>
    </div>
  </div>
</template>
