<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'

import { colorSchemes, isValidColor } from '../../styles/antdTheme'

const props = defineProps<{
  modelValue?: string
  colorScheme?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: string): void
  (e: 'update:colorScheme', v: string): void
}>()

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

const presetColors = Object.entries(colorSchemes).map(([key, value]) => ({
  name: key,
  value,
  label: getColorLabel(key)
}))

const showCustomPicker = ref(false)
const customColorInput = ref(props.modelValue || '')

// popover refs & positioning
const customTileRef = ref<HTMLElement | null>(null)
const popoverRef = ref<HTMLElement | null>(null)
const popoverStyle = ref<Record<string, string>>({
  position: 'fixed',
  top: '0px',
  left: '0px',
  visibility: 'hidden'
})
// native color input ref — used to programmatically open system color picker
const colorInputRef = ref<HTMLInputElement | null>(null)

watch(
  () => props.modelValue,
  v => {
    // only sync external changes into the local input when popover is closed
    if (v != null && !showCustomPicker.value) customColorInput.value = v
  }
)

const isCustomColor = computed(() => {
  const current = props.modelValue || ''
  return !Object.values(colorSchemes).includes(current)
})

const selectedColorType = computed<string>({
  get() {
    if (isCustomColor.value) return 'custom'
    return (props.colorScheme as string) || 'default'
  },
  set(value: string) {
    if (value === 'custom') {
      showCustomPicker.value = true
      customColorInput.value = props.modelValue || ''
    } else {
      showCustomPicker.value = false
      emit('update:colorScheme', value)
      const hex = (colorSchemes as any)[value] as string
      if (hex) emit('update:modelValue', hex)
    }
  }
})

const selectPreset = (name: string) => {
  selectedColorType.value = name
}

const saveCustomColor = () => {
  if (isValidColor(customColorInput.value)) {
    emit('update:colorScheme', 'custom')
    emit('update:modelValue', customColorInput.value)
    showCustomPicker.value = false
  }
}

const onColorInput = (e: Event) => {
  const v = (e.target as HTMLInputElement).value
  // only update the local input value — do NOT apply until user clicks 确定
  customColorInput.value = v
}

// no extra palette — only native color picker and input

const openCustomPicker = async () => {
  selectedColorType.value = 'custom'
  await nextTick()
  const el = customTileRef.value
  if (!el) {
    showCustomPicker.value = true
    popoverStyle.value.visibility = 'visible'
    return
  }
  const rect = el.getBoundingClientRect()
  // desired popover size (approx)
  const width = 340
  const height = 240
  const vw = window.innerWidth
  const vh = window.innerHeight
  let left = Math.round(rect.right + 8)
  let top = Math.round(rect.top)
  // if overflow right, place to left
  if (left + width > vw) left = Math.round(rect.left - width - 8)
  if (left < 8) left = 8
  if (top + height > vh) top = Math.round(vh - height - 8)
  if (top < 8) top = 8
  popoverStyle.value = {
    position: 'fixed',
    top: `${top}px`,
    left: `${left}px`,
    width: `${width}px`,
    zIndex: '9999',
    visibility: 'visible'
  }
  showCustomPicker.value = true
  // wait for DOM to render popover, then open native color dialog if available
  await nextTick()
  try {
    colorInputRef.value?.click()
  } catch (e) {
    // some environments may block programmatic clicks; ignore
  }
}

const closeCustomPicker = () => {
  showCustomPicker.value = false
  popoverStyle.value.visibility = 'hidden'
  // discard unsaved changes: reset local input to current applied value
  customColorInput.value = props.modelValue || ''
}

const onDocPointer = (ev: PointerEvent) => {
  const t = ev.target as Node | null
  if (!t) return
  const insidePopover = popoverRef.value && popoverRef.value.contains(t)
  const insideTile = customTileRef.value && customTileRef.value.contains(t)
  if (!insidePopover && !insideTile) closeCustomPicker()
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocPointer)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocPointer)
})
</script>

<template>
  <div class="space-y-4">
    <!-- presets -->
    <div class="grid grid-cols-3 gap-3">
      <div
        v-for="color in presetColors"
        :key="color.name"
        class="relative cursor-pointer group"
        @click="selectPreset(color.name)"
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
          <span class="text-sm font-medium text-gray-700 dark:text-white">{{ color.label }}</span>
        </div>
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

    <!-- custom -->
    <div
      ref="customTileRef"
      class="relative cursor-pointer group"
      @click.stop.prevent="openCustomPicker"
    >
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

    <!-- popover -->
    <div
      v-if="showCustomPicker"
      ref="popoverRef"
      :style="popoverStyle"
      class="shadow-lg rounded bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600"
      @pointerdown.stop
    >
      <div class="p-4" style="width: 100%">
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
          <div class="mt-3 flex items-center gap-3">
            <input
              ref="colorInputRef"
              type="color"
              class="w-10 h-10 p-0 border rounded"
              :value="customColorInput"
              @input="onColorInput"
              @click.stop
            />
            <!-- palette removed: only native color input is shown -->
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
        <div class="mt-3 flex items-center justify-end gap-2">
          <button
            @click.prevent="closeCustomPicker"
            class="text-sm text-gray-500 hover:text-gray-700 dark:text-white"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.theme-color-picker input {
  outline: none;
}
</style>
