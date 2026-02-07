<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { UploadOutlined, BgColorsOutlined, CheckOutlined } from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'

import {
  colorSchemes,
  getSchemesByCategory,
  categoryNames,
  getAllCategories,
  extractColorsFromImage,
  type ColorSchemeCategory,
  type ExtractedColor
} from '../../styles/md3Theme'

const props = defineProps<{
  md3ColorScheme?: string
  md3SeedColor?: string
}>()

const emit = defineEmits<{
  (e: 'update:md3ColorScheme', v: string): void
  (e: 'update:md3SeedColor', v: string | undefined): void
}>()

const activeTab = ref<string>('classic')
const customColor = ref<string>(props.md3SeedColor || '#6750A4')
const extractedColors = ref<ExtractedColor[]>([])
const isExtracting = ref(false)
const previewUrl = ref<string | null>(null)

const parseHexColor = (hex: string) => {
  const normalized = hex.replace('#', '').trim()
  if (normalized.length === 3) {
    const r = Number.parseInt(normalized[0] + normalized[0], 16)
    const g = Number.parseInt(normalized[1] + normalized[1], 16)
    const b = Number.parseInt(normalized[2] + normalized[2], 16)
    return { r, g, b }
  }
  if (normalized.length === 6) {
    const r = Number.parseInt(normalized.slice(0, 2), 16)
    const g = Number.parseInt(normalized.slice(2, 4), 16)
    const b = Number.parseInt(normalized.slice(4, 6), 16)
    return { r, g, b }
  }
  return null
}

const getLuminance = (rgb: { r: number; g: number; b: number }) =>
  (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255

const isLightColor = (rgb: { r: number; g: number; b: number }) => getLuminance(rgb) > 0.72

const customColorIsLight = computed(() => {
  const rgb = parseHexColor(customColor.value)
  return rgb ? isLightColor(rgb) : false
})

const getSwatchStyle = (color: ExtractedColor) => {
  const light = isLightColor(color.rgb)
  return {
    backgroundColor: color.hex,
    boxShadow: `inset 0 0 0 1px ${light ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.25)'}, 0 2px 6px rgba(0,0,0,0.12)`
  }
}

const revokePreviewUrl = () => {
  if (previewUrl.value && previewUrl.value.startsWith('blob:')) {
    URL.revokeObjectURL(previewUrl.value)
  }
}

const setPreviewFromFile = (file: File) => {
  revokePreviewUrl()
  previewUrl.value = URL.createObjectURL(file)
}

onBeforeUnmount(() => {
  revokePreviewUrl()
})

// 监听外部属性变化
watch(
  () => props.md3SeedColor,
  val => {
    if (val) {
      customColor.value = val
      activeTab.value = 'custom'
    }
  }
)

watch(
  () => props.md3ColorScheme,
  val => {
    if (val && colorSchemes[val]) {
      // 选择了预设方案，切换到对应分类 Tab
      const category = colorSchemes[val].category
      if (category) {
        activeTab.value = category
      }
    } else if (!val && props.md3SeedColor) {
      // 清空了预设方案但有自定义颜色，切换到 custom Tab
      activeTab.value = 'custom'
    }
  },
  { immediate: true }
)

const categories = getAllCategories()

const selectScheme = (key: string) => {
  emit('update:md3ColorScheme', key)
}

const selectCustomColor = (color: string) => {
  customColor.value = color
  if (activeTab.value !== 'custom') {
    activeTab.value = 'custom'
  }
  emit('update:md3SeedColor', color)
  // 清空预设方案选择
  emit('update:md3ColorScheme', '')
}

const handleFileUpload = async (event: Event) => {
  const input = event.target as HTMLInputElement
  if (!input.files || input.files.length === 0) return

  const file = input.files[0]
  if (!file.type.startsWith('image/')) {
    message.error('请上传图片文件')
    return
  }

  try {
    isExtracting.value = true
    setPreviewFromFile(file)
    extractedColors.value = await extractColorsFromImage(file, 8, 'mediancut')

    // 默认选中第一个提取的颜色
    if (extractedColors.value.length > 0) {
      selectCustomColor(extractedColors.value[0].hex)
    }
  } catch (error) {
    console.error('提取颜色失败：', error)
    message.error('提取颜色失败')
  } finally {
    isExtracting.value = false
    // 清空 input 以便重复上传
    input.value = ''
  }
}

const handlePaste = async (event: ClipboardEvent) => {
  const items = event.clipboardData?.items
  if (!items) return

  for (const item of items) {
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile()
      if (file) {
        try {
          isExtracting.value = true
          setPreviewFromFile(file)
          extractedColors.value = await extractColorsFromImage(file, 8, 'mediancut')
          if (extractedColors.value.length > 0) {
            selectCustomColor(extractedColors.value[0].hex)
          }
        } catch (error) {
          console.error('提取颜色失败：', error)
          message.error('提取颜色失败')
        } finally {
          isExtracting.value = false
        }
      }
      break
    }
  }
}
</script>

<template>
  <div class="theme-color-picker space-y-4">
    <a-tabs v-model:activeKey="activeTab" type="card" size="small">
      <!-- 预设分类 -->
      <a-tab-pane v-for="cat in categories" :key="cat" :tab="categoryNames[cat]">
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 pt-2">
          <div
            v-for="(scheme, key) in getSchemesByCategory(cat)"
            :key="key"
            class="relative cursor-pointer group"
            @click="selectScheme(String(key))"
          >
            <div
              class="flex flex-col items-center p-2 border-2 rounded-xl transition-all duration-200 h-full"
              :class="[
                props.md3ColorScheme === key
                  ? 'dark:bg-primary/20'
                  : 'border-transparent hover:border-gray-200 dark:hover:border-gray-700 bg-gray-50 dark:bg-gray-800'
              ]"
              :style="
                props.md3ColorScheme === key
                  ? {
                      borderColor: 'var(--md3-primary)',
                      backgroundColor: 'var(--md3-primary-container)'
                    }
                  : {}
              "
            >
              <div
                class="w-10 h-10 rounded-full mb-2 shadow-sm border border-gray-100 dark:border-gray-700"
                :style="{ backgroundColor: scheme.color }"
              ></div>
              <span class="text-xs font-medium text-gray-700 dark:text-gray-200 text-center">
                {{ scheme.name }}
              </span>
            </div>

            <!-- 选中标记 -->
            <div
              v-if="props.md3ColorScheme === key"
              class="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center shadow-sm"
              :style="{ backgroundColor: 'var(--md3-primary)' }"
            >
              <CheckOutlined class="text-white text-xs" />
            </div>
          </div>
        </div>
      </a-tab-pane>

      <!-- 自定义 -->
      <a-tab-pane key="custom" tab="自定义/图片取色">
        <div class="space-y-6 pt-2">
          <!-- 颜色选择器 -->
          <div class="flex items-center gap-4">
            <div class="relative group cursor-pointer">
              <input
                type="color"
                v-model="customColor"
                @input="e => selectCustomColor((e.target as HTMLInputElement).value)"
                class="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <div
                class="w-16 h-16 rounded-xl shadow-md border-2 border-gray-200 dark:border-gray-600 flex items-center justify-center transition-transform group-hover:scale-105"
                :style="{
                  backgroundColor: customColor,
                  boxShadow: customColorIsLight
                    ? 'inset 0 0 0 1px rgba(0,0,0,0.2), 0 6px 14px rgba(0,0,0,0.16)'
                    : 'inset 0 0 0 1px rgba(255,255,255,0.18), 0 6px 14px rgba(0,0,0,0.16)'
                }"
              >
                <BgColorsOutlined
                  class="text-xl drop-shadow-md"
                  :style="{ color: customColorIsLight ? 'rgba(15, 23, 42, 0.8)' : '#ffffff' }"
                />
              </div>
            </div>

            <div class="flex-1">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                当前自定义颜色
              </label>
              <div class="flex items-center gap-2">
                <code class="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-sm font-mono">
                  {{ customColor.toUpperCase() }}
                </code>
                <span class="text-xs text-gray-500">点击色块选择任意颜色</span>
              </div>
            </div>
          </div>

          <a-divider style="margin: 12px 0" />

          <!-- 图片取色区域 -->
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <h4 class="text-sm font-medium text-gray-700 dark:text-gray-200">从图片提取配色</h4>
            </div>

            <div class="flex flex-col md:flex-row gap-4">
              <!-- 图片区域 -->
              <div class="flex-1 min-w-[260px]">
                <div
                  class="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-6 text-center transition-colors cursor-pointer relative overflow-hidden min-h-[200px] md:min-h-[240px]"
                  :style="{
                    '--hover-border-color': 'var(--md3-primary)',
                    '--hover-bg-color': 'var(--md3-primary-container)'
                  }"
                  @paste="handlePaste"
                >
                  <input
                    type="file"
                    accept="image/*"
                    class="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    @change="handleFileUpload"
                  />
                  <div v-if="previewUrl" class="absolute inset-0 p-3 pointer-events-none">
                    <div class="theme-color-checker w-full h-full rounded-lg overflow-hidden border border-gray-200/70 dark:border-gray-700/70">
                      <img
                        :src="previewUrl"
                        alt="预览图片"
                        class="w-full h-full object-contain"
                      />
                    </div>
                    <div
                      class="absolute bottom-3 right-3 text-[11px] px-2 py-1 rounded-full bg-white/90 text-gray-700 shadow-sm dark:bg-gray-900/80 dark:text-gray-200"
                    >
                      点击更换图片
                    </div>
                  </div>
                  <div v-if="isExtracting" class="py-2">
                    <a-spin tip="正在分析颜色..." />
                  </div>
                  <div v-else-if="!previewUrl" class="space-y-2 pointer-events-none">
                    <UploadOutlined class="text-2xl text-gray-400" />
                    <p class="text-sm text-gray-500 dark:text-gray-400">
                      点击上传或直接粘贴图片 (Ctrl+V)
                    </p>
                  </div>
                </div>
              </div>

              <!-- 提取结果 -->
              <div class="flex-1 min-w-[220px]">
                <p class="text-xs text-gray-500 mb-2">提取结果 (点击应用):</p>
                <div v-if="extractedColors.length > 0" class="theme-color-swatch-grid min-h-[200px]">
                  <div
                    v-for="color in extractedColors"
                    :key="color.hex"
                    class="group relative cursor-pointer"
                    @click="selectCustomColor(color.hex)"
                  >
                    <div
                      class="w-full aspect-square rounded-lg border border-gray-100 dark:border-gray-700 transition-transform group-hover:scale-110"
                      :style="getSwatchStyle(color)"
                    ></div>

                    <!-- 选中标记 -->
                    <div
                      v-if="customColor.toLowerCase() === color.hex.toLowerCase()"
                      class="absolute inset-0 flex items-center justify-center"
                    >
                      <div
                        class="w-6 h-6 rounded-full border-2 border-white shadow-md flex items-center justify-center"
                        :style="{
                          backgroundColor: color.hex,
                          boxShadow: getSwatchStyle(color).boxShadow
                        }"
                      >
                        <CheckOutlined
                          class="text-xs"
                          :style="{
                            color: isLightColor(color.rgb) ? 'rgba(15, 23, 42, 0.8)' : '#ffffff'
                          }"
                        />
                      </div>
                    </div>

                    <!-- Tooltip -->
                    <div
                      class="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 px-2 py-1 bg-black/80 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20 pointer-events-none"
                    >
                      {{ color.name }} · {{ color.hex.toUpperCase() }}
                    </div>
                  </div>
                </div>
                <div
                  v-else
                  class="min-h-[200px] rounded-xl border border-dashed border-gray-200 dark:border-gray-700 flex items-center justify-center text-xs text-gray-400"
                >
                  上传或粘贴图片后显示提取结果
                </div>
              </div>
            </div>
          </div>
        </div>
      </a-tab-pane>
    </a-tabs>
  </div>
</template>

<style scoped>
.theme-color-picker :deep(.ant-tabs-nav) {
  margin-bottom: 12px;
}

/* 隐藏 Tab 内容的默认 padding */
.theme-color-picker :deep(.ant-tabs-content) {
  min-height: 200px;
}

/* 图片上传区域 hover 效果 */
.theme-color-picker [style*='--hover-border-color']:hover {
  border-color: var(--hover-border-color) !important;
  background-color: var(--hover-bg-color) !important;
}

.theme-color-checker {
  background-color: #f8fafc;
  background-image:
    linear-gradient(45deg, rgba(15, 23, 42, 0.06) 25%, transparent 25%),
    linear-gradient(-45deg, rgba(15, 23, 42, 0.06) 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, rgba(15, 23, 42, 0.06) 75%),
    linear-gradient(-45deg, transparent 75%, rgba(15, 23, 42, 0.06) 75%);
  background-size: 12px 12px;
  background-position: 0 0, 0 6px, 6px -6px, -6px 0px;
}

.theme-color-swatch-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
  gap: 12px;
}

.theme-color-swatch-grid > * {
  min-width: 72px;
}

:deep(.dark) .theme-color-checker {
  background-color: #0f172a;
  background-image:
    linear-gradient(45deg, rgba(148, 163, 184, 0.2) 25%, transparent 25%),
    linear-gradient(-45deg, rgba(148, 163, 184, 0.2) 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, rgba(148, 163, 184, 0.2) 75%),
    linear-gradient(-45deg, transparent 75%, rgba(148, 163, 184, 0.2) 75%);
}
</style>
