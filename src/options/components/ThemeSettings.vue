<script setup lang="ts">
import { DownOutlined } from '@ant-design/icons-vue'
import { ref, watch, isRef, type Ref } from 'vue'

import type { AppSettings } from '../../types/type'

import ThemeColorPicker from './ThemeColorPicker.vue'

const props = defineProps<{ settings: AppSettings | Ref<AppSettings> }>()
const settings = props.settings as AppSettings | Ref<AppSettings>

const emit = defineEmits(['update:theme', 'update:customPrimaryColor', 'update:customColorScheme'])

const getTheme = () => {
  try {
    if (isRef(settings)) return (settings.value && settings.value.theme) || 'system'
    return (settings && (settings as AppSettings).theme) || 'system'
  } catch {
    return 'system'
  }
}

const getCustomPrimaryColor = () => {
  try {
    if (isRef(settings)) return (settings.value && settings.value.customPrimaryColor) || '#1890ff'
    return (settings && (settings as AppSettings).customPrimaryColor) || '#1890ff'
  } catch {
    return '#1890ff'
  }
}

const getCustomColorScheme = () => {
  try {
    if (isRef(settings)) return (settings.value && settings.value.customColorScheme) || 'default'
    return (settings && (settings as AppSettings).customColorScheme) || 'default'
  } catch {
    return 'default'
  }
}

const localTheme = ref<string>(getTheme())
watch(
  () => getTheme(),
  val => {
    localTheme.value = val || 'system'
  }
)

const localCustomPrimaryColor = ref<string>(getCustomPrimaryColor())
watch(
  () => getCustomPrimaryColor(),
  val => {
    localCustomPrimaryColor.value = val || '#1890ff'
  }
)

const localCustomColorScheme = ref<string>(getCustomColorScheme())
watch(
  () => getCustomColorScheme(),
  val => {
    localCustomColorScheme.value = val || 'default'
  }
)

const handleThemeSelect = (key: string) => {
  localTheme.value = key
  emit('update:theme', key)
}

const handleThemeSelectInfo = (info: { key: string | number }) => {
  handleThemeSelect(String(info.key))
}

const handleCustomPrimaryColorUpdate = (val: string) => {
  emit('update:customPrimaryColor', val)
}

const handleCustomColorSchemeUpdate = (val: string) => {
  emit('update:customColorScheme', val)
}

const imagePreview = ref<string | null>(null)
const imageSeedColor = ref<string>('')
const imageLoading = ref(false)

const rgbToHex = (r: number, g: number, b: number) =>
  `#${[r, g, b].map(value => Math.round(value).toString(16).padStart(2, '0')).join('')}`

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })

const extractDominantColor = async (dataUrl: string) => {
  const img = await loadImage(dataUrl)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return '#1890ff'
  const size = 64
  canvas.width = size
  canvas.height = size
  ctx.drawImage(img, 0, 0, size, size)
  const { data } = ctx.getImageData(0, 0, size, size)
  let r = 0
  let g = 0
  let b = 0
  let count = 0
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3]
    if (alpha === 0) continue
    r += data[i]
    g += data[i + 1]
    b += data[i + 2]
    count += 1
  }
  if (!count) return '#1890ff'
  return rgbToHex(r / count, g / count, b / count)
}

const handleImageUpload = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  imageLoading.value = true
  try {
    const dataUrl = await readFileAsDataUrl(file)
    const seed = await extractDominantColor(dataUrl)
    imagePreview.value = dataUrl
    imageSeedColor.value = seed
    localCustomPrimaryColor.value = seed
    localCustomColorScheme.value = 'custom'
    emit('update:customPrimaryColor', seed)
    emit('update:customColorScheme', 'custom')
  } finally {
    imageLoading.value = false
    input.value = ''
  }
}
</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700">
    <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
      <h2 class="text-lg font-semibold dark:text-white">主题设置</h2>
    </div>
    <div class="p-6 space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <label class="text-sm font-medium dark:text-white">主题</label>
          <p class="text-sm dark:text-white">选择界面主题</p>
        </div>
        <a-dropdown>
          <template #overlay>
            <a-menu @click="handleThemeSelectInfo">
              <a-menu-item key="system">跟随系统</a-menu-item>
              <a-menu-item key="light">亮色模式</a-menu-item>
              <a-menu-item key="dark">暗色模式</a-menu-item>
            </a-menu>
          </template>
          <a-button title="选择主题">
            {{
              localTheme === 'system'
                ? '跟随系统'
                : localTheme === 'light'
                  ? '亮色模式'
                  : '暗色模式'
            }}
            <DownOutlined />
          </a-button>
        </a-dropdown>
      </div>

      <div class="flex flex-col space-y-4">
        <div class="flex items-start justify-between">
          <div>
            <label class="text-sm font-medium dark:text-white">主题颜色</label>
            <p class="text-sm dark:text-white">自定义界面主色调</p>
          </div>
          <div class="w-2/3">
            <ThemeColorPicker
              v-model="localCustomPrimaryColor"
              :colorScheme="localCustomColorScheme"
              @update:modelValue="handleCustomPrimaryColorUpdate"
              @update:colorScheme="handleCustomColorSchemeUpdate"
            />
          </div>
        </div>

        <div class="flex items-start justify-between">
          <div>
            <label class="text-sm font-medium dark:text-white">图片生成（MD3）</label>
            <p class="text-sm dark:text-white">
              上传图片自动提取主色并按 Material You (MD3) 生成整套配色
            </p>
          </div>
          <div class="w-2/3 space-y-2">
            <input
              type="file"
              accept="image/*"
              class="block w-full text-sm text-gray-500 file:mr-4 file:rounded file:border-0 file:bg-gray-100 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-gray-700 hover:file:bg-gray-200 dark:file:bg-gray-700 dark:file:text-white"
              @change="handleImageUpload"
            />
            <div v-if="imageLoading" class="text-xs text-gray-500 dark:text-white">正在生成配色...</div>
            <div v-else-if="imagePreview" class="flex items-center gap-3">
              <img
                :src="imagePreview"
                alt="theme preview"
                class="w-12 h-12 rounded border border-gray-200 object-cover"
              />
              <div class="text-xs text-gray-500 dark:text-white">
                提取主色：<span class="font-semibold">{{ imageSeedColor }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
