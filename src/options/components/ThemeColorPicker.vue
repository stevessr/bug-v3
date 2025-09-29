<script setup lang="ts">
import { ref, computed, watch } from 'vue'

import { colorSchemes } from '../../styles/antdTheme'

interface Props {
  modelValue: string
  colorScheme: string
}

interface Emits {
  (_e: 'update:modelValue', _value: string): void
  (_e: 'update:colorScheme', _value: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const showCustomPicker = ref(false)
const customColorInput = ref('')

// 预设颜色列表
const presetColors = Object.entries(colorSchemes).map(([key, value]) => ({
  name: key,
  value: value,
  label: getColorLabel(key)
}))

function getColorLabel(key: string): string {
  const labels: Record<string, string> = {
    default: '默认蓝',
    blue: '科技蓝',
    green: '自然绿',
    purple: '优雅紫',
    orange: '活力橙',
    red: '警示红'
  }
  return labels[key] || key
}

// 检查是否是自定义颜色
const isCustomColor = computed(() => {
  return !Object.values(colorSchemes).includes(props.modelValue)
})

// 当前选中的颜色类型
const selectedColorType = computed({
  get() {
    if (isCustomColor.value) {
      return 'custom'
    }
    return props.colorScheme
  },
  set(value: string) {
    if (value === 'custom') {
      showCustomPicker.value = true
      customColorInput.value = props.modelValue
    } else {
      emit('update:colorScheme', value)
      emit('update:modelValue', colorSchemes[value as keyof typeof colorSchemes])
    }
  }
})

// 保存自定义颜色
const saveCustomColor = () => {
  if (isValidColor(customColorInput.value)) {
    emit('update:colorScheme', 'custom')
    emit('update:modelValue', customColorInput.value)
    showCustomPicker.value = false
  }
}

// 颜色验证
function isValidColor(color: string): boolean {
  const style = new Option().style
  style.color = color
  return style.color !== ''
}

// 监听外部颜色变化
watch(
  () => props.modelValue,
  newValue => {
    if (showCustomPicker.value) {
      customColorInput.value = newValue
    }
  }
)
</script>

<template>
  <div class="space-y-4">
    <!-- 预设颜色选择 -->
    <div class="grid grid-cols-3 gap-3">
      <div
        v-for="color in presetColors"
        :key="color.name"
        class="relative cursor-pointer group"
        @click="selectedColorType = color.name"
      >
        <div
          class="flex items-center p-3 border-2 rounded-lg transition-all duration-200"
          :class="[
            selectedColorType === color.name
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
              : 'border-gray-200 hover:border-gray-300 dark:border-gray-600 dark:hover:border-gray-500'
          ]"
        >
          <div
            class="w-5 h-5 rounded-full mr-3 border border-gray-200 dark:border-gray-600"
            :style="{ backgroundColor: color.value }"
          ></div>
          <span class="text-sm font-medium text-gray-700 dark:text-white">
            {{ color.label }}
          </span>
        </div>
        <!-- 选中指示器 -->
        <div
          v-if="selectedColorType === color.name"
          class="absolute top-1 right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center"
        >
          <svg class="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path
              fill-rule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clip-rule="evenodd"
            />
          </svg>
        </div>
      </div>
    </div>

    <!-- 自定义颜色选项 -->
    <div class="relative cursor-pointer group" @click="selectedColorType = 'custom'">
      <div
        class="flex items-center p-3 border-2 rounded-lg transition-all duration-200"
        :class="[
          selectedColorType === 'custom'
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
            : 'border-gray-200 hover:border-gray-300 dark:border-gray-600 dark:hover:border-gray-500'
        ]"
      >
        <div
          class="w-5 h-5 rounded-full mr-3 border border-gray-200 dark:border-gray-600"
          :style="{ backgroundColor: isCustomColor ? modelValue : '#cccccc' }"
        ></div>
        <span class="text-sm font-medium text-gray-700 dark:text-white">自定义颜色</span>
      </div>
      <!-- 选中指示器 -->
      <div
        v-if="selectedColorType === 'custom'"
        class="absolute top-1 right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center"
      >
        <svg class="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
          <path
            fill-rule="evenodd"
            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
            clip-rule="evenodd"
          />
        </svg>
      </div>
    </div>

    <!-- 自定义颜色选择器 -->
    <div
      v-if="showCustomPicker"
      class="p-4 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800"
    >
      <div class="space-y-3">
        <label class="block text-sm font-medium text-gray-700 dark:text-white">
          输入颜色值 (支持 hex、rgb、颜色名称)
        </label>
        <div class="flex gap-2">
          <input
            v-model="customColorInput"
            type="text"
            placeholder="#1890ff 或 rgb(24, 144, 255)"
            class="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-black text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <a-button
            @click="saveCustomColor"
            :disabled="!isValidColor(customColorInput)"
            class="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            确定
          </a-button>
        </div>
        <div class="flex items-center gap-2">
          <div
            class="w-6 h-6 rounded border border-gray-300 dark:border-gray-600"
            :style="{
              backgroundColor: isValidColor(customColorInput) ? customColorInput : '#f5f5f5'
            }"
          ></div>
          <span class="text-xs text-gray-500 dark:text-white">
            {{ isValidColor(customColorInput) ? '颜色预览' : '无效颜色' }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
