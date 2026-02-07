<script setup lang="ts">
import { DownOutlined, CheckOutlined } from '@ant-design/icons-vue'
import { ref, watch, isRef, computed, type Ref } from 'vue'

import type { AppSettings } from '../../types/type'
import { generateMd3Scheme } from '../../styles/md3Theme'

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
// 提取的调色板（多个颜色）
const extractedPalette = ref<string[]>([])
// 当前选中的调色板索引
const selectedPaletteIndex = ref<number>(0)

const rgbToHex = (r: number, g: number, b: number) =>
  `#${[r, g, b].map(value => Math.round(value).toString(16).padStart(2, '0')).join('')}`

const hexToRgb = (hex: string) => {
  const match = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i)
  if (!match) return null
  return {
    r: parseInt(match[1], 16),
    g: parseInt(match[2], 16),
    b: parseInt(match[3], 16)
  }
}

// RGB 转 HSL
const rgbToHsl = (r: number, g: number, b: number) => {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  let h = 0
  let s = 0
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6
        break
      case g:
        h = ((b - r) / d + 2) / 6
        break
      case b:
        h = ((r - g) / d + 4) / 6
        break
    }
  }
  return { h: h * 360, s: s * 100, l: l * 100 }
}

// 计算颜色饱和度和亮度，用于排序
const getColorScore = (hex: string) => {
  const rgb = hexToRgb(hex)
  if (!rgb) return 0
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b)
  // 优先选择饱和度高且亮度适中的颜色
  const satScore = hsl.s
  const lightScore = 100 - Math.abs(hsl.l - 50) * 2 // 亮度接近50分数更高
  return satScore * 0.7 + lightScore * 0.3
}

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

// Median Cut 算法提取多个主色
interface ColorBox {
  colors: Array<{ r: number; g: number; b: number }>
  rMin: number
  rMax: number
  gMin: number
  gMax: number
  bMin: number
  bMax: number
}

const createBox = (colors: Array<{ r: number; g: number; b: number }>): ColorBox => {
  let rMin = 255,
    rMax = 0,
    gMin = 255,
    gMax = 0,
    bMin = 255,
    bMax = 0
  for (const c of colors) {
    if (c.r < rMin) rMin = c.r
    if (c.r > rMax) rMax = c.r
    if (c.g < gMin) gMin = c.g
    if (c.g > gMax) gMax = c.g
    if (c.b < bMin) bMin = c.b
    if (c.b > bMax) bMax = c.b
  }
  return { colors, rMin, rMax, gMin, gMax, bMin, bMax }
}

const splitBox = (box: ColorBox): [ColorBox, ColorBox] => {
  const rRange = box.rMax - box.rMin
  const gRange = box.gMax - box.gMin
  const bRange = box.bMax - box.bMin

  // 按最大范围的通道排序并分割
  let sortKey: 'r' | 'g' | 'b' = 'r'
  if (gRange >= rRange && gRange >= bRange) sortKey = 'g'
  else if (bRange >= rRange && bRange >= gRange) sortKey = 'b'

  const sorted = [...box.colors].sort((a, b) => a[sortKey] - b[sortKey])
  const mid = Math.floor(sorted.length / 2)

  return [createBox(sorted.slice(0, mid)), createBox(sorted.slice(mid))]
}

const getBoxAverage = (box: ColorBox): { r: number; g: number; b: number } => {
  let r = 0,
    g = 0,
    b = 0
  for (const c of box.colors) {
    r += c.r
    g += c.g
    b += c.b
  }
  const len = box.colors.length
  return { r: Math.round(r / len), g: Math.round(g / len), b: Math.round(b / len) }
}

const extractColorPalette = async (dataUrl: string, count: number = 6): Promise<string[]> => {
  const img = await loadImage(dataUrl)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return ['#1890ff']

  const size = 128 // 采样分辨率
  canvas.width = size
  canvas.height = size
  ctx.drawImage(img, 0, 0, size, size)
  const { data } = ctx.getImageData(0, 0, size, size)

  // 收集所有像素颜色（跳过透明和接近纯黑/纯白的颜色）
  const colors: Array<{ r: number; g: number; b: number }> = []
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3]
    if (alpha < 128) continue // 跳过半透明

    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]

    // 跳过接近黑白的颜色
    const brightness = (r + g + b) / 3
    if (brightness < 20 || brightness > 235) continue

    // 跳过低饱和度颜色（灰色）
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const saturation = max === 0 ? 0 : (max - min) / max
    if (saturation < 0.15) continue

    colors.push({ r, g, b })
  }

  if (colors.length === 0) return ['#1890ff']

  // Median Cut 算法
  const boxes: ColorBox[] = [createBox(colors)]

  while (boxes.length < count * 2) {
    // 找到最大的盒子进行分割
    let maxVolume = 0
    let maxIndex = 0
    for (let i = 0; i < boxes.length; i++) {
      const box = boxes[i]
      const volume =
        (box.rMax - box.rMin) * (box.gMax - box.gMin) * (box.bMax - box.bMin) * box.colors.length
      if (volume > maxVolume) {
        maxVolume = volume
        maxIndex = i
      }
    }

    if (boxes[maxIndex].colors.length < 2) break

    const [box1, box2] = splitBox(boxes[maxIndex])
    boxes.splice(maxIndex, 1, box1, box2)
  }

  // 获取每个盒子的平均色
  const palette = boxes.map(box => {
    const avg = getBoxAverage(box)
    return rgbToHex(avg.r, avg.g, avg.b)
  })

  // 去重
  const uniquePalette = [...new Set(palette)]

  // 按颜色分数排序（饱和度高且亮度适中的优先）
  uniquePalette.sort((a, b) => getColorScore(b) - getColorScore(a))

  return uniquePalette.slice(0, count)
}

// 根据选中颜色生成的 MD3 配色预览
const md3Preview = computed(() => {
  if (!imageSeedColor.value) return null
  const mode = localTheme.value === 'dark' ? 'dark' : 'light'
  return generateMd3Scheme(imageSeedColor.value, mode as 'light' | 'dark')
})

const handleImageUpload = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  imageLoading.value = true
  extractedPalette.value = []
  selectedPaletteIndex.value = 0
  try {
    const dataUrl = await readFileAsDataUrl(file)
    const palette = await extractColorPalette(dataUrl, 6)
    imagePreview.value = dataUrl
    extractedPalette.value = palette
    // 自动选择第一个（评分最高的）颜色
    if (palette.length > 0) {
      selectPaletteColor(0)
    }
  } finally {
    imageLoading.value = false
    input.value = ''
  }
}

const selectPaletteColor = (index: number) => {
  selectedPaletteIndex.value = index
  const color = extractedPalette.value[index]
  if (color) {
    imageSeedColor.value = color
    localCustomPrimaryColor.value = color
    localCustomColorScheme.value = 'custom'
    emit('update:customPrimaryColor', color)
    emit('update:customColorScheme', 'custom')
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
            <p class="text-sm text-gray-500 dark:text-gray-400">
              上传图片自动提取色系并按 Material You (MD3) 生成整套配色
            </p>
          </div>
          <div class="w-2/3 space-y-3">
            <input
              type="file"
              accept="image/*"
              class="block w-full text-sm text-gray-500 file:mr-4 file:rounded file:border-0 file:bg-gray-100 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-gray-700 hover:file:bg-gray-200 dark:file:bg-gray-700 dark:file:text-white"
              @change="handleImageUpload"
            />
            <div v-if="imageLoading" class="text-xs text-gray-500 dark:text-gray-400">
              正在分析图片并提取色系...
            </div>

            <!-- 图片预览和调色板 -->
            <div v-else-if="imagePreview && extractedPalette.length > 0" class="space-y-3">
              <div class="flex items-start gap-4">
                <img
                  :src="imagePreview"
                  alt="theme preview"
                  class="w-16 h-16 rounded-lg border border-gray-200 dark:border-gray-600 object-cover flex-shrink-0"
                />
                <div class="flex-1 space-y-2">
                  <p class="text-xs text-gray-500 dark:text-gray-400">点击选择主色调：</p>
                  <!-- 提取的调色板 -->
                  <div class="flex flex-wrap gap-2">
                    <button
                      v-for="(color, index) in extractedPalette"
                      :key="color"
                      class="w-8 h-8 rounded-lg border-2 transition-all duration-200 flex items-center justify-center hover:scale-110"
                      :class="[
                        selectedPaletteIndex === index
                          ? 'border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-400'
                      ]"
                      :style="{ backgroundColor: color }"
                      :title="color"
                      @click="selectPaletteColor(index)"
                    >
                      <CheckOutlined
                        v-if="selectedPaletteIndex === index"
                        class="text-white drop-shadow-md text-xs"
                      />
                    </button>
                  </div>
                </div>
              </div>

              <!-- MD3 配色预览 -->
              <div v-if="md3Preview" class="space-y-2">
                <p class="text-xs text-gray-500 dark:text-gray-400">生成的 MD3 配色方案：</p>
                <div class="grid grid-cols-4 gap-1.5">
                  <div
                    class="h-8 rounded flex items-center justify-center text-xs font-medium"
                    :style="{
                      backgroundColor: md3Preview.primary,
                      color: md3Preview.onPrimary
                    }"
                    title="Primary"
                  >
                    主色
                  </div>
                  <div
                    class="h-8 rounded flex items-center justify-center text-xs font-medium"
                    :style="{
                      backgroundColor: md3Preview.secondary,
                      color: md3Preview.onSecondary
                    }"
                    title="Secondary"
                  >
                    次色
                  </div>
                  <div
                    class="h-8 rounded flex items-center justify-center text-xs font-medium"
                    :style="{
                      backgroundColor: md3Preview.tertiary,
                      color: md3Preview.onTertiary
                    }"
                    title="Tertiary"
                  >
                    三色
                  </div>
                  <div
                    class="h-8 rounded flex items-center justify-center text-xs font-medium"
                    :style="{ backgroundColor: md3Preview.error, color: md3Preview.onError }"
                    title="Error"
                  >
                    错误
                  </div>
                  <div
                    class="h-8 rounded flex items-center justify-center text-xs"
                    :style="{
                      backgroundColor: md3Preview.primaryContainer,
                      color: md3Preview.onPrimaryContainer
                    }"
                    title="Primary Container"
                  >
                    主容器
                  </div>
                  <div
                    class="h-8 rounded flex items-center justify-center text-xs"
                    :style="{
                      backgroundColor: md3Preview.secondaryContainer,
                      color: md3Preview.onSecondaryContainer
                    }"
                    title="Secondary Container"
                  >
                    次容器
                  </div>
                  <div
                    class="h-8 rounded flex items-center justify-center text-xs"
                    :style="{
                      backgroundColor: md3Preview.tertiaryContainer,
                      color: md3Preview.onTertiaryContainer
                    }"
                    title="Tertiary Container"
                  >
                    三容器
                  </div>
                  <div
                    class="h-8 rounded flex items-center justify-center text-xs"
                    :style="{
                      backgroundColor: md3Preview.errorContainer,
                      color: md3Preview.onErrorContainer
                    }"
                    title="Error Container"
                  >
                    错误容器
                  </div>
                </div>
                <div class="grid grid-cols-5 gap-1">
                  <div
                    class="h-6 rounded"
                    :style="{ backgroundColor: md3Preview.surface }"
                    title="Surface"
                  />
                  <div
                    class="h-6 rounded"
                    :style="{ backgroundColor: md3Preview.surfaceVariant }"
                    title="Surface Variant"
                  />
                  <div
                    class="h-6 rounded"
                    :style="{ backgroundColor: md3Preview.background }"
                    title="Background"
                  />
                  <div
                    class="h-6 rounded border border-gray-200 dark:border-gray-600"
                    :style="{ backgroundColor: md3Preview.outline }"
                    title="Outline"
                  />
                  <div
                    class="h-6 rounded"
                    :style="{ backgroundColor: md3Preview.inverseSurface }"
                    title="Inverse Surface"
                  />
                </div>
                <p class="text-xs text-gray-400 dark:text-gray-500">
                  已选主色：
                  <span class="font-mono">{{ imageSeedColor }}</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
